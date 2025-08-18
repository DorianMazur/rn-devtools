export type Device = {
  id: string;
  deviceId: string;
  deviceName: string;
  isConnected: boolean;
  platform?: string;
};

export type PluginProps = {
  targetDevice: Device;
  allDevices: Device[];
  isDashboardConnected: boolean;
};

export type PluginMsg = {
  pluginId: string;
  deviceId?: string;
  event: string;
  payload?: Record<string, unknown>;
  timestamp?: number;
};

export type DevtoolsPlugin = {
  id: string;
  title: string;
  Icon: React.FC<{ className?: string }>;
  mount: React.ComponentType<PluginProps>;
};
