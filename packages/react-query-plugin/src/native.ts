import * as React from "react";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { dehydrate, focusManager, onlineManager } from "@tanstack/react-query";
import { createNativePluginClient } from "@rn-devtools/plugin-sdk";
import { Socket } from "socket.io-client";

type Props = {
  queryClient: QueryClient;
  socket: Socket;    
  deviceId: string;
  throttleMs?: number;
};

const PLUGIN = "react-query";
const EVT_STATE = "state";
const EVT_REQ = "rq.request";
const EVT_ACTION = "rq.action";

type ForcedMode = "loading" | "error" | null;
type Meta = { forced: ForcedMode; prevOptions?: any };
const keyId = (k: QueryKey) => {
  try { return JSON.stringify(k); } catch { return String(k as any); }
};

export function useReactQueryDevtools({
  queryClient,
  socket,
  deviceId,
  throttleMs = 300,
}: Props) {
  const clientRef = React.useRef(
    createNativePluginClient(PLUGIN, socket, deviceId )
  );
  const client = clientRef.current;

  // Track per-query forced mode + previous options for restoration
  const metaRef = React.useRef<Map<string, Meta>>(new Map());

  const sendSnapshot = React.useCallback(() => {
    try {
      const dehydrated = dehydrate(queryClient);
      client.sendMessage(EVT_STATE, { dehydrated, ts: Date.now() });
    } catch {}
  }, [client, queryClient]);

  React.useEffect(() => {
    let busy = false;
    let t: any;
    const schedule = () => {
      if (busy) return;
      busy = true;
      t = setTimeout(() => {
        busy = false;
        sendSnapshot();
      }, throttleMs);
    };

    sendSnapshot();

    const unsubQ = queryClient.getQueryCache().subscribe(schedule);
    const unsubM = queryClient.getMutationCache().subscribe(schedule);

    const offReq = client.addMessageListener(EVT_REQ, () => sendSnapshot());

    const offAct = client.addMessageListener(EVT_ACTION, async (msg: any) => {
      try {
        const { type, queryKey, exact, filters, value } = msg || {};
        const id = queryKey ? keyId(queryKey) : "";
        const getQuery = () =>
          queryClient.getQueryCache().find({ queryKey, exact: true, ...(filters || {}) }) as any;

        switch (type) {
          // Client-level ops
          case "invalidate":
            await queryClient.invalidateQueries({ queryKey, exact: exact ?? false, ...(filters || {}) });
            break;
          case "refetch":
            await queryClient.refetchQueries({ queryKey, exact: exact ?? true, ...(filters || {}) });
            // if we were forcing loading, stop forcing so real fetch can complete
            metaRef.current.delete(id);
            break;
          case "reset":
            await queryClient.resetQueries({ queryKey, exact: exact ?? false, ...(filters || {}) });
            metaRef.current.delete(id);
            break;
          case "remove":
            queryClient.removeQueries({ queryKey, exact: exact ?? false, ...(filters || {}) });
            metaRef.current.delete(id);
            break;
          case "cancel": {
            const q = getQuery();
            q?.cancel?.({ revert: false });
            break;
          }
          case "setData":
            queryClient.setQueryData(queryKey, value);
            // clearing forced mode if any
            metaRef.current.delete(id);
            break;

          // ===== Forced states (robust restore with local meta) =====
          case "triggerLoading": {
            const q = getQuery();
            if (!q) break;
            const prev = q.options;
            metaRef.current.set(id, { forced: "loading", prevOptions: prev });
            // never-resolving fetch to stay pending
            q.fetch({
              ...prev,
              queryFn: () => new Promise(() => {}),
              gcTime: -1,
            });
            q.setState({
              data: undefined,
              status: "pending",
              fetchStatus: "fetching",
              fetchMeta: {
                ...(q.state.fetchMeta || {}),
                __devtoolsForced: "loading",
              },
            });
            break;
          }

          case "restoreLoading": {
            const q = getQuery();
            if (!q) break;
            const meta = metaRef.current.get(id);
            const prevOpts = meta?.prevOptions;
            q.cancel?.({ silent: true });
            q.setState({
              ...q.state,
              fetchStatus: "idle",
              fetchMeta: null,
            });
            if (prevOpts) q.fetch(prevOpts);
            metaRef.current.delete(id);
            break;
          }

          case "triggerError": {
            const q = getQuery();
            if (!q) break;
            const prev = q.options;
            metaRef.current.set(id, { forced: "error", prevOptions: prev });
            const error = new Error("Forced error from devtools");
            q.setState({
              status: "error",
              error,
              fetchStatus: "idle",
              fetchMeta: {
                ...(q.state.fetchMeta || {}),
                __devtoolsForced: "error",
              },
            });
            break;
          }

          case "restoreError": {
            await queryClient.resetQueries({ queryKey, exact: true });
            metaRef.current.delete(id);
            break;
          }

          // misc
          case "setOnline":
            onlineManager.setOnline(!!value);
            break;
          case "setFocused":
            focusManager.setFocused(!!value);
            break;
          default:
            break;
        }

        sendSnapshot();
      } catch {}
    });

    return () => {
      clearTimeout(t);
      unsubQ();
      unsubM();
      offReq();
      offAct();
    };
  }, [queryClient, sendSnapshot, client, throttleMs]);
}

export default useReactQueryDevtools;
