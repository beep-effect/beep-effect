import * as NodeURL from "node:url";
import {
  parseYeetReviewBodySignal,
  YeetReviewBodySignalInput,
  YeetReviewBodyThreadLocation,
  yeetReviewBodyAdvisoryCount,
  yeetReviewBodyUnthreadedItems,
} from "@beep/repo-cli/test/Yeet";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";

const readFixture = Effect.fnUntraced(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(
    NodeURL.fileURLToPath(new URL(`./fixtures/pr-review-bodies/${name}`, import.meta.url))
  );
});

const fixture = (name: string): Promise<string> =>
  NodeServices.layer.pipe(
    Layer.build,
    Effect.flatMap((context) => readFixture(name).pipe(Effect.provide(context))),
    Effect.scoped,
    Effect.runPromise
  );

// Real bodies captured from PR #1184: a CodeRabbit review and two
// Greptile-format reviews the operator wrote from their own account.
const CODERABBIT_BODY = await fixture("coderabbit-actionable-2.md");
const GREPTILE_R2_BODY = await fixture("greptile-format-r2.md");
const GREPTILE_R8_BODY = await fixture("greptile-format-r8.md");
// Real bodies in CodeRabbit's current format, trimmed of the review-info
// footer: PR #3013's single body-only nitpick, the finding that went unseen
// for five hours, and PR #3007's outside-diff finding plus a nitpick.
const CODERABBIT_NITPICK_BODY = await fixture("coderabbit-nitpick-current-format.md");
const CODERABBIT_OUTSIDE_DIFF_BODY = await fixture("coderabbit-outside-diff-current-format.md");
const NITPICK_PATH = "packages/tooling/library/agent-memory-store/src/MemoryIndexes.service.ts";

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
    expect(A.map(parsed.items, (item) => item.path)).toEqual([
      "packages/tooling/tool/cli/src/commands/Yeet/internal/ProofShadow.ts",
      "packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts",
    ]);
    expect(A.map(parsed.items, (item) => O.getOrNull(item.line))).toEqual([410, 1146]);
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
      A.join(
        [
          "**Actionable comments posted: 0**",
          "<summary>🧹 Nitpick comments (3)</summary>",
          "<summary>⚠️ Outside diff range comments (2)</summary>",
        ],
        "\n"
      )
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

  it("keeps an overflowing review count from aborting advisory parsing", () => {
    const parsed = signal("reviewer", `### Greptile Review\nP0:${Str.repeat(400)("9")} P1:0 P2:0`);

    expect(parsed.signal).toBe("greptile");
    if (parsed.signal !== "greptile") {
      return;
    }
    expect(parsed.newFindings.p0).toBe(100_000);
    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(100_000);
  });

  it("bounds accumulated review counts from repeated items", () => {
    const parsed = signal("reviewer", "### Greptile Review\n**NEW:** 99999×P1, 99999×P1");

    expect(parsed.signal === "greptile" && parsed.newFindings.p1).toBe(100_000);

    const coderabbit = signal(
      "coderabbitai[bot]",
      "**Actionable comments posted: 999999999999999999999999**\nNitpick comments (99999)\nNitpick comments (99999)"
    );
    expect(coderabbit.signal === "coderabbit" && coderabbit.actionable).toBe(100_000);
    expect(coderabbit.signal === "coderabbit" && coderabbit.nitpicks).toBe(100_000);
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
      A.join(
        [
          "### Greptile Review (r9)",
          "",
          "**Confidence:** 4/5 · **Findings:** P0:0 P1:0 P2:0 NEW",
          "",
          "**NEW:** 1×P2 — closeout reads the first comment page only.",
        ],
        "\n"
      )
    );

    expect(parsed.signal).toBe("greptile");
    if (parsed.signal !== "greptile") {
      return;
    }
    expect(parsed.newFindings).toMatchObject({ p0: 0, p1: 0, p2: 1 });
    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(1);
  });

  it("closes a fix-prompt path that names no line as a line-less item", () => {
    // A path the prompt opens and then abandons for the next one is still a
    // location the operator has not seen; it is kept with no line rather
    // than dropped, and a trailing path with no line closes the same way.
    const parsed = signal(
      "coderabbitai[bot]",
      A.join(
        [
          "**Actionable comments posted: 3**",
          "In `@src/a.ts`:",
          "In `@src/b.ts`:",
          "- Line 7: fix b",
          "In `@src/c.ts`:",
        ],
        "\n"
      )
    );

    expect(parsed.signal).toBe("coderabbit");
    if (parsed.signal !== "coderabbit") {
      return;
    }
    expect(A.map(parsed.items, (item) => [item.path, O.getOrNull(item.line)])).toEqual([
      ["src/a.ts", null],
      ["src/b.ts", 7],
      ["src/c.ts", null],
    ]);
  });

  it("ignores a line item that precedes any path", () => {
    const parsed = signal(
      "coderabbitai[bot]",
      A.join(
        ["**Actionable comments posted: 1**", "- Line 3: stray item", "In `@src/a.ts`:", "- Line 9: real item"],
        "\n"
      )
    );

    expect(parsed.signal).toBe("coderabbit");
    if (parsed.signal !== "coderabbit") {
      return;
    }
    expect(A.map(parsed.items, (item) => [item.path, O.getOrNull(item.line)])).toEqual([["src/a.ts", 9]]);
  });

  it("sums NEW items per severity when a body lists several", () => {
    const parsed = signal(
      "kriegcloud",
      A.join(["## Review", "Confidence: 3/5", "**NEW:** 1×P0, 2×P1, 3×P2", "1 x P2 more in the same round"], "\n")
    );

    expect(parsed.signal).toBe("greptile");
    if (parsed.signal !== "greptile") {
      return;
    }
    expect(parsed.newFindings).toMatchObject({ p0: 1, p1: 2, p2: 4 });
  });

  it("leaves an unrecognised body plain", () => {
    const parsed = signal("kriegcloud", "Rebased onto main and pushed; checks are green.");

    expect(parsed.signal).toBe("plain");
  });
});

const itemShape = (parsed: ReturnType<typeof signal>) =>
  parsed.signal === "coderabbit"
    ? A.map(parsed.items, (item) => [item.path, O.getOrNull(item.line), O.getOrNull(item.section)])
    : [];

describe("current CodeRabbit body format", () => {
  it("reads a colon-spelled nitpick count and one finding listed in two prompts", () => {
    // The body names the finding twice: in its own "Prompt for AI Agents" and
    // again under "Nitpick comments:" in the fix-all prompt. One finding.
    const parsed = signal("coderabbitai[bot]", CODERABBIT_NITPICK_BODY);

    expect(parsed.signal).toBe("coderabbit");
    if (parsed.signal !== "coderabbit") {
      return;
    }
    expect([parsed.actionable, parsed.nitpicks, parsed.outsideDiff, parsed.minor]).toEqual([0, 1, 0, 0]);
    expect(itemShape(parsed)).toEqual([[NITPICK_PATH, 57, "nitpick"]]);
    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(1);
  });

  it("reads quoted outside-diff findings and hard-wrapped prompt lead-ins", () => {
    const parsed = signal("coderabbitai[bot]", CODERABBIT_OUTSIDE_DIFF_BODY);

    expect(parsed.signal).toBe("coderabbit");
    if (parsed.signal !== "coderabbit") {
      return;
    }
    expect([parsed.actionable, parsed.nitpicks, parsed.outsideDiff]).toEqual([0, 1, 1]);
    expect(itemShape(parsed)).toEqual([
      ["docs/runbooks/ci-coverage-artifacts.md", 73, "outside-diff"],
      ["packages/tooling/tool/cli/src/commands/Ci/CiPartitions.command.ts", 268, "nitpick"],
    ]);
    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(2);
  });

  it("joins every observed wrap of a single-finding lead-in", () => {
    const wraps = [
      "Review comment at\n@src/a.ts at\nline 57:",
      "Review comment at @src/a.ts at line\n57:",
      "Review comment at\n@src/a.ts\nat line 57:",
      "Review comment at @src/a.ts around lines\n57 - 60:",
      "Review comment at\n@src/a.ts around lines 57\n- 60:",
    ];

    expect(
      A.map(wraps, (lead) =>
        itemShape(signal("coderabbitai[bot]", `**Actionable comments posted: 1**\n${lead}\nRename it.`))
      )
    ).toEqual(A.map(wraps, () => [["src/a.ts", 57, null]]));
  });

  it("drops a lead-in whose location never closes", () => {
    // A lead-in still open at the end of the body was not a location.
    const parsed = signal("coderabbitai[bot]", "**Actionable comments posted: 1**\nReview comment at\n@src/a.ts");

    expect(parsed.signal === "coderabbit" && parsed.actionable).toBe(1);
    expect(itemShape(parsed)).toEqual([]);
  });

  it("keeps two findings a fix-all section places on one line", () => {
    // PR #2917 listed three distinct findings at one line of one file; only
    // the second listing of a finding is a duplicate.
    const parsed = signal(
      "coderabbitai[bot]",
      A.join(
        [
          "**Actionable comments posted: 2**",
          "Review comment at @src/a.ts at line 9:",
          "Inline comments:",
          "Review comments at",
          "@src/a.ts:",
          "- Line 9: first finding",
          "- Line 9: second finding",
        ],
        "\n"
      )
    );

    expect(itemShape(parsed)).toEqual([
      ["src/a.ts", 9, "inline"],
      ["src/a.ts", 9, "inline"],
    ]);
  });

  it("does not add a body-only finding to the count that already summarises it", () => {
    const parsed = signal(
      "coderabbitai[bot]",
      A.join(
        [
          "**Actionable comments posted: 1**",
          "<summary>Minor comments: 2</summary>",
          "Inline comments:",
          "Review comments at @src/a.ts:",
          "- Line 3: threaded",
          "Minor comments:",
          "Review comments at @src/b.ts:",
          "- Line 5: first minor",
          "- Around line 8-9: second minor",
        ],
        "\n"
      )
    );

    expect(parsed.signal === "coderabbit" && parsed.minor).toBe(2);
    expect(yeetReviewBodyAdvisoryCount(parsed, [location("src/a.ts", 3)])).toBe(2);
    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(3);
  });

  it("reads a findings body it cannot parse as unparsed, never as a clean zero", () => {
    // A respelling of every marker the parser reads: the per-finding prompt is
    // still there, so the body plainly carries a finding.
    const drifted = Str.replace(
      /Review comments? at/gu,
      "Finding in"
    )(Str.replace(/Nitpick comments/gu, "Nitpicks")(CODERABBIT_NITPICK_BODY));
    const parsed = signal("coderabbitai[bot]", drifted);

    expect(parsed).toMatchObject({ signal: "coderabbit-unparsed", evidence: "fix-prompt" });
    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(1);
  });

  it("reads a positive findings summary alone as unparsed", () => {
    const parsed = signal("coderabbitai[bot]", "<summary>🧹 Trivial comments: 2</summary>");

    expect(parsed).toMatchObject({ signal: "coderabbit-unparsed", evidence: "findings-summary" });
  });

  it("keeps a rate-limit notice, a walkthrough and an additional-comments body at a clean zero", () => {
    const quiet = [
      A.join(
        [
          "<!-- This is an auto-generated comment: rate limited by coderabbit.ai -->",
          "> [!WARNING]",
          "> ## Rate limit exceeded",
          "> Please wait 12 minutes before requesting another review.",
        ],
        "\n"
      ),
      A.join(["## Walkthrough", "", "The change adds a parser.", "", "## Changes", "| File | Summary |"], "\n"),
      A.join(
        ["<summary>Additional comments: 1</summary>", "`619-627`: **Trivial** · **Low value**", "Unverified finding"],
        "\n"
      ),
      A.join(["Prompt to fix all issues", "Failed pre-merge checks:", "- Docstring Coverage:"], "\n"),
    ];

    expect(A.map(quiet, (body) => signal("coderabbitai[bot]", body))).toMatchObject(
      A.map(quiet, () => ({ signal: "coderabbit", actionable: 0, nitpicks: 0, outsideDiff: 0, minor: 0, items: [] }))
    );
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

  it("matches a ranged finding to any thread whose line range overlaps it", () => {
    const parsed = signal(
      "coderabbitai[bot]",
      "**Actionable comments posted: 1**\nInline comments:\nReview comments at @src/a.ts:\n- Around line 73-74: fix it"
    );
    const spanning = (startLine: number | undefined, line: number) =>
      YeetReviewBodyThreadLocation.make({
        path: "src/a.ts",
        line: O.some(line),
        startLine: startLine === undefined ? O.none() : O.some(startLine),
      });

    expect(A.map(parsed.signal === "coderabbit" ? parsed.items : [], (item) => O.getOrNull(item.endLine))).toEqual([
      74,
    ]);
    expect(
      A.map(
        [spanning(73, 74), spanning(undefined, 74), spanning(70, 73), spanning(75, 80), spanning(undefined, 72)],
        (thread) => yeetReviewBodyAdvisoryCount(parsed, [thread])
      )
    ).toEqual([0, 0, 0, 1, 1]);
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
      A.join(
        [
          "**Actionable comments posted: 0**",
          "<summary>🧹 Nitpick comments (3)</summary>",
          "<summary>Outside diff range comments (1)</summary>",
        ],
        "\n"
      )
    );

    expect(yeetReviewBodyAdvisoryCount(parsed, [])).toBe(4);
  });

  it("counts Greptile new findings at every severity and nothing for a clean round", () => {
    expect(yeetReviewBodyAdvisoryCount(signal("kriegcloud", GREPTILE_R8_BODY), [])).toBe(1);
    expect(yeetReviewBodyAdvisoryCount(signal("kriegcloud", GREPTILE_R2_BODY), [])).toBe(0);
  });

  it("drops a current-format nitpick whose location already has a thread", () => {
    const parsed = signal("coderabbitai[bot]", CODERABBIT_NITPICK_BODY);

    expect(yeetReviewBodyUnthreadedItems(parsed, [location(NITPICK_PATH, 57)])).toEqual([]);
    expect(yeetReviewBodyUnthreadedItems(parsed, [])).toHaveLength(1);
  });

  it("counts nothing for a plain body", () => {
    expect(yeetReviewBodyAdvisoryCount(signal("kriegcloud", "pushed a fixup"), [])).toBe(0);
  });
});
