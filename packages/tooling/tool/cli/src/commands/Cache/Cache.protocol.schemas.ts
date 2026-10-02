/**
 * Bounded native protocol observations owned by cache conformance.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientChannel, CacheClientPin } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Cache/Cache.protocol.schemas");
const ProtocolCase = LiteralKit(["producer", "replay", "missing-tag", "invalid-tag", "corrupt-body", "wrong-key"]);
type ProtocolCase = typeof ProtocolCase.Type;
const Artifact = S.Struct({ sha256: Sha256Hex, bytes: S.Natural });
type Artifact = typeof Artifact.Type;
const NativeOutcome = S.TaggedUnion({
  Produced: { output: Artifact },
  Replayed: { output: Artifact },
  Rejected: { exitCode: S.Int, restoredOutputs: S.Natural },
});
type NativeOutcome = typeof NativeOutcome.Type;
const NativeRun = S.Struct({
  case: ProtocolCase,
  taskHash: S.NonEmptyString.check(S.isMaxLength(128)),
  client: CacheClientPin,
  summary: Sha256Hex,
  outcome: NativeOutcome,
});
type NativeRun = typeof NativeRun.Type;
const Exchange = S.Struct({
  case: ProtocolCase,
  requestId: S.NonEmptyString.check(S.isMaxLength(128)),
  taskHash: NativeRun.fields.taskHash,
  method: LiteralKit(["PUT", "GET"]),
  role: LiteralKit(["writer", "reader"]),
  status: S.Int.check(S.isBetween({ minimum: 100, maximum: 599 })),
  tag: LiteralKit(["present", "absent"]),
  artifact: Artifact,
});
type Exchange = typeof Exchange.Type;

/**
 * Correlates bounded synthetic native runs with successful artifact exchanges.
 *
 * **Details**
 * This wire contract has observation authority only. Shape validation and
 * relationship checks cannot establish a protected producer or qualify a task.
 * Request bodies, bearer credentials and signature values are never fields.
 *
 * **Example** (Reject an asserted qualification authority)
 *
 * ```ts
 * import { CacheProtocolObservation } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheProtocolObservation)({ authority: "qualified" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProtocolObservation extends S.Class<CacheProtocolObservation>($I`CacheProtocolObservation`)(
  {
    schemaVersion: S.tag("cache-protocol-observation/v1"),
    authority: S.tag("synthetic-native-observation-only"),
    channel: CacheClientChannel,
    client: CacheClientPin,
    runs: S.NonEmptyArray(NativeRun).check(S.isMaxLength(6)),
    exchanges: S.NonEmptyArray(Exchange).check(S.isMaxLength(6)),
  },
  $I.annote("CacheProtocolObservation", {
    description: "Sanitized native-client and wire relationships with no qualification authority.",
  })
) {}
