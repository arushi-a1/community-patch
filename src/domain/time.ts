/** Time helpers. Centralized so tests can reason about timestamps. */

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoPlusMinutes(minutes: number, from: Date = new Date()): string {
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

export function isoPlusHours(hours: number, from: Date = new Date()): string {
  return new Date(from.getTime() + hours * 3_600_000).toISOString();
}
