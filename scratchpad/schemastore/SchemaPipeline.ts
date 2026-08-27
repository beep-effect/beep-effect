/**
 * Orchestrate generate → lint → validate → gate → write for SchemaStore targets.
 *
 * **Details**
 *
 * Adds no JSON Schema capability of its own: every step belongs to a module
 * this package already owns. Requires `SchemaFile` and `SchemaValidator` in
 * `R`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import * as O from "@beep/utils/Option";
import { Effect, Schema } from "effect";
import type { CanonicalJsonError } from "./CanonicalJson.ts";
import { DocumentLint } from "./DocumentLint.ts";
import type { SchemaFileReadError, SchemaFileWriteError, SchemaWriteOptions } from "./SchemaFile.ts";
import { SchemaFile, WriteChange, WriteOutcome } from "./SchemaFile.ts";
import type { SchemaTarget } from "./SchemaTarget.ts";
import type { SchemaValidatorError, SchemaValidatorOptions } from "./SchemaValidator.ts";
import { SchemaValidator } from "./SchemaValidator.ts";
import type { SchemaConversionError } from "./StoreDocument.ts";
import { StoreDocument } from "./StoreDocument.ts";

const $I = $ScratchpadId.create("schemastore/SchemaPipeline");

/**
 * One problem found while emitting a target, from either gate, normalized
 * so a single policy predicate can judge both.
 *
 * **Details**
 *
 * `DocumentLint` findings keep their own severity; engine findings are
 * `"warning"` — a document the engine rejects is not advisory.
 *
 * **Example** (Construct a lint finding)
 *
 * ```ts
 * import { PipelineFinding } from "@beep/scratchpad/schemastore"
 *
 * const finding = PipelineFinding.make({
 *   source: "lint",
 *   severity: "warning",
 *   check: "UnresolvedRef",
 *   path: "/$ref",
 *   message: "$ref does not resolve against $defs",
 * })
 *
 * console.log(finding.label)
 * // => "UnresolvedRef"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PipelineFinding extends Schema.Class<PipelineFinding>($I`PipelineFinding`)(
  {
    /** Which gate produced it. */
    source: Schema.Literals(["lint", "validator"]),
    /** `"warning"` blocks under the default policy; `"advisory"` does not. */
    severity: Schema.Literals(["warning", "advisory"]),
    /** The lint check's name, or the engine keyword, when one is named. */
    check: Schema.optionalKey(Schema.String),
    /** JSON pointer into the flat document (`""` is the root). */
    path: Schema.String,
    /** Human-readable explanation. */
    message: Schema.String,
  },
  $I.annote("PipelineFinding", {
    description:
      "One lint or validator problem found while emitting a SchemaStore target, normalized so a single policy can judge both gates.",
  })
) {
  /**
   * What to call this finding when rendering it: the check name when the
   * gate named one, the gate itself otherwise.
   *
   * Engine findings do not always carry a keyword, so without this every
   * consumer that logs findings writes the same `finding.check ?? …`
   * fallback.
   *
   * **Example** (Prefer the check name, else the gate)
   *
   * ```ts
   * import { PipelineFinding } from "@beep/scratchpad/schemastore"
   *
   * const named = PipelineFinding.make({
   *   source: "lint",
   *   severity: "warning",
   *   check: "UnresolvedRef",
   *   path: "/$ref",
   *   message: "$ref does not resolve against $defs",
   * })
   * console.log(named.label)
   * // => "UnresolvedRef"
   *
   * const unnamed = PipelineFinding.make({
   *   source: "validator",
   *   severity: "warning",
   *   path: "",
   *   message: "schema is not valid",
   * })
   * console.log(unnamed.label)
   * // => "validator"
   * ```
   *
   * @since 0.0.0
   */
  get label(): string {
    return this.check ?? this.source;
  }
}

/**
 * Indicates that at least one target's findings blocked under the active
 * gating policy. Carries every blocking finding, so a caller renders one
 * report instead of discovering problems one run at a time.
 *
 * **Example** (Construct a gate failure)
 *
 * ```ts
 * import { PipelineFinding, SchemaGateError } from "@beep/scratchpad/schemastore"
 *
 * const error = SchemaGateError.make({
 *   $id: "https://example.com/config.schema.json",
 *   findings: [
 *     PipelineFinding.make({
 *       source: "validator",
 *       severity: "warning",
 *       path: "",
 *       message: "schema is not valid",
 *     }),
 *   ],
 * })
 *
 * console.log(error._tag)
 * // => "SchemaGateError"
 * console.log(error.findings.length)
 * // => 1
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaGateError extends Schema.TaggedError<SchemaGateError>($I`SchemaGateError`)(
  "SchemaGateError",
  {
    /** The `$id` of the target that failed the gate. */
    $id: Schema.String,
    /** Every finding that blocked, in discovery order. */
    findings: Schema.Array(PipelineFinding),
  },
  $I.annote("SchemaGateError", {
    description: "Raised when a target's lint or validator findings block under the active gating policy.",
  })
) {
  /**
   * Operator-facing sentence naming the `$id` and how many findings blocked.
   *
   * **Example** (Count blocking findings in the message)
   *
   * ```ts
   * import { PipelineFinding, SchemaGateError } from "@beep/scratchpad/schemastore"
   *
   * const error = SchemaGateError.make({
   *   $id: "https://example.com/config.schema.json",
   *   findings: [
   *     PipelineFinding.make({
   *       source: "validator",
   *       severity: "warning",
   *       path: "",
   *       message: "schema is not valid",
   *     }),
   *   ],
   * })
   * console.log(error.message)
   * // => 'Schema "https://example.com/config.schema.json" failed its gate with 1 blocking finding(s)'
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `Schema "${this.$id}" failed its gate with ${this.findings.length} blocking finding(s)`;
  }
}

/**
 * What the pipeline did with one target.
 *
 * **Example** (Construct a clean emit result)
 *
 * ```ts
 * import { PipelineResult } from "@beep/scratchpad/schemastore"
 *
 * const result = PipelineResult.make({
 *   $id: "https://example.com/config.schema.json",
 *   path: "schemas/config.schema.json",
 *   outcome: "written",
 *   change: "created",
 *   findings: [],
 * })
 * console.log(result.outcome) // "written"
 * ```
 *
 * @see {@link SchemaPipeline.run} for the emit loop that returns this result.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PipelineResult = Schema.Struct({
  /** The target's `$id`. */
  $id: Schema.String,
  /** The path the document was written to (or compared against). */
  path: Schema.String,
  /** Whether the file was written. Absent from {@link SchemaPipeline.check}'s results. */
  outcome: WriteOutcome,
  /** What differs between the previous content and the new document. */
  change: WriteChange,
  /**
   * Every finding, blocking or not — returned as a value, never logged.
   * The package does not choose your log wording; a run that reached a
   * result had no blocking findings under the active policy.
   */
  findings: Schema.Array(PipelineFinding),
}).pipe(
  $I.annoteSchema("PipelineResult", {
    description: "The write outcome, change classification, and findings for one emitted SchemaStore target.",
  })
);

/**
 * Decoded per-target pipeline emission result.
 *
 * @see {@link PipelineResult} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type PipelineResult = typeof PipelineResult.Type;

/**
 * What {@link SchemaPipeline.check} found for one target — the same report
 * without the write.
 *
 * **Example** (Construct a clean drift-check result)
 *
 * ```ts
 * import { PipelineCheckResult } from "@beep/scratchpad/schemastore"
 *
 * const result = PipelineCheckResult.make({
 *   $id: "https://example.com/config.schema.json",
 *   path: "schemas/config.schema.json",
 *   wouldWrite: false,
 *   blocked: false,
 *   change: "none",
 *   findings: [],
 * })
 * console.log(result.blocked) // false
 * ```
 *
 * @see {@link SchemaPipeline.check} for the drift-check that returns this result.
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PipelineCheckResult = Schema.Struct({
  /** The target's `$id`. */
  $id: Schema.String,
  /** The path compared against. */
  path: Schema.String,
  /** Whether a run would touch this file. */
  wouldWrite: Schema.Boolean,
  /**
   * Whether this target's findings would block a {@link SchemaPipeline.run}
   * under the active policy — so a document that could never be written is
   * never mistaken for clean drift.
   */
  blocked: Schema.Boolean,
  /** What differs between the on-disk content and the new document. */
  change: WriteChange,
  /** Every finding, blocking or not. */
  findings: Schema.Array(PipelineFinding),
}).pipe(
  $I.annoteSchema("PipelineCheckResult", {
    description: "The read-only drift, gate, change, and finding report for one SchemaStore target.",
  })
);

/**
 * Decoded per-target pipeline drift-check result.
 *
 * @see {@link PipelineCheckResult} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type PipelineCheckResult = typeof PipelineCheckResult.Type;

/**
 * Options for {@link SchemaPipeline.run} and {@link SchemaPipeline.check}.
 *
 * **Details**
 *
 * Not a runtime schema: `blocking` is an executable policy predicate, so this
 * interface is program wiring rather than serializable configuration data.
 * The nested data-only option shapes remain schema-backed.
 *
 * @see {@link SchemaPipeline.run} for the emit loop these options configure.
 * @see {@link SchemaPipeline.check} for the total drift-check counterpart.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface SchemaPipelineOptions {
  /**
   * Which findings block. Defaults to
   * `(finding) => finding.severity === "warning"`.
   *
   * The default is a policy call, not a mechanism: `UnresolvedRef`,
   * `UnknownKeyword` and `DepthExceeded` each describe a document that is
   * broken for the editors it exists to serve, and `UnknownKeyword` is by
   * construction the ajv-strict rejection set — tolerating it means
   * shipping something the engine gate rejects. A consumer who disagrees
   * replaces this predicate rather than re-implementing the loop.
   *
   * **Which findings can actually reach you here.** A `SchemaTarget`
   * carries a `Schema`, so the pipeline's documents come from
   * `StoreDocument.fromSchema` — and the Draft-07 lowering drops every
   * keyword outside its copy-list, so an undeclared keyword never
   * survives to be linted. Through this entry point `UnknownKeyword` is
   * therefore effectively unreachable, and **the engine gate is what
   * blocks in practice**. The lint's warning checks earn their keep on
   * documents this pipeline did not build — a hand-assembled
   * `StoreDocument.draft07`, or one read back off disk — and on depth,
   * which a schema can genuinely exceed.
   */
  readonly blocking?: (finding: PipelineFinding) => boolean;
  /** Passed through to `SchemaValidator.validate`. */
  readonly validator?: SchemaValidatorOptions;
  /** Passed through to `SchemaFile.write` / `SchemaFile.check`. */
  readonly write?: SchemaWriteOptions;
}

const defaultBlocking = (finding: PipelineFinding): boolean => finding.severity === "warning";

// Collect both gates' findings for one target, normalized.
const gather = (
  document: StoreDocument,
  options?: SchemaPipelineOptions
): Effect.Effect<ReadonlyArray<PipelineFinding>, SchemaValidatorError, SchemaValidator> =>
  Effect.gen(function* () {
    const validator = yield* SchemaValidator;
    const lint = DocumentLint.lint(document).map((finding) =>
      PipelineFinding.make({
        source: "lint",
        severity: finding.severity === "warning" ? "warning" : "advisory",
        check: finding.check,
        path: finding.path,
        message: finding.message,
      })
    );
    const validation = (yield* validator.validate(document.toJson(), options?.validator)).map((finding) =>
      PipelineFinding.make({
        source: "validator",
        severity: "warning",
        path: finding.path,
        message: finding.message,
        ...O.getSomesStruct({ check: O.fromUndefinedOr(finding.keyword) }),
      })
    );
    return [...lint, ...validation];
  });

const blockingFindings = (
  findings: ReadonlyArray<PipelineFinding>,
  options?: SchemaPipelineOptions
): ReadonlyArray<PipelineFinding> => findings.filter(options?.blocking ?? defaultBlocking);

const gate = (
  target: SchemaTarget,
  findings: ReadonlyArray<PipelineFinding>,
  options?: SchemaPipelineOptions
): Effect.Effect<void, SchemaGateError> => {
  const blocking = blockingFindings(findings, options);
  return blocking.length > 0 ? Effect.fail(SchemaGateError.make({ $id: target.$id, findings: blocking })) : Effect.void;
};

/**
 * The emit pipeline over a target manifest: generate, lint, validate, gate,
 * write — the loop every consumer of this package was writing by hand.
 *
 * **Details**
 *
 * Requires `SchemaFile` and `SchemaValidator` in `R`; provide
 * `SchemaFile.layer` and `SchemaValidator.layer` (plus a platform
 * `FileSystem` / `Path`) at the edge. Findings come back as **values**, so
 * the package never chooses your log wording — but the gating decision,
 * which is the part that must not silently differ between consumers, has
 * one default and one override point.
 *
 * **Gotchas**
 *
 * {@link SchemaPipeline.run} short-circuits at the first {@link SchemaGateError}
 * and does not write that target or later ones. {@link SchemaPipeline.check}
 * is total over the targets and reports `blocked` instead of failing. On
 * documents built by `StoreDocument.fromSchema`, `UnknownKeyword` is
 * effectively unreachable — the engine gate is the practical blocker.
 *
 * **Example** (Check one target without writing)
 *
 * ```ts
 * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
 * import { SchemaFile, SchemaPipeline, SchemaTarget, SchemaValidator } from "@beep/scratchpad/schemastore"
 * import { Effect, Layer, Path } from "effect"
 * import * as S from "effect/Schema"
 *
 * const target = SchemaTarget.make({
 *   schema: S.Struct({ name: S.String }),
 *   $id: "https://example.com/config.schema.json",
 *   path: "/schemas/config.schema.json",
 * })
 *
 * const program = SchemaPipeline.checkOne(target).pipe(
 *   Effect.provide(Layer.mergeAll(SchemaFile.layer, SchemaValidator.layer)),
 *   Effect.provide(Layer.mergeAll(MemoryFileSystem.layer, Path.layer)),
 * )
 *
 * Effect.runPromise(program).then((result) =>
 *   console.log({ blocked: result.blocked, wouldWrite: result.wouldWrite, change: result.change }),
 * )
 * // => { blocked: false, wouldWrite: true, change: "created" }
 * ```
 *
 * @see {@link SchemaPipeline.check} for the total drift-check counterpart to `run`.
 * @see {@link SchemaGateError} for the typed failure when `run` stops at a blocking target.
 * @see {@link SchemaTarget} for the publication-target constructor the pipeline consumes.
 * @see {@link SchemaValidator} for the engine gate that blocks generated documents in practice.
 * @public
 * @category workflows
 * @since 0.0.0
 */
export class SchemaPipeline {
  private constructor() {}

  /**
   * Run every target: build its document, gather both gates' findings,
   * fail with a {@link SchemaGateError} if any block, and write otherwise.
   *
   * Targets are processed in order and the run stops at the first gate
   * failure — a document that fails its gate is not written, and neither
   * are the targets after it.
   *
   * **Example** (Write a missing target)
   *
   * ```ts
   * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
   * import { SchemaFile, SchemaPipeline, SchemaTarget, SchemaValidator } from "@beep/scratchpad/schemastore"
   * import { Effect, Layer, Path } from "effect"
   * import * as S from "effect/Schema"
   *
   * const target = SchemaTarget.make({
   *   schema: S.Struct({ name: S.String }),
   *   $id: "https://example.com/config.schema.json",
   *   path: "/schemas/config.schema.json",
   * })
   *
   * const program = SchemaPipeline.run([target]).pipe(
   *   Effect.provide(Layer.mergeAll(SchemaFile.layer, SchemaValidator.layer)),
   *   Effect.provide(Layer.mergeAll(MemoryFileSystem.layer, Path.layer)),
   * )
   *
   * Effect.runPromise(program).then((results) =>
   *   console.log(results.map((result) => ({ outcome: result.outcome, change: result.change }))),
   * )
   * // => [{ outcome: "written", change: "created" }]
   * ```
   *
   * @since 0.0.0
   */
  static run(
    targets: ReadonlyArray<SchemaTarget>,
    options?: SchemaPipelineOptions
  ): Effect.Effect<
    ReadonlyArray<PipelineResult>,
    | SchemaGateError
    | SchemaConversionError
    | SchemaValidatorError
    | CanonicalJsonError
    | SchemaFileReadError
    | SchemaFileWriteError,
    SchemaFile | SchemaValidator
  > {
    return Effect.gen(function* () {
      const files = yield* SchemaFile;
      const results: Array<PipelineResult> = [];
      for (const target of targets) {
        const document = yield* StoreDocument.fromSchema(target.schema, { $id: target.$id });
        const findings = yield* gather(document, options);
        yield* gate(target, findings, options);
        const { outcome, change } = yield* files.write(target.path, document, options?.write);
        results.push({ $id: target.$id, path: target.path, outcome, change, findings });
      }
      return results;
    });
  }

  /**
   * The same walk with **no writes** — the drift-check counterpart, for a
   * CI job asserting the committed schemas are current.
   *
   * Unlike {@link SchemaPipeline.run} this is **total over the targets**:
   * it never stops at a failing gate, and reports `blocked` per target
   * instead of failing. Reporting is the job here, and a repo with three
   * broken documents should learn that in one run rather than fixing them
   * one run at a time. A blocked target is still never mistaken for clean
   * drift — `blocked` says so explicitly.
   *
   * The error channel is left to the mechanisms that genuinely cannot
   * produce a report (generation, serialization, the engine, the read).
   *
   * **Example** (Report drift without writing)
   *
   * ```ts
   * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
   * import { SchemaFile, SchemaPipeline, SchemaTarget, SchemaValidator } from "@beep/scratchpad/schemastore"
   * import { Effect, Layer, Path } from "effect"
   * import * as S from "effect/Schema"
   *
   * const target = SchemaTarget.make({
   *   schema: S.Struct({ name: S.String }),
   *   $id: "https://example.com/config.schema.json",
   *   path: "/schemas/config.schema.json",
   * })
   *
   * const program = SchemaPipeline.check([target]).pipe(
   *   Effect.provide(Layer.mergeAll(SchemaFile.layer, SchemaValidator.layer)),
   *   Effect.provide(Layer.mergeAll(MemoryFileSystem.layer, Path.layer)),
   * )
   *
   * Effect.runPromise(program).then((results) =>
   *   console.log(results.map((result) => ({ blocked: result.blocked, wouldWrite: result.wouldWrite, change: result.change }))),
   * )
   * // => [{ blocked: false, wouldWrite: true, change: "created" }]
   * ```
   *
   * @since 0.0.0
   */
  static check(
    targets: ReadonlyArray<SchemaTarget>,
    options?: SchemaPipelineOptions
  ): Effect.Effect<
    ReadonlyArray<PipelineCheckResult>,
    SchemaConversionError | SchemaValidatorError | CanonicalJsonError | SchemaFileReadError,
    SchemaFile | SchemaValidator
  > {
    return Effect.gen(function* () {
      const files = yield* SchemaFile;
      const results: Array<PipelineCheckResult> = [];
      for (const target of targets) {
        const document = yield* StoreDocument.fromSchema(target.schema, { $id: target.$id });
        const findings = yield* gather(document, options);
        const { wouldWrite, change } = yield* files.check(target.path, document, options?.write);
        results.push({
          $id: target.$id,
          path: target.path,
          wouldWrite,
          blocked: blockingFindings(findings, options).length > 0,
          change,
          findings,
        });
      }
      return results;
    });
  }

  /**
   * {@link SchemaPipeline.run} for a single target, answering its one
   * result directly — so a caller with one target does not index into an
   * array and prove to the type system that element zero exists.
   *
   * **Example** (Write one missing target)
   *
   * ```ts
   * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
   * import { SchemaFile, SchemaPipeline, SchemaTarget, SchemaValidator } from "@beep/scratchpad/schemastore"
   * import { Effect, Layer, Path } from "effect"
   * import * as S from "effect/Schema"
   *
   * const target = SchemaTarget.make({
   *   schema: S.Struct({ name: S.String }),
   *   $id: "https://example.com/config.schema.json",
   *   path: "/schemas/config.schema.json",
   * })
   *
   * const program = SchemaPipeline.runOne(target).pipe(
   *   Effect.provide(Layer.mergeAll(SchemaFile.layer, SchemaValidator.layer)),
   *   Effect.provide(Layer.mergeAll(MemoryFileSystem.layer, Path.layer)),
   * )
   *
   * Effect.runPromise(program).then((result) =>
   *   console.log({ outcome: result.outcome, change: result.change }),
   * )
   * // => { outcome: "written", change: "created" }
   * ```
   *
   * @since 0.0.0
   */
  static runOne(
    target: SchemaTarget,
    options?: SchemaPipelineOptions
  ): Effect.Effect<
    PipelineResult,
    | SchemaGateError
    | SchemaConversionError
    | SchemaValidatorError
    | CanonicalJsonError
    | SchemaFileReadError
    | SchemaFileWriteError,
    SchemaFile | SchemaValidator
  > {
    return SchemaPipeline.run([target], options).pipe(Effect.map((results) => results[0] as PipelineResult));
  }

  /**
   * {@link SchemaPipeline.check} for a single target, answering its one
   * result directly.
   *
   * **Example** (Check one target without writing)
   *
   * ```ts
   * import { MemoryFileSystem } from "@beep/scratchpad/memfs"
   * import { SchemaFile, SchemaPipeline, SchemaTarget, SchemaValidator } from "@beep/scratchpad/schemastore"
   * import { Effect, Layer, Path } from "effect"
   * import * as S from "effect/Schema"
   *
   * const target = SchemaTarget.make({
   *   schema: S.Struct({ name: S.String }),
   *   $id: "https://example.com/config.schema.json",
   *   path: "/schemas/config.schema.json",
   * })
   *
   * const program = SchemaPipeline.checkOne(target).pipe(
   *   Effect.provide(Layer.mergeAll(SchemaFile.layer, SchemaValidator.layer)),
   *   Effect.provide(Layer.mergeAll(MemoryFileSystem.layer, Path.layer)),
   * )
   *
   * Effect.runPromise(program).then((result) =>
   *   console.log({ blocked: result.blocked, wouldWrite: result.wouldWrite, change: result.change }),
   * )
   * // => { blocked: false, wouldWrite: true, change: "created" }
   * ```
   *
   * @since 0.0.0
   */
  static checkOne(
    target: SchemaTarget,
    options?: SchemaPipelineOptions
  ): Effect.Effect<
    PipelineCheckResult,
    SchemaConversionError | SchemaValidatorError | CanonicalJsonError | SchemaFileReadError,
    SchemaFile | SchemaValidator
  > {
    return SchemaPipeline.check([target], options).pipe(Effect.map((results) => results[0] as PipelineCheckResult));
  }
}
