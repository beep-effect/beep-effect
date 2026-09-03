/**
 * Rule value schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SharedDomainId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SharedDomainId.create("values/Rule/Rule.model");
const EffectBase = LiteralKit(["allow", "deny", "ask"]);
const ruleTokenPattern = /^[a-z][a-z0-9:_-]*$/u;
const ruleResourcePattern = /^[a-z][a-z0-9:_-]*(?:\.[a-z][a-z0-9:_-]*)*$/u;

const RuleAction = S.NonEmptyString.check(
  S.isPattern(ruleTokenPattern, {
    identifier: $I`RuleActionPattern`,
    title: "Rule action token pattern",
    description: "Lowercase rule action token.",
    message: "Expected a lowercase rule action token",
  })
).pipe(
  $I.annoteSchema("RuleAction", {
    description: "Lowercase action token used by shared rule values.",
  })
);

const RuleResource = S.NonEmptyString.check(
  S.isPattern(ruleResourcePattern, {
    identifier: $I`RuleResourcePattern`,
    title: "Rule resource token pattern",
    description: "Lowercase dot-separated resource token.",
    message: "Expected a lowercase rule resource token",
  })
).pipe(
  $I.annoteSchema("RuleResource", {
    description: "Lowercase resource token used by shared rule values.",
  })
);

/**
 * Rule-effect literal schema used as the discriminator for rule decisions.
 *
 * **Example** (Decode allow effect)
 *
 * ```ts
 * import { Effect as RuleEffect } from "@beep/shared-domain/values/Rule/Rule.model"
 * import * as S from "effect/Schema"
 *
 * const effect = S.decodeUnknownSync(RuleEffect)("allow")
 *
 * console.log(RuleEffect.is.allow(effect)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Effect = EffectBase.pipe(
  $I.annoteSchema("Effect", {
    description: "Effect of a rule: allow, deny, ask.",
  }),
  SchemaUtils.withLiteralKitStatics(EffectBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Companion namespace for {@link Effect}.
 *
 * **Example** (Check encoded allow value)
 *
 * ```ts
 * import { Effect as RuleEffect } from "@beep/shared-domain/values/Rule/Rule.model"
 *
 * const encoded: RuleEffect.Encoded = "allow"
 *
 * console.log(RuleEffect.is.allow(encoded)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Effect {
  /**
   * Companion Encoded type for {@link Effect}.
   *
   * **Example** (Assign encoded effect)
   *
   * ```ts
   * import type { Effect } from "@beep/shared-domain/values/Rule/Rule.model"
   *
   * const encoded: Effect.Encoded = "ask"
   *
   * console.log(encoded)
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Effect.Encoded;
}

/**
 * Shared action and resource fields for rule decision variants.
 *
 * **Example** (Decode base rule fields)
 *
 * ```ts
 * import { Base } from "@beep/shared-domain/values/Rule/Rule.model"
 * import * as S from "effect/Schema"
 *
 * const base = S.decodeUnknownSync(Base)({
 *   action: "read",
 *   resource: "matter"
 * })
 *
 * console.log(base.resource) // "matter"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Base extends S.Class<Base>($I`Base`)(
  {
    action: RuleAction.annotateKey({ description: "Action token the rule evaluates." }),
    resource: RuleResource.annotateKey({ description: "Resource token the rule evaluates." }),
  },
  $I.annote("Base", {
    description: "Shared action and resource fields for rule decision variants.",
  })
) {}

/**
 * Rule variant that grants the requested action.
 *
 * **Example** (Decode allow rule)
 *
 * ```ts
 * import { Allow } from "@beep/shared-domain/values/Rule/Rule.model"
 * import * as S from "effect/Schema"
 *
 * const rule = S.decodeUnknownSync(Allow)({
 *   action: "read",
 *   effect: "allow",
 *   resource: "matter"
 * })
 *
 * console.log(rule.effect) // "allow"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Allow extends Base.extend<Allow>($I`Allow`)(
  {
    effect: S.tag(Effect.Enum.allow).annotateKey({ description: "Rule discriminator for an allow decision." }),
  },
  $I.annote("Allow", {
    description: " with discriminated `allow` effect field",
  })
) {}

/**
 * Rule variant that rejects the requested action.
 *
 * **Example** (Decode deny rule)
 *
 * ```ts
 * import { Deny } from "@beep/shared-domain/values/Rule/Rule.model"
 * import * as S from "effect/Schema"
 *
 * const rule = S.decodeUnknownSync(Deny)({
 *   action: "delete",
 *   effect: "deny",
 *   resource: "matter"
 * })
 *
 * console.log(rule.effect) // "deny"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Deny extends Base.extend<Deny>($I`Deny`)(
  {
    effect: S.tag(Effect.Enum.deny).annotateKey({ description: "Rule discriminator for a deny decision." }),
  },
  $I.annote("Deny", {
    description: " with discriminated `deny` effect field",
  })
) {}

/**
 * Rule variant that requires an additional decision before proceeding.
 *
 * **Example** (Decode ask rule)
 *
 * ```ts
 * import { Ask } from "@beep/shared-domain/values/Rule/Rule.model"
 * import * as S from "effect/Schema"
 *
 * const rule = S.decodeUnknownSync(Ask)({
 *   action: "export",
 *   effect: "ask",
 *   resource: "matter"
 * })
 *
 * console.log(rule.effect) // "ask"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Ask extends Base.extend<Ask>($I`Ask`)(
  {
    effect: S.tag(Effect.Enum.ask).annotateKey({ description: "Rule discriminator for an ask decision." }),
  },
  $I.annote("Ask", {
    description: " with discriminated `ask` effect field",
  })
) {}

/**
 * Tagged union schema for allow, deny, and ask rule decisions.
 *
 * **Example** (Decode rule union)
 *
 * ```ts
 * import { Rule } from "@beep/shared-domain/values/Rule/Rule.model"
 * import * as S from "effect/Schema"
 *
 * const rule = S.decodeUnknownSync(Rule)({
 *   action: "read",
 *   effect: "allow",
 *   resource: "matter"
 * })
 *
 * console.log(rule.effect) // "allow"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Rule = S.Union([Allow, Deny, Ask]).pipe(
  S.toTaggedUnion("effect"),
  $I.annoteSchema("Rule", {
    description: "RuleEffect tagged union",
  })
);

/**
 * Companion type for {@link Rule}.
 *
 * **Example** (Extract rule effect type)
 *
 * ```ts
 * import type { Rule } from "@beep/shared-domain/values/Rule/Rule.model"
 *
 * type RuleEffect = Rule["effect"]
 *
 * const effect: RuleEffect = "deny"
 *
 * console.log(effect)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Rule = typeof Rule.Type;

/**
 * Array schema for ordered rule effects.
 *
 * **Example** (Decode ordered ruleset)
 *
 * ```ts
 * import { Ruleset } from "@beep/shared-domain/values/Rule/Rule.model"
 * import * as S from "effect/Schema"
 *
 * const rules = S.decodeUnknownSync(Ruleset)([
 *   { action: "read", effect: "allow", resource: "matter" },
 *   { action: "delete", effect: "deny", resource: "matter" }
 * ])
 *
 * console.log(rules.length) // 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Ruleset = Rule.pipe(
  S.Array,
  $I.annoteSchema("Ruleset", {
    description: "Array of Rule",
  })
);

/**
 * Type for {@link Ruleset}.
 *
 * **Example** (Extract ruleset effect type)
 *
 * ```ts
 * import type { Ruleset } from "@beep/shared-domain/values/Rule/Rule.model"
 *
 * type RuleEffect = Ruleset[number]["effect"]
 *
 * const effect: RuleEffect = "ask"
 *
 * console.log(effect)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Ruleset = typeof Ruleset.Type;
