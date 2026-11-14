/**
 * Schema-first delete-package policy and manifest contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { RepoRelativePath } from "../Codex/Security.schemas.ts";

const $I = $RepoCliId.create("commands/DeletePackage/schemas");

const AcknowledgedText = S.NonEmptyString.check(S.isTrimmed()).pipe(
  $I.annoteSchema("AcknowledgedText", {
    description: "Non-empty text with no leading or trailing whitespace.",
  })
);

/**
 * One reviewed dependent hit that a deletion accepts: the file, the exact
 * trimmed line text, why it is not a real dependent, and how often it occurs.
 *
 * **Details**
 *
 * An entry matches by path and text, never by line number, so edits above the
 * line do not break it. For a root `script` hit, `text` is the script's
 * command. `occurrences` defaults to 1 and must equal the number of hits the
 * entry matches.
 *
 * **Example** (Acknowledge a tooling-kind literal)
 *
 * ```ts
 * import { DeletePackageAcknowledgement } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const entry = DeletePackageAcknowledgement.make({
 *   path: "packages/tooling/deploy/hosts/package.json",
 *   text: '"kind": "deploy",',
 *   reason: "The tooling kind value, not the deleted package.",
 * })
 * console.log(entry.occurrences) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeletePackageAcknowledgement extends S.Opaque<
  DeletePackageAcknowledgement,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    path: RepoRelativePath,
    text: AcknowledgedText,
    reason: AcknowledgedText,
    occurrences: S.Int.check(S.isGreaterThan(0)).pipe(
      S.withConstructorDefault(Effect.succeed(1)),
      S.withDecodingDefaultKey(Effect.succeed(1))
    ),
  }).pipe(
    $I.annoteSchema("DeletePackageAcknowledgement", {
      description: "One reviewed file-path or script hit a deletion accepts, matched by path and trimmed line text.",
    })
  )
) {}

/**
 * The committed acknowledgement file passed to `delete-package --acknowledge`.
 *
 * **Details**
 *
 * `target` must equal the resolved deletion target. Only `file-path` and
 * `script` hits can be acknowledged; an entry that matches a manifest or
 * import edge, matches no current hit, or matches a different number of hits
 * than it declares refuses the deletion.
 *
 * **Example** (Decode an acknowledgement file)
 *
 * ```ts
 * import { DeletePackageAcknowledgements } from "@beep/repo-cli/commands/DeletePackage"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownEffect(DeletePackageAcknowledgements)({
 *   schemaVersion: "delete-package-acknowledgements/v1",
 *   target: "@beep/deploy",
 *   entries: [{ path: "packages/consumer/notes.md", text: "Deploys `deploy/` builds.", reason: "Prose about a verb." }],
 * })
 * console.log(Effect.isEffect(decoded)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeletePackageAcknowledgements extends S.Opaque<
  DeletePackageAcknowledgements,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("delete-package-acknowledgements/v1"),
    target: S.NonEmptyString,
    entries: S.Array(DeletePackageAcknowledgement),
  }).pipe(
    $I.annoteSchema("DeletePackageAcknowledgements", {
      description: "Committed list of reviewed dependent hits one package deletion accepts.",
    })
  )
) {}

/**
 * Decoded delete-package flags and preflight facts.
 *
 * **Details**
 *
 * `acknowledgements` holds the decoded `--acknowledge` file and defaults to
 * `Option.none()` at construction.
 *
 * **Example** (Assemble a preflight policy)
 *
 * ```ts
 * import { DeletePackagePolicy } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const policy = DeletePackagePolicy.make({
 *   allowPublished: false,
 *   allowStalePackets: false,
 *   cascade: false,
 *   pruneCatalog: false,
 *   rewritePackets: false,
 *   skipBaselines: false,
 *   inCi: false,
 *   retiredNameCollision: false,
 *   livePromotionRecord: false,
 *   cascadeClosureAllowed: false,
 *   catalogUniquenessProven: false,
 *   dropData: false,
 *   allowNonLocalData: false,
 *   dataResourceDeclared: false,
 *   dataConnectionNonLocal: false,
 *   dataOwnershipProven: false,
 * })
 * console.log(policy.cascade) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeletePackagePolicy extends S.Opaque<DeletePackagePolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    allowPublished: S.Boolean,
    allowStalePackets: S.Boolean,
    cascade: S.Boolean,
    pruneCatalog: S.Boolean,
    rewritePackets: S.Boolean,
    skipBaselines: S.Boolean,
    inCi: S.Boolean,
    retiredNameCollision: S.Boolean,
    livePromotionRecord: S.Boolean,
    cascadeClosureAllowed: S.Boolean,
    catalogUniquenessProven: S.Boolean,
    dropData: S.Boolean,
    allowNonLocalData: S.Boolean,
    dataResourceDeclared: S.Boolean,
    dataConnectionNonLocal: S.Boolean,
    dataOwnershipProven: S.Boolean,
    acknowledgements: S.OptionFromOptionalKey(DeletePackageAcknowledgements).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
  }).pipe(
    $I.annoteSchema("DeletePackagePolicy", {
      description: "Decoded delete-package flags and preflight facts consumed by refusal policy.",
    })
  )
) {}

/**
 * Closed schema for delete-package refusal reasons.
 *
 * **Example** (Guard a refusal kind)
 *
 * ```ts
 * import { DeletePackageRefusalKind } from "@beep/repo-cli/commands/DeletePackage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DeletePackageRefusalKind)("dependent")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DeletePackageRefusalKind = LiteralKit([
  "dependent",
  "published",
  "promotion-record",
  "protected-slug",
  "retired-name-collision",
  "cascade-boundary",
  "ci-skip-baselines",
  "catalog-uniqueness",
  "packet-claim",
  "data-non-local",
  "data-ownership",
  "acknowledgement",
]).pipe(
  $I.annoteSchema("DeletePackageRefusalKind", {
    description: "Closed hard and soft refusal reasons emitted before deletion.",
  })
);
/**
 * Type represented by {@link DeletePackageRefusalKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeletePackageRefusalKind = typeof DeletePackageRefusalKind.Type;

class HardDeletePackageRefusal extends S.Opaque<HardDeletePackageRefusal, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("hard"),
    kind: DeletePackageRefusalKind,
    detail: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("HardDeletePackageRefusal", {
      description: "A deletion refusal that no force flag can bypass.",
    })
  )
) {}

class SoftDeletePackageRefusal extends S.Opaque<SoftDeletePackageRefusal, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.tag("soft"),
    kind: DeletePackageRefusalKind,
    detail: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("SoftDeletePackageRefusal", {
      description: "A deletion refusal cleared only by its dedicated explicit policy flag.",
    })
  )
) {}

/**
 * Tagged union schema for hard and soft deletion refusals.
 *
 * **Example** (Construct a hard refusal)
 *
 * ```ts
 * import { DeletePackageRefusal } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const refusal = DeletePackageRefusal.cases.hard.make({
 *   kind: "dependent",
 *   detail: "2 unacknowledged production/test/script/path dependent hit(s).",
 * })
 * console.log(refusal.severity) // "hard"
 * ```
 *
 * @returns Tagged union schema keyed by `severity`.
 * @category schemas
 * @since 0.0.0
 */
export const DeletePackageRefusal = LiteralKit(["hard", "soft"])
  .mapMembers(Tuple.evolve([() => HardDeletePackageRefusal, () => SoftDeletePackageRefusal]))
  .pipe(
    S.toTaggedUnion("severity"),
    $I.annoteSchema("DeletePackageRefusal", {
      description: "One classified delete-package preflight refusal.",
    })
  );
/**
 * Type represented by {@link DeletePackageRefusal}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeletePackageRefusal = typeof DeletePackageRefusal.Type;

/**
 * Minimal package manifest decoded during deletion preflight.
 *
 * **Example** (Resolve a target manifest)
 *
 * ```ts
 * import { DeletePackageManifest } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const manifest = DeletePackageManifest.make({ name: "@beep/example" })
 * console.log(manifest.name) // "@beep/example"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DeletePackageManifest extends S.Opaque<DeletePackageManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString,
    private: S.Boolean.pipe(S.optionalKey),
    version: S.String.pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("DeletePackageManifest", {
      description: "Minimal package manifest fields required by deletion preflight.",
    })
  )
) {}

/**
 * Closed exit policy for one delete-package baseline writer step.
 *
 * **Details**
 *
 * `zero-only` fails on any nonzero exit. `tolerate-finding-exit` additionally
 * tolerates exit code 1 when the step's verified output file was provably
 * (re)written — the fallow health baseline writer exits 1 on pre-existing
 * findings even though the baseline write succeeded.
 *
 * **Example** (Guard an exit policy)
 *
 * ```ts
 * import { BaselineWriterExitPolicy } from "@beep/repo-cli/commands/DeletePackage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BaselineWriterExitPolicy)("tolerate-finding-exit")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaselineWriterExitPolicy = LiteralKit(["zero-only", "tolerate-finding-exit"]).pipe(
  $I.annoteSchema("BaselineWriterExitPolicy", {
    description: "Closed exit policy for one delete-package baseline writer step.",
  })
);
/**
 * Type represented by {@link BaselineWriterExitPolicy}.
 *
 * @category models
 * @since 0.0.0
 */
export type BaselineWriterExitPolicy = typeof BaselineWriterExitPolicy.Type;

/**
 * Closed outcome of one baseline writer invocation.
 *
 * **Example** (Guard an outcome)
 *
 * ```ts
 * import { BaselineStepOutcome } from "@beep/repo-cli/commands/DeletePackage"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BaselineStepOutcome)("tolerated")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BaselineStepOutcome = LiteralKit(["ok", "tolerated", "failed"]).pipe(
  $I.annoteSchema("BaselineStepOutcome", {
    description: "Closed outcome of one baseline writer invocation: ok, tolerated, or failed.",
  })
);
/**
 * Type represented by {@link BaselineStepOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type BaselineStepOutcome = typeof BaselineStepOutcome.Type;

/**
 * `(mtime, size)` stamp of a baseline output file proving a write happened.
 *
 * **Details**
 *
 * Comparing stamps instead of mtime alone keeps the write proof honest on
 * filesystems with coarse timestamps: an equal-mtime rewrite still counts as
 * written when the size changed.
 *
 * **Example** (Stamp a baseline output)
 *
 * ```ts
 * import { BaselineOutputStamp } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const stamp = BaselineOutputStamp.make({ mtimeMillis: 1_723_000_000_000, size: 2048 })
 * console.log(stamp.size) // 2048
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BaselineOutputStamp extends S.Opaque<BaselineOutputStamp, { readonly brand: unique symbol }>()(
  S.Struct({
    mtimeMillis: S.Finite,
    size: S.Finite,
  }).pipe(
    $I.annoteSchema("BaselineOutputStamp", {
      description: "(mtime, size) stamp of a baseline output file proving a write happened.",
    })
  )
) {}

/**
 * One delete-package baseline writer step with its exit policy and optional
 * verified output file.
 *
 * **Details**
 *
 * `exitPolicy` defaults to `zero-only` and `verifiedOutput` to `Option.none()`
 * at construction, so only the deliberately tolerant step declares them —
 * guarding against tolerance creep in the writer table.
 *
 * **Example** (Declare a zero-only writer step)
 *
 * ```ts
 * import { BaselineWriterStep } from "@beep/repo-cli/commands/DeletePackage"
 *
 * const step = BaselineWriterStep.make({ label: "JSDoc baseline", args: ["run", "beep", "quality", "jsdoc-ratchet"] })
 * console.log(step.exitPolicy) // "zero-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BaselineWriterStep extends S.Opaque<BaselineWriterStep, { readonly brand: unique symbol }>()(
  S.Struct({
    label: S.NonEmptyString,
    args: S.Array(S.NonEmptyString),
    exitPolicy: BaselineWriterExitPolicy.pipe(
      S.withConstructorDefault(Effect.succeed<BaselineWriterExitPolicy>("zero-only"))
    ),
    verifiedOutput: S.OptionFromOptionalKey(PosixPath).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("BaselineWriterStep", {
      description: "One delete-package baseline writer step with exit policy and optional verified output file.",
    })
  )
) {}
