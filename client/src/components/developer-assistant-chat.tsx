import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

export default function DeveloperAssistantChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextMessageId = useRef(1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const submitQuestion = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isSending) return;

    const userMessage: ChatMessage = {
      id: nextMessageId.current++,
      role: "user",
      content: trimmedQuestion,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setError(null);
    setIsSending(true);

    try {
      const response = await fetch("/api/developer-profile/me/assistant/query", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "The assistant could not answer that question.");
      }
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId.current++,
          role: "assistant",
          content: String(payload.answer || "I could not find an answer from your company data."),
        },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The assistant could not answer that question.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[70] sm:bottom-6 sm:right-6" data-testid="developer-assistant-chat">
      {isOpen && (
        <section
          className="mb-3 flex h-[min(34rem,calc(100vh-7rem))] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          aria-label="Investment Company assistant"
          data-testid="developer-assistant-panel"
        >
          <header className="flex items-center justify-between bg-[#081729] px-4 py-3 text-white">
            <div>
              <h2 className="text-sm font-semibold">Company assistant</h2>
              <p className="mt-0.5 text-xs text-slate-300">Ask about your company data</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Close company assistant"
              data-testid="button-close-developer-assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3" aria-live="polite">
            {messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                Ask about your deals, pipeline, contacts, comparable properties, or acquisition criteria.
              </div>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "rounded-br-md bg-[#0A2B4A] text-white"
                      : "rounded-bl-md border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking your company data…
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" role="alert">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={submitQuestion} className="flex items-end gap-2 border-t border-slate-200 bg-white p-3">
            <label htmlFor="developer-assistant-question" className="sr-only">Ask the company assistant</label>
            <textarea
              id="developer-assistant-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Ask a question…"
              rows={2}
              maxLength={2000}
              disabled={isSending}
              className="min-h-10 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#4A90E2] focus:ring-2 focus:ring-[#4A90E2]/20 disabled:bg-slate-100"
              data-testid="input-developer-assistant-question"
            />
            <button
              type="submit"
              disabled={!question.trim() || isSending}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0A2B4A] text-white transition-colors hover:bg-white hover:text-[#4A90E2] hover:ring-1 hover:ring-[#4A90E2] disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Send question"
              data-testid="button-send-developer-assistant"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0A2B4A] text-white shadow-xl ring-1 ring-white/20 transition-all hover:bg-white hover:text-[#4A90E2] hover:ring-[#4A90E2] focus:outline-none focus:ring-2 focus:ring-[#4A90E2] focus:ring-offset-2"
        aria-label={isOpen ? "Close company assistant" : "Open company assistant"}
        aria-expanded={isOpen}
        data-testid="button-open-developer-assistant"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}