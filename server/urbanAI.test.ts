import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invokeLLM: vi.fn(),
  createAiAudit: vi.fn(),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invokeLLM }));
vi.mock("./db", () => ({ createAiAudit: mocks.createAiAudit }));

const invokeLLM = mocks.invokeLLM;

import { analyzeUrbanInstruction } from "./urbanAI";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("assistente de IA urbanístico", () => {
  beforeEach(() => {
    mocks.createAiAudit.mockResolvedValue({ id: 101 });
  });

  it("solicita análise estruturada e devolve dados para revisão humana", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ summary: "Instrução parcialmente preenchida.", missingFields: ["Zoneamento"], riskFlags: ["Conferir fonte territorial."], suggestedDraft: "Conforme dados informados, a análise depende de validação.", reviewNotice: "Revisão técnica obrigatória." }) } }] });
    const result = await analyzeUrbanInstruction({ documentType: "certidao_tombamento", protocol: "2026/001", fields: { endereco: "Rua A", resultado_tombamento: "Em análise" } });
    expect(result.missingFields).toContain("Zoneamento");
    expect(result.reviewNotice).toBe("Revisão técnica obrigatória.");
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini", response_format: expect.objectContaining({ type: "json_schema" }) }));
  });

  it("responde pelo assistente global usando contexto institucional limitado", async () => {
    invokeLLM.mockResolvedValue({ choices: [{ message: { content: "Você pode conferir os campos obrigatórios e os anexos antes de emitir." } }] });
    const ctx: TrpcContext = { user: { id: 1, openId: "admin", email: "admin@exemplo.gov.br", name: "Admin", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
    const result = await appRouter.createCaller(ctx).ai.chat({ messages: [{ role: "user", content: "Como reviso uma emissão?" }] });
    expect(result.answer).toContain("campos obrigatórios");
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini" }));
  });

  it("mantém o fluxo documental disponível quando o serviço de IA retorna indisponibilidade", async () => {
    invokeLLM.mockRejectedValue(new Error("LLM invoke failed: 412 Precondition Failed"));
    const ctx: TrpcContext = { user: { id: 1, openId: "admin", email: "admin@exemplo.gov.br", name: "Admin", loginMethod: "manus", role: "admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };

    await expect(appRouter.createCaller(ctx).ai.chat({ messages: [{ role: "user", content: "Ajude-me" }] })).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Assistente de IA temporariamente indisponível. O preenchimento manual e a emissão do documento continuam disponíveis.",
    });
  });
});
