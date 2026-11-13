/**
 * Content-derived detection proposal identity.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { dual } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { canonicalJson } from "../internal/CanonicalJson.ts";
import type { ContradictionVocabulary } from "../Contradiction/index.ts";
import type { FieldSchema } from "../Factory/index.ts";

/**
 * Encode JSON values with the same canonicalizer used by the contradiction seals.
 *
 * **Details**
 *
 * The output is RFC 8785 canonical JSON from `JsoncFingerprint` in
 * `@beep/jsonc`, the one owner of the bytes every seal here hashes.
 *
 * **Gotchas**
 *
 * A value outside plain JSON throws the owner's `JsoncCanonicalizeError`
 * instead of being coerced: an object member whose value is `undefined`, a
 * non-finite number, a bigint, a non-plain object, a string or key with an
 * unpaired surrogate, and nesting past the owner's depth cap.
 *
 * **Example** (Encode keys in canonical order)
 *
 * ```ts
 * import { canonicalDetectionJson } from "@beep/epistemics/ContradictionDetection"
 *
 * console.log(canonicalDetectionJson({ b: 1, a: 2 })) // {"a":2,"b":1}
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const canonicalDetectionJson = canonicalJson;

/**
 * Build `detectionProposalId` over a caller-bound belief reference class.
 *
 * **Details**
 *
 * `detectionProposalId` (dual) hashes the encoded losing belief reference and
 * the complete replacement fact as canonical JSON, so one losing belief and fact
 * always yield one proposal id. It fails with the reference encoder's
 * `SchemaError`.
 *
 * **Example** (Hash a proposal over a local belief reference)
 *
 * ```ts
 * import { makeContradictionVocabulary } from "@beep/epistemics/Contradiction"
 * import { makeDetectionProposalId } from "@beep/epistemics/ContradictionDetection"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const { detectionProposalId } = makeDetectionProposalId({
 *   contradiction: makeContradictionVocabulary({ $I: $ScratchpadId.create("party/Contradiction") }),
 *   BeliefVersionRef: S.Struct({ edgeVersionId: S.String }),
 *   ContradictionProposalContent: { fields: { fact: S.JsonObject } }
 * })
 * const id = detectionProposalId({ edgeVersionId: "e-1" }, { value: 1 })
 * console.log(Result.isSuccess(id)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeDetectionProposalId = <Ref, RefEncoded, RefMake, Fact>(config: {
  readonly contradiction: Pick<ContradictionVocabulary, "ContradictionProposalId">;
  readonly BeliefVersionRef: FieldSchema<Ref, RefEncoded, RefMake>;
  readonly ContradictionProposalContent: { readonly fields: { readonly fact: S.Top & { readonly Type: Fact } } };
}) => {
  const { contradiction, BeliefVersionRef } = config;
  type ProposalId = typeof contradiction.ContradictionProposalId.Type;
  const encodeRef = S.encodeResult(BeliefVersionRef);

  const detectionProposalId: {
    (losingBelief: Ref, fact: Fact): Result.Result<ProposalId, S.SchemaError>;
    (fact: Fact): (losingBelief: Ref) => Result.Result<ProposalId, S.SchemaError>;
  } = dual(2, (losingBelief: Ref, fact: Fact) =>
    Result.map(encodeRef(losingBelief), (ref) =>
      contradiction.ContradictionProposalId.make(
        bytesToHex(sha256(utf8ToBytes(canonicalJson({ losingBelief: ref, fact }))))
      )
    )
  );

  return { detectionProposalId };
};
