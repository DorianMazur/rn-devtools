import * as _socket_io_component_emitter from '@socket.io/component-emitter';
import { Socket } from 'socket.io-client';

type RNDevtoolsOptions = {
    socketURL: string;
    deviceName: string;
    platform: string;
    deviceId: string;
    extraDeviceInfo?: Record<string, string>;
    envVariables?: Record<string, string>;
    /** Called during render (NOT in an effect!) so you can call hooks inside. */
    plugins?: (ctx: {
        socket: Socket;
        deviceId: string;
    }) => void;
    /** Auto connect on mount (default: true) */
    autoConnect?: boolean;
};
declare function useReactNativeDevtools(opts: RNDevtoolsOptions): {
    socket: Socket<_socket_io_component_emitter.DefaultEventsMap, _socket_io_component_emitter.DefaultEventsMap>;
    deviceId: string;
    isConnected: boolean;
    connect: () => Socket<_socket_io_component_emitter.DefaultEventsMap, _socket_io_component_emitter.DefaultEventsMap>;
    disconnect: () => Socket<_socket_io_component_emitter.DefaultEventsMap, _socket_io_component_emitter.DefaultEventsMap>;
};

export { type RNDevtoolsOptions, useReactNativeDevtools };
