import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { allowedUploadExtensions, documentTypeLabels, documentTypes, maxUploadBytes, type DocumentType } from "@shared/urbanDocs";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Database, Download, FileText, Loader2, MapPinned, Send, UploadCloud, WandSparkles } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type LocalUpload = { file: File; purpose: "input" | "spatial" };
type Output = { docx: { storageUrl: string; filename: string }; pdf: { storageUrl: string; filename: string } };

const dynamicFields: Record<DocumentType, Array<{ key: string; label: string; placeholder: string }>> = {
  certidao_uso_ocupacao_solo: [
    { key: "endereco", label: "Endereço do imóvel", placeholder: "Logradouro, número e bairro" },
    { key: "finalidade", label: "Finalidade declarada", placeholder: "Ex.: uso residencial unifamiliar" },
  ],
  laudo_viabilidade: [
    { key: "empreendimento", label: "Empreendimento proposto", placeholder: "Nome ou descrição do empreendimento" },
    { key: "atividade", label: "Atividade pretendida", placeholder: "Atividade econômica ou urbanística" },
  ],
  diretriz_loteamento: [
    { key: "empreendimento", label: "Nome do loteamento", placeholder: "Denominação proposta" },
    { key: "area_total", label: "Área total da gleba", placeholder: "Ex.: 25.480,00 m²" },
  ],
  parecer_eiv: [
    { key: "empreendimento", label: "Empreendimento analisado", placeholder: "Nome do projeto ou atividade" },
    { key: "responsavel_tecnico", label: "Responsável técnico", placeholder: "Nome, conselho e registro" },
  ],
  avaliacao_previa_impacto_vizinhanca: [
    { key: "empreendimento", label: "Empreendimento analisado", placeholder: "Nome do projeto ou atividade" },
    { key: "porte", label: "Porte do empreendimento", placeholder: "Área, unidades ou capacidade" },
  ],
  informacao: [
    { key: "destinatario", label: "Destinatário", placeholder: "Órgão, setor ou interessado" },
    { key: "assunto", label: "Assunto", placeholder: "Tema da informação técnica" },
  ],
  oficio: [
    { key: "destinatario", label: "Destinatário", placeholder: "Órgão, setor ou interessado" },
    { key: "assunto", label: "Assunto", placeholder: "Síntese do objeto do ofício" },
  ],
  parecer_tecnico: [
    { key: "assunto", label: "Assunto", placeholder: "Objeto do parecer técnico" },
    { key: "analise_tecnica", label: "Análise técnica", placeholder: "Fundamentação técnica do parecer" },
  ],
  autorizacao_uso_espaco_publico: [
    { key: "finalidade_uso", label: "Finalidade do uso", placeholder: "Atividade ou finalidade solicitada" },
    { key: "endereco", label: "Local do espaço público", placeholder: "Praça, via, número e referência" },
  ],
  autorizacao_engenho_publicitario: [
    { key: "tipo_engenho", label: "Tipo de engenho", placeholder: "Ex.: painel, letreiro, totem" },
    { key: "dimensoes", label: "Dimensões", placeholder: "Ex.: 3,00 m x 1,50 m" },
  ],
  certidao_tombamento: [
    { key: "referencia_patrimonial", label: "Referência patrimonial", placeholder: "Livro, processo ou cadastro de tombamento" },
    { key: "endereco", label: "Endereço de referência", placeholder: "Logradouro, número e bairro" },
  ],
  certidao_desapropriacao: [
    { key: "ato_referencia", label: "Ato de referência", placeholder: "Decreto, processo ou lei" },
    { key: "endereco", label: "Endereço do imóvel", placeholder: "Logradouro, número e bairro" },
  ],
  certidao_perimetro_urbano: [
    { key: "municipio", label: "Município", placeholder: "Nome do município" },
    { key: "ato_referencia", label: "Ato de referência", placeholder: "Lei, plano ou processo" },
  ],
  parecer_urbanistico: [
    { key: "empreendimento", label: "Objeto da análise", placeholder: "Projeto, atividade ou intervenção" },
    { key: "responsavel_tecnico", label: "Responsável técnico", placeholder: "Nome, conselho e registro" },
  ],
};

function fileAsPayload(file: File): Promise<{ filename: string; mimeType: string; contentBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = () => {
      const raw = String(reader.result);
      resolve({ filename: file.name, mimeType: file.type || "application/octet-stream", contentBase64: raw.split(",")[1] ?? "" });
    };
    reader.readAsDataURL(file);
  });
}

function extension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function validateFiles(files: File[]) {
  for (const file of files) {
    if (!(allowedUploadExtensions as readonly string[]).includes(extension(file.name))) return `O formato “${file.name}” não é aceito.`;
    if (file.size > maxUploadBytes) return `O arquivo “${file.name}” excede o limite de 25 MB.`;
  }
  return undefined;
}

function labelize(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ImageAttachmentPreview({ file }: { file: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return <figure className="overflow-hidden rounded-xl border border-[#dbe5d5] bg-white"><div className="h-24 bg-[#edf2e7]">{url && <img src={url} alt={`Prévia de ${file.name}`} className="h-full w-full object-cover" />}</div><figcaption className="truncate px-2.5 py-2 font-mono-ui text-[9px] text-[#637a70]">{file.name}</figcaption></figure>;
}

export default function RequestWizard() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [documentType, setDocumentType] = useState<DocumentType>(documentTypes[0]);
  const [protocol, setProtocol] = useState("");
  const [enrollment, setEnrollment] = useState("");
  const [applicant, setApplicant] = useState("");
  const [description, setDescription] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<LocalUpload[]>([]);
  const [requestId, setRequestId] = useState<number>();
  const [extractedData, setExtractedData] = useState<Record<string, unknown>>({});
  const [output, setOutput] = useState<Output>();

  const createRequest = trpc.requests.create.useMutation();
  const uploadRequestFile = trpc.uploads.requestFile.useMutation();
  const uploadSpatialFile = trpc.spatial.upload.useMutation();
  const crossReference = trpc.spatial.crossReference.useMutation();
  const generate = trpc.generated.create.useMutation();
  const typeFields = dynamicFields[documentType];
  const activeUploads = useMemo(() => ({ inputs: files.filter((item) => item.purpose === "input"), spatial: files.filter((item) => item.purpose === "spatial") }), [files]);
  const busy = createRequest.isPending || uploadRequestFile.isPending || uploadSpatialFile.isPending || crossReference.isPending || generate.isPending;
  const completion = [25, 50, 75, 100][step - 1] ?? 25;

  const addFiles = (event: ChangeEvent<HTMLInputElement>, purpose: LocalUpload["purpose"]) => {
    const incoming = Array.from(event.target.files ?? []);
    const error = validateFiles(incoming);
    if (error) {
      toast.error(error);
      event.target.value = "";
      return;
    }
    setFiles((current) => [...current, ...incoming.map((file) => ({ file, purpose }))]);
    event.target.value = "";
    toast.success(`${incoming.length} arquivo(s) adicionado(s) à instrução.`);
  };

  const saveInitialData = async () => {
    if (!protocol.trim() || !enrollment.trim() || !applicant.trim()) {
      toast.error("Preencha protocolo, inscrição imobiliária e interessado antes de continuar.");
      return;
    }
    try {
      const created = await createRequest.mutateAsync({ protocol: protocol.trim(), documentType, enrollment: enrollment.trim(), applicant: applicant.trim(), description: description.trim() || undefined, formData });
      if (!created) throw new Error("A solicitação não retornou um identificador.");
      setRequestId(created.id);
      setStep(2);
      toast.success("Solicitação registrada. Agora envie os insumos técnicos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível registrar a solicitação.");
    }
  };

  const uploadAndCrossReference = async () => {
    if (!requestId) return;
    try {
      for (const item of activeUploads.inputs) {
        await uploadRequestFile.mutateAsync({ requestId, payload: await fileAsPayload(item.file) });
      }
      for (const item of activeUploads.spatial) {
        await uploadSpatialFile.mutateAsync({ name: item.file.name.replace(/\.[^.]+$/, ""), payload: await fileAsPayload(item.file) });
      }
      const result = await crossReference.mutateAsync({ requestId });
      setExtractedData((result?.extractedData as Record<string, unknown>) ?? {});
      setStep(3);
      toast.success("Insumos registrados e cruzamento cadastral concluído.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível processar os arquivos enviados.");
    }
  };

  const createDocuments = async () => {
    if (!requestId) return;
    try {
      const result = await generate.mutateAsync({ requestId });
      setOutput({ docx: { storageUrl: result.docx.storageUrl, filename: result.docx.filename }, pdf: { storageUrl: result.pdf.storageUrl, filename: result.pdf.filename } });
      setStep(4);
      toast.success("As versões DOCX e PDF foram geradas com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível emitir os documentos.");
    }
  };

  const advance = () => {
    if (step === 1) void saveInitialData();
    else if (step === 2) void uploadAndCrossReference();
    else if (step === 3) void createDocuments();
  };

  return (
    <div className="mx-auto max-w-[1180px] space-y-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono-ui text-[10px] font-medium uppercase tracking-[0.17em] text-[#627d5b]">Nova instrução</p>
          <h1 className="mt-2 font-editorial text-[34px] leading-[1.05] tracking-[-0.035em] text-[#1d3933] md:text-[42px]">Nova solicitação</h1>
          <p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#69807a]">Registre a demanda, receba os insumos e deixe que o sistema consolide os dados do lote para a emissão técnica.</p>
        </div>
        <Button variant="outline" onClick={() => setLocation("/")} className="rounded-xl border-[#d8e0d6] bg-[#fcfbf7] text-xs text-[#426055]">Salvar e sair</Button>
      </div>

      <div className="rounded-2xl border border-[#dce7ca] bg-[#f1f6e7] p-4 text-[11px] leading-5 text-[#456136]">Este fluxo funciona sem login ou senha. A solicitação e seus arquivos ficam associados à sessão anônima deste navegador.</div>

      <div className="rounded-[18px] border border-[#dce4d8] bg-[#fbfbf6] px-5 py-4">
        <div className="mb-3 flex justify-between font-mono-ui text-[9px] uppercase tracking-[.14em] text-[#769087]"><span>Etapa {step} de 4</span><span>{completion}% concluído</span></div>
        <Progress value={completion} className="h-1.5 bg-[#e3e9dd] [&>div]:bg-[#7ea64f]" />
        <div className="mt-4 grid grid-cols-4">{["Tipo e cadastro", "Insumos", "Conferência", "Emissão"].map((label, index) => <div key={label} className={`text-[10px] font-semibold ${index + 1 <= step ? "text-[#42682d]" : "text-[#8fa097]"}`}><span className={`mb-2 grid h-5 w-5 place-items-center rounded-full border text-[9px] ${index + 1 < step ? "border-[#7da74d] bg-[#7da74d] text-white" : index + 1 === step ? "border-[#7da74d] bg-[#e9f3db] text-[#4d742e]" : "border-[#ccd8cb] bg-white"}`}>{index + 1 < step ? <Check className="h-3 w-3" /> : index + 1}</span>{label}</div>)}</div>
      </div>

      {step === 1 && <div className="grid gap-5 lg:grid-cols-[1fr_.72fr]">
        <section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6">
          <h2 className="font-editorial text-[27px] tracking-[-.03em] text-[#213e37]">Identificação do ato</h2>
          <p className="mt-2 text-[12px] leading-5 text-[#71847e]">A tipologia selecionada define os campos complementares e o modelo DOCX a ser empregado.</p>
          <div className="mt-7 space-y-5">
            <div className="space-y-2"><Label className="text-[11px] font-bold text-[#406055]">Tipo de documento</Label><Select value={documentType} onValueChange={(value) => setDocumentType(value as DocumentType)}><SelectTrigger className="h-11 rounded-xl border-[#d6dfd4] bg-white text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{documentTypes.map((item) => <SelectItem key={item} value={item}>{documentTypeLabels[item]}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label className="text-[11px] font-bold text-[#406055]">Número do protocolo</Label><Input value={protocol} onChange={(event) => setProtocol(event.target.value)} placeholder="Ex.: 2026/000148" className="h-11 rounded-xl border-[#d6dfd4] bg-white text-[12px]" /></div><div className="space-y-2"><Label className="text-[11px] font-bold text-[#406055]">Inscrição imobiliária</Label><Input value={enrollment} onChange={(event) => setEnrollment(event.target.value)} placeholder="00.00.000.0000.000" className="h-11 rounded-xl border-[#d6dfd4] bg-white font-mono-ui text-[12px]" /></div></div>
            <div className="space-y-2"><Label className="text-[11px] font-bold text-[#406055]">Interessado ou requerente</Label><Input value={applicant} onChange={(event) => setApplicant(event.target.value)} placeholder="Nome completo ou razão social" className="h-11 rounded-xl border-[#d6dfd4] bg-white text-[12px]" /></div>
            <div className="grid gap-5 sm:grid-cols-2">{typeFields.map((field) => <div key={field.key} className="space-y-2"><Label className="text-[11px] font-bold text-[#406055]">{field.label}</Label><Input value={formData[field.key] ?? ""} onChange={(event) => setFormData((current) => ({ ...current, [field.key]: event.target.value }))} placeholder={field.placeholder} className="h-11 rounded-xl border-[#d6dfd4] bg-white text-[12px]" /></div>)}</div>
            <div className="space-y-2"><Label className="text-[11px] font-bold text-[#406055]">Objeto da solicitação</Label><Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descreva brevemente a demanda que será analisada." className="min-h-24 rounded-xl border-[#d6dfd4] bg-white text-[12px] leading-5" /></div>
          </div>
        </section>
        <aside className="rounded-[20px] bg-[#234a40] p-6 text-white"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c9e26d] text-[#21423a]"><FileText className="h-5 w-5" /></span><p className="mt-7 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#c9e26d]">tipologia selecionada</p><h3 className="mt-3 font-editorial text-[29px] leading-[1.05] tracking-[-.03em]">{documentTypeLabels[documentType]}</h3><div className="mt-8 space-y-3 border-t border-white/15 pt-5 text-[11px] text-[#cfddd5]"><p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 text-[#c9e26d]" />Formulário adaptativo</p><p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 text-[#c9e26d]" />Cruzamento de fontes territoriais</p><p className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 text-[#c9e26d]" />Modelo DOCX versionado</p></div></aside>
      </div>}

      {step === 2 && <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">01. Documentação de apoio</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Insumos técnicos</h2><p className="mt-2 text-[12px] leading-5 text-[#71847e]">PDF, DOCX, DOC, DWG, JPG e PNG serão armazenados com rastreabilidade por processo.</p><label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b6c8b9] bg-[#f8faf4] px-5 py-7 text-center transition hover:border-[#769b52]"><input type="file" className="sr-only" accept=".pdf,.docx,.doc,.dwg,.jpg,.jpeg,.png" multiple onChange={(event) => addFiles(event, "input")} /><UploadCloud className="h-5 w-5 text-[#5d853b]" /><p className="mt-3 text-[12px] font-bold text-[#365d50]">Adicionar documentos e imagens</p><p className="mt-1 text-[10px] text-[#758982]">Limite de 25 MB por arquivo.</p></label>{activeUploads.inputs.length > 0 && <div className="mt-4 space-y-2">{activeUploads.inputs.map(({ file }) => <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 rounded-lg bg-[#f1f5ec] px-3 py-2 text-[10px] text-[#4d6a5f]"><FileText className="h-3.5 w-3.5 text-[#668c43]" />{file.name}<span className="ml-auto font-mono-ui text-[9px]">{Math.ceil(file.size / 1024)} KB</span></div>)}</div>}{activeUploads.inputs.some(({ file }) => file.type.startsWith("image/")) && <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{activeUploads.inputs.filter(({ file }) => file.type.startsWith("image/")).map(({ file }) => <ImageAttachmentPreview key={`${file.name}-${file.lastModified}`} file={file} />)}</div>}</section>
        <section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">02. Referências territoriais</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Bases de consulta</h2><p className="mt-2 text-[12px] leading-5 text-[#71847e]">Envie planilhas cadastrais e GeoPackages. A inscrição será procurada em colunas reconhecidas automaticamente.</p><label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b6c8b9] bg-[#f8faf4] px-5 py-7 text-center transition hover:border-[#769b52]"><input type="file" className="sr-only" accept=".xlsx,.xls,.csv,.gpkg" multiple onChange={(event) => addFiles(event, "spatial")} /><Database className="h-5 w-5 text-[#5d853b]" /><p className="mt-3 text-[12px] font-bold text-[#365d50]">Adicionar planilha ou GeoPackage</p><p className="mt-1 text-[10px] text-[#758982]">XLS, XLSX, CSV e GPKG.</p></label>{activeUploads.spatial.length > 0 && <div className="mt-4 space-y-2">{activeUploads.spatial.map(({ file }) => <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 rounded-lg bg-[#f1f5ec] px-3 py-2 text-[10px] text-[#4d6a5f]"><MapPinned className="h-3.5 w-3.5 text-[#668c43]" />{file.name}<span className="ml-auto font-mono-ui text-[9px]">{Math.ceil(file.size / 1024)} KB</span></div>)}</div>}</section>
      </div>}

      {step === 3 && <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">Conferência cadastral</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Dados identificados</h2><dl className="mt-6 divide-y divide-[#e6ebe1] text-[12px]">{Object.entries(extractedData).filter(([key]) => key !== "geometry").slice(0, 8).map(([key, value]) => <div key={key} className="flex items-center justify-between gap-5 py-3"><dt className="text-[#758780]">{labelize(key)}</dt><dd className="max-w-[55%] truncate text-right font-medium text-[#35574b]">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}{Object.keys(extractedData).length === 0 && <div className="py-6 text-[11px] leading-5 text-[#73847e]">Nenhuma correspondência foi encontrada nas bases atualmente enviadas. Você ainda pode gerar o documento com os dados cadastrais informados.</div>}</dl></section>
        <section className="relative overflow-hidden rounded-[20px] border border-[#d5e0ca] bg-[#e3eed8] p-6 urban-grid"><div className="absolute inset-0 opacity-80" style={{ backgroundImage: "radial-gradient(circle at 66% 56%, rgba(201,226,109,.9) 0 13%, transparent 13.3%), linear-gradient(125deg, transparent 43%, rgba(255,255,255,.9) 43.3% 48%, transparent 48.2%)" }} /><div className="relative"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#597644]">Visualização territorial</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Lote e entorno</h2></div><span className="rounded-full bg-[#f8fbf2] px-3 py-1 font-mono-ui text-[9px] text-[#50763a]">CRUZAMENTO ATIVO</span></div><div className="mt-28 rounded-xl border border-white/80 bg-[#fbfcf8]/95 p-4 shadow-sm"><p className="font-mono-ui text-[9px] uppercase tracking-[.13em] text-[#6f8e6a]">inscrição consultada</p><p className="mt-1 font-mono-ui text-[12px] font-medium text-[#294c41]">{enrollment}</p><p className="mt-3 text-[10px] text-[#6b816e]">As imagens de lote enviadas serão incorporadas ao dossiê de emissão quando aplicáveis.</p></div></div></section>
      </div>}

      {step === 4 && <div className="rounded-[22px] border border-[#dce4d7] bg-[#fbfbf6] p-7 text-center shadow-[0_16px_40px_rgba(52,76,63,.06)]"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f1d8] text-[#527b32]"><CheckCircle2 className="h-7 w-7" /></span><h2 className="mt-5 font-editorial text-[34px] tracking-[-.035em] text-[#213e37]">Documentos gerados para revisão.</h2><p className="mx-auto mt-3 max-w-lg text-[12px] leading-6 text-[#6f827b]">A emissão foi registrada como uma nova versão, preservando o conjunto de dados utilizado no processamento.</p>{output && <div className="mx-auto mt-7 grid max-w-md gap-3 sm:grid-cols-2"><a href={output.docx.storageUrl} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#234a40] text-[11px] font-bold text-white transition hover:bg-[#173d36]"><Download className="h-4 w-4" />Baixar DOCX</a><a href={output.pdf.storageUrl} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#d4e0d1] bg-white text-[11px] font-bold text-[#486d35] transition hover:bg-[#f2f7e9]"><Download className="h-4 w-4" />Baixar PDF</a></div>}<Button variant="ghost" onClick={() => setLocation("/historico")} className="mt-5 text-[11px] text-[#54726a]">Ver histórico de versões</Button></div>}

      <div className="flex items-center justify-between"><Button variant="ghost" disabled={step === 1 || busy} onClick={() => setStep((current) => current - 1)} className="rounded-xl text-xs text-[#54726a]"><ArrowLeft className="mr-1.5 h-4 w-4" />Voltar</Button>{step < 4 && <Button disabled={busy} onClick={advance} className="h-11 rounded-xl bg-[#234a40] px-5 text-xs hover:bg-[#173d36]">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : step === 3 ? <WandSparkles className="mr-2 h-4 w-4" /> : null}{step === 1 ? "Registrar e continuar" : step === 2 ? "Processar bases" : "Gerar DOCX e PDF"}<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
    </div>
  );
}
