/**
 * Wire contracts for coverage produced by CI test partitions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Quality/internal/CoverageArtifacts.schemas");

const RelativePath = S.String.check(S.isPattern(/^(?!\/)(?!.*(?:^|\/)\.\.?(?:\/|$))[^\\\u0000-\u001f\u007f]+$/u));
const Digest = S.String.check(S.isPattern(/^[a-f0-9]{64}$/u));
const GitSha = S.String.check(S.isPattern(/^[a-f0-9]{40,64}$/u));
const Positive = S.Int.check(S.isGreaterThanOrEqualTo(1));
const TestRuntime = LiteralKit(["bun", "node"]);
const CoverageProvider = LiteralKit(["istanbul", "v8"]);

/**
 * Checkout and workflow attempt that actually executed the tests.
 *
 * **Example** (Validate an execution identity)
 * ```ts
 * import { CoverageProducerIdentity } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 * const isIdentity = S.is(CoverageProducerIdentity)
 * console.log(isIdentity({})) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageProducerIdentity extends S.Opaque<CoverageProducerIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    executionSha: GitSha,
    baseSha: GitSha,
    requestHeadSha: S.optionalKey(GitSha),
    runId: S.NonEmptyString,
    runAttempt: Positive,
    scopeDigest: Digest,
  }).pipe(
    $I.annoteSchema("CoverageProducerIdentity", {
      description: "Exact tested checkout, comparison base, selected scope, and workflow attempt.",
    })
  )
) {}

/**
 * One complete Vitest test-file slice of a package.
 *
 * **Example** (Describe an unsharded package)
 * ```ts
 * import { CoverageProducerPackage } from "@beep/repo-cli/test/Quality"
 * const entry = CoverageProducerPackage.make({ packageName: "@beep/example", packagePath: "packages/example", expectedTestFiles: [], testReportPath: "coverage/unit-results.json", testRuntimeVersion: "1.4.3" })
 * console.log(entry.packageName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageProducerPackage extends S.Opaque<CoverageProducerPackage, { readonly brand: unique symbol }>()(
  S.Struct({
    packageName: S.NonEmptyString,
    packagePath: RelativePath,
    expectedTestFiles: S.Array(RelativePath),
    testReportPath: RelativePath,
    invocationId: S.NonEmptyString.pipe(S.withConstructorDefault(Effect.succeed("0"))),
    testRuntime: TestRuntime.pipe(S.withConstructorDefault(Effect.succeed("bun"))),
    testRuntimeVersion: S.NonEmptyString,
    testOnly: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    provider: CoverageProvider.pipe(S.withConstructorDefault(Effect.succeed("istanbul"))),
    runtimeReportPath: RelativePath.pipe(S.withConstructorDefault(Effect.succeed("coverage/runtime.json"))),
    testCommand: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed<ReadonlyArray<string>>([]))),
    continuationScripts: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed<ReadonlyArray<string>>([]))),
    preparationCommands: S.Array(
      S.Tuple([
        S.Literal("bun"),
        S.Literal("run"),
        S.Literal("--cwd"),
        RelativePath,
        S.String.check(S.isPattern(/^[A-Za-z0-9_@][A-Za-z0-9_:@./-]*$/u)),
      ])
    ).pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultTypeKey(Effect.succeed([]))),
    testEnvironment: S.Record(S.String, S.String).pipe(
      S.withConstructorDefault(Effect.succeed<Readonly<Record<string, string>>>({}))
    ),
    shard: S.optionalKey(S.Struct({ index: Positive, total: Positive })),
  }).pipe(
    $I.annoteSchema("CoverageProducerPackage", {
      description: "Package root, full configured test census, result report, and optional shard identity.",
    })
  )
) {}

/**
 * Expected package assignments of one successful CI producer.
 *
 * **Example** (An empty partition remains explicit)
 * ```ts
 * import { CoverageProducerPartition } from "@beep/repo-cli/test/Quality"
 * console.log(CoverageProducerPartition.make({ partitionId: "unit-a", packages: [] }).packages)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageProducerPartition extends S.Opaque<CoverageProducerPartition, { readonly brand: unique symbol }>()(
  S.Struct({ partitionId: S.NonEmptyString, packages: S.Array(CoverageProducerPackage) }).pipe(
    $I.annoteSchema("CoverageProducerPartition", {
      description: "Exact package/shard assignments for one CI test partition.",
    })
  )
) {}

/**
 * Arguments for sealing reports after a successful test partition.
 *
 * **Example** (Inspect the writer contract)
 * ```ts
 * import { CoverageProducerWriteOptions } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 * console.log(S.is(CoverageProducerWriteOptions)({})) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageProducerWriteOptions extends S.Opaque<
  CoverageProducerWriteOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    artifactRoot: S.NonEmptyString,
    identity: CoverageProducerIdentity,
    partitionId: S.NonEmptyString,
    packages: S.Array(CoverageProducerPackage),
  }).pipe(
    $I.annoteSchema("CoverageProducerWriteOptions", {
      description: "Destination and authoritative inputs for a successful coverage artifact producer.",
    })
  )
) {}

/**
 * Authoritative expectations for a report-only coverage comparison.
 *
 * **Example** (Inspect the consumer contract)
 * ```ts
 * import { CoverageProducerCompareOptions } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 * console.log(S.is(CoverageProducerCompareOptions)({})) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageProducerCompareOptions extends S.Opaque<
  CoverageProducerCompareOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    artifactRoot: S.NonEmptyString,
    identity: CoverageProducerIdentity,
    expectedPartitions: S.Array(CoverageProducerPartition),
    scoped: S.Boolean,
    // A pull request's comparison pins its base: lowered rows are then judged at the base floor
    // unless the pull request could not have moved them.
    base: S.optionalKey(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("CoverageProducerCompareOptions", {
      description: "Trusted execution identity and complete partition plan required before coverage comparison.",
    })
  )
) {}

const Point = S.Struct({ line: Positive, column: S.Natural });
// Source-map remapping encodes an open-ended column (Infinity) as JSON null.
const Range = S.Struct({ start: Point, end: S.Struct({ line: Positive, column: S.NullOr(S.Natural) }) });
const EmptyPoint = S.Struct({ line: S.optionalKey(S.Never), column: S.optionalKey(S.Never) });
const BranchRange = S.Union([Range, S.Struct({ start: EmptyPoint, end: EmptyPoint })]);

/**
 * Validated Istanbul counters and their source locations.
 *
 * **Example** (Reject malformed raw coverage)
 * ```ts
 * import { CoverageRawFile } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 * console.log(S.is(CoverageRawFile)({ path: "src/example.ts" })) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageRawFile extends S.Opaque<CoverageRawFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    statementMap: S.Record(S.String, Range),
    fnMap: S.Record(S.String, S.Struct({ name: S.String, decl: Range, loc: Range, line: S.optionalKey(Positive) })),
    branchMap: S.Record(
      S.String,
      S.Struct({ loc: Range, type: S.String, locations: S.Array(BranchRange), line: S.optionalKey(Positive) })
    ),
    s: S.Record(S.String, S.Natural),
    f: S.Record(S.String, S.Natural),
    b: S.Record(S.String, S.Array(S.Int)),
  }).pipe(
    $I.annoteSchema("CoverageRawFile", {
      description:
        "Raw coverage with nonnegative statement/function hits; signed branch residuals require provider-specific validation.",
    })
  )
) {}

/**
 * Source identity retained when instrumentation assigns no coverage units.
 *
 * **Details**
 * Zero coverage units do not imply zero runtime effects: an empty class may
 * evaluate its superclass factory while introducing no own instrumented unit.
 *
 * **Example** (Record a structural-zero source)
 * ```ts
 * import { CoverageSourceIdentity } from "@beep/repo-cli/test/Quality"
 * console.log(CoverageSourceIdentity.make({ path: "packages/example/src/index.ts", sha256: "a".repeat(64), structuralZero: true }).structuralZero)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageSourceIdentity extends S.Opaque<CoverageSourceIdentity, { readonly brand: unique symbol }>()(
  S.Struct({ path: RelativePath, sha256: Digest, structuralZero: S.Boolean }).pipe(
    $I.annoteSchema("CoverageSourceIdentity", {
      description: "Source bytes and conservative instrumenter-backed structural-zero disposition.",
    })
  )
) {}

/**
 * Runtime observed by the reporter inside the original Vitest execution.
 *
 * **Example** (Record a Node runner)
 * ```ts
 * import { CoverageRuntimeReceipt } from "@beep/repo-cli/test/Quality"
 * console.log(CoverageRuntimeReceipt.make({ schemaVersion: "coverage-runtime/v1", invocationId: "0", testRuntime: "node", runtimeVersion: "22.20.0", success: true }).testRuntime)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageRuntimeReceipt extends S.Opaque<CoverageRuntimeReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("coverage-runtime/v1"),
    invocationId: S.NonEmptyString,
    testRuntime: TestRuntime,
    runtimeVersion: S.NonEmptyString,
    provider: CoverageProvider,
    success: S.Boolean,
  }).pipe(
    $I.annoteSchema("CoverageRuntimeReceipt", {
      description: "Actual test runner runtime and completion status emitted in that same invocation.",
    })
  )
) {}

/**
 * Integrity envelope for one package's raw report and test/source census.
 *
 * **Example** (Inspect the sealed package contract)
 * ```ts
 * import { CoveragePackageArtifact } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 * console.log(S.is(CoveragePackageArtifact)({})) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoveragePackageArtifact extends S.Opaque<CoveragePackageArtifact, { readonly brand: unique symbol }>()(
  S.Struct({
    selection: CoverageProducerPackage,
    reportPath: RelativePath,
    reportSha256: Digest,
    runtimeReceiptPath: RelativePath,
    runtimeReceiptSha256: Digest,
    actualTestFiles: S.Array(RelativePath),
    sources: S.Array(CoverageSourceIdentity),
  }).pipe(
    $I.annoteSchema("CoveragePackageArtifact", {
      description: "Sealed raw report, actual test files, and complete selected source inventory for a package shard.",
    })
  )
) {}

/**
 * Successful producer envelope uploaded by exactly one test partition.
 *
 * **Example** (Inspect a producer manifest)
 * ```ts
 * import { CoverageProducerManifest } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 * console.log(S.is(CoverageProducerManifest)({})) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoverageProducerManifest extends S.Opaque<CoverageProducerManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("coverage-producer/v1"),
    identity: CoverageProducerIdentity,
    partitionId: S.NonEmptyString,
    rawFormat: S.tag("istanbul"),
    coverageLibraryVersion: S.tag("1.0.2"),
    producerRuntime: S.tag("bun"),
    producerRuntimeVersion: S.NonEmptyString,
    packages: S.Array(CoveragePackageArtifact),
  }).pipe(
    $I.annoteSchema("CoverageProducerManifest", {
      description: "Exact successful Bun sealing attempt and its integrity-checked package reports.",
    })
  )
) {}
