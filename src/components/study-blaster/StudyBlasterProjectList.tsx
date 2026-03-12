import { useState } from "react";
import { Plus, FolderOpen, Calendar, Sparkles, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface StudyProject {
  id: string;
  title: string;
  description: string | null;
  target_date: string | null;
  processing_status: string;
  created_at: string;
  ai_summary: string | null;
}

interface Props {
  projects: StudyProject[];
  studentId: string;
  onSelectProject: (id: string) => void;
  onRefresh: () => void;
}

const StudyBlasterProjectList = ({ projects, studentId, onSelectProject, onRefresh }: Props) => {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabase.from("study_projects").insert({
        student_id: studentId,
        title: title.trim(),
        description: description.trim() || null,
        target_date: targetDate || null,
      });
      if (error) throw error;
      toast({ title: "Project created!", description: "Start adding your study sources." });
      setTitle("");
      setDescription("");
      setTargetDate("");
      setIsOpen(false);
      onRefresh();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this project and all its sources?")) return;
    try {
      await supabase.from("study_projects").delete().eq("id", id);
      toast({ title: "Project deleted" });
      onRefresh();
    } catch {
      toast({ title: "Error deleting", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-[hsl(var(--edu-purple))] bg-clip-text text-transparent flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Study Blaster
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Create projects, upload sources, and study with AI</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 glass-card border-primary/20 hover:border-primary/40">
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-card border-primary/20">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                Create Study Project
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium text-foreground">Project Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Physics Chapter 1"
                  className="mt-1"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Description (optional)</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of what you're studying..."
                  className="mt-1"
                  maxLength={500}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-1">
                  <Calendar className="w-4 h-4" /> Target Completion Date (optional)
                </label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="mt-1"
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>
              <Button onClick={handleCreate} disabled={creating || !title.trim()} className="w-full">
                {creating ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {projects.length === 0 ? (
        <div className="glass-card p-12 text-center border-dashed border-2 border-primary/20 rounded-2xl">
          <FolderOpen className="w-16 h-16 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground">No Study Projects Yet</h3>
          <p className="text-muted-foreground mt-2">Create your first project to start studying with AI</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="glass-card p-5 rounded-2xl text-left hover:border-primary/40 transition-all duration-300 group relative hover:shadow-lg hover:shadow-primary/10 border border-primary/10"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                    {project.title}
                  </h3>
                  {project.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
                  )}
                </div>
                <button
                  onClick={(e) => handleDelete(e, project.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                {project.target_date && (
                  <span className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(project.target_date), "MMM dd, yyyy")}
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full ${
                  project.processing_status === "completed"
                    ? "bg-accent/10 text-accent"
                    : project.processing_status === "processing"
                    ? "bg-yellow-500/10 text-yellow-600"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {project.processing_status === "completed" ? "✓ Analyzed" : project.processing_status === "processing" ? "⏳ Processing" : "Ready"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudyBlasterProjectList;
