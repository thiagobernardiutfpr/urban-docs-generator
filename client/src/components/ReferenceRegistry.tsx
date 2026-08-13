import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { documentTypeLabels, documentTypes, maxUploadBytes, type DocumentType } from "@shared/urbanDocs";
import { Archive, BookOpenText, Download, FileText, Loader2, Power, UploadCloud } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";

function serializeReference(file: File): Promise<{ filename: string; mimeType: string; contentBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o PDF selecionado."));
    reader.onload = () => resolve({ filename: file.name, mimeType: file.type || "application/pdf", contentBase64: String(reader.result).split(",")[1] ?? "" });
    reader.readAsDataURL(file);
  });
}

export default function ReferenceRegistry() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [type, setType] = useState<DocumentType>("certidao_uso_ocupacao_solo");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { data: references = [], isLoading } = trpc.references.list.useQuery(undefined, { enabled: isAuthenticated });
  const upload = trpc.references.upload.useMutation({ onSuccess: () => void utils.references.list.invalidate() });
  const setActive = trpc.references.setActive.useMutation({ onSuccess: () => void utils.references.list.invalidate() });

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) return toast.error("Envie um PDF como documento de referência.");
    if (file.size > maxUploadBytes) return toast.error("O PDF deve ter até 25 MB.");
    try {
      await upload.mutateAsync({ documentType: type, title: title.trim() || file.name.replace(/\.pdf$/i, ""), description: description.trim() || undefined, payload: await serializeReference(file) });
      setTitle("");
      setDescription("");
      toast.success("Referência PDF registrada para a tipologia selecionada.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível registrar a referência."); }
  };

  return <section className="mx-auto mt-7 max-w-[1320px] rounded-[20px] border border-[#dce4d8] bg-[#fcfbf7] p-5 md:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#718980]">Acervo de consulta</p><h2 className="mt-1 font-editorial text-[28px] tracking-[-.03em] text-[#203d36]">Referências oficiais em PDF</h2><p className="mt-2 max-w-xl text-[11px] leading-5 text-[#71847d]">Arquive certidões e pareceres de referência sem transformá-los em modelos de emissão. Eles permanecem disponíveis para conferência do técnico.</p></div><Badge className="border-0 bg-[#edf2e5] text-[10px] text-[#587d36]">{references.length} referências</Badge></div><div className="mt-6 grid gap-5 lg:grid-cols-[.72fr_1.28fr]"><div className="rounded-[16px] bg-[#edf3e6] p-4"><div className="flex items-center gap-2 text-[#486c35]"><BookOpenText className="h-4 w-4" /><p className="text-[11px] font-bold">Registrar referência</p></div><div className="mt-4 space-y-3"><div className="space-y-1.5"><Label className="text-[10px] text-[#506d61]">Tipologia</Label><Select value={type} onValueChange={(value) => setType(value as DocumentType)}><SelectTrigger className="h-10 rounded-xl border-[#d8e3d5] bg-white text-[11px]"><SelectValue /></SelectTrigger><SelectContent>{documentTypes.map((item) => <SelectItem key={item} value={item}>{documentTypeLabels[item]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] text-[#506d61]">Título</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Certidão de tombamento 2026" className="h-10 rounded-xl border-[#d8e3d5] bg-white text-[11px]" /></div><div className="space-y-1.5"><Label className="text-[10px] text-[#506d61]">Observação</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Como este documento deve orientar a emissão." className="min-h-16 rounded-xl border-[#d8e3d5] bg-white text-[11px]" /></div><label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#a9c68f] bg-white px-3 py-3 text-[10px] font-bold text-[#4c7134]"><input type="file" className="sr-only" accept=".pdf" disabled={!isAuthenticated || upload.isPending} onChange={handleUpload} />{upload.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}Enviar referência PDF</label></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{isLoading && <p className="py-8 text-center text-[11px] text-[#71847d]">Carregando referências…</p>}{!isLoading && references.length === 0 && <p className="rounded-xl border border-dashed border-[#dce5d8] py-8 text-center text-[11px] text-[#71847d] sm:col-span-2 xl:col-span-3">Nenhuma referência PDF cadastrada.</p>}{references.map((reference) => <article key={reference.id} className={`rounded-[16px] border p-4 ${reference.isActive ? "border-[#dfe7d9] bg-white" : "border-[#e4e5e1] bg-[#f5f5f1] opacity-75"}`}><div className="flex items-start justify-between"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f1eade] text-[#86662d]"><FileText className="h-4 w-4" /></span><span className={`rounded-full px-2 py-1 font-mono-ui text-[8px] ${reference.isActive ? "bg-[#ecf4df] text-[#5f843d]" : "bg-[#ededeb] text-[#7d827b]"}`}>{reference.isActive ? "ATIVA" : "ARQUIVADA"}</span></div><h3 className="mt-4 text-[11px] font-bold leading-5 text-[#33554b]">{reference.title}</h3><p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-[#71847d]">{documentTypeLabels[reference.documentType as DocumentType] ?? reference.documentType}</p>{reference.description && <p className="mt-2 line-clamp-2 text-[9px] leading-4 text-[#83928b]">{reference.description}</p>}<div className="mt-4 flex flex-wrap items-center justify-between gap-1 border-t border-[#edf0eb] pt-3"><span className="font-mono-ui text-[9px] text-[#7e9289]">PDF</span><div className="flex items-center gap-1">{reference.storageUrl && <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-[9px] text-[#4d7334]"><a href={reference.storageUrl} target="_blank" rel="noreferrer"><Download className="mr-1 h-3 w-3" />Abrir</a></Button>}<Button disabled={setActive.isPending} variant="ghost" size="sm" onClick={() => void setActive.mutateAsync({ id: reference.id, isActive: !reference.isActive })} className="h-7 px-2 text-[9px] text-[#4d7334]">{reference.isActive ? <><Archive className="mr-1 h-3 w-3" />Arquivar</> : <><Power className="mr-1 h-3 w-3" />Ativar</>}</Button></div></div></article>)}</div></div></section>;
}
