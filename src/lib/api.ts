import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError, forbidden, unauthenticated } from "./errors";
import { actorFromHeaders } from "./session";
import { rateLimit } from "./rate-limit";
import { log } from "./logger";
import type { Actor } from "./authz";

type AuthMode = "public" | "user" | "admin";

export type HandlerCtx<TBody, TAuth extends AuthMode> = {
  req: NextRequest;
  params: Record<string, string>;
  actor: TAuth extends "public" ? Actor | null : Actor;
  body: TBody;
  ip: string;
};

/** The parsed body type: the schema's OUTPUT (after transforms and defaults), or undefined without a schema. */
export type BodyOf<S> = S extends ZodTypeAny ? z.output<S> : undefined;

type Options<S extends ZodTypeAny | undefined, TAuth extends AuthMode> = {
  auth: TAuth;
  body?: S;
  rateLimit?: { bucket: string; limit: number; windowSec: number; per?: "ip" | "user" };
};

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/**
 * CSRF defence for cookie-authenticated mutations: the request must carry an
 * Origin header matching this deployment. Combined with SameSite=Lax session
 * cookies and JSON-only bodies, cross-site forms cannot trigger state changes.
 */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = new Set<string>();
  try { allowed.add(new URL(process.env.APP_URL ?? "http://localhost:3000").origin); } catch { /* ignore */ }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  if (host) allowed.add(`${proto}://${host}`);
  if (!origin || !allowed.has(origin)) throw forbidden("Request origin not allowed.");
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const res = NextResponse.json({ error: { code: err.code, message: err.message, details: err.details ?? null } }, { status: err.status });
    const retry = (err.details as { retryAfter?: number } | undefined)?.retryAfter;
    if (retry) res.headers.set("Retry-After", String(retry));
    return res;
  }
  if (err instanceof ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Check the highlighted fields.", details: err.flatten() } }, { status: 422 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return NextResponse.json({ error: { code: "CONFLICT", message: "A record with these details already exists.", details: null } }, { status: 409 });
    if (err.code === "P2025") return NextResponse.json({ error: { code: "NOT_FOUND", message: "Record not found.", details: null } }, { status: 404 });
    if (err.code === "P2003") return NextResponse.json({ error: { code: "IN_USE", message: "This record is referenced elsewhere. Archive or deactivate it instead.", details: null } }, { status: 409 });
  }
  log.error("api.unhandled", { err });
  return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong on our side. Try again shortly.", details: null } }, { status: 500 });
}

export function handler<S extends ZodTypeAny | undefined = undefined, TAuth extends AuthMode = "user">(
  opts: Options<S, TAuth>,
  fn: (ctx: HandlerCtx<BodyOf<S>, TAuth>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params?: Record<string, string> } = {}) => {
    try {
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (mutating) assertSameOrigin(req);
      const ip = clientIp(req);

      const actor = await actorFromHeaders(req.headers);
      if (opts.auth !== "public" && !actor) throw unauthenticated();
      if (opts.auth === "admin" && !actor!.isAdmin) throw forbidden("Administrator access is required.");

      if (opts.rateLimit) {
        const who = opts.rateLimit.per === "user" && actor ? actor.id : ip;
        await rateLimit(opts.rateLimit.bucket, who, opts.rateLimit.limit, opts.rateLimit.windowSec);
      }

      let body = undefined as BodyOf<S>;
      if (opts.body) {
        if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
          throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as JSON.");
        }
        const raw = await req.json().catch(() => { throw new AppError(400, "INVALID_JSON", "The request body is not valid JSON."); });
        const parsed = (opts.body as ZodTypeAny).safeParse(raw);
        if (!parsed.success) throw new AppError(422, "VALIDATION_ERROR", "Check the highlighted fields.", parsed.error.flatten());
        body = parsed.data as BodyOf<S>;
      }

      const result = await fn({ req, params: context.params ?? {}, actor: actor as HandlerCtx<BodyOf<S>, TAuth>["actor"], body, ip });
      if (result instanceof Response) return result;
      return NextResponse.json({ data: result ?? null }, { status: mutating && req.method === "POST" ? 201 : 200 });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Parse URL search params with a schema; returns 422 on failure via AppError. */
export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.output<S> {
  const obj: Record<string, string | string[]> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (v === "") return; // blank form fields mean "no filter"
    const cur = obj[k];
    obj[k] = cur === undefined ? v : Array.isArray(cur) ? [...cur, v] : [cur, v];
  });
  const parsed = schema.safeParse(obj);
  if (!parsed.success) throw new AppError(422, "VALIDATION_ERROR", "Invalid query parameters.", parsed.error.flatten());
  return parsed.data as z.output<S>;
}
