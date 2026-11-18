import * as S from "effect/Schema";
import { FactId } from "./Ids.ts";
import { Name, Sequence } from "./Measure.ts";

/**
 * An integration fact as it crosses between contexts (D11): which producer
 * and contract published it, the contract version, its stable id, the
 * producer's position for it, and its payload as encoded JSON. A consumer
 * decodes only the version it subscribes to, with that version's published
 * schema, so a producer adding a version never breaks it.
 *
 * **Example** (A fact as a consumer reads it)
 * ```ts
 * import { FactEnvelope } from "@proto/kernel/Fact";
 *
 * const envelope = FactEnvelope.make({
 *   producer: "party",
 *   contract: "ClaimDecided",
 *   version: 1,
 *   factId: "claim_1:decided",
 *   seq: 1,
 *   payload: { claim: "claim_1" },
 * });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FactEnvelope = S.Struct({
  producer: Name,
  contract: Name,
  version: Sequence,
  factId: FactId,
  seq: Sequence,
  payload: S.Unknown,
});
/**
 * @category models
 * @since 0.0.0
 */
export type FactEnvelope = typeof FactEnvelope.Type;

/**
 * The key a consumer's inbox records a fact under: producer, fact id and
 * contract version. The same fact in two versions is two keys.
 *
 * @category getters
 * @since 0.0.0
 */
export const inboxKey = (fact: { readonly producer: string; readonly factId: FactId; readonly version: number }) =>
  `${fact.producer}:${fact.factId}:v${fact.version}`;
