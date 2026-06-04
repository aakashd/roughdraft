// Shared client for the /api/review-events/watch long-poll.
//
// The server holds the response open until a review-completed event (or its
// own timeout). With no per-request timeout the hold is indefinite, and undici
// aborts the fetch with UND_ERR_HEADERS_TIMEOUT long before the user clicks
// Done Reviewing. So we long-poll in bounded windows: each request returns
// within WATCH_POLL_WINDOW_SECONDS, and we re-arm from the last observed
// sequence until a real event arrives. An explicit timeoutSeconds caps the
// total wait; without one we wait indefinitely across windows.
//
// Both the CLI (`roughdraft watch` / the Done Reviewing wait behind `open`)
// and the MCP `roughdraft_watch_review_events` tool go through here so neither
// re-introduces the headers-timeout bug.

const WATCH_POLL_WINDOW_SECONDS = 25;

export interface WatchReviewEventsResult {
  events?: unknown[];
  timedOut?: boolean;
  nextSequence?: number;
}

export interface WatchReviewEventsOptions {
  /** Absolute project directory. */
  projectPath: string;
  /** Document path relative to the project directory. */
  path: string;
  /** Server-side batching window for coalescing events, in seconds. */
  batchWindowSeconds: number;
  /** Replay history from the start instead of waiting from now. */
  replay?: boolean;
  /** Overall wait budget in seconds; omit to wait indefinitely. */
  timeoutSeconds?: number;
}

export async function watchReviewEvents(
  fetchImpl: typeof fetch,
  serverUrl: string | URL,
  options: WatchReviewEventsOptions,
): Promise<WatchReviewEventsResult> {
  const overallDeadline =
    options.timeoutSeconds !== undefined
      ? Date.now() + options.timeoutSeconds * 1000
      : undefined;

  let fromNow = !options.replay;
  let afterSequence: number | undefined;

  while (overallDeadline === undefined || Date.now() < overallDeadline) {
    const windowSeconds =
      overallDeadline === undefined
        ? WATCH_POLL_WINDOW_SECONDS
        : Math.min(
            WATCH_POLL_WINDOW_SECONDS,
            (overallDeadline - Date.now()) / 1000,
          );

    const body: {
      projectPath: string;
      path: string;
      timeoutSeconds: number;
      batchWindowSeconds: number;
      fromNow: boolean;
      afterSequence?: number;
    } = {
      projectPath: options.projectPath,
      path: options.path,
      timeoutSeconds: windowSeconds,
      batchWindowSeconds: options.batchWindowSeconds,
      fromNow,
    };
    if (afterSequence !== undefined) {
      body.afterSequence = afterSequence;
    }

    const response = await fetchImpl(
      new URL("/api/review-events/watch", serverUrl),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout((windowSeconds + 5) * 1000),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to watch review events: ${response.status}`);
    }

    const payload = (await response.json()) as WatchReviewEventsResult;
    if (!payload.timedOut) {
      return payload;
    }

    // Window elapsed with no event — re-arm from the last observed sequence
    // (exclusive lower bound) so an event fired between windows isn't missed.
    fromNow = false;
    if (typeof payload.nextSequence === "number") {
      afterSequence = Math.max(0, payload.nextSequence - 1);
    }
  }

  // Reached only with an explicit timeoutSeconds: the overall deadline passed
  // before any review-completed event arrived.
  return { events: [], timedOut: true };
}
