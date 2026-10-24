/**
 * Minimal structured logger. In AWS mode these lines land in CloudWatch.
 * Never logs secrets; callers must avoid passing sensitive values.
 */
type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  };
  const serialized = JSON.stringify(line);
  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) =>
    process.env.NODE_ENV !== "production" && emit("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
};
