import * as S from "effect/Schema";
/**
 * A command violates a named vault sync rule; evidence contains no credentials.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { SyncRuleViolation } from "@beep/documents-domain/aggregates/VaultSync";
 * void SyncRuleViolation;
 * ```
 * @category vault-sync
 * @since 0.0.0
 */
export class SyncRuleViolation extends S.TaggedError<SyncRuleViolation, { readonly brand: unique symbol }>()(
  "SyncRuleViolation",
  { rule: S.String, evidence: S.String }
) {}
