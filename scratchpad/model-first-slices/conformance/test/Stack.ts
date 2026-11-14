import * as NodeServices from "@effect/platform-node/NodeServices";
import { Credential, headersFor } from "@proto/authority-host/Boundary/FixtureCredential";
import { PrincipalId } from "@proto/kernel/Ids";
import { IntakeContract } from "@proto/party-contract/IntakeApi.contract";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";

/** The deployed front (`CONFORMANCE_URL`), and the stage's service names (D37: one fixed stage). */
export const url = Config.String("CONFORMANCE_URL").pipe(Config.withDefault("http://127.0.0.1:18640"));
export const runnerService = "practice-mfs-conformance-default";
export const services = Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer, SecureRandom.layerWebCrypto);
/** The cluster's Postgres service (`POSTGRES_SERVICE`), which the deploy names. */
const postgresService = Config.String("POSTGRES_SERVICE").pipe(Config.withDefault(""));

/**
 * What the cases are registered with, read once through `Config` as the suite loads: a timeout
 * for every case (`CASE_TIMEOUT`), and which phase of the restore case runs (`RESTORE_PHASE`).
 */
export const registration = Effect.runSync(
  Config.all({
    caseTimeout: Config.option(Config.Number("CASE_TIMEOUT")),
    restorePhase: Config.option(Config.String("RESTORE_PHASE")),
  }).pipe(Effect.orDie),
);

/** A fresh suffix, so every run's keys are its own. */
export const fresh = (name: string) =>
  Effect.map(Effect.service(SecureRandom.SecureRandom), (random) => random.uuidV4()).pipe(
    Effect.flatten,
    Effect.map((id) => `${name}_${pipe(id, Str.slice(0, 8))}`),
  );
export const human = (principal: string) => ({
  headers: headersFor(Credential.cases.Human.make({ principal: PrincipalId.make(principal) })),
});

/** `docker <args>`, its stdout trimmed. Only ever run against this stack's own resources. */
export const docker = (...args: ReadonlyArray<string>) =>
  Effect.flatMap(Effect.service(ChildProcessSpawner), (spawner) => spawner.string(ChildProcess.make("docker", args))).pipe(
    Effect.map(Str.trim),
  );

/** The ids of this stack's running containers of a service. */
export const containersOf = (service: string) =>
  Effect.map(
    docker("ps", "--filter", `label=com.docker.swarm.service.name=${service}`, "--format", "{{.ID}}"),
    (out) => A.filter(Str.split(out, "\n"), Str.isNonEmpty),
  );

/** A query against the cluster's database, run inside the Postgres container. */
export const psql = (query: string) =>
  Effect.flatMap(Effect.flatMap(Effect.orDie(postgresService), containersOf), (ids) =>
    docker("exec", ids[0] ?? "", "psql", "-U", "postgres", "-d", "cluster", "-At", "-F", "|", "-c", query),
  );

// Phase 6: a row lock held from a session of the conformance's own, so a case can stop a write at
// a chosen point (a projection's checkpoint, a run's next commit, a commit already begun) without
// changing the model or the library. The lock changes no data, and is released by ending that
// session.
const LOCK_APP = "mfs-lock";

/**
 * In the background: wait, server side every 10 ms, until `ready` (a query) returns a row; then
 * lock the rows `rows` (a query on `alchemy_domain_objects`) FOR UPDATE and hold them until
 * {@link releaseLock}, or for `seconds`. Gives up after two minutes if `ready` never holds.
 */
export const holdLock: {
  (rows: string, seconds?: number): (ready: string) => ReturnType<typeof holdLockOn>;
  (ready: string, rows: string, seconds?: number): ReturnType<typeof holdLockOn>;
} = dual(
  (args: IArguments) => args.length === 3 || (args.length === 2 && P.isString(args[1])),
  (ready: string, rows: string, seconds = 300) => holdLockOn(ready, rows, seconds),
);
const holdLockOn = (ready: string, rows: string, seconds: number) =>
  Effect.flatMap(Effect.flatMap(Effect.orDie(postgresService), containersOf), (ids) =>
    docker(
      "exec", "-e", `PGAPPNAME=${LOCK_APP}`, ids[0] ?? "", "psql", "-U", "postgres", "-d", "cluster", "-At", "-c",
      `BEGIN; DO $$ DECLARE deadline timestamptz := clock_timestamp() + interval '120 seconds'; BEGIN LOOP EXIT WHEN EXISTS (${ready}); IF clock_timestamp() > deadline THEN RAISE EXCEPTION 'never ready'; END IF; PERFORM pg_sleep(0.01); END LOOP; END $$; ${rows} FOR UPDATE; SELECT pg_sleep(${seconds}); ROLLBACK;`,
    ),
  ).pipe(Effect.exit, Effect.forkChild);

/** How many table locks the lock session holds for its FOR UPDATE: "1" once it holds the rows. */
export const lockHeld = psql(
  `SELECT count(*) FROM pg_locks k JOIN pg_stat_activity a ON a.pid = k.pid WHERE a.application_name = '${LOCK_APP}' AND k.mode = 'RowShareLock'`,
);

/** The backends waiting on the lock session, with what they run. */
export const blockedByLock = psql(
  `SELECT a.pid, a.state, left(a.query, 120) FROM pg_stat_activity a, pg_stat_activity l WHERE l.application_name = '${LOCK_APP}' AND l.pid = ANY(pg_blocking_pids(a.pid))`,
);

/** End the backends waiting on the lock session, as a crash ends their connections. */
export const endBlocked = psql(
  `SELECT pg_terminate_backend(a.pid) FROM pg_stat_activity a, pg_stat_activity l WHERE l.application_name = '${LOCK_APP}' AND l.pid = ANY(pg_blocking_pids(a.pid))`,
);

/** End the lock session: its transaction rolls back, and the rows are free. */
export const releaseLock = psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = '${LOCK_APP}'`);

/** GET a route of the front, as JSON. */
export const get = Effect.fn("get")(function* <T>(path: string) {
  const client = yield* HttpClient.HttpClient;
  const front = yield* Effect.orDie(url);
  const response = yield* client.get(`${front}${path}`);
  const json = yield* response.json;
  return json as T;
});

/** Issue a grant as the org's owner, through the conformance-only control route. */
export const issue: {
  (holder: string, capability: string, org: string): (grant: string) => ReturnType<typeof get<{ readonly ok: boolean }>>;
  (grant: string, holder: string, capability: string, org: string): ReturnType<typeof get<{ readonly ok: boolean }>>;
} = dual(4, (grant: string, holder: string, capability: string, org: string) =>
  get<{ readonly ok: boolean }>(`/control/issue?grant=${grant}&holder=${holder}&capability=${capability}&org=${org}`),
);
/** Revoke a grant as the org's owner, through the conformance-only control route. */
export const revoke: {
  (org: string): (grant: string) => ReturnType<typeof get<{ readonly ok: boolean }>>;
  (grant: string, org: string): ReturnType<typeof get<{ readonly ok: boolean }>>;
} = dual(2, (grant: string, org: string) => get<{ readonly ok: boolean }>(`/control/revoke?grant=${grant}&org=${org}`));

/** A run's state, through the conformance-only read. */
export const runState = (run: string) => get<{ readonly _tag: string; readonly outcome?: string }>(`/runs-state?run=${encodeURIComponent(run)}`);

/** A poll gave up: `until` never held, and `last` is what it read last. */
export class NeverHeld extends S.TaggedError<NeverHeld, { readonly brand: unique symbol }>()("NeverHeld", {
  last: S.Unknown,
}) {}

/** Poll until `until` holds, or fail with `NeverHeld` after `times` tries 500 ms apart. */
export const eventually: {
  <A>(until: (a: A) => boolean, times?: number): <E, R>(read: Effect.Effect<A, E, R>) => Effect.Effect<A, E | NeverHeld, R>;
  <A, E, R>(read: Effect.Effect<A, E, R>, until: (a: A) => boolean, times?: number): Effect.Effect<A, E | NeverHeld, R>;
} = dual(
  (args: IArguments) => Effect.isEffect(args[0]),
  <A, E, R>(read: Effect.Effect<A, E, R>, until: (a: A) => boolean, times = 120): Effect.Effect<A, E | NeverHeld, R> =>
    read.pipe(
      Effect.repeat({ schedule: Schedule.spaced("500 millis"), until, times }),
      Effect.filterOrFail(until, (last) => NeverHeld.make({ last })),
    ),
);

/**
 * Kill every runner container, run `afterKill` (phase 6: end what a crash ends in Postgres), then
 * wait until swarm has two running again and they have taken their shards.
 */
export const killRunnersThen = Effect.fn("killRunnersThen")(function* <A, E, R>(afterKill: Effect.Effect<A, E, R>) {
  const before = yield* containersOf(runnerService);
  yield* docker("kill", ...before);
  const after = yield* afterKill;
  yield* eventually(containersOf(runnerService), (ids) => ids.length === 2 && A.every(ids, (id) => !A.contains(before, id)), 240);
  // The new runners must join the cluster and take their shards.
  yield* Effect.sleep("15 seconds");
  return { before, after };
});

/** Kill every runner container, then wait until swarm has two running again and the front answers. */
export const killRunners = Effect.map(killRunnersThen(Effect.void), ({ before }) => before);

/** The two contract clients, over the front. */
export const clients = Effect.gen(function* () {
  const front = yield* Effect.orDie(url);
  return {
    intake: yield* IntakeContract.clientHttp(`${front}/intake`),
    reviewer: yield* ReviewerContract.clientHttp(`${front}/reviewer`),
  };
});
