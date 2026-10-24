/**
 * Shared API helpers: typed JSON responses, error mapping, validated bodies.
 * Internal errors are never leaked to clients (SR §8).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { ServiceError } from "@/services/requestService";
import { logger } from "@/services/logger";

export function json<T>(data: T, init?: number | ResponseInit): NextResponse {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data as object, responseInit);
}

export function errorResponse(code: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { message, ...extra } }, { status: code });
}

const STATUS_BY_KIND: Record<ServiceError["kind"], number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  VALIDATION: 400,
};

export function serviceErrorResponse(error: ServiceError) {
  return errorResponse(STATUS_BY_KIND[error.kind], error.message);
}

/** Parse + validate a JSON body; returns the data or a 400 response. */
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: errorResponse(400, "Invalid JSON body.") };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: errorResponse(400, "Invalid request.", {
        issues: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      }),
    };
  }
  return { ok: true, data: result.data };
}

/** Wrap a handler to catch unexpected errors without leaking internals. */
export async function guard(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    logger.error("unhandled API error", { error: e instanceof Error ? e.message : String(e) });
    return errorResponse(500, "Something went wrong. Please try again.");
  }
}
