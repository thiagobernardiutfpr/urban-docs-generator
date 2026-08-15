// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { analyzeFile, uploadRequest } = vi.hoisted(() => ({
  analyzeFile: vi.fn(),
  uploadRequest: vi.fn(),
}));

const resumedRequest = {
  id: 180001,
  status: "collecting",
  protocol: "TESTE/2026",
  documentType: "laudo_viabilidade",
  enrollment: "00.000.000.0000.000",
  applicant: "Interessado de teste",
  description: "Validação da etapa de anexos",
  formData: {},
  extractedData: {},
};

function mutation(mutateAsync = vi.fn()) {
  return { mutateAsync, isPending: false };
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    requests: {
      create: { useMutation: () => mutation() },
      update: { useMutation: () => mutation() },
      get: { useQuery: () => ({ data: resumedRequest, isLoading: false }) },
      applyFileExtraction: { useMutation: () => mutation() },
      markReadyForReview: { useMutation: () => mutation() },
    },
    uploads: {
      requestFile: { useMutation: () => mutation(uploadRequest) },
      analyzeRequestFile: { useMutation: () => mutation(analyzeFile) },
    },
    spatial: {
      list: { useQuery: () => ({ data: [] }) },
      upload: { useMutation: () => mutation() },
      crossReference: { useMutation: () => mutation() },
    },
    generated: { create: { useMutation: () => mutation() }, },
  },
}));

vi.mock("wouter", () => ({ useLocation: () => ["/nova-solicitacao?processo=180001", vi.fn()] }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("../client/src/components/AIContextInsight", () => ({ default: () => <div data-testid="ai-insight" /> }));
vi.mock("../client/src/components/DocumentFinalPreview", () => ({ default: () => <div data-testid="final-preview" /> }));
vi.mock("../client/src/components/DocumentTypeFields", () => ({ default: () => <div data-testid="type-fields" /> }));
vi.mock("../client/src/components/FileExtractionReview", () => ({ default: () => <div data-testid="file-review" /> }));
vi.mock("../client/src/components/LotGeometryMap", () => ({ default: () => <div data-testid="lot-map" /> }));
vi.mock("../client/src/components/UrbanAIReview", () => ({ default: () => <div data-testid="urban-ai-review" /> }));

import RequestWizardWithMap from "../client/src/components/RequestWizardWithMap";

afterEach(() => {
  cleanup();
  uploadRequest.mockReset();
  analyzeFile.mockReset();
});

describe("RequestWizardWithMap — continuidade de anexos", () => {
  it("avança da etapa 2 para a revisão sem anexos", async () => {
    render(<RequestWizardWithMap />);
    const continueButton = await screen.findByRole("button", { name: "Continuar sem anexos" });

    fireEvent.click(continueButton);

    expect(await screen.findByText("Conferir dados antes do mapa")).toBeTruthy();
    expect(uploadRequest).not.toHaveBeenCalled();
    expect(analyzeFile).not.toHaveBeenCalled();
  });

  it("envia e analisa um anexo antes de avançar da etapa 2 para a revisão", async () => {
    uploadRequest.mockResolvedValue({ id: 91 });
    analyzeFile.mockResolvedValue({ analysis: { sourceSummary: "Documento de teste", suggestions: [], warnings: [] } });
    const { container } = render(<RequestWizardWithMap />);
    await screen.findByRole("button", { name: "Continuar sem anexos" });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["conteúdo"], "memorial.pdf", { type: "application/pdf" });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(await screen.findByRole("button", { name: "Analisar anexos e continuar" }));

    await waitFor(() => expect(uploadRequest).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(analyzeFile).toHaveBeenCalledWith({ requestId: 180001, fileId: 91 }));
    expect(await screen.findByText("Conferir dados antes do mapa")).toBeTruthy();
  });
});
