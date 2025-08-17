export type User = {
  id: string;
  deviceId: string;
  deviceName: string;
  isConnected: boolean;
  platform?: string;
};

export type PluginProps = {
  targetDevice: User;
  allDevices: User[];
  isDashboardConnected: boolean;
};

export type DevtoolsPlugin = {
  id: string;
  title: string;
  Icon: React.FC<{ className?: string }>;
  mount: React.ComponentType<PluginProps>;
};
