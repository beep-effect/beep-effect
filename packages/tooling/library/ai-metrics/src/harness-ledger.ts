/**
 * Schema-first harness evidence ledger: context surfaces, harness
 * fingerprints, ledger rows, and the derived predicates that decide harness-ness,
 * edit budgets, staleness, and warm restarts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { DateTime, Effect, pipe, Random } from "effect";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { hashPublicTextSha256 } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("harness-ledger");

/**
 * Sentinel recorded for a fingerprint dimension the caller could not observe.
 *
 * **Details**
 *
 * A missing model id or reasoning effort is recorded as this literal rather
 * than as an absent key, so the canonical JSON that feeds the fingerprint id
 * always carries all four fields and two "unknown" captures hash identically.
 *
 * **Example** (Reading the sentinel)
 *
 * ```ts
 * import { harnessFingerprintUnknown } from "@beep/repo-ai-metrics"
 *
 * console.log(harnessFingerprintUnknown) // "unknown"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const harnessFingerprintUnknown = "unknown";

/**
 * Repo surface an agent can load as context: the observed vocabulary of a
 * ledger row's `touched` set.
 *
 * **Details**
 *
 * Every kind except `jsdoc` is observable from tool calls (a `Skill` tool call,
 * or a Read/Edit under `AGENTS.md`, `.claude/**`, `.patterns/**`, or an
 * `mcp__<server>__*` tool name). `jsdoc` is declared-only: an agent reading a
 * source file's JSDoc is indistinguishable from reading product code, so it
 * never appears in hook-pulse evidence and can only be declared on a row.
 *
 * **Example** (Listing the surface kinds)
 *
 * ```ts
 * import { ContextSurfaceKind } from "@beep/repo-ai-metrics"
 *
 * console.log(ContextSurfaceKind.Options.length) // 8
 * console.log(ContextSurfaceKind.is.skill(ContextSurfaceKind.Enum.skill)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ContextSurfaceKind = LiteralKit([
  "agents-md",
  "skill",
  "hook",
  "pattern",
  "mcp-server",
  "agent-definition",
  "settings",
  "jsdoc",
]).pipe(
  $I.annoteSchema("ContextSurfaceKind", {
    description: "Repo context surface kinds; jsdoc is declared-only and never observed from tool calls.",
  })
);

/**
 * Decoded context surface kind.
 *
 * @category models
 * @since 0.0.0
 */
export type ContextSurfaceKind = typeof ContextSurfaceKind.Type;

/**
 * SHA-256 hex identity of one context surface, hashed from
 * {@link contextSurfaceKey}.
 *
 * **Details**
 *
 * The id carries no path: the key is `${kind}:${name}` where `name` is a bare
 * surface name, so the hook-pulse writer and this module agree on identity
 * without recording where a checkout lives.
 *
 * **Example** (Validating a surface id)
 *
 * ```ts
 * import { ContextSurfaceId } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ContextSurfaceId)("a".repeat(64))) // true
 * console.log(S.is(ContextSurfaceId)("skill:yeet")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ContextSurfaceId = Sha256Hex.pipe(
  $I.annoteSchema("ContextSurfaceId", {
    description: "SHA-256 hex of the canonical `${kind}:${name}` context surface key.",
  })
);

/**
 * Decoded context surface id.
 *
 * @category models
 * @since 0.0.0
 */
export type ContextSurfaceId = typeof ContextSurfaceId.Type;

/**
 * Build the canonical context surface key hashed into a {@link ContextSurfaceId}.
 *
 * **Details**
 *
 * The key is exactly `${kind}:${name}` with no trailing newline. `name` is
 * `AGENTS.md` for `agents-md`; the skill directory name for `skill`; the file
 * name under `.claude/hooks` for `hook`; the file name under `.patterns` for
 * `pattern`; the server segment of `mcp__<server>__*` for `mcp-server`; the file
 * name under `.claude/agents` for `agent-definition`; and the settings file name
 * for `settings`.
 *
 * **Gotchas**
 *
 * `.claude/hooks/hook-pulse.sh` hashes the same key with
 * `printf '%s' "$key" | sha256sum`. `echo` would append a newline and every id
 * would silently diverge.
 *
 * **Example** (Keying a skill surface)
 *
 * ```ts
 * import { contextSurfaceKey } from "@beep/repo-ai-metrics"
 *
 * console.log(contextSurfaceKey("skill", "yeet")) // "skill:yeet"
 * ```
 *
 * @param kind - Which {@link ContextSurfaceKind} the surface belongs to.
 * @param name - Bare surface name for that kind.
 * @returns The canonical `${kind}:${name}` key.
 * @category utilities
 * @since 0.0.0
 */
export const contextSurfaceKey: {
  (name: string): (kind: ContextSurfaceKind) => string;
  (kind: ContextSurfaceKind, name: string): string;
} = dual(2, (kind: ContextSurfaceKind, name: string): string => `${kind}:${name}`);

/**
 * Typed failure raised while deriving harness ledger identities.
 *
 * **Example** (Constructing the failure)
 *
 * ```ts
 * import { HarnessLedgerError } from "@beep/repo-ai-metrics"
 *
 * const error = HarnessLedgerError.make({ cause: "bad hash", message: "Invalid session hash." })
 * console.log(error._tag) // "HarnessLedgerError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HarnessLedgerError extends S.TaggedError<HarnessLedgerError>($I`HarnessLedgerError`)(
  "HarnessLedgerError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
  },
  $I.annoteError<HarnessLedgerError>("HarnessLedgerError", {
    description: "Typed failure raised while hashing or composing harness ledger identities.",
  })
) {}

const harnessLedgerError =
  (message: string) =>
  (cause: unknown): HarnessLedgerError =>
    HarnessLedgerError.make({ cause, message });

/**
 * Hash a context surface into its {@link ContextSurfaceId}.
 *
 * **Example** (Hashing a skill surface)
 *
 * ```ts
 * import { contextSurfaceId } from "@beep/repo-ai-metrics"
 * import * as Effect from "effect/Effect"
 *
 * const id = Effect.runPromise(contextSurfaceId("skill", "yeet"))
 * console.log(id)
 * ```
 *
 * @param kind - Which {@link ContextSurfaceKind} the surface belongs to.
 * @param name - Bare surface name for that kind.
 * @returns SHA-256 hex of `${kind}:${name}`.
 * @category utilities
 * @since 0.0.0
 */
export const contextSurfaceId: {
  (name: string): (kind: ContextSurfaceKind) => Effect.Effect<ContextSurfaceId, HarnessLedgerError>;
  (kind: ContextSurfaceKind, name: string): Effect.Effect<ContextSurfaceId, HarnessLedgerError>;
} = dual(
  2,
  (kind: ContextSurfaceKind, name: string): Effect.Effect<ContextSurfaceId, HarnessLedgerError> =>
    hashPublicTextSha256(contextSurfaceKey(kind, name)).pipe(
      Effect.mapError(harnessLedgerError("Failed to hash the context surface key."))
    )
);

/**
 * Harness mechanism class: the declared vocabulary of a ledger row, aligned
 * with the RRSI paper's mechanism set K so survival curves compare to the
 * literature.
 *
 * **Example** (Checking a mechanism class)
 *
 * ```ts
 * import { MechanismClass } from "@beep/repo-ai-metrics"
 *
 * console.log(MechanismClass.is.context_mgmt(MechanismClass.Enum.context_mgmt)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const MechanismClass = LiteralKit([
  "prompt",
  "control_flow",
  "config",
  "output_plumbing",
  "context_mgmt",
  "client_tool",
  "skill",
  "memory",
  "subagent",
]).pipe(
  $I.annoteSchema("MechanismClass", {
    description: "Declared harness mechanism class, mirroring the RRSI paper's mechanism set K.",
  })
);

/**
 * Decoded mechanism class.
 *
 * @category models
 * @since 0.0.0
 */
export type MechanismClass = typeof MechanismClass.Type;

/**
 * Disposition of a harness ledger row.
 *
 * **Details**
 *
 * `proposed` rows come from the loop; every other disposition is a human
 * admission decision. `tombstoned` rows may carry a `resurrectWhen` condition.
 *
 * **Example** (Checking a disposition)
 *
 * ```ts
 * import { LedgerDisposition } from "@beep/repo-ai-metrics"
 *
 * console.log(LedgerDisposition.Enum.tombstoned) // "tombstoned"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LedgerDisposition = LiteralKit([
  "proposed",
  "accepted",
  "rejected",
  "deferred",
  "waived",
  "tombstoned",
]).pipe(
  $I.annoteSchema("LedgerDisposition", {
    description: "Harness ledger row disposition: loop proposals plus human admission outcomes.",
  })
);

/**
 * Decoded ledger disposition.
 *
 * @category models
 * @since 0.0.0
 */
export type LedgerDisposition = typeof LedgerDisposition.Type;

/**
 * The four identity dimensions of a harness regime, before hashing.
 *
 * **Details**
 *
 * No repo revision belongs here: ordinary code commits do not change the
 * harness regime. A missing reasoning effort decodes to
 * {@link harnessFingerprintUnknown}.
 *
 * **Example** (Constructing fingerprint parts)
 *
 * ```ts
 * import { HarnessFingerprintParts } from "@beep/repo-ai-metrics"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const parts = HarnessFingerprintParts.make({
 *   modelId: "gpt-6-astra",
 *   harnessSessionHash: Sha256Hex.make("a".repeat(64)),
 *   harnessBaselineHash: Sha256Hex.make("b".repeat(64))
 * })
 * console.log(parts.reasoningEffort) // "unknown"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessFingerprintParts extends S.Class<HarnessFingerprintParts>($I`HarnessFingerprintParts`)(
  {
    modelId: S.NonEmptyString,
    reasoningEffort: S.NonEmptyString.pipe(SchemaUtils.withKeyDefaults(harnessFingerprintUnknown)),
    harnessSessionHash: Sha256Hex,
    harnessBaselineHash: Sha256Hex,
  },
  $I.annote("HarnessFingerprintParts", {
    description: "Model id, reasoning effort, and config-snapshot session/baseline hashes of one harness regime.",
  })
) {}

/**
 * Harness regime identity: the four {@link HarnessFingerprintParts} plus their
 * derived `fingerprintId`.
 *
 * **Details**
 *
 * `fingerprintId` is SHA-256 hex of the canonical JSON encoding of the parts,
 * with keys in the order `modelId`, `reasoningEffort`, `harnessSessionHash`,
 * `harnessBaselineHash`. Build fingerprints through
 * {@link makeHarnessFingerprint} or {@link harnessFingerprintFromParts}.
 *
 * **Gotchas**
 *
 * Decoding cannot re-verify `fingerprintId` because hashing is effectful; use
 * {@link deriveHarnessFingerprintId} to recheck a decoded row.
 *
 * **Example** (Constructing a fingerprint)
 *
 * ```ts
 * import { HarnessFingerprint } from "@beep/repo-ai-metrics"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const fingerprint = HarnessFingerprint.make({
 *   modelId: "gpt-6-astra",
 *   reasoningEffort: "medium",
 *   harnessSessionHash: Sha256Hex.make("a".repeat(64)),
 *   harnessBaselineHash: Sha256Hex.make("b".repeat(64)),
 *   fingerprintId: Sha256Hex.make("c".repeat(64))
 * })
 * console.log(fingerprint.modelId) // "gpt-6-astra"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessFingerprint extends HarnessFingerprintParts.extend<HarnessFingerprint>($I`HarnessFingerprint`)(
  {
    fingerprintId: Sha256Hex,
  },
  $I.annote("HarnessFingerprint", {
    description: "Harness regime identity; evidence captured under a different fingerprintId is stale.",
  })
) {}

const encodeHarnessFingerprintPartsJson = S.encodeEffect(S.fromJsonString(HarnessFingerprintParts));

/**
 * Derive the fingerprint id from its four parts.
 *
 * **Example** (Deriving a fingerprint id)
 *
 * ```ts
 * import { deriveHarnessFingerprintId, HarnessFingerprintParts } from "@beep/repo-ai-metrics"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as Effect from "effect/Effect"
 *
 * const id = Effect.runPromise(
 *   deriveHarnessFingerprintId(
 *     HarnessFingerprintParts.make({
 *       modelId: "gpt-6-astra",
 *       harnessSessionHash: Sha256Hex.make("a".repeat(64)),
 *       harnessBaselineHash: Sha256Hex.make("b".repeat(64))
 *     })
 *   )
 * )
 * console.log(id)
 * ```
 *
 * @param parts - Model id, reasoning effort, and the two harness hashes.
 * @returns SHA-256 hex of the canonical JSON encoding of the parts.
 * @category utilities
 * @since 0.0.0
 */
export const deriveHarnessFingerprintId = Effect.fn("AiMetrics.deriveHarnessFingerprintId")(function* (
  parts: HarnessFingerprintParts
) {
  const canonical = yield* encodeHarnessFingerprintPartsJson(
    HarnessFingerprintParts.make({
      modelId: parts.modelId,
      reasoningEffort: parts.reasoningEffort,
      harnessSessionHash: parts.harnessSessionHash,
      harnessBaselineHash: parts.harnessBaselineHash,
    })
  ).pipe(Effect.mapError(harnessLedgerError("Failed to encode harness fingerprint parts.")));
  return yield* hashPublicTextSha256(canonical).pipe(
    Effect.mapError(harnessLedgerError("Failed to hash harness fingerprint parts."))
  );
});

/**
 * Build a {@link HarnessFingerprint} from its parts, deriving the id.
 *
 * **Example** (Fingerprinting explicit parts)
 *
 * ```ts
 * import { harnessFingerprintFromParts, HarnessFingerprintParts } from "@beep/repo-ai-metrics"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as Effect from "effect/Effect"
 *
 * const fingerprint = Effect.runPromise(
 *   harnessFingerprintFromParts(
 *     HarnessFingerprintParts.make({
 *       modelId: "gpt-6-astra",
 *       harnessSessionHash: Sha256Hex.make("a".repeat(64)),
 *       harnessBaselineHash: Sha256Hex.make("b".repeat(64))
 *     })
 *   )
 * )
 * console.log(fingerprint)
 * ```
 *
 * @param parts - Model id, reasoning effort, and the two harness hashes.
 * @returns The fingerprint with its derived id.
 * @category constructors
 * @since 0.0.0
 */
export const harnessFingerprintFromParts = Effect.fn("AiMetrics.harnessFingerprintFromParts")(function* (
  parts: HarnessFingerprintParts
) {
  const fingerprintId = yield* deriveHarnessFingerprintId(parts);
  return HarnessFingerprint.make({
    modelId: parts.modelId,
    reasoningEffort: parts.reasoningEffort,
    harnessSessionHash: parts.harnessSessionHash,
    harnessBaselineHash: parts.harnessBaselineHash,
    fingerprintId,
  });
});

/**
 * Inputs for {@link makeHarnessFingerprint}.
 *
 * **Details**
 *
 * `modelId` and `reasoningEffort` are optional because not every caller can
 * observe them; an absent value is recorded as {@link harnessFingerprintUnknown}.
 *
 * **Example** (Describing an unknown-model capture)
 *
 * ```ts
 * import { HarnessFingerprintInput } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(O.none<string>())) // true
 * console.log(typeof HarnessFingerprintInput) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessFingerprintInput extends S.Class<HarnessFingerprintInput>($I`HarnessFingerprintInput`)(
  {
    modelId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    reasoningEffort: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    // Structural subset of `AiMetricsConfigSnapshotResult`, so a snapshot result
    // is passed as-is without coupling this schema to the whole manifest.
    snapshot: S.Struct({ baselineHash: S.String, sessionHash: S.String }),
  },
  $I.annote("HarnessFingerprintInput", {
    description: "Config-snapshot hashes plus the optionally observed model id and reasoning effort.",
  })
) {}

const decodeSha256Hex = S.decodeUnknownEffect(Sha256Hex);

/**
 * Compose a {@link HarnessFingerprint} from a config snapshot result and the
 * observed model id and reasoning effort.
 *
 * **Details**
 *
 * `harnessSessionHash` and `harnessBaselineHash` are the `sessionHash` and
 * `baselineHash` of an `AiMetricsConfigSnapshotResult` from
 * `makeAiMetricsConfigSnapshot`, which can be passed as `snapshot` directly. A
 * snapshot decoded from an older manifest may carry an empty hash; that fails
 * with {@link HarnessLedgerError} instead of fingerprinting an empty regime.
 *
 * **Example** (Fingerprinting a snapshot)
 *
 * ```ts
 * import { HarnessFingerprintInput, makeHarnessFingerprint } from "@beep/repo-ai-metrics"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = makeHarnessFingerprint(
 *   HarnessFingerprintInput.make({
 *     modelId: O.some("gpt-6-astra"),
 *     snapshot: { baselineHash: "b".repeat(64), sessionHash: "a".repeat(64) }
 *   })
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param input - Snapshot hashes plus optional model id and reasoning effort.
 * @returns The fingerprint with its derived id.
 * @category constructors
 * @since 0.0.0
 */
export const makeHarnessFingerprint = Effect.fn("AiMetrics.makeHarnessFingerprint")(function* (
  input: HarnessFingerprintInput
) {
  const harnessSessionHash = yield* decodeSha256Hex(input.snapshot.sessionHash).pipe(
    Effect.mapError(harnessLedgerError("Config snapshot sessionHash is not a SHA-256 hex digest."))
  );
  const harnessBaselineHash = yield* decodeSha256Hex(input.snapshot.baselineHash).pipe(
    Effect.mapError(harnessLedgerError("Config snapshot baselineHash is not a SHA-256 hex digest."))
  );
  return yield* harnessFingerprintFromParts(
    HarnessFingerprintParts.make({
      modelId: O.getOrElse(input.modelId, () => harnessFingerprintUnknown),
      reasoningEffort: O.getOrElse(input.reasoningEffort, () => harnessFingerprintUnknown),
      harnessSessionHash,
      harnessBaselineHash,
    })
  );
});

/**
 * Kind of reference a ledger row's edit points at.
 *
 * **Example** (Listing edit reference kinds)
 *
 * ```ts
 * import { HarnessEditRefKind } from "@beep/repo-ai-metrics"
 *
 * console.log(HarnessEditRefKind.Options) // ["commit", "diff-digest", "pending"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HarnessEditRefKind = LiteralKit(["commit", "diff-digest", "pending"]).pipe(
  $I.annoteSchema("HarnessEditRefKind", {
    description: "Whether a ledger edit is a commit, an uncommitted diff digest, or not yet made.",
  })
);

/**
 * Decoded edit reference kind.
 *
 * @category models
 * @since 0.0.0
 */
export type HarnessEditRefKind = typeof HarnessEditRefKind.Type;

class HarnessCommitEditRef extends S.Class<HarnessCommitEditRef>($I`HarnessCommitEditRef`)(
  {
    kind: S.tag(HarnessEditRefKind.Enum.commit),
    ref: S.NonEmptyString,
  },
  $I.annote("HarnessCommitEditRef", {
    description: "Edit recorded as a git commit id.",
  })
) {}

class HarnessDiffDigestEditRef extends S.Class<HarnessDiffDigestEditRef>($I`HarnessDiffDigestEditRef`)(
  {
    kind: S.tag(HarnessEditRefKind.Enum["diff-digest"]),
    ref: Sha256Hex,
  },
  $I.annote("HarnessDiffDigestEditRef", {
    description: "Uncommitted edit recorded as the SHA-256 hex digest of its diff.",
  })
) {}

class HarnessPendingEditRef extends S.Class<HarnessPendingEditRef>($I`HarnessPendingEditRef`)(
  {
    kind: S.tag(HarnessEditRefKind.Enum.pending),
  },
  $I.annote("HarnessPendingEditRef", {
    description: "Edit proposed but not yet made.",
  })
) {}

/**
 * The edit a ledger row describes, discriminated by `kind`.
 *
 * **Details**
 *
 * `commit` carries a git commit id in `ref`, `diff-digest` carries a SHA-256
 * hex diff digest in `ref`, and `pending` carries no ref.
 *
 * **Example** (Decoding a commit edit)
 *
 * ```ts
 * import { HarnessEditRef } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const edit = S.decodeUnknownSync(HarnessEditRef)({ kind: "commit", ref: "489ea7c488" })
 * console.log(edit.kind) // "commit"
 * console.log(S.is(HarnessEditRef)({ kind: "pending" })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HarnessEditRef = S.Union([HarnessCommitEditRef, HarnessDiffDigestEditRef, HarnessPendingEditRef]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("HarnessEditRef", {
    description: "Ledger edit reference: a commit id, an uncommitted diff digest, or pending.",
  })
);

/**
 * Decoded edit reference.
 *
 * @category models
 * @since 0.0.0
 */
export type HarnessEditRef = typeof HarnessEditRef.Type;

/**
 * Falsifiable behavioral claim attached to a harness edit.
 *
 * **Example** (Constructing a claim)
 *
 * ```ts
 * import { BehavioralClaim } from "@beep/repo-ai-metrics"
 *
 * const claim = BehavioralClaim.make({
 *   claim: "Agents stop hand-rolling literal unions",
 *   expectedSurface: "skill",
 *   expectedMetric: "schema-first lint findings per task"
 * })
 * console.log(claim.expectedSurface) // "skill"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BehavioralClaim extends S.Class<BehavioralClaim>($I`BehavioralClaim`)(
  {
    claim: S.NonEmptyString,
    expectedSurface: ContextSurfaceKind,
    expectedMetric: S.NonEmptyString,
  },
  $I.annote("BehavioralClaim", {
    description: "Hypothesis a harness edit is expected to confirm or refute, with its surface and metric.",
  })
) {}

/**
 * Measured score and cost delta of a harness edit.
 *
 * **Example** (Constructing a delta)
 *
 * ```ts
 * import { HarnessLedgerDelta } from "@beep/repo-ai-metrics"
 *
 * console.log(HarnessLedgerDelta.make({ score: 0.05, cost: -120 }).score) // 0.05
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessLedgerDelta extends S.Class<HarnessLedgerDelta>($I`HarnessLedgerDelta`)(
  {
    score: S.Finite,
    cost: S.Finite,
  },
  $I.annote("HarnessLedgerDelta", {
    description: "Score and cost delta measured for a harness edit against its baseline.",
  })
) {}

/**
 * Ledger row id: `hl-<yyyymmdd>-<8 lowercase hex>`.
 *
 * **Example** (Validating a row id)
 *
 * ```ts
 * import { HarnessLedgerRowId } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HarnessLedgerRowId)("hl-20260925-0a1b2c3d")) // true
 * console.log(S.is(HarnessLedgerRowId)("hl-2026-09-25")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HarnessLedgerRowId = S.NonEmptyString.check(S.isPattern(/^hl-\d{8}-[0-9a-f]{8}$/)).pipe(
  $I.annoteSchema("HarnessLedgerRowId", {
    description: "Harness ledger row id of the form hl-<yyyymmdd>-<8 lowercase hex>.",
  })
);

/**
 * Decoded ledger row id.
 *
 * @category models
 * @since 0.0.0
 */
export type HarnessLedgerRowId = typeof HarnessLedgerRowId.Type;

/**
 * Mint a fresh {@link HarnessLedgerRowId} for a row created at `createdAt`.
 *
 * **Details**
 *
 * The date segment is the UTC calendar date of `createdAt`; the suffix is 32
 * bits drawn from the `Random` service, so seeding `Random` makes ids
 * reproducible in tests.
 *
 * **Example** (Minting a reproducible row id)
 *
 * ```ts
 * import { makeHarnessLedgerRowId } from "@beep/repo-ai-metrics"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as Random from "effect/Random"
 *
 * const id = Effect.runSync(
 *   makeHarnessLedgerRowId(DateTime.makeUnsafe("2026-09-25T12:00:00.000Z")).pipe(Random.withSeed("ledger"))
 * )
 * console.log(id.startsWith("hl-20260925-")) // true
 * ```
 *
 * @param createdAt - Creation instant of the row the id belongs to.
 * @returns A row id of the form `hl-<yyyymmdd>-<8 lowercase hex>`.
 * @category constructors
 * @since 0.0.0
 */
export const makeHarnessLedgerRowId = Effect.fn("AiMetrics.makeHarnessLedgerRowId")(function* (
  createdAt: DateTime.Utc
) {
  const suffix = yield* Random.nextIntBetween(0, 0xffffffff);
  const day = pipe(DateTime.formatIsoDateUtc(createdAt), Str.replaceAll("-", ""));
  return HarnessLedgerRowId.make(`hl-${day}-${pipe(suffix.toString(16), Str.padStart(8, "0"))}`);
});

/**
 * One immutable harness evidence ledger row.
 *
 * **Details**
 *
 * `touched` is the observed set of {@link ContextSurfaceId}s and may be empty
 * at propose time. `repoRevision` is a sibling of `fingerprint`, never part of
 * it. `resurrectWhen` is the tombstone revival condition and is only accepted
 * when `disposition` is `tombstoned`.
 *
 * Rows are immutable, so a disposition change is a new row whose
 * `previousRowId` names the row it supersedes; the rows linked this way form a
 * chain whose latest row is the current state. A pruning proposal names the
 * surface it would retire in `targetSurface` (a hashed id, never a path) and
 * the session window it observed in `windowSessions`.
 *
 * **Gotchas**
 *
 * `touched` is an `effect/HashSet`, which plain `JSON.stringify` cannot
 * represent. Use {@link HarnessLedgerRow.decodeJsonEffect} and
 * {@link HarnessLedgerRow.encodeJsonEffect}, which go through `S.toCodecJson`
 * and encode the set as an array.
 *
 * **Example** (Decoding a proposed row)
 *
 * ```ts
 * import { HarnessLedgerRow } from "@beep/repo-ai-metrics"
 * import * as HashSet from "effect/HashSet"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownSync(S.toCodecJson(HarnessLedgerRow))({
 *   rowId: "hl-20260925-0a1b2c3d",
 *   createdAt: "2026-09-25T12:00:00.000Z",
 *   edit: { kind: "pending" },
 *   mechanismClass: "skill",
 *   touched: [],
 *   fingerprint: {
 *     modelId: "gpt-6-astra",
 *     reasoningEffort: "medium",
 *     harnessSessionHash: "a".repeat(64),
 *     harnessBaselineHash: "b".repeat(64),
 *     fingerprintId: "c".repeat(64)
 *   },
 *   disposition: "proposed"
 * })
 * console.log(HashSet.size(row.touched)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessLedgerRow extends S.Class<HarnessLedgerRow>($I`HarnessLedgerRow`)(
  S.Struct({
    rowId: HarnessLedgerRowId,
    createdAt: S.DateTimeUtcFromString,
    edit: HarnessEditRef,
    hypothesis: S.OptionFromOptionalKey(BehavioralClaim).pipe(SchemaUtils.withNoneDefault),
    mechanismClass: MechanismClass,
    touched: S.HashSet(ContextSurfaceId).pipe(SchemaUtils.withKeyDefaults(HashSet.empty<ContextSurfaceId>())),
    fingerprint: HarnessFingerprint,
    repoRevision: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    delta: S.OptionFromOptionalKey(HarnessLedgerDelta).pipe(SchemaUtils.withNoneDefault),
    disposition: LedgerDisposition,
    dispositionEvidence: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    resurrectWhen: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    previousRowId: S.OptionFromOptionalKey(HarnessLedgerRowId).pipe(SchemaUtils.withNoneDefault),
    targetSurface: S.OptionFromOptionalKey(ContextSurfaceId).pipe(SchemaUtils.withNoneDefault),
    windowSessions: S.OptionFromOptionalKey(S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1))).pipe(
      SchemaUtils.withNoneDefault
    ),
  }).check(
    S.makeFilter(
      (row) =>
        O.isNone(row.resurrectWhen) || row.disposition === LedgerDisposition.Enum.tombstoned
          ? undefined
          : { path: ["resurrectWhen"], issue: "resurrectWhen belongs to tombstoned rows only" },
      {
        identifier: "HarnessLedgerRowResurrectWhenInvariant",
        title: "Harness ledger resurrectWhen invariant",
        description: "Requires resurrectWhen to be absent unless the row is tombstoned.",
      }
    )
  ),
  $I.annote("HarnessLedgerRow", {
    description:
      "Immutable harness evidence ledger row: edit, hypothesis, observed surfaces, fingerprint, disposition.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(S.toCodecJson(HarnessLedgerRow)));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(S.toCodecJson(HarnessLedgerRow)));
}

/**
 * Whether a row is a harness edit: its observed `touched` set is non-empty.
 *
 * **Details**
 *
 * Harness-ness is decided after the fact from observed context surfaces, not
 * from which files the edit changed.
 *
 * **Example** (Classifying a row)
 *
 * ```ts
 * import { ContextSurfaceId, isHarnessEdit } from "@beep/repo-ai-metrics"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(isHarnessEdit({ touched: HashSet.empty<ContextSurfaceId>() })) // false
 * console.log(isHarnessEdit({ touched: HashSet.make(ContextSurfaceId.make("a".repeat(64))) })) // true
 * ```
 *
 * @param row - Row whose observed surfaces to inspect.
 * @returns `true` when at least one context surface was touched.
 * @category predicates
 * @since 0.0.0
 */
export const isHarnessEdit = (row: Pick<HarnessLedgerRow, "touched">): boolean => !HashSet.isEmpty(row.touched);

/**
 * Whether a row spends edit budget: it declares a hypothesis.
 *
 * **Example** (Checking budget applicability)
 *
 * ```ts
 * import { requiresBudget } from "@beep/repo-ai-metrics"
 * import * as O from "effect/Option"
 *
 * console.log(requiresBudget({ hypothesis: O.none() })) // false
 * ```
 *
 * @param row - Row whose hypothesis to inspect.
 * @returns `true` when `hypothesis` is `Some`.
 * @category predicates
 * @since 0.0.0
 */
export const requiresBudget = (row: Pick<HarnessLedgerRow, "hypothesis">): boolean => O.isSome(row.hypothesis);

type StaleCheckRow = { readonly fingerprint: Pick<HarnessFingerprint, "fingerprintId"> };

/**
 * Whether a row's evidence expired: it was captured under a different harness
 * fingerprint than the current one.
 *
 * **Details**
 *
 * Evidence expires by fingerprint, not by date. Any change to model id,
 * reasoning effort, or either harness hash makes a row stale.
 *
 * **Example** (Comparing fingerprints)
 *
 * ```ts
 * import { isStale } from "@beep/repo-ai-metrics"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const row = { fingerprint: { fingerprintId: Sha256Hex.make("a".repeat(64)) } }
 * console.log(isStale(row, { fingerprintId: Sha256Hex.make("a".repeat(64)) })) // false
 * console.log(isStale(row, { fingerprintId: Sha256Hex.make("b".repeat(64)) })) // true
 * ```
 *
 * @param row - Row carrying the fingerprint it was captured under.
 * @param current - The current harness fingerprint.
 * @returns `true` when the fingerprint ids differ.
 * @category predicates
 * @since 0.0.0
 */
export const isStale: {
  (current: Pick<HarnessFingerprint, "fingerprintId">): (row: StaleCheckRow) => boolean;
  (row: StaleCheckRow, current: Pick<HarnessFingerprint, "fingerprintId">): boolean;
} = dual(
  2,
  (row: StaleCheckRow, current: Pick<HarnessFingerprint, "fingerprintId">): boolean =>
    row.fingerprint.fingerprintId !== current.fingerprintId
);

/**
 * Whether moving from `previous` to `current` is a warm restart of the edit
 * budget: the model id changed.
 *
 * **Details**
 *
 * Only a model id change resets the budget to `bMax`. Reasoning effort and
 * harness hash changes expire evidence ({@link isStale}) but do not re-widen
 * the budget; otherwise every accepted harness edit would restart annealing.
 *
 * **Example** (Detecting a model release)
 *
 * ```ts
 * import { isWarmRestart } from "@beep/repo-ai-metrics"
 *
 * console.log(isWarmRestart({ modelId: "gpt-6-astra" }, { modelId: "gpt-6-astra" })) // false
 * console.log(isWarmRestart({ modelId: "gpt-6-astra" }, { modelId: "gpt-7" })) // true
 * ```
 *
 * @param previous - Fingerprint the current annealing schedule started under.
 * @param current - The current harness fingerprint.
 * @returns `true` when the model ids differ.
 * @category predicates
 * @since 0.0.0
 */
export const isWarmRestart: {
  (current: Pick<HarnessFingerprint, "modelId">): (previous: Pick<HarnessFingerprint, "modelId">) => boolean;
  (previous: Pick<HarnessFingerprint, "modelId">, current: Pick<HarnessFingerprint, "modelId">): boolean;
} = dual(
  2,
  (previous: Pick<HarnessFingerprint, "modelId">, current: Pick<HarnessFingerprint, "modelId">): boolean =>
    previous.modelId !== current.modelId
);

/**
 * Inputs to {@link annealedEditBudget}.
 *
 * **Example** (Describing a four-to-one schedule)
 *
 * ```ts
 * import { AnnealedEditBudgetInput } from "@beep/repo-ai-metrics"
 *
 * const input = AnnealedEditBudgetInput.make({ round: 0, totalRounds: 3, bMax: 4, bMin: 1 })
 * console.log(input.bMax) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AnnealedEditBudgetInput extends S.Class<AnnealedEditBudgetInput>($I`AnnealedEditBudgetInput`)(
  {
    round: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)),
    totalRounds: S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1)),
    bMax: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    bMin: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("AnnealedEditBudgetInput", {
    description: "Round, schedule length, and the maximum and minimum edit budgets of a cosine schedule.",
  })
) {}

/**
 * Cosine-annealed edit budget for one round (RRSI Eq. 4).
 *
 * **Details**
 *
 * Computes `ceil(bMin + (bMax - bMin) * ½ * (1 + cos(π * round / totalRounds)))`.
 * Round `0` yields `bMax`, round `totalRounds` yields `bMin`, and the budget is
 * non-increasing in between. A round past `totalRounds` is clamped to
 * `totalRounds`; a warm restart ({@link isWarmRestart}) resets `round` to `0`.
 * Interior results within four relative machine epsilons of an integer are
 * snapped to that integer before taking the ceiling. Endpoint and constant
 * budgets retain their exact ceiling, including non-integral bounds.
 *
 * **Example** (Annealing four edits down to one)
 *
 * ```ts
 * import { annealedEditBudget } from "@beep/repo-ai-metrics"
 *
 * console.log(annealedEditBudget({ round: 0, totalRounds: 3, bMax: 4, bMin: 1 })) // 4
 * console.log(annealedEditBudget({ round: 3, totalRounds: 3, bMax: 4, bMin: 1 })) // 1
 * ```
 *
 * @param input - Round, schedule length, and budget bounds.
 * @returns The integer edit budget for the round.
 * @category utilities
 * @since 0.0.0
 */
export const annealedEditBudget = ({ round, totalRounds, bMax, bMin }: AnnealedEditBudgetInput): number => {
  if (round === 0 || bMax === bMin) return Math.ceil(bMax);
  if (round >= totalRounds) return Math.ceil(bMin);
  const raw = bMin + (bMax - bMin) * 0.5 * (1 + Math.cos(Math.PI * (round / totalRounds)));
  const nearest = Num.round(raw, 0);
  // Only interior results within four relative machine epsilons of an integer
  // are treated as floating-point noise. Never scale raw by a decimal factor.
  const tolerance = Number.EPSILON * Math.abs(raw) * 4;
  const nearInteger =
    Math.abs(raw - nearest) <= tolerance && nearest >= Num.min(bMin, bMax) && nearest <= Num.max(bMin, bMax);
  return Math.ceil(nearInteger ? nearest : raw);
};
