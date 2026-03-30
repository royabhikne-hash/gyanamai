import { Link } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";

const TermsConditions = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">Gyanam AI</span>
            </div>
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="edu-card p-6 md:p-8">
          <h1 className="text-3xl font-bold mb-2">Terms & Conditions</h1>
          <p className="text-muted-foreground mb-8">Last Updated: December 2024</p>
          
          <div className="prose prose-sm max-w-none space-y-6 text-foreground">
            <p className="text-lg">
              Welcome to <strong>Gyanam AI</strong>.
              <br />
              By using this application, you agree to the following Terms & Conditions. If you do not agree, do not use the app.
            </p>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">1. Purpose of the App</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Gyanam AI is a study support and monitoring platform, not a replacement for school, teachers, or coaching.</li>
                <li>The AI helps students study, track effort, identify weak/strong areas, and generate progress summaries.</li>
                <li>The app does not guarantee marks, ranks, or results.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">2. Eligibility</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>The app is intended for school students.</li>
                <li>Students under 18 must use the app with parental awareness.</li>
                <li>Schools may onboard students using school-provided credentials.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">3. User Accounts</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Each student must use their own account.</li>
                <li>Sharing login credentials is not allowed.</li>
                <li>Schools have access only to students who select that school during signup.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">4. AI Usage Disclaimer</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>AI responses are generated automatically and may not always be 100% accurate.</li>
                <li>AI guidance is for learning assistance only, not professional advice.</li>
                <li>You agree that decisions made based on AI responses are your own responsibility.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">5. Data Collection & Usage</h2>
              <p className="text-muted-foreground mb-2">We may collect:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
                <li>Name, class, school name</li>
                <li>Study activity data (time, topics, performance)</li>
                <li>Uploaded photos (notes/homework)</li>
                <li>Chat messages with AI</li>
              </ul>
              <p className="text-muted-foreground mb-2">This data is used only for:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
                <li>Improving learning experience</li>
                <li>Generating student reports</li>
                <li>Showing dashboards to schools (only relevant students)</li>
              </ul>
              <p className="font-semibold text-foreground">We do not sell personal data.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">6. School & Parent Reports</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Study reports may be shared with schools and parents.</li>
                <li>WhatsApp or other report features are informational only.</li>
                <li>Delays or failures in report delivery are possible during testing phases.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">7. Content Rules</h2>
              <p className="text-muted-foreground mb-2">You must NOT:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
                <li>Upload illegal, abusive, or harmful content</li>
                <li>Misuse AI for cheating, harassment, or spam</li>
                <li>Try to break, hack, or overload the system</li>
              </ul>
              <p className="font-semibold text-destructive">Violation = account suspension or termination.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">8. Availability & Changes</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>The app is provided on an "as-is" basis.</li>
                <li>Features may change, break, or be removed anytime.</li>
                <li>Downtime or bugs may occur, especially in free or trial phases.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">9. Payments & Trials (If Applicable)</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>Some features may be free, trial-based, or paid.</li>
                <li>Fees (if introduced) are non-refundable unless stated otherwise.</li>
                <li>Pricing and limits may change with notice.</li>
              </ul>
              <p className="text-sm text-muted-foreground italic">(Current version may not include payments.)</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">10. Account Termination</h2>
              <p className="text-muted-foreground mb-2">We reserve the right to:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Suspend or delete accounts violating rules</li>
                <li>Restrict access for misuse or abuse</li>
                <li>Remove inactive or fake accounts</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">11. Limitation of Liability</h2>
              <p className="text-muted-foreground mb-2">Gyanam AI is not responsible for:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground mb-3">
                <li>Exam results</li>
                <li>Academic decisions</li>
                <li>Technical losses or data issues beyond reasonable control</li>
              </ul>
              <p className="font-semibold text-foreground">Use the app responsibly.</p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">12. Changes to Terms</h2>
              <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                <li>These Terms may be updated anytime.</li>
                <li>Continued use of the app means you accept the updated terms.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-foreground mb-3">13. Contact</h2>
              <p className="text-muted-foreground">
                For support or issues: Email: <a href="mailto:royabhiy@gmail.com" className="text-primary hover:underline">royabhiy@gmail.com</a>
              </p>
            </section>

            <div className="mt-8 p-4 bg-primary/10 rounded-xl border border-primary/20">
              <p className="text-center font-semibold text-foreground">
                "By continuing, you agree to the Terms & Conditions of Gyanam AI."
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TermsConditions;
