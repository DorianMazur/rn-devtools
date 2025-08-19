import React, { useEffect, useState } from "react";
import { Device } from "virtual:rn-devtools-plugins";

import { DeviceSelection } from "./components/DeviceSelection";
import { PluginHost } from "./components/PluginHost";
import { PluginTabs } from "./components/PluginTabs";
import { useActiveTab } from "./hooks/useActiveTab";
import { useConnectedUsers } from "./hooks/useConnectedUsers";
import "./app.css";

export const App: React.FC = () => {
  return <Dashboard />;
};

export const getPlatformColor = (platform: string): string => {
  const normalizedPlatform = platform?.toLowerCase() || "";
  switch (normalizedPlatform) {
    case "ios":
      return "text-gray-100";
    case "android":
      return "text-green-300";
    case "web":
      return "text-blue-300";
    case "tv":
    case "tvos":
      return "text-purple-300";
    default:
      return "text-gray-300";
  }
};

export const getPlatformBgColor = (platform: string): string => {
  const normalizedPlatform = platform?.toLowerCase() || "";
  switch (normalizedPlatform) {
    case "ios":
      return "bg-blue-900/30 text-blue-200";
    case "android":
      return "bg-green-900/30 text-green-200";
    case "web":
      return "bg-cyan-900/30 text-cyan-200";
    case "tv":
    case "tvos":
      return "bg-purple-900/30 text-purple-200";
    default:
      return "bg-gray-800/60 text-gray-300";
  }
};

export const Dashboard = () => {
  const [targetDevice, setTargetDevice] = useState<Device>({
    deviceId: undefined,
    deviceName: undefined,
    isConnected: false,
    id: undefined,
  });

  const { allDevices, isDashboardConnected } = useConnectedUsers();
  const { activeId, setActiveId, tabs } = useActiveTab(targetDevice);

  // Find the target device
  useEffect(() => {
    const foundDevice = allDevices?.find((device) => {
      return device?.deviceId === targetDevice?.deviceId;
    });
    if (!foundDevice) return;
    setTargetDevice(foundDevice);
  }, [setTargetDevice, allDevices, targetDevice]);

  return (
    <div className="font-sf-pro">
      <div className="flex flex-col w-full h-screen overflow-hidden bg-[#0A0A0C] text-white">
        <header className="w-full px-5 py-4 border-b border-[#2D2D2F]/50 flex flex-col gap-3 flex-shrink-0 bg-[#0A0A0C]/95 sticky top-0 z-20 shadow-[0_0.5rem_1rem_rgba(0,0,0,0.2)]">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-4" />

            <div className="flex items-center gap-5">
              <div className="flex-shrink-0">
                <DeviceSelection
                  selectedDevice={targetDevice}
                  setSelectedDevice={setTargetDevice}
                  allDevices={allDevices}
                />
              </div>
            </div>
          </div>

          <div className="w-full flex items-center justify-center">
            <PluginTabs
              tabs={tabs}
              activeId={activeId}
              setActiveId={setActiveId}
            />
            <div />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 pb-72 bg-gradient-to-b from-[#0A0A0C] to-[#121214]">
          <div className="px-2 max-w-5xl mx-auto space-y-6">
            <PluginHost
              tabs={tabs}
              activeId={activeId}
              targetDevice={targetDevice}
              allDevices={allDevices}
              isDashboardConnected={isDashboardConnected}
            />
          </div>
        </main>
      </div>
    </div>
  );
};
