import * as React from "react";
import type {
  Mutation,
  Query,
  QueryClient,
  QueryOptions,
  QueryState,
} from "@tanstack/react-query";
import { onlineManager } from "@tanstack/react-query";
import {
  createNativePluginClient,
  NativeHookProps,
} from "@rn-devtools/plugin-sdk";

const PLUGIN = "react-query";
const EVT_STATE = "state";
const EVT_REQ = "rq.request";
const EVT_ACTION = "rq.action";

type Props = NativeHookProps & {
  /** Query client to monitor. */
  queryClient: QueryClient;
  /** Throttle duration in milliseconds. */
  throttleMs?: number;
};

type WireAction =
  | "ACTION-REFETCH"
  | "ACTION-INVALIDATE"
  | "ACTION-RESET"
  | "ACTION-REMOVE"
  | "ACTION-DATA-UPDATE"
  | "ACTION-TRIGGER-ERROR"
  | "ACTION-RESTORE-ERROR"
  | "ACTION-TRIGGER-LOADING"
  | "ACTION-RESTORE-LOADING"
  | "ACTION-ONLINE-MANAGER-ONLINE"
  | "ACTION-ONLINE-MANAGER-OFFLINE"
  | "ACTION-CLEAR-MUTATION-CACHE"
  | "ACTION-CLEAR-QUERY-CACHE";

type Incoming = {
  action?: WireAction;
  query?: { queryHash?: string; queryKey?: unknown[] };
  data?: unknown;
};

type QueryFunction = (...args: unknown[]) => unknown;

type DehydratedMutation = {
  mutationId: number;
  mutationKey: unknown[] | undefined;
  state: unknown;
  scope?: unknown;
  meta?: unknown;
};

type ObserverState = {
  queryHash: string;
  options: QueryOptions;
  queryFn: QueryFunction | undefined;
};

type DehydratedQuery = {
  state: QueryState;
  queryKey: unknown[];
  queryHash: string;
  meta?: unknown;
  observers: ObserverState[];
};

type DehydratedState = {
  mutations: DehydratedMutation[];
  queries: DehydratedQuery[];
};

function dehydrateMutation(mutation: Mutation): DehydratedMutation {
  return {
    mutationId: mutation.mutationId,
    // @ts-expect-error Incompatible types
    mutationKey: mutation.options?.mutationKey || [],
    state: mutation.state,
    ...(mutation.options?.scope && { scope: mutation.options.scope }),
    ...(mutation.meta && { meta: mutation.meta }),
  };
}

function dehydrateQuery(query: Query): DehydratedQuery {
  const observerStates: ObserverState[] = query.observers.map((observer) => ({
    queryHash: query.queryHash,
    options: observer.options,
    queryFn: undefined as unknown as QueryFunction,
  }));

  return {
    state: {
      ...query.state,
      ...(query.state?.data !== undefined ? { data: query.state.data } : {}),
    },
    // @ts-expect-error Incompatible types
    queryKey: query.queryKey,
    queryHash: query.queryHash,
    ...(query.meta && { meta: query.meta }),
    observers: observerStates,
  };
}

function Dehydrate(client: QueryClient): DehydratedState {
  const mutations = client
    .getMutationCache()
    .getAll()
    .map((m: Mutation) => dehydrateMutation(m));

  const queries = client
    .getQueryCache()
    .getAll()
    .map((q: Query) => dehydrateQuery(q));

  return { mutations, queries };
}

export function useReactQueryDevtools({
  queryClient,
  socket,
  deviceId,
  throttleMs = 500,
}: Props) {
  const clientRef = React.useRef(
    createNativePluginClient(PLUGIN, socket, deviceId)
  );
  const client = clientRef.current;

  const forcedRef = React.useRef<
    Map<
      string,
      {
        mode: "loading" | "error";
        prevState?: QueryState;
        prevOptions?: QueryOptions;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        originalFetch?: (...args: any[]) => Promise<unknown>;
      }
    >
  >(new Map());

  const getByHash = React.useCallback(
    (hash?: string) =>
      hash ? queryClient.getQueryCache().get(hash) : undefined,
    [queryClient]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filtersOf = (q: any) =>
    q ? { queryKey: q.queryKey as unknown[], exact: true } : {};

  const sendSnapshot = React.useCallback(() => {
    try {
      const dehydrated = Dehydrate(queryClient);
      client.sendMessage(EVT_STATE, { dehydrated, ts: Date.now() });
    } catch {}
  }, [client, queryClient]);

  const scheduleRef = React.useRef<{
    t?: ReturnType<typeof setTimeout>;
    busy: boolean;
  }>({
    busy: false,
  });

  const schedule = React.useCallback(() => {
    if (scheduleRef.current.busy) return;
    scheduleRef.current.busy = true;
    scheduleRef.current.t = setTimeout(() => {
      scheduleRef.current.busy = false;
      sendSnapshot();
    }, throttleMs);
  }, [sendSnapshot, throttleMs]);

  React.useEffect(() => {
    sendSnapshot();

    const unsubQ = queryClient.getQueryCache().subscribe(schedule);
    const unsubM = queryClient.getMutationCache().subscribe(schedule);

    const offReq = client.addMessageListener(EVT_REQ, () => sendSnapshot());

    const offAct = client.addMessageListener(
      EVT_ACTION,
      async (msg: Incoming) => {
        try {
          const action = msg?.action as WireAction | undefined;
          const queryHash = msg?.query?.queryHash;
          const data = msg?.data;
          const activeQuery = getByHash(queryHash);

          switch (action) {
            case "ACTION-CLEAR-QUERY-CACHE":
              queryClient.clear();
              break;
            case "ACTION-CLEAR-MUTATION-CACHE":
              queryClient.getMutationCache().clear();
              break;

            case "ACTION-REFETCH":
              if (!activeQuery) break;
              if (forcedRef.current.get(activeQuery.queryHash)) break;
              {
                const p = activeQuery.fetch();
                p?.catch?.(() => {});
              }
              break;

            case "ACTION-INVALIDATE":
              if (!activeQuery) break;
              if (forcedRef.current.get(activeQuery.queryHash)) break;
              await queryClient.invalidateQueries(filtersOf(activeQuery));
              break;

            case "ACTION-RESET":
              if (!activeQuery) break;
              if (forcedRef.current.get(activeQuery.queryHash)) break;
              await queryClient.resetQueries(filtersOf(activeQuery));
              break;

            case "ACTION-REMOVE":
              if (!activeQuery) break;
              if (forcedRef.current.get(activeQuery.queryHash)) break;
              queryClient.removeQueries(filtersOf(activeQuery));
              break;

            case "ACTION-DATA-UPDATE":
              if (!activeQuery) break;
              if (forcedRef.current.get(activeQuery.queryHash)) break;
              queryClient.setQueryData(activeQuery.queryKey, data, {
                updatedAt: Date.now(),
              });
              break;

            case "ACTION-TRIGGER-LOADING":
              if (!activeQuery) break;
              if (
                forcedRef.current.get(activeQuery.queryHash)?.mode === "loading"
              )
                break;

              await activeQuery.cancel({ revert: false });

              forcedRef.current.set(activeQuery.queryHash, {
                mode: "loading",
                prevOptions: activeQuery.options,
                prevState: activeQuery.state,
                originalFetch: activeQuery.fetch?.bind(activeQuery),
              });

              activeQuery.setOptions?.({
                ...activeQuery.options,
                gcTime: Number.POSITIVE_INFINITY,
              });

              activeQuery.fetch = () => new Promise<never>(() => {});

              activeQuery.setState({
                ...activeQuery.state,
                data: undefined,
                status: "pending",
                fetchStatus: "fetching",
                fetchMeta: { ...(activeQuery.state.fetchMeta || {}) },
              });
              break;

            case "ACTION-RESTORE-LOADING":
              if (!activeQuery) break;
              {
                const forced = forcedRef.current.get(activeQuery.queryHash);
                if (!forced || forced.mode !== "loading") break;

                await activeQuery.cancel({ revert: false });

                if (forced.originalFetch) {
                  activeQuery.fetch = forced.originalFetch;
                }

                if (forced.prevOptions && activeQuery.setOptions) {
                  activeQuery.setOptions(forced.prevOptions);
                }

                if (forced.prevState) {
                  activeQuery.setState({
                    ...forced.prevState,
                    fetchStatus: "idle",
                    fetchMeta: null,
                  });
                }

                if (forced.prevState?.fetchStatus === "fetching") {
                  const p = activeQuery.fetch();
                  p?.catch?.(() => {});
                }

                forcedRef.current.delete(activeQuery.queryHash);
              }
              break;

            case "ACTION-TRIGGER-ERROR":
              if (!activeQuery) break;

              forcedRef.current.set(activeQuery.queryHash, {
                mode: "error",
                prevOptions: activeQuery.options,
                prevState: activeQuery.state,
                originalFetch: activeQuery.fetch?.bind(activeQuery),
              });

              activeQuery.setState({
                ...activeQuery.state,
                status: "error",
                error: new Error("Forced error from devtools"),
                fetchStatus: "idle",
                data: activeQuery.state.data,
                fetchMeta: { ...(activeQuery.state.fetchMeta || {}) },
              });
              break;

            case "ACTION-RESTORE-ERROR":
              if (!activeQuery) break;
              {
                const forced = forcedRef.current.get(activeQuery.queryHash);
                if (!forced || forced.mode !== "error") {
                  await queryClient.resetQueries(filtersOf(activeQuery));
                  break;
                }

                await activeQuery.cancel({ revert: false });

                if (forced.prevOptions && activeQuery.setOptions) {
                  activeQuery.setOptions(forced.prevOptions);
                }
                if (forced.prevState) {
                  activeQuery.setState({
                    ...forced.prevState,
                    fetchStatus: "idle",
                    fetchMeta: null,
                  });
                }

                if (forced.prevState?.fetchStatus === "fetching") {
                  const p = activeQuery.fetch();
                  p?.catch?.(() => {});
                }

                forcedRef.current.delete(activeQuery.queryHash);
              }
              break;

            case "ACTION-ONLINE-MANAGER-ONLINE":
              onlineManager.setOnline(true);
              break;
            case "ACTION-ONLINE-MANAGER-OFFLINE":
              onlineManager.setOnline(false);
              break;

            default:
              break;
          }

          sendSnapshot();
        } catch {}
      }
    );

    return () => {
      clearTimeout(scheduleRef.current.t);
      unsubQ();
      unsubM();
      offReq();
      offAct();
    };
  }, [client, deviceId, queryClient, sendSnapshot, getByHash, throttleMs]);
}

export default useReactQueryDevtools;
