import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { documentTypeLabels, type DocumentType } from "@shared/urbanDocs";
import { Bot, CheckCircle2, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Props = {
  documentType: DocumentType;
  protocol: string;
  enrollment: string;
  applicant: string;
  description: string;
  fields: Record<string, string>;
  extractedData?: Record<string, unknown>;
  onApplyDraft: (draft: string) => void;
};

export default function UrbanAIReview({ documentType, protocol, enrollment, applicant, description, fields, extractedData, onApplyDraft }: Props) {
  const [analysis, setAnalysis] = useState<Awaited<ReturnType<typeof import("../../../server/urbanAI").analyzeUrbanInstruction>>>();
  const analyze = trpc.ai.analyze.useMutation();
  const ready = Boolean(protocol || enrollment || applicant || description || Object.values(fields).some(Boolean));

  const runAnalysis = async () => {
    try {
      const result = await analyze.mutateAsync({ documentType, protocol, enrollment, applicant, description, fields, extractedData });
      setAnalysis(result);
      toast.success("A IA preparou uma análise para conferência humana.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível obter a análise por IA.");
    }
  };

  return <section className="mt-6 rounded-[18px] border border-[#d5e3c7] bg-[#f4f8eb] p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d9edb6] text-[#47742d]"><Bot className="h-4.5 w-4.5" /></span><div><p className="font-mono-ui text-[9px] uppercase tracking-[.14em] text-[#63884a]">Assistente UrbanDocs</p><h3 className="mt-1 text-[13px] font-bold text-[#31553e]">Análise inteligente da instrução</h3><p className="mt-1 max-w-2xl text-[10px] leading-5 text-[#6b806f]">A IA resume a instrução, aponta pendências e propõe um rascunho. A conferência e a decisão final continuam obrigatoriamente humanas.</p></div></div><Button type="button" disabled={!ready || analyze.isPending} onClick={runAnalysis} className="h-9 shrink-0 rounded-lg bg-[#426f2c] px-3.5 text-[10px] font-bold hover:bg-[#365f23]">{analyze.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}Analisar com IA</Button></div>
    {analysis && <div className="mt-5 grid gap-4 border-t border-[#dce8d0] pt-4 lg:grid-cols-2"><div className="rounded-xl bg-white/75 p-4"><p className="text-[11px] font-bold text-[#345a43]">Síntese da instrução</p><p className="mt-2 text-[11px] leading-5 text-[#5b7164]">{analysis.summary}</p><p className="mt-4 text-[11px] font-bold text-[#345a43]">Rascunho sugerido</p><p className="mt-2 text-[11px] leading-5 text-[#5b7164]">{analysis.suggestedDraft}</p><Button type="button" variant="outline" onClick={() => onApplyDraft(analysis.suggestedDraft)} className="mt-3 h-8 rounded-lg border-[#c8dbb8] bg-white text-[10px] font-bold text-[#4b7432]"><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Usar como rascunho</Button></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#dce6d2] bg-white/65 p-3"><p className="text-[10px] font-bold text-[#45663b]">Pendências</p><ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-[#637867]">{analysis.missingFields.length ? analysis.missingFields.map((item) => <li key={item} className="flex gap-1.5"><span className="mt-1 h-1 w-1 rounded-full bg-[#8aae5e]" />{item}</li>) : <li>Nenhuma pendência inferida.</li>}</ul></div><div className="rounded-xl border border-[#f0d9b0] bg-[#fff9eb] p-3"><p className="flex items-center gap-1.5 text-[10px] font-bold text-[#8e6013]"><TriangleAlert className="h-3.5 w-3.5" />Revisão humana</p><ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-[#806a45]">{analysis.riskFlags.length ? analysis.riskFlags.map((item) => <li key={item}>{item}</li>) : <li>{analysis.reviewNotice}</li>}</ul></div></div><p className="lg:col-span-2 text-[9px] leading-4 text-[#788a7c]">{analysis.reviewNotice}</p></div>}
  </section>;
}
