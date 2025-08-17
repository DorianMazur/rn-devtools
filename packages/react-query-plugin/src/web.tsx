import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
  HydrationBoundary,
  hydrate,
  type QueryKey,
} from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createWebPluginClient } from "@rn-devtools/plugin-sdk";

type PluginProps = {
  targetDevice: { deviceId?: string; deviceName?: string } | any;
  allDevices: any[];
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

function wireClientWriteThrough(
  client: QueryClient,
  sendAction: (type: string, payload?: any) => void,
  applyingRemoteRef: React.MutableRefObject<boolean>
) {
  const shouldEmit = () => !applyingRemoteRef.current;

  const origSet = client.setQueryData.bind(client);
  client.setQueryData = ((key: QueryKey, updater: any, opts?: any) => {
    const res = origSet(key as any, updater as any, opts as any);
    if (shouldEmit()) {
      try {
        const next = client.getQueryData(key as any);
        sendAction("setData", { queryKey: key, value: next });
      } catch {}
    }
    return res;
  }) as any;

  const origInv = client.invalidateQueries.bind(client);
  client.invalidateQueries = (async (filters?: any, options?: any) => {
    const r = await origInv(filters as any, options as any);
    if (shouldEmit()) sendAction("invalidate", { ...(filters || {}) });
    return r;
  }) as any;

  const origRef = client.refetchQueries.bind(client);
  client.refetchQueries = (async (filters?: any, options?: any) => {
    const r = await origRef(filters as any, options as any);
    if (shouldEmit()) sendAction("refetch", { ...(filters || {}) });
    return r;
  }) as any;

  const origRes = client.resetQueries.bind(client);
  client.resetQueries = (async (filters?: any, options?: any) => {
    const r = await origRes(filters as any, options as any);
    if (shouldEmit()) sendAction("reset", { ...(filters || {}) });
    return r;
  }) as any;

  const origRem = client.removeQueries.bind(client);
  client.removeQueries = ((filters?: any) => {
    const r = origRem(filters as any);
    if (shouldEmit()) sendAction("remove", { ...(filters || {}) });
    return r;
  }) as any;
}

/** Intercept per-query ops; suppress panel’s immediate fetch after setState-derived intents */
function wirePerQueryInterceptors(
  client: QueryClient,
  sendAction: (type: string, payload?: any) => void
) {
  const cache = client.getQueryCache();
  const seen = new WeakSet<any>();
  const suppressUntil = new WeakMap<any, number>();

  const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const isSuppressed = (q: any) => {
    const t = suppressUntil.get(q);
    return typeof t === "number" && now() < t;
  };
  const suppressNextFetch = (q: any) => {
    suppressUntil.set(q, now() + SUPPRESS_MS);
  };

  const patchQuery = (q: any) => {
    if (!q || seen.has(q)) return;
    seen.add(q);

    const key = q.queryKey;

    // Refetch (panel calls q.fetch)
    const origFetch = q.fetch?.bind(q);
    q.fetch = async (_opts?: any) => {
      if (isSuppressed(q)) {
        // swallow the immediate follow-up fetch after a forced state toggle
        return Promise.resolve();
      }
      sendAction("refetch", { queryKey: key, exact: true });
      return Promise.resolve();
    };

    // Cancel
    const origCancel = q.cancel?.bind(q);
    q.cancel = async () => {
      if (!isSuppressed(q)) {
        sendAction("cancel", { queryKey: key, exact: true });
      }
      return Promise.resolve();
    };

    // Derive intent from panel toggles
    const origSetState = q.setState?.bind(q);
    q.setState = (updater: any, action: any) => {
      const prev = q.state;
      const next = typeof updater === "function" ? updater(prev) : updater;

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
        // prevent the panel’s immediate q.fetch from undoing the forced state
        suppressNextFetch(q);
        sendAction(derived, { queryKey: key });
      }

      return origSetState ? origSetState(updater, action) : undefined;
    };
  };

  cache.getAll().forEach(patchQuery);
  const unsub = cache.subscribe((evt: any) => {
    if (evt?.query) patchQuery(evt.query);
  });
  return unsub;
}

const Panel: React.FC<PluginProps> = ({ targetDevice }) => {
  const deviceId = targetDevice?.deviceId;
  const [client] = React.useState(() => new QueryClient());
  const rq = React.useMemo(
    () => createWebPluginClient(PLUGIN, () => deviceId),
    [deviceId]
  );

  const applyingRemote = React.useRef(false);

  React.useEffect(() => {
    const sendAction = (type: string, payload?: any) => {
      if (!deviceId) return;
      rq.sendMessage(EVT_ACTION, { type, ...(payload || {}) }, deviceId);
    };
    wireClientWriteThrough(client, sendAction, applyingRemote);
    const unsub = wirePerQueryInterceptors(client, sendAction);
    return () => unsub?.();
  }, [client, rq, deviceId]);

  React.useEffect(() => {
    const unsubscribe = rq.addMessageListener(EVT_STATE, (payload) => {
      try {
        const { dehydrated, ts } = payload || {};
        if (dehydrated) {
          applyingRemote.current = true;
          hydrate(client, dehydrated);
          applyingRemote.current = false;
        }
      } catch {
        applyingRemote.current = false;
      }
    });
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
          <HydrationBoundary state={undefined as any}>
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
