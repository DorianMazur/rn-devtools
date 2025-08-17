import React, { useEffect, useState } from "react";
import { User } from "virtual:rn-devtools-plugins";
import { useLogStore } from "./utils/logStore";

import { DeviceSelection } from "./components/DeviceSelection";
import { LogConsole } from "./components/LogConsole";
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

interface DashProps {
  allDevices: User[];
  isDashboardConnected: boolean;
  targetDevice: User;
  setTargetDevice: (device: User) => void;
}

export const Dashboard = () => {
  const [targetDevice, setTargetDevice] = useState<User>({
    deviceId: "Please select a device",
    deviceName: "Please select a device",
    isConnected: false,
    id: "Please select a device",
  });

  const { allDevices, isDashboardConnected } = useConnectedUsers();
  const [showOfflineDevices, setShowOfflineDevices] = useState(true);
  const { isEnabled, setIsEnabled, isVisible, setIsVisible } = useLogStore();
  const { activeId, setActiveId, tab, tabs } = useActiveTab(targetDevice);

  const filteredDevices = showOfflineDevices
    ? allDevices
    : allDevices.filter((device) => {
        if (typeof device === "string") {
          return false;
        }
        return device.isConnected;
      });

  // Find the target device
  useEffect(() => {
    const foundDevice = filteredDevices?.find((device) => {
      return device.deviceId === targetDevice.deviceId;
    });
    foundDevice && setTargetDevice(foundDevice);
  }, [setTargetDevice, filteredDevices, targetDevice]);

  return (
    <div className="font-sf-pro">
      <div className="flex flex-col w-full h-screen overflow-hidden bg-[#0A0A0C] text-white">
        <header className="w-full px-5 py-4 border-b border-[#2D2D2F]/50 flex flex-col gap-3 flex-shrink-0 bg-[#0A0A0C]/95 sticky top-0 z-20 shadow-[0_0.5rem_1rem_rgba(0,0,0,0.2)]">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full  ${
                  isDashboardConnected
                    ? "bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/20 shadow-[0_0_10px_rgba(74,222,128,0.1)]"
                    : "bg-gradient-to-r from-red-500/10 to-red-500/5 border border-red-500/20 shadow-[0_0_10px_rgba(248,113,113,0.1)]"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${isDashboardConnected ? "bg-green-400" : "bg-red-400"}`}
                />
                <span
                  className={`text-xs font-medium tracking-wide ${isDashboardConnected ? "text-green-300" : "text-red-300"}`}
                >
                  {isDashboardConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-5">
              <div className="flex-shrink-0">
                <DeviceSelection
                  selectedDevice={targetDevice}
                  setSelectedDevice={setTargetDevice}
                  allDevices={filteredDevices}
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

        <div className="fixed bottom-4 right-4 z-40">
          {isVisible ? (
            <div className="fixed inset-x-0 bottom-0 z-40 bg-[#0A0A0C] border-t border-[#2D2D2F]/50 shadow-2xl transition-all duration-500 ease-out transform animate-slideUpFade">
              <LogConsole
                onClose={() => setIsVisible(false)}
                allDevices={allDevices}
              />
            </div>
          ) : (
            <button
              onClick={() => setIsVisible(true)}
              className="flex items-center justify-center w-12 h-12 bg-[#1A1A1C] hover:bg-[#2D2D2F] text-[#F5F5F7] rounded-full shadow-[0_0.5rem_1rem_rgba(0,0,0,0.2)] border border-[#2D2D2F]/50 transition-all duration-500 ease-out hover:scale-110 hover:shadow-[0_0.5rem_1.5rem_rgba(59,130,246,0.2)]"
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
