/** Captured cleaner execution port and runtime-only owned-value capabilities.
 * Behavioral protocol adapts eyecite 2.7.6, Free Law Project, BSD-2-Clause.
 * See THIRD_PARTY_NOTICES.md. These are server contracts, never wire callbacks.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { CitationEngineAbsoluteMaxima } from "./CitationEngine.limits.ts";
import type * as Effect from "effect/Effect";
import type * as O from "effect/Option";
import type { CitationSafetyLimitExceeded } from "./CitationEngine.safety.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.cleaner");
/**
 * An adapter-owned runtime value/step/function identity. Decoding this data does
 * not issue ownership; the captured adapter must validate its original handle.
 * No host value or callable is serialized in this schema.
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationCleanerObject } from "@beep/law-practice-use-cases/server"
 * console.log(CitationCleanerObject.fields.slot !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationCleanerObject extends S.Opaque<CitationCleanerObject, { readonly brand: unique symbol }>()(
  S.Struct({ slot: S.Natural }).pipe(
    $I.annoteSchema("CitationCleanerObject", {
      description: "Server runtime identity; never a citation, source anchor or persisted entity ID.",
    })
  )
) {}
/**
 * A positive text charge. Issuance and single consumption are checked by the
 * operation's private weak map; a structural clone has no spending authority.
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationCleanerTextCharge } from "@beep/law-practice-use-cases/server"
 * console.log(CitationCleanerTextCharge.fields.units !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationCleanerTextCharge extends S.Opaque<CitationCleanerTextCharge, { readonly brand: unique symbol }>()(
  S.Struct({
    units: S.Int.check(S.isBetween({ minimum: 1, maximum: CitationEngineAbsoluteMaxima.producedTextUtf16 })),
  }).pipe(
    $I.annoteSchema("CitationCleanerTextCharge", {
      description: "Source-free, operation-issued text reservation; zero text needs no charge object.",
    })
  )
) {}
// A structural decoder reconstructs data. These fields instead carry live
// adapter/operation handles unchanged; their owner still rejects decoded copies.
/** Validate a runtime handle without replacing its reference. The adapter still checks ownership.
 *
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationLiveCleanerObject } from "@beep/law-practice-use-cases/server"
 * import * as S from "effect/Schema"
 * console.log(typeof S.is(CitationLiveCleanerObject)) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationLiveCleanerObject = CitationCleanerObject.pipe(
  S.is,
  S.declare,
  $I.annoteSchema("CitationLiveCleanerObject", {
    description: "Preserve a live reference's identity while validating its shape; ownership is checked separately.",
  })
);
/** Runtime handle type validated by the from-self codec; validation grants no ownership.
 * @category models
 * @since 0.0.0
 */
export type CitationLiveCleanerObject = typeof CitationLiveCleanerObject.Type;
const LiveCharge = CitationCleanerTextCharge.pipe(
  S.is,
  S.declare,
  $I.annoteSchema("LiveCharge", {
    description: "Preserve the operation's exact reservation token; decoding data never issues a reservation.",
  })
);
/** A callback result paired with the exact reservations obtained before allocating text.
 *
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationCleanerProduced } from "@beep/law-practice-use-cases/server"
 * console.log(CitationCleanerProduced.fields.charges !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationCleanerProduced extends S.Opaque<CitationCleanerProduced, { readonly brand: unique symbol }>()(
  S.Struct({ value: CitationLiveCleanerObject, charges: S.Array(LiveCharge) }).pipe(
    $I.annoteSchema("CitationCleanerProduced", {
      description:
        "Runtime result plus reservations made before materializing its text; non-text results have no text charge.",
    })
  )
) {}
/** Cumulative text reservations and retirement state for one cleaner invocation.
 *
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationCleanerWorkSnapshot } from "@beep/law-practice-use-cases/server"
 * console.log(CitationCleanerWorkSnapshot.make({ producedTextUtf16: 0, closed: false }).closed) // false
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationCleanerWorkSnapshot extends S.Opaque<
  CitationCleanerWorkSnapshot,
  { readonly brand: unique symbol }
>()(
  S.Struct({ producedTextUtf16: S.Natural, closed: S.Boolean }).pipe(
    $I.annoteSchema("CitationCleanerWorkSnapshot", {
      description: "One operation's cumulative text reservations and lifetime, without source content.",
    })
  )
) {}
const Reason = LiteralKit([
  "invalid-input",
  "unknown-plan",
  "unknown-step",
  "lookup-key-missing",
  "not-callable",
  "callback-failed",
  "iteration-failed",
  "unissued-value",
  "closed-work",
  "invalid-reservation",
  "runtime-failed",
  "closed-owner",
  "identity-exhausted",
  "invalid-text-allocation",
  "builtin-input-type",
  "html-parse-error",
  "html-unicode-encoding-declaration",
  "html-unicode-decode-error",
]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed declared execution/adapter failures; no native messages, host values or nested causes.",
  })
);
/** Declared cleaner-port refusal with closed reason codes and no source payload or nested cause.
 *
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationCleanerFailure } from "@beep/law-practice-use-cases/server"
 * console.log(CitationCleanerFailure.make({ reason: "invalid-input" }).reason) // "invalid-input"
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CitationCleanerFailure extends S.TaggedError<CitationCleanerFailure, { readonly brand: unique symbol }>(
  $I`CitationCleanerFailure`
)(
  "CitationCleanerFailure",
  { reason: Reason },
  $I.annoteError<CitationCleanerFailure>("CitationCleanerFailure", {
    description:
      "Declared cleaner-port failure; engine translation into CitationEngineFailure remains an integration duty.",
  })
) {}
/** A completed cleaner value and measured text work; failure never carries a partial value.
 *
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationCleanerRun } from "@beep/law-practice-use-cases/server"
 * console.log(CitationCleanerRun.fields.producedTextUtf16 !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationCleanerRun extends S.Opaque<CitationCleanerRun, { readonly brand: unique symbol }>()(
  S.Struct({ value: CitationLiveCleanerObject, producedTextUtf16: S.Natural }).pipe(
    $I.annoteSchema("CitationCleanerRun", {
      description: "Runtime complete result identity and logical work; no partial result accompanies failure.",
    })
  )
) {}
type Failure = CitationCleanerFailure | CitationSafetyLimitExceeded;
/** Runtime cursor: no iterator or function is placed in request data.
 * @category services
 * @since 0.0.0
 */
export interface CitationCleanerCursor {
  readonly next: Effect.Effect<O.Option<CitationCleanerObject>, Failure>;
}
/**
 * A runtime capability captured by adapter code. Reserve positive units before
 * materializing text, then return those exact tickets with the produced value.
 * Nested execution shares these charges and the enclosing timer. Adapters must
 * own/retire native work and must not detach callback work.
 * @category services
 * @since 0.0.0
 */
export interface CitationCleanerWork {
  readonly nested: (plan: string, initial: CitationCleanerObject) => Effect.Effect<CitationCleanerObject, Failure>;
  readonly reserveText: (units: number) => Effect.Effect<CitationCleanerTextCharge, Failure>;
  readonly snapshot: Effect.Effect<CitationCleanerWorkSnapshot>;
  /**
   * Exclusively lend remaining capacity to a captured bounded producer. It must
   * enforce this ceiling before allocating output and retire native work before
   * returning. No ledger reentry is permitted from the borrowing fiber or its children. Empty
   * output is valid even at zero capacity; settlement issues no empty ticket.
   */
  readonly withTextCapacity: <A, E>(
    produce: (remaining: number) => Effect.Effect<{ readonly value: A; readonly units: number }, E>
  ) => Effect.Effect<{ readonly value: A; readonly charges: ReadonlyArray<CitationCleanerTextCharge> }, E | Failure>;
}
/**
 * All host values, callables, registries and iterator state stay in a captured
 * server adapter. Every method returns R = never. `contains` and `get` are
 * separate observable operations. `invoke` must reserve text before allocation;
 * `textUnits` inspects owned text without invoking user length/coercion hooks.
 * The server owns primitive/native adapters, issuance and retirement. This port
 * preserves the existing lazy protocol; it does not license unsafe arbitrary code.
 * **Example** (Inspect the server contract)
 * ```ts
 * import { CitationCleaner } from "@beep/law-practice-use-cases/server"
 * import * as Effect from "effect/Effect"
 * const program = Effect.gen(function* () {
 *   const cleaner = yield* CitationCleaner
 *   return yield* cleaner.fromText("Example")
 * })
 * console.log(typeof program) // "object"
 * ```
 * @category services
 * @since 0.0.0
 */
export class CitationCleaner extends Context.Service<
  CitationCleaner,
  {
    readonly fromText: (text: string) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly assertOwned: (value: CitationLiveCleanerObject) => Effect.Effect<void, Failure>;
    readonly textUnits: (value: CitationCleanerObject) => Effect.Effect<O.Option<number>, Failure>;
    readonly open: (
      plan: string,
      initial: CitationCleanerObject,
      work: CitationCleanerWork
    ) => Effect.Effect<CitationCleanerCursor, Failure>;
    readonly contains: (step: CitationCleanerObject, work: CitationCleanerWork) => Effect.Effect<boolean, Failure>;
    readonly get: (
      step: CitationCleanerObject,
      work: CitationCleanerWork
    ) => Effect.Effect<CitationCleanerObject, Failure>;
    readonly callable: (value: CitationCleanerObject, work: CitationCleanerWork) => Effect.Effect<boolean, Failure>;
    readonly invoke: (
      callable: CitationCleanerObject,
      value: CitationCleanerObject,
      work: CitationCleanerWork
    ) => Effect.Effect<CitationCleanerProduced, Failure>;
  }
>()($I`CitationCleaner`) {}

/** Resolve an installed extraction plan to its original live cleaner container.
 * The server must share value ownership and cleaner/Document protocols with the
 * engine. Lookup must not iterate or normalize the container. Requests carry
 * only the bounded name; unknown plans fail without executable request data.
 * **Example** (Capture the installed plan port)
 * ```ts
 * import { CitationExtractionCleanerPlans } from "@beep/law-practice-use-cases/server"
 * import * as Effect from "effect/Effect"
 * const port = Effect.gen(function* () { return yield* CitationExtractionCleanerPlans })
 * console.log(typeof port)
 * ```
 * @category services
 * @since 0.0.0
 */
export class CitationExtractionCleanerPlans extends Context.Service<
  CitationExtractionCleanerPlans,
  { readonly resolve: (name: string) => Effect.Effect<CitationCleanerObject, Failure> }
>()($I`CitationExtractionCleanerPlans`) {}
