/**
 * Classification and routing helpers for Yeet quality issues.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { QualityIssueCategory, QualityIssueRouting } from "../Yeet.schemas.ts";
import type { RepoPlanStep } from "../../../internal/repo-run/index.ts";

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
export const categoryForStep = (step: RepoPlanStep): QualityIssueCategory => {
  const label = step.label;
  if (Str.includes("docgen")(label)) {
    return "docgen-jsdoc-quality";
  }
  if (Str.includes("schema")(label)) {
    return "schema-first-policy";
  }
  if (Str.includes("tsgo")(label) || Str.includes("effect")(label)) {
    return "effect-tsgo-policy";
  }
  if (Str.includes("repo-exports")(label)) {
    return "repo-export-policy";
  }
  if (Str.includes("changeset")(label)) {
    return "changeset-policy";
  }
  if (Str.includes("security")(label) || Str.includes("secrets")(label) || Str.includes("audit")(label)) {
    return "security-audit";
  }
  if (Str.includes("lint")(label)) {
    return "lint-tool";
  }
  if (Str.includes("test")(label)) {
    return "test";
  }
  if (Str.includes("build")(label)) {
    return "build";
  }
  if (Str.includes("law")(label)) {
    return "repo-law";
  }
  return "command-failure";
};

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
      "Run `bun run changeset:status:since-main`. Write a changeset listing each changed package with `patch`; packages on the changesets config `ignore` list are exempt.",
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
