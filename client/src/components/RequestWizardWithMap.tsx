import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { documentTypeLabels, documentTypes, maxUploadBytes, type DocumentType } from "@shared/urbanDocs";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Database, Download, FileText, Loader2, MapPinned, UploadCloud, WandSparkles } from "lucide-react";
import { ChangeEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import LotGeometryMap from "./LotGeometryMap";
import DocumentTypeFields from "./DocumentTypeFields";
import { documentSchemas } from "@shared/documentFields";
import { getDemonstrationRequest } from "@shared/documentDemoData";
import { getPdfPreviewUrl } from "@shared/documentPreview";
import UrbanAIReview from "./UrbanAIReview";
import DocumentFinalPreview, { type FinalDocumentOutput } from "./DocumentFinalPreview";
import AIContextInsight from "./AIContextInsight";

type LocalUpload = { file: File; kind: "input" | "spatial" };
type Output = FinalDocumentOutput;

function serializeFile(file: File): Promise<{ filename: string; mimeType: string; contentBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => resolve({ filename: file.name, mimeType: file.type || "application/octet-stream", contentBase64: String(reader.result).split(",")[1] ?? "" });
    reader.readAsDataURL(file);
  });
}

function isAllowed(file: File, spatial: boolean) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return spatial ? ["xlsx", "xls", "csv", "gpkg"].includes(extension) : ["pdf", "docx", "doc", "dwg", "jpg", "jpeg", "png"].includes(extension);
}

function DynamicField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="space-y-2"><Label className="text-[11px] font-bold text-[#406055]">{label}</Label><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 rounded-xl border-[#d6dfd4] bg-white text-[12px]" /></div>;
}

export default function RequestWizardWithMap() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<DocumentType>(() => {
    const requestedType = new URLSearchParams(window.location.search).get("tipo");
    return requestedType && documentTypes.includes(requestedType as DocumentType) ? requestedType as DocumentType : documentTypes[0];
  });
  const [protocol, setProtocol] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [applicant, setApplicant] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [requestId, setRequestId] = useState<number>();
  const [uploads, setUploads] = useState<LocalUpload[]>([]);
  const [extracted, setExtracted] = useState<Record<string, unknown>>({});
  const [output, setOutput] = useState<Output>();
  const create = trpc.requests.create.useMutation();
  const uploadRequest = trpc.uploads.requestFile.useMutation();
  const uploadSpatial = trpc.spatial.upload.useMutation();
  const crossReference = trpc.spatial.crossReference.useMutation();
  const generate = trpc.generated.create.useMutation();
  const { data: spatialSources = [] } = trpc.spatial.list.useQuery();
  const busy = create.isPending || uploadRequest.isPending || uploadSpatial.isPending || crossReference.isPending || generate.isPending;
  const activeUploads = useMemo(() => ({ input: uploads.filter((item) => item.kind === "input"), spatial: uploads.filter((item) => item.kind === "spatial") }), [uploads]);
  const activeGeoPackages = useMemo(() => spatialSources.filter((source) => source.kind === "geopackage" && source.isActive), [spatialSources]);
  const geometry = extracted.geometry as { type: string; coordinates: unknown } | undefined;

  const fillForTest = () => {
    const demonstration = getDemonstrationRequest(type);
    setProtocol(demonstration.protocol);
    setEnrollment(demonstration.enrollment);
    setApplicant(demonstration.applicant);
    setDescription(demonstration.description);
    setFields(demonstration.fields);
    toast.info("Dados de demonstração preenchidos. Revise e substitua os valores antes de emitir.");
  };

  const addFiles = (event: ChangeEvent<HTMLInputElement>, kind: LocalUpload["kind"]) => {
    const incoming = Array.from(event.target.files ?? []);
    const invalid = incoming.find((file) => !isAllowed(file, kind === "spatial") || file.size > maxUploadBytes);
    event.target.value = "";
    if (invalid) return toast.error(`Verifique o formato e o limite de 25 MB de “${invalid.name}”.`);
    setUploads((current) => [...current, ...incoming.map((file) => ({ file, kind }))]);
  };

  const createRequest = async () => {
    if (!protocol || !enrollment || !applicant) return toast.error("Informe protocolo, inscrição imobiliária e interessado.");
    const missing = documentSchemas[type].fields.filter((field) => field.required && !fields[field.key]?.trim()).map((field) => field.label);
    if (missing.length) return toast.error(`Preencha os campos obrigatórios: ${missing.join(", ")}.`);
    try {
      const request = await create.mutateAsync({ protocol, documentType: type, enrollment, applicant, description, formData: fields });
      if (!request) throw new Error("Solicitação não criada.");
      setRequestId(request.id);
      setStep(2);
      toast.success("Solicitação criada. Inclua os insumos e a fonte territorial.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível criar a solicitação."); }
  };

  const processSources = async () => {
    if (!requestId) return;
    try {
      for (const { file } of activeUploads.input) await uploadRequest.mutateAsync({ requestId, payload: await serializeFile(file) });
      for (const { file } of activeUploads.spatial) await uploadSpatial.mutateAsync({ name: file.name.replace(/\.[^.]+$/, ""), payload: await serializeFile(file) });
      const result = await crossReference.mutateAsync({ requestId });
      setExtracted((result?.extractedData as Record<string, unknown>) ?? {});
      setStep(3);
      if (result.sourceFailures.length > 0) toast.warning(`O processo avançou, mas ${result.sourceFailures.length} fonte(s) não puderam ser consultadas. Confira as bases territoriais.`);
      else if (result.matchedSources.length === 0) toast.info("O processo avançou sem correspondência territorial. Confira a inscrição e as bases ativas.");
      else toast.success("Cruzamento concluído. Confira a geometria no mapa antes da emissão.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível processar os insumos."); }
  };

  const produce = async () => {
    if (!requestId) return;
    try {
      const result = await generate.mutateAsync({ requestId });
      setOutput({ docx: { storageUrl: result.docx.storageUrl }, pdf: { storageUrl: result.pdf.storageUrl }, generatedDocumentId: result.generated.id, approvalId: result.approval.id });
      setStep(4);
      toast.success("DOCX e PDF gerados com a versão atual dos dados.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar os documentos."); }
  };

  const next = () => { if (step === 1) void createRequest(); else if (step === 2) void processSources(); else if (step === 3) void produce(); };
  const percent = [25, 50, 75, 100][step - 1];

  return <div className="mx-auto max-w-[1180px] space-y-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#627d5b]">Nova instrução</p><h1 className="mt-2 font-editorial text-[34px] tracking-[-.035em] text-[#1d3933] md:text-[42px]">Nova solicitação</h1><p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#69807a]">Consolide dados, fontes territoriais e insumos antes de produzir a versão documental.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={step !== 1 || busy} onClick={fillForTest} className="rounded-xl border-[#cbdabb] bg-[#f5f8ed] text-xs font-bold text-[#557739] hover:bg-[#edf4df]"><WandSparkles className="mr-2 h-4 w-4" />Preencher para teste</Button><Button variant="outline" onClick={() => setLocation("/")} className="rounded-xl border-[#d8e0d6] bg-[#fcfbf7] text-xs text-[#426055]">Salvar e sair</Button></div></div><div className="rounded-[18px] border border-[#dce4d8] bg-[#fbfbf6] px-5 py-4"><div className="mb-3 flex justify-between font-mono-ui text-[9px] uppercase tracking-[.14em] text-[#769087]"><span>Etapa {step} de 4</span><span>{percent}% concluído</span></div><Progress value={percent} className="h-1.5 bg-[#e3e9dd] [&>div]:bg-[#7ea64f]" /><div className="mt-4 grid grid-cols-4">{["Cadastro", "Insumos", "Mapa", "Emissão"].map((label, index) => <div key={label} className={`text-[10px] font-semibold ${index + 1 <= step ? "text-[#42682d]" : "text-[#8fa097]"}`}><span className={`mb-2 grid h-5 w-5 place-items-center rounded-full border text-[9px] ${index + 1 < step ? "border-[#7da74d] bg-[#7da74d] text-white" : index + 1 === step ? "border-[#7da74d] bg-[#e9f3db] text-[#4d742e]" : "border-[#ccd8cb] bg-white"}`}>{index + 1 < step ? <Check className="h-3 w-3" /> : index + 1}</span>{label}</div>)}</div></div>
    {step === 1 && <div className="grid gap-5 lg:grid-cols-[1fr_.72fr]"><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><h2 className="font-editorial text-[27px] tracking-[-.03em] text-[#213e37]">Identificação do ato</h2><div className="mt-6 space-y-5"><div className="space-y-2"><Label className="text-[11px] font-bold text-[#406055]">Tipo de documento</Label><Select value={type} onValueChange={(value) => { setType(value as DocumentType); setFields({}); }}><SelectTrigger className="h-11 rounded-xl border-[#d6dfd4] bg-white text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{documentTypes.map((item) => <SelectItem key={item} value={item}>{documentTypeLabels[item]}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-5 sm:grid-cols-2"><DynamicField label="Número do protocolo" value={protocol} onChange={setProtocol} placeholder="Ex.: 2026/000148" /><DynamicField label="Inscrição imobiliária" value={enrollment} onChange={setEnrollment} placeholder="00.00.000.0000.000" /></div><DynamicField label="Interessado ou requerente" value={applicant} onChange={setApplicant} placeholder="Nome completo ou razão social" /><div className="grid gap-5 sm:grid-cols-2"><DynamicField label="Empreendimento ou objeto" value={fields.empreendimento ?? ""} onChange={(value) => setFields((current) => ({ ...current, empreendimento: value }))} placeholder="Nome do empreendimento" /><DynamicField label="Responsável técnico" value={fields.responsavel_tecnico ?? ""} onChange={(value) => setFields((current) => ({ ...current, responsavel_tecnico: value }))} placeholder="Nome, conselho e registro" /></div><div className="space-y-2"><Label className="text-[11px] font-bold text-[#406055]">Objeto da solicitação</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva brevemente a demanda que será analisada." className="min-h-24 rounded-xl border-[#d6dfd4] bg-white text-[12px]" /></div></div><DocumentTypeFields type={type} fields={fields} onChange={(key, value) => setFields((current) => ({ ...current, [key]: value }))} /><UrbanAIReview documentType={type} protocol={protocol} enrollment={enrollment} applicant={applicant} description={description} fields={fields} extractedData={extracted} onApplyDraft={setDescription} /></section><aside className="rounded-[20px] bg-[#234a40] p-6 text-white"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c9e26d] text-[#21423a]"><FileText className="h-5 w-5" /></span><p className="mt-7 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#c9e26d]">tipologia selecionada</p><h3 className="mt-3 font-editorial text-[29px] leading-[1.05] tracking-[-.03em]">{documentTypeLabels[type]}</h3><p className="mt-4 text-[11px] leading-5 text-[#cfddd5]">{documentSchemas[type].summary}</p><div className="mt-8 space-y-3 border-t border-white/15 pt-5 text-[11px] text-[#cfddd5]"><p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 text-[#c9e26d]" />{documentSchemas[type].fields.length} campos específicos</p><p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 text-[#c9e26d]" />Cruzamento cadastral</p><p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 text-[#c9e26d]" />Conferência cartográfica</p></div><div className="mt-7 rounded-xl border border-white/10 bg-black/10 p-3"><p className="font-mono-ui text-[8px] uppercase tracking-[.13em] text-[#c9e26d]">Revisão necessária</p><ul className="mt-2 space-y-2 text-[10px] leading-4 text-[#d3e0da]">{documentSchemas[type].reviewItems.map((item) => <li key={item} className="flex gap-2"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#c9e26d]" />{item}</li>)}</ul></div></aside></div>}
    {step === 2 && <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">01. Documentação de apoio</p><h2 className="mt-2 font-editorial text-[28px] text-[#213e37]">Insumos técnicos</h2><label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b6c8b9] bg-[#f8faf4] px-5 py-8 text-center"><input type="file" className="sr-only" accept=".pdf,.docx,.doc,.dwg,.jpg,.jpeg,.png" multiple onChange={(event) => addFiles(event, "input")} /><UploadCloud className="h-5 w-5 text-[#5d853b]" /><p className="mt-3 text-[12px] font-bold text-[#365d50]">Adicionar documentos e imagens</p><p className="mt-1 text-[10px] text-[#758982]">PDF, DOCX, DOC, DWG, JPG ou PNG.</p></label><div className="mt-4 space-y-2">{activeUploads.input.map(({ file }) => <div key={`${file.name}-${file.lastModified}`} className="rounded-lg bg-[#f1f5ec] px-3 py-2 text-[10px] text-[#4d6a5f]">{file.name}</div>)}</div></section><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">02. Referências territoriais</p><h2 className="mt-2 font-editorial text-[28px] text-[#213e37]">Bases de consulta</h2><div className="mt-5 rounded-xl border border-[#d8e5d1] bg-[#f3f8ec] px-4 py-3 text-[10px] leading-5 text-[#567247]"><p className="font-bold">Base padrão: GeoPackage do aplicativo EIV</p><p className="mt-1">{activeGeoPackages.length ? `${activeGeoPackages.length} GeoPackage(s) ativo(s) serão consultados automaticamente.` : "Nenhum GeoPackage ativo foi localizado no acervo. Você pode continuar com as planilhas ativas ou adicionar o arquivo EIV abaixo."}</p></div><label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b6c8b9] bg-[#f8faf4] px-5 py-8 text-center"><input type="file" className="sr-only" accept=".xlsx,.xls,.csv,.gpkg" multiple onChange={(event) => addFiles(event, "spatial")} /><Database className="h-5 w-5 text-[#5d853b]" /><p className="mt-3 text-[12px] font-bold text-[#365d50]">Adicionar planilha ou GeoPackage</p><p className="mt-1 text-[10px] text-[#758982]">O lote será localizado pela inscrição cadastrada. O avanço não depende de anexar uma nova base.</p></label><div className="mt-4 space-y-2">{activeUploads.spatial.map(({ file }) => <div key={`${file.name}-${file.lastModified}`} className="rounded-lg bg-[#f1f5ec] px-3 py-2 text-[10px] text-[#4d6a5f]">{file.name}</div>)}</div></section></div>}
    {step === 3 && <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]"><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">Conferência de dados</p><h2 className="mt-2 font-editorial text-[28px] text-[#213e37]">Lote identificado</h2><dl className="mt-5 divide-y divide-[#e6ebe1]">{Object.entries(extracted).filter(([key]) => key !== "geometry").slice(0, 9).map(([key, value]) => <div key={key} className="flex items-center justify-between gap-5 py-3 text-[11px]"><dt className="capitalize text-[#758780]">{key.replaceAll("_", " ")}</dt><dd className="max-w-[55%] truncate text-right font-medium text-[#35574b]">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}{Object.keys(extracted).length === 0 && <p className="py-8 text-[11px] leading-5 text-[#72847b]">Nenhuma correspondência foi encontrada nas fontes importadas. Você pode retornar e ajustar as bases.</p>}</dl></section><section><LotGeometryMap geometry={geometry} enrollment={enrollment} /></section></div>}
    {step === 4 && output && <div className="space-y-5"><AIContextInsight scope="final_review" title="Conferência assistida da emissão" context={`Há um PDF gerado para revisão da tipologia ${documentTypeLabels[type]}. Oriente uma conferência de dados, anexos, redação e pendências antes da decisão de aprovação. Não autorize a emissão.`} /><DocumentFinalPreview output={output} /></div>}
    <div className="flex items-center justify-between"><Button variant="ghost" disabled={step === 1 || busy} onClick={() => setStep((current) => current - 1)} className="text-xs text-[#54726a]"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Button>{step < 4 && <Button disabled={busy} onClick={next} className="h-11 rounded-xl bg-[#234a40] px-5 text-xs hover:bg-[#173d36]">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : step === 3 ? <WandSparkles className="mr-2 h-4 w-4" /> : null}{step === 1 ? "Registrar e continuar" : step === 2 ? "Processar bases" : "Gerar DOCX e PDF"}<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
  </div>;
}
