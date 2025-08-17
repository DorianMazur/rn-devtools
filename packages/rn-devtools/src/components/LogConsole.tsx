import React, { useEffect, useRef, useState } from "react";
import { useLogStore, LogEntry, LogLevel } from "../utils/logStore";
import { PlatformIcon } from "../utils/platformUtils";
import { User } from "../external-dash/types/User";

// Get log level color
const getLogLevelColor = (level: LogLevel): string => {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warn":
      return "text-yellow-400";
    case "debug":
      return "text-purple-400";
    case "info":
    default:
      return "text-blue-400";
  }
};

const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

interface LogEntryItemProps {
  log: LogEntry;
}

const LogEntryItem: React.FC<LogEntryItemProps> = ({ log }) => {
  return (
    <div className="py-1 font-mono text-xs border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
      <div className="flex items-start gap-2">
        {/* Timestamp */}
        <span className="text-gray-500 whitespace-nowrap min-w-[5rem] pl-2">
          {formatTimestamp(log.timestamp)}
        </span>

        {/* Log level */}
        <span
          className={`uppercase font-bold min-w-[3rem] ${getLogLevelColor(
            log.level
          )}`}
        >
          {log.level}
        </span>

        {/* Device info if available */}
        {log.platform && (
          <span className="flex items-center gap-1 text-gray-400 min-w-[8rem]">
            <PlatformIcon platform={log.platform} className="w-3 h-3" />
            <span className="truncate max-w-[7rem]">
              {log.deviceName || "Unknown"}
            </span>
          </span>
        )}

        {/* Log message */}
        <span className="text-gray-300 break-words flex-1">{log.message}</span>
      </div>
    </div>
  );
};

interface DeviceOption {
  value: string;
  label: string;
  disabled?: boolean;
  isOffline?: boolean;
  platform?: string;
}

interface LogConsoleProps {
  onClose: () => void;
  allDevices: User[];
}

export const LogConsole: React.FC<LogConsoleProps> = ({
  onClose,
  allDevices,
}) => {
  const logs = useLogStore((state: { logs: LogEntry[] }) => state.logs);
  const clearLogs = useLogStore(
    (state: { clearLogs: () => void }) => state.clearLogs
  );
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");

  // Auto-scroll functionality
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Resizable functionality
  const [height, setHeight] = useState(320); // Default height in pixels
  const resizableRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate max height based on window height
  const calculateMaxHeight = () => {
    // Leave space for the header (approximately 64px) and some padding
    return window.innerHeight - 80;
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent text selection
    if (e.button !== 0) return; // Only handle left mouse button

    setIsDragging(true);
    const startY = e.clientY;
    const startHeight = height;

    const handleResizeMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY;
      const maxHeight = calculateMaxHeight();
      const newHeight = Math.max(
        200,
        Math.min(maxHeight, startHeight + deltaY)
      );
      setHeight(newHeight);
    };

    const handleResizeEnd = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleResizeMove);
      document.removeEventListener("mouseup", handleResizeEnd);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", handleResizeMove);
    document.addEventListener("mouseup", handleResizeEnd);
    document.body.style.cursor = "ns-resize";
  };

  // Update max height on window resize
  useEffect(() => {
    const handleResize = () => {
      const maxHeight = calculateMaxHeight();
      if (height > maxHeight) {
        setHeight(maxHeight);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [height]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  // Reset device filter if selected device is no longer available
  useEffect(() => {
    if (deviceFilter !== "all") {
      const deviceExists = allDevices.some(
        (device) => device.deviceId === deviceFilter
      );
      if (!deviceExists) {
        setDeviceFilter("all");
      }
    }
  }, [allDevices, deviceFilter]);

  // Filter logs based on level and device
  const filteredLogs = logs.filter((log: LogEntry) => {
    const matchesLevel = filter === "all" || log.level === filter;
    const matchesDevice =
      deviceFilter === "all" || log.deviceId === deviceFilter;
    return matchesLevel && matchesDevice;
  });

  // Generate device options based on available devices
  const deviceOptions: DeviceOption[] = (() => {
    if (allDevices?.length === 0) {
      return [{ value: "all", label: "All Devices" }];
    } else if (allDevices?.length === 1) {
      // Only one device, no need for "All" option
      const device = allDevices[0];
      return [
        {
          value: device.deviceId,
          label: device.deviceName || "Unknown Device",
          isOffline: !device.isConnected,
          platform: device.platform,
        },
      ];
    } else {
      // Multiple devices, include "All" option
      return [
        { value: "all", label: "All Devices" },
        ...allDevices.map((device) => ({
          value: device.deviceId,
          label: device.deviceName || "Unknown Device",
          isOffline: !device.isConnected,
          platform: device.platform,
        })),
      ];
    }
  })();

  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [isLevelDropdownOpen, setIsLevelDropdownOpen] = useState(false);
  const deviceDropdownRef = useRef<HTMLDivElement>(null);
  const levelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        deviceDropdownRef.current &&
        !deviceDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDeviceDropdownOpen(false);
      }
      if (
        levelDropdownRef.current &&
        !levelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsLevelDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const levelOptions = [
    { value: "all", label: "All" },
    { value: "info", label: "Info" },
    { value: "warn", label: "Warn" },
    { value: "error", label: "Error" },
    { value: "debug", label: "Debug" },
  ];

  return (
    <>
      {/* Resize handle */}
      <div
        className="h-1 bg-transparent hover:bg-gray-600/50 cursor-ns-resize relative group"
        onMouseDown={handleResizeStart}
      >
        <div className="absolute inset-x-0 h-0.5 bottom-0 bg-gray-700/50 group-hover:bg-gray-500/50" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-400"
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
          <span className="text-sm font-medium text-gray-200">
            Console ({filteredLogs.length} logs)
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Device Filter */}
          <div className="flex items-center gap-2 text-xs relative">
            <span className="text-gray-400">Device:</span>
            <div className="relative" ref={deviceDropdownRef}>
              <button
                onClick={() => setIsDeviceDropdownOpen(!isDeviceDropdownOpen)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 min-w-[8rem] flex items-center justify-between gap-2 select-none"
              >
                <div className="flex items-center gap-2">
                  <span>
                    {
                      deviceOptions.find((opt) => opt.value === deviceFilter)
                        ?.label
                    }
                  </span>
                  {deviceFilter !== "all" && (
                    <span className="text-gray-300">
                      <PlatformIcon
                        platform={
                          allDevices.find((d) => d.deviceId === deviceFilter)
                            ?.platform || ""
                        }
                      />
                    </span>
                  )}
                </div>
                <svg
                  className="w-4 h-4"
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
              {isDeviceDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50">
                  {deviceOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setDeviceFilter(option.value);
                        setIsDeviceDropdownOpen(false);
                      }}
                      className={`w-full px-2 py-1.5 text-left flex items-center justify-between gap-2 hover:bg-gray-700/50 ${
                        deviceFilter === option.value ? "bg-gray-700/30" : ""
                      } ${
                        option.isOffline ? "text-gray-500" : "text-gray-300"
                      } select-none`}
                    >
                      <div className="flex items-center gap-2">
                        {option.label}
                        {option.platform && (
                          <span
                            className={`${
                              option.isOffline
                                ? "text-gray-500"
                                : "text-gray-300"
                            }`}
                          >
                            <PlatformIcon platform={option.platform} />
                          </span>
                        )}
                      </div>
                      {option.value !== "all" && (
                        <div
                          className={`w-1.5 h-1.5 rounded-full ${
                            option.isOffline ? "bg-red-500" : "bg-green-500"
                          }`}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Log Level Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Level:</span>
            <div className="relative" ref={levelDropdownRef}>
              <button
                onClick={() => setIsLevelDropdownOpen(!isLevelDropdownOpen)}
                className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-300 min-w-[6rem] flex items-center justify-between gap-2 select-none"
              >
                <span>
                  {levelOptions.find((opt) => opt.value === filter)?.label}
                </span>
                <svg
                  className="w-4 h-4"
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
              {isLevelDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-full bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50">
                  {levelOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilter(option.value as LogLevel | "all");
                        setIsLevelDropdownOpen(false);
                      }}
                      className={`w-full px-2 py-1.5 text-left hover:bg-gray-700/50 ${
                        filter === option.value ? "bg-gray-700/30" : ""
                      } text-gray-300 select-none`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Auto-scroll toggle */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Auto-scroll:</span>
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`w-10 h-5 rounded-full flex items-center transition-colors ${
                autoScroll ? "bg-blue-600" : "bg-gray-700"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform ${
                  autoScroll ? "translate-x-5" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Clear button */}
          <button
            onClick={clearLogs}
            className="text-xs px-3 py-1 bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 transition-colors"
          >
            Clear
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-md transition-colors duration-200"
          >
            <svg
              className="w-4 h-4 text-gray-400"
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
        </div>
      </div>

      {/* Log entries container with dynamic height */}
      <div
        ref={scrollRef}
        style={{ height: `${height}px` }}
        className={`overflow-y-auto flex flex-col-reverse select-text ${
          isDragging ? "pointer-events-none" : ""
        }`}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "a") {
            e.preventDefault();
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(e.currentTarget);
            selection?.removeAllRanges();
            selection?.addRange(range);
          }
        }}
        tabIndex={0}
      >
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log: LogEntry) => (
            <LogEntryItem key={log.id} log={log} />
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500 italic">
            No logs to display
          </div>
        )}
      </div>
    </>
  );
};
