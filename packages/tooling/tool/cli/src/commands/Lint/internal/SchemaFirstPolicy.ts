/**
 * Schema-crispening policy helpers for schema-first lint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { pipe } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import type {
  SchemaCrispeningFamily,
  SchemaCrispeningPolicyDocument,
  SchemaFirstInventoryEntry,
} from "../Lint.schemas.ts";

const DEFAULT_MISSING_ENTRY_REMEDIATION =
  "Run bun run beep lint schema-first --write after reviewing the finding, or migrate the symbol to an annotated schema.";

const MISSING_ENTRY_REMEDIATIONS: Readonly<Record<string, string>> = {
  "SFV4-static-api":
    "Prefer schema-derived .match/.guards/.cases or LiteralKit helpers, or run bun run beep lint schema-first --write with a justification when behavior intentionally differs.",
  "SFV4-numeric-domain":
    "Review the numeric domain and replace broad S.Number/S.NumberFromString with S.Finite, S.Int, or checks; then run bun run beep lint schema-first --write if the broad domain is intentional.",
  "SFV4-boundary-codec":
    "Replace direct JSON.parse with S.fromJsonString(schema) plus an Effect/Result/Option decoder, or inventory the exception when the protocol is intentionally non-standard.",
  "SFV4-defaults":
    "Move option/request fallback values into schema fields with S.withConstructorDefault, S.withDecodingDefault*, or SchemaUtils.withKeyDefaults; inventory the exception only when the fallback intentionally differs from schema construction semantics.",
  "SFV4-equivalence":
    "Derive comparison from S.toEquivalence(schema) or SchemaUtils.toEquivalence(schema); use S.overrideToEquivalence only when schema semantics intentionally differ.",
  "SFV4-precision-audit":
    "Replace broad email S.String fields with @beep/schema Email or a local precise email schema; inventory only external protocol fields that intentionally allow non-email strings.",
  "SFV4-arbitrary-tests":
    "Add a focused property test using S.toArbitrary(sourceSchema)(fc) and fast-check, or keep the inventory entry when the file is intentionally golden/snapshot/regression-only coverage.",
  "SFV4-fn-schema":
    "Model inline object parameter/return contracts with Fn({ input, output }) from @beep/schema or an S.Class, or run bun run beep lint schema-first --write with a justification when the shape intentionally stays inline.",
  "SFV4-normalization":
    "Move the trim/case normalization into a schema transformation (S.decodeTo + SchemaTransformation, or SchemaGetter) so the invariant travels with the data; inventory the exception only when the call is intentionally imperative.",
  "SFV4-null-return":
    "Return O.Option, Result, Effect, or Exit instead of a null/undefined-typed return; run bun run beep lint schema-first --write when the boundary (3rd-party/react) intentionally returns null/undefined.",
  "SFV4-getsomes-struct":
    "Replace R.getSomes over an inline Option-struct literal with O.getSomesStruct (@beep/utils) to preserve literal keys and per-key value types; inventory the exception only for intentionally homogeneous dynamic-key dictionaries.",
};

/**
 * Resolve the remediation message for an untracked inventory entry, keyed by
 * its rule id with a generic fallback when the rule has no specific guidance.
 *
 * @param entry - The untracked schema-first inventory entry whose rule id selects the guidance.
 * @returns The rule-specific remediation message, or the default guidance when the rule has none.
 * @category utilities
 * @since 0.0.0
 */
export const missingEntryRemediation = (entry: SchemaFirstInventoryEntry): string =>
  pipe(
    O.fromNullishOr(entry.ruleId),
    O.flatMap((ruleId) => R.get(MISSING_ENTRY_REMEDIATIONS, ruleId)),
    O.getOrElse(() => DEFAULT_MISSING_ENTRY_REMEDIATION)
  );

const SCHEMA_CRISPENING_FAMILY_PREFIXES: ReadonlyArray<readonly [string, SchemaCrispeningFamily]> = [
  ["packages/foundation/", "foundation"],
  ["packages/drivers/", "drivers"],
  ["packages/tooling/", "tooling"],
  ["apps/", "apps-slices"],
  ["packages/agents/", "apps-slices"],
  ["packages/architecture-lab/", "apps-slices"],
  ["packages/epistemic/", "apps-slices"],
  ["packages/law-practice/", "apps-slices"],
  ["packages/workspace/", "apps-slices"],
] as const;

/**
 * Resolve the schema-crispening wave family for a repo-relative source file
 * path by prefix. `packages/shared/**` and `infra/**` are unassigned until
 * their P1 wave assignment lands and resolve to `O.none` (non-blocking).
 *
 * **Example** (Resolve crispening family)
 *
 * ```ts
 * import { schemaCrispeningFamilyForFile } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(schemaCrispeningFamilyForFile("packages/drivers/postgres/src/Postgres.ts"))
 * ```
 *
 * @param file - Repo-relative posix path, e.g. `packages/foundation/modeling/schema/src/Foo.ts`.
 * @returns The resolved wave family, or `O.none` when the path is unassigned.
 * @category utilities
 * @since 0.0.0
 */
export const schemaCrispeningFamilyForFile = (file: string): O.Option<SchemaCrispeningFamily> =>
  pipe(
    A.findFirst(SCHEMA_CRISPENING_FAMILY_PREFIXES, ([prefix]) => Str.startsWith(prefix)(file)),
    O.map(([, family]) => family)
  );

const resolveSchemaCrispeningPolicyBlocking = (
  policy: SchemaCrispeningPolicyDocument,
  entry: SchemaFirstInventoryEntry
): boolean =>
  pipe(
    R.get(policy.ownerOverrides, entry.owner),
    O.map((override) => override.blocking),
    O.orElse(() =>
      pipe(
        schemaCrispeningFamilyForFile(entry.file),
        O.flatMap((family) => R.get(policy.families, family)),
        O.map((familyPolicy) => familyPolicy.blocking)
      )
    ),
    O.getOrElse(() => false)
  );

/**
 * Test whether a schema-first inventory entry is exempt from failing the
 * repo-wide lint under the schema-crispening policy ratchet (G4). An absent
 * policy document exempts nothing (fail-safe); an entry is only ever exempt
 * when its `ruleId` is a policy-tracked card AND the resolved blocking flag
 * (owner override, else family, else non-blocking when unassigned) is `false`.
 *
 * **Example** (Build exemption predicate)
 *
 * ```ts
 * import { isSchemaCrispeningPolicyExempt } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * const exemptWithoutPolicy = isSchemaCrispeningPolicyExempt(O.none())
 * console.log(exemptWithoutPolicy) // example value
 * ```
 *
 * @param policyDocument - The decoded `standards/schema-crispening.policy.jsonc` document, if present.
 * @returns A predicate over inventory entries.
 * @category utilities
 * @since 0.0.0
 */
export const isSchemaCrispeningPolicyExempt =
  (policyDocument: O.Option<SchemaCrispeningPolicyDocument>) =>
  (entry: SchemaFirstInventoryEntry): boolean =>
    pipe(
      policyDocument,
      O.flatMap((policy) =>
        pipe(
          O.fromNullishOr(entry.ruleId),
          O.filter((ruleId) => A.contains(policy.cards, ruleId)),
          O.map(() => !resolveSchemaCrispeningPolicyBlocking(policy, entry))
        )
      ),
      O.getOrElse(() => false)
    );
