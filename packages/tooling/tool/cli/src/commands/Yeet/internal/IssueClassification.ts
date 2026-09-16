/**
 * Classification and routing helpers for Yeet quality issues.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual, flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { QualityIssueCategory, QualityIssueRouting } from "../Yeet.schemas.ts";
import type { RepoPlanStep } from "../../../internal/repo-run/index.ts";
import type { QualityTaskLaneRun } from "../../Quality/Quality.schemas.ts";

const KNOWN_SUB_LANE_TAIL_CHARS = 16 * 1024;

/**
 * Return the specialist routing hints associated with a Yeet issue category.
 *
 * **Example** (Route a schema-first policy failure)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { routeForCategory } from "@beep/repo-cli/test/Yeet"
 *
 * strictEqual(routeForCategory("schema-first-policy")[0]?.skill, "schema-first-development")
 * ```
 *
 * @param category - Normalized issue category selected by Yeet's parser or
 * step classifier.
 * @returns Specialist skill routes that should be attached to quality packets
 * for that category.
 * @category routing
 * @since 0.0.0
 */
export const routeForCategory = (category: QualityIssueCategory): ReadonlyArray<QualityIssueRouting> =>
  QualityIssueCategory.$match(category, {
    "docgen-jsdoc-quality": () => [
      QualityIssueRouting.make({ skill: "jsdoc-annotation-specialist", reason: "JSDoc/docgen quality finding" }),
    ],
    "schema-first-policy": () => [
      QualityIssueRouting.make({ skill: "schema-first-development", reason: "Schema-first policy finding" }),
    ],
    "effect-tsgo-policy": () => [
      QualityIssueRouting.make({ skill: "effect-first-development", reason: "Effect tsgo diagnostic" }),
    ],
    "repo-law": () => [
      QualityIssueRouting.make({ skill: "effect-first-development", reason: "Repository law finding" }),
    ],
    "command-failure": () => [
      QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Raw command failure needs triage" }),
    ],
    "parser-error": () => [
      QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Issue parser failed to classify output" }),
    ],
    "unknown-raw": () => [
      QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Raw quality output needs classification" }),
    ],
    typecheck: () => [
      QualityIssueRouting.make({ skill: "effect-first-development", reason: "TypeScript check failure" }),
    ],
    "lint-tool": () => [QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Tool lint failure" })],
    test: () => [QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Test failure" })],
    build: () => [QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Build failure" })],
    "changeset-policy": () => [
      QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Changeset policy failure" }),
    ],
    "repo-export-policy": () => [
      QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Stale repo-export workflow reference" }),
    ],
    "security-audit": () => [
      QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Security audit failure" }),
    ],
    "pr-review": () => [
      QualityIssueRouting.make({ skill: "github:gh-address-comments", reason: "Actionable PR review thread" }),
    ],
    "greptile-review": () => [
      QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Greptile closeout gate failure" }),
    ],
    "bot-review": () => [
      QualityIssueRouting.make({ skill: "quality-review-fix-loop", reason: "Hosted review bot finding" }),
    ],
  });

// Ordered label needles: the first rule whose needle appears in the label wins,
// so `lint:effect-imports` classifies as effect-tsgo-policy before lint-tool.
const labelCategoryRules: ReadonlyArray<readonly [needles: ReadonlyArray<string>, category: QualityIssueCategory]> = [
  [["docgen"], "docgen-jsdoc-quality"],
  [["schema"], "schema-first-policy"],
  [["tsgo", "effect"], "effect-tsgo-policy"],
  [["repo-exports"], "repo-export-policy"],
  [["changeset"], "changeset-policy"],
  [["security", "secrets", "audit"], "security-audit"],
  [["lint"], "lint-tool"],
  [["test"], "test"],
  [["build"], "build"],
  [["law"], "repo-law"],
];

/**
 * Infer an issue category from a lane or step label.
 *
 * **Details**
 *
 * The failure packet applies this to the red inner lane's label before the
 * wrapper step's label, so a record that names `quality:docgen` classifies as
 * a docgen finding even when the wrapper is the broad pre-push tier.
 *
 * **Example** (Classify a recorded lane label)
 *
 * ```ts
 * import { categoryForLabel } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrUndefined(categoryForLabel("quality:docgen"))) // "docgen-jsdoc-quality"
 * console.log(O.isNone(categoryForLabel("quality:coverage"))) // true
 * ```
 *
 * @param label - Lane or step label scanned for known lane-family names.
 * @returns The category named by the first matching needle, when any.
 * @category classification
 * @since 0.0.0
 */
export const categoryForLabel = (label: string): O.Option<QualityIssueCategory> =>
  pipe(
    labelCategoryRules,
    A.findFirst(([needles]) => A.some(needles, (needle) => Str.includes(needle)(label))),
    O.map(([, category]) => category)
  );

/**
 * Infer the default issue category from a planned Yeet step label.
 *
 * **Example** (Classify a plan step)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { categoryForStep, RepoPlanStep } from "@beep/repo-cli/test/Yeet"
 *
 * const step = RepoPlanStep.make({
 *   args: [],
 *   command: "bun",
 *   cwd: "/repo",
 *   id: "full:check",
 *   label: "docgen quality",
 *   mutability: "readonly",
 *   phase: "full",
 *   resume: "never",
 *   scope: "repo"
 * })
 * strictEqual(categoryForStep(step), "docgen-jsdoc-quality")
 * ```
 *
 * @param step - Planned repo-run step whose label is scanned for known lane
 * names.
 * @returns The broad quality issue category used when a step fails without a
 * more specific parser result.
 * @category classification
 * @since 0.0.0
 */
export const categoryForStep = (step: RepoPlanStep): QualityIssueCategory =>
  pipe(
    categoryForLabel(step.label),
    O.getOrElse((): QualityIssueCategory => "command-failure")
  );

/**
 * Known broad-lane failure hint extracted from raw command output.
 *
 * **Example** (Annotate a value as KnownSubLaneHint)
 *
 * ```ts
 * import type { KnownSubLaneHint } from "@beep/repo-cli/test/Yeet"
 *
 * const hint: KnownSubLaneHint = {
 *   category: "lint-tool",
 *   needle: "typos",
 *   remediation: "Run typos.",
 *   subCategory: "typos"
 * }
 * console.log(hint.subCategory)
 * ```
 *
 * @category classification
 * @since 0.0.0
 */
type KnownSubLaneHint = {
  readonly needle: string;
  readonly subCategory: string;
  readonly category: QualityIssueCategory;
  readonly remediation: string;
};

type KnownSubLaneMatch = {
  readonly hint: KnownSubLaneHint;
  readonly index: number;
};

const knownSubLaneHints: ReadonlyArray<KnownSubLaneHint> = [
  {
    needle: "frozen-lockfile clean-head install preflight failed",
    subCategory: "head-install-preflight",
    category: "command-failure",
    remediation:
      "Commit or restage the required lockfile and manifest changes; if needed, run `bun install` and restage `bun.lock`.",
  },
  {
    needle: "terse-effect",
    subCategory: "terse-effect",
    category: "repo-law",
    remediation:
      "Run `bun run beep laws terse-effect --check` and inspect blocking, rewritable, and informational files.",
  },
  {
    needle: "repo-sanity:tsconfig-sync",
    subCategory: "tsconfig-sync",
    category: "repo-law",
    remediation: "Run `bun run config-sync`, then rerun `bun run beep yeet verify --tier cheap-gates`.",
  },
  {
    needle: "lint:tsgo-rules",
    subCategory: "tsgo-rules",
    category: "effect-tsgo-policy",
    remediation: "Repair the reported tsgo or Vitest alias drift, then rerun `bun run beep quality tsgo-rules`.",
  },
  {
    needle: "lint:effect-imports",
    subCategory: "effect-imports",
    category: "repo-law",
    remediation:
      "Run `bun run beep laws effect-imports --write`, inspect the changes, then rerun the cheap-gates tier.",
  },
  {
    needle: "lint:schema-first",
    subCategory: "schema-first",
    category: "schema-first-policy",
    remediation: "Run `bun run beep lint schema-first`, fix every finding, then rerun the cheap-gates tier.",
  },
  {
    needle: "lint:allowlist",
    subCategory: "allowlist-check",
    category: "repo-law",
    remediation: "Run `bun run beep laws allowlist-check`, fix every finding, then rerun the cheap-gates tier.",
  },
  {
    needle: "goals:index-check",
    subCategory: "goals-index",
    category: "repo-law",
    remediation: "Run `bun run beep goals index`, inspect the update, then rerun the cheap-gates tier.",
  },
  {
    needle: "goals:doctor",
    subCategory: "goals-doctor",
    category: "repo-law",
    remediation: "Run `bun run beep goals doctor`, fix every finding, then rerun the cheap-gates tier.",
  },
  {
    needle: "quality:jsdoc-ratchet",
    subCategory: "jsdoc-ratchet",
    category: "docgen-jsdoc-quality",
    remediation:
      "Repair the JSDoc inventory regression (the cheap tier reads the committed inventory, pre-push regenerates it), then rerun the failing tier.",
  },
  {
    needle: "quality:knip",
    subCategory: "knip",
    category: "lint-tool",
    remediation: "Run `bun run beep quality knip`, fix every finding, then rerun the cheap-gates tier.",
  },
  {
    needle: "fallow:audit",
    subCategory: "fallow-audit",
    category: "lint-tool",
    remediation: "Run `bun run beep quality fallow audit --check`, fix every finding, then rerun the cheap-gates tier.",
  },
  {
    needle: "fallow:dead-code",
    subCategory: "fallow-dead-code",
    category: "lint-tool",
    remediation:
      "Run `bun run beep quality fallow dead-code --check`, fix every finding, then rerun the cheap-gates tier.",
  },
  {
    needle: "repo-exports",
    subCategory: "stale-repo-export-workflow",
    category: "repo-export-policy",
    remediation: "Remove stale repo-export workflow references and use live source/barrel search for symbol discovery.",
  },
  {
    needle: "docgen",
    subCategory: "docgen",
    category: "docgen-jsdoc-quality",
    remediation: "Run `bun run docgen:local` for edit loops or `bun run docgen` for the full proof.",
  },
  {
    needle: "semgrep",
    subCategory: "sast",
    category: "security-audit",
    remediation: "Inspect the Semgrep finding and rerun `bun run beep quality github-checks sast`.",
  },
  {
    needle: "gitleaks",
    subCategory: "secrets",
    category: "security-audit",
    remediation: "Inspect the Gitleaks finding and rerun `bun run beep quality github-checks secrets`.",
  },
  {
    needle: "osv",
    subCategory: "security",
    category: "security-audit",
    remediation: "Inspect the OSV finding and rerun `bun run beep quality github-checks security`.",
  },
  {
    needle: "nix",
    subCategory: "nix",
    category: "security-audit",
    remediation: "Rerun `bun run beep quality github-checks nix` and inspect the Nix error.",
  },
  {
    needle: "changeset",
    subCategory: "changeset-status",
    category: "changeset-policy",
    remediation:
      "Run `bun run beep quality changeset-status --since origin/main`. Write a changeset listing each changed package with `patch`; packages on the changesets config `ignore` list are exempt.",
  },
  {
    needle: "typos",
    subCategory: "typos",
    category: "lint-tool",
    remediation:
      "Run the typos checker on the flagged files and fix the spelling, or whitelist intentional terms in `_typos.toml`.",
  },
];

const knownSubLaneHintFromText = (text: string): O.Option<KnownSubLaneHint> =>
  pipe(
    knownSubLaneHints,
    A.reduce(O.none<KnownSubLaneMatch>(), (latest, hint) => {
      const index = text.lastIndexOf(hint.needle);
      if (index < 0) {
        return latest;
      }
      const candidate = { hint, index };
      return pipe(
        latest,
        O.match({
          onNone: () => O.some(candidate),
          onSome: (match) => (index > match.index ? O.some(candidate) : latest),
        })
      );
    }),
    O.map((match) => match.hint)
  );

const FAILURE_HINT_WINDOW_RADIUS = 12;

interface FailureHintSlices {
  readonly prefix: O.Option<string>;
  readonly windows: ReadonlyArray<string>;
}

const lineIndicatesFailure = (line: string): boolean => {
  const normalized = Str.toLowerCase(line);
  return (
    Str.includes("failed")(normalized) ||
    Str.includes("failure")(normalized) ||
    Str.includes("error")(normalized) ||
    Str.includes("exit code")(normalized) ||
    Str.includes("timed out")(normalized)
  );
};

const outputFailureHintSlices = (text: string): FailureHintSlices => {
  const lines = pipe(text, Str.replace(/\r\n/gu, "\n"), Str.split("\n"));
  const failureEntries = pipe(
    lines,
    A.map((line, index) => ({ index, line })),
    A.filter((entry) => lineIndicatesFailure(entry.line))
  );
  return {
    prefix: pipe(
      failureEntries,
      A.findLast(() => true),
      O.map((entry) => pipe(lines, A.take(entry.index + 1), A.join("\n")))
    ),
    windows: pipe(
      failureEntries,
      A.map((entry) => {
        const start = Math.max(0, entry.index - FAILURE_HINT_WINDOW_RADIUS);
        return pipe(lines, A.drop(start), A.take(entry.index - start + 1), A.join("\n"));
      })
    ),
  };
};

const knownSubLaneHintFromFailureSlices = (slices: FailureHintSlices): O.Option<KnownSubLaneHint> => {
  if (A.isReadonlyArrayEmpty(slices.windows)) {
    return O.none();
  }
  return pipe(
    slices.windows,
    A.reduce(O.none<KnownSubLaneHint>(), (matched, window) =>
      O.isSome(matched) ? matched : knownSubLaneHintFromText(window)
    ),
    O.orElse(() => pipe(slices.prefix, O.flatMap(knownSubLaneHintFromText)))
  );
};

/**
 * Find the latest known sub-lane hint in raw command output.
 *
 * **Example** (Recognize a typos sub-lane)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { knownSubLaneHintFromOutput } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * strictEqual(O.getOrThrow(knownSubLaneHintFromOutput("lint:typos failed")).subCategory, "typos")
 * ```
 *
 * @param output - Raw command output, usually the tail of a broad quality lane
 * failure.
 * @returns The latest matched sub-lane hint when a known failure signature is
 * present.
 * @category classification
 * @since 0.0.0
 */
export const knownSubLaneHintFromOutput = (output: string | undefined): O.Option<KnownSubLaneHint> => {
  const normalized = Str.toLowerCase(output ?? "");
  const tail = normalized.slice(-KNOWN_SUB_LANE_TAIL_CHARS);
  const failureSlices = outputFailureHintSlices(normalized);
  return pipe(
    knownSubLaneHintFromFailureSlices(failureSlices),
    O.orElse(() =>
      A.isReadonlyArrayEmpty(failureSlices.windows)
        ? pipe(
            knownSubLaneHintFromText(tail),
            O.orElse(() => knownSubLaneHintFromText(normalized))
          )
        : O.none()
    )
  );
};

/**
 * Return the remediation command for a known failed sub-lane found in broad
 * command output.
 *
 * **Example** (Find remediation for a typos failure)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { knownSubLaneRemediationFromOutput } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(O.isSome(knownSubLaneRemediationFromOutput("lint:typos failed")))
 * ```
 *
 * @param output - Captured step output to scan for known sub-lane needles.
 * @returns Remediation text when a known sub-lane hint matches.
 * @category utilities
 * @since 0.0.0
 */
export const knownSubLaneRemediationFromOutput = (output: string | undefined): O.Option<string> =>
  pipe(
    knownSubLaneHintFromOutput(output),
    O.map((hint) => hint.remediation)
  );

/**
 * Return the known sub-lane hint named exactly by a lane id.
 *
 * **Details**
 *
 * The `quality-task-lane-run/v1` record names the red lane precisely, so this
 * lookup never scans output. It matches only catalog needles that are
 * themselves lane ids (`goals:index-check`, `lint:effect-imports`, ...).
 *
 * **Example** (Look up the goals index gate by lane id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { knownSubLaneHintForLaneId } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(O.map(knownSubLaneHintForLaneId("goals:index-check"), (hint) => hint.subCategory)) // Some("goals-index")
 * ```
 *
 * @param laneId - Stable lane id from the lane-run record.
 * @returns The catalog hint whose needle equals the lane id.
 * @category classification
 * @since 0.0.0
 */
export const knownSubLaneHintForLaneId = (laneId: string): O.Option<KnownSubLaneHint> => {
  const normalized = Str.toLowerCase(laneId);
  return A.findFirst(knownSubLaneHints, (hint) => hint.needle === normalized);
};

/**
 * Return the remediation for a known sub-lane named exactly by its lane id.
 *
 * **Details**
 *
 * The `quality-task-lane-run/v1` record names the red lane precisely, so this
 * lookup never scans output. It matches only catalog needles that are
 * themselves lane ids (`goals:index-check`, `lint:effect-imports`, ...).
 * Lanes whose catalog needle is a marker inside their output (`osv`,
 * `changeset`, `typos`) are served by
 * {@link knownSubLaneRemediationFromLaneOutput} instead.
 *
 * **Example** (Look up the goals index gate by lane id)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { knownSubLaneRemediationForLaneId } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(O.isSome(knownSubLaneRemediationForLaneId("goals:index-check")))
 * ```
 *
 * @param laneId - Stable lane id from the lane-run record.
 * @returns Remediation text when a catalog needle equals the lane id.
 * @category utilities
 * @since 0.0.0
 */
export const knownSubLaneRemediationForLaneId = (laneId: string): O.Option<string> =>
  O.map(knownSubLaneHintForLaneId(laneId), (hint) => hint.remediation);

const LANE_LOG_PREFIX = "[beep-cli] ";
const LANE_OUTCOME_PATTERN = /^(?:ok|failed|done) in \d+ms$/u;
const LANE_REPORT_PREFIXES: ReadonlyArray<string> = ["[beep-quality-task-lane-run] ", "[beep-github-check-run] "];
const TAGGED_LINE_PATTERN = /^\[[a-z-]+\] /u;

const laneLogLabel = (line: string): O.Option<string> => {
  if (!Str.startsWith(LANE_LOG_PREFIX)(line)) {
    return O.none();
  }
  const rest = Str.slice(LANE_LOG_PREFIX.length)(line);
  return pipe(
    Str.indexOf(": ")(rest),
    O.map((index) => Str.slice(0, index)(rest))
  );
};

const isLaneOutcomeLine = (line: string, laneLabel: string): boolean =>
  O.contains(laneLogLabel(line), laneLabel) &&
  LANE_OUTCOME_PATTERN.test(Str.slice(LANE_LOG_PREFIX.length + laneLabel.length + 2)(line));

const siblingLogLabel = (line: string, siblingLabels: HashSet.HashSet<string>): O.Option<string> =>
  O.filter(laneLogLabel(line), (label) => HashSet.has(siblingLabels, label));

// Only a sibling's launch line ends the segment. Concurrent siblings finish
// after the target launched, so a sibling outcome line (`ok in 12ms`) must not
// cut the target's segment before its own marker or failure output.
const isSiblingLaunchLine = (line: string, siblingLabels: HashSet.HashSet<string>): boolean =>
  O.exists(siblingLogLabel(line, siblingLabels), (label) => !isLaneOutcomeLine(line, label));

const isSiblingOutcomeLine = (line: string, siblingLabels: HashSet.HashSet<string>): boolean =>
  O.exists(siblingLogLabel(line, siblingLabels), (label) => isLaneOutcomeLine(line, label));

const isLaneBoundaryLine = (line: string, siblingLabels: HashSet.HashSet<string>): boolean =>
  A.some(LANE_REPORT_PREFIXES, (prefix) => Str.startsWith(prefix)(line)) ||
  (Str.startsWith(LANE_LOG_PREFIX)(line) &&
    (Str.includes(": running lane ")(line) || Str.includes(": first red ")(line))) ||
  isSiblingLaunchLine(line, siblingLabels);

/**
 * Slice one lane's own output out of a wrapper's captured output.
 *
 * **Details**
 *
 * Wrapper lanes stream every inner lane inline. A lane's segment starts at its
 * last launch line (`[beep-cli] <label>: <command>`), ends at its outcome line
 * (`[beep-cli] <label>: failed in 12ms`, kept), and is cut short by the next
 * sibling launch line, tier `running lane` / `first red` line, or embedded
 * lane-run report. A sibling's outcome line
 * (`[beep-cli] <sibling>: ok in 10ms`) never ends the segment, because
 * concurrent siblings finish after the target launched; it is dropped from
 * the segment instead so its label cannot feed the marker scan. Nested child
 * steps keep their own labels, so they never end the segment early.
 *
 * **Example** (Slice a red lane's output away from a passing sibling)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { laneOutputSegment } from "@beep/repo-cli/test/Yeet"
 *
 * const output = [
 *   "[beep-cli] quality:security: bun run beep quality github-checks security",
 *   "No vulnerabilities found",
 *   "[beep-cli] quality:security: ok in 10ms",
 *   "[beep-cli] quality:coverage: bun run beep ci lane coverage",
 *   "FAIL test/protocol.test.ts",
 *   "[beep-cli] quality:coverage: failed in 20ms",
 * ].join("\n")
 * const siblings = HashSet.make("quality:security", "quality:coverage")
 *
 * console.log(O.getOrElse(laneOutputSegment(output, "quality:coverage", siblings), () => ""))
 * ```
 *
 * @param output - Captured wrapper output.
 * @param laneLabel - Label of the lane whose segment is wanted.
 * @param siblingLabels - Labels of every lane the wrapper ran; their launch
 * lines end the segment and their outcome lines are dropped from it.
 * @returns The lane's launch line, body, and outcome line when the launch
 * line is present.
 * @category utilities
 * @since 0.0.0
 */
export const laneOutputSegment: {
  (laneLabel: string, siblingLabels: HashSet.HashSet<string>): (output: string | undefined) => O.Option<string>;
  (output: string | undefined, laneLabel: string, siblingLabels: HashSet.HashSet<string>): O.Option<string>;
} = dual(
  3,
  (output: string | undefined, laneLabel: string, siblingLabels: HashSet.HashSet<string>): O.Option<string> => {
    const lines = pipe(output ?? "", Str.replace(/\r\n/gu, "\n"), Str.split("\n"));
    const isLaunchLine = (line: string): boolean =>
      O.contains(laneLogLabel(line), laneLabel) && !isLaneOutcomeLine(line, laneLabel);
    return pipe(
      A.findLastIndex(lines, isLaunchLine),
      O.map((start) => {
        const own = A.drop(lines, start);
        const body = A.takeWhile(
          A.drop(own, 1),
          (line) => !isLaneOutcomeLine(line, laneLabel) && !isLaneBoundaryLine(line, siblingLabels)
        );
        const outcome = pipe(
          A.get(own, A.length(body) + 1),
          O.filter((line) => isLaneOutcomeLine(line, laneLabel)),
          A.fromOption
        );
        return pipe(
          A.take(own, 1),
          A.appendAll(A.filter(body, (line) => !isSiblingOutcomeLine(line, siblingLabels))),
          A.appendAll(outcome),
          A.join("\n")
        );
      })
    );
  }
);

const taggedLines: (segment: string) => string = flow(
  Str.split("\n"),
  A.filter((line) => TAGGED_LINE_PATTERN.test(line)),
  A.join("\n")
);

/**
 * Return the known sub-lane hint whose marker sits inside one lane's own
 * output segment.
 *
 * **Details**
 *
 * Only tagged log lines (`[beep-cli] ...`, `[github-checks] ...`) inside the
 * lane's segment are scanned, so a passing sibling's `security:osv-scan`
 * launch line or a stray `unix` in test output can no longer name the hint.
 *
 * **Example** (Find the typos hint inside a broad lint lane)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { knownSubLaneHintFromLaneOutput } from "@beep/repo-cli/test/Yeet"
 *
 * const output = [
 *   "[beep-cli] quality:lint-policy: bun run beep ci lane lint-policy",
 *   "[beep-cli] lint:typos: typos",
 *   "[beep-cli] lint:typos: failed in 12ms",
 *   "[beep-cli] quality:lint-policy: failed in 40ms",
 * ].join("\n")
 * const hint = knownSubLaneHintFromLaneOutput(output, "quality:lint-policy", HashSet.make("quality:lint-policy"))
 *
 * console.log(O.map(hint, (value) => value.subCategory)) // Some("typos")
 * ```
 *
 * @param output - Captured wrapper output.
 * @param laneLabel - Label of the red lane.
 * @param siblingLabels - Labels of every lane the wrapper ran.
 * @returns The catalog hint whose marker sits inside the lane's segment.
 * @category classification
 * @since 0.0.0
 */
export const knownSubLaneHintFromLaneOutput: {
  (
    laneLabel: string,
    siblingLabels: HashSet.HashSet<string>
  ): (output: string | undefined) => O.Option<KnownSubLaneHint>;
  (output: string | undefined, laneLabel: string, siblingLabels: HashSet.HashSet<string>): O.Option<KnownSubLaneHint>;
} = dual(
  3,
  (output: string | undefined, laneLabel: string, siblingLabels: HashSet.HashSet<string>): O.Option<KnownSubLaneHint> =>
    pipe(laneOutputSegment(output, laneLabel, siblingLabels), O.map(taggedLines), O.flatMap(knownSubLaneHintFromOutput))
);

/**
 * Return the remediation for a known sub-lane marker found inside one lane's
 * own output segment.
 *
 * **Details**
 *
 * Only tagged log lines (`[beep-cli] ...`, `[github-checks] ...`) inside the
 * lane's segment are scanned, so a passing sibling's `security:osv-scan`
 * launch line or a stray `unix` in test output can no longer name the hint.
 * When the lane has no launch line in the output, or its tagged lines carry no
 * known marker, the caller falls back to the lane's own command text.
 *
 * **Example** (Find the typos marker inside a broad lint lane)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { knownSubLaneRemediationFromLaneOutput } from "@beep/repo-cli/test/Yeet"
 *
 * const output = [
 *   "[beep-cli] quality:lint-policy: bun run beep ci lane lint-policy",
 *   "[beep-cli] lint:typos: typos",
 *   "[beep-cli] lint:typos: failed in 12ms",
 *   "[beep-cli] quality:lint-policy: failed in 40ms",
 * ].join("\n")
 *
 * console.log(
 *   O.isSome(knownSubLaneRemediationFromLaneOutput(output, "quality:lint-policy", HashSet.make("quality:lint-policy")))
 * )
 * ```
 *
 * @param output - Captured wrapper output.
 * @param laneLabel - Label of the red lane.
 * @param siblingLabels - Labels of every lane the wrapper ran.
 * @returns Remediation text when a known marker sits inside the lane's segment.
 * @category utilities
 * @since 0.0.0
 */
export const knownSubLaneRemediationFromLaneOutput: {
  (laneLabel: string, siblingLabels: HashSet.HashSet<string>): (output: string | undefined) => O.Option<string>;
  (output: string | undefined, laneLabel: string, siblingLabels: HashSet.HashSet<string>): O.Option<string>;
} = dual(
  3,
  (output: string | undefined, laneLabel: string, siblingLabels: HashSet.HashSet<string>): O.Option<string> =>
    O.map(knownSubLaneHintFromLaneOutput(output, laneLabel, siblingLabels), (hint) => hint.remediation)
);

/**
 * Resolve the known sub-lane hint for one recorded lane run, record first.
 *
 * **Details**
 *
 * This is the single derivation the verdict's `repairCommand` and the failure
 * packet's `subCategory`, `category`, `message`, and `remediation` share: the
 * catalog hint keyed by the lane's exact id, else a known marker inside the
 * lane's own output segment. It never scans the whole wrapper output, so a
 * passing sibling's marker cannot name the hint. Callers fall back to the
 * lane's recorded `commandText` when it yields nothing.
 *
 * **Example** (Resolve the hint for a red goals index lane)
 *
 * ```ts
 * import { QualityTaskLaneRun } from "@beep/repo-cli/test/Quality"
 * import { knownSubLaneHintForLaneRun } from "@beep/repo-cli/test/Yeet"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const lane = QualityTaskLaneRun.make({
 *   id: "goals:index-check",
 *   label: "goals:index-check",
 *   status: "failed",
 *   inputDigest: O.none()
 * })
 * const hint = knownSubLaneHintForLaneRun(lane, HashSet.make("goals:index-check"), undefined)
 *
 * console.log(O.map(hint, (value) => value.subCategory)) // Some("goals-index")
 * ```
 *
 * @param lane - Recorded inner lane, usually the wrapper's first red lane.
 * @param siblingLabels - Labels of every lane the wrapper ran.
 * @param wrapperOutput - Captured output of the wrapper step.
 * @returns The lane's catalog hint by id, else by marker inside its own
 * segment.
 * @category classification
 * @since 0.0.0
 */
export const knownSubLaneHintForLaneRun: {
  (
    siblingLabels: HashSet.HashSet<string>,
    wrapperOutput: string | undefined
  ): (lane: QualityTaskLaneRun) => O.Option<KnownSubLaneHint>;
  (
    lane: QualityTaskLaneRun,
    siblingLabels: HashSet.HashSet<string>,
    wrapperOutput: string | undefined
  ): O.Option<KnownSubLaneHint>;
} = dual(
  3,
  (
    lane: QualityTaskLaneRun,
    siblingLabels: HashSet.HashSet<string>,
    wrapperOutput: string | undefined
  ): O.Option<KnownSubLaneHint> =>
    pipe(
      knownSubLaneHintForLaneId(lane.id),
      O.orElse(() => knownSubLaneHintFromLaneOutput(wrapperOutput, lane.label, siblingLabels))
    )
);
