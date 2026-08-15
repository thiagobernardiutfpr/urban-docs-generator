import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getOrCreateAnonymousUser: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./db", () => ({ getOrCreateAnonymousUser: mocks.getOrCreateAnonymousUser }));

import { createContext } from "./_core/context";

const anonymousUser: User = {
  id: 42,
  openId: "anonymous:browser-session",
  name: "Acesso público",
  email: null,
  loginMethod: "anonymous",
  role: "author",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function request(cookie?: string) {
  return {
    protocol: "http",
    headers: cookie ? { cookie } : {},
  } as never;
}

function response() {
  return { cookie: vi.fn() } as never;
}

describe("acesso público", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticateRequest.mockResolvedValue(null);
    mocks.getOrCreateAnonymousUser.mockResolvedValue(anonymousUser);
  });

  it("cria uma sessão anônima sem iniciar OAuth", async () => {
    const res = response();
    const context = await createContext({ req: request(), res } as never);

    expect(context.user).toEqual(anonymousUser);
    expect(mocks.getOrCreateAnonymousUser).toHaveBeenCalledWith(expect.stringMatching(/^anonymous:/));
    expect(res.cookie).toHaveBeenCalledWith(
      "urban-anonymous-id",
      expect.stringMatching(/^anonymous:/),
      expect.objectContaining({ httpOnly: true, sameSite: "lax" }),
    );
  });

  it("reutiliza a identidade anônima enviada pelo navegador", async () => {
    const res = response();
    const context = await createContext({ req: request("urban-anonymous-id=anonymous%3Abrowser-session"), res } as never);

    expect(context.user).toEqual(anonymousUser);
    expect(mocks.getOrCreateAnonymousUser).toHaveBeenCalledWith("anonymous:browser-session");
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it("preserva o usuário autenticado quando existe uma sessão OAuth", async () => {
    const authenticatedUser = { ...anonymousUser, id: 7, openId: "oauth-user", loginMethod: "manus", role: "admin" as const };
    mocks.authenticateRequest.mockResolvedValue(authenticatedUser);
    const res = response();
    const context = await createContext({ req: request(), res } as never);

    expect(context.user).toEqual(authenticatedUser);
    expect(mocks.getOrCreateAnonymousUser).not.toHaveBeenCalled();
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
