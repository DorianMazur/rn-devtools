import * as React from "react";
import type { NavigationContainerRef } from "@react-navigation/native";
import { useReduxDevToolsExtension } from "@react-navigation/devtools";
import { createNativePluginClient } from "@rn-devtools/plugin-sdk";
import { Socket } from "socket.io-client";

type Props = {
  navigationRef: React.RefObject<NavigationContainerRef<any>>;
  socket: Socket;
  deviceId: string;
};

const PLUGIN = "react-navigation";
const EVT_STATE = "state";
const EVT_NAV_INVOKE = "navigation.invoke";

export function useReactNavigationDevtools({
  navigationRef,
  socket,
  deviceId,
}: Props) {
  useReduxDevToolsExtension(navigationRef);
  const clientRef = React.useRef(
    createNativePluginClient(PLUGIN, socket, deviceId )
  );
  const client = clientRef.current;
  // send snapshots UP
  React.useEffect(() => {
    const send = () => {
      const state = navigationRef.current?.getRootState?.();
      console.log("[rn-devtools] Sending navigation state", state);
      if (state) client.sendMessage(EVT_STATE, { state });
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
      ({ method, args = [] }) => {
        const nav: any = navigationRef.current;
        if (!nav) return;
        if (method === "resetRoot") return nav.resetRoot?.(args[0]);
        return typeof nav[method] === "function"
          ? nav[method](...args)
          : undefined;
      }
    );
    return () => {
      unsubscribe();
    };
  }, [client, navigationRef]);
}
export default useReactNavigationDevtools;
