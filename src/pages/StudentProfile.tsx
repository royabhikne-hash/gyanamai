import { useState, useEffect } from "react";
import BottomNavBar from "@/components/BottomNavBar";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, User, Phone, Save, Loader2, Key, Camera, Share2, Copy, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import DailyUsageWidget from "@/components/DailyUsageWidget";
import SubscriptionCard from "@/components/SubscriptionCard";

interface StudentData {
  id: string;
  full_name: string;
  phone: string;
  parent_whatsapp: string;
  class: string;
  age: number;
  board: string;
  district: string;
  state: string;
  photo_url: string | null;
  school_id: string | null;
  is_approved: boolean;
  created_at: string;
}

const StudentProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const { language } = useLanguage();
  
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [parentLink, setParentLink] = useState("");
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  
  const [formData, setFormData] = useState({
    phone: "",
    parent_whatsapp: "",
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }

    if (user) {
      loadStudentData();
    }
  }, [user, loading, navigate]);

  const loadStudentData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: student, error } = await supabase
        .from("students")
        .select("*, schools(name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (student) {
        setStudentData(student as StudentData);
        setFormData({
          phone: student.phone || "",
          parent_whatsapp: student.parent_whatsapp || "",
        });
        setSchoolName((student.schools as any)?.name || "Not assigned");
        
        // Load existing parent access token
        const { data: tokenData } = await supabase
          .from("parent_access_tokens")
          .select("token")
          .eq("student_id", student.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        
        if (tokenData) {
          const baseUrl = window.location.origin;
          setParentLink(`${baseUrl}/parent-view?token=${tokenData.token}`);
        }
      }
    } catch (error) {
      console.error("Error loading student data:", error);
      toast({
        title: "Error",
        description: "Failed to load profile data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!studentData) return;
    
    // Basic validation
    if (!formData.phone || !formData.parent_whatsapp) {
      toast({
        title: language === 'en' ? "Required fields" : "ज़रूरी फ़ील्ड",
        description: language === 'en' ? "Phone and Parent WhatsApp are required." : "फ़ोन और पेरेंट व्हाट्सएप ज़रूरी हैं।",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          phone: formData.phone,
          parent_whatsapp: formData.parent_whatsapp,
        })
        .eq("id", studentData.id);

      if (error) throw error;

      toast({
        title: language === 'en' ? "Profile Updated!" : "प्रोफाइल अपडेट हो गया!",
        description: language === 'en' ? "Your changes have been saved." : "आपके बदलाव सेव हो गए।",
      });
      
      // Refresh data
      loadStudentData();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!studentData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="edu-card p-8 text-center max-w-md">
          <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-xl font-bold mb-2">Profile Not Found</h1>
          <p className="text-muted-foreground mb-4">
            No student profile found for this account.
          </p>
          <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16 sm:pb-0">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <img 
                  src="/logo.png" 
                  alt="Gyanam AI" 
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain"
                />
                <div>
                  <h1 className="font-bold text-lg">
                    {language === 'en' ? 'My Profile' : 'मेरी प्रोफाइल'}
                  </h1>
                  <p className="text-xs text-muted-foreground">{studentData.full_name}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Profile Photo & Basic Info */}
        <div className="edu-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl overflow-hidden bg-muted flex items-center justify-center border-2 border-border">
                {studentData.photo_url ? (
                  <img 
                    src={studentData.photo_url} 
                    alt={studentData.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold">{studentData.full_name}</h2>
              <p className="text-muted-foreground">{studentData.class} • Age {studentData.age}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {studentData.board} • {studentData.district}, {studentData.state}
              </p>
              <div className="mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  studentData.is_approved 
                    ? 'bg-accent/20 text-accent' 
                    : 'bg-warning/20 text-warning'
                }`}>
                  {studentData.is_approved ? '✓ Approved' : '⏳ Pending Approval'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Usage & Subscription Plan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <DailyUsageWidget studentId={studentData.id} />
          <SubscriptionCard studentId={studentData.id} onRefresh={loadStudentData} />
        </div>

        {/* School Info (Read-only) */}
        <div className="edu-card p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              📚
            </span>
            {language === 'en' ? 'School Information' : 'स्कूल की जानकारी'}
          </h3>
          <div className="bg-secondary/30 rounded-xl p-4">
            <p className="font-medium">{schoolName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {language === 'en' ? 'Contact your school admin to change school.' : 'स्कूल बदलने के लिए स्कूल एडमिन से संपर्क करें।'}
            </p>
          </div>
        </div>

        {/* Editable Contact Info */}
        <div className="edu-card p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Phone className="w-4 h-4 text-primary" />
            </span>
            {language === 'en' ? 'Contact Information' : 'संपर्क जानकारी'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone">
                {language === 'en' ? 'Your Phone Number' : 'आपका फ़ोन नंबर'}
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="Your phone number"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="parent_whatsapp">
                {language === 'en' ? 'Parent WhatsApp Number' : 'पेरेंट व्हाट्सएप नंबर'}
              </Label>
              <Input
                id="parent_whatsapp"
                name="parent_whatsapp"
                type="tel"
                value={formData.parent_whatsapp}
                onChange={handleInputChange}
                placeholder="Parent's WhatsApp number"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {language === 'en' 
                  ? 'Weekly reports will be sent to this number' 
                  : 'इस नंबर पर हफ्ते की रिपोर्ट भेजी जाएगी'}
              </p>
            </div>

            <Button 
              onClick={handleSave} 
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {language === 'en' ? 'Saving...' : 'सेव हो रहा है...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {language === 'en' ? 'Save Changes' : 'बदलाव सेव करें'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Share with Parents */}
        <div className="edu-card p-6 mb-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-primary" />
            </span>
            Share with Parents
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate a read-only link for your parents to track your study progress. They won't see your chat conversations.
          </p>
          
          {parentLink ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input value={parentLink} readOnly className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(parentLink);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2000);
                  }}
                >
                  {linkCopied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Share this link with your parents via WhatsApp or SMS.</p>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={async () => {
                if (!studentData) return;
                setIsGeneratingLink(true);
                try {
                  const { data: token, error } = await supabase
                    .from("parent_access_tokens")
                    .insert({ student_id: studentData.id })
                    .select("token")
                    .single();
                  
                  if (error) throw error;
                  const baseUrl = window.location.origin;
                  setParentLink(`${baseUrl}/parent-view?token=${token.token}`);
                } catch (err) {
                  console.error("Error generating link:", err);
                  toast({ title: "Error", description: "Failed to generate link.", variant: "destructive" });
                } finally {
                  setIsGeneratingLink(false);
                }
              }}
              disabled={isGeneratingLink}
            >
              {isGeneratingLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
              Generate Parent Link
            </Button>
          )}
        </div>

        {/* Password Change */}
        <div className="edu-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="w-4 h-4 text-primary" />
            </span>
            {language === 'en' ? 'Security' : 'सुरक्षा'}
          </h3>
          
          <p className="text-sm text-muted-foreground mb-4">
            {language === 'en' 
              ? 'Want to change your password? Use the forgot password flow.' 
              : 'पासवर्ड बदलना चाहते हैं? फॉरगॉट पासवर्ड का उपयोग करें।'}
          </p>
          
          <Link to="/forgot-password">
            <Button variant="outline" className="w-full sm:w-auto">
              <Key className="w-4 h-4 mr-2" />
              {language === 'en' ? 'Change Password' : 'पासवर्ड बदलें'}
            </Button>
          </Link>
        </div>

        {/* Account Info */}
        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            {language === 'en' ? 'Account created on' : 'अकाउंट बनाया गया'}: {new Date(studentData.created_at).toLocaleDateString('en-IN')}
          </p>
          <p className="mt-1">
            Email: {user?.email}
          </p>
        </div>
      </main>
      <BottomNavBar />
    </div>
  );
};

export default StudentProfile;
