import type { Socket } from "socket.io-client";

export type NativeBus = {
  sendMessage: (event: string, payload?: any) => void;
  addMessageListener: (event: string, cb: (payload: any) => void) => () => void;
};
const test = "";

export function createNativePluginClient(
  pluginId: string,
  socket: Socket,
  deviceId: string
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
    addMessageListener(event, cb) {
      const handler = (msg: any) => {
        if (
          msg?.pluginId === pluginId &&
          msg?.deviceId === deviceId &&
          msg?.event === event
        ) {
          cb(msg.payload);
        }
      };
      socket.on("plugin:down", handler);
      return () => socket.off("plugin:down", handler);
    },
  };
}
