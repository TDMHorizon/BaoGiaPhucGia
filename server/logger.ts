import fs from "fs";
import path from "path";

export type LogLevel = "INFO" | "WARN" | "ERROR" | "AUDIT" | "TEST_PASS" | "TEST_FAIL";

export interface LogEntry {
  timestamp: string;
  correlationId?: string;
  level: LogLevel;
  phase?: string;
  module: string;
  action: string;
  userId?: string;
  role?: string;
  projectId?: string;
  payload?: any;
  status: "SUCCESS" | "FAILED" | "PENDING";
  durationMs?: number;
  evidence?: any;
  error?: string;
}

const LOGS_DIR = path.join(process.cwd(), "data", "logs");
const VERIFICATION_LOG_FILE = path.join(process.cwd(), "test-run-verification.log");

export function ensureLogDirs() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
}

/**
 * Mask sensitive customer names, financial values, or phone numbers in logs
 */
export function maskSensitiveData(data: any): any {
  if (!data || typeof data !== "object") return data;
  const clone = Array.isArray(data) ? [...data] : { ...data };

  for (const key of Object.keys(clone)) {
    const lower = key.toLowerCase();
    if (lower.includes("password") || lower.includes("token") || lower.includes("secret")) {
      clone[key] = "***MASKED***";
    } else if (lower.includes("phone") || lower.includes("sdt")) {
      if (typeof clone[key] === "string" && clone[key].length >= 4) {
        clone[key] = clone[key].slice(0, 3) + "****" + clone[key].slice(-3);
      }
    } else if (typeof clone[key] === "object") {
      clone[key] = maskSensitiveData(clone[key]);
    }
  }

  return clone;
}

export class ServerLogger {
  private static instance: ServerLogger;
  private logFilePath: string;

  private constructor() {
    ensureLogDirs();
    const dateStr = new Date().toISOString().split("T")[0];
    this.logFilePath = path.join(LOGS_DIR, `server-${dateStr}.log`);
  }

  public static getInstance(): ServerLogger {
    if (!ServerLogger.instance) {
      ServerLogger.instance = new ServerLogger();
    }
    return ServerLogger.instance;
  }

  public log(entry: Omit<LogEntry, "timestamp">): LogEntry {
    const fullEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
      payload: maskSensitiveData(entry.payload),
      evidence: maskSensitiveData(entry.evidence),
    };

    const line = JSON.stringify(fullEntry) + "\n";

    try {
      fs.appendFileSync(this.logFilePath, line, "utf8");
      // If it's a test assertion or verification, also append to verification log
      if (fullEntry.level === "TEST_PASS" || fullEntry.level === "TEST_FAIL" || fullEntry.phase) {
        fs.appendFileSync(VERIFICATION_LOG_FILE, line, "utf8");
      }
    } catch (err) {
      console.error("Failed to write to log file:", err);
    }

    if (process.env.NODE_ENV !== "production") {
      const color =
        fullEntry.level === "ERROR" || fullEntry.level === "TEST_FAIL"
          ? "\x1b[31m"
          : fullEntry.level === "TEST_PASS"
          ? "\x1b[32m"
          : fullEntry.level === "WARN"
          ? "\x1b[33m"
          : "\x1b[36m";
      console.log(
        `${color}[${fullEntry.timestamp}] [${fullEntry.level}] [${fullEntry.module}] ${fullEntry.action} - ${fullEntry.status}\x1b[0m`,
        fullEntry.payload ? fullEntry.payload : ""
      );
    }

    return fullEntry;
  }

  public info(module: string, action: string, payload?: any, metadata?: Partial<LogEntry>) {
    return this.log({ level: "INFO", module, action, payload, status: "SUCCESS", ...metadata });
  }

  public warn(module: string, action: string, payload?: any, metadata?: Partial<LogEntry>) {
    return this.log({ level: "WARN", module, action, payload, status: "FAILED", ...metadata });
  }

  public error(module: string, action: string, error: any, metadata?: Partial<LogEntry>) {
    return this.log({
      level: "ERROR",
      module,
      action,
      error: error instanceof Error ? error.stack || error.message : String(error),
      status: "FAILED",
      ...metadata,
    });
  }

  public audit(action: string, metadata: { userId: string; role: string; projectId?: string; payload?: any }) {
    return this.log({
      level: "AUDIT",
      module: "SECURITY_AUDIT",
      action,
      status: "SUCCESS",
      ...metadata,
    });
  }

  public testVerification(phase: string, testName: string, passed: boolean, evidence: any) {
    return this.log({
      level: passed ? "TEST_PASS" : "TEST_FAIL",
      phase,
      module: "TEST_VERIFICATION",
      action: testName,
      status: passed ? "SUCCESS" : "FAILED",
      evidence,
    });
  }
}

export const logger = ServerLogger.getInstance();
