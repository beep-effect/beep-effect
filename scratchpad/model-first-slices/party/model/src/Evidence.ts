import * as S from "effect/Schema";

/**
 * One piece of evidence for a claim: what a source said. Two signals from
 * the same `source` are one source for an admission gate.
 *
 * **Example** (A signal from a mailbox)
 * ```ts
 * import { EvidenceSignal } from "@proto/party/Evidence";
 *
 * const signal = EvidenceSignal.make({ source: "mailbox:intake", excerpt: "Dana Smith, also d.smith@acme" });
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EvidenceSignal = S.Struct({ source: S.String, excerpt: S.String });
/**
 * @category models
 * @since 0.0.0
 */
export type EvidenceSignal = typeof EvidenceSignal.Type;
