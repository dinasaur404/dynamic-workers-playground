import { DurableObject, RpcTarget, WorkerEntrypoint, exports } from "cloudflare:workers";

export interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
}

function normalizeLogMessage(message: unknown): string {
  if (Array.isArray(message)) {
    return message.map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry))).join(" ");
  }

  return typeof message === "string" ? message : JSON.stringify(message);
}

class LogWaiter extends RpcTarget {
  private logs: LogEntry[] = [];
  private resolve: ((logs: LogEntry[]) => void) | undefined;

  addLogs(logs: LogEntry[]) {
    this.logs.push(...logs);
    if (this.resolve) {
      this.resolve(this.logs);
      this.resolve = undefined;
    }
  }

  async getLogs(timeoutMs: number): Promise<LogEntry[]> {
    if (this.logs.length > 0) {
      return this.logs;
    }

    return new Promise<LogEntry[]>((resolve) => {
      const timeout = setTimeout(() => resolve(this.logs), timeoutMs);
      this.resolve = (logs) => {
        clearTimeout(timeout);
        resolve(logs);
      };
    });
  }
}

export class LogSession extends DurableObject {
  private waiter: LogWaiter | null = null;

  async addLogs(logs: LogEntry[]) {
    if (this.waiter) {
      this.waiter.addLogs(logs);
    }
  }

  async waitForLogs(): Promise<LogWaiter> {
    this.waiter = new LogWaiter();
    return this.waiter;
  }
}

interface DynamicWorkerTailProps {
  workerId: string;
}

export class DynamicWorkerTail extends WorkerEntrypoint<never, DynamicWorkerTailProps> {
  override async tail(events: TraceItem[]) {
    const logSessionStub = exports.LogSession.getByName(this.ctx.props.workerId);

    for (const event of events) {
      const logs: LogEntry[] = event.logs.map((log: TraceLog) => ({
        level: log.level,
        message: normalizeLogMessage(log.message),
        timestamp: log.timestamp
      }));

      if (logs.length > 0) {
        for (const log of logs) {
          console.log({
            source: "dynamic-worker-tail",
            workerId: this.ctx.props.workerId,
            level: log.level,
            message: log.message,
            timestamp: log.timestamp
          });
        }

        await logSessionStub.addLogs(logs);
      }
    }
  }
}
