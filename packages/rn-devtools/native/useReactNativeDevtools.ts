import * as React from "react";
import { io, Socket } from "socket.io-client";

export type RNDevtoolsOptions = {
  socketURL: string;

  // identity for the server UI
  deviceName: string;
  platform: string;
  deviceId: string;

  extraDeviceInfo?: Record<string, string>;
  envVariables?: Record<string, string>;

  /** Called during render (NOT in an effect!) so you can call hooks inside. */
  plugins?: (ctx: { socket: Socket; deviceId: string }) => void;

  /** Auto connect on mount (default: true) */
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

  // Create exactly one socket instance (autoConnect: false)
  const sockRef = React.useRef<Socket | null>(null);
  if (!sockRef.current) {
    const query: Record<string, string> = {
      deviceName,
      deviceId,
      platform,
    };
    if (extraDeviceInfo) query.extraDeviceInfo = JSON.stringify(extraDeviceInfo);
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
    // This is safe: we created the socket synchronously above.
    plugins({ socket, deviceId });
  }

  // Connection state
  const [isConnected, setIsConnected] = React.useState(socket.connected);

  // Connect lifecycle + hello
  React.useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    if (autoConnect && !socket.connected) {
      socket.connect();
    }

    // Join rooms with a single hello
    socket.emit("devtools:hello", { role: "device", deviceId, deviceName, platform });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      // Optional: keep alive across fast refresh — choose your preference.
      // socket.disconnect();
    };
    // deviceId and socket are stable for this hook instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, deviceId, autoConnect]);

  const connect = React.useCallback(() => socket.connect(), [socket]);
  const disconnect = React.useCallback(() => socket.disconnect(), [socket]);

  return { socket, deviceId, isConnected, connect, disconnect };
}
