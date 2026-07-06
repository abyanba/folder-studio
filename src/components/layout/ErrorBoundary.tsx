/**
 * Top-level error boundary (AR-04). Catches render/lifecycle crashes so a single
 * bad element or export path can't blank the whole app with no explanation.
 * Offers Reload and Copy-error so users can recover and report.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Folder Studio crashed:", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const details = `${error.message}\n\n${error.stack ?? ""}`;
    return (
      <div className="flex h-svh w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
        <div className="max-w-md space-y-2">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            Folder Studio hit an unexpected error. Reloading usually fixes it — your
            gallery and presets are safe.
          </p>
          <p className="truncate rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {error.message}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
          <button
            type="button"
            className="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            onClick={() => void navigator.clipboard?.writeText(details)}
          >
            Copy error
          </button>
        </div>
      </div>
    );
  }
}
