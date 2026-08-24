/**
 * Unsigned, in-toto Statement-aligned evidence receipt schemas.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SkillContractId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as S from "effect/Schema";
import { EvidencePredicateType } from "./Gate.ts";

const $I = $SkillContractId.create("EvidenceReceipt");

/**
 * Digest map used by an evidence subject in the first kernel slice.
 *
 * **Example** (Bind a SHA-256 digest)
 *
 * ```ts
 * import { EvidenceDigest } from "@beep/skill-contract"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const digest = EvidenceDigest.make({
 *   sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * })
 * console.log(digest.sha256.length) // 64
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceDigest extends S.Class<EvidenceDigest>($I`EvidenceDigest`)(
  {
    sha256: Sha256Hex.annotateKey({
      description: "Canonical lowercase SHA-256 digest of the named subject.",
    }),
  },
  $I.annote("EvidenceDigest", {
    description: "Digest map binding an evidence subject to its SHA-256 content identity.",
  })
) {}

/**
 * Named, digest-bound subject of an evidence receipt.
 *
 * **Example** (Describe a receipt subject)
 *
 * ```ts
 * import { EvidenceDigest, EvidenceSubject } from "@beep/skill-contract"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const subject = EvidenceSubject.make({
 *   digest: EvidenceDigest.make({
 *     sha256: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 *   }),
 *   name: "frames/drag.png"
 * })
 * console.log(subject.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceSubject extends S.Class<EvidenceSubject>($I`EvidenceSubject`)(
  {
    digest: EvidenceDigest,
    name: S.NonEmptyString.annotateKey({
      description: "Stable subject name interpreted by the receipt producer and consumer.",
    }),
  },
  $I.annote("EvidenceSubject", {
    description: "Named evidence subject bound to a canonical content digest.",
  })
) {}

/**
 * Builds an unsigned evidence receipt with a typed predicate.
 *
 * **Details**
 *
 * The shape follows the in-toto Statement split: digest-bound `subject`,
 * versioned `predicateType`, and a schema-owned `predicate`. Signing and DSSE
 * envelopes are outside this package.
 *
 * **Example** (Decode a typed receipt)
 *
 * ```ts
 * import { EvidenceReceipt } from "@beep/skill-contract"
 * import * as S from "effect/Schema"
 *
 * const ArtifactCheckReceipt = EvidenceReceipt(S.Struct({ checkedPaths: S.Array(S.String) }))
 * console.log(S.is(ArtifactCheckReceipt))
 * ```
 *
 * @param predicate - Schema for the receipt's versioned evidence payload.
 * @returns Unsigned, digest-bound evidence receipt schema.
 * @category factories
 * @since 0.0.0
 */
export const EvidenceReceipt = <Predicate extends S.Top>(predicate: Predicate) =>
  S.Struct({
    predicate,
    predicateType: EvidencePredicateType,
    subject: S.NonEmptyArray(EvidenceSubject),
  }).pipe(
    $I.annoteSchema("EvidenceReceipt", {
      description: "Unsigned in-toto Statement-aligned receipt with a digest-bound subject and typed predicate.",
    })
  );
