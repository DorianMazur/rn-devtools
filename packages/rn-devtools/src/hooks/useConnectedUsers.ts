import io, { Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import { User } from "virtual:rn-devtools-plugins";

let socket = null as Socket | null;

export function useConnectedUsers() {
  const socketURL = "http://localhost:35515";
  const [isDashboardConnected, setIsDashboardConnected] = useState(
    !!socket?.connected
  );
  const [allDevices, setAllDevices] = useState<User[]>([]);

  if (!socket) {
    const enhancedQuery = {
      deviceName: "Dashboard",
    };

    console.log("[DASHBOARD] Initializing socket with query:", enhancedQuery);

    socket = io(socketURL, {
      autoConnect: false,
      query: enhancedQuery,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }

  function connect() {
    if (!socket?.connected) {
      console.log("[DASHBOARD] Connecting socket...");
      socket?.connect();
    } else {
      console.log("[DASHBOARD] Socket already connected:", socket.id);
    }
  }

  function disconnect() {
    console.log("[DASHBOARD] Disconnecting socket...");
    socket?.disconnect();
  }

  useEffect(() => {
    function onConnect() {
      console.log("[DASHBOARD] Socket connected with ID:", socket?.id);
      setIsDashboardConnected(true);
    }

    function onDisconnect() {
      console.log("[DASHBOARD] Socket disconnected");
      setIsDashboardConnected(false);
    }

    function onConnectError(error: Error) {
      console.error("[DASHBOARD] Connection error:", error.message);
    }

    !socket?.connected && connect();

    // Listen for all devices updates (including offline devices)
    socket?.on("all-devices-update", (devices: User[]) => {
      console.log(
        "[DASHBOARD] Received all-devices-update:",
        devices.length,
        "devices"
      );
      setAllDevices(devices);
    });

    socket?.on("connect", onConnect);
    socket?.on("disconnect", onDisconnect);
    socket?.on("connect_error", onConnectError);

    if (socket?.connected) {
      console.log(
        "[DASHBOARD] Socket already connected on mount with ID:",
        socket.id
      );
    }

    return () => {
      socket?.off("all-devices-update");
      socket?.off("connect");
      socket?.off("disconnect");
      socket?.off("connect_error");
      // Don't disconnect on cleanup - this would break the persistent connection
    };
  }, []);

  return {
    socket,
    connect,
    disconnect,
    isDashboardConnected,
    allDevices,
  };
}
