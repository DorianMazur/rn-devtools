import React, { useEffect, useRef, useState } from "react";
import type { Device } from "virtual:rn-devtools-plugins";
import { PlatformIcon } from "../utils/platformUtils";

type Props = {
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device | null) => void;
  allDevices?: Device[];
};

export const DeviceSelection: React.FC<Props> = ({
  selectedDevice,
  setSelectedDevice,
  allDevices = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const devicesSorted = [...allDevices].sort((a, b) => {
    const oa = !!a.isConnected;
    const ob = !!b.isConnected;
    if (oa !== ob) return oa ? -1 : 1; // online first
    return (a.deviceName || "").localeCompare(b.deviceName || "");
  });

  const handleSelect = (deviceId: string) => {
    const d = allDevices.find((x) => x.deviceId === deviceId) || null;
    setSelectedDevice(d);
    setIsOpen(false);
  };

  const label =
    selectedDevice?.deviceName ??
    (allDevices.length ? "Select a device" : "No devices");

  const StatusDot: React.FC<{ offline?: boolean }> = ({ offline }) => (
    <span
      className={`w-1.5 h-1.5 rounded-full ${
        offline ? "bg-red-500" : "bg-green-500"
      }`}
    />
  );

  return (
    <div ref={ref} className="relative w-56 font-sf-pro">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium border rounded-xl transition-all duration-300 ${
          isOpen
            ? "text-white bg-[#2D2D2F] border-blue-500/40 ring-2 ring-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
            : "text-white bg-[#1A1A1C] hover:bg-[#2D2D2F] border-[#2D2D2F]"
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedDevice ? (
            <>
              <StatusDot offline={!selectedDevice.isConnected} />
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0A0A0C]">
                <PlatformIcon
                  platform={selectedDevice.platform || ""}
                  className="w-3 h-3"
                />
              </span>
            </>
          ) : (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0A0A0C]">
              <svg
                className="w-3 h-3 text-gray-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </span>
          )}
          <span className="truncate">{label}</span>
        </div>
        <svg
          className={`w-4 h-4 ml-2 transition-transform duration-300 ${
            isOpen ? "rotate-180 text-blue-400" : "text-[#A1A1A6]"
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 animate-scaleIn">
          <div className="overflow-hidden rounded-xl shadow-lg border border-[#2D2D2F] ring-1 ring-black/5 bg-[#1A1A1C]">
            {/* Non-selectable header */}
            <div className="sticky top-0 z-10 px-4 py-2 text-xs font-semibold tracking-wide uppercase text-[#A1A1A6] bg-[#1A1A1C] border-b border-[#2D2D2F]/70 select-none cursor-default">
              {allDevices.length ? "Select a device" : "No devices"}
            </div>

            <div className="max-h-56 overflow-y-auto p-1">
              {devicesSorted.map((d, idx) => {
                const active = selectedDevice?.deviceId === d.deviceId;
                return (
                  <button
                    key={d.deviceId}
                    type="button"
                    onClick={() => handleSelect(d.deviceId)}
                    className={`flex items-center w-full px-3 py-2 text-sm rounded-lg my-0.5 transition-all duration-300 ${
                      active
                        ? "bg-blue-500/10 text-blue-300 ring-1 ring-blue-500/20"
                        : !d.isConnected
                          ? "text-gray-400 hover:bg-[#2D2D2F]/50"
                          : "text-white hover:bg-[#2D2D2F]/70"
                    }`}
                    style={{ animationDelay: `${idx * 24}ms` }}
                    role="option"
                    aria-selected={active}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <StatusDot offline={!d.isConnected} />
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#0A0A0C]">
                        {d.platform ? (
                          <PlatformIcon
                            platform={d.platform}
                            className="w-3 h-3"
                          />
                        ) : (
                          <svg
                            className="w-3 h-3 text-gray-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{d.deviceName}</span>
                      {active && (
                        <svg
                          className="w-4 h-4 ml-auto text-blue-400"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
