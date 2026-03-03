import React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

/**
 * React render error boundary to avoid "white screen" on runtime crashes.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    // Don't show error boundary for DOM reconciliation errors (caused by external scripts)
    const msg = error?.message || "";
    if (msg.includes("removeChild") || msg.includes("insertBefore") || msg.includes("not a child")) {
      return { hasError: false };
    }
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    const msg = error instanceof Error ? error.message : "";
    if (msg.includes("removeChild") || msg.includes("insertBefore") || msg.includes("not a child")) {
      console.warn("Suppressed DOM reconciliation error in ErrorBoundary");
      return;
    }
    console.error("App crashed:", error, info);
  }

  private goToDashboard = () => {
    try {
      window.history.replaceState({}, "", "/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
      this.setState({ hasError: false });
    } catch (err) {
      console.error("ErrorBoundary navigation failed:", err);
    }
  };

  private retry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The app encountered an error. You can retry or go to the dashboard.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={this.retry}>
              Retry
            </Button>
            <Button variant="outline" onClick={this.goToDashboard}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

export default AppErrorBoundary;
