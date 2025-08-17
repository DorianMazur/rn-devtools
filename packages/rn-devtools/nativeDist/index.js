// native/useReactNativeDevtools.ts
import * as React from "react";
import { io } from "socket.io-client";
function useReactNativeDevtools(opts) {
  const {
    socketURL,
    deviceName,
    platform,
    deviceId,
    extraDeviceInfo,
    envVariables,
    plugins,
    autoConnect = true
  } = opts;
  const sockRef = React.useRef(null);
  if (!sockRef.current) {
    const query = {
      deviceName,
      deviceId,
      platform
    };
    if (extraDeviceInfo) query.extraDeviceInfo = JSON.stringify(extraDeviceInfo);
    if (envVariables) query.envVariables = JSON.stringify(envVariables);
    sockRef.current = io(socketURL, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      query
    });
  }
  const socket = sockRef.current;
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
    socket.emit("devtools:hello", { role: "device", deviceId, deviceName, platform });
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, [socket, deviceId, autoConnect]);
  const connect = React.useCallback(() => socket.connect(), [socket]);
  const disconnect = React.useCallback(() => socket.disconnect(), [socket]);
  return { socket, deviceId, isConnected, connect, disconnect };
}
export {
  useReactNativeDevtools
};
