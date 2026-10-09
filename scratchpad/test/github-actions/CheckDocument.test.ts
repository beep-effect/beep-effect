// @effect-diagnostics strictEffectProvide:skip-file multipleEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as MutableRef from "effect/MutableRef";
import { TestClock } from "effect/testing";
import { CheckDocument, CheckDocumentError, CheckDocumentStamp, CheckReport } from "../../effected/github-actions/CheckDocument.ts";
import { ManagedDocument } from "../../effected/github-actions/ManagedDocument.ts";

const NS = "savvy-web";
const KEY = "release-validation";

/** One region per check — the layout the reconciler is designed around. */
const perCheck = (checks: ReadonlyMap<string, CheckReport>): ReadonlyArray<readonly [string, string]> =>
	[...checks].map(([check, entry]) => [
		`check-${check}`,
		`${entry.state}${entry.outcome === undefined ? "" : ` — ${entry.outcome}`}`,
	]);

interface HarnessOptions {
	readonly render?: (checks: ReadonlyMap<string, CheckReport>) => ReadonlyArray<readonly [string, string]>;
	readonly sink?: (rendered: string) => Effect.Effect<unknown, unknown>;
	readonly initial?: string;
	readonly quiet?: Duration.Input;
	readonly maxWait?: Duration.Input;
	readonly sinkTimeout?: Duration.Input;
}

/** A recording sink plus the layer wired to it. */
const harness = Effect.fn("harness")(function*(options: HarnessOptions = {}) {
		const writes = yield* Ref.make<ReadonlyArray<string>>([]);
		const layer = CheckDocument.layer({
			namespace: NS,
			key: KEY,
			...(options.initial === undefined ? {} : { initial: options.initial }),
			render: options.render ?? perCheck,
			sink: options.sink ?? ((rendered) => Ref.update(writes, (all) => [...all, rendered])),
			debounce: { quiet: options.quiet ?? "500 millis", maxWait: options.maxWait ?? "3 seconds" },
			...(options.sinkTimeout === undefined ? {} : { sinkTimeout: options.sinkTimeout }),
		});
		return { writes, layer };
	});

describe("CheckDocument", () => {
	describe("the debounced reconcile", () => {
		it.effect("a pass-then-fail burst inside the debounce window leaves the document showing fail", () =>
			Effect.gen(function* () {
				const { writes, layer } = yield* harness();
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					yield* doc.report("build", CheckReport.make({ state: "fail" }));
					yield* TestClock.adjust("500 millis");
					const all = yield* Ref.get(writes);
					// ONE write for the burst, carrying its FINAL state. A
					// leading-edge debounce would have published `pass` and left it.
					assert.strictEqual(all.length, 1);
					const text = all[0] ?? "";
					assert.include(text, "fail");
					assert.notInclude(text, "pass");
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("nothing is written before the quiet window elapses", () =>
			Effect.gen(function* () {
				const { writes, layer } = yield* harness();
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "running" }));
					yield* TestClock.adjust("499 millis");
					assert.deepStrictEqual(yield* Ref.get(writes), []);
					yield* TestClock.adjust("1 millis");
					assert.strictEqual((yield* Ref.get(writes)).length, 1);
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("reconciling unchanged state issues no write", () =>
			Effect.gen(function* () {
				const { writes, layer } = yield* harness();
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "clean" }));
					yield* TestClock.adjust("500 millis");
					assert.strictEqual((yield* Ref.get(writes)).length, 1);
					// The same state again: same render, byte-identical document —
					// neither the debounced pass nor an explicit flush may write.
					yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "clean" }));
					yield* TestClock.adjust("500 millis");
					yield* doc.flush;
					assert.strictEqual((yield* Ref.get(writes)).length, 1);
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("a steady stream of reports still writes by maxWait — the staleness bound", () =>
			Effect.gen(function* () {
				const { writes, layer } = yield* harness({ quiet: "500 millis", maxWait: "2 seconds" });
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					// Reports every 400ms: the quiet window NEVER elapses.
					for (let step = 0; step < 5; step += 1) {
						yield* doc.report("build", CheckReport.make({ state: "running", outcome: `step ${step}` }));
						yield* TestClock.adjust("400 millis");
					}
					const all = yield* Ref.get(writes);
					assert.strictEqual(all.length, 1, "exactly one write, at the staleness bound");
					assert.include(all[0] ?? "", "step 4", "and it carries the latest state, not the first");
				}).pipe(Effect.provide(layer));
			}),
		);
	});

	describe("replacement, never appending", () => {
		it.effect("a second resolution updates its region in place rather than appending", () =>
			Effect.gen(function* () {
				const { writes, layer } = yield* harness();
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					yield* doc.flush;
					// Resolution is NOT terminal: the check resolves again.
					yield* doc.report("build", CheckReport.make({ state: "fail" }));
					yield* doc.flush;
					const all = yield* Ref.get(writes);
					assert.strictEqual(all.length, 2);
					const final = all[1] ?? "";
					assert.strictEqual(
						final.split(`BEGIN ${NS}.${KEY}.check-build`).length - 1,
						1,
						"one region for the check, not one per resolution",
					);
					const parsed = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: final }));
					assert.deepStrictEqual(parsed.region("check-build"), O.some("fail"));
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("human content seeded through `initial` survives every reconcile", () =>
			Effect.gen(function* () {
				const human = "A human wrote this PR description.";
				const { writes, layer } = yield* harness({ initial: human });
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "running" }));
					yield* doc.flush;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					yield* doc.flush;
					const all = yield* Ref.get(writes);
					for (const text of all) {
						assert.include(text, human);
					}
				}).pipe(Effect.provide(layer));
			}),
		);
	});

	describe("lifecycle", () => {
		it.effect("the scope closing inside the quiet window still lands the final state", () =>
			Effect.gen(function* () {
				const { writes, layer } = yield* harness();
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					// No adjust, no flush: the scope closes mid-window.
				}).pipe(Effect.provide(layer));
				const all = yield* Ref.get(writes);
				assert.strictEqual(all.length, 1, "the finalizer flushed the last burst");
				assert.include(all[0] ?? "", "pass");
			}),
		);

		it.effect("a failing background pass is retried, not fatal", () =>
			Effect.gen(function* () {
				const broken = yield* Ref.make(true);
				const writes = yield* Ref.make<ReadonlyArray<string>>([]);
				const layer = CheckDocument.layer({
					namespace: NS,
					key: KEY,
					render: perCheck,
					sink: Effect.fn("sink")(function*(rendered) {
							if (yield* Ref.get(broken)) {
								return yield* Effect.fail("the API said no");
							}
							yield* Ref.update(writes, (all) => [...all, rendered]);
						}),
					debounce: { quiet: "500 millis", maxWait: "3 seconds" },
				});
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "running" }));
					yield* TestClock.adjust("500 millis");
					assert.deepStrictEqual(yield* Ref.get(writes), [], "the write failed and was logged");
					yield* Ref.set(broken, false);
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					yield* TestClock.adjust("500 millis");
					const all = yield* Ref.get(writes);
					assert.strictEqual(all.length, 1, "the daemon survived the failure and wrote the next state");
					assert.include(all[0] ?? "", "pass");
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("checks reads back the registry in first-report order, last write winning", () =>
			Effect.gen(function* () {
				const { layer } = yield* harness();
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("alpha", CheckReport.make({ state: "running" }));
					yield* doc.report("beta", CheckReport.make({ state: "running" }));
					yield* doc.report("alpha", CheckReport.make({ state: "fail", outcome: "boom" }));
					const checks = yield* doc.checks;
					assert.deepStrictEqual([...checks.keys()], ["alpha", "beta"]);
					assert.strictEqual(checks.get("alpha")?.state, "fail");
					assert.strictEqual(checks.get("alpha")?.outcome, "boom");
				}).pipe(Effect.provide(layer));
			}),
		);
	});

	describe("typed failures — every kind fires", () => {
		it.effect("kind render: a reported detail carrying a region marker is refused", () =>
			Effect.gen(function* () {
				const { layer } = yield* harness({
					render: () => [["body", `<!-- --- END ${NS}.${KEY}.body MANAGED REGION --- -->`]],
				});
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					const failure = yield* Effect.flip(doc.flush);
					assert.instanceOf(failure, CheckDocumentError);
					assert.strictEqual(failure.kind, "render");
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("kind sink: the write path's failure surfaces from flush", () =>
			Effect.gen(function* () {
				const { layer } = yield* harness({ sink: () => Effect.fail("403: resource not accessible") });
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					const failure = yield* Effect.flip(doc.flush);
					assert.strictEqual(failure.kind, "sink");
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("kind sink: a HUNG sink fails at the timeout bound instead of stalling the reconciler", () =>
			Effect.gen(function* () {
				// The pass holds the single permit and the finalizer's last flush
				// waits on it — unbounded, a sink that never resolves would stall
				// every later pass AND scope teardown. Hang only the FIRST call so
				// the finalizer's own flush can complete the teardown cleanly.
				const calls = yield* Ref.make(0);
				const { layer } = yield* harness({
					sink: () =>
						Effect.flatMap(
							Ref.updateAndGet(calls, (n) => n + 1),
							(n) => (n === 1 ? Effect.never : Effect.void),
						),
					sinkTimeout: "1 second",
				});
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					const flipped = yield* doc.flush.pipe(Effect.flip, Effect.forkChild);
					yield* TestClock.adjust("1 second");
					const failure = yield* Fiber.join(flipped);
					assert.instanceOf(failure, CheckDocumentError);
					assert.strictEqual(failure.kind, "sink");
				}).pipe(Effect.provide(layer));
			}),
		);
	});

	describe("the stamp ordering", () => {
		const stamp = (at: string, runId: string) => ({ at, runId });

		it("compares at as epoch when both sides parse — format differences do not order", () => {
			// The same instant spelled two ways is a TIE, decided by runId; a
			// lexical comparison would have ordered the strings instead.
			assert.isTrue(
				CheckDocumentStamp.isAtLeastAsRecent(
					stamp("2024-01-01T00:00:00.000Z", "2"),
					stamp("2024-01-01T00:00:00Z", "1"),
				),
			);
			assert.isFalse(
				CheckDocumentStamp.isAtLeastAsRecent(
					stamp("2024-01-01T00:00:00.000Z", "1"),
					stamp("2024-01-01T00:00:00Z", "2"),
				),
			);
			// And a genuinely later instant wins regardless of runId.
			assert.isTrue(
				CheckDocumentStamp.isAtLeastAsRecent(stamp("2024-01-02T00:00:00Z", "1"), stamp("2024-01-01T00:00:00Z", "999")),
			);
		});

		it("equal stamps compare at-least-as-recent — a run may refine its own regions", () => {
			assert.isTrue(
				CheckDocumentStamp.isAtLeastAsRecent(stamp("2024-01-01T00:00:00Z", "42"), stamp("2024-01-01T00:00:00Z", "42")),
			);
		});

		it("breaks at-ties on runId numerically when both parse — 10 beats 9", () => {
			const at = "2024-01-01T00:00:00Z";
			// Lexically "10" < "9"; numerically 10 > 9. The numeric order must win.
			assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "10"), stamp(at, "9")));
			assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "9"), stamp(at, "10")));
		});

		it("falls back to lexical runId order when either side is not a number", () => {
			const at = "2024-01-01T00:00:00Z";
			assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "run-b"), stamp(at, "run-a")));
			assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "run-a"), stamp(at, "run-b")));
		});

		it("falls back to lexical at order when either side does not parse as a date", () => {
			assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp("beta", "1"), stamp("alpha", "2")));
			assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp("alpha", "2"), stamp("beta", "1")));
		});

		it("treats a blank runId lexically, never as the number zero", () => {
			const at = "2024-01-01T00:00:00Z";
			// Number("") is a finite 0 — without the blank guard "" would compare
			// numerically equal to "0" and outrank "-1".
			assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, ""), stamp(at, "0")));
			assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "0"), stamp(at, "")));
			assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "-1"), stamp(at, "")));
			assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, ""), stamp(at, "")));
			assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, " "), stamp(at, "0")));
		});
	});

	describe("the staleness guard", () => {
		const NEWER = { at: "2024-01-02T00:00:00Z", runId: "200" };
		const OLDER = { at: "2024-01-01T00:00:00Z", runId: "100" };

		/**
		 * A layer over a SHARED live document — the sink's `read` sees what any
		 * other layer wrote, which is exactly the two-runs-one-document race the
		 * guard exists for. Each layer records its own writes.
		 */
		const sharedHarness = Effect.fn("sharedHarness")(function*(
			remote: Ref.Ref<string | undefined>,
			stamp?: { readonly at: string; readonly runId: string },
		) {
				const writes = yield* Ref.make<ReadonlyArray<string>>([]);
				const layer = CheckDocument.layer({
					namespace: NS,
					key: KEY,
					render: perCheck,
					sink: {
						write: (rendered) =>
							Ref.set(remote, rendered).pipe(Effect.andThen(Ref.update(writes, (all) => [...all, rendered]))),
						read: Ref.get(remote),
					},
					...(stamp === undefined ? {} : { stamp }),
					debounce: { quiet: "500 millis", maxWait: "3 seconds" },
				});
				return { writes, layer };
			});

		it.effect("an older run's pass against a newer document is dropped — the #284 race", () =>
			Effect.gen(function* () {
				const remote = yield* Ref.make<string | undefined>(undefined);
				const newer = yield* sharedHarness(remote, NEWER);
				const older = yield* sharedHarness(remote, OLDER);

				// The newer run writes first.
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "newer run" }));
					assert.strictEqual(yield* doc.flush, "written");
				}).pipe(Effect.provide(newer.layer));
				const afterNewer = yield* Ref.get(remote);

				// The delayed older run flushes against the live document.
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "fail", outcome: "stale rerun" }));
					assert.strictEqual(yield* doc.flush, "stale");
				}).pipe(Effect.provide(older.layer));

				assert.deepStrictEqual(yield* Ref.get(older.writes), [], "the stale run must not write");
				assert.strictEqual(yield* Ref.get(remote), afterNewer, "the newer run's document is intact");
				const parsed = Result.getOrThrow(
					ManagedDocument.parseResult({ namespace: NS, key: KEY, text: afterNewer ?? "" }),
				);
				assert.deepStrictEqual(parsed.region("check-build"), O.some("pass — newer run"));
			}),
		);

		it.effect("a run that stays stale announces the drop once — repeats fall to debug", () =>
			Effect.gen(function* () {
				const lines = yield* Ref.make<ReadonlyArray<string>>([]);
				const collector = Logger.make((entry) =>
					MutableRef.update(lines.ref, (all) => [...all, String(entry.message)]),
				);
				const remote = yield* Ref.make<string | undefined>(undefined);
				const newer = yield* sharedHarness(remote, NEWER);
				const older = yield* sharedHarness(remote, OLDER);

				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "newer run" }));
					assert.strictEqual(yield* doc.flush, "written");
				}).pipe(Effect.provide(newer.layer));

				// The stale run flushes twice — the report-driven pass plus an
				// explicit flush is the pair the consumer observed logging twice.
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "fail", outcome: "stale rerun" }));
					assert.strictEqual(yield* doc.flush, "stale");
					assert.strictEqual(yield* doc.flush, "stale");
				}).pipe(Effect.provide(older.layer), Effect.provide(Logger.layer([collector])));

				// The debug-level repeat is below the default minimum level, so the
				// consumer-visible count across both stale passes is exactly one.
				const dropped = (yield* Ref.get(lines)).filter((line) => line.includes("pass dropped"));
				assert.strictEqual(dropped.length, 1, "one INFO drop line across two stale passes");
			}),
		);

		it.effect("a newer run's pass against an older document writes and replaces", () =>
			Effect.gen(function* () {
				const remote = yield* Ref.make<string | undefined>(undefined);
				const older = yield* sharedHarness(remote, OLDER);
				const newer = yield* sharedHarness(remote, NEWER);

				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "running", outcome: "older run" }));
					assert.strictEqual(yield* doc.flush, "written");
				}).pipe(Effect.provide(older.layer));

				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "newer run" }));
					assert.strictEqual(yield* doc.flush, "written");
				}).pipe(Effect.provide(newer.layer));

				const final = (yield* Ref.get(remote)) ?? "";
				const parsed = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: final }));
				assert.deepStrictEqual(parsed.region("check-build"), O.some("pass — newer run"));
				assert.deepStrictEqual(
					parsed.entry("check-build"),
					O.some({ content: "pass — newer run", meta: { at: NEWER.at, runId: NEWER.runId } }),
				);
			}),
		);

		it.effect("an equal stamp passes — a run refines its own regions", () =>
			Effect.gen(function* () {
				const remote = yield* Ref.make<string | undefined>(undefined);
				const first = yield* sharedHarness(remote, NEWER);
				const second = yield* sharedHarness(remote, NEWER);

				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "running" }));
					assert.strictEqual(yield* doc.flush, "written");
				}).pipe(Effect.provide(first.layer));

				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					assert.strictEqual(yield* doc.flush, "written");
				}).pipe(Effect.provide(second.layer));

				const final = (yield* Ref.get(remote)) ?? "";
				assert.include(final, "pass");
			}),
		);

		it.effect("regions carrying no stamp are not evidence of a newer run", () =>
			Effect.gen(function* () {
				const remote = yield* Ref.make<string | undefined>(undefined);
				// An unstamped layer writes first — the pre-stamp world.
				const unstamped = yield* sharedHarness(remote);
				const stamped = yield* sharedHarness(remote, OLDER);

				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "running" }));
					assert.strictEqual(yield* doc.flush, "written");
				}).pipe(Effect.provide(unstamped.layer));

				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					assert.strictEqual(yield* doc.flush, "written", "no stamp on the document, so any stamped pass may write");
				}).pipe(Effect.provide(stamped.layer));
			}),
		);

		it.effect("a byte-identical pass reports unchanged — the stamp does not defeat suppression", () =>
			Effect.gen(function* () {
				const remote = yield* Ref.make<string | undefined>(undefined);
				const { writes, layer } = yield* sharedHarness(remote, NEWER);
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					assert.strictEqual(yield* doc.flush, "written");
					// The same state, the same per-run stamp: byte-identical render.
					assert.strictEqual(yield* doc.flush, "unchanged");
					assert.strictEqual((yield* Ref.get(writes)).length, 1);
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("kind read: a failing read-back surfaces from flush", () =>
			Effect.gen(function* () {
				const layer = CheckDocument.layer({
					namespace: NS,
					key: KEY,
					render: perCheck,
					sink: { write: () => Effect.void, read: Effect.fail("404: comment vanished") },
					debounce: { quiet: "500 millis", maxWait: "3 seconds" },
				});
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					const failure = yield* Effect.flip(doc.flush);
					assert.instanceOf(failure, CheckDocumentError);
					assert.strictEqual(failure.kind, "read");
				}).pipe(Effect.provide(layer));
			}),
		);

		it.effect("the function-form sink still reports written and unchanged outcomes", () =>
			Effect.gen(function* () {
				const { writes, layer } = yield* harness();
				yield* Effect.gen(function* () {
					const doc = yield* CheckDocument;
					yield* doc.report("build", CheckReport.make({ state: "pass" }));
					assert.strictEqual(yield* doc.flush, "written");
					assert.strictEqual(yield* doc.flush, "unchanged");
					assert.strictEqual((yield* Ref.get(writes)).length, 1);
				}).pipe(Effect.provide(layer));
			}),
		);
	});

	describe("test double", () => {
		it.effect("an unstubbed member dies loudly, naming itself", () =>
			Effect.gen(function* () {
				const doc = yield* CheckDocument;
				const exit = yield* Effect.exit(doc.report("build", CheckReport.make({ state: "pass" })));
				assert.isTrue(exit._tag === "Failure");
			}).pipe(Effect.provide(CheckDocument.layerTest())),
		);

		it.effect("layerTest serves a stubbed member", () =>
			Effect.gen(function* () {
				const doc = yield* CheckDocument;
				yield* doc.report("build", CheckReport.make({ state: "pass" }));
			}).pipe(Effect.provide(CheckDocument.layerTest({ report: () => Effect.void }))),
		);

		it.effect("a stubbed flush carries the outcome type", () =>
			Effect.gen(function* () {
				const doc = yield* CheckDocument;
				assert.strictEqual(yield* doc.flush, "unchanged");
			}).pipe(Effect.provide(CheckDocument.layerTest({ flush: Effect.succeed("unchanged" as const) }))),
		);
	});
});
