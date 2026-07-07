/**
 * Source authentication gate registry.
 *
 * A `SourceAuth` registration describes one credential-gated data source: its
 * human-readable name, the environment variable that carries its secret, a
 * `gate` policy (`none | soft | hard`), and an optional signup URL surfaced to
 * callers when the credential is missing.
 *
 * Credential resolution is intentionally narrow: it reads exactly one
 * optional-secret shape, `Config.redacted(envVar).pipe(Config.option)`,
 * mirroring the idiom already used by seven in-repo drivers (see
 * `packages/drivers/uspto/src/Uspto.service.ts:398`). This module
 * consolidates that idiom into one reusable, schema-first record instead of
 * re-deriving it per driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpKitId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Config, Data, Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type * as Redacted from "effect/Redacted";

const $I = $McpKitId.create("SourceAuth");

/**
 * Gate policy applied to a credential-backed source.
 *
 * - `none` — the source needs no credential; it is always mounted.
 * - `soft` — the credential is optional; the source stays registered and
 *   degrades at call time (see `ApiKeyRequired`) when the key is absent.
 * - `hard` — the credential is required; the source vanishes at composition
 *   time when the key is absent (see `ToolkitComposition`).
 *
 * @example
 * ```ts
 * import { SourceAuthGate } from "@beep/mcp-kit"
 *
 * const gate = SourceAuthGate.Enum.soft
 * console.log(gate)
 * // "soft"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceAuthGate = LiteralKit(["none", "soft", "hard"]).pipe(
  $I.annoteSchema("SourceAuthGate", {
    description:
      "Credential gate policy: none (always mounted), soft (degrades at call time), hard (vanishes at composition).",
  })
);

/**
 * Runtime type for {@link SourceAuthGate}.
 *
 * @example
 * ```ts
 * import type { SourceAuthGate } from "@beep/mcp-kit"
 *
 * const gate = "hard" satisfies SourceAuthGate
 * console.log(gate)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SourceAuthGate = typeof SourceAuthGate.Type;

/**
 * Schema-first per-source credential-gate registration.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { SourceAuthRegistration } from "@beep/mcp-kit"
 *
 * const registration = SourceAuthRegistration.make({
 *   name: "USPTO Open Data Portal",
 *   envVar: "USPTO_API_KEY",
 *   gate: "soft"
 * })
 * console.log(registration.envVar)
 * // "USPTO_API_KEY"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceAuthRegistration extends S.Class<SourceAuthRegistration>($I`SourceAuthRegistration`)(
  {
    name: S.NonEmptyString.annotateKey({
      description: "Human-readable source name surfaced to callers and audit records.",
    }),
    envVar: S.NonEmptyString.annotateKey({
      description: "Environment variable carrying the source's optional secret credential.",
    }),
    gate: SourceAuthGate.annotateKey({
      description: "Credential gate policy for this source.",
    }),
    signupUrl: S.OptionFromNullOr(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Optional signup URL surfaced when the credential is missing.",
      })
    ),
  },
  $I.annote("SourceAuthRegistration", {
    description: "Schema-first per-source credential-gate registration.",
  })
) {}

/**
 * Resolves a source's credential using the optional-secret idiom
 * `Config.redacted(envVar).pipe(Config.option)`. Missing environment
 * variables decode to `Option.none()` rather than failing.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { resolveSourceCredential, SourceAuthRegistration } from "@beep/mcp-kit"
 *
 * const registration = SourceAuthRegistration.make({
 *   name: "Example",
 *   envVar: "MCP_KIT_EXAMPLE_DOES_NOT_EXIST",
 *   gate: "soft"
 * })
 *
 * const credential = Effect.runSync(resolveSourceCredential(registration))
 * console.log(O.isNone(credential))
 * // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const resolveSourceCredential = (
  registration: SourceAuthRegistration
): Effect.Effect<O.Option<Redacted.Redacted<string>>, Config.ConfigError> =>
  Config.redacted(registration.envVar).pipe(Config.option);

/**
 * The composition-time verdict for one registered source: `Mount` when the
 * source should be registered (carrying whatever credential was resolved,
 * possibly `None` for `soft`/`none` gates), or `Vanish` when a `hard`-gated
 * source's credential is absent and the source must not be registered at
 * all.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { SourceAuthDecision as SourceAuthDecisionValue } from "@beep/mcp-kit"
 * import type { SourceAuthDecision } from "@beep/mcp-kit"
 *
 * const decision: SourceAuthDecision = SourceAuthDecisionValue.Mount({
 *   credential: O.none()
 * })
 * console.log(decision._tag)
 * // "Mount"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SourceAuthDecision = Data.TaggedEnum<{
  readonly Mount: { readonly credential: O.Option<Redacted.Redacted<string>> };
  readonly Vanish: {};
}>;

/**
 * Tagged-enum constructors and matchers for {@link SourceAuthDecision}.
 *
 * @example
 * ```ts
 * import { SourceAuthDecision } from "@beep/mcp-kit"
 *
 * const decision = SourceAuthDecision.Vanish()
 * console.log(decision._tag)
 * // "Vanish"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const SourceAuthDecision = Data.taggedEnum<SourceAuthDecision>();

/**
 * Decides whether a registered source should mount or vanish, applying the
 * hybrid gate policy: `hard` vanishes when the credential is absent; `none`
 * and `soft` always mount (and carry whatever credential — if any — was
 * resolved, so callers can degrade at call time).
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { decideSourceAuthMount, SourceAuthRegistration } from "@beep/mcp-kit"
 *
 * const registration = SourceAuthRegistration.make({
 *   name: "Example",
 *   envVar: "MCP_KIT_EXAMPLE_DOES_NOT_EXIST",
 *   gate: "hard"
 * })
 *
 * const decision = Effect.runSync(decideSourceAuthMount(registration))
 * console.log(decision._tag)
 * // "Vanish"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const decideSourceAuthMount = Effect.fn("decideSourceAuthMount")(function* (
  registration: SourceAuthRegistration
) {
  return yield* SourceAuthGate.$match(registration.gate, {
    none: () => Effect.succeed(SourceAuthDecision.Mount({ credential: O.none() })),
    soft: () =>
      Effect.map(resolveSourceCredential(registration), (credential) => SourceAuthDecision.Mount({ credential })),
    hard: () =>
      Effect.map(resolveSourceCredential(registration), (credential) =>
        O.isNone(credential) ? SourceAuthDecision.Vanish() : SourceAuthDecision.Mount({ credential })
      ),
  });
});
