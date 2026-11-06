/**
 * Exact-match proof reuse for local GitHub-check lanes.
 *
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { $RepoCliId } from "@beep/identity/packages";
import { turboEnvExtendsAmbient } from "@beep/repo-cli-kit/cli/EnvConfig";
import { runCapturedStreams } from "@beep/repo-cli-kit/process/StepExec";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { LiteralKit } from "@beep/schema";
import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { adaptGitKitError } from "../../../internal/repo-run/GitExec.ts";
import { QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV, QUALITY_TASK_LANE_RUN_PARENT_ID_ENV } from "../Quality.schemas.ts";
import type { GithubCheckLaneSpec } from "../Quality.schemas.ts";

const $I = $RepoCliId.create("commands/Quality/internal/LaneProofReuse");

/**
 * Environment variable that carries the proof base into a lane battery.
 *
 * **Details**
 *
 * Yeet resolves its base ref once per run and passes the commit SHA here, so
 * every tier of one run identifies proofs against the same base. A ref name
 * (`origin/main`) is still accepted and resolved per battery.
 *
 * @category configuration
 */
export const LANE_PROOF_BASE_ENV = "BEEP_YEET_PROOF_BASE" as const;

const LANE_PROOF_MODE_ENV = "BEEP_YEET_LANE_PROOF_MODE" as const;

// The ref every local lane reads its base from (changeset-status `--since`,
// the `ci lane` affected shape, the Fallow base snapshot).
const LANE_BASE_REF = "origin/main" as const;

// Run bookkeeping a parent Yeet step adds to the battery environment: where the
// inner-lane report goes, which step the rows belong to, and the proof mode and
// base (the base enters the identity on its own). None of it changes a lane's
// verdict, and the parent id differs per tier, so hashing it would make every
// lane look changed between the cheap-gates and pre-push tiers of one run.
const LANE_PROOF_BOOKKEEPING_ENV = [
  QUALITY_TASK_LANE_RUN_ARTIFACT_PATH_ENV,
  QUALITY_TASK_LANE_RUN_PARENT_ID_ENV,
  LANE_PROOF_MODE_ENV,
  LANE_PROOF_BASE_ENV,
] as const;

// A pinned base is a full commit SHA; anything else is a ref to resolve.
const isPinnedBaseSha = S.is(S.String.check(S.isPattern(/^[0-9a-f]{40}$/u)));

/**
 * Read the base commit a parent Yeet run pinned for this battery.
 *
 * **Details**
 *
 * Present only when {@link LANE_PROOF_BASE_ENV} holds a full commit SHA. A ref
 * name means nothing was pinned and the battery resolves the ref itself.
 *
 * **Example** (Read the pinned base)
 *
 * ```ts
 * import { pinnedLaneProofBaseSha } from "@beep/repo-cli/test/Quality"
 * import * as O from "effect/Option"
 *
 * console.log(O.isOption(pinnedLaneProofBaseSha())) // true
 * ```
 *
 * @returns The pinned base SHA, or none when the base is a ref or unset.
 * @category configuration
 */
export const pinnedLaneProofBaseSha = (): O.Option<string> =>
  O.filter(O.fromUndefinedOr(Bun.env[LANE_PROOF_BASE_ENV]), isPinnedBaseSha);

const LaneProofMode = LiteralKit(["off", "shadow", "active"]);
type LaneProofMode = typeof LaneProofMode.Type;
const isLaneProofMode = S.is(LaneProofMode);
const ActiveLaneProofMode = LiteralKit(["shadow", "active"]);
// These lanes query live vulnerability data. A tree-exact record cannot prove
// that the external advisory set is still current, so they always run.
const NonReusableLaneProofId = LiteralKit(["quality:security", "repo-sanity:bun-audit"]);
const isNonReusableLaneProofId = S.is(NonReusableLaneProofId);

class LaneProofRecord extends S.Opaque<LaneProofRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    laneId: S.String,
    commandHash: S.String,
    inputHash: S.String,
    mergedTreeSha: S.String,
    headSha: S.String,
    baseSha: S.String,
    envProfileHash: S.String,
    durationMs: S.Natural,
    verifiedAt: S.String,
  }).pipe(
    $I.annoteSchema("LaneProofRecord", {
      description: "One exact-match reusable proof for a local GitHub-check lane.",
    })
  )
) {}

class LaneProofStore extends S.Opaque<LaneProofStore, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("yeet-lane-proofs/v2"),
    records: S.Array(LaneProofRecord),
  }).pipe(
    $I.annoteSchema("LaneProofStore", {
      description: "Durable exact-match proofs written after each successful local lane wave.",
    })
  )
) {}

class LaneProofGitError extends S.TaggedError<LaneProofGitError, { readonly brand: unique symbol }>(
  $I`LaneProofGitError`
)(
  "LaneProofGitError",
  { message: S.String },
  $I.annoteError<LaneProofGitError>("LaneProofGitError", {
    description: "A Git operation needed to identify a reusable lane proof failed.",
  })
) {}

class LaneProofIdentity extends S.Opaque<LaneProofIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    laneId: S.String,
    commandHash: S.String,
    inputHash: S.String,
    mergedTreeSha: S.String,
    headSha: S.String,
    baseSha: S.String,
    envProfileHash: S.String,
  }).pipe(
    $I.annoteSchema("LaneProofIdentity", {
      description: "Exact virtual-tree, command, head, base, and environment identity for one lane.",
    })
  )
) {}

/**
 * Prepared exact-match identities and prior records for one local lane battery.
 *
 * @category models
 */
export class LaneProofSession extends S.Opaque<LaneProofSession, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: ActiveLaneProofMode,
    path: S.String,
    records: S.Array(LaneProofRecord),
    identities: S.Array(LaneProofIdentity),
  }).pipe(
    $I.annoteSchema("LaneProofSession", {
      description: "Prepared proof-reuse session for one immutable virtual-tree snapshot.",
    })
  )
) {}

const hashText = Effect.fnUntraced(function* (value: string) {
  const crypto = yield* Digest.Digest;
  const digest1 = yield* crypto.digest(Digest.sha256, new TextEncoder().encode(value));
  return Hex.encode(digest1);
});

const stableRecordText = (value: Readonly<Record<string, string | undefined>>): string =>
  pipe(
    A.sortWith(
      A.map(R.toEntries(value), ([key, entry]) => ({ key, entry: entry ?? null })),
      (item: { readonly key: string; readonly entry: string | null }) => item.key,
      Order.String
    ),
    A.map(({ key, entry }) => `${key.length}:${key}=${entry === null ? "-" : `${entry.length}:${entry}`}`),
    A.join("\0")
  );

const laneCommandHash = (lane: GithubCheckLaneSpec) =>
  hashText(
    A.join(
      [
        lane.step.command,
        ...lane.step.args,
        stableRecordText(lane.step.env ?? {}),
        lane.step.useLocalEnv === true ? "local-env" : "ambient-env",
      ],
      "\0"
    )
  );

const inheritedEnvironment = (): Readonly<Record<string, string | undefined>> =>
  R.filter(Bun.env, (_, key) => !A.contains(LANE_PROOF_BOOKKEEPING_ENV, key));

const environmentProfileHash = Effect.fnUntraced(function* (lane: GithubCheckLaneSpec) {
  const inheritedEnvironmentHash =
    lane.step.useLocalEnv === true || turboEnvExtendsAmbient(lane.step.command, lane.step.args)
      ? yield* hashText(stableRecordText(inheritedEnvironment()))
      : undefined;
  return yield* hashText(
    stableRecordText({
      platform: yield* HostProcessPlatform,
      architecture: yield* HostProcessArchitecture,
      bunVersion: Bun.version,
      nodeVersion: process.version,
      inheritedEnvironmentHash,
      laneEnv: stableRecordText(lane.step.env ?? {}),
    })
  );
});

// Git runs as an async child so the virtual-tree hash of one battery never
// blocks the event loop that the battery's running lanes share.
const runGit = Effect.fnUntraced(function* (
  cwd: string,
  args: ReadonlyArray<string>,
  env?: Readonly<Record<string, string | undefined>>
) {
  const result = yield* runCapturedStreams({
    command: "git",
    args,
    cwd,
    ...(env === undefined ? {} : { env: { ...env } }),
    extendEnv: true,
    trim: true,
  }).pipe(Effect.mapError(() => LaneProofGitError.make({ message: `Unable to run git ${A.join(args, " ")}.` })));
  return result.exitCode === 0 ? result.stdout : yield* LaneProofGitError.make({ message: result.stderr });
});

const laneProofGitErrorAdapter = {
  onSpawnFailure: (commandLine: string) => () => LaneProofGitError.make({ message: `Unable to run ${commandLine}.` }),
  onNonZeroExit: ({ output }: { readonly output: string }) => LaneProofGitError.make({ message: output }),
  onTruncated: O.none(),
};

// A leaf `Git` instance, as `virtualTreeSha`: the proof-environment reader runs without a `Git` service.
const revParseLaneRef = (repoRoot: string, ref: string) =>
  Effect.flatMap(Git.make, (git) => git.revParse(repoRoot, ref)).pipe(
    Effect.mapError(adaptGitKitError(GitCommand.revParse(ref), laneProofGitErrorAdapter))
  );

const virtualTreeSha = Effect.fn("LaneProofReuse.virtualTreeSha")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const crypto = yield* SecureRandom.SecureRandom;
  // A leaf instance: Yeet's proof-environment reader calls this without a `Git` service in its context.
  const git = yield* Git.make;
  const indexName = `yeet-lane-proof-index-${yield* crypto.uuidV4()}`;
  // `--path-format=absolute` answers the absolute path, so it needs no resolve against the root.
  const indexPath = yield* git
    .gitDir(repoRoot, { path: indexName })
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.gitDir(indexName), laneProofGitErrorAdapter)));
  const indexEnv = { GIT_INDEX_FILE: indexPath };
  return yield* Effect.acquireUseRelease(
    Effect.succeed(indexPath),
    Effect.fnUntraced(function* () {
      // KEEP (D-19): per-call GIT_INDEX_FILE for a temporary index; the kit reads its env once at make (#106b).
      yield* runGit(repoRoot, ["read-tree", "HEAD"], indexEnv);
      // KEEP (D-19): as read-tree, the temporary index's GIT_INDEX_FILE.
      yield* runGit(repoRoot, ["add", "-A", "--", "."], indexEnv);
      // KEEP (D-19): as read-tree, the temporary index's GIT_INDEX_FILE.
      return yield* runGit(repoRoot, ["write-tree"], indexEnv);
    }),
    (temporaryIndex) => fs.remove(temporaryIndex).pipe(Effect.ignore)
  );
});

/**
 * Hash a checkout's virtual tree: `HEAD` plus every non-ignored change, read
 * through a temporary index so the real index is never touched.
 *
 * @param repoRoot - Checkout to identify.
 * @returns The tree object id `git write-tree` produced.
 * @category diagnostics
 */
export const laneProofVirtualTreeSha = virtualTreeSha;

const laneProofMode = (): LaneProofMode => {
  const candidate = Bun.env[LANE_PROOF_MODE_ENV] ?? "off";
  return isLaneProofMode(candidate) ? candidate : "off";
};

const shortSha = Str.takeLeft(12);

// A pinned base is the commit the parent run fetched. Lanes still read
// `origin/main` by name, so when another fetch in the shared clone moved that
// ref, the lanes would prove against a base the identity does not name.
const resolveProofBase = Effect.fnUntraced(function* (repoRoot: string) {
  const pinned = pinnedLaneProofBaseSha();
  if (O.isNone(pinned)) {
    const pinned = yield* revParseLaneRef(repoRoot, Bun.env[LANE_PROOF_BASE_ENV] ?? LANE_BASE_REF);
    return O.some(pinned);
  }
  const laneBase = yield* revParseLaneRef(repoRoot, LANE_BASE_REF);
  if (laneBase === pinned.value) {
    return pinned;
  }
  yield* Console.log(
    `[lane-proof] reuse disabled: ${LANE_BASE_REF} moved from the run's pinned base ${shortSha(pinned.value)} to ${shortSha(laneBase)}`
  );
  return O.none<string>();
});

const LaneProofStoreJson = JsonStringCodec(LaneProofStore);

const loadStore = Effect.fn("LaneProofReuse.loadStore")(function* (storePath: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFileString(storePath)
    .pipe(Effect.map(LaneProofStoreJson.decodeOption), Effect.orElseSucceed(O.none<LaneProofStore>));
});

/**
 * Prepare exact identities for one local lane battery.
 *
 * @category use-cases
 */
export const prepareLaneProofSession = Effect.fn("LaneProofReuse.prepareSession")(function* (
  lanes: ReadonlyArray<GithubCheckLaneSpec>,
  modeOverride?: LaneProofSession["mode"]
) {
  const mode = modeOverride ?? laneProofMode();
  // Lanes that can never be reused never pay for the virtual-tree hash.
  const reusableLanes = A.filter(lanes, (lane) => !isNonReusableLaneProofId(lane.id));
  const first = A.head(reusableLanes);
  if (mode === "off" || O.isNone(first)) {
    return O.none<LaneProofSession>();
  }
  if (A.some(reusableLanes, (lane) => lane.step.cwd !== first.value.step.cwd)) {
    yield* Console.log("[lane-proof] reuse disabled: the battery's lanes run from more than one directory");
    return O.none<LaneProofSession>();
  }

  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = first.value.step.cwd;
  const storePath = path.join(repoRoot, ".beep", "yeet", "lane-proofs.json");
  const prepared = yield* Effect.all(
    {
      baseSha: resolveProofBase(repoRoot),
      headSha: revParseLaneRef(repoRoot, "HEAD"),
      tree: virtualTreeSha(repoRoot),
    },
    { concurrency: "unbounded" }
  ).pipe(
    Effect.tapError((error) =>
      Console.log(`[lane-proof] reuse disabled: could not identify the lane tree (${error.message})`)
    ),
    Effect.option
  );
  if (O.isNone(prepared) || O.isNone(prepared.value.baseSha)) return O.none<LaneProofSession>();

  const { headSha, tree } = prepared.value;
  const baseSha = prepared.value.baseSha.value;
  const store = yield* loadStore(storePath);
  const identities = yield* Effect.forEach(
    reusableLanes,
    Effect.fnUntraced(function* (lane) {
      return LaneProofIdentity.make({
        laneId: lane.id,
        commandHash: yield* laneCommandHash(lane),
        inputHash: yield* hashText(`${lane.id}\0${tree}`),
        mergedTreeSha: tree,
        headSha,
        baseSha,
        envProfileHash: yield* environmentProfileHash(lane),
      });
    }),
    { concurrency: 1 }
  );
  yield* fs.makeDirectory(path.dirname(storePath), { recursive: true }).pipe(Effect.ignore);
  return O.some(
    LaneProofSession.make({
      mode,
      path: storePath,
      records: pipe(
        store,
        O.map((value) => value.records),
        O.getOrElse(A.empty<LaneProofRecord>)
      ),
      identities,
    })
  );
});

/**
 * Why one lane's proof identity differs from another identity of the same lane.
 *
 * **Example** (Name a refusal reason)
 *
 * ```ts
 * import { LaneProofRefusalReason } from "@beep/repo-cli/test/Quality"
 *
 * console.log(LaneProofRefusalReason.is["base-moved"]("base-moved")) // true
 * ```
 *
 * @category models
 */
export const LaneProofRefusalReason = LiteralKit([
  "command-changed",
  "tree-changed",
  "head-moved",
  "base-moved",
  "environment-changed",
]).pipe(
  $I.annoteSchema("LaneProofRefusalReason", {
    description: "One identity component that stops a lane proof from being reused or recorded.",
  })
);

/**
 * Type of {@link LaneProofRefusalReason}.
 *
 * @category models
 */
export type LaneProofRefusalReason = typeof LaneProofRefusalReason.Type;

/**
 * A prior lane proof that exists but does not match the current identity.
 *
 * **Example** (Describe a moved base)
 *
 * ```ts
 * import { LaneProofRefusal } from "@beep/repo-cli/test/Quality"
 *
 * const refusal = LaneProofRefusal.make({
 *   laneId: "fallow:health",
 *   reasons: ["base-moved"],
 *   priorBaseSha: "a".repeat(40),
 *   currentBaseSha: "b".repeat(40),
 * })
 * console.log(refusal.reasons) // ["base-moved"]
 * ```
 *
 * @category models
 */
export class LaneProofRefusal extends S.Opaque<LaneProofRefusal, { readonly brand: unique symbol }>()(
  S.Struct({
    laneId: S.String,
    reasons: S.NonEmptyArray(LaneProofRefusalReason),
    priorBaseSha: S.String,
    currentBaseSha: S.String,
  }).pipe(
    $I.annoteSchema("LaneProofRefusal", {
      description: "The identity components that differ between a lane's prior proof and its current identity.",
    })
  )
) {}

type LaneProofIdentityFields = Omit<LaneProofRecord, "brand" | "durationMs" | "verifiedAt">;

const laneProofRefusalReasons = (
  prior: LaneProofIdentityFields,
  current: LaneProofIdentityFields
): ReadonlyArray<LaneProofRefusalReason> =>
  A.getSomes([
    O.liftPredicate(LaneProofRefusalReason.Enum["command-changed"], () => prior.commandHash !== current.commandHash),
    O.liftPredicate(
      LaneProofRefusalReason.Enum["tree-changed"],
      () => prior.inputHash !== current.inputHash || prior.mergedTreeSha !== current.mergedTreeSha
    ),
    O.liftPredicate(LaneProofRefusalReason.Enum["head-moved"], () => prior.headSha !== current.headSha),
    O.liftPredicate(LaneProofRefusalReason.Enum["base-moved"], () => prior.baseSha !== current.baseSha),
    O.liftPredicate(
      LaneProofRefusalReason.Enum["environment-changed"],
      () => prior.envProfileHash !== current.envProfileHash
    ),
  ]);

const laneProofRefusal = (
  prior: LaneProofIdentityFields,
  current: LaneProofIdentityFields
): O.Option<LaneProofRefusal> =>
  pipe(
    laneProofRefusalReasons(prior, current),
    O.liftPredicate(A.isReadonlyArrayNonEmpty),
    O.map((reasons) =>
      LaneProofRefusal.make({
        laneId: current.laneId,
        reasons,
        priorBaseSha: prior.baseSha,
        currentBaseSha: current.baseSha,
      })
    )
  );

const identityMatchesIdentity = (left: LaneProofIdentityFields, right: LaneProofIdentityFields): boolean =>
  left.laneId === right.laneId && O.isNone(laneProofRefusal(left, right));

const recordMatchesIdentity = (record: LaneProofRecord, identity: LaneProofIdentityFields): boolean =>
  identityMatchesIdentity(record, identity);

const renderRefusalReasons = (refusal: LaneProofRefusal): string =>
  A.join(
    A.map(refusal.reasons, (reason) =>
      LaneProofRefusalReason.is["base-moved"](reason)
        ? `base moved (${shortSha(refusal.priorBaseSha)} -> ${shortSha(refusal.currentBaseSha)})`
        : Str.replaceAll("-", " ")(reason)
    ),
    ", "
  );

/**
 * Render the log line for a prior lane proof that was not reused.
 *
 * **Example** (Render a moved-base refusal)
 *
 * ```ts
 * import { LaneProofRefusal, renderLaneProofRefusal } from "@beep/repo-cli/test/Quality"
 *
 * const refusal = LaneProofRefusal.make({
 *   laneId: "fallow:health",
 *   reasons: ["base-moved", "environment-changed"],
 *   priorBaseSha: "a".repeat(40),
 *   currentBaseSha: "b".repeat(40),
 * })
 * console.log(renderLaneProofRefusal(refusal))
 * // [lane-proof] not reusing fallow:health: base moved (aaaaaaaaaaaa -> bbbbbbbbbbbb), environment changed
 * ```
 *
 * @param refusal - The refused prior proof.
 * @returns One `[lane-proof]` log line naming every differing component.
 * @category formatting
 */
export const renderLaneProofRefusal = (refusal: LaneProofRefusal): string =>
  `[lane-proof] not reusing ${refusal.laneId}: ${renderRefusalReasons(refusal)}`;

/**
 * Explain why a lane with a prior proof in the store will not reuse it.
 *
 * **Details**
 *
 * Returns none when the lane has no prior proof (nothing was refused) or when
 * its proof is reusable.
 *
 * @category diagnostics
 */
export const explainLaneProofRefusal: {
  (laneId: string): (session: LaneProofSession) => O.Option<LaneProofRefusal>;
  (session: LaneProofSession, laneId: string): O.Option<LaneProofRefusal>;
} = dual(
  2,
  (session: LaneProofSession, laneId: string): O.Option<LaneProofRefusal> =>
    pipe(
      O.all({
        identity: A.findFirst(session.identities, (identity) => identity.laneId === laneId),
        record: A.findFirst(session.records, (record) => record.laneId === laneId),
      }),
      O.flatMap(({ identity, record }) => laneProofRefusal(record, identity))
    )
);

/**
 * Test whether one lane has an exact reusable proof in the prepared session.
 *
 * @category predicates
 */
export const hasReusableLaneProof: {
  (laneId: string): (session: LaneProofSession) => boolean;
  (session: LaneProofSession, laneId: string): boolean;
} = dual(2, (session: LaneProofSession, laneId: string): boolean =>
  O.exists(
    A.findFirst(session.identities, (identity) => identity.laneId === laneId),
    (identity) => A.some(session.records, (record) => recordMatchesIdentity(record, identity))
  )
);

/**
 * Atomically merge successful lane results into the durable proof store.
 *
 * **Details**
 *
 * A proof is written only when the lane's identity at the start of the run
 * still matches `refreshed`, the session prepared after the run. That is the
 * moved-tree fence: a lane battery that changed a non-ignored file persists
 * nothing. A caller that already holds the post-run session passes it as
 * `refreshed` so one virtual-tree hash serves the fence and the next battery;
 * without it this function prepares one for the successful lanes.
 *
 * @category persistence
 */
export const persistLaneProofs = Effect.fn("LaneProofReuse.persist")(function* (
  session: LaneProofSession,
  successes: ReadonlyArray<readonly [lane: GithubCheckLaneSpec, durationMs: number]>,
  refreshed?: LaneProofSession
) {
  if (A.isReadonlyArrayEmpty(successes)) return;
  const current =
    refreshed === undefined
      ? yield* prepareLaneProofSession(
          A.map(successes, ([lane]) => lane),
          session.mode
        )
      : O.some(refreshed);
  if (O.isNone(current)) return;
  const refreshedSession = current.value;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const verifiedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const identified = A.getSomes(
    A.map(successes, ([lane, durationMs]) =>
      O.all({
        durationMs: O.some(durationMs),
        original: A.findFirst(session.identities, (identity) => identity.laneId === lane.id),
        refreshed: A.findFirst(refreshedSession.identities, (identity) => identity.laneId === lane.id),
      })
    )
  );
  yield* Effect.forEach(
    A.getSomes(A.map(identified, ({ original, refreshed: current }) => laneProofRefusal(original, current))),
    (refusal) =>
      Console.log(`[lane-proof] not recording ${refusal.laneId}: ${renderRefusalReasons(refusal)} while it ran`),
    { discard: true }
  );
  const replacements = A.map(
    A.filter(identified, ({ original, refreshed: current }) => identityMatchesIdentity(original, current)),
    ({ durationMs, refreshed: identity }) =>
      LaneProofRecord.make({
        ...identity,
        durationMs: S.Natural.make(Math.max(0, Math.round(durationMs))),
        verifiedAt,
      })
  );
  if (A.isReadonlyArrayEmpty(replacements)) return;
  const replacementIds = A.map(replacements, (record) => record.laneId);
  const records = A.appendAll(
    A.filter(refreshedSession.records, (record) => !A.contains(replacementIds, record.laneId)),
    replacements
  );
  const encoded = yield* LaneProofStoreJson.encode(
    LaneProofStore.make({ schemaVersion: "yeet-lane-proofs/v2", records })
  );
  const crypto = yield* SecureRandom.SecureRandom;
  const temporaryPath = `${refreshedSession.path}.${yield* crypto.uuidV4()}.tmp`;
  yield* fs.makeDirectory(path.dirname(refreshedSession.path), { recursive: true });
  yield* fs.writeFileString(temporaryPath, `${encoded}\n`);
  yield* fs.rename(temporaryPath, refreshedSession.path);
});
