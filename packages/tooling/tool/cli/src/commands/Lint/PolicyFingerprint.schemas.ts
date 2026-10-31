/**
 * Schemas for the per-task lint policy fingerprint declaration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Lint/PolicyFingerprint.schemas");

/**
 * A fingerprint computation or materialization failed.
 *
 * **Example** (Construct a fingerprint error)
 *
 * ```ts
 * import { PolicyFingerprintError } from "@beep/repo-cli/commands/Lint"
 *
 * const error = PolicyFingerprintError.make({ message: "Cannot read turbo.json", cause: "turbo.json" })
 * console.log(error._tag) // "PolicyFingerprintError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PolicyFingerprintError extends S.TaggedError<PolicyFingerprintError, { readonly brand: unique symbol }>()(
  $I`PolicyFingerprintError`,
  {
    message: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annoteError<PolicyFingerprintError>("PolicyFingerprintError", {
    description: "Reading, computing or writing the per-task policy fingerprint failed.",
  })
) {}

/**
 * The name of one generated seal task: `//#lint:policy-fingerprint:<key>`.
 *
 * **Example** (Accept a key)
 *
 * ```ts
 * import { PolicyFingerprintKey } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PolicyFingerprintKey)("lint-laws")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PolicyFingerprintKey = S.String.check(S.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).pipe(
  $I.annoteSchema("PolicyFingerprintKey", {
    description: "Kebab-case slug of the command path a seal task fingerprints.",
  })
);

/**
 * Decoded {@link PolicyFingerprintKey} value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PolicyFingerprintKey = typeof PolicyFingerprintKey.Type;

/**
 * One seal task: a command-path prefix, the policy tasks whose path ends
 * there, and the code that prefix's command reaches beyond its parent seals.
 *
 * **Details**
 *
 * Seals chain along the command path (`quality` → `quality-fallow`), each
 * depending on its parent, so a group module's imports are declared once.
 *
 * **Example** (Describe a seal task)
 *
 * ```ts
 * import { PolicyFingerprintEntry } from "@beep/repo-cli/commands/Lint"
 *
 * const entry = PolicyFingerprintEntry.make({
 *   key: "topo-sort",
 *   command: ["topo-sort"],
 *   module: "packages/tooling/tool/cli/src/commands/TopoSort/TopoSort.command.ts",
 *   parent: "shared",
 *   tasks: ["//#topo-sort"],
 *   inputs: ["packages/tooling/tool/cli/src/commands/TopoSort/TopoSort.command.ts"],
 * })
 * console.log(entry.key) // "topo-sort"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PolicyFingerprintEntry extends S.Opaque<PolicyFingerprintEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    key: PolicyFingerprintKey.pipe($I.annoteKey("PolicyFingerprintEntry.key", { description: "Seal task suffix." })),
    command: S.Array(S.String).pipe(
      $I.annoteKey("PolicyFingerprintEntry.command", {
        description: "The beep command-path prefix this seal covers, root excluded.",
      })
    ),
    module: S.String.pipe(
      $I.annoteKey("PolicyFingerprintEntry.module", {
        description: "The module defining the command this prefix ends at.",
      })
    ),
    parent: S.String.pipe(
      $I.annoteKey("PolicyFingerprintEntry.parent", {
        description: "The seal this one depends on: the nearest ancestor prefix with inputs, or `shared`.",
      })
    ),
    tasks: S.Array(S.String).pipe(
      $I.annoteKey("PolicyFingerprintEntry.tasks", {
        description: "Turbo task ids whose command path ends at this seal.",
      })
    ),
    inputs: S.Array(S.String).pipe(
      $I.annoteKey("PolicyFingerprintEntry.inputs", {
        description: "What this prefix's command reaches beyond its parent seals, in string order.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PolicyFingerprintEntry", {
      description: "One generated seal task of the per-task policy fingerprint.",
    })
  )
) {}

/**
 * The generated per-task fingerprint declaration in
 * `standards/policy-tools.fingerprint.json`.
 *
 * **Details**
 *
 * `shared` seals what every command loads (the CLI shell, the root command
 * module, root checker configuration, the root manifest); each entry seals
 * what one command-path prefix reaches beyond its parents. `check` is the input set of the drift check task,
 * which no policy task depends on.
 *
 * **Example** (Recognize a missing declaration)
 *
 * ```ts
 * import { PolicyToolsFingerprint } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PolicyToolsFingerprint)(undefined)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PolicyToolsFingerprint extends S.Opaque<PolicyToolsFingerprint, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("policy-tools-fingerprint/v2"),
    shared: S.Array(S.String).pipe(
      $I.annoteKey("PolicyToolsFingerprint.shared", {
        description: "Inputs of the shared seal task every entry depends on.",
      })
    ),
    sharedTasks: S.Array(S.String).pipe(
      $I.annoteKey("PolicyToolsFingerprint.sharedTasks", {
        description: "Policy tasks whose command reaches nothing beyond the shared seal.",
      })
    ),
    check: S.Array(S.String).pipe(
      $I.annoteKey("PolicyToolsFingerprint.check", {
        description: "Inputs of the drift check task: every workspace a seal reaches and the policy task manifests.",
      })
    ),
    entries: S.Array(PolicyFingerprintEntry).pipe(
      $I.annoteKey("PolicyToolsFingerprint.entries", { description: "Seal tasks in key order." })
    ),
  }).pipe(
    $I.annoteSchema("PolicyToolsFingerprint", {
      description: "Generated per-task code inputs of the lint policy tasks.",
    })
  )
) {}

/**
 * One workspace package the import graph can enter: its directory and raw
 * `exports` / `imports` maps.
 *
 * **Example** (Describe a workspace)
 *
 * ```ts
 * import { PolicyWorkspace } from "@beep/repo-cli/commands/Lint"
 * import * as S from "effect/Schema"
 *
 * const workspace = { name: "@beep/x", directory: "packages/x", exports: { ".": "./src/index.ts" }, imports: undefined }
 * console.log(S.is(PolicyWorkspace)(workspace)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PolicyWorkspace extends S.Opaque<PolicyWorkspace, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    directory: S.String,
    exports: S.Unknown,
    imports: S.Unknown,
  }).pipe(
    $I.annoteSchema("PolicyWorkspace", {
      description: "A workspace package's directory and its raw exports and imports maps.",
    })
  )
) {}

/**
 * The fixed entry points of the CLI being fingerprinted.
 *
 * **Example** (Describe the repo CLI layout)
 *
 * ```ts
 * import { PolicyCliLayout } from "@beep/repo-cli/commands/Lint"
 *
 * const layout = PolicyCliLayout.make({
 *   shell: ["cli/src/bin.ts"],
 *   rootModule: "cli/src/commands/Root.ts",
 *   rootBinding: "rootCommand",
 *   commandsDirectory: "cli/src/commands",
 * })
 * console.log(layout.rootBinding) // "rootCommand"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PolicyCliLayout extends S.Opaque<PolicyCliLayout, { readonly brand: unique symbol }>()(
  S.Struct({
    shell: S.Array(S.String).pipe(
      $I.annoteKey("PolicyCliLayout.shell", { description: "Modules the bin loads for every invocation." })
    ),
    rootModule: S.String.pipe(
      $I.annoteKey("PolicyCliLayout.rootModule", { description: "The module that defines the root command." })
    ),
    rootBinding: S.String.pipe(
      $I.annoteKey("PolicyCliLayout.rootBinding", { description: "The root command's binding in its module." })
    ),
    commandsDirectory: S.String.pipe(
      $I.annoteKey("PolicyCliLayout.commandsDirectory", {
        description: "Directory of every command module; the shell walk never enters it.",
      })
    ),
  }).pipe($I.annoteSchema("PolicyCliLayout", { description: "Entry points of the CLI being fingerprinted." }))
) {}

/**
 * One resolved command on an argv path.
 *
 * **Example** (Describe a command node)
 *
 * ```ts
 * import { PolicyCommandNode } from "@beep/repo-cli/commands/Lint"
 *
 * const node = PolicyCommandNode.make({ module: "cli/src/commands/Lint/LintLaws.command.ts", binding: "lintLawsCommand", name: "laws" })
 * console.log(node.name) // "laws"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PolicyCommandNode extends S.Opaque<PolicyCommandNode, { readonly brand: unique symbol }>()(
  S.Struct({
    module: S.String,
    binding: S.String,
    name: S.String,
  }).pipe(
    $I.annoteSchema("PolicyCommandNode", {
      description: "A command on an argv path: its defining module, binding and command name.",
    })
  )
) {}

/**
 * The modules a fingerprint key reaches.
 *
 * **Example** (Describe an empty closure)
 *
 * ```ts
 * import { PolicyClosure } from "@beep/repo-cli/commands/Lint"
 * import * as HashSet from "effect/HashSet"
 *
 * const closure = PolicyClosure.make({ modules: HashSet.empty(), opaqueWorkspaces: HashSet.empty() })
 * console.log(HashSet.size(closure.modules)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PolicyClosure extends S.Opaque<PolicyClosure, { readonly brand: unique symbol }>()(
  S.Struct({
    modules: S.HashSet(S.String).pipe(
      $I.annoteKey("PolicyClosure.modules", { description: "Every module reached, repo-relative." })
    ),
    opaqueWorkspaces: S.HashSet(S.String).pipe(
      $I.annoteKey("PolicyClosure.opaqueWorkspaces", {
        description: "Workspace directories holding a reached non-literal dynamic import.",
      })
    ),
  }).pipe($I.annoteSchema("PolicyClosure", { description: "The modules one fingerprint key reaches." }))
) {}
