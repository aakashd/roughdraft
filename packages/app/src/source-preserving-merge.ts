/**
 * Source-preserving merge.
 *
 * Roughdraft serializes the whole editor document back to Markdown on every
 * save. That serialization normalizes formatting (table cell padding, list
 * spacing, blank lines, emphasis delimiters), so adding a single inline
 * comment rewrites the entire file with cosmetic churn — burying the real
 * review change and polluting version control.
 *
 * This module restores byte-for-byte fidelity for every block the reader did
 * NOT touch. Given:
 *   - `original` — the source as loaded, in the author's own formatting,
 *   - `base`     — the editor's serialization of that same (unchanged) source,
 *   - `edited`   — the editor's serialization of the current document,
 * it returns `original` with only the blocks that actually changed
 * (`base` ≠ `edited`) replaced by their `edited` form. `base` and `edited`
 * share the serializer's dialect, so an unchanged block compares equal while a
 * block that gained a comment/edit does not — and is taken from `edited`.
 *
 * Safety: a changed block is always emitted from `edited`, so a comment or edit
 * can never be dropped. When the block structure can't be mapped 1:1 (the
 * round-trip changed the block count, e.g. a block was added or removed), it
 * falls back to returning `edited` unchanged — exactly today's behavior, never
 * worse.
 */

interface Token {
  kind: "block" | "gap";
  lines: string[];
}

interface LogicalBlock {
  /** First token index (inclusive). */
  start: number;
  /** Last token index (inclusive); spans gaps for merged loose lists. */
  end: number;
  /** The block's text (token lines joined), used for change detection. */
  text: string;
}

const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;
const INDENTED_CONTINUATION = /^\s{2,}\S/;
const ATX_HEADING = /^ {0,3}#{1,6}(\s|$)/;

/** A chunk is "list context" if every non-blank line is a list item or an
 * indented continuation — i.e. it belongs to a (possibly loose) list. */
function isListContext(blockText: string): boolean {
  const lines = blockText.split("\n").filter((line) => line.trim().length > 0);
  return (
    lines.length > 0 &&
    lines.every(
      (line) => LIST_ITEM.test(line) || INDENTED_CONTINUATION.test(line),
    )
  );
}

/**
 * Tokenize Markdown into an exact, reversible sequence of block runs (non-blank
 * lines) and gap runs (blank lines). `tokens.flatMap(t => t.lines).join("\n")`
 * reproduces the input byte-for-byte. Blank lines inside fenced code blocks
 * stay part of the surrounding block.
 *
 * An ATX heading is always isolated as its own block. The serializer strips the
 * blank line after a heading, so without this the heading would glue to the
 * next paragraph in `base` but stay separate in the source — a phantom
 * block-count mismatch that would defeat the merge on every document.
 */
export function tokenize(markdown: string): Token[] {
  const lines = markdown.split("\n");
  const tokens: Token[] = [];
  let current: Token | null = null;
  let inFence = false;
  let fenceChar = "";

  for (const line of lines) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      const char = fence[1][0] ?? "`";
      if (!inFence) {
        inFence = true;
        fenceChar = char;
      } else if (char === fenceChar) {
        inFence = false;
      }
    }

    const isHeading = !inFence && ATX_HEADING.test(line);
    const kind: Token["kind"] =
      !inFence && line.trim().length === 0 ? "gap" : "block";
    if (isHeading) {
      // A heading is its own single-line block, regardless of neighbors.
      tokens.push({ kind: "block", lines: [line] });
      current = null;
      continue;
    }
    if (!current || current.kind !== kind) {
      current = { kind, lines: [] };
      tokens.push(current);
    }
    current.lines.push(line);
  }

  return tokens;
}

/** Text spanned by tokens[start..end], joined exactly as in the source. */
function spanText(tokens: Token[], start: number, end: number): string {
  const lines: string[] = [];
  for (let i = start; i <= end; i++) lines.push(...tokens[i].lines);
  return lines.join("\n");
}

/**
 * Group block tokens into logical blocks. Consecutive block tokens separated by
 * a single gap are merged when both are list context, so a loose list (items
 * separated by blank lines) reads as one block — matching how the serializer
 * emits it.
 */
export function logicalBlocks(tokens: Token[]): LogicalBlock[] {
  const result: LogicalBlock[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].kind !== "block") continue;
    let end = i;
    while (
      tokens[end + 1]?.kind === "gap" &&
      tokens[end + 2]?.kind === "block" &&
      isListContext(spanText(tokens, i, end)) &&
      isListContext(tokens[end + 2].lines.join("\n"))
    ) {
      end += 2;
    }
    result.push({ start: i, end, text: spanText(tokens, i, end) });
    i = end;
  }
  return result;
}

/**
 * Merge editor output back onto the original source, preserving the author's
 * formatting for every block they didn't change. See the module header for the
 * contract and safety guarantees.
 */
export function mergeSourcePreserving(
  original: string,
  base: string,
  edited: string,
): string {
  // Nothing changed in the document → return the source verbatim.
  if (base.trim() === edited.trim()) return original;

  const origTokens = tokenize(original);
  const origBlocks = logicalBlocks(origTokens);
  const baseBlocks = logicalBlocks(tokenize(base));
  const editedBlocks = logicalBlocks(tokenize(edited));

  // The fix is sound only when original, base, and edited map 1:1 by block
  // index. A differing count means a block was added or removed — out of scope
  // for the in-place fix, so fall back to the editor's full output.
  if (
    origBlocks.length !== baseBlocks.length ||
    baseBlocks.length !== editedBlocks.length
  ) {
    return edited;
  }

  // Walk the original tokens, substituting only the blocks whose serialized
  // form actually changed. Gaps (blank-line separators) are emitted verbatim,
  // so unchanged regions stay byte-for-byte identical to the source.
  const outLines: string[] = [];
  let tokenIndex = 0;
  let blockIndex = 0;
  while (tokenIndex < origTokens.length) {
    const block = origBlocks[blockIndex];
    if (block && block.start === tokenIndex) {
      const changed =
        baseBlocks[blockIndex].text.trim() !==
        editedBlocks[blockIndex].text.trim();
      if (changed) {
        outLines.push(...editedBlocks[blockIndex].text.split("\n"));
      } else {
        for (let i = block.start; i <= block.end; i++) {
          outLines.push(...origTokens[i].lines);
        }
      }
      tokenIndex = block.end + 1;
      blockIndex++;
    } else {
      // A gap between logical blocks — preserve it exactly.
      outLines.push(...origTokens[tokenIndex].lines);
      tokenIndex++;
    }
  }

  const merged = outLines.join("\n");
  // The editor's canonical serialization (`edited`) owns the file's trailing
  // newline. We follow the original's block/gap structure for unchanged
  // regions, so a source that lacked a final newline would otherwise drop the
  // one the editor always emits. Restore it — adding a trailing newline to a
  // file missing one is harmless and never loses content.
  if (edited.endsWith("\n") && !merged.endsWith("\n")) return merged + "\n";
  return merged;
}
