/**
 * Schemas of the strict-tier encrypted spool: how its key is protected, the
 * AES-256-GCM segment written for each held-back export, the spool options,
 * and what a replay returns.
 *
 * **Details**
 *
 * A segment follows the `@beep/repo-ai-metrics` archive envelope: an
 * algorithm literal, a standard Base64 12-byte nonce, and standard Base64
 * ciphertext with its 16-byte authentication tag appended. Its header
 * (signal, tier, key epoch, seal time) is bound to the ciphertext as
 * additional authenticated data, so editing any header field fails the
 * authentication check.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ObservabilityId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { TelemetryTier } from "../catalog/Catalog.literals.ts";
import { TelemetryRefusalTag } from "../Observability.instruments.ts";
import { RefusalLedger, StrictEgressRecord, StrictSignal } from "./StrictGate.schemas.ts";

const $I = $ObservabilityId.create("strict/StrictSpool.schemas");

const aesGcmNonceBytes = 12;
const aesGcmTagBytes = 16;
const defaultMaxBytes = 8 * 1024 * 1024;

/**
 * How the strict spool's root key is protected at rest, and so which
 * production path produced it.
 *
 * **Details**
 *
 * `dpapi-ffi` and `dpapi-powershell` are the Windows production paths: the
 * key is wrapped with DPAPI for the current user through `crypt32` over
 * `bun:ffi`, or through PowerShell's `ProtectedData` when the FFI path is
 * unavailable. `dev-memory` and `dev-file` are not production: the first
 * lives only as long as the process, the second is stored unwrapped in an
 * owner-only file.
 *
 * **Example** (Read the FFI path)
 *
 * ```ts import.meta.vitest name="Read the FFI path"
 * import { StrictKeyProtection } from "@beep/observability/strict"
 *
 * StrictKeyProtection.Enum["dpapi-ffi"] // => "dpapi-ffi"
 * StrictKeyProtection.is["dev-file"]("dev-file") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StrictKeyProtection = LiteralKit(["dpapi-ffi", "dpapi-powershell", "dev-memory", "dev-file"]).pipe(
  $I.annoteSchema("StrictKeyProtection", {
    description: "How the strict spool root key is protected at rest: DPAPI via FFI or PowerShell, or a dev-only form.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type StrictKeyProtection = typeof StrictKeyProtection.Type;

/**
 * **Example** (Read the algorithm)
 *
 * ```ts import.meta.vitest name="Read the algorithm"
 * import { StrictSpoolAlgorithm } from "@beep/observability/strict"
 *
 * StrictSpoolAlgorithm.Enum["AES-256-GCM"] // => "AES-256-GCM"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StrictSpoolAlgorithm = LiteralKit(["AES-256-GCM"]).pipe(
  $I.annoteSchema("StrictSpoolAlgorithm", {
    description: "Encryption algorithm of a strict spool segment.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type StrictSpoolAlgorithm = typeof StrictSpoolAlgorithm.Type;

const AesGcmNonceBase64 = S.String.check(
  S.makeFilter(
    (value: string) =>
      O.exists(Result.getSuccess(Base64.decode(value)), (bytes) => bytes.byteLength === aesGcmNonceBytes),
    $I.annote("AesGcmNonceBase64Check", {
      title: "AES-GCM Nonce Base64",
      description: "Standard Base64 that decodes to exactly 12 nonce bytes.",
      message: "Spool segment nonce must be standard Base64 of exactly 12 bytes",
    })
  )
).pipe(
  $I.annoteSchema("AesGcmNonceBase64", {
    description: "Standard Base64 encoding of the 12-byte AES-GCM nonce of a spool segment.",
  })
);

const AesGcmCiphertextBase64 = S.String.check(
  S.makeFilter(
    (value: string) =>
      Result.match(Base64.decode(value), {
        onFailure: () => false,
        onSuccess: (bytes) => bytes.byteLength >= aesGcmTagBytes,
      }),
    $I.annote("AesGcmCiphertextBase64Check", {
      title: "AES-GCM Ciphertext Base64",
      description: "Standard Base64 of ciphertext long enough to carry the 16-byte authentication tag.",
      message: "Spool segment ciphertext must be standard Base64 including a 16-byte AES-GCM tag",
    })
  )
).pipe(
  $I.annoteSchema("AesGcmCiphertextBase64", {
    description: "Standard Base64 encoding of AES-GCM ciphertext with its authentication tag appended.",
  })
);

/**
 * One encrypted spool segment: a single held-back export body, sealed with
 * AES-256-GCM under the spool key, stamped with the tier it was gated under.
 *
 * **Details**
 *
 * `version`, `signal`, `tier`, `keyEpoch` and `sealedAtMillis` are the header
 * and are authenticated as additional data; the body exists only inside the
 * ciphertext.
 *
 * **Example** (Check a segment header)
 *
 * ```ts import.meta.vitest name="Check a segment header"
 * import { StrictSpoolSegment } from "@beep/observability/strict"
 * import * as S from "effect/Schema"
 *
 * S.is(StrictSpoolSegment)({ version: 1, signal: "traces" }) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictSpoolSegment extends S.Opaque<StrictSpoolSegment, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag(1),
    algorithm: StrictSpoolAlgorithm,
    signal: StrictSignal,
    tier: TelemetryTier,
    keyEpoch: S.NonEmptyString,
    sealedAtMillis: S.Natural,
    nonceBase64: AesGcmNonceBase64,
    ciphertextBase64: AesGcmCiphertextBase64,
  }).pipe(
    $I.annoteSchema("StrictSpoolSegment", {
      description: "One AES-256-GCM sealed strict export body with its authenticated header and gated tier.",
    })
  )
) {}

/**
 * Where the strict spool lives, the tier it runs at, and how large it may
 * grow.
 *
 * **Details**
 *
 * `tier` is stamped on every appended segment and is the ceiling at replay:
 * a segment whose tier is looser is refused. When the segments on disk
 * exceed `maxBytes`, the oldest are evicted first. `maxBytes` defaults to
 * 8 MiB.
 *
 * **Example** (Configure a spool)
 *
 * ```ts import.meta.vitest name="Configure a spool"
 * import { StrictSpoolOptions } from "@beep/observability/strict"
 *
 * const options = StrictSpoolOptions.make({ directory: "/state/telemetry/spool", tier: "shape-only" })
 * options.maxBytes // => 8388608
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictSpoolOptions extends S.Opaque<StrictSpoolOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    directory: S.NonEmptyString,
    tier: TelemetryTier,
    maxBytes: S.Int.check(S.isGreaterThan(0)).pipe(S.withConstructorDefault(Effect.succeed(defaultMaxBytes))),
  }).pipe(
    $I.annoteSchema("StrictSpoolOptions", {
      description: "Strict spool directory, its tier ceiling, and the byte bound past which old segments are evicted.",
    })
  )
) {}

/**
 * What a spool replay returns: the bodies that passed, oldest first, and a
 * count of every segment it refused.
 *
 * **Example** (An empty replay)
 *
 * ```ts import.meta.vitest name="An empty replay"
 * import { StrictSpoolReplay } from "@beep/observability/strict"
 * import * as HashMap from "effect/HashMap"
 *
 * StrictSpoolReplay.make({ records: [], refused: HashMap.empty() }).records.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictSpoolReplay extends S.Opaque<StrictSpoolReplay, { readonly brand: unique symbol }>()(
  S.Struct({
    records: S.Array(StrictEgressRecord),
    refused: RefusalLedger,
  }).pipe(
    $I.annoteSchema("StrictSpoolReplay", {
      description: "Strict spool replay: the bodies that passed, oldest first, and refusal counts by tag.",
    })
  )
) {}

/**
 * What reading one spool segment came to: the body it sealed, or the refusal
 * tag it was counted under.
 *
 * **Example** (Match an outcome)
 *
 * ```ts import.meta.vitest name="Match an outcome"
 * import { StrictSpoolOutcome } from "@beep/observability/strict"
 *
 * const outcome = StrictSpoolOutcome.cases.refused.make({ tag: "spool-segment-invalid" })
 * StrictSpoolOutcome.guards.refused(outcome) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StrictSpoolOutcome = S.TaggedUnion({
  opened: { record: StrictEgressRecord },
  refused: { tag: TelemetryRefusalTag },
}).pipe(
  $I.annoteSchema("StrictSpoolOutcome", {
    description: "Outcome of reading one strict spool segment: its sealed body, or the tag it was refused under.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type StrictSpoolOutcome = typeof StrictSpoolOutcome.Type;

/**
 * **Details**
 *
 * `sealedAtMillis` comes from the segment's file name, so a segment whose
 * contents no longer decode still has a time; a file name without one reads
 * as `0`.
 *
 * **Example** (Describe a refused segment)
 *
 * ```ts import.meta.vitest name="Describe a refused segment"
 * import { StrictSpoolOutcome, StrictSpoolSurveyEntry } from "@beep/observability/strict"
 *
 * const entry = StrictSpoolSurveyEntry.make({
 *   sealedAtMillis: 1_700_000_000_000,
 *   sizeBytes: 512,
 *   outcome: StrictSpoolOutcome.cases.refused.make({ tag: "spool-tier-refused" }),
 * })
 * entry.sizeBytes // => 512
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictSpoolSurveyEntry extends S.Opaque<StrictSpoolSurveyEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    sealedAtMillis: S.Natural,
    sizeBytes: S.Natural,
    outcome: StrictSpoolOutcome,
  }).pipe(
    $I.annoteSchema("StrictSpoolSurveyEntry", {
      description: "One strict spool segment: seal time from its name, size on disk, and its read outcome.",
    })
  )
) {}

/**
 * **Example** (An empty survey)
 *
 * ```ts import.meta.vitest name="An empty survey"
 * import { StrictSpoolSurvey } from "@beep/observability/strict"
 *
 * StrictSpoolSurvey.make({ entries: [] }).entries.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StrictSpoolSurvey extends S.Opaque<StrictSpoolSurvey, { readonly brand: unique symbol }>()(
  S.Struct({
    entries: S.Array(StrictSpoolSurveyEntry),
  }).pipe(
    $I.annoteSchema("StrictSpoolSurvey", {
      description: "Read-only survey of a strict spool directory: every segment, oldest first.",
    })
  )
) {}
