import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
  HydrationBoundary,
  hydrate,
  type QueryKey,
  type DehydratedState,
} from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createWebPluginClient, Device } from "@rn-devtools/plugin-sdk";

type PluginProps = {
  targetDevice?: Device | null;
  allDevices?: Device[];
  isDashboardConnected: boolean;
};
type DevtoolsPlugin = {
  id: string;
  title: string;
  Icon: React.FC<{ className?: string }>;
  mount: React.ComponentType<PluginProps>;
};

const PLUGIN = "react-query";
const EVT_STATE = "state";
const EVT_REQ = "rq.request";
const EVT_ACTION = "rq.action";

// how long to suppress the immediate fetch the panel does after setState
const SUPPRESS_MS = 500;

const Icon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
  >
    <path d="M12 3v18M3 12h18" />
  </svg>
);

type RQActionType =
  | "invalidate"
  | "refetch"
  | "reset"
  | "remove"
  | "cancel"
  | "setData"
  | "triggerLoading"
  | "restoreLoading"
  | "triggerError"
  | "restoreError";

type RQActionPayload = {
  queryKey?: QueryKey;
  exact?: boolean;
  filters?: Record<string, unknown>;
  value?: unknown;
};

type SendAction = (type: RQActionType, payload?: RQActionPayload) => void;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

/** Intercept client-level methods and emit write-through actions */
function wireClientWriteThrough(
  client: QueryClient,
  sendAction: SendAction,
  applyingRemoteRef: React.MutableRefObject<boolean>
) {
  const shouldEmit = () => !applyingRemoteRef.current;

  const origSet = client.setQueryData.bind(client);
  client.setQueryData = ((key, updater, opts) => {
    const res = origSet(key, updater as never, opts as never);
    if (shouldEmit()) {
      try {
        const next = client.getQueryData(key);
        sendAction("setData", { queryKey: key, value: next });
      } catch {
        // ignore
      }
    }
    return res;
  }) as typeof client.setQueryData;

  const origInv = client.invalidateQueries.bind(client);
  client.invalidateQueries = (async (
    ...args: Parameters<typeof client.invalidateQueries>
  ) => {
    const r = await origInv(...args);
    if (shouldEmit()) {
      const [filters] = args;
      sendAction("invalidate", { ...(filters ?? {}) });
    }
    return r;
  }) as typeof client.invalidateQueries;

  const origRef = client.refetchQueries.bind(client);
  client.refetchQueries = (async (
    ...args: Parameters<typeof client.refetchQueries>
  ) => {
    const r = await origRef(...args);
    if (shouldEmit()) {
      const [filters] = args;
      sendAction("refetch", { ...(filters ?? {}) });
    }
    return r;
  }) as typeof client.refetchQueries;

  const origRes = client.resetQueries.bind(client);
  client.resetQueries = (async (
    ...args: Parameters<typeof client.resetQueries>
  ) => {
    const r = await origRes(...args);
    if (shouldEmit()) {
      const [filters] = args;
      sendAction("reset", { ...(filters ?? {}) });
    }
    return r;
  }) as typeof client.resetQueries;

  const origRem = client.removeQueries.bind(client);
  client.removeQueries = ((
    ...args: Parameters<typeof client.removeQueries>
  ) => {
    const r = origRem(...args);
    if (shouldEmit()) {
      const [filters] = args;
      sendAction("remove", { ...(filters ?? {}) });
    }
    return r;
  }) as typeof client.removeQueries;
}

type QueryStateLike = {
  status?: string;
  fetchStatus?: string;
  fetchMeta?: unknown | null;
};

type MinimalQuery = {
  queryKey: QueryKey;
  state: QueryStateLike;
  options?: unknown;
  fetch?: (opts?: unknown) => Promise<unknown> | unknown;
  cancel?: (opts?: unknown) => Promise<unknown> | unknown;
  setState?: (
    updater: ((prev: QueryStateLike) => QueryStateLike) | QueryStateLike,
    action?: unknown
  ) => unknown;
};

const isMinimalQuery = (q: unknown): q is MinimalQuery =>
  isObject(q) && "queryKey" in q;

/** Intercept per-query ops; suppress panel’s immediate fetch after setState-derived intents */
function wirePerQueryInterceptors(client: QueryClient, sendAction: SendAction) {
  const cache = client.getQueryCache();
  const seen = new WeakSet<object>();
  const suppressUntil = new WeakMap<object, number>();

  const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const isSuppressed = (q: object) => {
    const t = suppressUntil.get(q);
    return typeof t === "number" && now() < t;
  };
  const suppressNextFetch = (q: object) => {
    suppressUntil.set(q, now() + SUPPRESS_MS);
  };

  const patchQuery = (candidate: unknown) => {
    if (!isMinimalQuery(candidate) || seen.has(candidate as object)) return;
    const q = candidate;
    seen.add(q as object);

    const key = q.queryKey;

    // Refetch (panel calls q.fetch) — we emit an action instead.
    q.fetch = async () => {
      if (isSuppressed(q as object)) return Promise.resolve(undefined);
      sendAction("refetch", { queryKey: key, exact: true });
      return Promise.resolve(undefined);
    };

    // Cancel
    q.cancel = async () => {
      if (!isSuppressed(q as object)) {
        sendAction("cancel", { queryKey: key, exact: true });
      }
      return Promise.resolve(undefined);
    };

    // Derive intent from panel toggles
    const origSetState = q.setState?.bind(q);
    q.setState = (updater, action) => {
      const prev = q.state;
      const next =
        typeof updater === "function"
          ? (updater as (p: QueryStateLike) => QueryStateLike)(prev)
          : (updater as QueryStateLike);

      let derived:
        | "triggerError"
        | "restoreError"
        | "triggerLoading"
        | "restoreLoading"
        | null = null;

      if (next?.status === "error" && prev?.status !== "error") {
        derived = "triggerError";
      } else if (
        (next?.status === "pending" || next?.fetchStatus === "fetching") &&
        !(prev?.status === "pending" || prev?.fetchStatus === "fetching")
      ) {
        derived = "triggerLoading";
      } else if (prev?.status === "error" && next?.status !== "error") {
        derived = "restoreError";
      } else if (
        (prev?.status === "pending" || prev?.fetchStatus === "fetching") &&
        !(next?.status === "pending" || next?.fetchStatus === "fetching")
      ) {
        derived = "restoreLoading";
      }

      if (derived) {
        suppressNextFetch(q as object);
        sendAction(derived, { queryKey: key });
      }

      return origSetState ? origSetState(updater, action) : undefined;
    };
  };

  cache.getAll().forEach(patchQuery);
  const unsub = cache.subscribe((evt: unknown) => {
    if (isObject(evt) && "query" in evt) {
      patchQuery((evt as { query?: unknown }).query);
    }
  });
  return unsub;
}

const Panel: React.FC<PluginProps> = ({ targetDevice }) => {
  const deviceId =
    (isObject(targetDevice) && typeof targetDevice.deviceId === "string"
      ? targetDevice.deviceId
      : undefined) || undefined;

  const [client] = React.useState(() => new QueryClient());
  const rq = React.useMemo(
    () => createWebPluginClient(PLUGIN, () => deviceId),
    [deviceId]
  );

  const applyingRemote = React.useRef(false);

  React.useEffect(() => {
    const sendAction: SendAction = (type, payload) => {
      if (!deviceId) return;
      rq.sendMessage(EVT_ACTION, { type, ...(payload || {}) }, deviceId);
    };
    wireClientWriteThrough(client, sendAction, applyingRemote);
    const unsub = wirePerQueryInterceptors(client, sendAction);
    return () => unsub?.();
  }, [client, rq, deviceId]);

  React.useEffect(() => {
    const unsubscribe = rq.addMessageListener(
      EVT_STATE,
      (payload?: unknown) => {
        try {
          if (
            isObject(payload) &&
            "dehydrated" in payload &&
            (payload as { dehydrated?: unknown }).dehydrated
          ) {
            applyingRemote.current = true;
            hydrate(
              client,
              (payload as { dehydrated?: DehydratedState }).dehydrated!
            );
            applyingRemote.current = false;
          }
        } catch {
          applyingRemote.current = false;
        }
      }
    );
    return () => {
      unsubscribe();
    };
  }, [rq, client]);

  React.useEffect(() => {
    if (deviceId) rq.sendMessage(EVT_REQ);
  }, [rq, deviceId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-rose-300" />
          <div className="text-lg font-semibold">React Query</div>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 overflow-hidden">
        <QueryClientProvider client={client}>
          <HydrationBoundary state={undefined}>
            <ReactQueryDevtoolsPanel />
          </HydrationBoundary>
        </QueryClientProvider>
      </div>
    </div>
  );
};

export const ReactQueryPlugin: DevtoolsPlugin = {
  id: PLUGIN,
  title: "React Query",
  Icon,
  mount: Panel,
};

export default ReactQueryPlugin;
