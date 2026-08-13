import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Bot, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";

export default function AIContextInsight({ scope, context, title }: { scope: "templates" | "spatial_sources" | "final_review"; context: string; title: string }) {
  const [answer, setAnswer] = useState<string>();
  const [auditId, setAuditId] = useState<number>();
  const insight = trpc.ai.contextual.useMutation({ onSuccess: (result) => { setAnswer(result.answer); setAuditId(result.auditId); } });
  return <aside className="rounded-2xl border border-[#d9e7cc] bg-[#f2f7ea] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-2.5"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#dceec3] text-[#567c35]"><Bot className="h-4 w-4" /></span><div><p className="text-[11px] font-bold text-[#375d43]">{title}</p><p className="mt-1 text-[9px] leading-4 text-[#6a8173]">Orientação assistiva, registrada para revisão humana na Central de Governança.</p></div></div><Button type="button" onClick={() => insight.mutate({ scope, context })} disabled={insight.isPending} variant="outline" className="h-8 rounded-lg border-[#c9dbba] bg-white text-[10px] font-bold text-[#4e762f]">{insight.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}{insight.isPending ? "Analisando…" : "Consultar IA"}</Button></div>{answer && <div className="mt-3 rounded-xl border border-[#dce8d1] bg-white/75 p-3"><p className="whitespace-pre-wrap text-[10px] leading-5 text-[#546f61]">{answer}</p><p className="mt-2 flex items-center gap-1.5 text-[9px] text-[#7a8e80]"><TriangleAlert className="h-3 w-3" />Sugestão # {auditId} · exige conferência humana antes de qualquer decisão.</p></div>}</aside>;
}
