/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
  hydrate,
  type DehydratedState,
  type QueryKey,
} from "@tanstack/react-query";
import { createWebPluginClient, Device } from "@rn-devtools/plugin-sdk";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";

const PLUGIN = "react-query";
const EVT_STATE = "state";
const EVT_REQ = "rq.request";
const EVT_ACTION = "rq.action";

export type DevToolsActionType =
  | "REFETCH"
  | "INVALIDATE"
  | "RESET"
  | "REMOVE"
  | "TRIGGER_ERROR"
  | "RESTORE_ERROR"
  | "TRIGGER_LOADING"
  | "RESTORE_LOADING"
  | "CLEAR_MUTATION_CACHE"
  | "CLEAR_QUERY_CACHE"
  | "ONLINE_ON"
  | "ONLINE_OFF";

export const DEV_TOOLS_EVENT = "@tanstack/query-devtools-event";

type DevToolsEventDetail = {
  type: DevToolsActionType;
  queryHash?: string;
  metadata?: Record<string, unknown>;
};

function onDevToolsEvent(
  cb: (
    type: DevToolsActionType,
    queryHash?: string,
    metadata?: Record<string, unknown>,
  ) => void,
) {
  const handler = (event: Event) => {
    const ce = event as CustomEvent<DevToolsEventDetail>;
    const { type, queryHash, metadata } = ce.detail || {};
    cb(type, queryHash, metadata);
  };
  window.addEventListener(DEV_TOOLS_EVENT, handler as EventListener);
  return () =>
    window.removeEventListener(DEV_TOOLS_EVENT, handler as EventListener);
}

const actionTypeToWire: Record<DevToolsActionType, string> = {
  REFETCH: "ACTION-REFETCH",
  INVALIDATE: "ACTION-INVALIDATE",
  RESET: "ACTION-RESET",
  REMOVE: "ACTION-REMOVE",
  TRIGGER_ERROR: "ACTION-TRIGGER-ERROR",
  RESTORE_ERROR: "ACTION-RESTORE-ERROR",
  TRIGGER_LOADING: "ACTION-TRIGGER-LOADING",
  RESTORE_LOADING: "ACTION-RESTORE-LOADING",
  CLEAR_MUTATION_CACHE: "ACTION-CLEAR-MUTATION-CACHE",
  CLEAR_QUERY_CACHE: "ACTION-CLEAR-QUERY-CACHE",
  ONLINE_ON: "ACTION-ONLINE-MANAGER-ONLINE",
  ONLINE_OFF: "ACTION-ONLINE-MANAGER-OFFLINE",
};

type ObserverState = { options?: any };
type DehydratedQuery = {
  queryKey: unknown[];
  queryHash: string;
  state: any;
  observers?: ObserverState[];
};
type SafeDehydratedState = {
  queries: DehydratedQuery[];
  mutations: any[];
};

function hydrateSafe(
  client: QueryClient,
  state: DehydratedState | SafeDehydratedState,
) {
  const s = state as SafeDehydratedState;
  s?.queries?.forEach((q) => {
    q?.observers?.forEach((o) => {
      if (o?.options) o.options.queryFn = undefined;
    });
  });
  hydrate(client, state as any);
}

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

const Tab: React.FC<PluginProps> = ({ targetDevice }) => {
  const deviceId = targetDevice?.deviceId;

  const [client] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            queryFn: () => new Promise<never>(() => {}), // inert
            retry: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            refetchOnMount: false,
            staleTime: Infinity,
            gcTime: Infinity,
          },
        },
      }),
  );

  const rq = React.useMemo(
    () => createWebPluginClient(PLUGIN, () => deviceId),
    [deviceId],
  );

  const applyingRemote = React.useRef(false);

  const lastDataForwardRef = React.useRef<
    Map<string, { ts: number; hash: string }>
  >(new Map());
  const DATA_EMIT_WINDOW_MS = 200;

  const sendDataUpdate = React.useCallback(
    (queryHash: string, queryKey: unknown[], data: unknown) => {
      if (!deviceId || !queryHash) return;

      let payloadStr: string;
      try {
        payloadStr = JSON.stringify({ queryKey, data });
      } catch {
        payloadStr = Math.random().toString(36);
      }
      const now = Date.now();
      const last = lastDataForwardRef.current.get(queryHash);
      if (
        last &&
        last.hash === payloadStr &&
        now - last.ts < DATA_EMIT_WINDOW_MS
      )
        return;

      lastDataForwardRef.current.set(queryHash, {
        ts: now,
        hash: payloadStr,
      });

      rq.sendMessage(
        EVT_ACTION,
        {
          action: "ACTION-DATA-UPDATE",
          query: { queryHash, queryKey: queryKey as unknown[] },
          data,
        },
        deviceId,
      );
    },
    [rq, deviceId],
  );

  // Hydrate snapshots from native (imperative; no HydrationBoundary needed)
  React.useEffect(() => {
    const unsubscribe = rq.addMessageListener(
      EVT_STATE,
      (payload?: unknown) => {
        try {
          const p = payload as { dehydrated?: DehydratedState };
          if (p && p.dehydrated) {
            applyingRemote.current = true;
            hydrateSafe(client, p.dehydrated);
            applyingRemote.current = false;
          }
        } catch {
          applyingRemote.current = false;
        }
      },
    );
    return () => unsubscribe();
  }, [rq, client]);

  // Ask device for state when the target changes
  React.useEffect(() => {
    if (deviceId) rq.sendMessage(EVT_REQ, {}, deviceId);
  }, [rq, deviceId]);

  // Forward explicit button actions from the Devtools UI
  React.useEffect(() => {
    const off = onDevToolsEvent((type, queryHash) => {
      if (!deviceId) return;
      const action = actionTypeToWire[type];
      if (!action) return;

      rq.sendMessage(
        EVT_ACTION,
        {
          action,
          query: { queryHash },
        },
        deviceId,
      );
    });
    return () => off();
  }, [rq, deviceId]);

  // Forward panel-side data edits (reliable path)
  React.useEffect(() => {
    const origSet = client.setQueryData.bind(client);

    (client as any).setQueryData = (
      key: QueryKey,
      updater: any,
      opts?: { updatedAt?: number },
    ) => {
      const res = origSet(key as any, updater, opts as any);

      if (applyingRemote.current || !deviceId) return res;

      try {
        const nextValue = client.getQueryData(key);
        const q = client
          .getQueryCache()
          .find({ queryKey: key, exact: true }) as any;
        const queryHash: string | undefined = q?.queryHash;
        if (queryHash) {
          sendDataUpdate(queryHash, key as unknown[], nextValue);
        }
      } catch {
        // ignore
      }

      return res;
    };

    return () => {
      (client as any).setQueryData = origSet;
    };
  }, [client, deviceId, sendDataUpdate]);

  // Optional fallback: forward "manual success" cache updates
  React.useEffect(() => {
    const cache = client.getQueryCache() as any;
    const off = cache.subscribe((evt: any) => {
      if (applyingRemote.current) return;
      if (evt?.type !== "updated") return;
      const act = evt.action;
      if (act?.type === "success" && act?.manual) {
        const q = evt.query;
        if (!q) return;
        sendDataUpdate(q.queryHash, q.queryKey as unknown[], q?.state?.data);
      }
    });
    return () => off();
  }, [client, sendDataUpdate]);

  React.useEffect(() => {
    const cache = client.getQueryCache() as any;
    const seen = new WeakSet<object>();
    const patch = (q: any) => {
      if (!q || seen.has(q)) return;
      seen.add(q);
      q.fetch = async () => undefined;
      q.cancel = async () => undefined;
    };
    cache.getAll().forEach(patch);
    const unsub = cache.subscribe((evt: any) => {
      if (evt?.query) patch(evt.query);
    });
    return () => unsub();
  }, [client]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-rose-300" />
          <div className="text-lg font-semibold">React Query</div>
        </div>
      </div>
      <QueryClientProvider client={client}>
        {!deviceId ? (
          <div className="text-sm text-gray-400">Waiting for device…</div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <ReactQueryDevtoolsPanel />
          </div>
        )}
      </QueryClientProvider>
    </div>
  );
};

export const ReactQueryPlugin: DevtoolsPlugin = {
  id: PLUGIN,
  title: "React Query",
  Icon,
  mount: Tab,
};

export default ReactQueryPlugin;
