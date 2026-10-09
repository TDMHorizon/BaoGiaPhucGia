export type ClientLogLevel = "INFO" | "WARN" | "ERROR" | "ACTION";

export interface ClientLogEntry {
  timestamp: string;
  level: ClientLogLevel;
  module: string;
  action: string;
  payload?: any;
  durationMs?: number;
}

const memoryLogs: ClientLogEntry[] = [];
const MAX_LOGS = 1000;

export const clientLogger = {
  log: (level: ClientLogLevel, module: string, action: string, payload?: any, durationMs?: number) => {
    const entry: ClientLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      action,
      payload,
      durationMs,
    };

    memoryLogs.push(entry);
    if (memoryLogs.length > MAX_LOGS) memoryLogs.shift();

    if (process.env.NODE_ENV !== "production") {
      const prefix = `[CLIENT:${module}] ${action}`;
      if (level === "ERROR") {
        console.error(prefix, payload || "");
      } else if (level === "WARN") {
        console.warn(prefix, payload || "");
      } else {
        console.log(prefix, payload || "");
      }
    }

    return entry;
  },

  info: (module: string, action: string, payload?: any) => {
    return clientLogger.log("INFO", module, action, payload);
  },

  warn: (module: string, action: string, payload?: any) => {
    return clientLogger.log("WARN", module, action, payload);
  },

  error: (module: string, action: string, payload?: any) => {
    return clientLogger.log("ERROR", module, action, payload);
  },

  action: (module: string, action: string, payload?: any, durationMs?: number) => {
    return clientLogger.log("ACTION", module, action, payload, durationMs);
  },

  getRecentLogs: () => [...memoryLogs],
};
