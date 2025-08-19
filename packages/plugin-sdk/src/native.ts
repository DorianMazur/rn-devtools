import type { Socket } from "socket.io-client";
import { PluginMsg } from "./types";

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
