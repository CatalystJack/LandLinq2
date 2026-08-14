import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Send, 
  Loader2, 
  Building2,
  TrendingUp,
  Users,
  BarChart3,
  Plus,
  Paperclip,
  FileText,
  X,
  Sparkles,
  Lightbulb,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: { name: string; type: string; content: string }[];
}

interface FileAttachment {
  name: string;
  type: string;
  content: string;
  size: number;
}

const EXAMPLE_PROMPTS = [
  { icon: Building2, title: "High Priority Deals", description: "Ready for review", text: "What are my highest priority deals right now?" },
  { icon: TrendingUp, title: "Top Performing MSAs", description: "Rent PSF leaders", text: "Which MSAs have the best rent per square foot?" },
  { icon: BarChart3, title: "BTR Pipeline", description: "Build-to-rent deals", text: "Show me all BTR and townhome deals in my pipeline" },
  { icon: Users, title: "Active Brokers", description: "Top submitters", text: "Who are my most active brokers and what markets do they cover?" },
  { icon: Lightbulb, title: "Rejection Patterns", description: "Common issues", text: "What are the most common reasons deals get rejected?" },
  { icon: MapPin, title: "Southeast Markets", description: "Regional focus", text: "Which states have the most deals in the pipeline?" },
];

export default function AIInsights() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    }
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
          variant: "destructive"
        });
        continue;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setAttachments(prev => [...prev, {
          name: file.name,
          type: file.type,
          content: content,
          size: file.size
        }]);
      };

      if (file.type.startsWith('text/') || file.type === 'application/json' || 
          file.name.endsWith('.csv') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const [isStreaming, setIsStreaming] = useState(false);
  
  // Streaming chat function for faster responses
  const streamChat = async (data: { message: string; attachments: FileAttachment[] }) => {
    setIsStreaming(true);
    
    // Add placeholder assistant message that will be updated as stream arrives
    const assistantId = `assistant-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date()
    }]);
    
    try {
      console.log("[TRUSS-FE] Starting stream request...");
      const requestBody = {
        message: data.message,
        attachments: data.attachments.map(a => ({ name: a.name, type: a.type, content: a.content })),
        conversationHistory: messages.slice(-10).map(m => ({
          role: m.role,
          content: m.content
        }))
      };
      console.log("[TRUSS-FE] Request body:", { messageLength: data.message.length, attachments: requestBody.attachments.length, history: requestBody.conversationHistory.length });
      
      const response = await fetch("/api/ai-chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(requestBody)
      });
      
      console.log("[TRUSS-FE] Response status:", response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error("Failed to start stream");
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      
      if (!reader) throw new Error("No reader available");
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.content) {
                fullContent += parsed.content;
                // Update the assistant message with streaming content
                setMessages(prev => prev.map(m => 
                  m.id === assistantId ? { ...m, content: fullContent } : m
                ));
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (parseError) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }
      
      // If no content was received, show fallback message
      console.log("[TRUSS-FE] Stream completed with fullContent length:", fullContent.length);
      if (!fullContent) {
        console.log("[TRUSS-FE] No content received - showing error message");
        setMessages(prev => prev.map(m => 
          m.id === assistantId ? { ...m, content: "I couldn't generate a response. Please try again." } : m
        ));
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to get response",
        variant: "destructive"
      });
      // Remove the failed assistant message
      setMessages(prev => prev.filter(m => m.id !== assistantId));
    } finally {
      setIsStreaming(false);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputValue.trim() && attachments.length === 0) || isStreaming) return;

    const messageContent = inputValue.trim() || 
      (attachments.length > 0 ? `Please analyze the attached file${attachments.length > 1 ? 's' : ''}: ${attachments.map(a => a.name).join(', ')}` : '');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageContent,
      timestamp: new Date(),
      attachments: attachments.length > 0 ? attachments.map(a => ({ name: a.name, type: a.type, content: a.content })) : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    // Use streaming for faster responses
    streamChat({ message: messageContent, attachments });
    setInputValue("");
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleExampleClick = (prompt: string) => {
    setInputValue(prompt);
    textareaRef.current?.focus();
  };

  const clearChat = () => {
    setMessages([]);
    setAttachments([]);
  };

  return (
    <>
      <SEO 
        title="Truss | LandLinq"
        description="Chat with Truss AI to explore your deal data, comps, and market insights"
      />
      <div className="min-h-screen bg-white flex flex-col">
        <Navigation />
        
        <main className="flex-1 flex flex-col">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
              <div className="max-w-4xl w-full">
                <div className="text-center mb-8">
                  <h1 className="text-4xl font-bold text-[#07172A] mb-3">Welcome to Truss</h1>
                  <p className="text-gray-600 text-lg max-w-xl mx-auto">
                    Hi, my name is Truss! I have access to all your deal data, HelloData comparables, broker information, and market analytics. Ask questions as if you were analyzing your own portfolio. If you need ideas on where to start, use the prompts below.
                  </p>
                </div>

                <div className="bg-gray-100 rounded-2xl p-4 mb-8 border border-gray-200">
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm text-gray-700 border border-gray-300">
                          <FileText className="h-4 w-4" />
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <button onClick={() => removeAttachment(index)} className="text-gray-400 hover:text-gray-600">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <Textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Message Truss..."
                      className="flex-1 min-h-[24px] max-h-[200px] bg-transparent border-0 text-gray-900 placeholder:text-gray-500 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                      rows={1}
                      disabled={isStreaming}
                    />
                    <div className="flex items-center gap-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".txt,.csv,.json,.md,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 h-10 w-10 rounded-full"
                      >
                        <Paperclip className="h-5 w-5" />
                      </Button>
                      <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={(!inputValue.trim() && attachments.length === 0) || isStreaming}
                        className="bg-[#4A90E2] hover:bg-[#07172A] text-white h-10 w-10 rounded-full p-0 transition-all duration-200"
                      >
                        {isStreaming ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {EXAMPLE_PROMPTS.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => handleExampleClick(prompt.text)}
                      className="flex items-start gap-3 p-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-left transition-colors group shadow-sm hover:border-[#4A90E2]"
                    >
                      <prompt.icon className="h-5 w-5 text-[#4A90E2] flex-shrink-0 mt-0.5" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-[#07172A]">{prompt.title}</span>
                        <span className="text-xs text-gray-500">{prompt.description}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#4A90E2]" />
                  <span className="font-medium text-[#07172A]">Truss</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearChat}
                  className="text-[#4A90E2] hover:text-[#07172A] hover:bg-gray-100 font-medium"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New chat
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="space-y-6">
                  {messages.map((message) => (
                    <div key={message.id} className="space-y-2">
                      <div className={cn(
                        "flex gap-4",
                        message.role === "user" ? "justify-end" : "justify-start"
                      )}>
                        {message.role === "assistant" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4A90E2] flex items-center justify-center">
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[85%] rounded-2xl px-4 py-3",
                          message.role === "user"
                            ? "bg-[#07172A] text-white"
                            : "bg-transparent text-[#07172A]"
                        )}>
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {message.attachments.map((att, idx) => (
                                <div key={idx} className="flex items-center gap-1 bg-gray-200 rounded px-2 py-1 text-xs text-gray-600">
                                  <FileText className="h-3 w-3" />
                                  {att.name}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{message.content}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isStreaming && (
                    <div className="flex gap-4 justify-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4A90E2] flex items-center justify-center">
                        <Sparkles className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-[#07172A] flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-[#4A90E2]" />
                        <span className="text-sm">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="p-4 border-t border-gray-200">
                <div className="bg-gray-100 rounded-2xl p-4 border border-gray-200">
                  {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm text-gray-700 border border-gray-300">
                          <FileText className="h-4 w-4" />
                          <span className="max-w-[150px] truncate">{file.name}</span>
                          <button onClick={() => removeAttachment(index)} className="text-gray-400 hover:text-gray-600">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-end gap-2">
                    <Textarea
                      ref={textareaRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Message Truss..."
                      className="flex-1 min-h-[24px] max-h-[200px] bg-transparent border-0 text-gray-900 placeholder:text-gray-500 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                      rows={1}
                      disabled={isStreaming}
                    />
                    <div className="flex items-center gap-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".txt,.csv,.json,.md,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 h-10 w-10 rounded-full"
                      >
                        <Paperclip className="h-5 w-5" />
                      </Button>
                      <Button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={(!inputValue.trim() && attachments.length === 0) || isStreaming}
                        className="bg-[#4A90E2] hover:bg-[#07172A] text-white h-10 w-10 rounded-full p-0 transition-all duration-200"
                      >
                        {isStreaming ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
