/**
 * Exact-match proof reuse for local GitHub-check lanes.
 *
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { DateTime, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Encoding from "effect/Encoding";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { turboEnvExtendsAmbient } from "../../../internal/cli/EnvConfig.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import type { GithubCheckLaneSpec } from "../Quality.schemas.ts";

const $I = $RepoCliId.create("commands/Quality/internal/LaneProofReuse");

const LaneProofMode = LiteralKit(["off", "shadow", "active"]);
type LaneProofMode = typeof LaneProofMode.Type;
const isLaneProofMode = S.is(LaneProofMode);
const ActiveLaneProofMode = LiteralKit(["shadow", "active"]);
// These lanes query live vulnerability data. A tree-exact record cannot prove
// that the external advisory set is still current, so they always run.
const NonReusableLaneProofId = LiteralKit(["quality:security", "repo-sanity:bun-audit"]);
const isNonReusableLaneProofId = S.is(NonReusableLaneProofId);

class LaneProofRecord extends S.Class<LaneProofRecord>($I`LaneProofRecord`)(
  {
    laneId: S.String,
    commandHash: S.String,
    inputHash: S.String,
    mergedTreeSha: S.String,
    headSha: S.String,
    baseSha: S.String,
    envProfileHash: S.String,
    durationMs: NonNegativeInt,
    verifiedAt: S.String,
  },
  $I.annote("LaneProofRecord", {
    description: "One exact-match reusable proof for a local GitHub-check lane.",
  })
) {}

class LaneProofStore extends S.Class<LaneProofStore>($I`LaneProofStore`)(
  {
    schemaVersion: S.Literal("yeet-lane-proofs/v2"),
    records: S.Array(LaneProofRecord),
  },
  $I.annote("LaneProofStore", {
    description: "Durable exact-match proofs written after each successful local lane wave.",
  })
) {}

class LaneProofGitError extends S.TaggedError<LaneProofGitError>($I`LaneProofGitError`)(
  "LaneProofGitError",
  { message: S.String },
  $I.annoteError<LaneProofGitError>("LaneProofGitError", {
    description: "A Git operation needed to identify a reusable lane proof failed.",
  })
) {}

class LaneProofIdentity extends S.Class<LaneProofIdentity>($I`LaneProofIdentity`)(
  {
    laneId: S.String,
    commandHash: S.String,
    inputHash: S.String,
    mergedTreeSha: S.String,
    headSha: S.String,
    baseSha: S.String,
    envProfileHash: S.String,
  },
  $I.annote("LaneProofIdentity", {
    description: "Exact virtual-tree, command, head, base, and environment identity for one lane.",
  })
) {}

/**
 * Prepared exact-match identities and prior records for one local lane battery.
 *
 * @category models
 */
export class LaneProofSession extends S.Class<LaneProofSession>($I`LaneProofSession`)(
  {
    mode: ActiveLaneProofMode,
    path: S.String,
    records: S.Array(LaneProofRecord),
    identities: S.Array(LaneProofIdentity),
  },
  $I.annote("LaneProofSession", {
    description: "Prepared proof-reuse session for one immutable virtual-tree snapshot.",
  })
) {}

const hashText = Effect.fnUntraced(function* (value: string) {
  const crypto = yield* Crypto.Crypto;
  return Encoding.encodeHex(
    yield* crypto
      .digest("SHA-256", new TextEncoder().encode(value))
      .pipe(Effect.mapError(() => LaneProofGitError.make({ message: "Failed to hash lane-proof identity." })))
  );
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

const environmentProfileHash = Effect.fnUntraced(function* (lane: GithubCheckLaneSpec) {
  const inheritedEnvironmentHash =
    lane.step.useLocalEnv === true || turboEnvExtendsAmbient(lane.step.command, lane.step.args)
      ? yield* hashText(stableRecordText(Bun.env))
      : undefined;
  return yield* hashText(
    stableRecordText({
      platform: process.platform,
      architecture: process.arch,
      bunVersion: Bun.version,
      nodeVersion: process.version,
      inheritedEnvironmentHash,
      laneEnv: stableRecordText(lane.step.env ?? {}),
    })
  );
});

const runGit = (
  cwd: string,
  args: ReadonlyArray<string>,
  env?: Readonly<Record<string, string | undefined>>
): Effect.Effect<string, LaneProofGitError> =>
  Effect.try({
    try: () =>
      Bun.spawnSync(["git", ...args], {
        cwd,
        env: { ...Bun.env, ...env },
        stderr: "pipe",
        stdout: "pipe",
      }),
    catch: () => LaneProofGitError.make({ message: `Unable to run git ${A.join(args, " ")}.` }),
  }).pipe(
    Effect.flatMap((result) =>
      result.exitCode === 0
        ? Effect.succeed(result.stdout.toString().trim())
        : Effect.fail(LaneProofGitError.make({ message: result.stderr.toString().trim() }))
    )
  );

const virtualTreeSha = Effect.fn("LaneProofReuse.virtualTreeSha")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const crypto = yield* Crypto.Crypto;
  const indexPath = path.resolve(
    repoRoot,
    yield* runGit(repoRoot, [
      "rev-parse",
      "--git-path",
      `yeet-lane-proof-index-${yield* crypto.randomUUIDv4.pipe(Effect.mapError(() => LaneProofGitError.make({ message: "Failed to create lane-proof index identity." })))}`,
    ])
  );
  const indexEnv = { GIT_INDEX_FILE: indexPath };
  return yield* Effect.acquireUseRelease(
    Effect.succeed(indexPath),
    Effect.fnUntraced(function* () {
      yield* runGit(repoRoot, ["read-tree", "HEAD"], indexEnv);
      yield* runGit(repoRoot, ["add", "-A", "--", "."], indexEnv);
      return yield* runGit(repoRoot, ["write-tree"], indexEnv);
    }),
    (temporaryIndex) => fs.remove(temporaryIndex).pipe(Effect.ignore)
  );
});

const laneProofMode = (): LaneProofMode => {
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
  const candidate = Bun.env.BEEP_YEET_LANE_PROOF_MODE ?? "off";
  return isLaneProofMode(candidate) ? candidate : "off";
};

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
  const first = A.head(lanes);
  if (mode === "off" || O.isNone(first) || A.some(lanes, (lane) => lane.step.cwd !== first.value.step.cwd)) {
    return O.none<LaneProofSession>();
  }

  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = first.value.step.cwd;
  const storePath = path.join(repoRoot, ".beep", "yeet", "lane-proofs.json");
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Declared in turbo.json global.passThroughEnv.
  const proofBase = Bun.env.BEEP_YEET_PROOF_BASE ?? "origin/main";
  const prepared = yield* Effect.all({
    baseSha: runGit(repoRoot, ["rev-parse", proofBase]),
    headSha: runGit(repoRoot, ["rev-parse", "HEAD"]),
  }).pipe(Effect.option);
  if (O.isNone(prepared)) return O.none<LaneProofSession>();

  const tree = yield* virtualTreeSha(repoRoot).pipe(Effect.option);
  if (O.isNone(tree)) return O.none<LaneProofSession>();
  const store = yield* loadStore(storePath);
  const identities = yield* Effect.forEach(
    A.filter(lanes, (lane) => !isNonReusableLaneProofId(lane.id)),
    Effect.fnUntraced(function* (lane) {
      return LaneProofIdentity.make({
        laneId: lane.id,
        commandHash: yield* laneCommandHash(lane),
        inputHash: yield* hashText(`${lane.id}\0${tree.value}`),
        mergedTreeSha: tree.value,
        headSha: prepared.value.headSha,
        baseSha: prepared.value.baseSha,
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

const identityMatchesIdentity = (
  left: Omit<LaneProofRecord, "durationMs" | "verifiedAt">,
  right: Omit<LaneProofRecord, "durationMs" | "verifiedAt">
): boolean =>
  left.laneId === right.laneId &&
  left.commandHash === right.commandHash &&
  left.inputHash === right.inputHash &&
  left.mergedTreeSha === right.mergedTreeSha &&
  left.headSha === right.headSha &&
  left.baseSha === right.baseSha &&
  left.envProfileHash === right.envProfileHash;

const recordMatchesIdentity = (
  record: LaneProofRecord,
  identity: Omit<LaneProofRecord, "durationMs" | "verifiedAt">
): boolean => identityMatchesIdentity(record, identity);

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
 * @category persistence
 */
export const persistLaneProofs = Effect.fn("LaneProofReuse.persist")(function* (
  session: LaneProofSession,
  successes: ReadonlyArray<readonly [lane: GithubCheckLaneSpec, durationMs: number]>
) {
  if (A.isReadonlyArrayEmpty(successes)) return;
  const refreshed = yield* prepareLaneProofSession(
    A.map(successes, ([lane]) => lane),
    session.mode
  );
  if (O.isNone(refreshed)) return;
  const refreshedSession = refreshed.value;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const verifiedAt = yield* DateTime.now.pipe(Effect.map(DateTime.formatIso));
  const replacements = A.getSomes(
    A.map(successes, ([lane, durationMs]) =>
      pipe(
        O.all({
          original: A.findFirst(session.identities, (identity) => identity.laneId === lane.id),
          refreshed: A.findFirst(refreshedSession.identities, (identity) => identity.laneId === lane.id),
        }),
        O.filter(({ original, refreshed: current }) => identityMatchesIdentity(original, current)),
        O.map(({ refreshed: identity }) =>
          LaneProofRecord.make({
            ...identity,
            durationMs: NonNegativeInt.make(Math.max(0, Math.round(durationMs))),
            verifiedAt,
          })
        )
      )
    )
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
  const crypto = yield* Crypto.Crypto;
  const temporaryPath = `${refreshedSession.path}.${yield* crypto.randomUUIDv4.pipe(Effect.mapError(() => LaneProofGitError.make({ message: "Failed to create lane-proof staging identity." })))}.tmp`;
  yield* fs.makeDirectory(path.dirname(refreshedSession.path), { recursive: true });
  yield* fs.writeFileString(temporaryPath, `${encoded}\n`);
  yield* fs.rename(temporaryPath, refreshedSession.path);
});
