/**
 * Effect v4 service boundary and transactional live shell for S7 projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import { Context, Crypto, Effect, FileSystem, Layer, TxQueue, TxRef } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { projectSchedule } from "./Engine.ts";
import { decodeHandoffView, planHandoffView } from "./LanePlan.ts";
import { HandoffDigestMismatchError, HandoffReadError } from "./Schemas.ts";
import { emitLanePlan, emitScheduleAbox } from "./Turtle.ts";
import type {
  CyclicPlanError,
  HandoffDecodeError,
  LanePlanProposal,
  PlanEpisodeInput,
  PolicyDecodeError,
  ProjectionInput,
  ScheduleProposal,
  TurtleDocument,
} from "./Schemas.ts";

const $I = $CiopsId.create("projection/CiOpsProjection");

/**
 * Typed failures the lane planner can return.
 *
 * **Details**
 *
 * Read, digest and decode failures cover the pinned handoff; `CyclicPlanError`
 * covers explicit precedence input.
 *
 * @category errors
 * @since 0.0.0
 */
type PlanEpisodeError = HandoffReadError | HandoffDigestMismatchError | HandoffDecodeError | CyclicPlanError;

/**
 * Operations exposed by the S7 projection service and its in-process shell.
 *
 * **Details**
 *
 * `project` and `emitAbox` are deterministic pure-core operations.
 * `project` preserves the caller's bounded `episodeId` on its proposal;
 * `emitAbox` uses that identity for the typed current-proposal subject.
 * `projectCurrent` is the explicit stateful boundary that records the latest
 * proposal and publishes it to the transactional change queue.
 * `planEpisode` is the S7-v2 lane planner (contract §8): it reads the pinned
 * gate-order handoff through the layer's captured file system and crypto,
 * checks the raw bytes' SHA-256 before decoding, and never touches the
 * current-proposal shell. `emitLanePlan` serializes a lane plan in the
 * provisional lane-plan vocabulary only.
 *
 * @category services
 * @since 0.0.0
 */
export interface CiOpsProjectionShape {
  readonly awaitCurrentProposal: Effect.Effect<ScheduleProposal>;
  readonly currentProposal: Effect.Effect<O.Option<ScheduleProposal>>;
  readonly emitAbox: (proposal: ScheduleProposal) => Effect.Effect<TurtleDocument>;
  readonly emitLanePlan: (plan: LanePlanProposal) => Effect.Effect<TurtleDocument>;
  readonly nextProposal: Effect.Effect<ScheduleProposal>;
  readonly planEpisode: (input: PlanEpisodeInput) => Effect.Effect<LanePlanProposal, PlanEpisodeError>;
  readonly project: (input: ProjectionInput) => Effect.Effect<ScheduleProposal, PolicyDecodeError>;
  readonly projectCurrent: (input: ProjectionInput) => Effect.Effect<ScheduleProposal, PolicyDecodeError>;
}

/**
 * Deterministic CI-operations admission projection service.
 *
 * **Example** (Reference the live service layer)
 *
 * ```ts
 * import { CiOpsProjection, CiOpsProjectionLive } from "@/projection/CiOpsProjection"
 * import { Layer } from "effect"
 *
 * console.log(CiOpsProjection.key.length > 0) // true
 * console.log(Layer.isLayer(CiOpsProjectionLive)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CiOpsProjection extends Context.Service<CiOpsProjection, CiOpsProjectionShape>()($I`CiOpsProjection`) {}

const digestHandoffBytes = S.decodeUnknownEffect(Sha256HexFromBytes);

// Contract §8.1: raw bytes at repoRoot/path; the schema already refuses absolute paths and `..` segments.
const readHandoffBytes = (fs: FileSystem.FileSystem, input: PlanEpisodeInput) =>
  fs
    .readFile(`${input.repoRoot}/${input.handoff.path}`)
    .pipe(Effect.mapError((error) => HandoffReadError.make({ path: input.handoff.path, message: error.message })));

// The digest is over the raw bytes, never a re-encoded string. A Uint8Array always decodes, so the only failure is
// the platform digest's (Sha256HexFromBytes wraps it as a schema issue); it stays typed inside the §8.1 union.
const digestHandoff = (crypto: Crypto.Crypto, input: PlanEpisodeInput, bytes: Uint8Array) =>
  digestHandoffBytes(bytes).pipe(
    Effect.provideService(Crypto.Crypto, crypto),
    Effect.mapError((error) =>
      HandoffReadError.make({ path: input.handoff.path, message: `SHA-256 digest failed: ${error.message}` })
    )
  );

const makePlanEpisode = (fs: FileSystem.FileSystem, crypto: Crypto.Crypto) =>
  Effect.fn("CiOpsProjection.planEpisode")(function* (
    input: PlanEpisodeInput
  ): Effect.fn.Return<LanePlanProposal, PlanEpisodeError> {
    const bytes = yield* readHandoffBytes(fs, input);
    const actualSha256 = yield* digestHandoff(crypto, input, bytes);
    if (actualSha256 !== input.handoff.sha256) {
      return yield* HandoffDigestMismatchError.make({
        path: input.handoff.path,
        expectedSha256: input.handoff.sha256,
        actualSha256,
      });
    }
    const view = yield* decodeHandoffView(input.handoff.path, new TextDecoder().decode(bytes));
    return yield* planHandoffView(input, view);
  });

const makeCiOpsProjection = Effect.fnUntraced(function* (): Effect.fn.Return<
  CiOpsProjectionShape,
  never,
  FileSystem.FileSystem | Crypto.Crypto
> {
  // Contract §8: the layer captures the platform services at construction so
  // planEpisode keeps a requirement-free signature.
  const fs = yield* FileSystem.FileSystem;
  const crypto = yield* Crypto.Crypto;
  const current = yield* TxRef.make<O.Option<ScheduleProposal>>(O.none());
  const proposals = yield* TxQueue.unbounded<ScheduleProposal>();

  const currentProposal = TxRef.get(current).pipe(Effect.tx);
  const awaitCurrentProposal = TxRef.get(current).pipe(
    Effect.flatMap(
      O.match({
        onNone: () => Effect.txRetry,
        onSome: Effect.succeed,
      })
    ),
    Effect.tx
  );
  const nextProposal = TxQueue.take(proposals);

  const projectCurrent = Effect.fn("CiOpsProjection.projectCurrent")(function* (
    input: ProjectionInput
  ): Effect.fn.Return<ScheduleProposal, PolicyDecodeError> {
    const proposal = yield* projectSchedule(input);
    yield* Effect.tx(
      Effect.gen(function* () {
        yield* TxRef.set(current, O.some(proposal));
        yield* TxQueue.offer(proposals, proposal);
      })
    );
    return proposal;
  });

  const planEpisode = makePlanEpisode(fs, crypto);

  return CiOpsProjection.of({
    project: projectSchedule,
    emitAbox: emitScheduleAbox,
    emitLanePlan,
    planEpisode,
    projectCurrent,
    currentProposal,
    awaitCurrentProposal,
    nextProposal,
  });
});

/**
 * In-process layer with transactional current-proposal and change-queue state.
 *
 * **Details**
 *
 * The layer captures `FileSystem` and `Crypto` at construction for the lane
 * planner, so providers add the platform layers (for Bun, `BunFileSystem.layer`
 * and `BunCrypto.layer`) while every service method stays requirement-free.
 *
 * **Example** (Provide the projection service)
 *
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
 * import { CiOpsProjection, CiOpsProjectionLive } from "@/projection/CiOpsProjection"
 * import { Effect, Layer } from "effect"
 *
 * const ProjectionLive = CiOpsProjectionLive.pipe(
 *   Layer.provide(Layer.merge(BunFileSystem.layer, BunCrypto.layer))
 * )
 * const current = Effect.flatMap(CiOpsProjection, (service) => service.currentProposal)
 * const program = Effect.provide(current, ProjectionLive)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CiOpsProjectionLive: Layer.Layer<CiOpsProjection, never, FileSystem.FileSystem | Crypto.Crypto> =
  Layer.effect(CiOpsProjection, makeCiOpsProjection());
