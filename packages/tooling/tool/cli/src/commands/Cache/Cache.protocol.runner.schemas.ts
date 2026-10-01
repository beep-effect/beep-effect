/**
 * Requests and bounded observations for the owned native protocol runner.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientChannel, CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CacheFixtureEvent } from "./Cache.protocol.fixture.schemas.ts";
import { CacheProtocolObservation } from "./Cache.protocol.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.protocol.runner.schemas");

/**
 * Select an exact native binary for an isolated synthetic signed-cache run.
 *
 * **Example** (Inspect required pin fields)
 * ```ts
 * import { CacheProtocolRequest } from "@beep/repo-cli/commands/Cache"
 * console.assert("client" in CacheProtocolRequest.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProtocolRequest extends S.Class<CacheProtocolRequest>($I`CacheProtocolRequest`)(
  { channel: CacheClientChannel, client: CacheClientPin, executable: S.NonEmptyString },
  $I.annote("CacheProtocolRequest", {
    description: "Pinned binary and channel; credentials are generated only inside the isolated worker.",
  })
) {}

/**
 * A failed native read joined to its direct transport observation.
 *
 * **Example** (Inspect rejection evidence)
 * ```ts
 * import { CacheProtocolReadFailure } from "@beep/repo-cli/commands/Cache"
 * console.assert("summary" in CacheProtocolReadFailure.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProtocolReadFailure extends S.Class<CacheProtocolReadFailure>($I`CacheProtocolReadFailure`)(
  {
    case: LiteralKit(["truncated-body", "unavailable", "throttled"]),
    taskHash: S.NonEmptyString,
    summary: Sha256Hex,
    exitCode: S.Literal(42),
    restoredOutputs: S.Literal(0),
  },
  $I.annote("CacheProtocolReadFailure", {
    description: "A native fallback denied before output, with independently recorded wire events.",
  })
) {}

/**
 * Bounded synthetic execution results, never a qualification authorization.
 *
 * **Example** (Keep authority explicit)
 * ```ts
 * import { CacheProtocolExecution } from "@beep/repo-cli/commands/Cache"
 * console.assert("observation" in CacheProtocolExecution.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProtocolExecution extends S.Class<CacheProtocolExecution>($I`CacheProtocolExecution`)(
  {
    schemaVersion: S.tag("cache-protocol-execution/v1"),
    authority: S.tag("synthetic-native-observation-only"),
    network: S.tag("private-loopback-nested-readers/v1"),
    observation: CacheProtocolObservation,
    failures: S.Array(CacheProtocolReadFailure).check(S.isMinLength(3), S.isMaxLength(3)),
    events: S.Array(CacheFixtureEvent).check(S.isMaxLength(101)),
    bunSha256: Sha256Hex,
  },
  $I.annote("CacheProtocolExecution", {
    description: "Owned isolated execution with bounded native and wire observations; no promotion authority.",
  })
) {}
