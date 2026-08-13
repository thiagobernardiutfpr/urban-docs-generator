import { useAuth } from "@/_core/hooks/useAuth";
import AIContextInsight from "@/components/AIContextInsight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { documentTypeLabels, documentTypes, maxUploadBytes, type DocumentType } from "@shared/urbanDocs";
import { Archive, Download, FileText, Loader2, Power, UploadCloud } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";

function encodeModel(file: File): Promise<{ filename: string; mimeType: string; contentBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o modelo selecionado."));
    reader.onload = () => resolve({ filename: file.name, mimeType: file.type || "application/octet-stream", contentBase64: String(reader.result).split(",")[1] ?? "" });
    reader.readAsDataURL(file);
  });
}

export default function TemplateRegistry() {
  const { isAuthenticated, loading } = useAuth();
  const utils = trpc.useUtils();
  const [type, setType] = useState<DocumentType>(documentTypes[0]);
  const [version, setVersion] = useState("1.0");
  const { data: templates = [], isLoading } = trpc.templates.list.useQuery(undefined, { enabled: isAuthenticated });
  const upload = trpc.templates.upload.useMutation({ onSuccess: () => void utils.templates.list.invalidate() });
  const setActive = trpc.templates.setActive.useMutation({ onSuccess: () => void utils.templates.list.invalidate() });
  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) return toast.error("Envie um arquivo DOCX para registrar um modelo oficial.");
    if (file.size > maxUploadBytes) return toast.error("O modelo deve ter até 25 MB.");
    try {
      await upload.mutateAsync({ documentType: type, name: file.name.replace(/\.docx$/i, ""), version, payload: await encodeModel(file) });
      toast.success("Versão cadastrada e vinculada à tipologia selecionada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar o modelo."); }
  };
  return <div className="mx-auto max-w-[1320px] space-y-7"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#627d5b]">Administração documental</p><h1 className="mt-2 font-editorial text-[34px] tracking-[-.035em] text-[#1d3933] md:text-[42px]">Modelos oficiais</h1><p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#69807a]">Gerencie as versões DOCX usadas na emissão: associe uma tipologia, consulte o arquivo e controle quais modelos permanecem ativos.</p></div>{!loading && !isAuthenticated && <div className="rounded-xl border border-[#dce7ca] bg-[#f1f6e7] px-4 py-3 text-[10px] leading-5 text-[#587140]">Entre com a conta administrativa para alterar o acervo de modelos privados.</div>}<AIContextInsight scope="templates" title="Conferência assistida do acervo" context={`Há ${templates.length} modelos cadastrados. A tipologia selecionada para a próxima versão é ${documentTypeLabels[type]}. Oriente uma conferência de marcadores, versão e vigência, sem afirmar conformidade.`} /><div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]"><section className="rounded-[20px] bg-[#234a40] p-6 text-white"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#c9e26d]">Adicionar versão</p><h2 className="mt-3 font-editorial text-[30px] leading-[1.05] tracking-[-.03em]">Padrão institucional.</h2><div className="mt-6 space-y-3"><div className="space-y-1.5"><Label className="text-[10px] text-white/75">Tipologia vinculada</Label><Select value={type} onValueChange={(value) => setType(value as DocumentType)}><SelectTrigger className="h-10 rounded-xl border-white/15 bg-white/10 text-[11px] text-white"><SelectValue /></SelectTrigger><SelectContent>{documentTypes.map((item) => <SelectItem key={item} value={item}>{documentTypeLabels[item]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] text-white/75">Versão</Label><Input value={version} onChange={(event) => setVersion(event.target.value)} className="h-10 rounded-xl border-white/15 bg-white/10 text-[11px] text-white" /></div><label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#9bbb76] bg-[#f8faf4] px-5 py-7 text-center text-[#315447] transition hover:bg-[#f0f6e5]"><input type="file" className="sr-only" accept=".docx" disabled={!isAuthenticated || upload.isPending} onChange={handleUpload} />{upload.isPending ? <Loader2 className="h-5 w-5 animate-spin text-[#628b3f]" /> : <UploadCloud className="h-5 w-5 text-[#628b3f]" />}<p className="mt-3 text-[12px] font-bold">Enviar modelo DOCX</p><p className="mt-1 text-[10px] leading-5 text-[#738880]">Marcadores como {"{inscricao_imobiliaria}"} são preenchidos durante a emissão.</p></label></div></section><section className="rounded-[20px] border border-[#dce4d8] bg-[#fcfbf7] p-5"><div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#7a8e85]">Acervo controlado</p><h2 className="mt-1 font-editorial text-[28px] tracking-[-.03em] text-[#203d36]">Versões registradas</h2></div><Badge className="border-0 bg-[#e7f0db] text-[10px] text-[#517b31]">{templates.length} modelos</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{isLoading && <p className="col-span-full py-8 text-center text-[11px] text-[#7a8d85]">Carregando acervo…</p>}{!isLoading && templates.length === 0 && <p className="col-span-full py-8 text-center text-[11px] text-[#74877f]">Nenhum modelo cadastrado.</p>}{templates.map((template) => <article key={template.id} className={`rounded-[16px] border p-4 ${template.isActive ? "border-[#dfe7d9] bg-white" : "border-[#e4e5e1] bg-[#f5f5f1] opacity-75"}`}><div className="flex items-start justify-between"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e9f1dc] text-[#577e35]"><FileText className="h-4 w-4" /></span><span className={`rounded-full px-2 py-1 font-mono-ui text-[8px] ${template.isActive ? "bg-[#ecf4df] text-[#5f843d]" : "bg-[#ededeb] text-[#7d827b]"}`}>{template.isActive ? "ATIVO" : "ARQUIVADO"}</span></div><h3 className="mt-4 text-[11px] font-bold leading-5 text-[#33554b]">{documentTypeLabels[template.documentType as DocumentType] ?? template.documentType}</h3><p className="mt-1.5 truncate text-[10px] text-[#71847d]">{template.filename ?? template.name}</p><div className="mt-4 flex flex-wrap items-center justify-between gap-1 border-t border-[#edf0eb] pt-3"><span className="font-mono-ui text-[9px] text-[#7e9289]">v{template.version}</span><div className="flex items-center gap-1">{template.storageUrl && <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[9px] text-[#4d7334]"><a href={template.storageUrl} target="_blank" rel="noreferrer"><Download className="mr-1 h-3 w-3" />Abrir</a></Button>}<Button disabled={setActive.isPending} variant="ghost" size="sm" onClick={() => void setActive.mutateAsync({ id: template.id, isActive: !template.isActive })} className="h-7 px-2 text-[9px] text-[#4d7334]">{template.isActive ? <><Archive className="mr-1 h-3 w-3" />Arquivar</> : <><Power className="mr-1 h-3 w-3" />Ativar</>}</Button></div></div></article>)}</div></section></div></div>;
}
