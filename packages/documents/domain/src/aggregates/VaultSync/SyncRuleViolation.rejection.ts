/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $DocumentsDomainId.create("aggregates/VaultSync/SyncRuleViolation.rejection");
/**
 * Closed vocabulary of the rules a vault sync aggregate can refuse a command under.
 *
 * **Example** (Check a rule name)
 * ```ts
 * import { SyncRule } from "@beep/documents-domain/aggregates/VaultSync";
 * import * as S from "effect/Schema";
 * console.log(S.is(SyncRule)("stale-lease"));
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export const SyncRule = LiteralKit([
  "already-registered",
  "conflict-id",
  "conflict-not-found",
  "conflict-scope",
  "correction-key",
  "correction-scope",
  "destination-scope",
  "item-remote-id",
  "item-scope",
  "lease-duration",
  "name-held",
  "not-queued",
  "not-registered",
  "not-retargetable",
  "not-tracked",
  "operation-key",
  "operation-slot-held",
  "parent-remote-id",
  "path-held",
  "poll-result",
  "stale-generation",
  "stale-lease",
  "stale-name",
  "wrong-key",
]).pipe($I.annoteSchema("SyncRule", { description: "A named vault sync rule that refused a command." }));
/**
 * Runtime value accepted by {@link SyncRule}.
 *
 * @category aggregates
 * @since 0.0.0
 */
export type SyncRule = typeof SyncRule.Type;
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
  { rule: SyncRule, evidence: S.String },
  $I.annote("SyncRuleViolation", { description: "A vault sync rule refused a command." })
) {}
