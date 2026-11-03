/**
 * Same-attempt reuse for the CI parity battery of a `--prove-first` publish.
 *
 * **Details**
 *
 * The parity battery (`beep ci local --affected` on the merge preview) runs
 * many of the same `beep ci lane <id>` commands the pre-push tier just ran. A
 * parity lane is skipped only when a lane of the same attempt passed with the
 * same command digest **and** the same environment identity: the CI posture
 * variables the parity step pins ({@link CI_PARITY_POSTURE_ENV}), the virtual
 * tree, the base commit, and the Bun, Node, platform and architecture that
 * ran it. The comparison is same-attempt only, so both sides inherit one Yeet
 * process environment and the step overrides are the only variables that can
 * differ; the posture keys are exactly those overrides.
 *
 * Each proof step's identity is written to the run's
 * `proof-environments.json`, and the proof ledger records its digest on every
 * fact beside the command digest.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { formatCommandLine } from "@beep/repo-cli-kit/process/StepExec";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { LiteralKit } from "@beep/schema";
import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CI_LOCAL_DEFAULT_LANES, ciLocalStepsForTesting } from "../../Ci/CiLane.ts";
import { laneProofVirtualTreeSha } from "../../Quality/internal/LaneProofReuse.ts";
import { GithubCheckLaneRunStatus } from "../../Quality/Quality.schemas.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { CI_PARITY_POSTURE_ENV } from "./Planner.ts";
import { proofCommandDigest, proofTextDigest } from "./ProofDigest.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { CiLocalStepPlan } from "../../Ci/CiLane.ts";
import type { QualityTaskLaneRunReport } from "../../Quality/Quality.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ParityReuse");

const PROOF_ENVIRONMENTS_FILE_NAME = "proof-environments.json";
const UNSET = "unset";
const SET = "set";

/**
 * The environment one proof step ran its lanes under.
 *
 * **Details**
 *
 * `posture` holds each {@link CI_PARITY_POSTURE_ENV} key: its value for the
 * keys the parity step pins to a value, and only `set`/`unset` for the
 * credentials it blanks, so no secret reaches the record. `digest` is the
 * SHA-256 over every other field.
 *
 * @category models
 * @since 0.0.0
 */
export class ProofEnvironment extends S.Opaque<ProofEnvironment, { readonly brand: unique symbol }>()(
  S.Struct({
    stepId: S.String,
    platform: S.String,
    architecture: S.String,
    bunVersion: S.String,
    nodeVersion: S.String,
    treeSha: S.String,
    baseSha: S.String,
    posture: S.Record(S.String, S.String),
    digest: S.String,
  }).pipe(
    $I.annoteSchema("ProofEnvironment", {
      description:
        "Posture variables, virtual tree, base commit and toolchain one proof step ran under, with their digest.",
    })
  )
) {}

class ProofEnvironmentRecord extends S.Opaque<ProofEnvironmentRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("proof-environments/v1"),
    environments: S.Array(ProofEnvironment),
  }).pipe(
    $I.annoteSchema("ProofEnvironmentRecord", {
      description: "Environment identity of every proof step one Yeet attempt ran.",
    })
  )
) {}

const ProofEnvironmentRecordJson = JsonStringCodec(ProofEnvironmentRecord);

/**
 * Why a parity lane still runs.
 *
 * **Example** (Name a parity refusal)
 *
 * ```ts
 * import { ParityLaneRunReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ParityLaneRunReason.is["environment-changed"]("environment-changed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ParityLaneRunReason = LiteralKit(["no-proven-twin", "environment-changed"]).pipe(
  $I.annoteSchema("ParityLaneRunReason", {
    description: "No lane of the attempt passed the same command, or one did under a different environment identity.",
  })
);

/**
 * One parity lane decision: reused from a same-attempt proof, or run.
 *
 * @category models
 * @since 0.0.0
 */
export class ParityLaneDecision extends S.Opaque<ParityLaneDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    laneId: S.String,
    commandDigest: S.String,
    environmentDigest: S.String,
    reuse: S.Boolean,
    reason: S.optionalKey(ParityLaneRunReason),
    provenBy: S.optionalKey(S.String),
    differences: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ParityLaneDecision", {
      description:
        "A parity lane's command and environment digests, whether a same-attempt proof covers it, and why not.",
    })
  )
) {}

/**
 * A lane the parity battery would run.
 *
 * @category models
 * @since 0.0.0
 */
export class ParityLaneCandidate extends S.Opaque<ParityLaneCandidate, { readonly brand: unique symbol }>()(
  S.Struct({
    laneId: S.String,
    commandText: S.String,
  }).pipe(
    $I.annoteSchema("ParityLaneCandidate", {
      description: "One lane of the CI parity battery and the command line it runs.",
    })
  )
) {}

/**
 * A lane of the attempt that passed, with the environment its step ran under.
 *
 * @category models
 * @since 0.0.0
 */
export class ProvenLane extends S.Opaque<ProvenLane, { readonly brand: unique symbol }>()(
  S.Struct({
    laneId: S.String,
    commandText: S.String,
    environment: ProofEnvironment,
  }).pipe(
    $I.annoteSchema("ProvenLane", {
      description: "A lane that passed in this attempt, its command line, and its proof step's environment.",
    })
  )
) {}

const CREDENTIAL_POSTURE_KEYS = pipe(
  R.toEntries(CI_PARITY_POSTURE_ENV),
  A.filter(([, value]) => value === undefined),
  A.map(([key]) => key)
);

/**
 * Reduce an environment to the posture half of a proof environment identity.
 *
 * **Example** (Blank credentials report presence only)
 *
 * ```ts
 * import { proofEnvironmentPosture } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(proofEnvironmentPosture({ CI: "true", AUTH_SECRET: "s3cr3t" }).AUTH_SECRET) // "set"
 * ```
 *
 * @param env - Effective environment of the step.
 * @returns Each posture key's value, or `set`/`unset` for the credentials.
 * @category utilities
 * @since 0.0.0
 */
export const proofEnvironmentPosture = (
  env: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string>> =>
  R.fromEntries(
    A.map(R.keys(CI_PARITY_POSTURE_ENV), (key) => {
      const value = env[key];
      return A.contains(CREDENTIAL_POSTURE_KEYS, key)
        ? [key, value === undefined ? UNSET : SET]
        : [key, value ?? UNSET];
    })
  );

const stableText = (entries: ReadonlyArray<readonly [string, string]>): string =>
  A.join(
    A.map(
      A.sort(
        entries,
        Order.mapInput(Order.String, ([key]: readonly [string, string]) => key)
      ),
      ([key, value]) => `${key.length}:${key}=${value.length}:${value}`
    ),
    "\0"
  );

/**
 * Identify the environment one proof step runs its lanes under.
 *
 * @param stepId - Proof step id (the inner-lane reports' `parentLaneId`).
 * @param cwd - Checkout the step's lanes run in.
 * @param env - Effective environment of the step.
 * @param baseSha - Base commit the step's lanes compare against.
 * @returns The step's environment identity.
 * @category execution
 * @since 0.0.0
 */
export const collectProofEnvironment = Effect.fn("Yeet.collectProofEnvironment")(function* (
  stepId: string,
  cwd: string,
  env: Readonly<Record<string, string | undefined>>,
  baseSha: string
): Effect.fn.Return<
  ProofEnvironment,
  YeetCommandError,
  | FileSystem.FileSystem
  | Path.Path
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> {
  const treeSha = yield* laneProofVirtualTreeSha(cwd).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to identify the proof tree at ${cwd}.`))
  );
  const fields = {
    stepId,
    platform: yield* HostProcessPlatform,
    architecture: yield* HostProcessArchitecture,
    // `process.versions.bun` is absent when the CLI runs under Node.
    bunVersion: process.versions.bun ?? "none",
    nodeVersion: process.version,
    treeSha,
    baseSha,
    posture: proofEnvironmentPosture(env),
  };
  const digest = yield* proofTextDigest(
    stableText([
      ["platform", fields.platform],
      ["architecture", fields.architecture],
      ["bunVersion", fields.bunVersion],
      ["nodeVersion", fields.nodeVersion],
      ["treeSha", fields.treeSha],
      ["baseSha", fields.baseSha],
      ["posture", stableText(R.toEntries(fields.posture))],
    ])
  );
  return ProofEnvironment.make({ ...fields, digest });
});

/**
 * Name the identity components that differ between two proof environments.
 *
 * @param proven - Environment the proven lane ran under.
 * @param parity - Environment the parity lane would run under.
 * @returns `tree`, `base`, `toolchain`, `host` and each differing posture key.
 * @category utilities
 * @since 0.0.0
 */
export const proofEnvironmentDifferences: {
  (parity: ProofEnvironment): (proven: ProofEnvironment) => ReadonlyArray<string>;
  (proven: ProofEnvironment, parity: ProofEnvironment): ReadonlyArray<string>;
} = dual(
  2,
  (proven: ProofEnvironment, parity: ProofEnvironment): ReadonlyArray<string> => [
    ...(proven.treeSha === parity.treeSha ? [] : ["tree"]),
    ...(proven.baseSha === parity.baseSha ? [] : ["base"]),
    ...(proven.bunVersion === parity.bunVersion && proven.nodeVersion === parity.nodeVersion ? [] : ["toolchain"]),
    ...(proven.platform === parity.platform && proven.architecture === parity.architecture ? [] : ["host"]),
    ...A.filter(R.keys(CI_PARITY_POSTURE_ENV), (key) => proven.posture[key] !== parity.posture[key]),
  ]
);

/**
 * Decide, for each parity lane, whether a lane of the same attempt already
 * proved the same command under the same environment identity.
 *
 * **Details**
 *
 * A twin is a proven lane with the same command digest. The lane is reused
 * when a twin's environment digest equals the parity environment's; otherwise
 * it runs, and the decision names the differing components of the first twin.
 *
 * @param candidates - Lanes the parity battery would run.
 * @param proven - Lanes of the attempt that passed.
 * @param parity - Environment the parity battery runs under.
 * @returns One decision per candidate, in candidate order.
 * @category execution
 * @since 0.0.0
 */
export const decideParityLaneReuse = Effect.fn("Yeet.decideParityLaneReuse")(function* (
  candidates: ReadonlyArray<ParityLaneCandidate>,
  proven: ReadonlyArray<ProvenLane>,
  parity: ProofEnvironment
): Effect.fn.Return<ReadonlyArray<ParityLaneDecision>, YeetCommandError, Digest.Digest> {
  const provenDigests = yield* Effect.forEach(proven, (lane) =>
    Effect.map(proofCommandDigest(lane.commandText), (commandDigest) => ({ lane, commandDigest }))
  );
  return yield* Effect.forEach(
    candidates,
    Effect.fnUntraced(function* (candidate) {
      const commandDigest = yield* proofCommandDigest(candidate.commandText);
      const twins = A.filter(provenDigests, (entry) => entry.commandDigest === commandDigest);
      const exact = A.findFirst(twins, ({ lane }) => lane.environment.digest === parity.digest);
      const base = { laneId: candidate.laneId, commandDigest, environmentDigest: parity.digest };
      if (O.isSome(exact)) {
        return ParityLaneDecision.make({ ...base, reuse: true, provenBy: exact.value.lane.laneId, differences: [] });
      }
      return O.match(A.head(twins), {
        onNone: () => ParityLaneDecision.make({ ...base, reuse: false, reason: "no-proven-twin", differences: [] }),
        onSome: ({ lane }) =>
          ParityLaneDecision.make({
            ...base,
            reuse: false,
            reason: "environment-changed",
            provenBy: lane.laneId,
            differences: proofEnvironmentDifferences(lane.environment, parity),
          }),
      });
    })
  );
});

/**
 * Render the log line for one parity lane decision; a lane without a twin has none.
 *
 * @param decision - Outcome of the reuse check for one lane.
 * @returns The `[yeet] ci-parity` line, or none for a lane nothing proved.
 * @category formatting
 * @since 0.0.0
 */
export const renderParityLaneDecision = (decision: ParityLaneDecision): O.Option<string> => {
  const digests = `command ${Str.takeLeft(12)(decision.commandDigest)}, environment ${Str.takeLeft(12)(decision.environmentDigest)}`;
  if (decision.reuse) {
    return O.some(
      `[yeet] ci-parity: reusing ${decision.laneId}, proven by ${decision.provenBy ?? "?"} in this attempt (${digests})`
    );
  }
  return decision.reason === "environment-changed"
    ? O.some(
        `[yeet] ci-parity: not reusing ${decision.laneId}: environment differs from ${decision.provenBy ?? "?"} (${A.join(decision.differences, ", ")}; ${digests})`
      )
    : O.none();
};

/**
 * Plan the parity battery's lanes the way `beep ci local` would.
 *
 * @param cwd - Merge preview checkout the battery runs in.
 * @param plan - The battery's shape (`--affected`, base, branch).
 * @returns One candidate per default battery lane, with its command line.
 * @category utilities
 * @since 0.0.0
 */
export const ciParityLaneCandidates: {
  (plan: CiLocalStepPlan): (cwd: string) => ReadonlyArray<ParityLaneCandidate>;
  (cwd: string, plan: CiLocalStepPlan): ReadonlyArray<ParityLaneCandidate>;
} = dual(
  2,
  (cwd: string, plan: CiLocalStepPlan): ReadonlyArray<ParityLaneCandidate> =>
    A.map(A.zip(CI_LOCAL_DEFAULT_LANES, ciLocalStepsForTesting(cwd, CI_LOCAL_DEFAULT_LANES, plan)), ([laneId, step]) =>
      ParityLaneCandidate.make({ laneId, commandText: formatCommandLine(step.command, step.args) })
    )
);

/**
 * Collect the lanes of the attempt that passed, with their steps' environments.
 *
 * @param reports - Inner-lane reports of the attempt.
 * @param environments - Recorded environment of each proof step.
 * @returns Every passed lane whose step environment is known.
 * @category utilities
 * @since 0.0.0
 */
export const provenLanesForAttempt: {
  (
    environments: ReadonlyArray<ProofEnvironment>
  ): (reports: ReadonlyArray<QualityTaskLaneRunReport>) => ReadonlyArray<ProvenLane>;
  (
    reports: ReadonlyArray<QualityTaskLaneRunReport>,
    environments: ReadonlyArray<ProofEnvironment>
  ): ReadonlyArray<ProvenLane>;
} = dual(2, (reports: ReadonlyArray<QualityTaskLaneRunReport>, environments: ReadonlyArray<ProofEnvironment>) =>
  A.flatMap(reports, (report) =>
    pipe(
      O.flatMap(report.parentLaneId, (parentLaneId) =>
        A.findFirst(environments, (environment) => environment.stepId === parentLaneId)
      ),
      O.match({
        onNone: A.empty<ProvenLane>,
        onSome: (environment) =>
          A.getSomes(
            A.map(report.lanes, (lane) =>
              GithubCheckLaneRunStatus.is.passed(lane.status)
                ? O.map(O.filter(lane.commandText, Str.isNonEmpty), (commandText) =>
                    ProvenLane.make({ laneId: lane.id, commandText, environment })
                  )
                : O.none()
            )
          ),
      })
    )
  )
);

const environmentsPathForContext = (context: RepoRunContext) =>
  runArtifactPathForContext(context, PROOF_ENVIRONMENTS_FILE_NAME);

/**
 * Read the proof-step environments this attempt recorded.
 *
 * @param context - Run whose artifacts hold the record.
 * @returns The recorded environments; empty when none were recorded.
 * @category persistence
 * @since 0.0.0
 */
export const readProofEnvironments = Effect.fn("Yeet.readProofEnvironments")(function* (
  context: RepoRunContext
): Effect.fn.Return<
  ReadonlyArray<ProofEnvironment>,
  YeetCommandError,
  FileSystem.FileSystem | Path.Path | Digest.Digest
> {
  const fs = yield* FileSystem.FileSystem;
  const environmentsPathForContext1 = yield* environmentsPathForContext(context);
  const text = yield* fs.readFileString(environmentsPathForContext1).pipe(Effect.option);
  return pipe(
    text,
    O.flatMap(ProofEnvironmentRecordJson.decodeOption),
    O.match({ onNone: A.empty<ProofEnvironment>, onSome: (record) => record.environments })
  );
});

/**
 * Record one proof step's environment for this attempt, replacing any earlier
 * record for the same step.
 *
 * @param context - Run whose artifacts hold the record.
 * @param environment - Environment to record.
 * @returns Nothing once the record is written.
 * @category persistence
 * @since 0.0.0
 */
export const recordProofEnvironment = Effect.fn("Yeet.recordProofEnvironment")(function* (
  context: RepoRunContext,
  environment: ProofEnvironment
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path | Digest.Digest> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const recordPath = yield* environmentsPathForContext(context);
  const readProofEnvironments2 = yield* readProofEnvironments(context);
  const environments = A.append(
    A.filter(readProofEnvironments2, (recorded) => recorded.stepId !== environment.stepId),
    environment
  );
  const encoded = yield* ProofEnvironmentRecordJson.encode(
    ProofEnvironmentRecord.make({ schemaVersion: "proof-environments/v1", environments })
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to encode the proof environments.")));
  yield* fs
    .makeDirectory(path.dirname(recordPath), { recursive: true })
    .pipe(
      Effect.andThen(fs.writeFileString(recordPath, `${encoded}\n`)),
      Effect.mapError(YeetCommandError.new(`Failed to write the proof environments at ${recordPath}.`))
    );
});

/**
 * Drop the previous attempt's proof environments before a new attempt runs.
 *
 * @param context - Run whose record is removed.
 * @returns Nothing; a missing record is not an error.
 * @category persistence
 * @since 0.0.0
 */
export const clearProofEnvironments = Effect.fn("Yeet.clearProofEnvironments")(function* (context: RepoRunContext) {
  const fs = yield* FileSystem.FileSystem;
  const environmentsPathForContext3 = yield* environmentsPathForContext(context);
  yield* fs.remove(environmentsPathForContext3, { force: true }).pipe(Effect.ignore);
});

/**
 * Index recorded environments by step id, for the proof ledger's facts.
 *
 * @param environments - Recorded proof-step environments.
 * @returns Environment digest per proof step id.
 * @category utilities
 * @since 0.0.0
 */
export const proofEnvironmentDigests = (
  environments: ReadonlyArray<ProofEnvironment>
): HashMap.HashMap<string, string> =>
  HashMap.fromIterable(A.map(environments, (environment) => [environment.stepId, environment.digest] as const));
