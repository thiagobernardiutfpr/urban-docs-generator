import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function context(role: "author" | "reviewer" | "approver" | "admin"): TrpcContext {
  return {
    user: { id: 77, openId: `role-${role}`, email: `${role}@municipio.gov.br`, name: role, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("controle de acesso de emissão", () => {
  it("impede que o elaborador aprove uma emissão", async () => {
    const caller = appRouter.createCaller(context("author"));
    await expect(caller.approvals.decide({ approvalId: 1, status: "approved" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("impede que o revisor assine uma emissão", async () => {
    const caller = appRouter.createCaller(context("reviewer"));
    await expect(caller.signatures.create({ generatedDocumentId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
