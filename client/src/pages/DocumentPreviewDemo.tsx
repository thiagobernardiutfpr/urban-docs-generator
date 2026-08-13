import DashboardLayout from "@/components/DashboardLayout";
import DocumentFinalPreview from "@/components/DocumentFinalPreview";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { Link } from "wouter";

export default function DocumentPreviewDemo() {
  const preview = trpc.generated.previewDemo.useMutation();
  useEffect(() => { if (!preview.data && !preview.isPending && !preview.error) preview.mutate(); }, [preview]);
  return <DashboardLayout><div className="mx-auto max-w-[1120px] space-y-6"><header><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[#6c865e]">Etapa 4 · emissão de demonstração</p><h1 className="mt-2 font-editorial text-[36px] tracking-[-.035em] text-[#24473e]">Pré-visualização final</h1><p className="mt-2 max-w-2xl text-[12px] leading-6 text-[#6b8078]">Esta tela gera uma certidão de demonstração pela mesma rotina de emissão do aplicativo e apresenta o PDF resultante antes do download. Nenhuma solicitação é gravada no banco.</p><Link href="/nova-solicitacao" className="mt-4 inline-block text-[11px] font-bold text-[#4c7431] hover:underline">Voltar à nova solicitação</Link></header>{preview.isPending && <div className="grid min-h-[420px] place-items-center rounded-[22px] border border-[#dce4d7] bg-[#fbfbf6]"><div className="text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#638b40]" /><p className="mt-3 text-[12px] text-[#668074]">Gerando documento de demonstração…</p></div></div>}{preview.error && <div className="rounded-[18px] border border-[#efc6c0] bg-[#fff4f1] p-5 text-[12px] text-[#8d4035]">Não foi possível gerar a prévia de demonstração: {preview.error.message}</div>}{preview.data && <DocumentFinalPreview output={preview.data} />}</div></DashboardLayout>;
}
