import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getPdfPreviewUrl } from "@shared/documentPreview";
import { CheckCircle2, Download, FileCheck2, ShieldCheck } from "lucide-react";
import React, { useState } from "react";

export type FinalDocumentOutput = {
  docx: { storageUrl: string };
  pdf: { storageUrl: string };
  generatedDocumentId?: number;
  approvalId?: number;
};

function ApprovalSignaturePanel({ output }: { output: Required<Pick<FinalDocumentOutput, "generatedDocumentId" | "approvalId">> }) {
  const { user } = useAuth();
  const [approvalStatus, setApprovalStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [signedUrl, setSignedUrl] = useState<string>();
  const decide = trpc.approvals.decide.useMutation({ onSuccess: (approval) => setApprovalStatus(approval.status) });
  const sign = trpc.signatures.create.useMutation({ onSuccess: (result) => setSignedUrl(result.signedPdf?.storageUrl) });
  const canApprove = user?.role === "approver" || user?.role === "admin";
  const approve = () => decide.mutate({ approvalId: output.approvalId, status: "approved", decisionNote: "Aprovado após conferência da pré-visualização." });
  const reject = () => decide.mutate({ approvalId: output.approvalId, status: "rejected", decisionNote: "Devolvido para ajustes após conferência." });
  const applySignature = () => sign.mutate({ generatedDocumentId: output.generatedDocumentId });
  return <section className="mt-7 rounded-2xl border border-[#dce5d4] bg-[#f4f8ed] p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#dfeec9] text-[#567c35]"><ShieldCheck className="h-5 w-5" /></span><div className="flex-1"><p className="text-[12px] font-bold text-[#315446]">Aprovação e assinatura institucional</p><p className="mt-1 text-[10px] leading-5 text-[#62796e]">A assinatura institucional registra o aprovador, data, código de verificação e SHA-256 do PDF original. Não substitui certificado digital qualificado quando a norma aplicável o exigir.</p>{approvalStatus === "pending" && <div className="mt-4 flex flex-wrap gap-2">{canApprove ? <><Button disabled={decide.isPending} onClick={approve} className="h-9 rounded-lg bg-[#234a40] text-[10px] hover:bg-[#173d36]">Aprovar emissão</Button><Button disabled={decide.isPending} onClick={reject} variant="outline" className="h-9 rounded-lg border-[#d1ddd0] bg-white text-[10px]">Devolver para ajustes</Button></> : <span className="rounded-lg bg-white px-3 py-2 text-[10px] text-[#6b8178]">Aguardando decisão de um aprovador.</span>}</div>}{approvalStatus === "approved" && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-lg bg-[#e1efd4] px-3 py-2 text-[10px] font-bold text-[#4f7431]">Emissão aprovada</span>{canApprove && <Button disabled={sign.isPending || Boolean(signedUrl)} onClick={applySignature} className="h-9 rounded-lg bg-[#517b35] text-[10px] hover:bg-[#456b2d]"><FileCheck2 className="mr-1.5 h-3.5 w-3.5" />{sign.isPending ? "Assinando…" : "Assinar documento"}</Button>}{signedUrl && <a href={signedUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-[#bcd3b2] bg-white px-3 py-2 text-[10px] font-bold text-[#4f7431]">Abrir PDF assinado</a>}</div>}{approvalStatus === "rejected" && <p className="mt-4 text-[10px] font-bold text-[#a45343]">Documento devolvido para ajustes.</p>}</div></div></section>;
}

export default function DocumentFinalPreview({ output }: { output: FinalDocumentOutput }) {
  const [showPreview, setShowPreview] = useState(true);
  const hasApproval = output.generatedDocumentId !== undefined && output.approvalId !== undefined;
  return <div className="rounded-[22px] border border-[#dce4d7] bg-[#fbfbf6] p-6 md:p-8"><div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f1d8] text-[#527b32]"><CheckCircle2 className="h-7 w-7" /></span><h2 className="mt-5 font-editorial text-[34px] tracking-[-.035em] text-[#213e37]">Documentos gerados para revisão.</h2><p className="mx-auto mt-3 max-w-lg text-[12px] leading-6 text-[#6f827b]">Confira a versão em PDF antes do encaminhamento para aprovação e assinatura institucional.</p></div><div className="mx-auto mt-7 max-w-4xl"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="font-mono-ui text-[10px] uppercase tracking-[.13em] text-[#668074]">Pré-visualização do documento final</p><Button type="button" variant="outline" onClick={() => setShowPreview((current) => !current)} className="h-8 rounded-lg border-[#d4e0d1] bg-white text-[10px] font-bold text-[#486d35]">{showPreview ? "Ocultar prévia" : "Exibir prévia"}</Button></div>{showPreview && <iframe title="Pré-visualização do documento final em PDF" src={getPdfPreviewUrl(output.pdf.storageUrl)} className="h-[560px] w-full rounded-xl border border-[#d9e2d7] bg-white shadow-inner" />}<div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-3"><a href={output.docx.storageUrl} className="rounded-xl bg-[#234a40] px-5 py-3 text-[11px] font-bold text-white"><Download className="mr-2 inline h-4 w-4" />Baixar DOCX</a><a href={output.pdf.storageUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-[#d4e0d1] bg-white px-5 py-3 text-[11px] font-bold text-[#486d35]"><Download className="mr-2 inline h-4 w-4" />Abrir PDF</a></div>{hasApproval && <ApprovalSignaturePanel output={{ generatedDocumentId: output.generatedDocumentId!, approvalId: output.approvalId! }} />}</div></div>;
}
