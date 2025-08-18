import * as React from "react";
import {
  createWebPluginClient,
  DevtoolsPlugin,
  PluginProps,
} from "@rn-devtools/plugin-sdk";
import { NavigationState } from "@react-navigation/native";

const PLUGIN = "react-navigation";
const EVT_STATE = "state";

const Icon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path
      fillRule="evenodd"
      d="M12,23 C5.92486775,23 1,18.0751322 1,12 C1,5.92486775 5.92486775,1 12,1 C18.0751322,1 23,5.92486775 23,12 C23,18.0751322 18.0751322,23 12,23 Z M12,21 C16.9705627,21 21,16.9705627 21,12 C21,7.02943725 16.9705627,3 12,3 C7.02943725,3 3,7.02943725 3,12 C3,16.9705627 7.02943725,21 12,21 Z M17.5811388,6.41886117 L14.7905694,14.7905694 L6.41886117,17.5811388 L9.20943058,9.20943058 L17.5811388,6.41886117 Z M9.58113883,14.4188612 L13.2094306,13.2094306 L14.4188612,9.58113883 L10.7905694,10.7905694 L9.58113883,14.4188612 Z"
    />
  </svg>
);

function pathFromState(state?: NavigationState) {
  const parts: string[] = [];
  const walk = (s?: NavigationState) => {
    if (!s) return;
    const idx = typeof s.index === "number" ? s.index : 0;
    const r = s.routes?.[idx];
    if (!r) return;
    parts.push(r.name);
    if (r.state) walk(r.state as NavigationState);
  };
  walk(state);
  return parts;
}

function collectParamsFromState(state?: NavigationState) {
  const list: Record<string, unknown>[] = [];
  const walk = (s?: NavigationState) => {
    if (!s) return;
    const idx = typeof s.index === "number" ? s.index : 0;
    const r = s.routes?.[idx];
    if (!r) return;
    list.push((r.params ?? {}) as Record<string, unknown>);
    if (r.state) walk(r.state as NavigationState);
  };
  walk(state);
  return list;
}

function formatParamsForDisplay(paramsList: Record<string, unknown>[]) {
  // Shallow-merge from root to leaf; leaf overrides collisions.
  const merged: Record<string, unknown> = {};
  for (const p of paramsList) Object.assign(merged, p);

  const toText = (v: unknown): string => {
    if (v === null) return "null";
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") return String(v);
    if (Array.isArray(v)) {
      return v
        .filter(
          (iv) =>
            typeof iv === "string" ||
            typeof iv === "number" ||
            typeof iv === "boolean"
        )
        .map((iv) => String(iv))
        .join(",");
    }
    return "[obj]";
  };

  const pairs = Object.entries(merged)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${toText(v)}`);

  return pairs.length ? pairs.join("  ") : "";
}

const Tab: React.FC<PluginProps> = ({ targetDevice }) => {
  const deviceId = targetDevice?.deviceId;
  const client = React.useMemo(
    () => createWebPluginClient(PLUGIN, () => deviceId),
    [deviceId]
  );

  const [path, setPath] = React.useState<string[]>([]);
  const [history, setHistory] = React.useState<
    { ts: number; path: string[]; params: string }[]
  >([]);

  React.useEffect(() => {
    const unsubscribe = client.addMessageListener(
      EVT_STATE,
      (payload?: { state: NavigationState }) => {
        const state = payload?.state as NavigationState | undefined;
        const p = pathFromState(state);
        const params = formatParamsForDisplay(collectParamsFromState(state));

        setPath(p);
        setHistory((h) =>
          [{ ts: Date.now(), path: p, params }, ...h].slice(0, 20)
        );
      }
    );
    return () => {
      unsubscribe();
    };
  }, [client]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-cyan-300" />
        <div className="text-lg font-semibold">React Navigation</div>
      </div>

      {path.length > 0 ? (
        <div className="bg-[#111214] border border-[#2D2D2F]/60 rounded-lg p-3 mb-3">
          <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
            Current route
          </div>
          <div className="text-base font-mono break-words">
            {path.join(" / ")}
          </div>
        </div>
      ) : (
        <div className="text-sm text-amber-300/90 bg-amber-900/20 border border-amber-800/40 rounded-md px-3 py-2">
          Waiting for navigation events…
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-[#111214] border border-[#2D2D2F]/60 rounded-lg p-4 sm:p-5">
          <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">
            Recent transitions
          </div>

          <div className="space-y-2">
            {history.map((h, i) => (
              <div
                key={i}
                className="flex items-start gap-4 text-sm rounded-md px-3"
              >
                <div className="text-xs text-gray-500 w-28 shrink-0 pt-0.5 tabular-nums whitespace-nowrap">
                  {new Date(h.ts).toLocaleTimeString()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-mono break-words leading-5">
                    {h.path.join(" / ")}
                  </div>

                  {h.params && (
                    <div className="mt-1 pl-1.5 text-xs text-gray-400 font-mono break-all">
                      {h.params}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const NavigationPlugin: DevtoolsPlugin = {
  id: PLUGIN,
  title: "Navigation",
  Icon,
  mount: Tab,
};

export default NavigationPlugin;
