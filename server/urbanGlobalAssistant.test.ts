import { describe, expect, it } from "vitest";
import { appendAssistantUnavailableMessage, assistantUnavailableMessage } from "../client/src/components/UrbanGlobalAssistant";

describe("orientação de indisponibilidade do Assistente IA", () => {
  it("preserva a mensagem orientativa da rota no painel", () => {
    const message = "Assistente de IA temporariamente indisponível. O preenchimento manual e a emissão do documento continuam disponíveis.";
    expect(assistantUnavailableMessage({ message })).toBe(message);
  });

  it("usa orientação segura quando a falha não contém mensagem", () => {
    expect(assistantUnavailableMessage()).toContain("preenchimento manual");
  });

  it("acrescenta a orientação à conversa após a falha da chamada", () => {
    const messages = appendAssistantUnavailableMessage([
      { role: "system", content: "Sistema" },
      { role: "user", content: "Teste técnico" },
    ], { message: "Assistente de IA temporariamente indisponível." });
    expect(messages.at(-1)).toEqual({ role: "assistant", content: "Assistente de IA temporariamente indisponível." });
  });
});
