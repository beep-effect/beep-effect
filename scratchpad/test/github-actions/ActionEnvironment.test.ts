import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Effect, Latch, Layer, Option } from "effect";
import { ActionEnvironment } from "../../effected/github-actions/index.ts";

const BASE = {
	GITHUB_REPOSITORY: "owner/repo",
	GITHUB_REPOSITORY_OWNER: "owner",
	GITHUB_REF: "refs/heads/main",
	GITHUB_REF_NAME: "main",
	GITHUB_SHA: "abc123",
	GITHUB_WORKFLOW: "ci",
	GITHUB_JOB: "build",
	GITHUB_RUN_ID: "42",
	GITHUB_RUN_ATTEMPT: "2",
	GITHUB_EVENT_NAME: "push",
	GITHUB_ACTOR: "octocat",
	GITHUB_SERVER_URL: "https://github.com",
	GITHUB_API_URL: "https://api.github.com",
	GITHUB_GRAPHQL_URL: "https://api.github.com/graphql",
	GITHUB_WORKSPACE: "/work",
	RUNNER_OS: "Linux",
	RUNNER_ARCH: "X64",
	RUNNER_NAME: "runner-1",
	RUNNER_TEMP: "/tmp/runner",
	RUNNER_TOOL_CACHE: "/opt/hostedtoolcache",
};

const live = <A, E>(
	program: Effect.Effect<A, E, ActionEnvironment>,
	env: Record<string, string> = BASE,
	contents: Record<string, string> = {},
) =>
	// A seeded in-memory volume rather than a hand-rolled readFileString stub:
	// the volume honors the whole FileSystem contract, and an unseeded path
	// fails typed `NotFound` instead of whatever a hand stub happens to answer.
	program.pipe(Effect.provide(ActionEnvironment.layerFrom(env)), Effect.provide(MemoryFileSystem.layerWith(contents)));

describe("ActionEnvironment", () => {
	describe("reading variables", () => {
		it.effect("reads a present variable", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.strictEqual(yield* env.get("GITHUB_ACTOR"), "octocat");
				}),
			),
		);

		it.effect("fails typed for a missing variable, naming it", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const error = yield* Effect.flip(env.get("NOPE"));
					assert.strictEqual(error._tag, "ActionEnvironmentError");
					assert.strictEqual(error.reason, "missing");
					assert.strictEqual(error.name, "NOPE");
					assert.include(error.message, "NOPE");
				}),
			),
		);

		it.effect("treats an empty variable as absent, as the runner does", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.isTrue(Option.isNone(yield* env.getOptional("EMPTY")));
					assert.strictEqual((yield* Effect.flip(env.get("EMPTY"))).reason, "missing");
				}),
				{ ...BASE, EMPTY: "" },
			),
		);

		it.effect("getOptional never fails", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.isTrue(Option.isNone(yield* env.getOptional("NOPE")));
					assert.deepStrictEqual(yield* env.getOptional("GITHUB_JOB"), Option.some("build"));
				}),
			),
		);
	});

	describe("contexts", () => {
		it.effect("projects the GitHub context", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const ctx = yield* env.github;
					assert.strictEqual(ctx.repository, "owner/repo");
					assert.strictEqual(ctx.runId, 42);
					assert.strictEqual(ctx.runAttempt, 2);
					assert.strictEqual(ctx.eventName, "push");
				}),
			),
		);

		it.effect("fails typed when a required context variable is missing", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const error = yield* Effect.flip(env.github);
					assert.strictEqual(error.name, "GITHUB_REPOSITORY");
				}),
				{},
			),
		);

		it.effect("fails typed when a numeric context variable is not a number", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const error = yield* Effect.flip(env.github);
					assert.strictEqual(error.reason, "malformed");
					assert.strictEqual(error.name, "GITHUB_RUN_ID");
				}),
				{ ...BASE, GITHUB_RUN_ID: "not-a-number" },
			),
		);

		it.effect("projects headRef and derives branch from it in a PR context", () =>
			live(
				Effect.gen(function* () {
					const ctx = yield* (yield* ActionEnvironment).github;
					assert.deepStrictEqual(ctx.headRef, Option.some("feat/topic"));
					// On a PR the short ref is the useless merge ref; branch is the
					// human's branch — the headRef.
					assert.strictEqual(ctx.branch, "feat/topic");
				}),
				{ ...BASE, GITHUB_EVENT_NAME: "pull_request", GITHUB_REF_NAME: "123/merge", GITHUB_HEAD_REF: "feat/topic" },
			),
		);

		it.effect("headRef is none in a push context, and branch falls back to refName", () =>
			live(
				Effect.gen(function* () {
					const ctx = yield* (yield* ActionEnvironment).github;
					assert.isTrue(Option.isNone(ctx.headRef));
					assert.strictEqual(ctx.branch, "main");
				}),
			),
		);

		it.effect("an empty GITHUB_HEAD_REF reads as absent — the runner writes it empty outside PRs", () =>
			live(
				Effect.gen(function* () {
					const ctx = yield* (yield* ActionEnvironment).github;
					// The trap: a raw env read reports "" as present, and a cache key
					// built from it gains an empty branch segment. The type refuses it.
					assert.isTrue(Option.isNone(ctx.headRef));
					assert.strictEqual(ctx.branch, "main");
				}),
				{ ...BASE, GITHUB_HEAD_REF: "" },
			),
		);

		it.effect("projects the runner context", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const runner = yield* env.runner;
					assert.strictEqual(runner.os, "Linux");
					assert.strictEqual(runner.toolCache, "/opt/hostedtoolcache");
				}),
			),
		);

		it.effect("reports debug from RUNNER_DEBUG", () =>
			live(
				Effect.gen(function* () {
					assert.isFalse(yield* (yield* ActionEnvironment).isDebug);
				}),
			).pipe(
				Effect.flatMap(() =>
					live(
						Effect.gen(function* () {
							assert.isTrue(yield* (yield* ActionEnvironment).isDebug);
						}),
						{ ...BASE, RUNNER_DEBUG: "1" },
					),
				),
			),
		);
	});

	describe("payload", () => {
		it.effect("reads and parses the event payload with R = never", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					// The type is the assertion: `payload` carries no FileSystem in R,
					// so a caller never has to re-inject one.
					const payload: Effect.Effect<unknown, unknown> = env.payload;
					const value = (yield* payload) as { readonly action?: string };
					assert.strictEqual(value.action, "opened");
				}),
				{ ...BASE, GITHUB_EVENT_PATH: "/event.json" },
				{ "/event.json": JSON.stringify({ action: "opened" }) },
			),
		);

		it.effect("fails typed when the payload file is not valid JSON", () =>
			live(
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionEnvironment).payload);
					assert.strictEqual(error.reason, "malformed");
					assert.strictEqual(error.name, "GITHUB_EVENT_PATH");
				}),
				{ ...BASE, GITHUB_EVENT_PATH: "/event.json" },
				{ "/event.json": "{ not json" },
			),
		);

		it.effect("fails typed when GITHUB_EVENT_PATH is not set", () =>
			live(
				Effect.gen(function* () {
					const error = yield* Effect.flip((yield* ActionEnvironment).payload);
					assert.strictEqual(error.name, "GITHUB_EVENT_PATH");
				}),
			),
		);
	});

	describe("withEnv — the scoped override", () => {
		it.effect("overrides for the duration of the effect and no longer", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.strictEqual(yield* env.get("GITHUB_ACTOR"), "octocat");
					const inner = yield* env.withEnv({ GITHUB_ACTOR: "someone-else" }, env.get("GITHUB_ACTOR"));
					assert.strictEqual(inner, "someone-else");
					assert.strictEqual(yield* env.get("GITHUB_ACTOR"), "octocat");
				}),
			),
		);

		it.effect("merges with an enclosing override rather than replacing it", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const [a, b] = yield* env.withEnv(
						{ A: "1" },
						env.withEnv({ B: "2" }, Effect.all([env.get("A"), env.get("B")])),
					);
					assert.strictEqual(a, "1");
					assert.strictEqual(b, "2");
				}),
			),
		);

		it.effect("adds a variable the base environment does not have", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.strictEqual(yield* env.withEnv({ NEW: "v" }, env.get("NEW")), "v");
					assert.isTrue(Option.isNone(yield* env.getOptional("NEW")));
				}),
			),
		);

		it.effect("is parallel-safe: concurrent fibers do not see each other's overrides", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					// Latches, not a sleep: `it.effect` installs a virtual TestClock, so
					// `Effect.sleep` would hang to the vitest timeout rather than
					// interleave.
					//
					// TWO latches, and the order is the whole test. A save/restore
					// implementation over a shared global is LIFO-correct whenever the
					// two overrides nest properly, so an interleaving where the inner
					// one restores before the outer one reads passes for the wrong
					// reason. This order forces LEFT TO READ WHILE RIGHT'S OVERRIDE IS
					// STILL APPLIED AND UNRESTORED — which only a fiber-local
					// implementation survives.
					const rightApplied = yield* Latch.make();
					const leftDone = yield* Latch.make();
					const [left, right] = yield* Effect.all(
						[
							env.withEnv(
								{ GITHUB_ACTOR: "left" },
								Effect.gen(function* () {
									yield* rightApplied.await;
									const seen = yield* env.get("GITHUB_ACTOR");
									yield* leftDone.open;
									return seen;
								}),
							),
							env.withEnv(
								{ GITHUB_ACTOR: "right" },
								Effect.gen(function* () {
									const seen = yield* env.get("GITHUB_ACTOR");
									yield* rightApplied.open;
									yield* leftDone.await;
									return seen;
								}),
							),
						],
						{ concurrency: 2 },
					);
					assert.strictEqual(left, "left");
					assert.strictEqual(right, "right");
				}),
			),
		);

		it.effect("never mutates the real process environment", () =>
			live(
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					yield* env.withEnv({ EFFECTED_GHA_LEAK_PROBE: "leaked" }, Effect.void);
					assert.isUndefined(process.env.EFFECTED_GHA_LEAK_PROBE);
				}),
			),
		);
	});

	describe("test double", () => {
		it.effect("layerTest seeds the GITHUB_* block so a suite does not restate it", () =>
			Effect.gen(function* () {
				const env = yield* ActionEnvironment;
				const ctx = yield* env.github;
				assert.isString(ctx.repository);
				assert.isNumber(ctx.runId);
			}).pipe(Effect.provide(ActionEnvironment.layerTest())),
		);

		it.effect("layerTest takes overrides on top of the defaults", () =>
			Effect.gen(function* () {
				const env = yield* ActionEnvironment;
				assert.strictEqual((yield* env.github).repository, "acme/widget");
				assert.strictEqual((yield* env.github).eventName, "push");
			}).pipe(Effect.provide(ActionEnvironment.layerTest({ GITHUB_REPOSITORY: "acme/widget" }))),
		);

		it.effect("layerTest serves a payload directly, with no filesystem in R", () =>
			Effect.gen(function* () {
				const env = yield* ActionEnvironment;
				// The type is half the assertion: an event-driven suite gets its payload
				// from the STANDARD double, without dropping to makeTest and hand-rolling
				// a filesystem stub at every site.
				const payload: Effect.Effect<unknown, unknown> = env.payload;
				const value = (yield* payload) as { readonly pull_request?: { readonly number?: number } };
				assert.strictEqual(value.pull_request?.number, 42);
			}).pipe(
				Effect.provide(
					ActionEnvironment.layerTest({ GITHUB_EVENT_NAME: "pull_request" }, { pull_request: { number: 42 } }),
				),
			),
		);

		it.effect("layerTest serves the payload without routing through GITHUB_EVENT_PATH", () =>
			Effect.gen(function* () {
				const env = yield* ActionEnvironment;
				// The discriminating part: the layer hard-provides FileSystem.layerNoop,
				// so a payload arriving through a file read would fail here. Seeding the
				// path as WELL as the payload must change nothing — the served value
				// replaces the read rather than backing it.
				assert.deepStrictEqual(yield* env.payload, { served: true });
			}).pipe(Effect.provide(ActionEnvironment.layerTest({ GITHUB_EVENT_PATH: "/event.json" }, { served: true }))),
		);

		it.effect("an unserved payload fails typed and names the variable", () =>
			Effect.gen(function* () {
				// TEST_DEFAULTS omits GITHUB_EVENT_PATH on purpose: a suite that forgot
				// to arrange a payload gets a loud failure naming what is missing, not a
				// plausible empty object.
				const error = yield* Effect.flip((yield* ActionEnvironment).payload);
				assert.strictEqual(error.name, "GITHUB_EVENT_PATH");
			}).pipe(Effect.provide(ActionEnvironment.layerTest())),
		);

		it.effect("a served payload may be any JSON value, not only an object", () =>
			Effect.gen(function* () {
				assert.deepStrictEqual(yield* (yield* ActionEnvironment).payload, []);
			}).pipe(Effect.provide(ActionEnvironment.layerTest({}, []))),
		);
	});

	describe("the memfs recipe — the real read path behind the double", () => {
		it.effect("makeTest over a seeded volume exercises the actual GITHUB_EVENT_PATH read", () => {
			// The generalization of the served payload: makeTest leaves FileSystem
			// in R precisely so a suite chooses the filesystem, and a seeded
			// in-memory volume makes the REAL read-and-parse path run — the recipe
			// for a suite that wants to exercise that path rather than replace it.
			const layer = Layer.effect(
				ActionEnvironment,
				ActionEnvironment.makeTest({ GITHUB_EVENT_PATH: "/event.json" }),
			).pipe(Layer.provide(MemoryFileSystem.layerWith({ "/event.json": JSON.stringify({ action: "opened" }) })));
			return Effect.gen(function* () {
				const env = yield* ActionEnvironment;
				assert.deepStrictEqual(yield* env.payload, { action: "opened" });
			}).pipe(Effect.provide(layer));
		});

		it.effect("the volume never fabricates a payload — an unseeded path fails typed", () => {
			// The honest-absence half of the recipe: with the path set but nothing
			// seeded, the read fails and maps onto this module's typed error naming
			// the variable — never an empty object a hand stub might have answered.
			const layer = Layer.effect(
				ActionEnvironment,
				ActionEnvironment.makeTest({ GITHUB_EVENT_PATH: "/event.json" }),
			).pipe(Layer.provide(MemoryFileSystem.layer));
			return Effect.gen(function* () {
				const error = yield* Effect.flip((yield* ActionEnvironment).payload);
				assert.strictEqual(error.reason, "malformed");
				assert.strictEqual(error.name, "GITHUB_EVENT_PATH");
			}).pipe(Effect.provide(layer));
		});
	});
});
