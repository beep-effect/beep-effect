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
 * The hosted check.yml lanes whose job-level relevance the change profile reports.
 *
 * **Details**
 *
 * Each id is emitted as `<id>_relevant=true|false` by `beep ci change-profile`, and each
 * check.yml job guards on `!= 'false'`, so a binary or pattern file that predates a lane
 * leaves the lane running.
 *
 * **Example** (List the relevance lanes)
 *
 * ```ts
 * import { CI_RELEVANCE_LANE_VALUES } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CI_RELEVANCE_LANE_VALUES.includes("sast")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_RELEVANCE_LANE_VALUES = ["codegen", "ecosystem", "nix", "desktop_ipc", "sast", "security"] as const;

/**
 * A check.yml lane whose relevance the change profile decides before runner allocation.
 *
 * **Example** (Guard a relevance lane id)
 *
 * ```ts
 * import { CiRelevanceLane } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(CiRelevanceLane.is.sast("sast")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CiRelevanceLane = LiteralKit(CI_RELEVANCE_LANE_VALUES).pipe(
  $I.annoteSchema("CiRelevanceLane", {
    description: "A hosted lane whose job-level relevance the change profile reports.",
  })
);

/**
 * The decoded type of {@link CiRelevanceLane}.
 *
 * @category models
 * @since 0.0.0
 */
export type CiRelevanceLane = typeof CiRelevanceLane.Type;

const relevancePattern = (lane: CiRelevanceLane) =>
  S.optionalKey(
    S.NonEmptyString.annotateKey({
      description: `Changed paths that make the ${lane} lane relevant; an absent key keeps the lane running.`,
    })
  );

/**
 * Per-lane relevance expressions over repo-relative changed paths.
 *
 * **Details**
 *
 * Every key is optional: a pattern file without a lane's key classifies that lane as
 * relevant, so an older checkout never skips a lane it cannot describe.
 *
 * **Example** (Describe one lane)
 *
 * ```ts
 * import { CiLaneRelevancePatterns } from "@beep/repo-cli/commands/Ci"
 *
 * const lanes = CiLaneRelevancePatterns.make({ nix: "^flake\\.(nix|lock)$" })
 * console.log(lanes.nix) // "^flake\\.(nix|lock)$"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneRelevancePatterns extends S.Opaque<CiLaneRelevancePatterns, { readonly brand: unique symbol }>()(
  S.Struct({
    codegen: relevancePattern("codegen"),
    ecosystem: relevancePattern("ecosystem"),
    nix: relevancePattern("nix"),
    desktop_ipc: relevancePattern("desktop_ipc"),
    sast: relevancePattern("sast"),
    security: relevancePattern("security"),
  }).pipe(
    $I.annoteSchema("CiLaneRelevancePatterns", {
      description: "Changed-path expressions that make each check.yml relevance lane run.",
    })
  )
) {}

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
    lanes: S.optionalKey(
      CiLaneRelevancePatterns.annotateKey({
        description: "Per-lane relevance expressions; absent lanes stay relevant.",
      })
    ),
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
 * One goal-packet path family that a test consumes, kept off the docs-only route.
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
 * Goal-packet paths that tests read, spawn or import, or that a package `turbo.json` declares.
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
    pattern: "^goals/[^/]+/ops/.+\\.ts$",
    reference: "goals/*/ops/**/*.ts",
    consumers: ["@beep/repo-cli"],
    modes: ["import"],
    evidence: ["packages/tooling/tool/cli/test/goals-ops-typecheck.test.ts"],
  }),
];

// JavaScript and TypeScript sources and their module variants.
const JS_TS_SOURCES = "^.*\\.[cm]?[jt]sx?$";
// Dependency manifests and lockfiles: every file GitHub's dependency graph recognizes (dependency
// review compares them all, docs.github.com "Dependency graph supported package ecosystems"),
// plus the Bun, uv and Go checksum files OSV and the workspace install read. Case variants are
// spelled out because the graph matches some names case-insensitively.
const DEPENDENCY_MANIFESTS = `^(.*/)?(${A.join(
  [
    "package\\.json",
    "package-lock\\.json",
    "npm-shrinkwrap\\.json",
    "bun\\.lockb?",
    "yarn\\.lock",
    "pnpm-lock\\.yaml",
    "deno\\.(lock|jsonc?)",
    "[Cc]omposer\\.(json|lock)",
    "pom\\.xml",
    "[^/]*\\.gradle(\\.kts)?",
    "gradle\\.lockfile",
    "[Cc]argo\\.(toml|lock)",
    "go\\.(mod|sum|work)",
    "[Gg]emfile(\\.lock)?",
    "[^/]*\\.gemspec",
    "[Pp]ipfile(\\.lock)?",
    "requirements[^/]*\\.txt",
    "requirements/[^/]*\\.txt",
    "setup\\.py",
    "pyproject\\.toml",
    "poetry\\.lock",
    "uv\\.lock",
    "pubspec\\.(yaml|lock)",
    "Package\\.(swift|resolved)",
    "[^/]*\\.(csproj|vbproj|fsproj|vcxproj|nuspec)",
    "packages\\.config",
    "packages\\.lock\\.json",
    "Directory\\.Packages\\.props",
    "(Manifest|Project)\\.toml",
    "MODULE\\.bazel(\\.lock)?",
    "[^/]*\\.MODULE\\.bazel",
    "WORKSPACE",
    "maven_install\\.json",
    "\\.terraform\\.lock\\.hcl",
    "[^/]*\\.(tf|tofu)",
    "mix\\.(exs|lock)",
  ],
  "|"
)})$`;
// The workspace closure of @beep/repo-cli, which implements every source-dispatched hosted check
// (`bun run beep ...`): Security's dependency review and GitHub policy reads, SAST's dispatcher.
// `packages/tooling/tool/cli/test/ci-docs-policy.test.ts` walks the workspace dependency graph and
// fails when a closure member falls outside these roots. The root runtime configuration `bun run`
// resolves modules and scripts through is included.
const REPO_CLI_RUNTIME_CLOSURE = A.join(
  [
    "^packages/(tooling|foundation|drivers)/",
    "^packages/ecosystem/effect-drizzle/",
    "^packages/shared/domain/",
    "^tools/tsgo-shim/",
    "^(tsconfig[^/]*\\.json|bunfig\\.toml|\\.bun-version|package\\.json|bun\\.lock)$",
  ],
  "|"
);

/**
 * File shapes that stay on the code route wherever they sit, docs roots included.
 *
 * **Details**
 *
 * Each row is an anchored, `grep -E` compatible expression joined into
 * {@link ciOperationalPatterns}' `codeRoots`. The docs roots (`docs/`, `goals/<slug>/`,
 * `explorations/`, `research/`) hold scripts and tool configuration as well as prose, and hosted
 * lanes read those files anywhere in the tree: SAST scans changed JavaScript and TypeScript,
 * dependency review and OSV read manifests and lockfiles, and the tsconfig sync, schema-first,
 * oxlint, tsgo, Biome, Turbo, docgen and shadcn tasks glob their configuration repo-wide
 * (every `tsconfig*.json` and `.gitignore`, for example). The docs-policy completeness test in
 * `packages/tooling/tool/cli/test/ci-docs-policy.test.ts` checks every root Turbo task against
 * the docs-classified tree, so a new reader of a docs-classified shape fails the suite instead of
 * skipping silently.
 *
 * **Example** (Keep a goal-folder tsconfig on the code route)
 *
 * ```ts
 * import { ciCodeShapedPathPatterns } from "@beep/repo-cli/commands/Ci"
 * import * as A from "effect/Array"
 *
 * const coded = A.some(ciCodeShapedPathPatterns, (row) => new RegExp(row, "u").test("goals/demo/ops/tsconfig.json"))
 * console.log(coded) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const ciCodeShapedPathPatterns: A.NonEmptyReadonlyArray<string> = [
  JS_TS_SOURCES,
  DEPENDENCY_MANIFESTS,
  // Tool configuration that repo-wide globs read.
  "^(.*/)?(\\.gitignore|\\.gitattributes|tsconfig[^/]*\\.json|jsconfig[^/]*\\.json|biome[^/]*\\.jsonc?|turbo\\.jsonc?|docgen\\.json|components\\.json|\\.oxlintrc[^/]*)$",
];

// Every relevance lane also runs when its own gate can change: the lane bodies, the pattern data
// and classifier, and the workflow that hosts the job.
const CI_GATE_SOURCES =
  "^packages/tooling/tool/cli/src/commands/Ci/(CiLane\\.ts$|CiOperational)|^\\.github/workflows/check\\.yml$";
const relevance = (...rows: A.NonEmptyReadonlyArray<string>): string => A.join([...rows, CI_GATE_SOURCES], "|");

/**
 * Canonical CI patterns; `ci patterns --write` owns their pre-runtime JSON projection.
 *
 * **Details**
 *
 * `lanes` carries each relevance lane's inputs. The rows for Codegen Drift, Ecosystem Contracts,
 * Nix Shell and Professional Desktop IPC Stdio are the path gates those jobs applied after
 * checkout. SAST reads changed JavaScript and TypeScript, its Semgrep rules and the
 * @beep/repo-cli workspace closure that dispatches it. Security reads every dependency-graph
 * manifest, the OSV configuration, the workflows and the same closure, which implements its GitHub
 * policy reads; its live-advisory signal stays on every main push, which always gets the full
 * profile.
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
  // Product roots, code-shaped files and the goal-data consumer rows remain excluded by
  // codeRoots even inside a docs root.
  docs: "^docs/|^goals/[^/]+/|^explorations/|^research/|^\\.changeset/[^/]+\\.md$|\\.md$",
  codeRoots: A.join(
    ["^(packages|apps|infra)/", ...ciCodeShapedPathPatterns, ...A.map(ciGoalDataConsumers, (row) => row.pattern)],
    "|"
  ),
  lanes: CiLaneRelevancePatterns.make({
    // Root dependency resolution changes the resolved generator or formatter, so the root
    // manifest and lockfile are drift inputs. The job also verifies the regenerate merge-driver
    // bootstrap, which reads .gitattributes and the git and worktree commands.
    codegen: relevance(
      // Each driver's manifest defines its `generate:check` script.
      "^packages/drivers/(acp|ecfr|govinfo|runpod)/(package\\.json$|openapi[^/]*\\.json|spec/|scripts/|src/_generated/)",
      "^packages/tooling/library/codegen-kit/",
      "^packages/_internal/db-admin/drizzle/",
      "^apps/professional-desktop/(package\\.json|scripts/sync-migration-bundle\\.ts|src/runtime/Migrations\\.gen\\.ts)$",
      "^(package\\.json|bun\\.lock)$",
      "^\\.gitattributes$",
      "^packages/tooling/tool/cli/src/commands/(Git|Worktree)/"
    ),
    // The ecosystem family imports no workspace package: its inputs are the family, the resolved
    // toolchain and the lane body.
    ecosystem: relevance("^packages/ecosystem/", "^(package\\.json|bun\\.lock|tsconfig\\.base\\.json|\\.bun-version)$"),
    nix: relevance("^flake\\.(nix|lock)$"),
    desktop_ipc: relevance(
      "^apps/professional-desktop/",
      "^packages/(foundation/|(agents|workspace|shared|epistemic)(/|-)|drivers/(pglite|postgres)/)",
      "^\\.github/actions/setup-monorepo-ci/",
      "^(bun\\.lock|package\\.json|turbo\\.json)$"
    ),
    // Semgrep scans changed JavaScript and TypeScript; its rules, its setup and the CLI closure that
    // dispatches it are inputs too.
    sast: relevance(
      JS_TS_SOURCES,
      "^\\.semgrep/",
      "^\\.semgrepignore$",
      "^\\.github/actions/setup-bun/",
      REPO_CLI_RUNTIME_CLOSURE
    ),
    // OSV and dependency review read manifests; the GitHub policy reads run through the CLI closure
    // against the expected contexts and the workflow.
    security: relevance(
      DEPENDENCY_MANIFESTS,
      "^osv-scanner\\.toml$",
      "^\\.github/",
      "^standards/branch-protection-contexts\\.json$",
      REPO_CLI_RUNTIME_CLOSURE
    ),
  }),
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
 * Whether each relevance lane must run for a change.
 *
 * **Example** (Mark every lane relevant)
 *
 * ```ts
 * import { CiLaneRelevance } from "@beep/repo-cli/commands/Ci"
 *
 * const all = CiLaneRelevance.make({
 *   codegen: true, ecosystem: true, nix: true, desktop_ipc: true, sast: true, security: true,
 * })
 * console.log(all.sast) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiLaneRelevance extends S.Opaque<CiLaneRelevance, { readonly brand: unique symbol }>()(
  S.Struct({
    codegen: S.Boolean,
    ecosystem: S.Boolean,
    nix: S.Boolean,
    desktop_ipc: S.Boolean,
    sast: S.Boolean,
    security: S.Boolean,
  }).pipe($I.annoteSchema("CiLaneRelevance", { description: "Job-level relevance of each check.yml relevance lane." }))
) {}

/**
 * Lane profiles exported to GitHub and the shell adapter.
 *
 * **Example** (Construct a profile)
 *
 * ```ts
 * import { CiChangeProfile, CiLaneRelevance } from "@beep/repo-cli/commands/Ci"
 *
 * const lanes = CiLaneRelevance.make({
 *   codegen: true, ecosystem: true, nix: true, desktop_ipc: true, sast: true, security: true,
 * })
 * console.log(CiChangeProfile.make({ goalsOnly: false, docsOnly: false, desktopRustRelevant: true, lanes }).goalsOnly)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiChangeProfile extends S.Opaque<CiChangeProfile, { readonly brand: unique symbol }>()(
  S.Struct({ goalsOnly: S.Boolean, docsOnly: S.Boolean, desktopRustRelevant: S.Boolean, lanes: CiLaneRelevance }).pipe(
    $I.annoteSchema("CiChangeProfile", {
      description: "Hosted goals, docs-only, Rust and per-lane execution profile.",
    })
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
