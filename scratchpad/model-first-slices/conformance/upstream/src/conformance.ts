// Ported from alchemy-run/alchemy packages/integration-tests/test/Domain/conformance/conformance.ts
// at 33c10dd55f (2.0.0-beta.87), adapted to this repository's Effect rules; behaviour unchanged.
/**
 * The cases every Domain platform passes, driven over HTTP against a front
 * serving {@link app} over the conformance model. Each case uses keys of
 * its own, unique to the run, so a retried or repeated run starts fresh.
 */
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { identity, pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Socket from "effect/socket/Socket";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { ConformanceApi } from "./model.ts";

/** What every case reads from the runner, beside what the front's URL needs. */
type CaseServices = HttpClient.HttpClient | SecureRandom.SecureRandom;

/** How a platform's test runner registers one case. */
type TestFn<UR> = <E>(
  name: string,
  effect: Effect.Effect<void, E, CaseServices | UR>,
  options?: { readonly timeout?: number; readonly tags?: ReadonlyArray<string> },
) => void;

export interface ConformanceOptions<UE, UR> {
  readonly test: TestFn<UR>;
  /** The front's base URL, once it is deployed. */
  readonly url: Effect.Effect<string, UE, UR>;
  /** Where the platform runs: on this machine, or in a cloud. */
  readonly kind: "local" | "live";
  /** How long a case waits for asynchronous work (deliveries, sagas, timers). */
  readonly within?: number;
}

/** A route of the front answered with a status other than 200. */
class UnexpectedStatus extends S.TaggedError<UnexpectedStatus, { readonly brand: unique symbol }>()("UnexpectedStatus", {
  path: S.String,
  status: S.Int,
  message: S.String,
}) {}

const fresh = (name: string) =>
  Effect.flatMap(Effect.service(SecureRandom.SecureRandom), (random) => random.uuidV4()).pipe(
    Effect.map((uuid) => `${name}-${pipe(uuid, Str.slice(0, 8))}`),
  );

const get = Effect.fn("get")(function* <T>(base: string, path: string) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client.get(`${base}${path}`);
  if (response.status !== 200) {
    const body = yield* response.text;
    return yield* UnexpectedStatus.make({
      path,
      status: response.status,
      message: `${path} answered ${response.status}: ${body}`,
    });
  }
  return (yield* response.json) as T;
});

/** Wait for the front to serve. */
export const waitForReady = (url: string) =>
  get<unknown>(url, "/ready").pipe(
    Effect.mapError(() => "not ready"),
    Effect.retry({ schedule: Schedule.spaced("3 seconds"), times: 60 }),
    Effect.ignore,
  );

export const conformance = <UE, UR>({ test, url, kind, within = 30_000 }: ConformanceOptions<UE, UR>) => {
  const options = { timeout: 120_000, tags: [kind] };
  /** GET a route of the front. */
  const call = <T>(path: string) => Effect.flatMap(url, (base) => get<T>(base, path));
  const eventually = <T>(path: string, until: (value: T) => boolean) =>
    call<T>(path).pipe(
      Effect.repeat({
        schedule: Schedule.spaced("500 millis"),
        until,
        times: Math.ceil(within / 500),
      }),
    );

  test(
    "a command commits and replies with the new state",
    Effect.gen(function* () {
      const id = yield* fresh("commit");
      const first = yield* call(`/increment/${id}?by=2`);
      expect(first).toMatchObject({ accepted: 2 });
      const second = yield* call(`/increment/${id}?by=3`);
      expect(second).toMatchObject({ accepted: 5 });
      const counter = yield* call(`/counter/${id}`);
      expect(counter).toEqual({ total: 5 });
    }),
    options,
  );

  test(
    "a live read is pushed over a WebSocket",
    Layer.build(Socket.layerWebSocketConstructorGlobal).pipe(
      Effect.flatMap((sockets) =>
        Effect.gen(function* () {
          const id = yield* fresh("live");
          const base = yield* url;
          // A platform that can't hold the read's socket answers 501, and the
          // client gives up instead of falling back to polling.
          const api = yield* ConformanceApi.clientWebSocket(`${base}/api`);
          const watched = yield* api.CounterTotal.watch(id).pipe(
            Stream.map((frame) => frame.state?.total ?? 0),
            Stream.takeUntil((total) => total === 5),
            Stream.runCollect,
            Effect.timeout(within),
            Effect.forkChild,
          );
          yield* Effect.sleep("1 second");
          yield* call(`/increment/${id}?by=2`);
          yield* call(`/increment/${id}?by=3`);
          const totals = [...(yield* Fiber.join(watched))];
          expect(totals.at(-1)).toBe(5);
          expect(totals).toEqual([...totals].sort((a, b) => a - b));
        }).pipe(Effect.provideContext(sockets)),
      ),
      Effect.scoped,
    ),
    options,
  );

  test(
    "a rejected command commits nothing",
    Effect.gen(function* () {
      const id = yield* fresh("reject");
      const rejected = yield* call(`/increment/${id}?by=11`);
      expect(rejected).toEqual({ rejected: "TooBig" });
      const counter = yield* call(`/counter/${id}`);
      expect(counter).toEqual({ total: 0 });
    }),
    options,
  );

  test(
    "a command sent twice under one id commits once",
    Effect.gen(function* () {
      const id = yield* fresh("dedupe");
      const { first, second } = yield* call<{ first: unknown; second: unknown }>(
        `/again/${id}?by=4`,
      );
      expect(first).toEqual(second);
      const counter = yield* call(`/counter/${id}`);
      expect(counter).toEqual({ total: 4 });
    }),
    options,
  );

  test(
    "a view lists its entries a page at a time, in either order",
    Effect.gen(function* () {
      const id = yield* fresh("pages");
      for (const by of [1, 2, 3, 4, 5]) yield* call(`/increment/${id}?by=${by}`);
      yield* eventually<{ increments: number }>(`/total/${id}`, (view) => view.increments === 5);
      type Page = { totals: ReadonlyArray<number>; cursor: number | null };
      const newest = yield* call<Page>(`/totals/${id}?order=desc&take=2`);
      expect(newest).toEqual({ totals: [15, 10], cursor: 4 });
      const older = yield* call<Page>(`/totals/${id}?order=desc&take=2&after=4`);
      expect(older).toEqual({
        totals: [6, 3],
        cursor: 2,
      });
      const oldest = yield* call<Page>(`/totals/${id}?order=desc&take=2&after=2`);
      expect(oldest).toEqual({
        totals: [1],
        cursor: null,
      });
      const ascending = yield* call<Page>(`/totals/${id}?take=2&after=2`);
      expect(ascending).toEqual({
        totals: [6, 10],
        cursor: 4,
      });
      const last = yield* call<Page>(`/totals/${id}?take=2&after=4`);
      expect(last).toEqual({
        totals: [15],
        cursor: null,
      });
    }),
    options,
  );

  test(
    "commands to one instance run one at a time",
    Effect.gen(function* () {
      const id = yield* fresh("serial");
      yield* Effect.forEach(
        A.makeBy(10, identity),
        () => call(`/increment/${id}?by=1`),
        { concurrency: "unbounded", discard: true },
      );
      const counter = yield* call(`/counter/${id}`);
      expect(counter).toEqual({ total: 10 });
    }),
    options,
  );

  test(
    "a view applies every event once, in order",
    Effect.gen(function* () {
      const id = yield* fresh("view");
      for (const by of [1, 2, 3]) yield* call(`/increment/${id}?by=${by}`);
      const total = yield* eventually<{ total: number; increments: number }>(
        `/total/${id}`,
        (view) => view.increments >= 3,
      );
      expect(total).toEqual({ total: 6, increments: 3 });
    }),
    options,
  );

  test(
    "a policy starts a saga, and the saga's step commits",
    Effect.gen(function* () {
      const id = yield* fresh("saga");
      yield* call(`/increment/${id}?by=7`);
      // One run per counter: a second increment starts nothing new.
      yield* call(`/increment/${id}?by=1`);
      const echo = yield* eventually<{ total: number }>(`/echo/${id}`, (e) => e.total > 0);
      expect(echo).toEqual({ total: 7 });
    }),
    options,
  );

  test(
    "a scheduled command runs when it is due",
    Effect.gen(function* () {
      const id = yield* fresh("expire");
      const placed = yield* call(`/place/${id}`);
      expect(placed).toEqual({ status: "held" });
      const hold = yield* eventually<{ status: string }>(
        `/hold/${id}`,
        (h) => h.status === "expired",
      );
      expect(hold).toEqual({ status: "expired" });
    }),
    options,
  );

  test(
    "a cancelled command never runs",
    Effect.gen(function* () {
      const id = yield* fresh("release");
      yield* call(`/place/${id}`);
      const released = yield* call(`/release/${id}`);
      expect(released).toEqual({ status: "released" });
      // Past the hold's window, and the policy's delivery.
      yield* Effect.sleep("10 seconds");
      const hold = yield* call(`/hold/${id}`);
      expect(hold).toEqual({ status: "released" });
    }),
    options,
  );
};
