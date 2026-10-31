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
 * Selected native summary fields, retaining the complete observed task graph.
 *
 * **Example** (Inspect the summary task fields)
 * ```ts
 * import { CacheProtocolNativeSummary } from "@beep/repo-cli/commands/Cache"
 * console.assert("tasks" in CacheProtocolNativeSummary.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheProtocolNativeSummary extends S.Opaque<
  CacheProtocolNativeSummary,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    turboVersion: S.NonEmptyString,
    tasks: S.Array(
      S.Struct({
        taskId: S.NonEmptyString,
        hash: S.NonEmptyString,
        cache: S.Struct({ status: S.Literals(["HIT", "MISS"]), source: S.OptionFromOptionalKey(S.String) }),
        execution: S.Struct({ exitCode: S.Int }),
      })
    ),
  }).pipe(
    $I.annoteSchema("CacheProtocolNativeSummary", {
      description:
        "Selected fields of one native Turbo run summary; a reported hit is evidence only with wire receipts.",
    })
  )
) {}

/**
 * Select an exact native binary for an isolated synthetic signed-cache run.
 *
 * **Details**
 * Use a concrete `team_` identifier for the client's namespace when comparing
 * native versions. The private fixture accepts the `teamId` selector, while
 * newer clients may interpret other namespace strings as team slugs.
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
export class CacheProtocolRequest extends S.Opaque<CacheProtocolRequest, { readonly brand: unique symbol }>()(
  S.Struct({ channel: CacheClientChannel, client: CacheClientPin, executable: S.NonEmptyString }).pipe(
    $I.annoteSchema("CacheProtocolRequest", {
      description: "Pinned binary and channel; credentials are generated only inside the isolated worker.",
    })
  )
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
export class CacheProtocolReadFailure extends S.Opaque<CacheProtocolReadFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    case: LiteralKit(["truncated-body", "unavailable", "throttled"]),
    taskHash: S.NonEmptyString,
    summary: Sha256Hex,
    exitCode: S.tag(42),
    restoredOutputs: S.tag(0),
  }).pipe(
    $I.annoteSchema("CacheProtocolReadFailure", {
      description: "A native fallback denied before output, with independently recorded wire events.",
    })
  )
) {}

/**
 * Measured private filesystem root for one complete protocol scenario.
 *
 * **Example** (Inspect the bound scenario identity)
 * ```ts
 * import { CacheProtocolIsolationRoot } from "@beep/repo-cli/commands/Cache"
 * console.assert("sha256" in CacheProtocolIsolationRoot.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProtocolIsolationRoot extends S.Opaque<
  CacheProtocolIsolationRoot,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    case: LiteralKit([
      "producer",
      "replay",
      "missing-tag",
      "invalid-tag",
      "corrupt-body",
      "wrong-key",
      "truncated-body",
      "unavailable",
      "throttled",
    ]),
    sha256: Sha256Hex,
  }).pipe(
    $I.annoteSchema("CacheProtocolIsolationRoot", {
      description:
        "Domain-separated digest of the scenario directory's resolved absolute path, measured by its owned worker.",
    })
  )
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
export class CacheProtocolExecution extends S.Opaque<CacheProtocolExecution, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-protocol-execution/v2"),
    authority: S.tag("synthetic-native-observation-only"),
    network: S.tag("private-loopback-nested-readers/v1"),
    observation: CacheProtocolObservation,
    roots: S.NonEmptyArray(CacheProtocolIsolationRoot).check(S.isMinLength(9), S.isMaxLength(9)),
    failures: S.Array(CacheProtocolReadFailure).check(S.isMinLength(3), S.isMaxLength(3)),
    events: S.Array(CacheFixtureEvent).check(S.isMaxLength(101)),
    bunSha256: Sha256Hex,
  }).pipe(
    $I.annoteSchema("CacheProtocolExecution", {
      description: "Owned isolated execution with bounded native and wire observations; no promotion authority.",
    })
  )
) {}
