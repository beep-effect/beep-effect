import {
  parseYeetReviewBodySignal,
  YeetReviewBodySignalInput,
  YeetReviewBodyThreadLocation,
  yeetReviewBodyAdvisoryCount,
} from "@beep/repo-cli/test/Yeet";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as O from "effect/Option";

const readFixture = Effect.fnUntraced(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(new URL(`./fixtures/pr-review-bodies/${name}`, import.meta.url).pathname);
});

const fixture = (name: string): Promise<string> =>
  Effect.runPromise(
    Effect.scoped(
      Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => readFixture(name).pipe(Effect.provide(context))))
    )
  );

// Real bodies captured from PR #1184: a CodeRabbit review and two
// Greptile-format reviews the operator wrote from their own account.
const CODERABBIT_BODY = await fixture("coderabbit-actionable-2.md");
const GREPTILE_R2_BODY = await fixture("greptile-format-r2.md");
const GREPTILE_R8_BODY = await fixture("greptile-format-r8.md");

const signal = (authorLogin: string, body: string) =>
  parseYeetReviewBodySignal(YeetReviewBodySignalInput.make({ authorLogin, body }));

const location = (path: string, line?: number) =>
  YeetReviewBodyThreadLocation.make({ path, line: line === undefined ? O.none() : O.some(line) });

describe("review body signal parsing", () => {
  it("reads CodeRabbit's actionable count and located findings", () => {
    const parsed = signal("coderabbitai[bot]", CODERABBIT_BODY);

    expect(parsed.signal).toBe("coderabbit");
    if (parsed.signal !== "coderabbit") {
      return;
    }
    expect(parsed.actionable).toBe(2);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items.map((item) => item.path)).toEqual([
      "packages/tooling/tool/cli/src/commands/Yeet/internal/ProofShadow.ts",
      "packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts",
    ]);
    expect(parsed.items.map((item) => O.getOrNull(item.line))).toEqual([410, 1146]);
    expect(parsed.nitpicks).toBe(0);
    expect(parsed.outsideDiff).toBe(0);
  });

  it("recognises CodeRabbit by either of its login spellings", () => {
    // GitHub reports `coderabbitai[bot]` on a review and `coderabbitai` on a
    // comment author; a parser that knew only one would read half the stream
    // as unstructured prose.
    expect(signal("coderabbitai", CODERABBIT_BODY).signal).toBe("coderabbit");
    expect(signal("CodeRabbitAI[bot]", CODERABBIT_BODY).signal).toBe("coderabbit");
  });

  it("counts nitpick and outside-diff summaries whatever emoji prefixes them", () => {
    const parsed = signal(
      "coderabbitai[bot]",
      [
        "**Actionable comments posted: 0**",
        "<summary>🧹 Nitpick comments (3)</summary>",
        "<summary>⚠️ Outside diff range comments (2)</summary>",
      ].join("\n")
    );

    expect(parsed.signal === "coderabbit" && parsed.nitpicks).toBe(3);
    expect(parsed.signal === "coderabbit" && parsed.outsideDiff).toBe(2);
  });

  it("reads a Greptile-format finding triplet and confidence", () => {
    const parsed = signal("kriegcloud", GREPTILE_R2_BODY);

    expect(parsed.signal).toBe("greptile");
    if (parsed.signal !== "greptile") {
      return;
    }
    expect(O.getOrNull(parsed.confidence)).toBe("5/5");
    expect(parsed.newFindings.p0).toBe(0);
    expect(parsed.newFindings.p1).toBe(0);
    expect(parsed.newFindings.p2).toBe(0);
  });

  it("reads a Greptile-format NEW item list when the body prints no triplet", () => {
    // The r8 body names no tool in its heading and was submitted by a human
    // account, so its confidence fraction plus its NEW marker are the only
    // evidence the format is in use.
    const parsed = signal("kriegcloud", GREPTILE_R8_BODY);

    expect(parsed.signal).toBe("greptile");
    if (parsed.signal !== "greptile") {
      return;
    }
    expect(O.getOrNull(parsed.confidence)).toBe("4/5");
    expect(parsed.newFindings.p2).toBe(1);
    expect(parsed.newFindings.p0).toBe(0);
    expect(parsed.newFindings.p1).toBe(0);
  });

  it("falls back to the shared labelled-score parser", () => {
    const parsed = signal("greptile-ai", "Score: 3/5\n**NEW:** 2×P1 — something");

    expect(parsed.signal === "greptile" && O.getOrNull(parsed.confidence)).toBe("3/5");
    expect(parsed.signal === "greptile" && parsed.newFindings.p1).toBe(2);
  });

  it("leaves a human body that merely mentions Greptile plain", () => {
    // The word in running prose is a person talking about the tool, not a body
    // written in its format. A body-wide substring test read this as a
    // Greptile review and invented a signal out of an operator's aside.
    const parsed = signal("kriegcloud", "greptile scored this 5/5, nothing new");

    expect(parsed.signal).toBe("plain");
  });

  it("takes the larger of the finding triplet and the listed NEW items", () => {
    // One round printed both notations: a standing tally line that still reads
    // zero and the item the round actually raised. Summing would double-count
    // a round that agrees with itself; trusting the triplet alone would lose
    // this P2 entirely.
    const parsed = signal(
      "kriegcloud",
      [
        "### Greptile Review (r9)",
        "",
        "**Confidence:** 4/5 · **Findings:** P0:0 P1:0 P2:0 NEW",
        "",
        "**NEW:** 1×P2 — closeout reads the first comment page only.",
      ].join("\n")
    );

    expect(parsed.signal).toBe("greptile");
    if (parsed.signal !== "greptile") {
      return;
    }
    expect(parsed.newFindings).toMatchObject({ p0: 0, p1: 0, p2: 1 });
    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(1);
  });

  it("leaves an unrecognised body plain", () => {
    const parsed = signal("kriegcloud", "Rebased onto main and pushed; checks are green.");

    expect(parsed.signal).toBe("plain");
  });
});

describe("review body advisory counting", () => {
  it("counts a CodeRabbit finding the operator has no thread for", () => {
    const parsed = signal("coderabbitai[bot]", CODERABBIT_BODY);

    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(2);
  });

  it("drops findings that already opened a review thread", () => {
    const parsed = signal("coderabbitai[bot]", CODERABBIT_BODY);

    const counted = yeetReviewBodyAdvisoryCount(parsed, [
      location("packages/tooling/tool/cli/src/commands/Yeet/internal/ProofShadow.ts", 410),
      location("packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts", 1146),
    ]);

    expect(counted).toBe(0);
  });

  it("keeps a finding whose thread sits on a different line of the same file", () => {
    const parsed = signal("coderabbitai[bot]", CODERABBIT_BODY);

    const counted = yeetReviewBodyAdvisoryCount(parsed, [
      location("packages/tooling/tool/cli/src/commands/Yeet/internal/ProofShadow.ts", 12),
      location("packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts", 1146),
    ]);

    expect(counted).toBe(1);
  });

  it("matches on path alone when either side has no line", () => {
    const parsed = signal("coderabbitai[bot]", CODERABBIT_BODY);

    const counted = yeetReviewBodyAdvisoryCount([
      location("packages/tooling/tool/cli/src/commands/Yeet/internal/ProofShadow.ts"),
      location("packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts"),
    ])(parsed);

    expect(counted).toBe(0);
  });

  it("adds nitpick and outside-diff counts no thread ever carries", () => {
    const parsed = signal(
      "coderabbitai[bot]",
      [
        "**Actionable comments posted: 0**",
        "<summary>🧹 Nitpick comments (3)</summary>",
        "<summary>Outside diff range comments (1)</summary>",
      ].join("\n")
    );

    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(4);
  });

  it("counts Greptile new findings at every severity and nothing for a clean round", () => {
    expect(yeetReviewBodyAdvisoryCount(signal("kriegcloud", GREPTILE_R8_BODY), [])).toBe(1);
    expect(yeetReviewBodyAdvisoryCount(signal("kriegcloud", GREPTILE_R2_BODY), [])).toBe(0);
  });

  it("counts nothing for a plain body", () => {
    expect(yeetReviewBodyAdvisoryCount(signal("kriegcloud", "pushed a fixup"), [])).toBe(0);
  });
});
