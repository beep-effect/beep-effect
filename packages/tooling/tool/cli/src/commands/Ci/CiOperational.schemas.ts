/**
 * Shared hosted profile and resource models, including the bootstrap pattern data.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Ci/CiOperational.schemas");

/**
 * Shared pattern data owned by the schema module and projected for bootstrap use.
 *
 * **Example** (Construct pattern data)
 *
 * ```ts
 * import { CiOperationalPatterns } from "@beep/repo-cli/commands/Ci"
 * const patterns = CiOperationalPatterns.make({
 *   goals: "^goals/",
 *   desktop: "^apps/",
 *   docs: "^docs/",
 *   codeRoots: "^(packages|apps)/"
 * })
 * console.log(patterns.docs) // "^docs/"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiOperationalPatterns extends S.Opaque<CiOperationalPatterns, { readonly brand: unique symbol }>()(
  S.Struct({
    goals: S.NonEmptyString.annotateKey({ description: "Convention-owned goal prose pattern." }),
    desktop: S.NonEmptyString.annotateKey({ description: "Desktop Cargo and gate-owner pattern." }),
    docs: S.NonEmptyString.annotateKey({ description: "Additional Heavy docs-only paths." }),
    codeRoots: S.NonEmptyString.annotateKey({ description: "Roots whose paths are never docs-only." }),
  }).pipe(
    $I.annoteSchema("CiOperationalPatterns", {
      description: "Canonical pattern data for hosted and bootstrap CI profiles.",
    })
  )
) {}

/**
 * How a test reaches a goal-packet path it consumes.
 *
 * **Example** (Check a consumption mode)
 *
 * ```ts
 * import { CiGoalDataConsumerMode } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CiGoalDataConsumerMode)("spawn")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiGoalDataConsumerMode = LiteralKit(["read", "spawn", "import", "turbo-input"]).pipe(
  $I.annoteSchema("CiGoalDataConsumerMode", {
    description: "How a test reads, spawns or imports a goal path, or a turbo.json declares it.",
  })
);

/**
 * The decoded type of {@link CiGoalDataConsumerMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiGoalDataConsumerMode = typeof CiGoalDataConsumerMode.Type;

/**
 * One goal or exploration packet path family that a test consumes, kept off the docs-only route.
 *
 * **Details**
 *
 * `pattern` is an anchored, `grep -E` compatible expression over repo-relative paths; it is
 * joined into {@link ciOperationalPatterns}' `codeRoots`, so a matching path is never docs-only.
 * Every `evidence` file must contain `reference`, the text it uses to reach the paths, so a
 * consumer that stops reading them leaves a stale row the goal-data census test rejects.
 *
 * **Example** (Describe one consumed probe)
 *
 * ```ts
 * import { CiGoalDataConsumer } from "@beep/repo-cli/commands/Ci"
 *
 * const consumer = CiGoalDataConsumer.make({
 *   pattern: "^goals/demo/ops/probe\\.py$",
 *   reference: "goals/demo/ops/probe.py",
 *   consumers: ["@beep/demo"],
 *   modes: ["spawn"],
 *   evidence: ["packages/demo/test/Probe.test.ts"],
 * })
 * console.log(consumer.modes) // ["spawn"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiGoalDataConsumer extends S.Opaque<CiGoalDataConsumer, { readonly brand: unique symbol }>()(
  S.Struct({
    pattern: S.NonEmptyString.annotateKey({ description: "Anchored expression over the consumed goal paths." }),
    reference: S.NonEmptyString.annotateKey({ description: "Text each evidence file uses to reach the paths." }),
    consumers: S.NonEmptyArray(S.NonEmptyString).annotateKey({
      description: "Workspace packages whose tests consume the paths.",
    }),
    modes: S.NonEmptyArray(CiGoalDataConsumerMode).annotateKey({ description: "How the consumers reach the paths." }),
    evidence: S.NonEmptyArray(S.NonEmptyString).annotateKey({ description: "Repo-relative consumer files." }),
  }).pipe(
    $I.annoteSchema("CiGoalDataConsumer", {
      description: "A goal-packet path family a test reads, spawns or imports, kept on the code route.",
    })
  )
) {}

/**
 * Goal and exploration packet paths that tests read, spawn or import, or that a package `turbo.json` declares.
 *
 * **Details**
 *
 * The rows close the #2999 widening for consumed paths (ROUT-03): each `pattern` joins
 * `codeRoots`, so a change to one of these files is never classified docs-only and the heavy
 * matrix and Test Unit still run. `packages/tooling/tool/cli/test/goal-data-consumer-census.test.ts`
 * regenerates the consumer list from test sources and per-package `turbo.json` inputs and fails
 * when a consumed path is missing here or a row goes stale.
 *
 * **Example** (List the consumer packages)
 *
 * ```ts
 * import { ciGoalDataConsumers } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciGoalDataConsumers.flatMap((row) => row.consumers).includes("@beep/repo-cli")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ciGoalDataConsumers: A.NonEmptyReadonlyArray<CiGoalDataConsumer> = [
  CiGoalDataConsumer.make({
    pattern: "^goals/citation-extraction-engine/ops/",
    reference: "goals/citation-extraction-engine/ops/",
    consumers: ["@beep/law-practice-server"],
    modes: ["spawn", "import"],
    evidence: [
      "packages/law-practice/server/test/CitationHtmlBytes.test.ts",
      "packages/law-practice/server/test/CitationNativeRendering.fixtures.ts",
      "packages/law-practice/server/test/CitationRegexCharacters.test.ts",
      "packages/law-practice/server/test/CitationRegexTranslator.fixtures.ts",
      "packages/law-practice/server/test/CitationTokenEquality.fixtures.ts",
    ],
  }),
  CiGoalDataConsumer.make({
    pattern:
      "^goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile\\.frozen\\.json\\.txt$",
    reference:
      "goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile.frozen.json.txt",
    consumers: ["@beep/eyecite", "@beep/law-practice-server"],
    modes: ["read"],
    evidence: [
      "packages/drivers/eyecite/test/index.test.ts",
      "packages/law-practice/server/test/CitationRecognizerWorker.test.ts",
      "packages/law-practice/server/test/CitationSixFormProjection.test.ts",
    ],
  }),
  CiGoalDataConsumer.make({
    pattern: "^goals/semantica-canary/history/c2/full-w1\\.replay\\.eval-report\\.json$",
    reference: "goals/semantica-canary/history/c2/full-w1.replay.eval-report.json",
    consumers: ["@beep/semantica"],
    modes: ["read"],
    evidence: ["apps/labs/semantica/test/CanaryC2Report.test.ts"],
  }),
  CiGoalDataConsumer.make({
    pattern: "^goals/time-to-certainty/research/economics\\.json$",
    reference: "goals/time-to-certainty/research/economics.json",
    consumers: ["@beep/repo-cli"],
    modes: ["read", "turbo-input"],
    evidence: ["packages/tooling/tool/cli/test/gate-order-handoff.test.ts", "packages/tooling/tool/cli/turbo.json"],
  }),
  CiGoalDataConsumer.make({
    pattern: "^goals/time-to-certainty/research/gate-order-handoff\\.json$",
    reference: "goals/time-to-certainty/research/gate-order-handoff.json",
    consumers: ["@beep/ciops", "@beep/repo-cli"],
    modes: ["read", "turbo-input"],
    evidence: ["apps/labs/ciops/test/lane-plan.test.ts", "packages/tooling/tool/cli/turbo.json"],
  }),
  CiGoalDataConsumer.make({
    pattern: "^goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics(\\.test)?\\.py$",
    reference: "goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics",
    consumers: ["@beep/repo-cli"],
    modes: ["spawn", "turbo-input"],
    evidence: ["packages/tooling/tool/cli/test/cache-dependencies.test.ts", "packages/tooling/tool/cli/turbo.json"],
  }),
  CiGoalDataConsumer.make({
    pattern: "^goals/speed-loop/ops/runner-burst/",
    reference: "goals/speed-loop/ops/runner-burst",
    consumers: ["@beep/repo-cli"],
    modes: ["read"],
    evidence: ["packages/tooling/tool/cli/test/ci-runner-security.test.ts"],
  }),
  CiGoalDataConsumer.make({
    pattern:
      "^explorations/beep-ci-operational-ontology/ontology/extraction/s6/(graphs/abox\\.ttl|snapshot/raw/journal\\.ndjson)$",
    reference: "explorations/beep-ci-operational-ontology/ontology/extraction/s6/",
    consumers: ["@beep/ciops"],
    modes: ["read"],
    evidence: [
      "apps/labs/ciops/test/evidence.test.ts",
      "apps/labs/ciops/test/live-replay.test.ts",
      "apps/labs/ciops/test/projection.test.ts",
    ],
  }),
  CiGoalDataConsumer.make({
    pattern: "^explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet/",
    reference: "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet",
    consumers: ["@beep/ciops"],
    modes: ["read"],
    evidence: ["apps/labs/ciops/test/live-replay.test.ts"],
  }),
  CiGoalDataConsumer.make({
    pattern: "^explorations/legal-ontology-landscape/assets/manifest\\.jsonl$",
    reference: "explorations/legal-ontology-landscape/assets/manifest.jsonl",
    consumers: ["@beep/ontology"],
    modes: ["read"],
    evidence: ["packages/foundation/modeling/ontology/test/SemanticFoundation.test.ts"],
  }),
  CiGoalDataConsumer.make({
    pattern: "^goals/[^/]+/ops/.+\\.ts$",
    reference: "goals/*/ops/**/*.ts",
    consumers: ["@beep/repo-cli"],
    modes: ["import"],
    evidence: ["packages/tooling/tool/cli/test/goals-ops-typecheck.test.ts"],
  }),
];

/**
 * Canonical CI patterns; `ci patterns --write` owns their pre-runtime JSON projection.
 *
 * **Example** (Read the shared docs pattern)
 *
 * ```ts
 * import { ciOperationalPatterns } from "@beep/repo-cli/commands/Ci"
 * console.log(ciOperationalPatterns.docs)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ciOperationalPatterns = CiOperationalPatterns.make({
  goals:
    "^(goals/(INDEX|README)\\.md|goals/[^/]+/(GOAL|PLAN|README|SPEC|DECISIONS)\\.md|goals/[^/]+/ops/manifest\\.json|goals/[^/]+/(history(/reflections)?|research)/\\.gitkeep)$",
  desktop:
    "^(apps/professional-desktop/src-tauri/|\\.github/workflows/check\\.yml$|packages/tooling/tool/cli/src/commands/Ci/(CiBootstrap\\.command\\.ts$|CiOperational))",
  // Goal packets include temporary helpers; root governance inventories retain verification.
  // Product roots and the goal-data consumer rows remain excluded by codeRoots even when the
  // file is Markdown.
  docs: "^docs/|^goals/[^/]+/|^explorations/|^research/|^\\.changeset/[^/]+\\.md$|\\.md$",
  codeRoots: A.join(["^(packages|apps|infra)/", ...A.map(ciGoalDataConsumers, (row) => row.pattern)], "|"),
});

/**
 * The docs-only path classification, decided before the heavy call.
 *
 * **Details**
 *
 * `docs/**`, `goals/<packet>/**`, `explorations/**` and `research/**` are documentation
 * and planning surfaces, including temporary goal helpers and verifier inputs.
 * Root goal governance inventories and the goal paths tests consume ({@link ciGoalDataConsumers})
 * retain verification. `.changeset/*.md` and Markdown
 * outside product roots also qualify. Paths under `packages/`, `apps/` and
 * `infra/` retain verification, including their Markdown files. The tier-1
 * change profile and Yeet publication reuse this same schema-owned path rule.
 *
 * **Example** (Classify two paths)
 *
 * ```ts
 * import { heavyDocsOnlyPattern } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(heavyDocsOnlyPattern.test("packages/a/README.md")) // false
 * console.log(heavyDocsOnlyPattern.test("goals/x/scripts/run.sh")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const heavyDocsOnlyPattern: RegExp = new RegExp(
  `^(?!${ciOperationalPatterns.codeRoots})(?:${ciOperationalPatterns.goals}|.*(?:${ciOperationalPatterns.docs}))`,
  "u"
);

/**
 * Whether one repo-relative path is docs-only under {@link heavyDocsOnlyPattern}.
 *
 * **Example** (Guard a path)
 *
 * ```ts
 * import { isHeavyDocsOnlyPath } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(isHeavyDocsOnlyPath("docs/runbooks/ci.md")) // true
 * console.log(isHeavyDocsOnlyPath("goals/x/ops/fixtures.json")) // true
 * ```
 *
 * @param path - A repo-relative path as `git diff --name-only` prints it.
 * @returns Whether the path carries no code the heavy matrix must prove.
 * @category predicates
 * @since 0.0.0
 */
export const isHeavyDocsOnlyPath = S.is(S.String.check(S.isPattern(heavyDocsOnlyPattern)));

/**
 * Convention-owned goal prose accepted by the pre-runtime profile adapter.
 *
 * **Example** (Classify goal prose)
 *
 * ```ts
 * import { CiGoalDocument } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiGoalDocument)("goals/demo/PLAN.md")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiGoalDocument = S.String.check(S.isPattern(new RegExp(ciOperationalPatterns.goals, "u"))).pipe(
  $I.annoteSchema("CiGoalDocument", { description: "Goal prose paths shared with the pre-runtime adapter." })
);
/**
 * Convention-owned goal prose accepted by the pre-runtime profile adapter.
 *
 * **Example** (Classify goal prose)
 *
 * ```ts
 * import { CiGoalDocument } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiGoalDocument)("goals/demo/PLAN.md")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiGoalDocument = typeof CiGoalDocument.Type;

/**
 * Desktop Cargo inputs and their hosted gate owners.
 *
 * **Example** (Classify Cargo input)
 *
 * ```ts
 * import { CiDesktopInput } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiDesktopInput)("apps/professional-desktop/src-tauri/Cargo.toml")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiDesktopInput = S.String.check(S.isPattern(new RegExp(ciOperationalPatterns.desktop, "u"))).pipe(
  $I.annoteSchema("CiDesktopInput", { description: "Paths affecting the desktop Rust gate." })
);
/**
 * Desktop Cargo inputs and their hosted gate owners.
 *
 * **Example** (Classify Cargo input)
 *
 * ```ts
 * import { CiDesktopInput } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiDesktopInput)("apps/professional-desktop/src-tauri/Cargo.toml")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiDesktopInput = typeof CiDesktopInput.Type;

/**
 * Safe resource lane names used as metric basenames.
 *
 * **Example** (Guard a lane name)
 *
 * ```ts
 * import { CiResourceLane } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiResourceLane)("check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiResourceLane = S.String.check(S.isPattern(/^[a-z][a-z0-9-]{0,63}$/u)).pipe(
  $I.annoteSchema("CiResourceLane", { description: "Safe metric basename for a runner resource lane." })
);
/**
 * Safe resource lane names used as metric basenames.
 *
 * **Example** (Guard a lane name)
 *
 * ```ts
 * import { CiResourceLane } from "@beep/repo-cli/commands/Ci"
 * import * as S from "effect/Schema"
 * console.log(S.is(CiResourceLane)("check")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CiResourceLane = typeof CiResourceLane.Type;

/**
 * Lane profiles exported to GitHub and the shell adapter.
 *
 * **Example** (Construct a profile)
 *
 * ```ts
 * import { CiChangeProfile } from "@beep/repo-cli/commands/Ci"
 * console.log(CiChangeProfile.make({ goalsOnly: false, docsOnly: false, desktopRustRelevant: true }).goalsOnly)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiChangeProfile extends S.Opaque<CiChangeProfile, { readonly brand: unique symbol }>()(
  S.Struct({ goalsOnly: S.Boolean, docsOnly: S.Boolean, desktopRustRelevant: S.Boolean }).pipe(
    $I.annoteSchema("CiChangeProfile", { description: "Hosted goals, docs-only and Rust lane execution profile." })
  )
) {}

/**
 * One host-wide resource sample; values are KiB, ticks and pages.
 *
 * **Example** (Construct a sample)
 *
 * ```ts
 * import { CiResourceSample } from "@beep/repo-cli/commands/Ci"
 * console.log(CiResourceSample.make({ epoch: 1, total: 10, available: 8, cpu: 10, idle: 8, swapIn: 0, swapOut: 0 }).total)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiResourceSample extends S.Opaque<CiResourceSample, { readonly brand: unique symbol }>()(
  S.Struct({
    epoch: S.Finite,
    total: S.Finite.check(S.isGreaterThan(0)),
    available: S.Finite.check(S.isGreaterThan(0)),
    cpu: S.Finite,
    idle: S.Finite,
    swapIn: S.Finite,
    swapOut: S.Finite,
  }).pipe($I.annoteSchema("CiResourceSample", { description: "Host-wide procfs counters for runner measurement." }))
) {}

const CiEnvironmentMode = LiteralKit([
  "not requested",
  "local-only",
  "read-write (trusted push)",
  "read-only (same-repository pull request)",
  "exported (trusted push)",
  "blank",
]);

/**
 * A sanitized mode label alongside redacted GitHub environment entries.
 *
 * **Example** (Construct an unrequested export)
 *
 * ```ts
 * import { CiEnvironmentSelection } from "@beep/repo-cli/commands/Ci"
 * console.log(CiEnvironmentSelection.make({ mode: "not requested", entries: [] }).mode)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiEnvironmentSelection extends S.Opaque<CiEnvironmentSelection, { readonly brand: unique symbol }>()(
  S.Struct({ mode: CiEnvironmentMode, entries: S.Array(S.Tuple([S.String, S.Redacted(S.String)])) }).pipe(
    $I.annoteSchema("CiEnvironmentSelection", {
      description: "Trusted event export selection with values kept redacted.",
    })
  )
) {}
