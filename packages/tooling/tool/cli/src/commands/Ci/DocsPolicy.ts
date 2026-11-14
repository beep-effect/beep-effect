/**
 * The Docs Policy lane's task set: the root Turbo tasks a documentation-only diff can fail.
 *
 * **Details**
 *
 * A docs_only pull request (`beep ci change-profile`) never starts Heavy / Lint Policy, which runs
 * the knowledge, packet and Markdown policy for code PRs and main pushes. The Docs Policy job
 * (check.yml `docs-policy`, route-soundness-repair ROUT-02, exploration ruling D8) runs these tasks
 * on those pull requests instead. Repo Sanity's documentation path keeps the public-repo home path
 * law and the changeset checks as a required context.
 *
 * `packages/tooling/tool/cli/test/ci-docs-policy.test.ts` derives the obligation from `turbo.json`:
 * every root task whose inputs match a docs-classified path, and every uncached root task (its
 * inputs are uncertified), must appear in {@link DOCS_POLICY_ROOT_TASKS} or carry a reason in
 * {@link DOCS_POLICY_EXCLUSIONS}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Ci/DocsPolicy");

/**
 * Root Turbo tasks the Docs Policy lane runs on documentation-only pull requests.
 *
 * **Example** (The lane runs the knowledge reference check)
 *
 * ```ts
 * import { DOCS_POLICY_ROOT_TASKS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(DOCS_POLICY_ROOT_TASKS.includes("knowledge:refs-check")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DOCS_POLICY_ROOT_TASKS = [
  "goals:doctor",
  "goals:index-check",
  "knowledge:refs-check",
  "knowledge:semantic-delta",
  "lint:effect-imports-markdown",
  "lint:entity-kit-freeze",
  "lint:holds",
  "lint:jsdoc-module-tags",
  "lint:judge-rubric",
  "lint:markdown-fences",
  "lint:no-tracked-python",
  "lint:reflection-artifacts",
  "lint:retired-effect-paths",
  "lint:retired-iri-authorities",
  "lint:roadmap-refs",
  "lint:schema-tag-idioms",
  "lint:tracked-shell-allowlist",
  "lint:typos",
] as const;

/**
 * A root Turbo task the Docs Policy lane deliberately does not run, with the reason.
 *
 * **Example** (Record an exclusion)
 *
 * ```ts
 * import { DocsPolicyExclusion } from "@beep/repo-cli/commands/Ci"
 *
 * const row = DocsPolicyExclusion.make({ task: "lint:shadcn", reason: "Reads UI sources only." })
 * console.log(row.task) // "lint:shadcn"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocsPolicyExclusion extends S.Opaque<DocsPolicyExclusion, { readonly brand: unique symbol }>()(
  S.Struct({
    task: S.NonEmptyString.annotateKey({ description: "Root Turbo task name, without the `//#` prefix." }),
    reason: S.NonEmptyString.annotateKey({
      description: "Why a documentation-only diff cannot fail the task, or which lane already runs it.",
    }),
  }).pipe(
    $I.annoteSchema("DocsPolicyExclusion", {
      description: "A root Turbo task outside the Docs Policy lane and the reason it may stay out.",
    })
  )
) {}

const FALLOW_REASON =
  "Fallow parses JavaScript, TypeScript, JSON, HTML and CSS module sources of the workspace graph; its `.claude/skills/**` input glob covers skill scripts, and Markdown or prose under a docs root is no module source.";

const fallowTasks = [
  "fallow:audit:check",
  "fallow:boundaries:advisory",
  "fallow:boundaries:config-check",
  "fallow:dead-code:check",
  "fallow:fix-preview:advisory",
  "fallow:flags:advisory",
  "fallow:health:advisory",
  "fallow:health:check",
  "fallow:security:advisory",
] as const;

/**
 * Root Turbo tasks that read docs-classified paths or are uncached, kept out of Docs Policy.
 *
 * **Example** (Repo Sanity keeps the home path law)
 *
 * ```ts
 * import { DOCS_POLICY_EXCLUSIONS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(DOCS_POLICY_EXCLUSIONS.some((row) => row.task === "lint:private-home-paths")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DOCS_POLICY_EXCLUSIONS: ReadonlyArray<DocsPolicyExclusion> = [
  DocsPolicyExclusion.make({
    task: "lint:private-home-paths",
    reason: "Repo Sanity's documentation path runs the law, so it stays on a required context.",
  }),
  DocsPolicyExclusion.make({
    task: "repo-sanity:changeset-graph",
    reason: "Repo Sanity's documentation path runs `beep quality changeset-graph` on the same diffs.",
  }),
  DocsPolicyExclusion.make({
    task: "changeset:status",
    reason:
      "Repo Sanity's documentation path runs the path-aware `beep quality changeset-status --since origin/main` wrapper instead.",
  }),
  DocsPolicyExclusion.make({
    task: "lint:oxlint",
    reason: "oxlint lints JavaScript and TypeScript sources and honors `.gitignore` files, all code-route shapes.",
  }),
  DocsPolicyExclusion.make({
    task: "lint:opaque-roundtrips",
    reason: "Reads TypeScript sources and tsconfig files, all code-route shapes.",
  }),
  DocsPolicyExclusion.make({
    task: "lint:shadcn",
    reason: "Lints class names in apps/ and packages/ JSX, TSX and CSS against .oxlintrc.shadcn.json.",
  }),
  DocsPolicyExclusion.make({
    task: "repo-sanity:bun-audit",
    reason: "Audits bun.lock, a code-route manifest, against the live advisory database; main pushes keep that signal.",
  }),
  ...A.map(fallowTasks, (task) => DocsPolicyExclusion.make({ task, reason: FALLOW_REASON })),
];
