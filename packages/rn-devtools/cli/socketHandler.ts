import type { Server, Socket } from "socket.io";

type Hello = {
  role: "device" | "dashboard";
  deviceId?: string;
  deviceName?: string;
  platform?: string;
};
type PluginMsg = {
  pluginId: string;
  deviceId?: string;
  event: string;
  payload?: any;
  timestamp?: number;
};

type DeviceInfo = {
  deviceId: string;
  name?: string;
  platform?: string;
  sockets: Set<string>;
  lastSeen: number;
  meta?: Record<string, any>;
};

function sanitizePluginId(raw: string) {
  return (raw || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 64);
}
function sanitizeEvent(raw: string) {
  return String(raw || "").slice(0, 128);
}

export default function socketHandle({ io }: { io: Server }) {
  const dashboards = new Set<string>();
  const devices = new Map<string, DeviceInfo>();

  const broadcastDevices = () => {
    const list = Array.from(devices.values()).map((d) => ({
      id: Array.from(d.sockets)[0] ?? "",
      deviceName: d.name ?? d.deviceId,
      deviceId: d.deviceId,
      platform: d.platform,
      isConnected: d.sockets.size > 0,
      lastSeen: d.lastSeen,
    }));
    io.to("dashboards").emit("all-devices-update", list);
  };

  const upsertDevice = (
    deviceId: string,
    socketId: string,
    name?: string,
    platform?: string,
    meta?: any
  ) => {
    let d = devices.get(deviceId);
    if (!d) {
      d = {
        deviceId,
        name,
        platform,
        sockets: new Set(),
        lastSeen: Date.now(),
        meta,
      };
      devices.set(deviceId, d);
    }
    if (name) d.name = name;
    if (platform) d.platform = platform;
    if (meta) d.meta = meta;
    d.lastSeen = Date.now();
    d.sockets.add(socketId);
    io.sockets.sockets.get(socketId)?.join(`device:${deviceId}`);
  };

  const removeSocketFromDevices = (socketId: string) => {
    let changed = false;
    for (const d of devices.values()) {
      if (d.sockets.delete(socketId)) {
        d.lastSeen = Date.now();
        changed = true;
      }
    }
    if (changed) broadcastDevices();
  };

  io.on("connection", (socket: Socket) => {
    const q = socket.handshake.query as Record<string, any>;
    const qRole = (q.role as string) || undefined;
    const qDeviceId = (q.deviceId as string) || undefined;
    const qName = (q.deviceName as string) || undefined;
    const qPlatform = (q.platform as string) || undefined;

    if (qRole === "dashboard" || qName === "Dashboard") {
      dashboards.add(socket.id);
      socket.join("dashboards");
      // send current devices right away
      broadcastDevices();
    } else if (qRole === "device" && qDeviceId) {
      upsertDevice(qDeviceId, socket.id, qName, qPlatform);
      broadcastDevices();
    }

    socket.on(
      "devtools:hello",
      ({ role, deviceId, deviceName, platform }: Hello) => {
        if (role === "dashboard") {
          dashboards.add(socket.id);
          socket.join("dashboards");
          broadcastDevices();
        } else if (role === "device" && deviceId) {
          upsertDevice(deviceId, socket.id, deviceName, platform);
          broadcastDevices();
        }
      }
    );

    // Device -> Dashboards
    socket.on("plugin:up", (msg: PluginMsg) => {
      const pluginId = sanitizePluginId(msg?.pluginId || "");
      const event = sanitizeEvent(msg?.event || "");
      // derive deviceId from the room membership if not provided
      const roomDev = Array.from(socket.rooms).find((r) =>
        r.startsWith("device:")
      );
      const derivedId = roomDev?.slice("device:".length);
      const deviceId = msg?.deviceId || derivedId;

      if (!pluginId || !event || !deviceId) return;

      const d = devices.get(deviceId);
      if (d) d.lastSeen = Date.now();

      io.to("dashboards").emit("plugin:up", {
        pluginId,
        deviceId,
        event,
        payload: msg?.payload,
        timestamp: msg?.timestamp ?? Date.now(),
      });
    });

    // Dashboards -> Device
    socket.on("plugin:down", (msg: PluginMsg) => {
      if (!dashboards.has(socket.id)) return; // only dashboards can send commands
      const pluginId = sanitizePluginId(msg?.pluginId || "");
      const event = sanitizeEvent(msg?.event || "");
      const deviceId = msg?.deviceId;
      if (!pluginId || !event || !deviceId) return;

      io.to(`device:${deviceId}`).emit("plugin:down", {
        pluginId,
        deviceId,
        event,
        payload: msg?.payload,
        timestamp: msg?.timestamp ?? Date.now(),
      });
    });

    socket.on("disconnect", () => {
      dashboards.delete(socket.id);
      removeSocketFromDevices(socket.id);
    });
  });
}
