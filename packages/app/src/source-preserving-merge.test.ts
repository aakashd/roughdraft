import { describe, expect, it } from "vitest";
import {
  criticMarkdownToEditorState,
  editorStateToCriticMarkdown,
} from "./critic-markup";
import {
  logicalBlocks,
  mergeSourcePreserving,
  tokenize,
} from "./source-preserving-merge";

describe("tokenize", () => {
  it("round-trips byte-for-byte", () => {
    const cases = [
      "",
      "single line",
      "a\n\nb\n",
      "# H\n\npara\n\n- x\n- y\n",
      "\n\nleading blanks\n",
      "trailing\n\n\n",
    ];
    for (const md of cases) {
      expect(
        tokenize(md)
          .flatMap((t) => t.lines)
          .join("\n"),
      ).toBe(md);
    }
  });

  it("keeps blank lines inside fenced code with the block", () => {
    const md = "intro\n\n```js\nconst a = 1;\n\nconst b = 2;\n```\n\nafter\n";
    const tokens = tokenize(md);
    expect(tokens.flatMap((t) => t.lines).join("\n")).toBe(md);
    // The fenced block (with its internal blank line) is a single block token.
    const fenceBlock = tokens.find((t) =>
      t.lines.some((l) => l.startsWith("```")),
    );
    expect(fenceBlock?.lines).toContain("");
  });
});

describe("logicalBlocks", () => {
  it("merges a loose list into a single block", () => {
    const md = "- one\n\n- two\n\n- three";
    const blocks = logicalBlocks(tokenize(md));
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe("- one\n\n- two\n\n- three");
  });

  it("does not merge a paragraph that follows a list", () => {
    const md = "- one\n- two\n\nA closing paragraph.";
    const blocks = logicalBlocks(tokenize(md));
    expect(blocks).toHaveLength(2);
    expect(blocks[1].text).toBe("A closing paragraph.");
  });
});

describe("mergeSourcePreserving", () => {
  it("returns the source verbatim when nothing changed", () => {
    const original = "# T\n\nIntro.\n\n| A | B |\n|---|---|\n| 1 | 2 |\n";
    // base is the serializer's normalized form; edited equals base (no edit).
    const base =
      "# T\n\nIntro.\n\n| A   | B   |\n| --- | --- |\n| 1   | 2   |\n";
    expect(mergeSourcePreserving(original, base, base)).toBe(original);
  });

  it("changes only the commented block, leaving the table byte-identical", () => {
    const original = [
      "# Title",
      "",
      "Intro paragraph.",
      "",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "Closing.",
      "",
    ].join("\n");
    const base = [
      "# Title",
      "",
      "Intro paragraph.",
      "",
      "| A   | B   |",
      "| --- | --- |",
      "| 1   | 2   |",
      "",
      "Closing.",
      "",
    ].join("\n");
    const edited = [
      "# Title",
      "",
      'Intro paragraph.{>>fix this<<}{id="c1"}',
      "",
      "| A   | B   |",
      "| --- | --- |",
      "| 1   | 2   |",
      "",
      "Closing.",
      "",
    ].join("\n");

    const result = mergeSourcePreserving(original, base, edited);

    // The commented paragraph is taken from `edited`...
    expect(result).toContain('Intro paragraph.{>>fix this<<}{id="c1"}');
    // ...while the untouched table keeps the author's compact formatting.
    expect(result).toContain("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(result).not.toContain("| --- | --- |");
    // Everything outside the commented block is byte-identical to the source.
    expect(result).toBe(
      original.replace(
        "Intro paragraph.",
        'Intro paragraph.{>>fix this<<}{id="c1"}',
      ),
    );
  });

  it("preserves a loose list when an unrelated block is commented", () => {
    const original = [
      "Intro.",
      "",
      "- one",
      "",
      "- two",
      "",
      "Outro.",
      "",
    ].join("\n");
    const base = ["Intro.", "", "- one", "- two", "", "Outro.", ""].join("\n");
    const edited = [
      "Intro.",
      "",
      "- one",
      "- two",
      "",
      "Outro.{>>note<<}",
      "",
    ].join("\n");

    const result = mergeSourcePreserving(original, base, edited);

    // The loose list (blank lines between items) survives verbatim.
    expect(result).toContain("- one\n\n- two");
    expect(result).toContain("Outro.{>>note<<}");
  });

  it("falls back to the editor output when the block count changes", () => {
    const original = "Para one.\n\nPara two.\n";
    const base = "Para one.\n\nPara two.\n";
    // A whole new block was added — out of scope for the in-place fix.
    const edited = "Para one.\n\nPara two.\n\nPara three.\n";
    expect(mergeSourcePreserving(original, base, edited)).toBe(edited);
  });
});

describe("mergeSourcePreserving (real serializer round-trip)", () => {
  // Uses the actual editor parse/serialize so `base` is exactly what the
  // editor produces — this is what catches block-alignment mismatches that a
  // synthetic `base` would hide.
  const source = [
    "# Triage",
    "",
    "Intro paragraph that the reviewer will comment on.",
    "",
    "| Gate | Verdict |",
    "|---|---|",
    "| 1 | CLEAR |",
    "| 2 | TRIGGERED |",
    "",
    "Guidelines:",
    "",
    "- first guideline",
    "",
    "- second guideline",
    "",
    "Closing note.",
    "",
  ].join("\n");

  it("keeps every untouched block byte-identical when one block is commented", () => {
    const parsed = criticMarkdownToEditorState(source);
    const base = editorStateToCriticMarkdown(parsed.doc, parsed.comments);

    // Simulate the editor adding an inline comment to the intro paragraph:
    // the serializer would re-emit that one block with CriticMarkup.
    const edited = base.replace(
      "Intro paragraph that the reviewer will comment on.",
      'Intro paragraph that the reviewer will comment on.{>>look here<<}{id="c1"}',
    );
    expect(edited).not.toBe(base); // guard: the replacement actually landed

    const merged = mergeSourcePreserving(source, base, edited);

    // The comment is present...
    expect(merged).toContain('{>>look here<<}{id="c1"}');
    // ...the author's compact table survived (no serializer padding)...
    expect(merged).toContain("| Gate | Verdict |\n|---|---|");
    expect(merged).not.toContain("| --- |");
    // ...the loose list kept its blank-line spacing...
    expect(merged).toContain("- first guideline\n\n- second guideline");
    // ...and the whole document equals the source with only the comment added.
    expect(merged).toBe(
      source.replace(
        "Intro paragraph that the reviewer will comment on.",
        'Intro paragraph that the reviewer will comment on.{>>look here<<}{id="c1"}',
      ),
    );
  });

  it("returns the source verbatim when the editor made no change", () => {
    const parsed = criticMarkdownToEditorState(source);
    const base = editorStateToCriticMarkdown(parsed.doc, parsed.comments);
    expect(mergeSourcePreserving(source, base, base)).toBe(source);
  });
});
