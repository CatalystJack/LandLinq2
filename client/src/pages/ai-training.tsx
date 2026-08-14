import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navigation from "@/components/navigation";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Loader2, 
  FileText, 
  Calendar, 
  Users, 
  Clock,
  Brain,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Play,
  Eye,
  Link2,
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Save,
  X,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Lightbulb,
  ArrowLeft
} from "lucide-react";

interface Transcript {
  id: string;
  title: string;
  sessionDate: string | null;
  status: "pending" | "processing" | "reviewed" | "completed";
  duration: number | null;
  participantNames: string[] | null;
  extractedDealsCount: number;
  createdAt: string;
}

interface DealMention {
  id: string;
  transcriptId: string;
  dealId: string | null;
  mentionedAddress: string | null;
  mentionedCity: string | null;
  mentionedState: string | null;
  discussionExcerpt: string | null;
  extractedPros: string[] | null;
  extractedCons: string[] | null;
  extractedRisks: string[] | null;
  extractedKeyPoints: string[] | null;
  teamDecision: string | null;
  decisionRationale: string | null;
  isVerified: boolean;
  confidenceScore: string | null;
}

interface Deal {
  id: string;
  dealNumber: number;
  address: string;
  city: string | null;
  state: string | null;
}

const STATUS_CONFIG = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-700", icon: Clock },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-700", icon: Loader2 },
  reviewed: { label: "Reviewed", color: "bg-yellow-100 text-yellow-700", icon: Eye },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
};

const DECISION_OPTIONS = [
  { value: "pursue", label: "Pursue" },
  { value: "pass", label: "Pass" },
  { value: "needs_review", label: "Needs Review" },
  { value: "high_priority", label: "High Priority" },
  { value: "tabled", label: "Tabled" },
];

function EditableList({ items, onSave, color }: { items: string[]; onSave: (items: string[]) => void; color: string }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(items.join("\n"));

  if (editing) {
    return (
      <div className="space-y-2">
        <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="text-sm min-h-[80px]"
          placeholder="One item per line"
        />
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs bg-[#4A90E2] hover:bg-[#357ABD] text-white" onClick={() => {
            onSave(editText.split("\n").map(s => s.trim()).filter(Boolean));
            setEditing(false);
          }}>
            <Save size={12} className="mr-1" /> Save
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditText(items.join("\n")); setEditing(false); }}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <ul className="space-y-1">
        {items.length > 0 ? items.map((item, i) => (
          <li key={i} className={`text-sm text-gray-700 flex items-start gap-1`}>
            <span className={`${color} mt-0.5 shrink-0`}>•</span> {item}
          </li>
        )) : (
          <li className="text-sm text-gray-400 italic">None extracted</li>
        )}
      </ul>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0"
        onClick={() => setEditing(true)}
      >
        <Edit size={12} className="mr-1" /> Edit
      </Button>
    </div>
  );
}

function MentionCard({ mention, deals, onUpdate }: { mention: DealMention; deals: Deal[]; onUpdate: (id: string, data: any) => void }) {
  const [editingDecision, setEditingDecision] = useState(false);
  const [editingRationale, setEditingRationale] = useState(false);
  const [rationale, setRationale] = useState(mention.decisionRationale || "");

  const decisionColors: Record<string, string> = {
    pursue: "bg-green-100 text-green-800 border-green-200",
    high_priority: "bg-green-100 text-green-800 border-green-200",
    pass: "bg-red-100 text-red-800 border-red-200",
    needs_review: "bg-yellow-100 text-yellow-800 border-yellow-200",
    tabled: "bg-gray-100 text-gray-800 border-gray-200",
  };

  return (
    <Card className="border border-gray-200">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-[#07172A]">
              {mention.mentionedAddress || "Unknown Property"}
            </h4>
            {(mention.mentionedCity || mention.mentionedState) && (
              <p className="text-sm text-gray-500">
                {[mention.mentionedCity, mention.mentionedState].filter(Boolean).join(", ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mention.confidenceScore && (
              <Badge variant="outline" className="text-xs">
                {Math.round(parseFloat(mention.confidenceScore) * 100)}% confidence
              </Badge>
            )}
            <Badge className={mention.isVerified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
              {mention.isVerified ? "Verified" : "Unverified"}
            </Badge>
          </div>
        </div>

        {mention.discussionExcerpt && (
          <div className="bg-gray-50 rounded-lg p-3 border text-sm text-gray-700 italic">
            "{mention.discussionExcerpt}"
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Team Decision:</span>
          {editingDecision ? (
            <div className="flex items-center gap-2">
              <Select
                value={mention.teamDecision || ""}
                onValueChange={(val) => {
                  onUpdate(mention.id, { teamDecision: val });
                  setEditingDecision(false);
                }}
              >
                <SelectTrigger className="h-8 w-40 text-sm">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {DECISION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingDecision(false)}>
                <X size={14} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Badge className={decisionColors[mention.teamDecision || ""] || "bg-gray-100 text-gray-700"}>
                {mention.teamDecision ? DECISION_OPTIONS.find(o => o.value === mention.teamDecision)?.label || mention.teamDecision : "Not set"}
              </Badge>
              <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-500 hover:text-[#4A90E2]" onClick={() => setEditingDecision(true)}>
                <Edit size={12} />
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="bg-green-50 rounded-lg p-3 border border-green-100">
            <h5 className="font-semibold text-sm text-green-700 mb-2 flex items-center gap-1">
              <ThumbsUp size={14} /> Pros
            </h5>
            <EditableList
              items={mention.extractedPros || []}
              color="text-green-500"
              onSave={(items) => onUpdate(mention.id, { extractedPros: items })}
            />
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-100">
            <h5 className="font-semibold text-sm text-yellow-700 mb-2 flex items-center gap-1">
              <AlertTriangle size={14} /> Cons
            </h5>
            <EditableList
              items={mention.extractedCons || []}
              color="text-yellow-500"
              onSave={(items) => onUpdate(mention.id, { extractedCons: items })}
            />
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-100">
            <h5 className="font-semibold text-sm text-red-700 mb-2 flex items-center gap-1">
              <AlertCircle size={14} /> Risks
            </h5>
            <EditableList
              items={mention.extractedRisks || []}
              color="text-red-500"
              onSave={(items) => onUpdate(mention.id, { extractedRisks: items })}
            />
          </div>
        </div>

        {(mention.extractedKeyPoints?.length || 0) > 0 && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <h5 className="font-semibold text-sm text-blue-700 mb-2 flex items-center gap-1">
              <Lightbulb size={14} /> Key Points
            </h5>
            <EditableList
              items={mention.extractedKeyPoints || []}
              color="text-blue-500"
              onSave={(items) => onUpdate(mention.id, { extractedKeyPoints: items })}
            />
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-600">Decision Rationale:</span>
            {!editingRationale && (
              <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-500 hover:text-[#4A90E2]" onClick={() => setEditingRationale(true)}>
                <Edit size={12} className="mr-1" /> Edit
              </Button>
            )}
          </div>
          {editingRationale ? (
            <div className="space-y-2">
              <Textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                className="text-sm min-h-[60px]"
                placeholder="Why did the team make this decision?"
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs bg-[#4A90E2] hover:bg-[#357ABD] text-white" onClick={() => {
                  onUpdate(mention.id, { decisionRationale: rationale });
                  setEditingRationale(false);
                }}>
                  <Save size={12} className="mr-1" /> Save
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setRationale(mention.decisionRationale || ""); setEditingRationale(false); }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">{mention.decisionRationale || <span className="italic text-gray-400">No rationale recorded</span>}</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Linked Deal:</span>
            {mention.dealId ? (
              <Badge variant="outline" className="text-xs">
                {deals?.find(d => d.id === mention.dealId)?.address || `Deal ${mention.dealId.slice(0, 8)}...`}
              </Badge>
            ) : (
              <span className="text-xs text-gray-400 italic">Not linked</span>
            )}
          </div>
          <div className="flex gap-2">
            {!mention.isVerified && (
              <Button
                size="sm"
                className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onUpdate(mention.id, { isVerified: true })}
              >
                <CheckCircle2 size={12} className="mr-1" /> Verify
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AITraining() {
  const { toast } = useToast();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    sessionDate: "",
    duration: "",
    participants: "",
    transcriptText: ""
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: transcripts, isLoading: transcriptsLoading } = useQuery<Transcript[]>({
    queryKey: ["/api/ai-training/transcripts"],
  });

  const { data: dealMentions, isLoading: mentionsLoading } = useQuery<DealMention[]>({
    queryKey: [`/api/ai-training/transcripts/${selectedTranscript}/mentions`],
    enabled: !!selectedTranscript,
  });

  const { data: deals } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: typeof uploadForm) => {
      const res = await apiRequest("POST", "/api/ai-training/transcripts", {
        title: data.title,
        sessionDate: data.sessionDate || null,
        duration: data.duration ? parseInt(data.duration) : null,
        participantNames: data.participants ? data.participants.split(",").map(p => p.trim()) : [],
        transcriptText: data.transcriptText
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-training/transcripts"] });
      setIsUploadOpen(false);
      setUploadForm({ title: "", sessionDate: "", duration: "", participants: "", transcriptText: "" });
      toast({ title: "Transcript uploaded", description: "Processing will start automatically..." });
      if (data?.id) {
        processMutation.mutate(data.id);
      }
    },
    onError: (error: any) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async (transcriptId: string) => {
      return apiRequest("POST", `/api/ai-training/transcripts/${transcriptId}/process`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai-training/transcripts"] });
      toast({ title: "Processing started", description: "AI is extracting deal discussions from the transcript." });
    },
    onError: (error: any) => {
      toast({ title: "Processing failed", description: error.message, variant: "destructive" });
    },
  });

  const updateMentionMutation = useMutation({
    mutationFn: async ({ mentionId, data }: { mentionId: string; data: any }) => {
      return apiRequest("PATCH", `/api/ai-training/mentions/${mentionId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-training/transcripts/${selectedTranscript}/mentions`] });
      toast({ title: "Updated", description: "Training data has been updated." });
    },
    onError: (error: any) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdateMention = (mentionId: string, data: any) => {
    updateMentionMutation.mutate({ mentionId, data });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setUploadForm(prev => ({
        ...prev,
        transcriptText: content,
        title: prev.title || file.name.replace(/\.[^/.]+$/, "")
      }));
    };
    reader.readAsText(file);
  };

  const handleSubmitUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadForm.title || !uploadForm.transcriptText) {
      toast({ title: "Missing required fields", description: "Please provide a title and transcript text.", variant: "destructive" });
      return;
    }
    uploadMutation.mutate(uploadForm);
  };

  const selectedTranscriptData = transcripts?.find(t => t.id === selectedTranscript);

  return (
    <>
      <SEO 
        title="AI Training | LandLinq"
        description="Train AI on your pipeline review sessions to automate deal analysis"
      />
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-[#07172A]">AI Training</h1>
              <p className="text-gray-600 mt-1">
                Upload pipeline review transcripts to train the AI on your team's decision-making process
              </p>
            </div>
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#4A90E2] hover:bg-[#07172A]">
                  <Plus className="h-4 w-4 mr-2" />
                  Upload Transcript
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Upload Pipeline Review Transcript</DialogTitle>
                  <DialogDescription>
                    Upload a transcript from a pipeline review session. The AI will extract deal discussions, pros/cons, and team decisions.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitUpload} className="space-y-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                    <Input
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="e.g., Weekly Pipeline Review - Jan 15, 2026"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Session Date</label>
                      <Input
                        type="date"
                        value={uploadForm.sessionDate}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, sessionDate: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                      <Input
                        type="number"
                        value={uploadForm.duration}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, duration: e.target.value }))}
                        placeholder="60"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Participants</label>
                    <Input
                      value={uploadForm.participants}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, participants: e.target.value }))}
                      placeholder="John, Sarah, Mike (comma-separated)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Transcript *</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".txt,.md,.vtt,.srt"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload File
                        </Button>
                        <span className="text-sm text-gray-500">or paste below</span>
                      </div>
                      <Textarea
                        value={uploadForm.transcriptText}
                        onChange={(e) => setUploadForm(prev => ({ ...prev, transcriptText: e.target.value }))}
                        placeholder="Paste your transcript here... Include speaker names and timestamps if available."
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={uploadMutation.isPending} className="bg-[#4A90E2] hover:bg-[#07172A]">
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload & Process
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {selectedTranscript && selectedTranscriptData ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="ghost" className="text-[#4A90E2] hover:bg-blue-50" onClick={() => setSelectedTranscript(null)}>
                  <ArrowLeft size={16} className="mr-1" /> Back to Transcripts
                </Button>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-[#4A90E2]" />
                        {selectedTranscriptData.title}
                      </CardTitle>
                      <CardDescription className="mt-1 flex items-center gap-4">
                        {selectedTranscriptData.sessionDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(selectedTranscriptData.sessionDate).toLocaleDateString()}
                          </span>
                        )}
                        {selectedTranscriptData.duration && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {selectedTranscriptData.duration} min
                          </span>
                        )}
                        {selectedTranscriptData.participantNames?.length ? (
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {selectedTranscriptData.participantNames.join(", ")}
                          </span>
                        ) : null}
                      </CardDescription>
                    </div>
                    <Badge className={STATUS_CONFIG[selectedTranscriptData.status].color}>
                      {STATUS_CONFIG[selectedTranscriptData.status].label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <h3 className="font-semibold text-[#07172A] mb-3">
                    Extracted Deal Discussions ({dealMentions?.length || 0})
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    These are the deals the AI identified in this transcript. You can edit the extracted data to correct any mistakes - this improves future AI analysis.
                  </p>

                  {mentionsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-[#4A90E2]" />
                    </div>
                  ) : !dealMentions?.length ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <Brain className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No deal discussions extracted from this transcript yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {dealMentions.map((mention) => (
                        <MentionCard
                          key={mention.id}
                          mention={mention}
                          deals={deals || []}
                          onUpdate={handleUpdateMention}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="h-5 w-5 text-[#4A90E2]" />
                      Uploaded Transcripts
                    </CardTitle>
                    <CardDescription>
                      {transcripts?.length || 0} transcript{transcripts?.length !== 1 ? 's' : ''} uploaded. Click a transcript to view and edit extracted deal discussions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {transcriptsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-[#4A90E2]" />
                      </div>
                    ) : !transcripts?.length ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No transcripts yet</h3>
                        <p className="text-gray-500 mb-4">
                          Upload your first pipeline review transcript to start training the AI
                        </p>
                        <Button onClick={() => setIsUploadOpen(true)} className="bg-[#4A90E2] hover:bg-[#07172A]">
                          <Plus className="h-4 w-4 mr-2" />
                          Upload Transcript
                        </Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {transcripts.map((transcript) => {
                          const StatusIcon = STATUS_CONFIG[transcript.status].icon;
                          return (
                            <div
                              key={transcript.id}
                              className="py-4 first:pt-0 last:pb-0 cursor-pointer hover:bg-blue-50 -mx-6 px-6 transition-colors"
                              onClick={() => setSelectedTranscript(transcript.id)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h4 className="font-medium text-[#07172A] truncate">{transcript.title}</h4>
                                    <Badge className={STATUS_CONFIG[transcript.status].color}>
                                      <StatusIcon className={`h-3 w-3 mr-1 ${transcript.status === 'processing' ? 'animate-spin' : ''}`} />
                                      {STATUS_CONFIG[transcript.status].label}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-gray-500">
                                    {transcript.sessionDate && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {new Date(transcript.sessionDate).toLocaleDateString()}
                                      </span>
                                    )}
                                    {transcript.duration && (
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" />
                                        {transcript.duration} min
                                      </span>
                                    )}
                                    {transcript.participantNames?.length ? (
                                      <span className="flex items-center gap-1">
                                        <Users className="h-3.5 w-3.5" />
                                        {transcript.participantNames.length} participants
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 ml-4">
                                  {transcript.extractedDealsCount > 0 && (
                                    <Badge variant="secondary">
                                      {transcript.extractedDealsCount} deals extracted
                                    </Badge>
                                  )}
                                  {transcript.status === "pending" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        processMutation.mutate(transcript.id);
                                      }}
                                      disabled={processMutation.isPending}
                                    >
                                      <Play className="h-3.5 w-3.5 mr-1" />
                                      Process
                                    </Button>
                                  )}
                                  <ChevronRight className="h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-[#4A90E2]" />
                      How It Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4A90E2] text-white flex items-center justify-center text-sm font-medium">1</div>
                      <div>
                        <h4 className="font-medium text-[#07172A]">Upload Transcripts</h4>
                        <p className="text-sm text-gray-500">Upload text transcripts from Zoom, Teams, or manual notes from pipeline review sessions</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4A90E2] text-white flex items-center justify-center text-sm font-medium">2</div>
                      <div>
                        <h4 className="font-medium text-[#07172A]">AI Extraction</h4>
                        <p className="text-sm text-gray-500">AI identifies each deal discussed and extracts pros, cons, risks, and the team's decision</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4A90E2] text-white flex items-center justify-center text-sm font-medium">3</div>
                      <div>
                        <h4 className="font-medium text-[#07172A]">Review & Correct</h4>
                        <p className="text-sm text-gray-500">Click any transcript to review what the AI learned. Edit pros, cons, risks, and decisions to correct mistakes</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#4A90E2] text-white flex items-center justify-center text-sm font-medium">4</div>
                      <div>
                        <h4 className="font-medium text-[#07172A]">Auto-Analysis</h4>
                        <p className="text-sm text-gray-500">New deals get AI-generated analysis based on your team's verified patterns and decisions</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="h-5 w-5 text-[#4A90E2]" />
                      Training Stats
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-[#07172A]">{transcripts?.length || 0}</div>
                        <div className="text-xs text-gray-500">Transcripts</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-[#07172A]">
                          {transcripts?.reduce((acc, t) => acc + t.extractedDealsCount, 0) || 0}
                        </div>
                        <div className="text-xs text-gray-500">Deal Discussions</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-[#07172A]">
                          {transcripts?.filter(t => t.status === 'completed').length || 0}
                        </div>
                        <div className="text-xs text-gray-500">Verified</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-[#07172A]">
                          {transcripts?.reduce((acc, t) => acc + (t.duration || 0), 0) || 0}
                        </div>
                        <div className="text-xs text-gray-500">Minutes Analyzed</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
