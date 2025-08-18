declare module "virtual:rn-devtools-plugins" {
  export interface Device {
    id: string;
    deviceName: string;
    deviceId: string; // Persisted device ID
    platform?: string; // Device platform (iOS, Android, Web)
    isConnected?: boolean; // Whether the device is currently connected
    extraDeviceInfo?: string; // json string of additional device information as key-value pairs
    envVariables?: string; // json string of environment variables from the mobile app
  }

  export type PluginProps = {
    targetDevice: Device;
    allDevices: Device[];
    isDashboardConnected: boolean;
    active?: boolean;
  };

  export type DevtoolsPlugin = {
    id: string;
    title: string;
    Icon: React.FC<{ className?: string }>;
    mount: React.ComponentType<PluginProps>;
  };

  export const plugins: DevtoolsPlugin[];
  export const pluginManifests: {
    mod: DevtoolsPlugin;
    options: Record<string, unknown>;
    pkg: string;
  }[];
}
