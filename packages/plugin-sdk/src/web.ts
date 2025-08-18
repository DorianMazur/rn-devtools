import { io, Socket } from "socket.io-client";
import { PluginMsg } from "./types";

export type WebBus = {
  socket: Socket;
  sendMessage: (event: string, payload?: unknown, deviceId?: string) => void;
  addMessageListener: <T = unknown>(
    event: string,
    cb: (payload: T, meta: { deviceId: string }) => void
  ) => () => void;
};

let singleton: Socket | null = null;

function getSocket(): Socket {
  if (singleton) return singleton;
  singleton = io("/", { transports: ["websocket", "polling"] });
  singleton.emit("devtools:hello", { role: "dashboard" });
  return singleton;
}

export function createWebPluginClient(
  pluginId: string,
  getDeviceId: () => string | undefined
): WebBus {
  const socket = getSocket();

  return {
    socket,
    sendMessage(event, payload, deviceId) {
      const target = deviceId ?? getDeviceId();
      if (!target) return;
      socket.emit("plugin:down", {
        pluginId,
        deviceId: target,
        event,
        payload,
      });
    },
    addMessageListener<T = unknown>(
      event: string,
      cb: (payload: T, meta: { deviceId: string }) => void
    ) {
      const handler = (msg: PluginMsg) => {
        if (msg.pluginId !== pluginId) return;
        if (msg.event !== event) return;
        const current = getDeviceId();
        if (current && msg.deviceId === undefined && msg.deviceId !== current)
          return;
        if (typeof msg.payload !== "undefined") {
          cb(msg.payload as T, { deviceId: msg.deviceId as string });
        }
      };
      socket.on("plugin:up", handler);
      return () => socket.off("plugin:up", handler);
    },
  };
}
