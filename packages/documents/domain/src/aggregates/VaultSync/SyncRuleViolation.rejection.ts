/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DocumentsDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/SyncRuleViolation.rejection");
/**
 * A command violates a named vault sync rule; evidence contains no credentials.
 *
 * **Example** (Inspect contract)
 * ```ts
 * import { SyncRuleViolation } from "@beep/documents-domain/aggregates/VaultSync";
 * void SyncRuleViolation;
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SyncRuleViolation extends S.TaggedError<SyncRuleViolation, { readonly brand: unique symbol }>()(
  "SyncRuleViolation",
  { rule: S.String, evidence: S.String },
  $I.annote("SyncRuleViolation", { description: "A vault sync rule refused a command." })
) {}
