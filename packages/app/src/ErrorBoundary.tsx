import { Component, type ErrorInfo, type ReactNode } from "react";
import { log } from "./log";

// A blank screen with no console output is the worst failure mode: there is
// nothing to act on. This boundary turns any render-time throw below it into a
// visible, copyable error panel AND a console.error, so the page is never
// silently blank. Styling is inline so a broken stylesheet can't hide the panel.

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the full diagnostic in the console for DevTools / log capture.
    log.error("render error:", error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          margin: "2rem auto",
          maxWidth: "48rem",
          padding: "1.5rem",
          border: "1px solid #ef4444",
          borderRadius: "0.5rem",
          background: "#fef2f2",
          color: "#7f1d1d",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
          fontSize: "0.875rem",
          lineHeight: 1.5,
        }}
      >
        <strong style={{ display: "block", marginBottom: "0.5rem" }}>
          Roughdraft hit a render error
        </strong>
        <div style={{ marginBottom: "0.75rem" }}>{error.message}</div>
        {error.stack ? (
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", margin: 0 }}>
            {error.stack}
          </pre>
        ) : null}
        <div style={{ marginTop: "0.75rem", color: "#991b1b" }}>
          Full details are in the browser console. Reload the page (Cmd+Shift+R)
          after fixing, or report this with the message above.
        </div>
      </div>
    );
  }
}
