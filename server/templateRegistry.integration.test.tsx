// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const { uploadMutate, toast } = vi.hoisted(() => ({
  uploadMutate: vi.fn(),
  toast: { error: vi.fn(), message: vi.fn(), success: vi.fn() },
}));

vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
vi.mock("@/components/AIContextInsight", () => ({ default: () => <div data-testid="ai-insight" /> }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ templates: { list: { invalidate: vi.fn() } } }),
    templates: {
      list: { useQuery: () => ({ data: [], isLoading: false }) },
      upload: { useMutation: () => ({ mutateAsync: uploadMutate, isPending: false }) },
      setActive: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) },
    },
  },
}));
vi.mock("sonner", () => ({ toast }));

import TemplateRegistry from "../client/src/components/TemplateRegistry";

describe("TemplateRegistry — falha de envio DOCX", () => {
  beforeEach(() => {
    uploadMutate.mockReset();
    toast.error.mockReset();
    toast.message.mockReset();
    toast.success.mockReset();
  });

  it("seleciona um DOCX, habilita a confirmação e exibe erro se templates.upload falhar", async () => {
    uploadMutate.mockRejectedValue(new Error("Armazenamento indisponível"));
    const { container } = render(<TemplateRegistry />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["modelo de teste"], "modelo_teste.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByText("modelo_teste.docx")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enviar modelo" }));
    await waitFor(() => expect(uploadMutate).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Armazenamento indisponível"));
  });
});
