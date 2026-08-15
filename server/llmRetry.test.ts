import { describe, expect, it } from "vitest";
import { isRetryableLlmStatus } from "./_core/llm";

describe("política de repetição do proxy de IA", () => {
  it("não repete precondição 412 e preserva repetição para falhas transitórias", () => {
    expect(isRetryableLlmStatus(412)).toBe(false);
    expect(isRetryableLlmStatus(429)).toBe(true);
    expect(isRetryableLlmStatus(503)).toBe(true);
  });
});
