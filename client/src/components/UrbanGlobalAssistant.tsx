import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Bot, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
const starter: ChatMessage[] = [{ role: "system", content: "Você é o Assistente UrbanDocs." }];

export default function UrbanGlobalAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>(starter);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const chat = trpc.ai.chat.useMutation({
    onSuccess: (result) => setMessages((current) => [...current, { role: "assistant", content: result.answer }]),
    onError: (error) => toast.error(error.message || "O assistente não conseguiu responder agora."),
  });
  const sendMessage = () => {
    const content = draft.trim();
    if (!content || chat.isPending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    chat.mutate({ messages: next.filter((message): message is ChatMessage & { role: "user" | "assistant" } => message.role !== "system").slice(-10) });
  };
  return <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button type="button" size="sm" className="fixed bottom-5 right-5 z-50 h-11 rounded-full bg-[#426f2c] px-4 text-[11px] font-bold shadow-[0_12px_30px_rgba(43,79,40,.28)] hover:bg-[#345d24]"><Sparkles className="mr-2 h-4 w-4" />Assistente IA</Button></SheetTrigger><SheetContent side="right" className="flex w-full flex-col border-l-[#dce6d5] bg-[#f8f8f3] p-0 sm:max-w-[470px]"><SheetHeader className="border-b border-[#dbe5d6] px-6 py-5 text-left"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d9edb6] text-[#47742d]"><Bot className="h-4.5 w-4.5" /></span><div><SheetTitle className="font-editorial text-[24px] text-[#24473e]">Assistente UrbanDocs</SheetTitle><SheetDescription className="mt-1 text-[10px] leading-4 text-[#71847b]">Orienta a instrução, organização de arquivos e uso do sistema. Não substitui análise, assinatura ou decisão técnica.</SheetDescription></div></div></SheetHeader><div className="flex min-h-0 flex-1 flex-col p-4"><div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">{messages.filter((message) => message.role !== "system").map((message, index) => <div key={`${message.role}-${index}`} className={message.role === "user" ? "ml-8 rounded-2xl bg-[#234a40] px-3.5 py-3 text-[11px] leading-5 text-white" : "mr-8 rounded-2xl border border-[#dce6d5] bg-white px-3.5 py-3 text-[11px] leading-5 text-[#49635a]"}>{message.content}</div>)}{messages.length === 1 && <div className="rounded-2xl border border-[#dce6d5] bg-white px-3.5 py-3 text-[11px] leading-5 text-[#49635a]">Posso orientar sobre documentos, bases territoriais, revisão, aprovação ou assinatura.</div>}{chat.isPending && <div className="mr-8 rounded-2xl border border-[#dce6d5] bg-white px-3.5 py-3 text-[10px] text-[#6f8279]">Analisando…</div>}</div><div className="mt-4 rounded-xl border border-[#dbe5d6] bg-white p-2"><Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Pergunte sobre o fluxo, modelos ou conferência..." className="min-h-20 border-0 bg-transparent p-2 text-[11px] shadow-none focus-visible:ring-0" /><div className="flex justify-end"><Button onClick={sendMessage} disabled={!draft.trim() || chat.isPending} className="h-8 rounded-lg bg-[#426f2c] px-3 text-[10px] hover:bg-[#345d24]"><Send className="mr-1.5 h-3.5 w-3.5" />Enviar</Button></div></div></div></SheetContent></Sheet>;
}
