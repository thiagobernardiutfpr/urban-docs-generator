import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { documentTypeLabels, documentTypes, maxUploadBytes, type DocumentType } from "@shared/urbanDocs";
import { Archive, CheckCircle2, FileSpreadsheet, FileText, Loader2, MapPinned, Power, UploadCloud } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";

function encodeFile(file: File): Promise<{ filename: string; mimeType: string; contentBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => resolve({ filename: file.name, mimeType: file.type || "application/octet-stream", contentBase64: String(reader.result).split(",")[1] ?? "" });
    reader.readAsDataURL(file);
  });
}

function LoginNotice() {
  const { isAuthenticated, loading } = useAuth();
  if (loading || isAuthenticated) return null;
  return <div className="mb-5 rounded-xl border border-[#dce7ca] bg-[#f1f6e7] px-4 py-3 text-[10px] leading-5 text-[#587140]">Entre com a conta administrativa para gerenciar os arquivos privados deste acervo.</div>;
}

export function TemplateAdministration() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [documentType, setDocumentType] = useState<DocumentType>(documentTypes[0]);
  const [version, setVersion] = useState("1.0");
  const { data: templates = [], isLoading } = trpc.templates.list.useQuery(undefined, { enabled: isAuthenticated });
  const upload = trpc.templates.upload.useMutation({ onSuccess: () => void utils.templates.list.invalidate() });
  const setActive = trpc.templates.setActive.useMutation({ onSuccess: () => void utils.templates.list.invalidate() });

  const addTemplate = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx")) return toast.error("Os modelos oficiais devem estar em formato DOCX.");
    if (file.size > maxUploadBytes) return toast.error("O arquivo excede o limite de 25 MB.");
    try {
      const result = await upload.mutateAsync({ documentType, name: file.name.replace(/\.docx$/i, ""), version, payload: await encodeFile(file) });
      toast.success(`Modelo oficial adicionado com ${result.profile.markerNames.length} marcador(es) no layout preservado.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível registrar o modelo."); }
  };

  return <div className="mx-auto max-w-[1320px] space-y-7"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#627d5b]">Administração documental</p><h1 className="mt-2 font-editorial text-[34px] tracking-[-.035em] text-[#1d3933] md:text-[42px]">Modelos oficiais</h1><p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#69807a]">Inclua, versione, ative ou arquive os modelos DOCX que orientam a emissão dos atos urbanísticos.</p></div><LoginNotice /><div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]"><section className="rounded-[20px] bg-[#234a40] p-6 text-white"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#c9e26d]">Novo modelo</p><h2 className="mt-3 font-editorial text-[30px] leading-[1.05] tracking-[-.03em]">Atualize o padrão institucional.</h2><div className="mt-6 space-y-3"><div className="space-y-1.5"><Label className="text-[10px] text-white/75">Tipologia</Label><Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}><SelectTrigger className="h-10 rounded-xl border-white/15 bg-white/10 text-[11px] text-white"><SelectValue /></SelectTrigger><SelectContent>{documentTypes.map((item) => <SelectItem key={item} value={item}>{documentTypeLabels[item]}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label className="text-[10px] text-white/75">Identificação da versão</Label><Input value={version} onChange={(event) => setVersion(event.target.value)} className="h-10 rounded-xl border-white/15 bg-white/10 text-[11px] text-white" /></div><label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#9bbb76] bg-[#f8faf4] px-5 py-7 text-center text-[#315447] transition hover:bg-[#f0f6e5]"><input type="file" className="sr-only" accept=".docx" disabled={!isAuthenticated || upload.isPending} onChange={addTemplate} />{upload.isPending ? <Loader2 className="h-5 w-5 animate-spin text-[#628b3f]" /> : <UploadCloud className="h-5 w-5 text-[#628b3f]" />}<p className="mt-3 text-[12px] font-bold">Enviar modelo DOCX</p><p className="mt-1 text-[10px] leading-5 text-[#738880]">Use {"{protocolo}"}, {"{endereco}"} e {"{zoneamento}"} no corpo, cabeçalho ou rodapé. O DOCX e o PDF preservam o layout institucional.</p></label></div></section><section className="rounded-[20px] border border-[#dce4d8] bg-[#fcfbf7] p-5"><div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[#7a8e85]">Acervo controlado</p><h2 className="mt-1 font-editorial text-[28px] tracking-[-.03em] text-[#203d36]">Versões cadastradas</h2></div><Badge className="border-0 bg-[#e7f0db] text-[10px] text-[#517b31]">{templates.length} modelos</Badge></div><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{isLoading && <p className="py-8 text-center text-[11px] text-[#7a8d85]">Carregando modelos…</p>}{!isLoading && templates.length === 0 && <p className="py-8 text-center text-[11px] text-[#74877f]">Nenhum modelo cadastrado.</p>}{templates.map((template) => <article key={template.id} className={`rounded-[16px] border p-4 ${template.isActive ? "border-[#dfe7d9] bg-white" : "border-[#e4e5e1] bg-[#f5f5f1] opacity-75"}`}><div className="flex items-start justify-between"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e9f1dc] text-[#577e35]"><FileText className="h-4 w-4" /></span><span className={`rounded-full px-2 py-1 font-mono-ui text-[8px] ${template.isActive ? "bg-[#ecf4df] text-[#5f843d]" : "bg-[#ededeb] text-[#7d827b]"}`}>{template.isActive ? "ATIVO" : "ARQUIVADO"}</span></div><h3 className="mt-4 text-[11px] font-bold leading-5 text-[#33554b]">{documentTypeLabels[template.documentType as DocumentType] ?? template.documentType}</h3><p className="mt-1.5 truncate text-[10px] text-[#71847d]">{template.name}</p><div className="mt-4 flex items-center justify-between border-t border-[#edf0eb] pt-3"><span className="font-mono-ui text-[9px] text-[#7e9289]">v{template.version}</span><Button disabled={setActive.isPending} variant="ghost" size="sm" onClick={() => void setActive.mutateAsync({ id: template.id, isActive: !template.isActive })} className="h-7 px-2 text-[9px] text-[#4d7334]">{template.isActive ? <><Archive className="mr-1 h-3 w-3" />Arquivar</> : <><Power className="mr-1 h-3 w-3" />Ativar</>}</Button></div></article>)}</div></section></div></div>;
}

export function SpatialSourceAdministration() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const { data: sources = [], isLoading } = trpc.spatial.list.useQuery(undefined, { enabled: isAuthenticated });
  const upload = trpc.spatial.upload.useMutation({ onSuccess: () => void utils.spatial.list.invalidate() });
  const setActive = trpc.spatial.setActive.useMutation({ onSuccess: () => void utils.spatial.list.invalidate() });
  const addSource = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xlsx", "xls", "csv", "gpkg"].includes(extension)) return toast.error("Envie XLS, XLSX, CSV ou GPKG.");
    if (file.size > maxUploadBytes) return toast.error("O arquivo excede o limite de 25 MB.");
    try { await upload.mutateAsync({ name: file.name.replace(/\.[^.]+$/, ""), payload: await encodeFile(file) }); toast.success("Fonte territorial adicionada ao catálogo."); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível adicionar a fonte."); }
  };
  return <div className="mx-auto max-w-[1180px] space-y-7"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#627d5b]">Administração territorial</p><h1 className="mt-2 font-editorial text-[34px] tracking-[-.035em] text-[#1d3933] md:text-[42px]">Planilhas e GeoPackages</h1><p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#69807a]">Controle as fontes consultadas no cruzamento da inscrição imobiliária e na conferência cartográfica.</p></div><LoginNotice /><div className="grid gap-5 lg:grid-cols-[.95fr_1.05fr]"><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">Nova fonte</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Importar dados</h2></div><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eaf2dd] text-[#5b803a]"><MapPinned className="h-4 w-4" /></span></div><label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b6c8b9] bg-[#f8faf4] px-5 py-9 text-center transition hover:border-[#769b52]"><input type="file" className="sr-only" accept=".xlsx,.xls,.csv,.gpkg" disabled={!isAuthenticated || upload.isPending} onChange={addSource} />{upload.isPending ? <Loader2 className="h-5 w-5 animate-spin text-[#5d853b]" /> : <UploadCloud className="h-5 w-5 text-[#5d853b]" />}<p className="mt-3 text-[12px] font-bold text-[#365d50]">Enviar planilha ou GeoPackage</p><p className="mt-1 text-[10px] leading-5 text-[#758982]">XLS, XLSX, CSV e GPKG · até 25 MB.</p></label><p className="mt-5 rounded-xl bg-[#eef4e5] px-4 py-3 text-[10px] leading-5 text-[#5e7541]">Apenas fontes ativas serão consideradas no cruzamento e no mapa da solicitação.</p></section><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><div className="flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">Catálogo de dados</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Fontes registradas</h2></div><Badge className="border-0 bg-[#e8f1dc] text-[10px] text-[#587c39]">{sources.filter((source) => source.isActive).length} ativas</Badge></div><div className="mt-5 space-y-3">{isLoading && <p className="py-8 text-center text-[11px] text-[#7a8d85]">Carregando fontes…</p>}{!isLoading && sources.length === 0 && <p className="rounded-xl border border-dashed border-[#ccd8c9] p-5 text-center text-[11px] leading-5 text-[#74877f]">Nenhuma fonte territorial cadastrada.</p>}{sources.map((source) => <article key={source.id} className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${source.isActive ? "border-[#e1e9de] bg-white" : "border-[#e8e8e3] bg-[#f5f5f1] opacity-75"}`}><span className={`grid h-8 w-8 place-items-center rounded-lg ${source.kind === "spreadsheet" ? "bg-[#ebf0df] text-[#5b803a]" : "bg-[#e7eef1] text-[#4b6e7e]"}`}>{source.kind === "spreadsheet" ? <FileSpreadsheet className="h-4 w-4" /> : <MapPinned className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#36584d]">{source.name}</p><p className="mt-0.5 text-[9px] text-[#81938b]">{source.id === 0 ? "GeoPackage local automático" : source.kind === "spreadsheet" ? "Planilha cadastral" : "GeoPackage"}</p></div>{source.id === 0 ? <span className="rounded-full bg-[#eef4e5] px-2 py-1 font-mono-ui text-[8px] text-[#5d7e3a]">LOCAL</span> : <Button disabled={setActive.isPending} variant="ghost" size="sm" onClick={() => void setActive.mutateAsync({ id: source.id, isActive: !source.isActive })} className="h-8 px-2 text-[9px] text-[#4d7334]">{source.isActive ? <><Archive className="mr-1 h-3 w-3" />Arquivar</> : <><CheckCircle2 className="mr-1 h-3 w-3" />Ativar</>}</Button>}</article>)}</div></section></div></div>;
}
