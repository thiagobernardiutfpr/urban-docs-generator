import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({
  reviewAiAudit: vi.fn(),
  setUserRole: vi.fn(),
  decideDocumentApproval: vi.fn(),
}));

vi.mock("./db", () => ({
  reviewAiAudit: mocks.reviewAiAudit,
  setUserRole: mocks.setUserRole,
  decideDocumentApproval: mocks.decideDocumentApproval,
}));

import { appRouter } from "./routers";

function context(role: "reviewer" | "approver" | "admin"): TrpcContext {
  return { user: { id: 9, openId: `governance-${role}`, email: `${role}@municipio.gov.br`, name: role, loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("rotas de governança", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.reviewAiAudit.mockResolvedValue({ id: 14, reviewStatus: "applied" });
    mocks.setUserRole.mockResolvedValue({ id: 7, role: "approver" });
    mocks.decideDocumentApproval.mockResolvedValue({ id: 20, status: "approved" });
  });

  it("registra a revisão positiva de uma sugestão de IA", async () => {
    const result = await appRouter.createCaller(context("reviewer")).ai.reviewAudit({ auditId: 14, reviewStatus: "applied", reviewNote: "Conferido." });
    expect(mocks.reviewAiAudit).toHaveBeenCalledWith(14, 9, "applied", "Conferido.");
    expect(result.reviewStatus).toBe("applied");
  });

  it("permite que o administrador atribua o papel de aprovador", async () => {
    const result = await appRouter.createCaller(context("admin")).governance.setRole({ userId: 7, role: "approver" });
    expect(mocks.setUserRole).toHaveBeenCalledWith(7, "approver");
    expect(result.role).toBe("approver");
  });

  it("registra a decisão positiva de aprovação", async () => {
    const result = await appRouter.createCaller(context("approver")).approvals.decide({ approvalId: 20, status: "approved", decisionNote: "Documento revisado." });
    expect(mocks.decideDocumentApproval).toHaveBeenCalledWith(20, 9, "approved", "Documento revisado.");
    expect(result.status).toBe("approved");
  });
});
