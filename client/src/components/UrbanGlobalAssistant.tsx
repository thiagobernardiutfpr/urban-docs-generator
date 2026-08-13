import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { trpc } from "@/lib/trpc";
import { Bot, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const starter: Message[] = [{ role: "system", content: "Você é o Assistente UrbanDocs." }];

export default function UrbanGlobalAssistant() {
  const [messages, setMessages] = useState<Message[]>(starter);
  const [open, setOpen] = useState(false);
  const chat = trpc.ai.chat.useMutation({
    onSuccess: (result) => setMessages((current) => [...current, { role: "assistant", content: result.answer }]),
    onError: (error) => toast.error(error.message || "O assistente não conseguiu responder agora."),
  });

  const sendMessage = (content: string) => {
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    chat.mutate({ messages: next.filter((message): message is Message & { role: "user" | "assistant" } => message.role !== "system").slice(-10) });
  };

  return <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button type="button" size="sm" className="fixed bottom-5 right-5 z-50 h-11 rounded-full bg-[#426f2c] px-4 text-[11px] font-bold shadow-[0_12px_30px_rgba(43,79,40,.28)] hover:bg-[#345d24]"><Sparkles className="mr-2 h-4 w-4" />Assistente IA</Button></SheetTrigger><SheetContent side="right" className="w-full border-l-[#dce6d5] bg-[#f8f8f3] p-0 sm:max-w-[470px]"><SheetHeader className="border-b border-[#dbe5d6] px-6 py-5 text-left"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d9edb6] text-[#47742d]"><Bot className="h-4.5 w-4.5" /></span><div><SheetTitle className="font-editorial text-[24px] text-[#24473e]">Assistente UrbanDocs</SheetTitle><SheetDescription className="mt-1 text-[10px] leading-4 text-[#71847b]">Orienta a instrução, organização de arquivos e uso do sistema. Não substitui análise, assinatura ou decisão técnica.</SheetDescription></div></div></SheetHeader><div className="p-4"><AIChatBox messages={messages} onSendMessage={sendMessage} isLoading={chat.isPending} height="calc(100vh - 158px)" placeholder="Pergunte sobre o fluxo, modelos ou conferência..." emptyStateMessage="Como posso ajudar na instrução urbanística?" suggestedPrompts={["Quais dados são essenciais para iniciar uma certidão?", "Como adicionar um modelo DOCX oficial?", "Como revisar uma geometria no mapa?"]} /></div></SheetContent></Sheet>;
}
