import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, FileSearch2, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type FileFieldSuggestion = { key: string; value: string; confidence: number; evidence: string };
export type FileExtractionCard = { fileId: number; filename: string; summary: string; warnings: string[]; suggestions: FileFieldSuggestion[] };

export default function FileExtractionReview({ item, onApply, disabled }: { item: FileExtractionCard; onApply: (fields: Record<string, string>) => Promise<void>; disabled?: boolean }) {
  const initial = useMemo(() => Object.fromEntries(item.suggestions.map((suggestion) => [suggestion.key, suggestion.value])), [item]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(item.suggestions.map((suggestion) => [suggestion.key, true])));
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValues(initial); setSelected(Object.fromEntries(item.suggestions.map((suggestion) => [suggestion.key, true]))); }, [initial, item.suggestions]);

  const apply = async () => {
    const fields = Object.fromEntries(Object.entries(values).filter(([key, value]) => selected[key] && value.trim()));
    if (!Object.keys(fields).length) return;
    setSaving(true);
    try { await onApply(fields); } finally { setSaving(false); }
  };

  return <article className="rounded-2xl border border-[#d7e4d1] bg-[#fbfdf7] p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e8f2dd] text-[#4e7831]"><FileSearch2 className="h-4 w-4" /></span><div><p className="text-[12px] font-bold text-[#294b40]">{item.filename}</p><p className="mt-1 text-[10px] leading-4 text-[#708179]">{item.summary}</p></div></div><span className="inline-flex items-center gap-1 rounded-full bg-[#edf5e6] px-2.5 py-1 text-[9px] font-bold text-[#537a35]"><ShieldCheck className="h-3 w-3" />Revisão obrigatória</span></div>{item.warnings.length > 0 && <div className="mt-3 rounded-lg bg-[#fff7e4] px-3 py-2 text-[10px] leading-4 text-[#8a641c]">{item.warnings.join(" ")}</div>}<div className="mt-4 space-y-2">{item.suggestions.length ? item.suggestions.map((suggestion) => <div key={suggestion.key} className="grid gap-2 rounded-xl border border-[#e1e9dc] bg-white p-3 sm:grid-cols-[18px_minmax(0,1fr)_58px]"><input aria-label={`Aplicar ${suggestion.key}`} type="checkbox" checked={selected[suggestion.key] ?? false} onChange={(event) => setSelected((current) => ({ ...current, [suggestion.key]: event.target.checked }))} className="mt-2 h-4 w-4 accent-[#668f41]" /><div><div className="mb-1 flex flex-wrap items-center justify-between gap-2"><span className="font-mono-ui text-[9px] font-bold uppercase tracking-[.12em] text-[#597165]">{suggestion.key.replaceAll("_", " ")}</span><span className="text-[9px] text-[#759080]">Evidência: {suggestion.evidence}</span></div><Input value={values[suggestion.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [suggestion.key]: event.target.value }))} className="h-9 border-[#d9e4d5] text-[11px]" /></div><span className="self-center justify-self-start rounded-full bg-[#f1f5ec] px-2 py-1 text-[9px] font-bold text-[#52704d]">{suggestion.confidence}%</span></div>) : <p className="rounded-xl bg-white px-3 py-3 text-[10px] text-[#74847c]">O arquivo não forneceu campos confiáveis para esta tipologia. Mantenha a conferência manual.</p>}</div>{item.suggestions.length > 0 && <div className="mt-4 flex justify-end"><Button disabled={disabled || saving} onClick={() => void apply()} className="h-9 rounded-lg bg-[#305b4d] px-3 text-[10px] hover:bg-[#254b40]">{saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}Aplicar campos selecionados</Button></div>}</article>;
}
