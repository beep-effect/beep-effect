/**
 * Isolated conformance fixture configuration and sanitized events.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Cache/Cache.protocol.fixture.schemas");

/**
 * Bounded fixture artifact selector; it is not a universal Remote Cache key policy.
 *
 * **Example** (Reject traversal)
 * ```ts
 * import { CacheFixtureArtifactKey } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheFixtureArtifactKey)("../artifact"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheFixtureArtifactKey = S.String.check(S.isPattern(/^[a-f0-9]{16,128}$/)).annotate(
  $I.annote("CacheFixtureArtifactKey", { description: "Hexadecimal artifact selector accepted by the local fixture." })
);
/**
 * Decoded artifact selector accepted by the bounded local fixture.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheFixtureArtifactKey = typeof CacheFixtureArtifactKey.Type;

/**
 * Faults deliberately injected only into artifact reads.
 *
 * **Example** (Select an integrity fault)
 * ```ts
 * import { CacheFixtureFault } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheFixtureFault.is["missing-tag"]("missing-tag"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheFixtureFault = LiteralKit([
  "none",
  "missing-tag",
  "invalid-tag",
  "corrupt-body",
  "truncated-body",
  "unavailable",
  "throttled",
]).annotate(
  $I.annote("CacheFixtureFault", { description: "Explicit read fault for the isolated signed-cache fixture." })
);
/**
 * Read-fault selection used by the isolated protocol fixture.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheFixtureFault = typeof CacheFixtureFault.Type;

/**
 * Ephemeral bearer capabilities, deliberately separate from artifact signing.
 *
 * **Example** (Keep fixture credentials redacted)
 * ```ts
 * import { CacheFixtureCredentials } from "@beep/repo-cli/commands/Cache"
 * import * as Redacted from "effect/Redacted"
 * const credentials = CacheFixtureCredentials.make({
 *   namespace: "team_fixture", reader: Redacted.make("reader"), writer: Redacted.make("writer")
 * })
 * console.assert(credentials.namespace === "team_fixture")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheFixtureCredentials extends S.Class<CacheFixtureCredentials>($I`CacheFixtureCredentials`)(
  {
    namespace: S.NonEmptyString.check(S.isMaxLength(128)),
    reader: S.Redacted(S.NonEmptyString),
    writer: S.Redacted(S.NonEmptyString),
  },
  $I.annote("CacheFixtureCredentials", {
    description: "Local fixture tenant and distinct ephemeral HTTP capabilities.",
  })
) {}

/**
 * Bounded case attribution fixed before a native process starts.
 *
 * **Example** (Attribute a valid replay)
 * ```ts
 * import { CacheFixtureScenario } from "@beep/repo-cli/commands/Cache"
 * const scenario = CacheFixtureScenario.make({ id: "replay", fault: "none" })
 * console.assert(scenario.id === "replay")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheFixtureScenario extends S.Class<CacheFixtureScenario>($I`CacheFixtureScenario`)(
  { id: S.NonEmptyString.check(S.isMaxLength(128)), fault: CacheFixtureFault },
  $I.annote("CacheFixtureScenario", { description: "Attribution and explicit fault for one fixture case." })
) {}

/**
 * Safe request evidence with no URLs, credentials, signatures or artifact bodies.
 *
 * **Example** (Reject raw wire input)
 * ```ts
 * import { CacheFixtureEvent } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheFixtureEvent)({ authorization: "Bearer value" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheFixtureEvent extends S.Class<CacheFixtureEvent>($I`CacheFixtureEvent`)(
  {
    sequence: NonNegativeInt,
    scenario: CacheFixtureScenario,
    operation: LiteralKit(["status", "put", "get", "head", "events", "batch", "rejected"]),
    role: LiteralKit(["reader", "writer", "unknown"]),
    status: S.Int.check(S.isBetween({ minimum: 100, maximum: 599 })),
    artifact: S.OptionFromNullOr(CacheFixtureArtifactKey),
    digest: S.OptionFromNullOr(Sha256Hex),
    bytes: NonNegativeInt,
    tagPresent: S.Boolean,
  },
  $I.annote("CacheFixtureEvent", { description: "Sanitized fixture request, selected bytes and response disposition." })
) {}
