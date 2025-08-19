import * as React from "react";
import type {
  NavigationContainerRef,
  ParamListBase,
} from "@react-navigation/native";
import { useReduxDevToolsExtension } from "@react-navigation/devtools";
import { createNativePluginClient } from "@rn-devtools/plugin-sdk";
import type { Socket } from "socket.io-client";

type Props = {
  navigationRef: React.RefObject<NavigationContainerRef<ParamListBase>>;
  socket: Socket;
  deviceId: string;
};

const PLUGIN = "react-navigation";
const EVT_STATE = "state";
const EVT_NAV_INVOKE = "navigation.invoke";

type NavInvokePayload =
  | {
      method: "resetRoot";
      args?: Parameters<NavigationContainerRef<ParamListBase>["resetRoot"]>;
    }
  | {
      method: "navigate";
      args?: Parameters<NavigationContainerRef<ParamListBase>["navigate"]>;
    }
  | {
      method: "dispatch";
      args?: Parameters<NavigationContainerRef<ParamListBase>["dispatch"]>;
    }
  | {
      method: "goBack";
      args?: [];
    };

export function useReactNavigationDevtools({
  navigationRef,
  socket,
  deviceId,
}: Props) {
  useReduxDevToolsExtension(navigationRef);

  const clientRef = React.useRef(
    createNativePluginClient(PLUGIN, socket, deviceId),
  );
  const client = clientRef.current;

  React.useEffect(() => {
    const send = () => {
      const state = navigationRef.current?.getRootState?.();
      if (state) {
        client.sendMessage(EVT_STATE, { state });
      }
    };

    const unsub = navigationRef.current?.addListener?.("state", send);
    const t = setTimeout(send, 0);
    return () => {
      unsub?.();
      clearTimeout(t);
    };
  }, [client, navigationRef]);

  React.useEffect(() => {
    const unsubscribe = client.addMessageListener(
      EVT_NAV_INVOKE,
      (payload?: NavInvokePayload) => {
        const nav =
          navigationRef.current as NavigationContainerRef<ParamListBase> | null;
        if (!nav) return;

        switch (payload?.method) {
          case "resetRoot": {
            const [state] = payload.args ?? [];
            return nav.resetRoot?.(state);
          }

          case "navigate": {
            const args = (payload.args ?? []) as Parameters<
              NavigationContainerRef<ParamListBase>["navigate"]
            >;
            return nav.navigate(...args);
          }

          case "dispatch": {
            const args = (payload.args ?? []) as Parameters<
              NavigationContainerRef<ParamListBase>["dispatch"]
            >;
            return nav.dispatch(...args);
          }

          case "goBack": {
            return nav.goBack();
          }

          default:
            return undefined;
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [client, navigationRef]);
}

export default useReactNavigationDevtools;
