/**
 * Schema-backed documentation lint policy.
 *
 * @packageDocumentation
 * @since 0.1.0
 */
import { $LintRulesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LintRulesId.create("rules/docs");

/**
 * Documentation rule identifiers owned by this package.
 *
 * **Example** (Recognize a documentation rule)
 * ```ts
 * import { DocsRuleId } from "@beep/lint-rules/oxlint-docs"
 * import * as S from "effect/Schema"
 * console.log(S.is(DocsRuleId)("require-jsdoc"))
 * ```
 * @category configuration
 * @since 0.1.0
 */
export const DocsRuleId = LiteralKit([
  "require-jsdoc",
  "informative-docs",
  "no-blank-block-descriptions",
  "check-tag-names",
  "check-param-names",
  "require-category-tag",
  "tsdoc-syntax",
  "require-description",
  "require-param",
  "require-param-description",
  "require-returns",
  "require-returns-description",
  "match-description",
  "require-file-overview",
]).pipe($I.annoteSchema("DocsRuleId", { description: "Repo-owned documentation rule identifiers." }));

/**
 * **Example** (Choose a rule)
 * ```ts
 * import type { DocsRuleId } from "@beep/lint-rules/oxlint-docs"
 * const rule: DocsRuleId = "require-jsdoc"
 * console.log(rule)
 * ```
 * @category models
 * @since 0.1.0
 */
export type DocsRuleId = typeof DocsRuleId.Type;

const DocsSeverity = LiteralKit(["off", "warn", "error"]).pipe(
  $I.annoteSchema("DocsSeverity", { description: "Oxlint documentation rule severity." })
);

/**
 * Complete rule-set configuration for the documentation plugin.
 *
 * **Example** (Inspect rule-set fields)
 * ```ts
 * import { DocsRuleSet } from "@beep/lint-rules/oxlint-docs"
 * console.log(DocsRuleSet.fields.rules)
 * ```
 * @category configuration
 * @since 0.1.0
 */
export class DocsRuleSet extends S.Opaque<DocsRuleSet, { readonly brand: unique symbol }>()(
  S.Struct({
    rules: S.Record(DocsRuleId, DocsSeverity),
  }).pipe($I.annoteSchema("DocsRuleSet", { description: "Validated severities for every documentation rule." }))
) {}
