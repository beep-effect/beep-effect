/**
 * Canonical task bindings and lossless package scripts codecs.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliKitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

const $I = $RepoCliKitId.create("package-scripts/PackageScripts.schemas");
/**
 * Version selecting the canonical task binding contract.
 *
 * **Example** (Inspect PackageScriptsRuleVersion)
 *
 * ```ts
 * import { PackageScriptsRuleVersion } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
/**
 * Decoded PackageScriptsRuleVersion value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PackageScriptsRuleVersion = typeof PackageScriptsRuleVersion.Type;

/**
 * Workspace classifications selecting task presence.
 *
 * **Example** (Inspect PackageKind)
 *
 * ```ts
 * import { PackageKind } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
/**
 * Decoded PackageKind value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PackageKind = typeof PackageKind.Type;

/**
 * Task-facing keys governed by strict bindings.
 *
 * **Example** (Inspect TaskScriptName)
 *
 * ```ts
 * import { TaskScriptName } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
  "package-test-typecheck",
  "codegen",
  "lint:deprecated-apis",
  "lint:jsdoc",
  "lint:laws",
  "doctest",
]).pipe($I.annoteSchema("TaskScriptName", { description: "Task-facing keys governed by strict bindings." }));
/**
 * Decoded TaskScriptName value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TaskScriptName = typeof TaskScriptName.Type;

/**
 * Package-owned implementation keys whose values remain free.
 *
 * **Example** (Inspect ImplScriptName)
 *
 * ```ts
 * import { ImplScriptName } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
  "beep:coverage",
  "beep:docgen",
  "beep:doctest",
]).pipe(
  $I.annoteSchema("ImplScriptName", { description: "Package-owned implementation keys whose values remain free." })
);
/**
 * Decoded ImplScriptName value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ImplScriptName = typeof ImplScriptName.Type;

/**
 * Binding from a task to an implementation, CLI command, or package-owned text.
 *
 * **Example** (Inspect TaskScriptBinding)
 *
 * ```ts
 * import { TaskScriptBinding } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
/**
 * Decoded TaskScriptBinding value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TaskScriptBinding = typeof TaskScriptBinding.Type;

/**
 * Required, optional, forbidden, or evidence-derived task presence.
 *
 * **Example** (Inspect TaskScriptPresence)
 *
 * ```ts
 * import { TaskScriptPresence } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
/**
 * Decoded TaskScriptPresence value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TaskScriptPresence = typeof TaskScriptPresence.Type;

/**
 * One task binding and presence rule for one workspace kind.
 *
 * **Example** (Inspect TaskScriptRule)
 *
 * ```ts
 * import { TaskScriptRule } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(TaskScriptRule.make({ kind: "app", name: "coverage", presence: { _tag: "optional" }, binding: { _tag: "owned" } }).name) // coverage
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TaskScriptRule extends S.Opaque<TaskScriptRule, { readonly brand: unique symbol }>()(
  S.Struct({ kind: PackageKind, name: TaskScriptName, presence: TaskScriptPresence, binding: TaskScriptBinding }).pipe(
    $I.annoteSchema("TaskScriptRule", { description: "One task binding and presence rule for one workspace kind." })
  )
) {}

/**
 * Implementation text stamped only when the key is missing.
 *
 * **Example** (Inspect ImplScriptDefault)
 *
 * ```ts
 * import { ImplScriptDefault } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(ImplScriptDefault.make({ kind: "app", name: "beep:lint", value: "biome check ." }).value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImplScriptDefault extends S.Opaque<ImplScriptDefault, { readonly brand: unique symbol }>()(
  S.Struct({ kind: PackageKind, name: ImplScriptName, value: S.String }).pipe(
    $I.annoteSchema("ImplScriptDefault", { description: "Implementation text stamped only when the key is missing." })
  )
) {}

/**
 * Compiler flag that limits a generated build to declarations and declaration maps.
 *
 * **Example** (Run the build program without JavaScript emit)
 *
 * ```ts
 * import { DECLARATION_ONLY_BUILD_FLAG } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * const args = ["-p", "tsconfig.json", DECLARATION_ONLY_BUILD_FLAG]
 * console.log(args.join(" ")) // "-p tsconfig.json --emitDeclarationOnly"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DECLARATION_ONLY_BUILD_FLAG = "--emitDeclarationOnly";

/**
 * Generated `beep:build` of the library, tool, ecosystem, and infra kinds.
 *
 * **Details**
 *
 * The build type-checks the package's `tsconfig.json` program and writes only
 * `.d.ts` and `.d.ts.map` files under `dist`: workspace consumers resolve
 * `exports` to `src`, so the declaration is the only `dist` artifact anything
 * reads. The flag sits on the command rather than in `tsconfig.base.json`
 * because the no-emit overlays (`tsconfig.check.json`, `tsconfig.test.json`)
 * extend the base config and reject `emitDeclarationOnly` without `declaration`.
 *
 * **Example** (Compare a manifest build with the generated command)
 *
 * ```ts
 * import { DECLARATION_ONLY_BUILD_COMMAND } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(DECLARATION_ONLY_BUILD_COMMAND) // "tsrs -p tsconfig.json --emitDeclarationOnly"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DECLARATION_ONLY_BUILD_COMMAND = `tsrs -p tsconfig.json ${DECLARATION_ONLY_BUILD_FLAG}`;

const commandSegments = flow(Str.split("&&"), A.map(Str.trim));

/**
 * Whether a `beep:build` runs `DECLARATION_ONLY_BUILD_COMMAND` as one of its
 * `&&` segments.
 *
 * **Details**
 *
 * A codegen step before the build (`bun run codegen && tsrs -p tsconfig.json
 * --emitDeclarationOnly`) still counts. A segment with extra flags does not,
 * because it runs a different program. A declaration-only package's check
 * leads with its build, and the root Turbo `check` task depends on the
 * package's own `build`; every other package overrides that edge.
 *
 * **Example** (Classify three builds)
 *
 * ```ts
 * import { isDeclarationOnlyBuild } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(isDeclarationOnlyBuild("bun run codegen && tsrs -p tsconfig.json --emitDeclarationOnly")) // true
 * console.log(isDeclarationOnlyBuild("tsrs -p tsconfig.check.json")) // false
 * console.log(isDeclarationOnlyBuild("vite build")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isDeclarationOnlyBuild = (build: string): boolean =>
  A.contains(commandSegments(build), DECLARATION_ONLY_BUILD_COMMAND);

/**
 * Script keys the policy no longer generates; the gate rejects them and `--write` removes them.
 *
 * **Example** (Recognise the retired Babel script)
 *
 * ```ts
 * import { RetiredScriptName } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(RetiredScriptName)("babel")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RetiredScriptName = LiteralKit(["babel"]).pipe(
  $I.annoteSchema("RetiredScriptName", {
    description: "Script keys the policy no longer generates; the gate rejects them and --write removes them.",
  })
);
/**
 * Decoded RetiredScriptName value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type RetiredScriptName = typeof RetiredScriptName.Type;

/**
 * Implementation text the policy once generated, with the text `--write` puts in its place.
 *
 * **Details**
 *
 * Implementation values are package-owned, so the policy rewrites one only when
 * it still equals a retired value exactly. Any other value is left alone.
 *
 * **Example** (Retire the Babel build)
 *
 * ```ts
 * import { RetiredImplScript } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * const row = RetiredImplScript.make({
 *   kind: "library",
 *   name: "beep:build",
 *   value: "tsrs -p tsconfig.json && bun run babel",
 *   replacement: "tsrs -p tsconfig.json --emitDeclarationOnly",
 * })
 * console.log(row.replacement) // "tsrs -p tsconfig.json --emitDeclarationOnly"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredImplScript extends S.Opaque<RetiredImplScript, { readonly brand: unique symbol }>()(
  S.Struct({ kind: PackageKind, name: ImplScriptName, value: S.String, replacement: S.String }).pipe(
    $I.annoteSchema("RetiredImplScript", {
      description: "Implementation text the policy once generated, with the text --write puts in its place.",
    })
  )
) {}

/**
 * Reviewed permission for one package's `beep:build` to keep emitting JavaScript.
 *
 * **Details**
 *
 * Generated builds emit declarations only. A package with a real reader of its
 * `dist/*.js` keeps a JavaScript-emitting `beep:build` (for example
 * `tsrs -p tsconfig.json`) through a row naming its manifest and the reader;
 * `--write` then leaves that value alone. Record the row in the owning goal's
 * Exception Ledger and remove it when the reader goes.
 *
 * **Example** (Keep JavaScript for one package)
 *
 * ```ts
 * import { JavaScriptBuildOverride } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * const row = JavaScriptBuildOverride.make({
 *   manifest: "packages/drivers/example/package.json",
 *   reason: "the example worker image runs dist/main.js",
 * })
 * console.log(row.manifest) // "packages/drivers/example/package.json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JavaScriptBuildOverride extends S.Opaque<JavaScriptBuildOverride, { readonly brand: unique symbol }>()(
  S.Struct({ manifest: S.String, reason: S.NonEmptyString }).pipe(
    $I.annoteSchema("JavaScriptBuildOverride", {
      description: "Reviewed permission for one package's beep:build to keep emitting JavaScript.",
    })
  )
) {}

/**
 * The no-emit own-source check program, `tsrs -p tsconfig.check.json`.
 *
 * **Details**
 *
 * It leads the generated `beep:check` of a package whose build only type-checks
 * (apps, labs) and of a declaration-only package listed in
 * `ownSourceCheckOverrides`. Every other declaration-only package leads its
 * `beep:check` with `DECLARATION_ONLY_BUILD_COMMAND` instead, because its build
 * type-checks the same program.
 *
 * **Example** (Recognise the no-emit check)
 *
 * ```ts
 * import { OWN_SOURCE_CHECK_COMMAND } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(OWN_SOURCE_CHECK_COMMAND) // "tsrs -p tsconfig.check.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const OWN_SOURCE_CHECK_COMMAND = "tsrs -p tsconfig.check.json";

/**
 * Leading `beep:check` segment that a package's build program now serves, with
 * the build command `--write` puts in its place.
 *
 * **Details**
 *
 * The rewrite applies to a package whose `beep:build` runs `replacement` as one
 * of its `&&` segments, whose `beep:check` opens with `segment` (alone, or
 * followed by compiler flags of its own), and whose manifest has no
 * `ownSourceCheckOverrides` row. Only `segment` is replaced: its flags follow
 * the replacement in the same order, and later segments stay as written.
 *
 * **Example** (Serve the own-source check from the build)
 *
 * ```ts
 * import { RetiredCheckSegment } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * const row = RetiredCheckSegment.make({
 *   segment: "tsrs -p tsconfig.check.json",
 *   replacement: "tsrs -p tsconfig.json --emitDeclarationOnly",
 * })
 * console.log(row.replacement) // "tsrs -p tsconfig.json --emitDeclarationOnly"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RetiredCheckSegment extends S.Opaque<RetiredCheckSegment, { readonly brand: unique symbol }>()(
  S.Struct({ segment: S.NonEmptyString, replacement: S.NonEmptyString }).pipe(
    $I.annoteSchema("RetiredCheckSegment", {
      description:
        "Leading beep:check segment a package's build program now serves, with the build command --write puts in its place.",
    })
  )
) {}

/**
 * Reviewed permission for one declaration-only package's `beep:check` to keep
 * the no-emit own-source check.
 *
 * **Details**
 *
 * A declaration-only package's check leads with its build program, which
 * type-checks the files `tsconfig.json` includes. A package whose
 * `tsconfig.check.json` checks more than that (for example it adds `scripts` to
 * `include`) keeps `tsrs -p tsconfig.check.json` through a row naming its
 * manifest and what the check program adds. Remove the row when the two
 * programs list the same files again.
 *
 * **Example** (Keep the own-source check for one package)
 *
 * ```ts
 * import { OwnSourceCheckOverride } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * const row = OwnSourceCheckOverride.make({
 *   manifest: "packages/drivers/example/package.json",
 *   reason: "tsconfig.check.json adds scripts to include",
 * })
 * console.log(row.manifest) // "packages/drivers/example/package.json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OwnSourceCheckOverride extends S.Opaque<OwnSourceCheckOverride, { readonly brand: unique symbol }>()(
  S.Struct({ manifest: S.String, reason: S.NonEmptyString }).pipe(
    $I.annoteSchema("OwnSourceCheckOverride", {
      description:
        "Reviewed permission for one declaration-only package's beep:check to keep the no-emit own-source check.",
    })
  )
) {}

const isTaskScriptName = S.is(TaskScriptName);
const isImplScriptName = S.is(ImplScriptName);

const ExtraScriptName = S.String.check(
  S.makeFilter(
    (key) => !isTaskScriptName(key) && !isImplScriptName(key),
    $I.annote("ExtraScriptName", {
      title: "Extra script name",
      description: "A script key outside the task and implementation tiers.",
      message: "Extra scripts cannot overlap task or implementation keys.",
    })
  )
);
/**
 * Disjoint task, implementation, and extra tiers of a manifest scripts record.
 *
 * **Example** (Inspect ScriptsBlock)
 *
 * ```ts
 * import { ScriptsBlock } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * import * as HashMap from "effect/HashMap"
 * console.log(ScriptsBlock.make({ kind: "app", tasks: HashMap.empty(), impls: HashMap.empty(), extras: HashMap.empty() }).kind) // app
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScriptsBlock extends S.Opaque<ScriptsBlock, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: PackageKind,
    tasks: S.HashMap(TaskScriptName, S.String),
    impls: S.HashMap(ImplScriptName, S.String),
    extras: S.HashMap(ExtraScriptName, S.String),
  }).pipe(
    $I.annoteSchema("ScriptsBlock", {
      description: "Disjoint task, implementation, and extra tiers of a manifest scripts record.",
    })
  )
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
 * import { ScriptsRecord } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
/**
 * Decoded ScriptsRecord value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScriptsRecord = typeof ScriptsRecord.Type;

/**
 * Losslessly partitions a flat scripts record and encodes tiers in stable key order.
 *
 * **Example** (Inspect scriptsBlockFromRecord)
 *
 * ```ts
 * import { scriptsBlockFromRecord } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * const block = Effect.runSync(S.decodeUnknownEffect(scriptsBlockFromRecord("app"))({ dev: "vite" }))
 * console.log(block.kind) // app
 * ```
 *
 * @param kind - The workspace kind the record belongs to.
 * @returns A codec from a flat scripts record to its `ScriptsBlock`.
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
 * TypeScript checkers a type-check or build script may invoke; `tsrs` is canonical.
 *
 * **Example** (Inspect TypeScriptChecker)
 *
 * ```ts
 * import { TypeScriptChecker } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(TypeScriptChecker.is["tsrs"]("tsrs")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TypeScriptChecker = LiteralKit(["tsrs", "tsgo", "tsc"]).pipe(
  $I.annoteSchema("TypeScriptChecker", {
    description: "TypeScript checkers a type-check or build script may invoke; tsrs is canonical.",
  })
);
/**
 * Decoded TypeScriptChecker value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TypeScriptChecker = typeof TypeScriptChecker.Type;

/**
 * TypeScript checkers that fail the gate unless a manifest script carries an exemption.
 *
 * **Example** (Inspect NonCanonicalChecker)
 *
 * ```ts
 * import { NonCanonicalChecker } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(NonCanonicalChecker)("tsrs")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NonCanonicalChecker = TypeScriptChecker.omit(["tsrs"]).pipe(
  $I.annoteSchema("NonCanonicalChecker", {
    description: "TypeScript checkers that fail the gate unless a manifest script carries an exemption.",
  })
);
/**
 * Decoded NonCanonicalChecker value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NonCanonicalChecker = typeof NonCanonicalChecker.Type;

/**
 * Script keys whose commands must type-check with `tsrs`: `beep:build`, `beep:check`, `beep:check:*`.
 *
 * **Example** (Inspect CheckerScriptName)
 *
 * ```ts
 * import { CheckerScriptName } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * import * as S from "effect/Schema"
 * console.log(S.is(CheckerScriptName)("beep:check:tests")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CheckerScriptName = S.String.check(S.isPattern(/^beep:(?:build|check(?::[\w:-]+)?)$/u)).pipe(
  $I.annoteSchema("CheckerScriptName", {
    description: "Script keys whose commands must type-check with tsrs: beep:build, beep:check, beep:check:*.",
  })
);
/**
 * Decoded CheckerScriptName value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CheckerScriptName = typeof CheckerScriptName.Type;

/**
 * Nine actionable deviations from the canonical scripts contract.
 *
 * **Example** (Inspect PackageScriptsDrift)
 *
 * ```ts
 * import { PackageScriptsDrift } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
  placeholder: { name: S.tag("codegen"), actual: S.String },
  "derivation-conflict": { name: S.Literals(["doctest", "build", "check"]), reason: S.String },
  "checker-engine": { name: CheckerScriptName, engine: NonCanonicalChecker, actual: S.String },
  "retired-impl": { name: ImplScriptName, expected: S.String, actual: S.String },
  "retired-script": { name: RetiredScriptName, actual: S.String },
}).pipe(
  $I.annoteSchema("PackageScriptsDrift", {
    description: "Nine actionable deviations from the canonical scripts contract.",
  })
);
/**
 * Decoded PackageScriptsDrift value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PackageScriptsDrift = typeof PackageScriptsDrift.Type;

/**
 * Advisory difference between a package-owned implementation and its scaffold default.
 *
 * **Example** (Review a type-check command change)
 * ```ts
 * import { ImplScriptDrift } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * const drift = ImplScriptDrift.make({ name: "beep:check", expected: "tsrs -p tsconfig.check.json", actual: "tsrs -b tsconfig.json" })
 * console.log(drift.name) // beep:check
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ImplScriptDrift extends S.Opaque<ImplScriptDrift, { readonly brand: unique symbol }>()(
  S.Struct({ name: ImplScriptName, expected: S.String, actual: S.String }).pipe(
    $I.annoteSchema("ImplScriptDrift", {
      description:
        "Advisory impl-script difference; package-owned values are preserved and fail the gate only through checker-engine drift.",
    })
  )
) {}

/**
 * Reviewed permission for one manifest script to run a non-canonical TypeScript checker.
 *
 * **Details**
 *
 * The package-scripts gate fails a `beep:build`, `beep:check`, or `beep:check:*` script that runs
 * a checker other than `tsrs`. An exemption names the manifest, the script, the checker, and why
 * `tsrs` cannot serve that package (for example a reproduced `tsrs` defect or a plugin that only
 * `tsgo` loads). Remove the row when the reason no longer holds.
 *
 * **Example** (Exempt one script)
 * ```ts
 * import { CheckerEngineExemption } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * const exemption = CheckerEngineExemption.make({
 *   manifest: "packages/drivers/example/package.json",
 *   script: "beep:check",
 *   engine: "tsgo",
 *   reason: "tsrs rejects a valid program; upstream issue linked in the package README",
 * })
 * console.log(exemption.engine) // tsgo
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CheckerEngineExemption extends S.Opaque<CheckerEngineExemption, { readonly brand: unique symbol }>()(
  S.Struct({
    manifest: S.String,
    script: CheckerScriptName,
    engine: NonCanonicalChecker,
    reason: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CheckerEngineExemption", {
      description: "Reviewed permission for one manifest script to run a non-canonical TypeScript checker.",
    })
  )
) {}

/**
 * Reviewed checker-engine exemptions; empty while every workspace type-checks with `tsrs`.
 *
 * **Example** (Inspect checkerEngineExemptions)
 *
 * ```ts
 * import { checkerEngineExemptions } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(checkerEngineExemptions.length) // 0
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const checkerEngineExemptions: ReadonlyArray<CheckerEngineExemption> = [];

/**
 * Non-negative number of workspace manifests examined.
 *
 * **Example** (Inspect ManifestCount)
 *
 * ```ts
 * import { ManifestCount } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
/**
 * Decoded ManifestCount value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ManifestCount = typeof ManifestCount.Type;

/**
 * JSON report of checked manifests, drift, and written paths.
 *
 * **Example** (Inspect PackageScriptsReportWire)
 *
 * ```ts
 * import { PackageScriptsReportWire } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(PackageScriptsReportWire.make({ schemaVersion: "package-scripts-report/v1", rules: "package-scripts-rules/v1", manifests: 0, drift: {}, implDrift: {}, written: [] }).manifests) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageScriptsReportWire extends S.Opaque<PackageScriptsReportWire, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("package-scripts-report/v1"),
    rules: PackageScriptsRuleVersion,
    manifests: ManifestCount,
    drift: S.Record(S.String, S.Array(PackageScriptsDrift)),
    // Added after v1 shipped: absent in earlier v1 payloads, decoded as empty.
    implDrift: S.Record(S.String, S.Array(ImplScriptDrift)).pipe(S.withDecodingDefaultKey(Effect.succeed({}))),
    written: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("PackageScriptsReportWire", {
      description: "JSON report of checked manifests, drift, and written paths.",
    })
  )
) {}

/**
 * Collection view of a scripts policy report.
 *
 * **Example** (Inspect PackageScriptsReport)
 *
 * ```ts
 * import { PackageScriptsReport } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * console.log(PackageScriptsReport.make({ schemaVersion: "package-scripts-report/v1", rules: "package-scripts-rules/v1", manifests: 0, drift: HashMap.empty(), implDrift: HashMap.empty(), written: HashSet.empty() }).manifests) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PackageScriptsReport extends S.Opaque<PackageScriptsReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("package-scripts-report/v1"),
    rules: PackageScriptsRuleVersion,
    manifests: ManifestCount,
    drift: S.HashMap(S.String, S.Array(PackageScriptsDrift)),
    implDrift: S.HashMap(S.String, S.Array(ImplScriptDrift)),
    written: S.HashSet(S.String),
  }).pipe($I.annoteSchema("PackageScriptsReport", { description: "Collection view of a scripts policy report." }))
) {}

/**
 * Bidirectional codec between JSON-compatible reports and Effect collections.
 *
 * **Example** (Inspect PackageScriptsReportFromWire)
 *
 * ```ts
 * import { PackageScriptsReportFromWire } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
      decode: ({
        schemaVersion,
        rules,
        manifests,
        drift,
        implDrift,
        written,
      }): typeof PackageScriptsReport.Encoded => ({
        schemaVersion,
        rules,
        manifests,
        drift: HashMap.fromIterable(R.toEntries(drift)),
        implDrift: HashMap.fromIterable(R.toEntries(implDrift)),
        written: HashSet.fromIterable(written),
      }),
      encode: (report) =>
        PackageScriptsReportWire.make({
          ...report,
          drift: R.fromEntries(A.sortWith(HashMap.toEntries(report.drift), ([key]) => key, Order.String)),
          implDrift: R.fromEntries(
            A.map(
              A.sortWith(HashMap.toEntries(report.implDrift), ([key]) => key, Order.String),
              ([key, rows]) => [key, A.map(rows, (row) => ImplScriptDrift.make(row))]
            )
          ),
          written: A.sort(A.fromIterable(report.written), Order.String),
        }),
    })
  ),
  $I.annoteSchema("PackageScriptsReportFromWire", {
    description: "Bidirectional codec between JSON-compatible reports and Effect collections.",
  })
);
/**
 * Decoded PackageScriptsReportFromWire value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PackageScriptsReportFromWire = typeof PackageScriptsReportFromWire.Type;

/**
 * Explicit generator registry independent of current manifest script presence.
 *
 * **Example** (Inspect CodegenGeneratorPackage)
 *
 * ```ts
 * import { CodegenGeneratorPackage } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
/**
 * Decoded CodegenGeneratorPackage value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodegenGeneratorPackage = typeof CodegenGeneratorPackage.Type;

/**
 * Canonical presence table in library, tool, ecosystem, app, lab, infra, and exempt order.
 *
 * **Example** (Inspect taskScriptRules)
 *
 * ```ts
 * import { taskScriptRules } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(taskScriptRules.length) // 112
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
  TaskScriptRule.make({
    kind: "lab",
    name: "coverage",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:coverage", ifPresent: false },
  }),
  TaskScriptRule.make({
    kind: "infra",
    name: "coverage",
    presence: { _tag: "required" },
    binding: { _tag: "indirection", impl: "beep:coverage", ifPresent: false },
  }),
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
 * import { implScriptDefaults } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(implScriptDefaults.length) // 50
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const implScriptDefaults: ReadonlyArray<ImplScriptDefault> = [
  ImplScriptDefault.make({ kind: "library", name: "beep:build", value: DECLARATION_ONLY_BUILD_COMMAND }),
  ImplScriptDefault.make({
    kind: "library",
    name: "beep:check",
    value: "tsrs -p tsconfig.check.json && bun run beep:check:tests",
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
    name: "beep:doctest",
    value: "BEEP_VITEST_DOCTEST=1 bunx vitest run",
  }),
  ImplScriptDefault.make({ kind: "tool", name: "beep:build", value: DECLARATION_ONLY_BUILD_COMMAND }),
  ImplScriptDefault.make({
    kind: "tool",
    name: "beep:check",
    value: "tsrs -p tsconfig.check.json && bun run beep:check:tests",
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
  ImplScriptDefault.make({ kind: "tool", name: "beep:doctest", value: "BEEP_VITEST_DOCTEST=1 bunx vitest run" }),
  ImplScriptDefault.make({ kind: "ecosystem", name: "beep:build", value: DECLARATION_ONLY_BUILD_COMMAND }),
  ImplScriptDefault.make({
    kind: "ecosystem",
    name: "beep:check",
    value: "tsrs -p tsconfig.check.json && bun run beep:check:tests",
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
    name: "beep:doctest",
    value: "BEEP_VITEST_DOCTEST=1 bunx vitest run",
  }),
  ImplScriptDefault.make({ kind: "app", name: "beep:build", value: "tsrs -p tsconfig.check.json" }),
  ImplScriptDefault.make({
    kind: "app",
    name: "beep:check",
    value: "tsrs -p tsconfig.check.json",
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
  ImplScriptDefault.make({ kind: "app", name: "beep:doctest", value: "BEEP_VITEST_DOCTEST=1 bunx vitest run" }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:build", value: "tsrs -p tsconfig.check.json" }),
  ImplScriptDefault.make({
    kind: "lab",
    name: "beep:check",
    value: "tsrs -p tsconfig.check.json",
  }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:lint", value: "biome check ." }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:lint:fix", value: "biome check . --write" }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:test", value: "bunx --bun vitest run" }),
  ImplScriptDefault.make({
    kind: "lab",
    name: "beep:coverage",
    value: "bunx vitest run --coverage --exclude=test/integration/**",
  }),
  ImplScriptDefault.make({
    kind: "lab",
    name: "beep:test:integration",
    value: "bunx --bun vitest run test/integration --passWithNoTests",
  }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:docgen", value: "bunx --bun --no-install docgen" }),
  ImplScriptDefault.make({ kind: "lab", name: "beep:doctest", value: "BEEP_VITEST_DOCTEST=1 bunx vitest run" }),
  ImplScriptDefault.make({ kind: "infra", name: "beep:build", value: DECLARATION_ONLY_BUILD_COMMAND }),
  ImplScriptDefault.make({
    kind: "infra",
    name: "beep:check",
    value: "tsrs -p tsconfig.check.json && bun run beep:check:tests",
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
  ImplScriptDefault.make({
    kind: "infra",
    name: "beep:coverage",
    value:
      "bun run --cwd node_modules/@pulumi/gharunners build && bunx vitest run --coverage --exclude=test/integration/**",
  }),
  ImplScriptDefault.make({ kind: "infra", name: "beep:docgen", value: "bunx --bun --no-install docgen" }),
  ImplScriptDefault.make({ kind: "infra", name: "beep:doctest", value: "BEEP_VITEST_DOCTEST=1 bunx vitest run" }),
];

// Every policy-managed kind. Apps and labs generate a no-emit build, but three apps
// (`architecture-lab-proof`, `practice-gateway`, `practice-kg-mcp`) carry the library build.
const ManagedKind = PackageKind.omit(["exempt"]);
const BABEL_BUILD = "tsrs -p tsconfig.json && bun run babel";

/**
 * Retired implementation values per kind; `--write` replaces each exact match with its replacement.
 *
 * **Details**
 *
 * Every managed kind retires the Babel build, the plain JavaScript-emitting
 * `tsrs -p tsconfig.json`, and the codegen-first Babel build of
 * `@beep/repo-configs`, so no `beep:build` still calls the retired `babel`
 * script. A package listed in `javaScriptBuildOverrides` keeps its `beep:build`
 * as written.
 *
 * **Example** (Find the replacement for the Babel build)
 *
 * ```ts
 * import { retiredImplScripts } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 * const row = A.findFirst(
 *   retiredImplScripts,
 *   (entry) => entry.kind === "library" && entry.value === "tsrs -p tsconfig.json && bun run babel"
 * )
 * console.log(O.getOrElse(O.map(row, (entry) => entry.replacement), () => "none")) // "tsrs -p tsconfig.json --emitDeclarationOnly"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const retiredImplScripts: ReadonlyArray<RetiredImplScript> = A.flatMap(ManagedKind.literals, (kind) => [
  RetiredImplScript.make({ kind, name: "beep:build", value: BABEL_BUILD, replacement: DECLARATION_ONLY_BUILD_COMMAND }),
  RetiredImplScript.make({
    kind,
    name: "beep:build",
    value: "tsrs -p tsconfig.json",
    replacement: DECLARATION_ONLY_BUILD_COMMAND,
  }),
  RetiredImplScript.make({
    kind,
    name: "beep:build",
    value: `bun run codegen && ${BABEL_BUILD}`,
    replacement: `bun run codegen && ${DECLARATION_ONLY_BUILD_COMMAND}`,
  }),
]);

/**
 * Reviewed JavaScript-emit overrides; empty while nothing reads a workspace's `dist/*.js`.
 *
 * **Example** (Inspect javaScriptBuildOverrides)
 *
 * ```ts
 * import { javaScriptBuildOverrides } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(javaScriptBuildOverrides.length) // 0
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const javaScriptBuildOverrides: ReadonlyArray<JavaScriptBuildOverride> = [];

/**
 * Leading `beep:check` segments the build program serves; `--write` replaces
 * each with the build command a package's `beep:build` runs.
 *
 * **Details**
 *
 * One row: a declaration-only package's check no longer runs the separate
 * no-emit program `tsrs -p tsconfig.check.json` first. It runs
 * `DECLARATION_ONLY_BUILD_COMMAND` instead, which Turbo's own-build edge has
 * just run, so a warm unchanged package pays a no-op incremental build, and a
 * direct `bun run check` in the package still type-checks every source file.
 * Flags on the first segment carry over, so `@beep/repo-cli` keeps its
 * `--checkerCostCache source.tsrs-cost-cache` after the build command.
 *
 * **Example** (Inspect the retired check segment)
 *
 * ```ts
 * import { retiredCheckSegments } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(retiredCheckSegments.map((row) => row.segment)) // ["tsrs -p tsconfig.check.json"]
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const retiredCheckSegments: ReadonlyArray<RetiredCheckSegment> = [
  RetiredCheckSegment.make({ segment: OWN_SOURCE_CHECK_COMMAND, replacement: DECLARATION_ONLY_BUILD_COMMAND }),
];

/**
 * Reviewed own-source check overrides: declaration-only packages whose
 * `tsconfig.check.json` checks files the build program does not.
 *
 * **Details**
 *
 * `@beep/effect-drizzle` and `@beep/markdown` add `scripts` to their check
 * program's `include`, so their build cannot stand in for their check. The
 * contract test in `@beep/repo-cli` asserts this list is exactly the set of
 * declaration-only packages whose `tsconfig.check.json` adds anything to the
 * build program.
 *
 * **Example** (List the packages that keep the no-emit check)
 *
 * ```ts
 * import { ownSourceCheckOverrides } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(ownSourceCheckOverrides.length) // 2
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const ownSourceCheckOverrides: ReadonlyArray<OwnSourceCheckOverride> = [
  OwnSourceCheckOverride.make({
    manifest: "packages/ecosystem/effect-drizzle/package.json",
    reason: "tsconfig.check.json adds scripts to include, so the check program is wider than the build program",
  }),
  OwnSourceCheckOverride.make({
    manifest: "packages/foundation/modeling/markdown/package.json",
    reason: "tsconfig.check.json adds scripts to include, so the check program is wider than the build program",
  }),
];

// A program ends where the command does, at whitespace before its own flags, or at `&&`.
const opensAtBoundary = (rest: string): boolean =>
  Str.isEmpty(rest) || Str.startsWith("&&")(rest) || Str.trimStart(rest) !== rest;

// The text after `program` when it opens the command's first `&&` segment: nothing, the
// program's own flags, or `&&` and the later segments; the caller keeps it verbatim.
const afterLeadingProgram = (command: string, program: string): O.Option<string> =>
  pipe(O.liftPredicate(command, Str.startsWith(program)), O.map(Str.slice(program.length)), O.filter(opensAtBoundary));

const servedCheck = (check: string, build: string): O.Option<string> =>
  A.findFirst(retiredCheckSegments, (row) =>
    A.contains(commandSegments(build), row.replacement)
      ? O.map(afterLeadingProgram(check, row.segment), (rest) => `${row.replacement}${rest}`)
      : O.none()
  );

/**
 * Whether a `beep:check` opens with the declaration-only build program, alone
 * or followed by compiler flags of its own.
 *
 * **Details**
 *
 * This is the shape `buildServedCheck` writes. The program must end at the end
 * of the command, at whitespace before its flags, or at `&&`; a longer config
 * name that merely starts with the same text does not count.
 *
 * **Example** (Recognise build-served checks)
 *
 * ```ts
 * import { checkLeadsWithBuild } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * console.log(checkLeadsWithBuild("tsrs -p tsconfig.json --emitDeclarationOnly && bun run beep:check:tests")) // true
 * console.log(checkLeadsWithBuild("tsrs -p tsconfig.json --emitDeclarationOnly --checkerCostCache a.cache")) // true
 * console.log(checkLeadsWithBuild("tsrs -p tsconfig.check.json && bun run beep:check:tests")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const checkLeadsWithBuild = (check: string): boolean =>
  O.isSome(afterLeadingProgram(check, DECLARATION_ONLY_BUILD_COMMAND));

/**
 * The `beep:check` a package runs once its build program serves the
 * own-source check, or `None` when no `retiredCheckSegments` row applies.
 *
 * **Details**
 *
 * A row applies when the build runs the row's replacement as one of its `&&`
 * segments and the check opens with the row's segment, alone or followed by
 * compiler flags. Only that program text is replaced: its flags follow the
 * replacement in the same order and every later segment is kept as written.
 * The caller decides whether the package keeps its own-source check through
 * `ownSourceCheckOverrides`.
 *
 * **Example** (Serve a library check from its build)
 *
 * ```ts
 * import { buildServedCheck } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * import * as O from "effect/Option"
 * const check = buildServedCheck(
 *   "tsrs -p tsconfig.check.json && bun run beep:check:tests",
 *   "tsrs -p tsconfig.json --emitDeclarationOnly"
 * )
 * console.log(O.getOrElse(check, () => "unchanged")) // "tsrs -p tsconfig.json --emitDeclarationOnly && bun run beep:check:tests"
 * const servedBy = buildServedCheck("tsrs -p tsconfig.json --emitDeclarationOnly")
 * const flagged = servedBy("tsrs -p tsconfig.check.json --checkerCostCache a.cache && bun run beep:check:tests")
 * console.log(O.getOrElse(flagged, () => "unchanged")) // "tsrs -p tsconfig.json --emitDeclarationOnly --checkerCostCache a.cache && bun run beep:check:tests"
 * console.log(O.isNone(servedBy("tsrs -p tsconfig.check.jsonc"))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const buildServedCheck: {
  (check: string, build: string): O.Option<string>;
  (build: string): (check: string) => O.Option<string>;
} = dual(2, servedCheck);

const scaffoldRule = (scripts: HashMap.HashMap<string, string>, rule: TaskScriptRule) => {
  const binding = rule.binding;
  if (binding._tag === "owned") return scripts;
  if (binding._tag === "cli") return HashMap.set(scripts, rule.name, binding.command);
  const tasks = HashMap.set(scripts, rule.name, `bun run ${binding.ifPresent ? "--if-present " : ""}${binding.impl}`);
  const implementation = A.findFirst(implScriptDefaults, (row) => row.kind === rule.kind && row.name === binding.impl);
  return O.isSome(implementation) ? HashMap.set(tasks, binding.impl, implementation.value.value) : tasks;
};

/**
 * Exercise one decoded scaffold binding with caller-owned seed scripts in tests.
 *
 * **Example** (Keep an optional implementation call)
 *
 * ```ts
 * import { applyScaffoldRuleForTesting, TaskScriptBinding, TaskScriptPresence, TaskScriptRule } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
 * import * as HashMap from "effect/HashMap"
 * const rule = TaskScriptRule.make({
 *   kind: "library",
 *   name: "build",
 *   presence: TaskScriptPresence.cases.optional.make({}),
 *   binding: TaskScriptBinding.cases.indirection.make({ impl: "beep:build", ifPresent: true }),
 * })
 * console.log(HashMap.size(applyScaffoldRuleForTesting(HashMap.empty(), rule))) // 2
 * console.log(HashMap.size(applyScaffoldRuleForTesting(rule)(HashMap.empty()))) // 2
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const applyScaffoldRuleForTesting: {
  (scripts: HashMap.HashMap<string, string>, rule: TaskScriptRule): HashMap.HashMap<string, string>;
  (rule: TaskScriptRule): (scripts: HashMap.HashMap<string, string>) => HashMap.HashMap<string, string>;
} = dual(2, scaffoldRule);

// A scaffolded declaration-only package leads its `beep:check` with its build, as the writer would.
const serveScaffoldCheck = (scripts: HashMap.HashMap<string, string>): HashMap.HashMap<string, string> =>
  pipe(
    O.all([HashMap.get(scripts, "beep:check"), HashMap.get(scripts, "beep:build")]),
    O.flatMap(([check, build]) => servedCheck(check, build)),
    O.map((check) => HashMap.set(scripts, "beep:check", check)),
    O.getOrElse(() => scripts)
  );

const scaffoldRuleEnabled =
  (kind: PackageKind, optionalTasks: ReadonlyArray<TaskScriptName>) => (rule: TaskScriptRule) =>
    rule.kind === kind &&
    (rule.presence._tag === "required" || (rule.presence._tag === "optional" && A.contains(optionalTasks, rule.name)));

/**
 * Construct required scaffold bindings and explicitly selected optional tasks from the rule table.
 *
 * **Details**
 * Includes defaults behind enabled indirections. A declaration-only kind's
 * `beep:check` leads with its build command (`buildServedCheck`), as the policy
 * writer would rewrite it.
 * Package-owned tasks and extra scripts remain the caller's responsibility. Derived tasks
 * require filesystem evidence and are left to the policy writer.
 *
 * **Example** (Construct a library scaffold block)
 *
 * ```ts
 * import { scaffoldPackageScripts } from "@beep/repo-cli-kit/package-scripts/PackageScripts.schemas"
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
  const scripts = A.reduce(
    A.filter(taskScriptRules, scaffoldRuleEnabled(kind, optionalTasks)),
    HashMap.empty<string, string>(),
    scaffoldRule
  );
  const entries = scripts.pipe(serveScaffoldCheck, HashMap.toEntries);
  return R.fromEntries(A.sortWith(entries, ([key]) => key, Order.String));
});
