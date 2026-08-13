import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { documentSchemas } from "@shared/documentFields";
import { documentTypeLabels, type DocumentType } from "@shared/urbanDocs";
import { ArrowLeft, Download, FilePenLine, FileText, Loader2, RefreshCw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import DocumentTypeFields from "./DocumentTypeFields";

const statusLabel: Record<string, string> = {
  draft: "Rascunho", collecting: "Coletando insumos", cross_referenced: "Dados cruzados", ready_for_review: "Pronto para revisão", processing: "Em processamento", completed: "Concluído", failed: "Falha no processamento",
};

type Draft = { protocol: string; enrollment: string; applicant: string; description: string; formData: Record<string, string> };

export default function RequestDetail({ requestId }: { requestId: number }) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: request, isLoading } = trpc.requests.get.useQuery({ id: requestId }, { enabled: isAuthenticated && Number.isInteger(requestId) && requestId > 0 });
  const { data: versions = [], isLoading: versionsLoading } = trpc.generated.list.useQuery({ requestId }, { enabled: Boolean(request) });
  const update = trpc.requests.update.useMutation();
  const reissue = trpc.generated.create.useMutation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({ protocol: "", enrollment: "", applicant: "", description: "", formData: {} });

  useEffect(() => {
    if (!request) return;
    const formData = Object.fromEntries(Object.entries((request.formData ?? {}) as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]));
    setDraft({ protocol: request.protocol, enrollment: request.enrollment ?? "", applicant: request.applicant ?? "", description: request.description ?? "", formData });
  }, [request]);

  if (!isAuthenticated) return <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-[#ccd8c9] bg-[#fbfbf7] px-5 py-10 text-center text-[11px] leading-5 text-[#74877f]">Entre com sua conta para abrir processos do acervo técnico.</div>;
  if (isLoading) return <div className="mx-auto max-w-3xl py-16 text-center text-[11px] text-[#74877f]">Carregando processo…</div>;
  if (!request) return <div className="mx-auto max-w-3xl space-y-4 py-16 text-center"><p className="text-[12px] text-[#74877f]">Processo não encontrado ou sem permissão de acesso.</p><Button variant="outline" onClick={() => setLocation("/solicitacoes")}>Voltar à listagem</Button></div>;

  const documentType = request.documentType as DocumentType;
  const latest = versions[0];
  const canReissue = ["cross_referenced", "ready_for_review", "completed", "failed"].includes(request.status);
  const saveChanges = async () => {
    if (!draft.protocol.trim()) return toast.error("Informe o número do protocolo.");
    try {
      await update.mutateAsync({ id: request.id, protocol: draft.protocol.trim(), enrollment: draft.enrollment.trim(), applicant: draft.applicant.trim(), description: draft.description.trim(), formData: draft.formData });
      await Promise.all([utils.requests.get.invalidate({ id: request.id }), utils.requests.list.invalidate()]);
      setEditing(false);
      toast.success("Processo atualizado. Uma nova emissão usará estes dados.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível atualizar o processo."); }
  };
  const issueNewVersion = async () => {
    if (!canReissue) return toast.error("Conclua o cruzamento territorial antes de emitir ou reemitir este processo.");
    try {
      await reissue.mutateAsync({ requestId: request.id });
      await Promise.all([utils.generated.list.invalidate({ requestId: request.id }), utils.requests.get.invalidate({ id: request.id }), utils.requests.list.invalidate()]);
      toast.success("Nova versão emitida. Os arquivos PDF e DOCX já estão disponíveis abaixo.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível emitir uma nova versão."); }
  };
  const updateDraft = (key: keyof Omit<Draft, "formData">, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  return <div className="mx-auto max-w-[1180px] space-y-6"><div className="flex flex-col gap-4 border-b border-[#dfe4da] pb-5 sm:flex-row sm:items-end sm:justify-between"><div><button onClick={() => setLocation("/solicitacoes")} className="flex items-center gap-1 text-[10px] font-bold text-[#557437] hover:text-[#264f43]"><ArrowLeft className="h-3.5 w-3.5" />Voltar para solicitações</button><p className="mt-4 font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#627d5b]">Processo {request.protocol}</p><h1 className="mt-2 font-editorial text-[34px] tracking-[-.035em] text-[#1d3933] md:text-[42px]">{documentTypeLabels[documentType] ?? request.documentType}</h1><p className="mt-3 text-[12px] text-[#69807a]">Inscrição {request.enrollment || "não informada"} · Atualizado em {new Date(request.updatedAt).toLocaleString("pt-BR")}</p></div><Badge className="w-fit rounded-full border-0 bg-[#e5f0e3] px-3 py-1.5 text-[10px] font-semibold text-[#286149]">{statusLabel[request.status] ?? request.status}</Badge></div>

    <section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-5 md:p-6"><div className="flex flex-col gap-3 border-b border-[#e4e9e1] pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#72887c]">Dados do processo</p><h2 className="mt-1 font-editorial text-[27px] text-[#213e37]">{editing ? "Edição controlada" : "Informações registradas"}</h2></div><Button variant="outline" onClick={() => editing ? void saveChanges() : setEditing(true)} disabled={update.isPending} className="h-9 rounded-xl border-[#d5e1d2] bg-white text-[10px] text-[#426055]">{update.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : editing ? <Save className="mr-1.5 h-3.5 w-3.5" /> : <FilePenLine className="mr-1.5 h-3.5 w-3.5" />}{editing ? "Salvar alterações" : "Editar processo"}</Button></div>
      {editing ? <div className="mt-5 space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Número do protocolo</Label><Input value={draft.protocol} onChange={(event) => updateDraft("protocol", event.target.value)} /></div><div className="space-y-2"><Label>Inscrição imobiliária</Label><Input value={draft.enrollment} onChange={(event) => updateDraft("enrollment", event.target.value)} /></div></div><div className="space-y-2"><Label>Interessado ou requerente</Label><Input value={draft.applicant} onChange={(event) => updateDraft("applicant", event.target.value)} /></div><div className="space-y-2"><Label>Objeto da solicitação</Label><Textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} /></div><DocumentTypeFields type={documentType} fields={draft.formData} onChange={(key, value) => setDraft((current) => ({ ...current, formData: { ...current.formData, [key]: value } }))} /><Button variant="ghost" onClick={() => { setEditing(false); setDraft({ protocol: request.protocol, enrollment: request.enrollment ?? "", applicant: request.applicant ?? "", description: request.description ?? "", formData: Object.fromEntries(Object.entries((request.formData ?? {}) as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")])) }); }} className="text-[10px]">Cancelar edição</Button></div> : <dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-[10px] text-[#74877f]">Interessado</dt><dd className="mt-1 text-[12px] font-medium text-[#34584c]">{request.applicant || "Não informado"}</dd></div><div><dt className="text-[10px] text-[#74877f]">Objeto</dt><dd className="mt-1 text-[12px] font-medium text-[#34584c]">{request.description || "Não informado"}</dd></div></dl>}</section>

    <section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-5 md:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#72887c]">Emissões e exportação</p><h2 className="mt-1 font-editorial text-[27px] text-[#213e37]">Versões documentais</h2><p className="mt-2 text-[11px] leading-5 text-[#72847b]">Cada reemissão preserva o histórico e registra uma nova versão com os dados atuais.</p></div><Button onClick={() => void issueNewVersion()} disabled={reissue.isPending || !canReissue} className="h-10 rounded-xl bg-[#234a40] text-[10px] hover:bg-[#173d36]">{reissue.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}{latest ? "Reemitir nova versão" : "Emitir documentos"}</Button></div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[520px] text-left"><thead><tr className="border-b border-[#e3e9df] font-mono-ui text-[9px] uppercase tracking-[.13em] text-[#81938c]"><th className="pb-3 font-medium">Versão</th><th className="pb-3 font-medium">Gerada em</th><th className="pb-3 text-right font-medium">Exportar</th></tr></thead><tbody>{versionsLoading && <tr><td colSpan={3} className="py-7 text-center text-[11px] text-[#74877f]">Carregando versões…</td></tr>}{!versionsLoading && versions.length === 0 && <tr><td colSpan={3} className="py-7 text-center text-[11px] text-[#74877f]">Ainda não há documento emitido para este processo.</td></tr>}{versions.map((version) => <tr key={version.id} className="border-b border-[#edf0e9] last:border-0"><td className="py-4 text-[11px] font-bold text-[#34564b]">Versão {version.versionNumber}</td><td className="py-4 text-[10px] text-[#74877f]">{new Date(version.createdAt).toLocaleString("pt-BR")}</td><td className="py-4"><div className="flex justify-end gap-2">{version.pdfUrl && <Button asChild variant="outline" size="sm" className="h-8 rounded-lg border-[#dbe3d8] bg-white text-[9px] text-[#426055]"><a href={version.pdfUrl} download target="_blank" rel="noreferrer"><Download className="mr-1 h-3 w-3" />PDF</a></Button>}{version.docxUrl && <Button asChild variant="outline" size="sm" className="h-8 rounded-lg border-[#dbe3d8] bg-white text-[9px] text-[#426055]"><a href={version.docxUrl} download target="_blank" rel="noreferrer"><FileText className="mr-1 h-3 w-3" />DOCX</a></Button>}</div></td></tr>)}</tbody></table></div></section></div>;
}
