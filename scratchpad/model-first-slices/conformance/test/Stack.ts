import * as NodeServices from "@effect/platform-node/NodeServices";
import { Credential, headersFor } from "@proto/authority-host/Boundary/FixtureCredential";
import { PrincipalId } from "@proto/kernel/Ids";
import { IntakeContract } from "@proto/party-contract/IntakeApi.contract";
import { ReviewerContract } from "@proto/party-contract/ReviewerApi.contract";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Schedule from "effect/Schedule";
import * as Str from "effect/String";

/** The deployed front, and the stage's service names (D37: one fixed stage). */
export const url = process.env.CONFORMANCE_URL ?? "http://127.0.0.1:18640";
export const runnerService = "practice-mfs-conformance-default";
export const services = Layer.mergeAll(FetchHttpClient.layer, NodeServices.layer);

/** A fresh suffix, so every run's keys are its own. */
export const fresh = (name: string) => `${name}_${crypto.randomUUID().slice(0, 8)}`;
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
  Effect.flatMap(containersOf(process.env.POSTGRES_SERVICE ?? ""), (ids) =>
    docker("exec", ids[0] ?? "", "psql", "-U", "postgres", "-d", "cluster", "-At", "-F", "|", "-c", query),
  );

/** GET a route of the front, as JSON. */
export const get = <T>(path: string) =>
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient;
    const response = yield* client.get(`${url}${path}`);
    return (yield* response.json) as T;
  });

/** Issue a grant as the org's owner, through the conformance-only control route. */
export const issue = (grant: string, holder: string, capability: string, org: string) =>
  get<{ readonly ok: boolean }>(`/control/issue?grant=${grant}&holder=${holder}&capability=${capability}&org=${org}`);
export const revoke = (grant: string, org: string) => get<{ readonly ok: boolean }>(`/control/revoke?grant=${grant}&org=${org}`);

/** A run's state, through the conformance-only read. */
export const runState = (run: string) => get<{ readonly _tag: string; readonly outcome?: string }>(`/runs-state?run=${encodeURIComponent(run)}`);

/** Poll until `until` holds, or fail after `times` tries 500 ms apart. */
export const eventually = <A, E, R>(read: Effect.Effect<A, E, R>, until: (a: A) => boolean, times = 120) =>
  read.pipe(
    Effect.repeat({ schedule: Schedule.spaced("500 millis"), until, times }),
    Effect.filterOrFail(until, (last) => new Error(`never held; last: ${JSON.stringify(last)}`)),
  );

/** Kill every runner container, then wait until swarm has two running again and the front answers. */
export const killRunners = Effect.gen(function* () {
  const before = yield* containersOf(runnerService);
  yield* docker("kill", ...before);
  yield* eventually(containersOf(runnerService), (ids) => ids.length === 2 && A.every(ids, (id) => !A.contains(before, id)), 240);
  // The new runners must join the cluster and take their shards.
  yield* Effect.sleep("15 seconds");
  return before;
});

/** The two contract clients, over the front. */
export const clients = Effect.gen(function* () {
  return {
    intake: yield* IntakeContract.clientHttp(`${url}/intake`),
    reviewer: yield* ReviewerContract.clientHttp(`${url}/reviewer`),
  };
});
