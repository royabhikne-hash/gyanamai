import { useState, useRef } from "react";
import { Upload, Link2, FileText, Trash2, Loader2, StickyNote, Globe, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Source {
  id: string;
  title: string;
  source_type: string;
  file_name: string | null;
  file_size: number | null;
  web_url: string | null;
  processing_status: string;
  created_at: string;
}

interface Props {
  sources: Source[];
  projectId: string;
  studentId: string;
  onRefresh: () => void;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const StudyBlasterSourceManager = ({ sources, projectId, studentId, onRefresh }: Props) => {
  const [uploading, setUploading] = useState(false);
  const [webUrl, setWebUrl] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [processingUrl, setProcessingUrl] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_SIZE) {
          toast({ title: "File too large", description: `${file.name} exceeds 25MB limit`, variant: "destructive" });
          continue;
        }
        if (!ALLOWED_TYPES.includes(file.type) && !file.name.endsWith(".txt")) {
          toast({ title: "Unsupported file", description: `${file.name} - Only PDF, DOCX, TXT allowed`, variant: "destructive" });
          continue;
        }

        const filePath = `${studentId}/${projectId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("study-blaster-files")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("study-blaster-files")
          .getPublicUrl(filePath);

        // Read file content for text files
        let extractedContent = "";
        if (file.type === "text/plain" || file.name.endsWith(".txt")) {
          extractedContent = await file.text();
        } else {
          // For PDF/DOCX, send to AI for processing
          const { data: session } = await supabase.auth.getSession();
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-blaster`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.session?.access_token}`,
              },
              body: JSON.stringify({
                action: "process_text",
                content: `File: ${file.name} (${file.type}). Content needs to be extracted from uploaded file at ${publicUrl}`,
              }),
            }
          );
          const result = await response.json();
          extractedContent = result.extractedContent || "";
        }

        const { error } = await supabase.from("study_sources").insert({
          project_id: projectId,
          student_id: studentId,
          source_type: "file",
          title: file.name,
          file_name: file.name,
          file_url: filePath,
          file_size: file.size,
          extracted_content: extractedContent,
          processing_status: extractedContent ? "completed" : "pending",
        });

        if (error) throw error;
      }
      toast({ title: "Files uploaded!", description: "Sources added to your project." });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddUrl = async () => {
    if (!webUrl.trim()) return;
    try {
      new URL(webUrl);
    } catch {
      toast({ title: "Invalid URL", description: "Please enter a valid URL", variant: "destructive" });
      return;
    }

    setProcessingUrl(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-blaster`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({ action: "process_url", content: webUrl }),
        }
      );
      const result = await response.json();

      const { error } = await supabase.from("study_sources").insert({
        project_id: projectId,
        student_id: studentId,
        source_type: "url",
        title: new URL(webUrl).hostname,
        web_url: webUrl,
        extracted_content: result.extractedContent || "",
        processing_status: result.extractedContent ? "completed" : "failed",
      });

      if (error) throw error;
      toast({ title: "URL added!", description: "Web content extracted." });
      setWebUrl("");
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setProcessingUrl(false);
    }
  };

  const handleAddNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim()) return;
    setSavingNote(true);
    try {
      const { error } = await supabase.from("study_sources").insert({
        project_id: projectId,
        student_id: studentId,
        source_type: "note",
        title: noteTitle.trim(),
        extracted_content: noteContent.trim(),
        processing_status: "completed",
      });
      if (error) throw error;
      toast({ title: "Note added!" });
      setNoteTitle("");
      setNoteContent("");
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingNote(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from("study_sources").delete().eq("id", id);
      toast({ title: "Source removed" });
      onRefresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "url": return <Globe className="w-4 h-4 text-blue-500" />;
      case "note": return <StickyNote className="w-4 h-4 text-yellow-500" />;
      default: return <File className="w-4 h-4 text-primary" />;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        Source Library ({sources.length})
      </h3>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-3 glass-card">
          <TabsTrigger value="upload" className="gap-1 text-xs"><Upload className="w-3 h-3" /> Upload</TabsTrigger>
          <TabsTrigger value="url" className="gap-1 text-xs"><Link2 className="w-3 h-3" /> Web Link</TabsTrigger>
          <TabsTrigger value="note" className="gap-1 text-xs"><StickyNote className="w-3 h-3" /> Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          <div
            className="border-2 border-dashed border-primary/20 rounded-xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin" />
            ) : (
              <Upload className="w-8 h-8 mx-auto text-muted-foreground/50" />
            )}
            <p className="text-sm text-muted-foreground mt-2">
              {uploading ? "Uploading..." : "Click to upload PDF, DOCX, or TXT files (max 25MB)"}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            className="hidden"
            onChange={handleFileUpload}
          />
        </TabsContent>

        <TabsContent value="url" className="mt-3 space-y-3">
          <div className="flex gap-2">
            <Input
              value={webUrl}
              onChange={(e) => setWebUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="flex-1"
            />
            <Button onClick={handleAddUrl} disabled={processingUrl || !webUrl.trim()} size="sm">
              {processingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="note" className="mt-3 space-y-3">
          <Input
            value={noteTitle}
            onChange={(e) => setNoteTitle(e.target.value)}
            placeholder="Note title"
            maxLength={100}
          />
          <Textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="Type your study notes here..."
            rows={4}
            maxLength={10000}
          />
          <Button onClick={handleAddNote} disabled={savingNote || !noteTitle.trim() || !noteContent.trim()} size="sm" className="w-full">
            {savingNote ? "Saving..." : "Add Note"}
          </Button>
        </TabsContent>
      </Tabs>

      {sources.length > 0 && (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {sources.map((source) => (
            <div key={source.id} className="flex items-center justify-between p-3 glass-card rounded-xl border border-primary/5 hover:border-primary/15 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {getSourceIcon(source.source_type)}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{source.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {source.source_type === "file" && source.file_size
                      ? `${(source.file_size / 1024).toFixed(0)} KB`
                      : source.source_type === "url"
                      ? source.web_url
                      : "Note"}
                    {" • "}
                    <span className={source.processing_status === "completed" ? "text-accent" : "text-yellow-500"}>
                      {source.processing_status === "completed" ? "✓ Ready" : "⏳ Processing"}
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(source.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudyBlasterSourceManager;
