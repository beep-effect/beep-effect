/**
 * Canonical task bindings and lossless package scripts codecs.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

const $I = $RepoCliId.create("internal/package-scripts/PackageScripts.schemas");
/**
 * Version selecting the canonical task binding contract.
 *
 * **Example** (Inspect PackageScriptsRuleVersion)
 *
 * ```ts
 * import { PackageScriptsRuleVersion } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(PackageScriptsRuleVersion)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PackageScriptsRuleVersion = S.Literal("package-scripts-rules/v1").pipe(
  $I.annoteSchema("PackageScriptsRuleVersion", {
    description: "Version selecting the canonical task binding contract.",
  })
);
/** Decoded PackageScriptsRuleVersion value. @category type-level @since 0.0.0 */
export type PackageScriptsRuleVersion = typeof PackageScriptsRuleVersion.Type;

/**
 * Workspace classifications selecting task presence.
 *
 * **Example** (Inspect PackageKind)
 *
 * ```ts
 * import { PackageKind } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(PackageKind)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PackageKind = LiteralKit(["library", "tool", "ecosystem", "app", "lab", "infra", "exempt"]).pipe(
  $I.annoteSchema("PackageKind", { description: "Workspace classifications selecting task presence." })
);
/** Decoded PackageKind value. @category type-level @since 0.0.0 */
export type PackageKind = typeof PackageKind.Type;

/**
 * Task-facing keys governed by strict bindings.
 *
 * **Example** (Inspect TaskScriptName)
 *
 * ```ts
 * import { TaskScriptName } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(TaskScriptName)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskScriptName = LiteralKit([
  "build",
  "check",
  "lint",
  "lint:fix",
  "test",
  "test:property",
  "test:integration",
  "test:integration:parallel",
  "coverage",
  "docgen",
  "audit",
  "package-test-typecheck",
  "codegen",
  "lint:deprecated-apis",
  "lint:jsdoc",
  "lint:laws",
  "doctest",
]).pipe($I.annoteSchema("TaskScriptName", { description: "Task-facing keys governed by strict bindings." }));
/** Decoded TaskScriptName value. @category type-level @since 0.0.0 */
export type TaskScriptName = typeof TaskScriptName.Type;

/**
 * Package-owned implementation keys whose values remain free.
 *
 * **Example** (Inspect ImplScriptName)
 *
 * ```ts
 * import { ImplScriptName } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(ImplScriptName)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ImplScriptName = LiteralKit([
  "beep:build",
  "beep:check",
  "beep:lint",
  "beep:lint:fix",
  "beep:test",
  "beep:test:integration",
  "beep:docgen",
  "beep:audit",
  "beep:doctest",
]).pipe(
  $I.annoteSchema("ImplScriptName", { description: "Package-owned implementation keys whose values remain free." })
);
/** Decoded ImplScriptName value. @category type-level @since 0.0.0 */
export type ImplScriptName = typeof ImplScriptName.Type;

/**
 * Binding from a task to an implementation, CLI command, or package-owned text.
 *
 * **Example** (Inspect TaskScriptBinding)
 *
 * ```ts
 * import { TaskScriptBinding } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(TaskScriptBinding)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskScriptBinding = S.TaggedUnion({
  indirection: { impl: ImplScriptName, ifPresent: S.Boolean },
  cli: { command: S.String },
  owned: {},
}).pipe(
  $I.annoteSchema("TaskScriptBinding", {
    description: "Binding from a task to an implementation, CLI command, or package-owned text.",
  })
);
/** Decoded TaskScriptBinding value. @category type-level @since 0.0.0 */
export type TaskScriptBinding = typeof TaskScriptBinding.Type;

/**
 * Required, optional, forbidden, or evidence-derived task presence.
 *
 * **Example** (Inspect TaskScriptPresence)
 *
 * ```ts
 * import { TaskScriptPresence } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(TaskScriptPresence)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TaskScriptPresence = S.TaggedUnion({
  required: {},
  optional: {},
  absent: {},
  derived: { rule: LiteralKit(["doctest-sources", "codegen-generator"]) },
}).pipe(
  $I.annoteSchema("TaskScriptPresence", {
    description: "Required, optional, forbidden, or evidence-derived task presence.",
  })
);
/** Decoded TaskScriptPresence value. @category type-level @since 0.0.0 */
export type TaskScriptPresence = typeof TaskScriptPresence.Type;

/**
 * One task binding and presence rule for one workspace kind.
 *
 * **Example** (Inspect TaskScriptRule)
 *
 * ```ts
 * import { TaskScriptRule } from "@beep/repo-cli/test/PackageScripts"
 * console.log(TaskScriptRule.make({ kind: "app", name: "coverage", presence: { _tag: "optional" }, binding: { _tag: "owned" } }).name) // coverage
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskScriptRule extends S.Class<TaskScriptRule>($I`TaskScriptRule`)(
  { kind: PackageKind, name: TaskScriptName, presence: TaskScriptPresence, binding: TaskScriptBinding },
  $I.annote("TaskScriptRule", { description: "One task binding and presence rule for one workspace kind." })
) {}

/**
 * Implementation text stamped only when the key is missing.
 *
 * **Example** (Inspect ImplScriptDefault)
 *
 * ```ts
 * import { ImplScriptDefault } from "@beep/repo-cli/test/PackageScripts"
 * console.log(ImplScriptDefault.make({ kind: "app", name: "beep:lint", value: "biome check ." }).value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImplScriptDefault extends S.Class<ImplScriptDefault>($I`ImplScriptDefault`)(
  { kind: PackageKind, name: ImplScriptName, value: S.String },
  $I.annote("ImplScriptDefault", { description: "Implementation text stamped only when the key is missing." })
) {}

const isTaskScriptName = S.is(TaskScriptName);
const isImplScriptName = S.is(ImplScriptName);

const ExtraScriptName = S.String.check(
  S.makeFilter((key) => !isTaskScriptName(key) && !isImplScriptName(key), {
    identifier: $I`ExtraScriptName`,
    title: "Extra script name",
    description: "A script key outside the task and implementation tiers.",
    message: "Extra scripts cannot overlap task or implementation keys.",
  })
);
/**
 * Disjoint task, implementation, and extra tiers of a manifest scripts record.
 *
 * **Example** (Inspect ScriptsBlock)
 *
 * ```ts
 * import { ScriptsBlock } from "@beep/repo-cli/test/PackageScripts"
 * import * as HashMap from "effect/HashMap"
 * console.log(ScriptsBlock.make({ kind: "app", tasks: HashMap.empty(), impls: HashMap.empty(), extras: HashMap.empty() }).kind) // app
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScriptsBlock extends S.Class<ScriptsBlock>($I`ScriptsBlock`)(
  {
    kind: PackageKind,
    tasks: S.HashMap(TaskScriptName, S.String),
    impls: S.HashMap(ImplScriptName, S.String),
    extras: S.HashMap(ExtraScriptName, S.String),
  },
  $I.annote("ScriptsBlock", {
    description: "Disjoint task, implementation, and extra tiers of a manifest scripts record.",
  })
) {}

/**
 * Provides type-level companions for the encoded representation of a scripts block.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ScriptsBlock {
  /**
   * Encoded task, implementation, and extra script tiers accepted before schema decoding.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ScriptsBlock.Encoded;
}

/**
 * Flat JSON scripts record at the manifest boundary.
 *
 * **Example** (Inspect ScriptsRecord)
 *
 * ```ts
 * import { ScriptsRecord } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(ScriptsRecord)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScriptsRecord = S.Record(S.String, S.String).pipe(
  $I.annoteSchema("ScriptsRecord", { description: "Flat JSON scripts record at the manifest boundary." })
);
/** Decoded ScriptsRecord value. @category type-level @since 0.0.0 */
export type ScriptsRecord = typeof ScriptsRecord.Type;

/**
 * Losslessly partitions a flat scripts record and encodes tiers in stable key order.
 *
 * **Example** (Inspect scriptsBlockFromRecord)
 *
 * ```ts
 * import { scriptsBlockFromRecord } from "@beep/repo-cli/test/PackageScripts"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * const block = Effect.runSync(S.decodeUnknownEffect(scriptsBlockFromRecord("app"))({ dev: "vite" }))
 * console.log(block.kind) // app
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const scriptsBlockFromRecord = (kind: PackageKind) =>
  ScriptsRecord.pipe(
    S.decodeTo(
      ScriptsBlock,
      SchemaTransformation.transform({
        decode: (record) => {
          let tasks = HashMap.empty<TaskScriptName, string>();
          let impls = HashMap.empty<ImplScriptName, string>();
          let extras = HashMap.empty<string, string>();
          for (const [key, value] of R.toEntries(record)) {
            if (isTaskScriptName(key)) tasks = HashMap.set(tasks, key, value);
            else if (isImplScriptName(key)) impls = HashMap.set(impls, key, value);
            else extras = HashMap.set(extras, key, value);
          }
          return { kind, tasks, impls, extras };
        },
        encode: (block) =>
          R.fromEntries([
            ...A.sortWith(HashMap.toEntries(block.tasks), ([key]) => key, Order.String),
            ...A.sortWith(HashMap.toEntries(block.impls), ([key]) => key, Order.String),
            ...A.sortWith(HashMap.toEntries(block.extras), ([key]) => key, Order.String),
          ]),
      })
    )
  );
/**
 * Six actionable deviations from the canonical scripts contract.
 *
 * **Example** (Inspect PackageScriptsDrift)
 *
 * ```ts
 * import { PackageScriptsDrift } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(PackageScriptsDrift)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PackageScriptsDrift = S.TaggedUnion({
  "missing-task": { name: TaskScriptName },
  "unexpected-task": { name: TaskScriptName },
  "wrong-binding": { name: TaskScriptName, expected: S.String, actual: S.String },
  "missing-impl": { name: ImplScriptName },
  placeholder: { name: S.Literal("codegen"), actual: S.String },
  "derivation-conflict": { name: S.Literal("doctest"), reason: S.String },
}).pipe(
  $I.annoteSchema("PackageScriptsDrift", {
    description: "Six actionable deviations from the canonical scripts contract.",
  })
);
/** Decoded PackageScriptsDrift value. @category type-level @since 0.0.0 */
export type PackageScriptsDrift = typeof PackageScriptsDrift.Type;

/**
 * Non-negative number of workspace manifests examined.
 *
 * **Example** (Inspect ManifestCount)
 *
 * ```ts
 * import { ManifestCount } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(ManifestCount)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ManifestCount = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("ManifestCount", { description: "Non-negative number of workspace manifests examined." })
);
/** Decoded ManifestCount value. @category type-level @since 0.0.0 */
export type ManifestCount = typeof ManifestCount.Type;

/**
 * JSON report of checked manifests, drift, and written paths.
 *
 * **Example** (Inspect PackageScriptsReportWire)
 *
 * ```ts
 * import { PackageScriptsReportWire } from "@beep/repo-cli/test/PackageScripts"
 * console.log(PackageScriptsReportWire.make({ schemaVersion: "package-scripts-report/v1", rules: "package-scripts-rules/v1", manifests: 0, drift: {}, written: [] }).manifests) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageScriptsReportWire extends S.Class<PackageScriptsReportWire>($I`PackageScriptsReportWire`)(
  {
    schemaVersion: S.Literal("package-scripts-report/v1"),
    rules: PackageScriptsRuleVersion,
    manifests: ManifestCount,
    drift: S.Record(S.String, S.Array(PackageScriptsDrift)),
    written: S.Array(S.String),
  },
  $I.annote("PackageScriptsReportWire", { description: "JSON report of checked manifests, drift, and written paths." })
) {}

/**
 * Collection view of a scripts policy report.
 *
 * **Example** (Inspect PackageScriptsReport)
 *
 * ```ts
 * import { PackageScriptsReport } from "@beep/repo-cli/test/PackageScripts"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * console.log(PackageScriptsReport.make({ schemaVersion: "package-scripts-report/v1", rules: "package-scripts-rules/v1", manifests: 0, drift: HashMap.empty(), written: HashSet.empty() }).manifests) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageScriptsReport extends S.Class<PackageScriptsReport>($I`PackageScriptsReport`)(
  {
    schemaVersion: S.Literal("package-scripts-report/v1"),
    rules: PackageScriptsRuleVersion,
    manifests: ManifestCount,
    drift: S.HashMap(S.String, S.Array(PackageScriptsDrift)),
    written: S.HashSet(S.String),
  },
  $I.annote("PackageScriptsReport", { description: "Collection view of a scripts policy report." })
) {}

/**
 * Bidirectional codec between JSON-compatible reports and Effect collections.
 *
 * **Example** (Inspect PackageScriptsReportFromWire)
 *
 * ```ts
 * import { PackageScriptsReportFromWire } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(PackageScriptsReportFromWire)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PackageScriptsReportFromWire = PackageScriptsReportWire.pipe(
  S.decodeTo(
    PackageScriptsReport,
    SchemaTransformation.transform({
      decode: (wire) => ({
        ...wire,
        drift: HashMap.fromIterable(R.toEntries(wire.drift)),
        written: HashSet.fromIterable(wire.written),
      }),
      encode: (report) =>
        PackageScriptsReportWire.make({
          ...report,
          drift: R.fromEntries(A.sortWith(HashMap.toEntries(report.drift), ([key]) => key, Order.String)),
          written: A.sort(A.fromIterable(report.written), Order.String),
        }),
    })
  ),
  $I.annoteSchema("PackageScriptsReportFromWire", {
    description: "Bidirectional codec between JSON-compatible reports and Effect collections.",
  })
);
/** Decoded PackageScriptsReportFromWire value. @category type-level @since 0.0.0 */
export type PackageScriptsReportFromWire = typeof PackageScriptsReportFromWire.Type;

/**
 * Explicit generator registry independent of current manifest script presence.
 *
 * **Example** (Inspect CodegenGeneratorPackage)
 *
 * ```ts
 * import { CodegenGeneratorPackage } from "@beep/repo-cli/test/PackageScripts"
 * import * as S from "effect/Schema"
 * console.log(S.is(CodegenGeneratorPackage)(undefined)) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodegenGeneratorPackage = LiteralKit([
  "packages/tooling/policy-pack/repo-configs",
  "packages/foundation/modeling/identity",
  "apps/professional-desktop",
  "packages/drivers/runpod",
  "packages/drivers/govinfo",
  "packages/drivers/gov-legal-mcp",
  "packages/drivers/ecfr",
  "packages/drivers/box",
  "packages/drivers/acp",
]).pipe(
  $I.annoteSchema("CodegenGeneratorPackage", {
    description: "Explicit generator registry independent of current manifest script presence.",
  })
);
/** Decoded CodegenGeneratorPackage value. @category type-level @since 0.0.0 */
export type CodegenGeneratorPackage = typeof CodegenGeneratorPackage.Type;

/**
 * Canonical presence table in library, tool, ecosystem, app, lab, infra, and exempt order.
 *
 * **Example** (Inspect taskScriptRules)
 *
 * ```ts
 * import { taskScriptRules } from "@beep/repo-cli/test/PackageScripts"
 * console.log(taskScriptRules.length) // 119
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const taskScriptRules: ReadonlyArray<TaskScriptRule> = [
  TaskScriptRule.make({
    kind: "library",
    name: "build",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:build", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "build",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:build", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "build",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:build", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "build",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:build", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "build",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:build", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "build",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:build", ifPresent: false },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "build", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "check",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:check", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "check",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:check", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "check",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:check", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "check",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:check", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "check",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:check", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "check",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:check", ifPresent: false },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "check", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "lint",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "lint",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "lint",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "lint",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "lint",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "lint",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint", ifPresent: false },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "lint", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "test",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "test",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "test",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "test",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "test",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "test",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "test", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "lint:fix",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint:fix", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "lint:fix",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint:fix", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "lint:fix",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:lint:fix", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "lint:fix",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint:fix", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "lint:fix",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint:fix", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "lint:fix",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:lint:fix", ifPresent: false },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "lint:fix", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "test:property",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "test:property",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "test:property",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "test:property",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "test:property",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "test:property",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:test", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "exempt",
    name: "test:property",
    presence: { _tag: "optional" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "library",
    name: "test:integration",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "test:integration",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "test:integration",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "test:integration",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "test:integration",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "test:integration",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "exempt",
    name: "test:integration",
    presence: { _tag: "optional" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "library",
    name: "test:integration:parallel",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "test:integration:parallel",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "test:integration:parallel",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "test:integration:parallel",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "test:integration:parallel",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "test:integration:parallel",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:test:integration", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "exempt",
    name: "test:integration:parallel",
    presence: { _tag: "optional" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "library",
    name: "coverage",
    presence: { _tag: "required" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({ kind: "tool", name: "coverage", presence: { _tag: "required" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "coverage",
    presence: { _tag: "required" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({ kind: "app", name: "coverage", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({ kind: "lab", name: "coverage", presence: { _tag: "absent" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({ kind: "infra", name: "coverage", presence: { _tag: "required" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({ kind: "exempt", name: "coverage", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "docgen",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:docgen", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "docgen",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:docgen", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "docgen",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:docgen", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "docgen",
    presence: { _tag: "optional" },
    binding: { _tag: "indirection", impl: "beep:docgen", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "docgen",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:docgen", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "docgen",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:docgen", ifPresent: false },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "docgen", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "audit",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:audit", ifPresent: true },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "audit",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:audit", ifPresent: true },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "audit",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:audit", ifPresent: true },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "audit",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:audit", ifPresent: true },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "audit",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:audit", ifPresent: true },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "audit",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:audit", ifPresent: true },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "audit", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "package-test-typecheck",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli quality test-tsgo-package" },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "package-test-typecheck",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli quality test-tsgo-package" },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "package-test-typecheck",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli quality test-tsgo-package" },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "package-test-typecheck",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli quality test-tsgo-package" },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "package-test-typecheck",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli quality test-tsgo-package" },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "package-test-typecheck",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli quality test-tsgo-package" },
  }),
  TaskScriptRule.make({
    kind: "exempt",
    name: "package-test-typecheck",
    presence: { _tag: "optional" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "library",
    name: "codegen",
    presence: { _tag: "derived", rule: "codegen-generator" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "codegen",
    presence: { _tag: "derived", rule: "codegen-generator" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "codegen",
    presence: { _tag: "derived", rule: "codegen-generator" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "codegen",
    presence: { _tag: "derived", rule: "codegen-generator" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "codegen",
    presence: { _tag: "derived", rule: "codegen-generator" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "codegen",
    presence: { _tag: "derived", rule: "codegen-generator" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "codegen", presence: { _tag: "optional" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "lint:deprecated-apis",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint deprecated-apis --package ." },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "lint:deprecated-apis",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint deprecated-apis --package ." },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "lint:deprecated-apis",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint deprecated-apis --package ." },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "lint:deprecated-apis",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint deprecated-apis --package ." },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "lint:deprecated-apis",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint deprecated-apis --package ." },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "lint:deprecated-apis",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint deprecated-apis --package ." },
  }),
  TaskScriptRule.make({
    kind: "exempt",
    name: "lint:deprecated-apis",
    presence: { _tag: "absent" },
    binding: { _tag: "owned" },
  }),
  TaskScriptRule.make({
    kind: "library",
    name: "lint:jsdoc",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint jsdoc --package ." },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "lint:jsdoc",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint jsdoc --package ." },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "lint:jsdoc",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint jsdoc --package ." },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "lint:jsdoc",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint jsdoc --package ." },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "lint:jsdoc",
    presence: { _tag: "absent" },
    binding: { _tag: "cli", command: "beep-cli lint jsdoc --package ." },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "lint:jsdoc",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint jsdoc --package ." },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "lint:jsdoc", presence: { _tag: "absent" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "lint:laws",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint laws --package ." },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "lint:laws",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint laws --package ." },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "lint:laws",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint laws --package ." },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "lint:laws",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint laws --package ." },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "lint:laws",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint laws --package ." },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "lint:laws",
    presence: { _tag: "required" },
    binding: { _tag: "cli", command: "beep-cli lint laws --package ." },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "lint:laws", presence: { _tag: "absent" }, binding: { _tag: "owned" } }),
  TaskScriptRule.make({
    kind: "library",
    name: "doctest",
    presence: { _tag: "derived", rule: "doctest-sources" },
    binding: { _tag: "indirection", impl: "beep:doctest", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "tool",
    name: "doctest",
    presence: { _tag: "derived", rule: "doctest-sources" },
    binding: { _tag: "indirection", impl: "beep:doctest", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "ecosystem",
    name: "doctest",
    presence: { _tag: "derived", rule: "doctest-sources" },
    binding: { _tag: "indirection", impl: "beep:doctest", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "app",
    name: "doctest",
    presence: { _tag: "derived", rule: "doctest-sources" },
    binding: { _tag: "indirection", impl: "beep:doctest", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "lab",
    name: "doctest",
    presence: { _tag: "derived", rule: "doctest-sources" },
    binding: { _tag: "indirection", impl: "beep:doctest", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "doctest",
    presence: { _tag: "absent" },
    binding: { _tag: "indirection", impl: "beep:doctest", ifPresent: false },
  }),
  TaskScriptRule.make({ kind: "exempt", name: "doctest", presence: { _tag: "absent" }, binding: { _tag: "owned" } }),
];
/**
 * Generator defaults used only for missing implementation keys; existing values are package-owned.
 *
 * **Example** (Inspect implScriptDefaults)
 *
 * ```ts
 * import { implScriptDefaults } from "@beep/repo-cli/test/PackageScripts"
 * console.log(implScriptDefaults.length) // 54
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const implScriptDefaults: ReadonlyArray<ImplScriptDefault> = [
  ImplScriptDefault.make({ kind: "library", name: "beep:build", value: "tsc -p tsconfig.json && bun run babel" }),
  ImplScriptDefault.make({
    kind: "library",
    name: "beep:check",
    value: "tsgo -p tsconfig.check.json && bun run beep:check:tests",
  }),
  ImplScriptDefault.make({ kind: "library", name: "beep:lint", value: "biome check ." }),
  ImplScriptDefault.make({ kind: "library", name: "beep:lint:fix", value: "biome check . --write" }),
  ImplScriptDefault.make({
    kind: "library",
    name: "beep:test",
    value: "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
  }),
  ImplScriptDefault.make({
    kind: "library",
    name: "beep:test:integration",
    value: "bunx --bun vitest run test/integration --passWithNoTests",
  }),
  ImplScriptDefault.make({ kind: "library", name: "beep:docgen", value: "bunx --bun --no-install docgen" }),
  ImplScriptDefault.make({
    kind: "library",
    name: "beep:audit",
    value:
      "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:test:integration && bun run lint:laws && bun run beep:docgen && bun run beep:lint",
  }),
  ImplScriptDefault.make({
    kind: "library",
    name: "beep:doctest",
    value: "BEEP_VITEST_DOCTEST=1 bunx --bun vitest run",
  }),
  ImplScriptDefault.make({ kind: "tool", name: "beep:build", value: "tsc -p tsconfig.json && bun run babel" }),
  ImplScriptDefault.make({
    kind: "tool",
    name: "beep:check",
    value: "tsgo -p tsconfig.check.json && bun run beep:check:tests",
  }),
  ImplScriptDefault.make({ kind: "tool", name: "beep:lint", value: "biome check ." }),
  ImplScriptDefault.make({ kind: "tool", name: "beep:lint:fix", value: "biome check . --write" }),
  ImplScriptDefault.make({
    kind: "tool",
    name: "beep:test",
    value: "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
  }),
  ImplScriptDefault.make({
    kind: "tool",
    name: "beep:test:integration",
    value: "bunx --bun vitest run test/integration --passWithNoTests",
  }),
  ImplScriptDefault.make({ kind: "tool", name: "beep:docgen", value: "bunx --bun --no-install docgen" }),
  ImplScriptDefault.make({
    kind: "tool",
    name: "beep:audit",
    value:
      "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:test:integration && bun run lint:laws && bun run beep:docgen && bun run beep:lint",
  }),
  ImplScriptDefault.make({ kind: "tool", name: "beep:doctest", value: "BEEP_VITEST_DOCTEST=1 bunx --bun vitest run" }),
  ImplScriptDefault.make({ kind: "ecosystem", name: "beep:build", value: "tsc -p tsconfig.json && bun run babel" }),
  ImplScriptDefault.make({
    kind: "ecosystem",
    name: "beep:check",
    value: "tsgo -p tsconfig.check.json && bun run beep:check:tests",
  }),
  ImplScriptDefault.make({ kind: "ecosystem", name: "beep:lint", value: "biome check ." }),
  ImplScriptDefault.make({ kind: "ecosystem", name: "beep:lint:fix", value: "biome check . --write" }),
  ImplScriptDefault.make({
    kind: "ecosystem",
    name: "beep:test",
    value: "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
  }),
  ImplScriptDefault.make({
    kind: "ecosystem",
    name: "beep:test:integration",
    value: "bunx --bun vitest run test/integration --passWithNoTests",
  }),
  ImplScriptDefault.make({ kind: "ecosystem", name: "beep:docgen", value: "bunx --bun --no-install docgen" }),
  ImplScriptDefault.make({
    kind: "ecosystem",
    name: "beep:audit",
    value:
      "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:test:integration && bun run lint:laws && bun run beep:docgen && bun run beep:lint",
  }),
  ImplScriptDefault.make({
    kind: "ecosystem",
    name: "beep:doctest",
    value: "BEEP_VITEST_DOCTEST=1 bunx --bun vitest run",
  }),
  ImplScriptDefault.make({ kind: "app", name: "beep:build", value: "tsgo -p tsconfig.check.json" }),
  ImplScriptDefault.make({
    kind: "app",
    name: "beep:check",
    value: "tsgo -p tsconfig.check.json",
  }),
  ImplScriptDefault.make({ kind: "app", name: "beep:lint", value: "biome check ." }),
  ImplScriptDefault.make({ kind: "app", name: "beep:lint:fix", value: "biome check . --write" }),
  ImplScriptDefault.make({ kind: "app", name: "beep:test", value: "bunx --bun vitest run" }),
  ImplScriptDefault.make({
    kind: "app",
    name: "beep:test:integration",
    value: "bunx --bun vitest run test/integration --passWithNoTests",
  }),
  ImplScriptDefault.make({ kind: "app", name: "beep:docgen", value: "bunx --bun --no-install docgen" }),
  ImplScriptDefault.make({
    kind: "app",
    name: "beep:audit",
    value: "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:lint",
  }),
  ImplScriptDefault.make({ kind: "app", name: "beep:doctest", value: "BEEP_VITEST_DOCTEST=1 bunx --bun vitest run" }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:build", value: "tsgo -p tsconfig.check.json" }),
  ImplScriptDefault.make({
    kind: "lab",
    name: "beep:check",
    value: "tsgo -p tsconfig.check.json",
  }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:lint", value: "biome check ." }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:lint:fix", value: "biome check . --write" }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:test", value: "bunx --bun vitest run" }),
  ImplScriptDefault.make({
    kind: "lab",
    name: "beep:test:integration",
    value: "bunx --bun vitest run test/integration --passWithNoTests",
  }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:docgen", value: "bunx --bun --no-install docgen" }),
  ImplScriptDefault.make({
    kind: "lab",
    name: "beep:audit",
    value: "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:lint",
  }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:doctest", value: "BEEP_VITEST_DOCTEST=1 bunx --bun vitest run" }),
  ImplScriptDefault.make({ kind: "infra", name: "beep:build", value: "tsc -p tsconfig.json && bun run babel" }),
  ImplScriptDefault.make({
    kind: "infra",
    name: "beep:check",
    value: "tsgo -p tsconfig.check.json && bun run beep:check:tests",
  }),
  ImplScriptDefault.make({ kind: "infra", name: "beep:lint", value: "biome check ." }),
  ImplScriptDefault.make({ kind: "infra", name: "beep:lint:fix", value: "biome check . --write" }),
  ImplScriptDefault.make({
    kind: "infra",
    name: "beep:test",
    value: "bunx --bun vitest run --passWithNoTests --exclude=test/integration/**",
  }),
  ImplScriptDefault.make({
    kind: "infra",
    name: "beep:test:integration",
    value: "bunx --bun vitest run test/integration --passWithNoTests",
  }),
  ImplScriptDefault.make({ kind: "infra", name: "beep:docgen", value: "bunx --bun --no-install docgen" }),
  ImplScriptDefault.make({
    kind: "infra",
    name: "beep:audit",
    value:
      "bun run beep:build && bun run beep:check && bun run beep:test && bun run beep:test:integration && bun run lint:laws && bun run beep:docgen && bun run beep:lint",
  }),
  ImplScriptDefault.make({ kind: "infra", name: "beep:doctest", value: "BEEP_VITEST_DOCTEST=1 bunx --bun vitest run" }),
];

const scaffoldRule = (scripts: HashMap.HashMap<string, string>, rule: TaskScriptRule) => {
  const binding = rule.binding;
  if (binding._tag === "owned") return scripts;
  if (binding._tag === "cli") return HashMap.set(scripts, rule.name, binding.command);
  const tasks = HashMap.set(scripts, rule.name, `bun run ${binding.ifPresent ? "--if-present " : ""}${binding.impl}`);
  const implementation = A.findFirst(implScriptDefaults, (row) => row.kind === rule.kind && row.name === binding.impl);
  return O.isSome(implementation) ? HashMap.set(tasks, binding.impl, implementation.value.value) : tasks;
};
const scaffoldRuleEnabled =
  (kind: PackageKind, optionalTasks: ReadonlyArray<TaskScriptName>) => (rule: TaskScriptRule) =>
    rule.kind === kind &&
    (rule.presence._tag === "required" || (rule.presence._tag === "optional" && A.contains(optionalTasks, rule.name)));

/**
 * Construct required scaffold bindings and explicitly selected optional tasks from the rule table.
 *
 * **Details**
 * Includes defaults behind enabled indirections, including the optional audit implementation.
 * Package-owned tasks and extra scripts remain the caller's responsibility. Derived tasks
 * require filesystem evidence and are left to the policy writer.
 *
 * **Example** (Construct a library scaffold block)
 *
 * ```ts
 * import { scaffoldPackageScripts } from "@beep/repo-cli/test/PackageScripts"
 * const scripts = scaffoldPackageScripts("library", ["test:integration"])
 * console.log(scripts.docgen) // "bun run beep:docgen"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const scaffoldPackageScripts: {
  (kind: PackageKind, optionalTasks: ReadonlyArray<TaskScriptName>): ScriptsRecord;
  (optionalTasks: ReadonlyArray<TaskScriptName>): (kind: PackageKind) => ScriptsRecord;
} = dual(2, (kind: PackageKind, optionalTasks: ReadonlyArray<TaskScriptName>): ScriptsRecord => {
  let scripts = A.reduce(
    A.filter(taskScriptRules, scaffoldRuleEnabled(kind, optionalTasks)),
    HashMap.empty<string, string>(),
    scaffoldRule
  );
  // An audit may call an implementation even when its public task is absent (tool integration tests).
  for (const implementation of implScriptDefaults) {
    if (implementation.kind !== kind || HashMap.has(scripts, implementation.name)) continue;
    if (
      scripts.pipe(
        HashMap.values,
        A.fromIterable,
        A.some((value) => A.contains(Str.split(value, " && "), `bun run ${implementation.name}`))
      )
    ) {
      scripts = HashMap.set(scripts, implementation.name, implementation.value);
    }
  }
  return R.fromEntries(A.sortWith(HashMap.toEntries(scripts), ([key]) => key, Order.String));
});
