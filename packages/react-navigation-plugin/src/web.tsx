import * as React from "react";
import {
  createWebPluginClient,
  DevtoolsPlugin,
  PluginProps,
} from "@rn-devtools/plugin-sdk";
import type {
  NavigationState,
  PartialState,
  Route,
} from "@react-navigation/native";

const PLUGIN = "react-navigation";
const EVT_STATE = "state";
const EVT_STATE_REQUEST = "state.request";
const EVT_NAV_INVOKE = "navigation.invoke";

const Icon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path
      fillRule="evenodd"
      d="M12,23 C5.92486775,23 1,18.0751322 1,12 C1,5.92486775 5.92486775,1 12,1 C18.0751322,1 23,5.92486775 23,12 C23,18.0751322 18.0751322,23 12,23 Z M12,21 C16.9705627,21 21,16.9705627 21,12 C21,7.02943725 16.9705627,3 12,3 C7.02943725,3 3,7.02943725 3,12 C3,16.9705627 7.02943725,21 12,21 Z M17.5811388,6.41886117 L14.7905694,14.7905694 L6.41886117,17.5811388 L9.20943058,9.20943058 L17.5811388,6.41886117 Z M9.58113883,14.4188612 L13.2094306,13.2094306 L14.4188612,9.58113883 L10.7905694,10.7905694 L9.58113883,14.4188612 Z"
    />
  </svg>
);

function formatParamsShort(params?: unknown) {
  if (!params || typeof params !== "object") return "";
  const entries = Object.entries(params as Record<string, unknown>).filter(
    ([, v]) => v !== undefined
  );
  if (!entries.length) return "";
  const toText = (v: unknown) =>
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
      ? String(v)
      : Array.isArray(v)
        ? v
            .filter((iv) => ["string", "number", "boolean"].includes(typeof iv))
            .map(String)
            .join(",")
        : "[obj]";
  return entries.map(([k, v]) => `${k}=${toText(v)}`).join("  ");
}

/** Get the focused route chain and the deepest (focused) navigator state. */
function getFocusedChain(root?: NavigationState) {
  type ChainNode = {
    state: NavigationState;
    focusedRoute: Route<string> | undefined;
  };
  const chain: ChainNode[] = [];
  let s = root;
  while (s) {
    const idx = typeof s.index === "number" ? s.index : 0;
    const r = s.routes?.[idx];
    chain.push({ state: s, focusedRoute: r });
    s = r?.state as NavigationState | undefined;
  }
  const leaf = chain[chain.length - 1]?.state;
  // Ancestors are routes that *lead to* the leaf navigator (exclude the last focused leaf route)
  const ancestorsRoutes = chain
    .slice(0, -1)
    .map((c) => {
      return c.focusedRoute
        ? {
            name: c.focusedRoute.name,
            params: c.focusedRoute.params as
              | Record<string, unknown>
              | undefined,
          }
        : undefined;
    })
    .filter(Boolean) as { name: string; params?: Record<string, unknown> }[];
  return { chain, leaf, ancestorsRoutes };
}

/** Replace only the focused leaf state with a transformed version, preserving the rest of the tree. */
function updateFocusedLeaf(
  root: NavigationState,
  updater: (
    leaf: NavigationState
  ) => NavigationState | PartialState<NavigationState>
): NavigationState | PartialState<NavigationState> {
  const idx = typeof root.index === "number" ? root.index : 0;
  const focused = root.routes[idx];
  const child = focused?.state as NavigationState | undefined;

  if (child) {
    const newChild = updateFocusedLeaf(child, updater);
    const newRoutes = root.routes.map((route, i) =>
      i === idx ? { ...route, state: newChild } : route
    );
    return { ...root, routes: newRoutes };
  }

  // We're at the leaf navigator.
  return updater(root);
}

/** Build a minimal reset object that keeps all ancestors intact but replaces leaf's routes/index. */
function buildResetForLeaf(
  root: NavigationState,
  nextLeaf: { index: number; routes: Array<{ name: string; params?: object }> }
) {
  return updateFocusedLeaf(root, (leaf) => {
    // Keep any extra properties on leaf (type, stale, etc.) if present, but swap routes/index.
    return {
      ...leaf,
      index: nextLeaf.index,
      routes: nextLeaf.routes,
    } as NavigationState;
  });
}

type StackRow = { name: string; params?: Record<string, unknown> };

const Tab: React.FC<PluginProps> = ({ targetDevice }) => {
  const deviceId = targetDevice?.deviceId;
  const client = React.useMemo(
    () => createWebPluginClient(PLUGIN, () => deviceId),
    [deviceId]
  );

  const [deviceState, setDeviceState] = React.useState<NavigationState | null>(
    null
  );

  React.useEffect(() => {
    const unsub = client.addMessageListener(
      EVT_STATE,
      (payload?: { state: NavigationState }) => {
        // Always keep the latest full state from the device.
        if (payload?.state) setDeviceState(payload.state);
      }
    );
    return () => unsub();
  }, [client]);

  React.useEffect(() => {
    if (deviceId) client.sendMessage(EVT_STATE_REQUEST, {});
  }, [client, deviceId]);

  // Derive UI data from device state.
  const { leaf, ancestorsRoutes } = React.useMemo(() => {
    return getFocusedChain(deviceState ?? undefined);
  }, [deviceState]);

  const stackRoutes: StackRow[] = React.useMemo(() => {
    if (!leaf) return [];
    const routes = (leaf.routes ?? []) as ReadonlyArray<Route<string>>;
    return routes.map((r) => ({
      name: r.name,
      params: r.params as Record<string, unknown> | undefined,
    }));
  }, [leaf]);

  const activeIndex = typeof leaf?.index === "number" ? leaf!.index : 0;

  /** Actions */
  const sendResetWithLeaf = React.useCallback(
    (nextIndex: number, nextRoutes: StackRow[]) => {
      if (!deviceState || !leaf) return;
      const next = buildResetForLeaf(deviceState, {
        index: nextIndex,
        routes: nextRoutes.map((r) => ({
          name: r.name,
          ...(r.params ? { params: r.params } : {}),
        })),
      });
      client.sendMessage(EVT_NAV_INVOKE, {
        method: "resetRoot",
        args: [next],
      });
    },
    [client, deviceState, leaf]
  );

  const trimTo = React.useCallback(
    (i: number) => {
      const nextRoutes = stackRoutes.slice(0, i + 1);
      sendResetWithLeaf(i, nextRoutes);
    },
    [sendResetWithLeaf, stackRoutes]
  );

  const removeAt = React.useCallback(
    (i: number) => {
      if (stackRoutes.length <= 1) return; // keep at least one
      const nextRoutes = stackRoutes.filter((_, idx) => idx !== i);
      let nextIndex = activeIndex;
      if (activeIndex > i) nextIndex = activeIndex - 1;
      else if (activeIndex === i)
        nextIndex = Math.min(i, nextRoutes.length - 1);
      sendResetWithLeaf(nextIndex, nextRoutes);
    },
    [activeIndex, sendResetWithLeaf, stackRoutes]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-cyan-300" />
        <div className="text-lg font-semibold">React Navigation</div>
      </div>

      {!deviceState ? (
        <div className="text-sm text-amber-300/90 bg-amber-900/20 border border-amber-800/40 rounded-md px-3 py-2">
          Waiting for navigation state…
        </div>
      ) : (
        <>
          {/* Breadcrumbs showing which navigator we're editing */}
          <div className="bg-[#111214] border border-[#2D2D2F]/60 rounded-lg p-3 mb-3">
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
              Focused navigator
            </div>
            <div className="text-base font-mono break-words">
              {ancestorsRoutes.length
                ? ancestorsRoutes.map((a) => a.name).join(" / ")
                : "Root"}
            </div>
          </div>

          {/* Current stack */}
          <div className="bg-[#111214] border border-[#2D2D2F]/60 rounded-lg p-4 sm:p-5">
            <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">
              Current stack (on device)
            </div>

            {stackRoutes.length === 0 ? (
              <div className="text-sm text-gray-400">No routes.</div>
            ) : (
              <div className="space-y-2">
                {stackRoutes.map((r, i) => {
                  const isActive = i === activeIndex;
                  return (
                    <div
                      key={`${r.name}:${i}`}
                      className={`flex items-start gap-4 rounded-md px-3 py-2 ${
                        isActive ? "bg-[#191a1d]" : ""
                      }`}
                    >
                      <div className="w-10 text-xs text-gray-500 tabular-nums pt-1">
                        #{i}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-mono break-words leading-5">
                          {r.name}{" "}
                          {isActive && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-700/30 align-middle">
                              active
                            </span>
                          )}
                        </div>
                        {r.params && (
                          <div className="mt-1 pl-1.5 text-xs text-gray-400 font-mono break-all">
                            {formatParamsShort(r.params)}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <button
                          onClick={() => trimTo(i)}
                          className="text-xs px-2 py-1 rounded-md border border-[#2D2D2F] hover:bg-[#191a1d]"
                          title="Trim stack to this route (reset to here)"
                        >
                          Reset to here
                        </button>
                        <button
                          onClick={() => removeAt(i)}
                          disabled={stackRoutes.length <= 1}
                          className={`text-xs px-2 py-1 rounded-md border ${
                            stackRoutes.length <= 1
                              ? "border-[#2D2D2F] opacity-40 cursor-not-allowed"
                              : "border-[#2D2D2F] hover:bg-[#191a1d]"
                          }`}
                          title={
                            stackRoutes.length <= 1
                              ? "Cannot remove the only route"
                              : "Remove this route from the stack"
                          }
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export const NavigationPlugin: DevtoolsPlugin = {
  id: PLUGIN,
  title: "React Navigation",
  Icon,
  mount: Tab,
};

export default NavigationPlugin;
