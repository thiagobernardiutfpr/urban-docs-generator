import { randomUUID } from "node:crypto";
import { parse as parseCookieHeader } from "cookie";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const ANONYMOUS_COOKIE = "urban-anonymous-id";
const ANONYMOUS_COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 180;

function fallbackAnonymousUser(): User {
  const now = new Date();
  return {
    id: 0,
    openId: "anonymous:fallback",
    name: "Acesso público",
    email: null,
    loginMethod: "anonymous",
    role: "author",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // OAuth remains optional: an invalid or absent login must not block public use.
  }

  if (!user) {
    const cookies = parseCookieHeader(opts.req.headers.cookie ?? "");
    const anonymousId = cookies[ANONYMOUS_COOKIE] ?? `anonymous:${randomUUID()}`;

    try {
      user = (await db.getOrCreateAnonymousUser(anonymousId)) ?? fallbackAnonymousUser();
    } catch (error) {
      console.warn("[Database] Anonymous user could not be persisted:", error instanceof Error ? error.message : error);
      user = fallbackAnonymousUser();
    }

    if (!cookies[ANONYMOUS_COOKIE]) {
      const cookieOptions = getSessionCookieOptions(opts.req);
      opts.res.cookie(ANONYMOUS_COOKIE, anonymousId, {
        ...cookieOptions,
        sameSite: cookieOptions.secure ? "none" : "lax",
        maxAge: ANONYMOUS_COOKIE_MAX_AGE,
      });
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
