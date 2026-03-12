import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Sparkles, BookOpen, HelpCircle, FileText, Loader2, Calendar, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import StudyBlasterSourceManager from "./StudyBlasterSourceManager";
import StudyBlasterChat from "./StudyBlasterChat";
import { format, differenceInDays } from "date-fns";

interface Props {
  projectId: string;
  studentId: string;
  onBack: () => void;
}

const StudyBlasterDashboard = ({ projectId, studentId, onBack }: Props) => {
  const [project, setProject] = useState<any>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    const [{ data: proj }, { data: srcs }] = await Promise.all([
      supabase.from("study_projects").select("*").eq("id", projectId).single(),
      supabase.from("study_sources").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
    ]);
    setProject(proj);
    setSources(srcs || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAnalyze = async () => {
    if (sources.length === 0) {
      toast({ title: "No sources", description: "Add sources before analyzing", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    try {
      await supabase.from("study_projects").update({ processing_status: "processing" }).eq("id", projectId);
      
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-blaster`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.session?.access_token}`,
          },
          body: JSON.stringify({ action: "analyze_sources", projectId }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Analysis failed");

      toast({ title: "Analysis complete!", description: "Your study guide is ready." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      await supabase.from("study_projects").update({ processing_status: "idle" }).eq("id", projectId);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) return null;

  const daysLeft = project.target_date
    ? differenceInDays(new Date(project.target_date), new Date())
    : null;

  const keyConcepts = (project.ai_key_concepts as string[]) || [];
  const studyGuide = (project.ai_study_guide as any[]) || [];
  const faqs = (project.ai_faqs as any[]) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground">{project.title}</h2>
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
        </div>
        {daysLeft !== null && (
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            daysLeft <= 3 ? "bg-destructive/10 text-destructive" :
            daysLeft <= 7 ? "bg-yellow-500/10 text-yellow-600" :
            "bg-accent/10 text-accent"
          }`}>
            <Target className="w-3.5 h-3.5" />
            {daysLeft > 0 ? `${daysLeft} days left` : daysLeft === 0 ? "Due today!" : "Overdue"}
          </div>
        )}
      </div>

      <Tabs defaultValue="sources" className="w-full">
        <TabsList className="grid w-full grid-cols-4 glass-card h-auto p-1">
          <TabsTrigger value="sources" className="text-xs py-2 gap-1"><FileText className="w-3.5 h-3.5" /> Sources</TabsTrigger>
          <TabsTrigger value="guide" className="text-xs py-2 gap-1"><BookOpen className="w-3.5 h-3.5" /> Guide</TabsTrigger>
          <TabsTrigger value="faqs" className="text-xs py-2 gap-1"><HelpCircle className="w-3.5 h-3.5" /> FAQs</TabsTrigger>
          <TabsTrigger value="chat" className="text-xs py-2 gap-1"><Sparkles className="w-3.5 h-3.5" /> Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="mt-4 space-y-4">
          <StudyBlasterSourceManager
            sources={sources}
            projectId={projectId}
            studentId={studentId}
            onRefresh={fetchData}
          />
          <Button
            onClick={handleAnalyze}
            disabled={analyzing || sources.length === 0}
            className="w-full gap-2"
            size="lg"
          >
            {analyzing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing Sources...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {project.processing_status === "completed" ? "Re-analyze Sources" : "Analyze All Sources with AI"}</>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="guide" className="mt-4 space-y-6">
          {project.processing_status !== "completed" ? (
            <div className="text-center py-12 glass-card rounded-2xl">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Add sources and click "Analyze" to generate your study guide</p>
            </div>
          ) : (
            <>
              {/* Key Concepts */}
              {keyConcepts.length > 0 && (
                <div className="glass-card rounded-2xl p-5 border border-primary/10">
                  <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-primary" /> Key Concepts
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {keyConcepts.map((concept, i) => (
                      <span key={i} className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                        {concept}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              {project.ai_summary && (
                <div className="glass-card rounded-2xl p-5 border border-primary/10">
                  <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-primary" /> Summary
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {project.ai_summary}
                  </p>
                </div>
              )}

              {/* Study Guide */}
              {studyGuide.length > 0 && (
                <div className="glass-card rounded-2xl p-5 border border-primary/10">
                  <h3 className="font-bold text-foreground flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-primary" /> Study Guide
                  </h3>
                  <div className="space-y-3">
                    {studyGuide.map((item, i) => (
                      <div key={i} className="p-3 rounded-xl bg-background/50 border border-border/50">
                        <p className="font-semibold text-sm text-foreground">{item.topic}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Date Guidance */}
              {project.target_date && daysLeft !== null && (
                <div className={`glass-card rounded-2xl p-5 border ${
                  daysLeft <= 3 ? "border-destructive/20" : "border-accent/20"
                }`}>
                  <h3 className="font-bold text-foreground flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-primary" /> Study Timeline
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Target: {format(new Date(project.target_date), "MMMM dd, yyyy")} ({daysLeft > 0 ? `${daysLeft} days remaining` : "Due today!"})
                  </p>
                  {studyGuide.length > 0 && daysLeft > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      📋 Recommendation: Cover ~{Math.ceil(studyGuide.length / Math.max(daysLeft, 1))} topic(s) per day to finish on time.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="faqs" className="mt-4">
          {faqs.length === 0 ? (
            <div className="text-center py-12 glass-card rounded-2xl">
              <HelpCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Analyze your sources to generate FAQs</p>
            </div>
          ) : (
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <details key={i} className="glass-card rounded-xl border border-primary/10 group">
                  <summary className="p-4 cursor-pointer font-medium text-sm text-foreground flex items-center gap-2 list-none">
                    <HelpCircle className="w-4 h-4 text-primary shrink-0" />
                    {faq.question}
                  </summary>
                  <div className="px-4 pb-4 text-sm text-muted-foreground border-t border-border/30 pt-3 ml-6">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <div className="glass-card rounded-2xl p-4 border border-primary/10 h-[500px] flex flex-col">
            <StudyBlasterChat projectId={projectId} projectTitle={project.title} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudyBlasterDashboard;
