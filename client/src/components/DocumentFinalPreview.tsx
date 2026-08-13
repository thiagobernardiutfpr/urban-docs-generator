import { Button } from "@/components/ui/button";
import { getPdfPreviewUrl } from "@shared/documentPreview";
import { CheckCircle2, Download } from "lucide-react";
import React, { useState } from "react";

export type FinalDocumentOutput = {
  docx: { storageUrl: string };
  pdf: { storageUrl: string };
};

export default function DocumentFinalPreview({ output }: { output: FinalDocumentOutput }) {
  const [showPreview, setShowPreview] = useState(true);
  return <div className="rounded-[22px] border border-[#dce4d7] bg-[#fbfbf6] p-6 md:p-8"><div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e7f1d8] text-[#527b32]"><CheckCircle2 className="h-7 w-7" /></span><h2 className="mt-5 font-editorial text-[34px] tracking-[-.035em] text-[#213e37]">Documentos gerados para revisão.</h2><p className="mx-auto mt-3 max-w-lg text-[12px] leading-6 text-[#6f827b]">Confira a versão em PDF antes de realizar o download ou encaminhar o ato para assinatura.</p></div><div className="mx-auto mt-7 max-w-4xl"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="font-mono-ui text-[10px] uppercase tracking-[.13em] text-[#668074]">Pré-visualização do documento final</p><Button type="button" variant="outline" onClick={() => setShowPreview((current) => !current)} className="h-8 rounded-lg border-[#d4e0d1] bg-white text-[10px] font-bold text-[#486d35]">{showPreview ? "Ocultar prévia" : "Exibir prévia"}</Button></div>{showPreview && <iframe title="Pré-visualização do documento final em PDF" src={getPdfPreviewUrl(output.pdf.storageUrl)} className="h-[560px] w-full rounded-xl border border-[#d9e2d7] bg-white shadow-inner" />}<div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-3"><a href={output.docx.storageUrl} className="rounded-xl bg-[#234a40] px-5 py-3 text-[11px] font-bold text-white"><Download className="mr-2 inline h-4 w-4" />Baixar DOCX</a><a href={output.pdf.storageUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-[#d4e0d1] bg-white px-5 py-3 text-[11px] font-bold text-[#486d35]"><Download className="mr-2 inline h-4 w-4" />Abrir ou baixar PDF</a></div></div></div>;
}
