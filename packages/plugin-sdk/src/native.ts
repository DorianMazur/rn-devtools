import { io, type Socket } from "socket.io-client";
import { PluginMsg } from "./types";
import React from "react";

export type NativeBus = {
  sendMessage: (event: string, payload?: unknown) => void;
  addMessageListener: <T = unknown>(
    event: string,
    cb: (payload: T) => void,
  ) => () => void;
};

export function createNativePluginClient(
  pluginId: string,
  socket: Socket,
  deviceId: string,
): NativeBus {
  return {
    sendMessage(event, payload) {
      socket.emit("plugin:up", {
        pluginId,
        deviceId,
        event,
        payload,
        timestamp: Date.now(),
      });
    },
    addMessageListener<T = unknown>(event: string, cb: (payload: T) => void) {
      const handler = (msg: PluginMsg) => {
        if (
          msg?.pluginId === pluginId &&
          msg?.deviceId === deviceId &&
          msg?.event === event
        ) {
          if (typeof msg.payload !== "undefined") cb(msg.payload as T);
        }
      };
      socket.on("plugin:down", handler);
      return () => socket.off("plugin:down", handler);
    },
  };
}

export type RNDevtoolsOptions = {
  socketURL: string;
  deviceName: string;
  platform: string;
  deviceId: string;

  extraDeviceInfo?: Record<string, string>;
  envVariables?: Record<string, string>;

  plugins?: (ctx: { socket: Socket; deviceId: string }) => void;

  autoConnect?: boolean;
};

export function useReactNativeDevtools(opts: RNDevtoolsOptions) {
  const {
    socketURL,
    deviceName,
    platform,
    deviceId,
    extraDeviceInfo,
    envVariables,
    plugins,
    autoConnect = true,
  } = opts;

  const sockRef = React.useRef<Socket | null>(null);
  if (!sockRef.current) {
    const query: Record<string, string> = {
      role: "device",
      deviceName,
      deviceId,
      platform,
    };
    if (extraDeviceInfo)
      query.extraDeviceInfo = JSON.stringify(extraDeviceInfo);
    if (envVariables) query.envVariables = JSON.stringify(envVariables);

    sockRef.current = io(socketURL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      query,
    });
  }
  const socket = sockRef.current!;

  // Let the caller mount plugin hooks with this socket *during render*.
  if (plugins) {
    plugins({ socket, deviceId });
  }

  const [isConnected, setIsConnected] = React.useState(socket.connected);

  React.useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (autoConnect && !socket.connected) {
      socket.connect();
    }

    // Join rooms with a single hello
    socket.emit("devtools:hello", {
      role: "device",
      deviceId,
      deviceName,
      platform,
    });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket, deviceId, autoConnect]);

  return { socket, deviceId, isConnected };
}
