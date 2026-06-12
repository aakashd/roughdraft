import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import { escapeHtml } from "@/lib/utils";
import { App } from "./App";
import { ErrorBoundary } from "./ErrorBoundary";
import { log } from "./log";
import { applyReadingWidth, readStoredReadingWidth } from "./reading-width";
import "./style.css";

// Flips to true once React has mounted. The fatal handlers below use it to
// decide whether to take over #root: before mount, an error means the page is
// blank and we should paint a reason into it; after mount, React owns the DOM
// (and the ErrorBoundary covers render errors), so we only log.
let reactMounted = false;

// Last-resort visibility: if anything throws before/around React mounts, the
// page would otherwise go silently blank. Surface it in #root so a blank screen
// always carries a reason. The ErrorBoundary handles throws *inside* the tree;
// these handlers catch throws outside it (module init, async, event handlers).
function showFatal(label: string, detail: unknown): void {
  log.error(`${label}:`, detail);
  const root = document.getElementById("root");
  if (!root || reactMounted) return; // React owns the DOM; leave it.
  const message =
    detail instanceof Error
      ? `${detail.message}\n\n${detail.stack ?? ""}`
      : String(detail);
  root.innerHTML = `<div role="alert" style="margin:2rem auto;max-width:48rem;padding:1.5rem;border:1px solid #ef4444;border-radius:.5rem;background:#fef2f2;color:#7f1d1d;font:0.875rem/1.5 ui-monospace,Menlo,Consolas,monospace"><strong>Roughdraft failed to start (${escapeHtml(label)})</strong><pre style="white-space:pre-wrap;margin:.75rem 0 0">${escapeHtml(message)}</pre></div>`;
}

window.addEventListener("error", (e) =>
  showFatal("uncaught error", e.error ?? e.message),
);
window.addEventListener("unhandledrejection", (e) =>
  showFatal("unhandled rejection", e.reason),
);

const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

function applyColorScheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

applyColorScheme(darkQuery.matches);
// Apply the persisted reading width before first paint so the column does not
// flash at the default before React mounts the toolbar control.
applyReadingWidth(readStoredReadingWidth());
darkQuery.addEventListener("change", (event) => {
  applyColorScheme(event.matches);
});

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>,
);
reactMounted = true;
