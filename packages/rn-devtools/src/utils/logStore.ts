import { create } from "zustand";

export type LogLevel = "info" | "error" | "warn" | "debug";

export interface LogEntry {
  id: string;
  timestamp: Date;
  message: string;
  level: LogLevel;
  deviceId?: string;
  deviceName?: string;
  platform?: string;
}

interface LogState {
  logs: LogEntry[];
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;
  maxLogs: number;
  setMaxLogs: (max: number) => void;
  isEnabled: boolean;
  setIsEnabled: (enabled: boolean) => void;
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
}

export const useLogStore = create<LogState>((set) => ({
  logs: [] as LogEntry[],
  maxLogs: 500, // Default max logs to store
  isEnabled: true, // Default enabled
  isVisible: false, // Default hidden

  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) =>
    set((state: LogState) => {
      // If logging is disabled, ignore the log
      if (!state.isEnabled) return state;

      const newLog: LogEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date(),
        ...entry,
      };

      // Add new log and trim if exceeding max
      const newLogs = [newLog, ...state.logs];
      if (newLogs.length > state.maxLogs) {
        newLogs.length = state.maxLogs;
      }

      return { logs: newLogs };
    }),

  clearLogs: () => set({ logs: [] }),

  setMaxLogs: (max: number) =>
    set((state: LogState) => {
      // Trim logs if needed when reducing max
      const logs = state.logs.slice(0, max);
      return { maxLogs: max, logs };
    }),

  setIsEnabled: (enabled: boolean) => set({ isEnabled: enabled }),
  setIsVisible: (visible: boolean) => set({ isVisible: visible }),
}));

// Helper log functions
export const logInfo = (
  message: string,
  deviceInfo?: { deviceId?: string; deviceName?: string; platform?: string }
) => {
  useLogStore.getState().addLog({
    message,
    level: "info",
    ...deviceInfo,
  });
};

export const logError = (
  message: string,
  deviceInfo?: { deviceId?: string; deviceName?: string; platform?: string }
) => {
  useLogStore.getState().addLog({
    message,
    level: "error",
    ...deviceInfo,
  });
};

export const logWarn = (
  message: string,
  deviceInfo?: { deviceId?: string; deviceName?: string; platform?: string }
) => {
  useLogStore.getState().addLog({
    message,
    level: "warn",
    ...deviceInfo,
  });
};

export const logDebug = (
  message: string,
  deviceInfo?: { deviceId?: string; deviceName?: string; platform?: string }
) => {
  useLogStore.getState().addLog({
    message,
    level: "debug",
    ...deviceInfo,
  });
};
