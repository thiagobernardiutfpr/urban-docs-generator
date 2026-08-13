import DashboardLayout from "@/components/DashboardLayout";
import RequestWizard from "@/components/RequestWizardWithMap";
import { DocumentHistory, SpatialLibrary, TemplateLibrary } from "@/components/DocumentLibraries";
import { SpatialSourceAdministration, TemplateAdministration } from "@/components/AdministrativeLibraries";
import TemplateRegistry from "@/components/TemplateRegistry";
import ReferenceRegistry from "@/components/ReferenceRegistry";
import { OperationalDashboard, RequestsWorkspace } from "@/components/LiveRequests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Bell, Check, ChevronRight, CircleCheck, Clock3, CopyPlus, Database, Download, FileCheck2, FileSpreadsheet, FileText, FolderUp, LandPlot, Layers2, MapPinned, MoreHorizontal, Plus, Search, Send, Sparkles, UploadCloud, WandSparkles } from "lucide-react";

const documentTypes = [
  "Certidão de uso e ocupação do solo",
  "Laudo de viabilidade",
  "Diretriz de loteamento",
  "Parecer de EIV",
  "Avaliação prévia de impacto de vizinhança",
  "Informação",
  "Ofício",
  "Autorização de engenho publicitário",
  "Certidão de tombamento",
  "Certidão de desapropriação",
  "Certidão de perímetro urbano",
  "Parecer urbanístico",
];

type RequestStatus = "Em análise" | "Pronto para revisão" | "Concluído" | "Pendente";

const requests: Array<{ protocol: string; title: string; inscription: string; date: string; status: RequestStatus; progress: number }> = [
  { protocol: "UD-2026.0148", title: "Certidão de uso e ocupação", inscription: "01.02.175.0140.001", date: "Hoje, 09:42", status: "Pronto para revisão", progress: 88 },
  { protocol: "UD-2026.0147", title: "Parecer urbanístico", inscription: "02.01.098.0312.000", date: "Hoje, 08:15", status: "Em análise", progress: 62 },
  { protocol: "UD-2026.0146", title: "Diretriz de loteamento", inscription: "03.04.023.0087.000", date: "Ontem, 16:30", status: "Pendente", progress: 34 },
  { protocol: "UD-2026.0145", title: "Certidão de perímetro urbano", inscription: "01.06.120.0025.000", date: "Ontem, 14:02", status: "Concluído", progress: 100 },
];

const statusStyles: Record<RequestStatus, string> = {
  "Em análise": "bg-[#e3edf1] text-[#28576a]",
  "Pronto para revisão": "bg-[#e6f1d1] text-[#466619]",
  "Concluído": "bg-[#e4f0e9] text-[#286149]",
  "Pendente": "bg-[#f5ead2] text-[#8b5c0c]",
};

function SectionHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="font-mono-ui text-[10px] font-medium uppercase tracking-[0.17em] text-[#627d5b]">{eyebrow}</p>}
        <h1 className="mt-2 font-editorial text-[34px] leading-[1.05] tracking-[-0.035em] text-[#1d3933] md:text-[42px]">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#69807a]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function StatusBadge({ status }: { status: RequestStatus }) {
  return <Badge className={cn("rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold shadow-none", statusStyles[status])}>{status}</Badge>;
}

function LotPlan() {
  return (
    <div className="relative min-h-[268px] overflow-hidden rounded-[18px] border border-[#d9dfd4] bg-[#dce7d1] urban-grid">
      <svg viewBox="0 0 640 320" className="absolute inset-0 h-full w-full" aria-label="Prévia esquemática de análise territorial">
        <path d="M-30 278 C114 236 132 241 267 271 S487 291 690 200" fill="none" stroke="#fbfaf3" strokeWidth="30" />
        <path d="M-30 278 C114 236 132 241 267 271 S487 291 690 200" fill="none" stroke="#9aa8a0" strokeWidth="2" strokeDasharray="8 7" />
        <path d="M390 -25 L475 344" fill="none" stroke="#f7f5ed" strokeWidth="22" />
        <path d="M390 -25 L475 344" fill="none" stroke="#a6b1a8" strokeWidth="1.5" />
        <path d="M112 28 L191 46 L205 111 L145 134 L95 89 Z" fill="#c7d7af" stroke="#71806f" strokeWidth="2" />
        <path d="M237 71 L334 41 L365 112 L297 153 L225 124 Z" fill="#b6cce0" stroke="#6d8590" strokeWidth="2" />
        <path d="M318 160 L404 124 L455 186 L415 252 L336 235 Z" fill="#c9e26d" stroke="#31523b" strokeWidth="3" />
        <path d="M111 164 L191 139 L243 193 L206 245 L126 232 Z" fill="#d6d5b5" stroke="#7f806d" strokeWidth="2" />
        <circle cx="387" cy="190" r="8" fill="#173d36" stroke="#fff" strokeWidth="4" />
        <text x="400" y="184" fill="#173d36" fontSize="13" fontWeight="600">Lote analisado</text>
        <text x="410" y="202" fill="#426754" fontSize="10">01.02.175.0140.001</text>
      </svg>
      <div className="absolute left-4 top-4 rounded-lg border border-white/70 bg-[#fbfaf5]/90 px-3 py-2 shadow-sm backdrop-blur">
        <p className="font-mono-ui text-[9px] uppercase tracking-[0.13em] text-[#64756b]">camadas de trabalho</p>
        <div className="mt-1.5 flex items-center gap-2 text-[10px] font-semibold text-[#24443c]"><span className="h-2 w-2 rounded-full bg-[#c9e26d]" />Cadastro imobiliário</div>
      </div>
      <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-white/70 bg-[#fbfaf5]/90 px-3 py-2 font-mono-ui text-[9px] tracking-wider text-[#4f675d] shadow-sm backdrop-blur">
        <MapPinned className="h-3.5 w-3.5" /> EPSG: 31983
      </div>
    </div>
  );
}

function Overview() {
  const [, setLocation] = useLocation();
  const metrics = [
    { label: "Em processamento", value: "14", helper: "4 exigem conferência", icon: Clock3, tone: "text-[#587b97] bg-[#e9f0f4]" },
    { label: "Emitidos no mês", value: "87", helper: "+12,9% no período", icon: FileCheck2, tone: "text-[#42642d] bg-[#edf3df]" },
    { label: "SLA de conclusão", value: "93%", helper: "média de 1,4 dia útil", icon: CircleCheck, tone: "text-[#7a5e24] bg-[#f6edda]" },
    { label: "Bases sincronizadas", value: "08", helper: "última atualização hoje", icon: Layers2, tone: "text-[#5e587e] bg-[#edebf5]" },
  ];

  return (
    <div className="mx-auto max-w-[1480px] space-y-7">
      <header className="flex items-center justify-between border-b border-[#dfe4da] pb-5">
        <div className="flex items-center gap-3 text-[12px] text-[#6b817b]"><span className="font-medium text-[#31584d]">Secretaria de Urbanismo</span><span className="h-1 w-1 rounded-full bg-[#a8b8ab]" /> Central documental</div>
        <div className="flex items-center gap-3"><button aria-label="Buscar" className="grid h-9 w-9 place-items-center rounded-full border border-[#dce2d7] bg-[#fbfaf6] text-[#59716a] transition hover:bg-white"><Search className="h-4 w-4" /></button><button aria-label="Notificações" className="relative grid h-9 w-9 place-items-center rounded-full border border-[#dce2d7] bg-[#fbfaf6] text-[#59716a] transition hover:bg-white"><Bell className="h-4 w-4" /><span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#afcf57]" /></button></div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_.9fr]">
        <div className="relative overflow-hidden rounded-[22px] bg-[#1b443b] p-7 text-white shadow-[0_18px_45px_rgba(21,54,47,.16)] md:p-9">
          <div className="absolute right-[-24px] top-[-25px] h-52 w-52 rounded-full border border-white/10" />
          <div className="absolute right-[72px] top-[42px] h-20 w-20 rounded-full border border-[#c9e26d]/35" />
          <p className="relative font-mono-ui text-[10px] uppercase tracking-[0.18em] text-[#c9e26d]">Painel operacional</p>
          <h1 className="relative mt-3 max-w-xl font-editorial text-[38px] leading-[.98] tracking-[-0.04em] md:text-[48px]">Decisões urbanas, <br />documentadas com precisão.</h1>
          <p className="relative mt-5 max-w-lg text-[13px] leading-6 text-[#c9d7d1]">Organize a instrução, interprete as bases territoriais e produza atos técnicos consistentes a partir de um único fluxo de trabalho.</p>
          <div className="relative mt-8 flex flex-wrap items-center gap-3"><Button onClick={() => setLocation("/nova-solicitacao")} className="h-11 rounded-xl bg-[#c9e26d] px-5 text-[12px] font-bold text-[#173d36] hover:bg-[#d7eb8b]"><Plus className="mr-2 h-4 w-4" /> Nova solicitação</Button><button onClick={() => setLocation("/solicitacoes")} className="group flex h-11 items-center gap-2 rounded-xl px-3 text-[12px] font-semibold text-white/80 transition hover:text-white">Ver fila completa <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></button></div>
        </div>
        <div className="paper-noise rounded-[22px] border border-[#dce3d7] bg-[#f8f8f2] p-7 shadow-[0_16px_40px_rgba(51,72,63,.06)]">
          <div className="flex items-center justify-between"><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[#688177]">Acompanhar hoje</p><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eaf0dd] text-[#567538]"><Sparkles className="h-4 w-4" /></span></div>
          <p className="mt-6 font-editorial text-[28px] leading-none tracking-[-0.03em] text-[#1d3933]">4 análises <br />prontas para você.</p>
          <div className="mt-7 space-y-3"><div className="flex items-center justify-between text-[11px] font-medium text-[#647a74]"><span>Instrução documental</span><span className="text-[#294d41]">78%</span></div><Progress value={78} className="h-1.5 bg-[#e0e7dd] [&>div]:bg-[#89ac52]" /></div>
          <button onClick={() => setLocation("/solicitacoes")} className="mt-6 flex items-center gap-2 text-[11px] font-bold text-[#47702d] hover:underline">Priorizar revisões <ChevronRight className="h-3.5 w-3.5" /></button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">{metrics.map(({ label, value, helper, icon: Icon, tone }) => <div key={label} className="rounded-[18px] border border-[#dde4d9] bg-[#fcfbf7] p-5 shadow-[0_8px_24px_rgba(40,64,54,.035)]"><div className="flex items-start justify-between"><p className="text-[11px] font-semibold text-[#6e827c]">{label}</p><span className={cn("grid h-8 w-8 place-items-center rounded-lg", tone)}><Icon className="h-4 w-4" /></span></div><div className="mt-5 flex items-end justify-between"><span className="font-editorial text-[36px] leading-none tracking-[-0.04em] text-[#1c3b34]">{value}</span><span className="pb-0.5 text-[10px] text-[#80928d]">{helper}</span></div></div>)}</section>

      <section className="grid gap-5 2xl:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-5 shadow-[0_12px_32px_rgba(40,64,54,.04)] md:p-6">
          <div className="flex items-end justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[#6f887c]">Fila de trabalho</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-0.03em] text-[#203d36]">Solicitações recentes</h2></div><button onClick={() => setLocation("/solicitacoes")} className="text-[11px] font-bold text-[#4e752f] hover:underline">Ver todas</button></div>
          <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-[#e4e8df] font-mono-ui text-[9px] uppercase tracking-[.12em] text-[#84958e]"><th className="pb-3 font-medium">Processo</th><th className="pb-3 font-medium">Inscrição</th><th className="pb-3 font-medium">Atualização</th><th className="pb-3 font-medium">Status</th><th className="pb-3" /></tr></thead><tbody>{requests.map((item) => <tr key={item.protocol} className="border-b border-[#edf0e9] last:border-0"><td className="py-3.5"><p className="text-[11px] font-bold text-[#2c5147]">{item.protocol}</p><p className="mt-1 text-[10px] text-[#6f847d]">{item.title}</p></td><td className="py-3.5 font-mono-ui text-[10px] text-[#49645c]">{item.inscription}</td><td className="py-3.5 text-[10px] text-[#788c85]">{item.date}</td><td className="py-3.5"><StatusBadge status={item.status} /></td><td className="py-3.5 text-right"><button aria-label={`Abrir ${item.protocol}`} className="rounded-md p-1 text-[#6f847b] hover:bg-[#edf2e8]"><MoreHorizontal className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>
        </div>
        <div className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-5 shadow-[0_12px_32px_rgba(40,64,54,.04)] md:p-6"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[0.16em] text-[#6f887c]">Território</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-0.03em] text-[#203d36]">Consulta espacial</h2></div><button onClick={() => setLocation("/bases")} className="grid h-8 w-8 place-items-center rounded-lg bg-[#edf2e8] text-[#4b7335]"><Layers2 className="h-4 w-4" /></button></div><div className="mt-5"><LotPlan /></div><div className="mt-4 grid grid-cols-3 divide-x divide-[#e2e7df]"><div><p className="font-mono-ui text-[9px] uppercase tracking-wider text-[#80918a]">zona</p><p className="mt-1 text-[12px] font-bold text-[#315148]">ZR-3</p></div><div className="pl-4"><p className="font-mono-ui text-[9px] uppercase tracking-wider text-[#80918a]">área</p><p className="mt-1 text-[12px] font-bold text-[#315148]">482,50 m²</p></div><div className="pl-4"><p className="font-mono-ui text-[9px] uppercase tracking-wider text-[#80918a]">camadas</p><p className="mt-1 text-[12px] font-bold text-[#315148]">06 ativas</p></div></div></div>
      </section>
    </div>
  );
}

function UploadDropzone({ title, description, accept, onChange, files, icon: Icon = UploadCloud }: { title: string; description: string; accept: string; onChange: (files: FileList | null) => void; files: string[]; icon?: typeof UploadCloud }) {
  return <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#b6c8b9] bg-[#f8faf4] px-5 py-7 text-center transition hover:border-[#769b52] hover:bg-[#f4f8eb]"><input type="file" className="sr-only" accept={accept} multiple onChange={(event) => onChange(event.target.files)} /><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e9f1db] text-[#5d853b] transition group-hover:scale-105"><Icon className="h-5 w-5" /></span><p className="mt-3 text-[12px] font-bold text-[#365d50]">{title}</p><p className="mt-1 max-w-xs text-[10px] leading-5 text-[#758982]">{description}</p>{files.length > 0 && <div className="mt-4 flex flex-wrap justify-center gap-1.5">{files.map((name) => <span key={name} className="rounded-md bg-white px-2 py-1 font-mono-ui text-[9px] text-[#46655a] shadow-sm">{name}</span>)}</div>}</label>;
}

function NewRequest() {
  return <RequestWizard />;
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [type, setType] = useState(documentTypes[0]);
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [referenceFiles, setReferenceFiles] = useState<string[]>([]);
  const progress = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;
  const stageLabels = ["Tipo e cadastro", "Insumos", "Conferência", "Emissão"];
  const parseFiles = (files: FileList | null, target: "input" | "reference") => { if (!files) return; const names = Array.from(files).map((file) => file.name); target === "input" ? setInputFiles((old) => [...old, ...names]) : setReferenceFiles((old) => [...old, ...names]); toast.success(`${names.length} arquivo(s) preparado(s) para a solicitação.`); };
  return <div className="mx-auto max-w-[1180px] space-y-7"><SectionHeading eyebrow="Nova instrução" title="Nova solicitação" description="Reúna os dados cadastrais, os documentos de apoio e as referências espaciais antes de encaminhar a análise técnica." action={<Button variant="outline" onClick={() => setLocation("/")} className="rounded-xl border-[#d8e0d6] bg-[#fcfbf7] text-xs text-[#426055]">Salvar e sair</Button>} />
    <div className="rounded-[18px] border border-[#dce4d8] bg-[#fbfbf6] px-5 py-4"><div className="mb-3 flex justify-between font-mono-ui text-[9px] uppercase tracking-[.14em] text-[#769087]"><span>Etapa {step} de 4</span><span>{progress}% concluído</span></div><Progress value={progress} className="h-1.5 bg-[#e3e9dd] [&>div]:bg-[#7ea64f]" /><div className="mt-4 grid grid-cols-4">{stageLabels.map((label, index) => <div key={label} className={cn("relative text-[10px] font-semibold", index + 1 <= step ? "text-[#42682d]" : "text-[#8fa097]")}><span className={cn("mb-2 grid h-5 w-5 place-items-center rounded-full border text-[9px]", index + 1 < step ? "border-[#7da74d] bg-[#7da74d] text-white" : index + 1 === step ? "border-[#7da74d] bg-[#e9f3db] text-[#4d742e]" : "border-[#ccd8cb] bg-white")}>{index + 1 < step ? <Check className="h-3 w-3" /> : index + 1}</span>{label}</div>)}</div></div>
    {step === 1 && <div className="grid gap-5 lg:grid-cols-[1fr_.72fr]"><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><h2 className="font-editorial text-[27px] tracking-[-.03em] text-[#213e37]">Identificação do ato</h2><p className="mt-2 text-[12px] leading-5 text-[#71847e]">A tipologia orienta os campos e o modelo que será utilizado na emissão.</p><div className="mt-7 space-y-5"><div className="space-y-2"><Label htmlFor="documentType" className="text-[11px] font-bold text-[#406055]">Tipo de documento</Label><Select value={type} onValueChange={setType}><SelectTrigger id="documentType" className="h-11 rounded-xl border-[#d6dfd4] bg-white text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{documentTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="protocol" className="text-[11px] font-bold text-[#406055]">Número do protocolo</Label><Input id="protocol" placeholder="Ex.: 2026/000148" className="h-11 rounded-xl border-[#d6dfd4] bg-white text-[12px]" /></div><div className="space-y-2"><Label htmlFor="inscription" className="text-[11px] font-bold text-[#406055]">Inscrição imobiliária</Label><Input id="inscription" placeholder="00.00.000.0000.000" className="h-11 rounded-xl border-[#d6dfd4] bg-white font-mono-ui text-[12px]" /></div></div><div className="space-y-2"><Label htmlFor="applicant" className="text-[11px] font-bold text-[#406055]">Interessado ou requerente</Label><Input id="applicant" placeholder="Nome completo ou razão social" className="h-11 rounded-xl border-[#d6dfd4] bg-white text-[12px]" /></div><div className="space-y-2"><Label htmlFor="summary" className="text-[11px] font-bold text-[#406055]">Objeto da solicitação</Label><Textarea id="summary" placeholder="Descreva brevemente a demanda que será analisada." className="min-h-24 rounded-xl border-[#d6dfd4] bg-white text-[12px] leading-5" /></div></div></section><aside className="rounded-[20px] bg-[#234a40] p-6 text-white"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#c9e26d] text-[#21423a]"><FileText className="h-5 w-5" /></span><p className="mt-7 font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#c9e26d]">tipologia selecionada</p><h3 className="mt-3 font-editorial text-[29px] leading-[1.05] tracking-[-.03em]">{type}</h3><div className="mt-8 space-y-3 border-t border-white/15 pt-5 text-[11px] text-[#cfddd5]"><p className="flex gap-2"><Check className="mt-.5 h-3.5 w-3.5 text-[#c9e26d]" />Formulário adaptativo</p><p className="flex gap-2"><Check className="mt-.5 h-3.5 w-3.5 text-[#c9e26d]" />Cruzamento territorial</p><p className="flex gap-2"><Check className="mt-.5 h-3.5 w-3.5 text-[#c9e26d]" />Modelo DOCX vinculado</p></div></aside></div>}
    {step === 2 && <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">01. Documentação de apoio</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Insumos técnicos</h2><p className="mt-2 text-[12px] leading-5 text-[#71847e]">Inclua documentos, desenhos e imagens que fundamentam a análise.</p><div className="mt-6"><UploadDropzone title="Adicionar documentos" description="PDF, DOCX, DOC, DWG, JPG ou PNG. É possível selecionar múltiplos arquivos." accept=".pdf,.docx,.doc,.dwg,.jpg,.jpeg,.png" onChange={(files) => parseFiles(files, "input")} files={inputFiles} /></div></section><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">02. Referências territoriais</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Bases de consulta</h2><p className="mt-2 text-[12px] leading-5 text-[#71847e]">Envie planilhas cadastrais e o GeoPackage correspondente ao recorte territorial.</p><div className="mt-6"><UploadDropzone title="Adicionar planilha ou GeoPackage" description="XLS, XLSX, CSV e GPKG. Os campos serão mapeados na próxima etapa." accept=".xlsx,.xls,.csv,.gpkg" onChange={(files) => parseFiles(files, "reference")} files={referenceFiles} icon={Database} /></div></section></div>}
    {step === 3 && <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]"><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">Conferência cadastral</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Dados identificados</h2><dl className="mt-6 divide-y divide-[#e6ebe1] text-[12px]"><div className="flex items-center justify-between py-3"><dt className="text-[#758780]">Inscrição</dt><dd className="font-mono-ui font-medium text-[#35574b]">01.02.175.0140.001</dd></div><div className="flex items-center justify-between py-3"><dt className="text-[#758780]">Zona</dt><dd className="font-semibold text-[#35574b]">ZR-3</dd></div><div className="flex items-center justify-between py-3"><dt className="text-[#758780]">Área do lote</dt><dd className="font-semibold text-[#35574b]">482,50 m²</dd></div><div className="flex items-center justify-between py-3"><dt className="text-[#758780]">Referência espacial</dt><dd className="font-mono-ui text-[10px] text-[#35574b]">EPSG:31983</dd></div></dl><p className="mt-6 rounded-xl bg-[#eef4e5] p-3 text-[10px] leading-5 text-[#587038]">Os valores acima são uma prévia visual. O cruzamento definitivo será realizado após o processamento das bases enviadas.</p></section><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">Visualização territorial</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Lote e entorno</h2></div><Badge className="border-0 bg-[#eaf1dc] text-[10px] text-[#4d702f]">03 anexos propostos</Badge></div><div className="mt-5"><LotPlan /></div></section></div>}
    {step === 4 && <div className="rounded-[22px] border border-[#dce4d7] bg-[#fbfbf6] p-7 text-center shadow-[0_16px_40px_rgba(52,76,63,.06)]"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f1d8] text-[#527b32]"><WandSparkles className="h-7 w-7" /></span><h2 className="mt-5 font-editorial text-[34px] tracking-[-.035em] text-[#213e37]">Solicitação pronta para emissão.</h2><p className="mx-auto mt-3 max-w-lg text-[12px] leading-6 text-[#6f827b]">O processamento cruzará as bases territoriais, preencherá o modelo associado e preparará as versões DOCX e PDF para revisão técnica.</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Button onClick={() => toast.success("A emissão foi adicionada à fila de processamento.")} className="h-11 rounded-xl bg-[#234a40] px-5 text-xs hover:bg-[#173d36]"><Send className="mr-2 h-4 w-4" /> Encaminhar para emissão</Button><Button variant="outline" onClick={() => setLocation("/")} className="h-11 rounded-xl border-[#d6e0d3] bg-white text-xs">Voltar ao painel</Button></div></div>}
    <div className="flex items-center justify-between"><Button variant="ghost" disabled={step === 1} onClick={() => setStep((value) => value - 1)} className="rounded-xl text-xs text-[#54726a]">Voltar</Button>{step < 4 && <Button onClick={() => setStep((value) => value + 1)} className="h-11 rounded-xl bg-[#234a40] px-5 text-xs hover:bg-[#173d36]">{step === 3 ? "Preparar emissão" : "Continuar"}<ArrowRight className="ml-2 h-4 w-4" /></Button>}</div>
  </div>;
}

function RequestList() { const [, setLocation] = useLocation(); return <div className="mx-auto max-w-[1320px] space-y-7"><SectionHeading eyebrow="Operação" title="Solicitações" description="Acompanhe o estágio de cada processo e priorize as revisões que dependem de intervenção técnica." action={<Button onClick={() => setLocation("/nova-solicitacao")} className="h-10 rounded-xl bg-[#234a40] text-xs hover:bg-[#173d36]"><Plus className="mr-2 h-4 w-4" />Nova solicitação</Button>} /><div className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-5 shadow-[0_12px_32px_rgba(40,64,54,.04)]"><div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-[#91a099]" /><Input placeholder="Buscar por protocolo, inscrição ou interessado" className="h-10 rounded-xl border-[#dae2d7] bg-white pl-9 text-[11px]" /></div><div className="flex gap-2"><Button variant="outline" className="h-10 rounded-xl border-[#dae2d7] bg-white text-[11px]">Todos os status</Button><Button variant="outline" className="h-10 rounded-xl border-[#dae2d7] bg-white text-[11px]">Este mês</Button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left"><thead><tr className="border-b border-[#e3e9df] font-mono-ui text-[9px] uppercase tracking-[.13em] text-[#81938c]"><th className="pb-3 font-medium">Processo</th><th className="pb-3 font-medium">Tipo documental</th><th className="pb-3 font-medium">Inscrição</th><th className="pb-3 font-medium">Progresso</th><th className="pb-3 font-medium">Status</th><th className="pb-3" /></tr></thead><tbody>{requests.concat(requests).map((item, index) => <tr key={`${item.protocol}-${index}`} className="border-b border-[#edf0e9] last:border-0"><td className="py-4 text-[11px] font-bold text-[#34564b]">{item.protocol}</td><td className="py-4 text-[11px] text-[#556e66]">{item.title}</td><td className="py-4 font-mono-ui text-[10px] text-[#506960]">{item.inscription}</td><td className="py-4"><div className="flex w-28 items-center gap-2"><Progress value={item.progress} className="h-1.5 bg-[#e5ebe1] [&>div]:bg-[#83aa52]" /><span className="font-mono-ui text-[9px] text-[#748780]">{item.progress}%</span></div></td><td className="py-4"><StatusBadge status={item.status} /></td><td className="py-4 text-right"><Button size="sm" variant="ghost" className="h-7 text-[10px] text-[#53762f]">Abrir</Button></td></tr>)}</tbody></table></div></div></div>; }

function Templates() { const [files, setFiles] = useState<string[]>([]); const types = useMemo(() => documentTypes.slice(0, 6), []); return <div className="mx-auto max-w-[1320px] space-y-7"><SectionHeading eyebrow="Biblioteca documental" title="Modelos de documentos" description="Associe modelos DOCX a cada tipo de ato e mantenha a emissão padronizada entre as áreas técnicas." /><div className="grid gap-5 lg:grid-cols-[.72fr_1.28fr]"><div className="rounded-[20px] bg-[#234a40] p-6 text-white"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#c9e26d]">Adicionar modelo</p><h2 className="mt-3 font-editorial text-[30px] leading-[1.05] tracking-[-.03em]">Atualize a base de modelos oficiais.</h2><div className="mt-6"><UploadDropzone title="Enviar arquivo DOCX" description="Use campos sinalizados no modelo para o preenchimento automático." accept=".docx" onChange={(incoming) => { if (incoming) setFiles(Array.from(incoming).map((file) => file.name)); }} files={files} icon={CopyPlus} /></div></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{types.map((type, index) => <article key={type} className="rounded-[18px] border border-[#dce4d8] bg-[#fcfbf7] p-5"><div className="flex items-start justify-between"><span className={cn("grid h-9 w-9 place-items-center rounded-lg", index % 2 ? "bg-[#eef0e6] text-[#68744a]" : "bg-[#e8f0dc] text-[#557b35]")}><FileText className="h-4 w-4" /></span><button className="text-[#789087]"><MoreHorizontal className="h-4 w-4" /></button></div><h3 className="mt-5 text-[12px] font-bold leading-5 text-[#33554b]">{type}</h3><p className="mt-2 text-[10px] leading-4 text-[#82928c]">Modelo base · versão 2.4</p><div className="mt-5 flex items-center justify-between border-t border-[#e8ece5] pt-3"><span className="font-mono-ui text-[9px] text-[#7d8f87]">DOCX</span><button onClick={() => toast.info("A área de mapeamento de campos será aberta ao selecionar um modelo.")} className="text-[10px] font-bold text-[#557c34]">Configurar</button></div></article>)}</div></div></div>; }

function Bases() { const [files, setFiles] = useState<string[]>([]); return <div className="mx-auto max-w-[1180px] space-y-7"><SectionHeading eyebrow="Inteligência territorial" title="Bases territoriais" description="Gerencie as fontes de consulta que serão cruzadas com a inscrição imobiliária durante o processamento." /><div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">Atualizar fonte</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Importar dados</h2></div><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eaf2dd] text-[#5b803a]"><FolderUp className="h-4 w-4" /></span></div><div className="mt-6"><UploadDropzone title="Enviar arquivos geoespaciais" description="Planilhas XLS, XLSX ou CSV; arquivos GeoPackage em GPKG." accept=".xlsx,.xls,.csv,.gpkg" onChange={(incoming) => { if (incoming) setFiles(Array.from(incoming).map((file) => file.name)); }} files={files} icon={LandPlot} /></div></section><section className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#72887c]">Catálogo ativo</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#213e37]">Fontes registradas</h2><div className="mt-5 space-y-3">{[{ name: "Cadastro imobiliário", type: "Planilha XLSX", status: "Atualizado hoje" }, { name: "Zoneamento municipal", type: "GeoPackage", status: "Atualizado em 06 ago" }, { name: "Perímetro urbano", type: "GeoPackage", status: "Atualizado em 01 ago" }].map((source, index) => <div key={source.name} className="flex items-center gap-3 rounded-xl border border-[#e4e9e0] px-3.5 py-3"><span className={cn("grid h-8 w-8 place-items-center rounded-lg", index === 0 ? "bg-[#ebf0df] text-[#5b803a]" : "bg-[#e7eef1] text-[#4b6e7e]")}>{index === 0 ? <FileSpreadsheet className="h-4 w-4" /> : <MapPinned className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-[#36584d]">{source.name}</p><p className="mt-0.5 text-[9px] text-[#81938b]">{source.type}</p></div><span className="text-[9px] font-medium text-[#688044]">{source.status}</span></div>)}</div></section></div></div>; }

function History() { return <div className="mx-auto max-w-[1320px] space-y-7"><SectionHeading eyebrow="Rastreabilidade" title="Histórico de emissões" description="Consulte versões anteriores, recupere arquivos gerados e reprocese documentos quando necessário." /><div className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-5"><div className="grid gap-3">{requests.map((item, index) => <article key={item.protocol} className="flex flex-col gap-4 rounded-xl border border-[#e5eae2] px-4 py-4 sm:flex-row sm:items-center"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3e2] text-[#557b35]"><FileCheck2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[12px] font-bold text-[#37594e]">{item.title}</p><p className="mt-1 font-mono-ui text-[9px] text-[#82938c]">{item.protocol} · versão {3 - (index % 2)} · {item.date}</p></div><div className="flex items-center gap-2"><Button variant="outline" onClick={() => toast.info("O arquivo gerado estará disponível após o processamento real da solicitação.")} className="h-9 rounded-lg border-[#dbe3d8] bg-white text-[10px] text-[#4c6d60]"><Download className="mr-1.5 h-3.5 w-3.5" />Baixar</Button><Button variant="outline" onClick={() => toast.success("Uma nova versão foi adicionada à fila de reprocessamento.")} className="h-9 rounded-lg border-[#dbe3d8] bg-white text-[10px] text-[#4c6d60]">Reprocessar</Button></div></article>)}</div></div></div>; }

export default function Home() {
  const [location] = useLocation();
  let content: React.ReactNode = <OperationalDashboard />;
  if (location === "/nova-solicitacao") content = <NewRequest />;
  if (location === "/solicitacoes") content = <RequestsWorkspace />;
  if (location === "/modelos") content = <><TemplateRegistry /><ReferenceRegistry /></>;
  if (location === "/bases") content = <SpatialSourceAdministration />;
  if (location === "/historico") content = <DocumentHistory />;
  return <DashboardLayout>{content}</DashboardLayout>;
}
