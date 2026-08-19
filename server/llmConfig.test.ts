import { afterEach, describe, expect, it, vi } from "vitest";

import { invokeLLM } from "./_core/llm";

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_BASE;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_BASE;
  vi.unstubAllGlobals();
});

describe("configuração do provedor de IA", () => {
  it("usa OPENAI_API_KEY como alternativa quando Forge não está configurado", async () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_API_BASE = "https://api.example.test/v1";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "test",
      created: 0,
      model: "gpt-5-mini",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({ messages: [{ role: "user", content: "teste" }] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer test-openai-key" }),
      }),
    );
  });

  it("usa GEMINI_API_KEY como provedor padrão quando configurado", async () => {
    process.env.GEMINI_API_KEY = "test-gemini-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "test",
      created: 0,
      model: "gemini-3.6-flash",
      choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await invokeLLM({ messages: [{ role: "user", content: "teste" }] });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer test-gemini-key" }),
        body: expect.stringContaining('"model":"gemini-3.6-flash"'),
      }),
    );
  });
});

