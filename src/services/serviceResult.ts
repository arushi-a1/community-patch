/**
 * Shared service result types. Extracted so multiple services can share them
 * without creating import cycles.
 */
export type ServiceError =
  | { kind: "NOT_FOUND"; message: string }
  | { kind: "FORBIDDEN"; message: string }
  | { kind: "CONFLICT"; message: string }
  | { kind: "VALIDATION"; message: string };

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ServiceError };

export const ok = <T>(value: T): ServiceResult<T> => ({ ok: true, value });
export const err = <T>(error: ServiceError): ServiceResult<T> => ({ ok: false, error });
