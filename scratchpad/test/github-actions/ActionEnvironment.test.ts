import { env as processEnvironment } from "node:process";
import { assert, describe, it } from "@effect/vitest";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as Latch from "effect/Latch";
import * as Layer from "effect/Layer";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { ActionEnvironment, ActionEnvironmentError } from "../../effected/github-actions/index.ts";
import * as Context from "effect/Context";
class BaseDebug extends Context.Service<BaseDebug, Effect.Effect<boolean>>()(
	"@beep/scratchpad/test/github-actions/ActionEnvironment.test/BaseDebug",
) {}

class RunnerDebug extends Context.Service<RunnerDebug, Effect.Effect<boolean>>()(
	"@beep/scratchpad/test/github-actions/ActionEnvironment.test/RunnerDebug",
) {}

const Json = S.fromJsonString(S.Unknown);
const ActionPayload = S.Struct({ action: S.optionalKey(S.String) });
const PullRequestPayload = S.Struct({ pull_request: S.optionalKey(S.Struct({ number: S.optionalKey(S.Finite) })) });

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

describe("ActionEnvironment", () => {
	describe("reading variables", () => {
		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("reads a present variable", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.strictEqual(yield* env.get("GITHUB_ACTOR"), "octocat");
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("fails typed for a missing variable, naming it", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const error = yield* Effect.flip(env.get("NOPE"));
					assert.strictEqual(error._tag, "ActionEnvironmentError");
					assert.strictEqual(error.reason, "missing");
					assert.strictEqual(error.name, "NOPE");
					assert.include(error.message, "NOPE");
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom({}).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("treats absent prototype names as missing strings", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					for (const name of ["toString", "constructor", "__proto__"]) {
						assertNone(yield* env.getOptional(name));
						const error = yield* Effect.flip(env.get(name));
						assert.strictEqual(error.reason, "missing");
						assert.strictEqual(error.name, name);
					}
				}),
			);
		});

		it.layer(
			ActionEnvironment.layerFrom({
				toString: "configured",
				constructor: "configured",
				["__proto__"]: "configured",
			}).pipe(Layer.provide(MemoryFileSystem.layerWith({}))),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("reads configured prototype names and honors scoped overrides and empty strings", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					for (const name of ["toString", "constructor", "__proto__"]) {
						assertSome(yield* env.getOptional(name), "configured");
						assert.strictEqual(yield* env.get(name), "configured");
						assert.strictEqual(yield* env.withEnv({ [name]: "override" }, env.get(name)), "override");
						assertNone(yield* env.withEnv({ [name]: "" }, env.getOptional(name)));
						assert.strictEqual(yield* env.get(name), "configured");
					}
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom({ ...BASE, EMPTY: "" }).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("treats an empty variable as absent, as the runner does", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assertNone(yield* env.getOptional("EMPTY"));
					assert.strictEqual((yield* Effect.flip(env.get("EMPTY"))).reason, "missing");
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("getOptional never fails", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assertNone(yield* env.getOptional("NOPE"));
					assertSome(yield* env.getOptional("GITHUB_JOB"), "build");
				}),
			);
		});
	});

	describe("contexts", () => {
		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("projects the GitHub context", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const ctx = yield* env.github;
					assert.strictEqual(ctx.repository, "owner/repo");
					assert.strictEqual(ctx.runId, 42);
					assert.strictEqual(ctx.runAttempt, 2);
					assert.strictEqual(ctx.eventName, "push");
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom({}).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("fails typed when a required context variable is missing", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const error = yield* Effect.flip(env.github);
					assert.strictEqual(error.name, "GITHUB_REPOSITORY");
				}),
			);
		});

		it.layer(
			ActionEnvironment.layerFrom({ ...BASE, GITHUB_RUN_ID: "not-a-number" }).pipe(
				Layer.provide(MemoryFileSystem.layerWith({})),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("fails typed when a numeric context variable is not a number", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const error = yield* Effect.flip(env.github);
					assert.strictEqual(error.reason, "malformed");
					assert.strictEqual(error.name, "GITHUB_RUN_ID");
				}),
			);
		});

		it.layer(
			ActionEnvironment.layerFrom({
				...BASE,
				GITHUB_EVENT_NAME: "pull_request",
				GITHUB_REF_NAME: "123/merge",
				GITHUB_HEAD_REF: "feat/topic",
			}).pipe(Layer.provide(MemoryFileSystem.layerWith({}))),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("projects headRef and derives branch from it in a PR context", () =>
				Effect.gen(function* () {
					const ctx = yield* (yield* ActionEnvironment).github;
					assertSome(ctx.headRef, "feat/topic");
					// On a PR the short ref is the useless merge ref; branch is the
					// human's branch — the headRef.
					assert.strictEqual(ctx.branch, "feat/topic");
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("headRef is none in a push context, and branch falls back to refName", () =>
				Effect.gen(function* () {
					const ctx = yield* (yield* ActionEnvironment).github;
					assertNone(ctx.headRef);
					assert.strictEqual(ctx.branch, "main");
				}),
			);
		});

		it.layer(
			ActionEnvironment.layerFrom({ ...BASE, GITHUB_HEAD_REF: "" }).pipe(Layer.provide(MemoryFileSystem.layerWith({}))),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("an empty GITHUB_HEAD_REF reads as absent — the runner writes it empty outside PRs", () =>
				Effect.gen(function* () {
					const ctx = yield* (yield* ActionEnvironment).github;
					// The trap: a raw env read reports "" as present, and a cache key
					// built from it gains an empty branch segment. The type refuses it.
					assertNone(ctx.headRef);
					assert.strictEqual(ctx.branch, "main");
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("projects the runner context", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const runner = yield* env.runner;
					assert.strictEqual(runner.os, "Linux");
					assert.strictEqual(runner.toolCache, "/opt/hostedtoolcache");
				}),
			);
		});

		it.layer(
			Layer.mergeAll(
				Layer.effect(
					BaseDebug,
					Effect.map(ActionEnvironment, (env) => env.isDebug),
				).pipe(Layer.provide(ActionEnvironment.layerFrom(BASE))),
				Layer.effect(
					RunnerDebug,
					Effect.map(ActionEnvironment, (env) => env.isDebug),
				).pipe(Layer.provide(ActionEnvironment.layerFrom({ ...BASE, RUNNER_DEBUG: "1" }))),
			).pipe(Layer.provide(MemoryFileSystem.layerWith({}))),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("reports debug from RUNNER_DEBUG", () =>
				Effect.gen(function* () {
					assert.isFalse(yield* yield* BaseDebug);
					assert.isTrue(yield* yield* RunnerDebug);
				}),
			);
		});
	});

	describe("payload", () => {
		it.layer(
			ActionEnvironment.layerFrom({ ...BASE, GITHUB_EVENT_PATH: "/event.json" }).pipe(
				Layer.provide(
					MemoryFileSystem.layerWith({
						"/event.json": Result.getOrThrowWith(S.encodeResult(Json)({ action: "opened" }), (error) => error),
					}),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("reads and parses the event payload with R = never", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					// The type is the assertion: `payload` carries no FileSystem in R,
					// so a caller never has to re-inject one.
					const payload: Effect.Effect<unknown, ActionEnvironmentError> = env.payload;
					const value = yield* payload;
					if (!S.is(ActionPayload)(value)) {
						assert.fail("expected an action payload");
					}
					assert.strictEqual(value.action, "opened");
				}),
			);
		});

		it.layer(
			ActionEnvironment.layerFrom({ ...BASE, GITHUB_EVENT_PATH: "/event.json" }).pipe(
				Layer.provide(MemoryFileSystem.layerWith({ "/event.json": "{ not json" })),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("fails typed when the payload file is not valid JSON", () =>
				Effect.gen(function* () {
					const error = yield* (yield* ActionEnvironment).payload.pipe(Effect.asVoid, Effect.flip);
					assert.strictEqual(error.reason, "malformed");
					assert.strictEqual(error.name, "GITHUB_EVENT_PATH");
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("fails typed when GITHUB_EVENT_PATH is not set", () =>
				Effect.gen(function* () {
					const error = yield* (yield* ActionEnvironment).payload.pipe(Effect.asVoid, Effect.flip);
					assert.strictEqual(error.name, "GITHUB_EVENT_PATH");
				}),
			);
		});
	});

	describe("withEnv — the scoped override", () => {
		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("overrides for the duration of the effect and no longer", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.strictEqual(yield* env.get("GITHUB_ACTOR"), "octocat");
					const inner = yield* env.withEnv({ GITHUB_ACTOR: "someone-else" }, env.get("GITHUB_ACTOR"));
					assert.strictEqual(inner, "someone-else");
					assert.strictEqual(yield* env.get("GITHUB_ACTOR"), "octocat");
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("merges with an enclosing override rather than replacing it", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const [a, b] = yield* env.withEnv(
						{ A: "1" },
						env.withEnv({ B: "2" }, Effect.all([env.get("A"), env.get("B")])),
					);
					assert.strictEqual(a, "1");
					assert.strictEqual(b, "2");
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("adds a variable the base environment does not have", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.strictEqual(yield* env.withEnv({ NEW: "v" }, env.get("NEW")), "v");
					assertNone(yield* env.getOptional("NEW"));
				}),
			);
		});

		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("is parallel-safe: concurrent fibers do not see each other's overrides", () =>
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
			);
		});

		it.layer(ActionEnvironment.layerFrom(BASE).pipe(Layer.provide(MemoryFileSystem.layerWith({}))), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("never mutates the real process environment", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					yield* env.withEnv({ EFFECTED_GHA_LEAK_PROBE: "leaked" }, Effect.void);
					// Inspect the real Node environment: the service override must never write to it.
					assert.isUndefined(processEnvironment.EFFECTED_GHA_LEAK_PROBE);
				}),
			);
		});
	});

	describe("test double", () => {
		it.layer(ActionEnvironment.layerTest(), { timeout: "30 seconds" })((it) => {
			it.effect("layerTest seeds the GITHUB_* block so a suite does not restate it", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					const ctx = yield* env.github;
					assert.isString(ctx.repository);
					assert.isNumber(ctx.runId);
				}),
			);
		});

		it.layer(ActionEnvironment.layerTest({ GITHUB_REPOSITORY: "acme/widget" }), { timeout: "30 seconds" })((it) => {
			it.effect("layerTest takes overrides on top of the defaults", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.strictEqual((yield* env.github).repository, "acme/widget");
					assert.strictEqual((yield* env.github).eventName, "push");
				}),
			);
		});

		it.layer(ActionEnvironment.layerTest({ GITHUB_EVENT_NAME: "pull_request" }, { pull_request: { number: 42 } }), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("layerTest serves a payload directly, with no filesystem in R", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					// The type is half the assertion: an event-driven suite gets its payload
					// from the STANDARD double, without dropping to makeTest and hand-rolling
					// a filesystem stub at every site.
					const payload: Effect.Effect<unknown, ActionEnvironmentError> = env.payload;
					const value = yield* payload;
					if (!S.is(PullRequestPayload)(value)) {
						assert.fail("expected a pull request payload");
					}
					assert.strictEqual(value.pull_request?.number, 42);
				}),
			);
		});

		it.layer(ActionEnvironment.layerTest({ GITHUB_EVENT_PATH: "/event.json" }, { served: true }), {
			timeout: "30 seconds",
		})((it) => {
			it.effect("layerTest serves the payload without routing through GITHUB_EVENT_PATH", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					// The discriminating part: the layer hard-provides FileSystem.layerNoop,
					// so a payload arriving through a file read would fail here. Seeding the
					// path as WELL as the payload must change nothing — the served value
					// replaces the read rather than backing it.
					assert.deepStrictEqual(yield* env.payload, { served: true });
				}),
			);
		});

		it.layer(ActionEnvironment.layerTest(), { timeout: "30 seconds" })((it) => {
			it.effect("an unserved payload fails typed and names the variable", () =>
				Effect.gen(function* () {
					// TEST_DEFAULTS omits GITHUB_EVENT_PATH on purpose: a suite that forgot
					// to arrange a payload gets a loud failure naming what is missing, not a
					// plausible empty object.
					const error = yield* (yield* ActionEnvironment).payload.pipe(Effect.asVoid, Effect.flip);
					assert.strictEqual(error.name, "GITHUB_EVENT_PATH");
				}),
			);
		});

		it.layer(ActionEnvironment.layerTest({}, []), { timeout: "30 seconds" })((it) => {
			it.effect("a served payload may be any JSON value, not only an object", () =>
				Effect.gen(function* () {
					assert.deepStrictEqual(yield* (yield* ActionEnvironment).payload, []);
				}),
			);
		});
	});

	describe("the memfs recipe — the real read path behind the double", () => {
		it.layer(
			Layer.effect(ActionEnvironment, ActionEnvironment.makeTest({ GITHUB_EVENT_PATH: "/event.json" })).pipe(
				Layer.provide(
					MemoryFileSystem.layerWith({
						"/event.json": Result.getOrThrowWith(S.encodeResult(Json)({ action: "opened" }), (error) => error),
					}),
				),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("makeTest over a seeded volume exercises the actual GITHUB_EVENT_PATH read", () =>
				Effect.gen(function* () {
					const env = yield* ActionEnvironment;
					assert.deepStrictEqual(yield* env.payload, { action: "opened" });
				}),
			);
		});

		it.layer(
			Layer.effect(ActionEnvironment, ActionEnvironment.makeTest({ GITHUB_EVENT_PATH: "/event.json" })).pipe(
				Layer.provide(MemoryFileSystem.layer),
			),
			{ timeout: "30 seconds" },
		)((it) => {
			it.effect("the volume never fabricates a payload — an unseeded path fails typed", () =>
				Effect.gen(function* () {
					const error = yield* (yield* ActionEnvironment).payload.pipe(Effect.asVoid, Effect.flip);
					assert.strictEqual(error.reason, "malformed");
					assert.strictEqual(error.name, "GITHUB_EVENT_PATH");
				}),
			);
		});
	});
});
