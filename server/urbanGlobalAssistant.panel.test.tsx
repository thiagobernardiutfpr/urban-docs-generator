// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    ai: {
      chat: {
        useMutation: () => ({ mutateAsync, isPending: false }),
      },
    },
  },
}));

import UrbanGlobalAssistant from "../client/src/components/UrbanGlobalAssistant";

afterEach(() => {
  cleanup();
  mutateAsync.mockReset();
});

describe("UrbanGlobalAssistant — indisponibilidade", () => {
  it("mantém a orientação amigável na conversa quando a mutação falha", async () => {
    const message = "Assistente de IA temporariamente indisponível. O preenchimento manual e a emissão do documento continuam disponíveis.";
    mutateAsync.mockRejectedValue(new Error(message));

    render(<UrbanGlobalAssistant />);
    fireEvent.click(screen.getByRole("button", { name: "Assistente IA" }));
    const textarea = await screen.findByPlaceholderText("Pergunte sobre o fluxo, modelos ou conferência...");
    fireEvent.change(textarea, { target: { value: "Teste de disponibilidade" } });
    fireEvent.keyDown(textarea, { key: "Enter" });

    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText("Teste de disponibilidade")).toBeTruthy();
  });
});
