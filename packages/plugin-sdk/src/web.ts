import { io, Socket } from "socket.io-client";

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
) {
  const socket = getSocket();

  function sendMessage(event: string, payload?: any, deviceId?: string) {
    const target = deviceId ?? getDeviceId();
    if (!target) return;
    socket.emit("plugin:down", { pluginId, deviceId: target, event, payload });
  }

  function addMessageListener(
    event: string,
    cb: (payload: any, meta: { deviceId: string }) => void
  ) {
    console.log(`[rn-devtools] Adding listener for event: ${event}`);
    const handler = (msg: any) => {
      console.log(`[rn-devtools] Plugin message received: ${event}`, msg);
      if (msg.pluginId !== pluginId) return;
      if (msg.event !== event) return;
      const current = getDeviceId();
      if (current && msg.deviceId !== current) return;
      cb(msg.payload, { deviceId: msg.deviceId });
    };
    socket.on("plugin:up", handler);
    return () => socket.off("plugin:up", handler);
  }

  return { socket, sendMessage, addMessageListener };
}
