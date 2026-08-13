import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { documentTypeLabels, type DocumentType } from "@shared/urbanDocs";
import { ArrowRight, CheckCircle2, CircleDashed, Clock3, Eye, FileCheck2, FileText, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  collecting: "Coletando insumos",
  cross_referenced: "Dados cruzados",
  ready_for_review: "Pronto para revisão",
  processing: "Em processamento",
  completed: "Concluído",
  failed: "Falha no processamento",
};

const statusTone: Record<string, string> = {
  draft: "bg-[#eef0e9] text-[#687b72]",
  collecting: "bg-[#f5ead2] text-[#8b5c0c]",
  cross_referenced: "bg-[#e3edf1] text-[#28576a]",
  ready_for_review: "bg-[#e6f1d1] text-[#466619]",
  processing: "bg-[#e8edf8] text-[#425e90]",
  completed: "bg-[#e4f0e9] text-[#286149]",
  failed: "bg-[#f6e1dc] text-[#994331]",
};

function RequestTable({ compact = false }: { compact?: boolean }) {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: requests = [], isLoading } = trpc.requests.list.useQuery(undefined, { enabled: isAuthenticated });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const visible = useMemo(() => requests.filter((request) => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery = !needle || [request.protocol, request.enrollment, request.applicant, request.documentType].some((value) => String(value ?? "").toLocaleLowerCase("pt-BR").includes(needle));
    return matchesQuery && (status === "all" || request.status === status);
  }), [query, requests, status]);

  if (!isAuthenticated) return <div className="rounded-2xl border border-dashed border-[#ccd8c9] bg-[#fbfbf7] px-5 py-10 text-center text-[11px] leading-5 text-[#74877f]">Entre com sua conta para consultar as solicitações do seu acervo técnico.</div>;
  return <div className="rounded-[20px] border border-[#dde4d9] bg-[#fcfbf7] p-5 shadow-[0_12px_32px_rgba(40,64,54,.04)] md:p-6">
    {!compact && <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative max-w-md flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-[#91a099]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar protocolo, inscrição ou interessado" className="h-10 rounded-xl border-[#dae2d7] bg-white pl-9 text-[11px]" /></div><Select value={status} onValueChange={setStatus}><SelectTrigger className="h-10 w-[190px] rounded-xl border-[#dae2d7] bg-white text-[11px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem>{Object.entries(statusLabel).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead><tr className="border-b border-[#e3e9df] font-mono-ui text-[9px] uppercase tracking-[.13em] text-[#81938c]"><th className="pb-3 font-medium">Processo</th><th className="pb-3 font-medium">Tipo documental</th><th className="pb-3 font-medium">Inscrição</th><th className="pb-3 font-medium">Atualização</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-right font-medium">Ações</th></tr></thead><tbody>{isLoading && <tr><td colSpan={6} className="py-10 text-center text-[11px] text-[#7d8d86]">Carregando solicitações…</td></tr>}{!isLoading && visible.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[11px] text-[#7d8d86]">Nenhuma solicitação encontrada para os filtros atuais.</td></tr>}{visible.map((request) => <tr key={request.id} className="border-b border-[#edf0e9] last:border-0"><td className="py-4"><p className="text-[11px] font-bold text-[#34564b]">{request.protocol}</p><p className="mt-1 text-[10px] text-[#71847e]">{request.applicant || "Interessado não informado"}</p></td><td className="py-4 text-[11px] text-[#556e66]">{documentTypeLabels[request.documentType as DocumentType] ?? request.documentType}</td><td className="py-4 font-mono-ui text-[10px] text-[#506960]">{request.enrollment || "—"}</td><td className="py-4 text-[10px] text-[#788c85]">{new Date(request.updatedAt).toLocaleDateString("pt-BR")}</td><td className="py-4"><Badge className={`rounded-full border-0 px-2.5 py-1 text-[9px] font-semibold shadow-none ${statusTone[request.status] ?? statusTone.draft}`}>{statusLabel[request.status] ?? request.status}</Badge></td><td className="py-4 text-right"><Button variant="outline" size="sm" onClick={() => setLocation(`/processo?id=${request.id}`)} className="h-8 rounded-lg border-[#dbe3d8] bg-white px-2.5 text-[9px] text-[#426055]"><Eye className="mr-1 h-3 w-3" />Abrir</Button></td></tr>)}</tbody></table></div>
  </div>;
}

export function OperationalDashboard() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: requests = [] } = trpc.requests.list.useQuery(undefined, { enabled: isAuthenticated });
  const metrics = [
    { label: "Solicitações ativas", value: requests.filter((item) => !["completed", "failed"].includes(item.status)).length, icon: Clock3, tone: "bg-[#e8edf8] text-[#425e90]" },
    { label: "Dados cruzados", value: requests.filter((item) => item.status === "cross_referenced").length, icon: CircleDashed, tone: "bg-[#e3edf1] text-[#28576a]" },
    { label: "Documentos concluídos", value: requests.filter((item) => item.status === "completed").length, icon: CheckCircle2, tone: "bg-[#e4f0e9] text-[#286149]" },
  ];
  return <div className="mx-auto max-w-[1400px] space-y-7"><header className="flex items-center justify-between border-b border-[#dfe4da] pb-5"><div className="text-[12px] text-[#6b817b]"><span className="font-medium text-[#31584d]">Secretaria de Urbanismo</span><span className="mx-2 text-[#a8b8ab]">•</span>Central documental</div><Button onClick={() => setLocation("/nova-solicitacao")} className="h-10 rounded-xl bg-[#234a40] text-xs hover:bg-[#173d36]"><Plus className="mr-2 h-4 w-4" />Nova solicitação</Button></header><section className="relative overflow-hidden rounded-[22px] bg-[#1b443b] p-7 text-white shadow-[0_18px_45px_rgba(21,54,47,.16)] md:p-9"><div className="absolute right-[-20px] top-[-30px] h-64 w-64 rounded-full border border-white/10" /><div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[#c9e26d]">Painel operacional</p><h1 className="mt-3 max-w-xl font-editorial text-[38px] leading-[.98] tracking-[-.04em] md:text-[48px]">Decisões urbanas, documentadas com precisão.</h1><p className="mt-5 max-w-2xl text-[13px] leading-6 text-[#c9d7d1]">Acompanhe processos privados, dados cadastrais e emissões com rastreabilidade integral.</p></div><button onClick={() => setLocation("/solicitacoes")} className="flex items-center gap-2 text-[11px] font-bold text-[#c9e26d] transition hover:text-white">Ver fila completa <ArrowRight className="h-4 w-4" /></button></div></section><section className="grid gap-4 md:grid-cols-3">{metrics.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-[18px] border border-[#dde4d9] bg-[#fcfbf7] p-5"><div className="flex items-start justify-between"><p className="text-[11px] font-semibold text-[#6e827c]">{label}</p><span className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}><Icon className="h-4 w-4" /></span></div><p className="mt-5 font-editorial text-[36px] leading-none tracking-[-.04em] text-[#1c3b34]">{String(value).padStart(2, "0")}</p></div>)}</section><section><div className="mb-4 flex items-end justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#6f887c]">Fila de trabalho</p><h2 className="mt-2 font-editorial text-[28px] tracking-[-.03em] text-[#203d36]">Solicitações recentes</h2></div><FileText className="h-5 w-5 text-[#769b52]" /></div><RequestTable compact /></section></div>;
}

export function RequestsWorkspace() {
  const [, setLocation] = useLocation();
  return <div className="mx-auto max-w-[1320px] space-y-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[#627d5b]">Operação</p><h1 className="mt-2 font-editorial text-[34px] tracking-[-.035em] text-[#1d3933] md:text-[42px]">Solicitações</h1><p className="mt-3 max-w-2xl text-[13px] leading-6 text-[#69807a]">Filtre a fila processual e acompanhe o estágio técnico de cada instrução.</p></div><Button onClick={() => setLocation("/nova-solicitacao")} className="h-10 rounded-xl bg-[#234a40] text-xs hover:bg-[#173d36]"><Plus className="mr-2 h-4 w-4" />Nova solicitação</Button></div><RequestTable /></div>;
}
