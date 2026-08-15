import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud } from "lucide-react";
import React from "react";

export function TemplateUploadControls({ fileName, authenticated, pending, onSelect, onSend }: { fileName?: string; authenticated: boolean; pending: boolean; onSelect: () => void; onSend: () => void }) {
  const canSend = Boolean(fileName) && authenticated && !pending;
  return <div className="rounded-2xl border border-dashed border-[#9bbb76] bg-[#f8faf4] px-5 py-6 text-center text-[#315447]" data-testid="template-upload-controls">
    <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[#e9f1dc] text-[#628b3f]">{pending ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}</span>
    <p className="mt-3 truncate text-[12px] font-bold">{fileName ?? "Nenhum modelo selecionado"}</p>
    <p className="mt-1 text-[10px] leading-5 text-[#738880]">Selecione um DOCX de até 25 MB. Use {"{protocolo}"}, {"{endereco}"} ou {"{zoneamento}"} no corpo, cabeçalho ou rodapé para manter o layout durante a emissão.</p>
    <div className="mt-4 flex flex-wrap justify-center gap-2">
      <Button type="button" variant="outline" disabled={!authenticated || pending} onClick={onSelect} className="h-9 rounded-lg border-[#bed19e] bg-white text-[10px] text-[#41633a]">Selecionar DOCX</Button>
      <Button type="button" disabled={!canSend} onClick={onSend} className="h-9 rounded-lg bg-[#234a40] text-[10px] hover:bg-[#173d36]">{pending ? "Enviando…" : "Enviar modelo"}</Button>
    </div>
  </div>;
}
