import {
  CheckDocument,
  CheckDocumentError,
  CheckDocumentSnapshot,
  CheckDocumentStamp,
  CheckFlushOutcome,
  CheckReport,
} from "@beep/github-reporting/CheckDocument";
import { ManagedDocument } from "@beep/github-reporting/ManagedDocument";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { deliberatelyInvalid } from "./support/deliberatelyInvalid.ts";
import type * as Duration from "effect/Duration";

const NS = "savvy-web";
const KEY = "release-validation";

const withLayer = <ROut, EIn, RIn>(layer: Layer.Layer<ROut, EIn, RIn>) =>
  Effect.fn("CheckDocument.test.withLayer")(<A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.scopedWith((scope) =>
      Effect.flatMap(Layer.buildWithScope(layer, scope), (context) => Effect.provideContext(self, context))
    )
  );

const perCheck = ({ checks, order }: CheckDocumentSnapshot): ReadonlyArray<readonly [string, string]> =>
  A.map(order, (check) => {
    const entry = HashMap.getUnsafe(checks, check);
    return [`check-${check}`, `${entry.state}${entry.outcome === undefined ? "" : ` — ${entry.outcome}`}`];
  });

interface HarnessOptions {
  readonly initial?: string;
  readonly maxWait?: Duration.Input;
  readonly quiet?: Duration.Input;
  readonly render?: (snapshot: CheckDocumentSnapshot) => ReadonlyArray<readonly [string, string]>;
  readonly sink?: (rendered: string) => Effect.Effect<unknown, unknown>;
  readonly sinkTimeout?: Duration.Input;
}

const harness = Effect.fn("harness")(function* (options: HarnessOptions = {}) {
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
          assert.strictEqual(
            all.length,
            1,
            "one write for the burst, carrying its final state; a leading-edge debounce would publish pass and leave it"
          );
          const text = all[0] ?? "";
          assert.include(text, "fail");
          assert.notInclude(text, "pass");
        }).pipe(withLayer(layer));
      })
    );

    it.effect("an invalid entry dies at the report call and leaves the registry usable", () =>
      Effect.gen(function* () {
        const { writes, layer } = yield* harness();
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          const exit = yield* Effect.exit(
            doc.report("build", deliberatelyInvalid<CheckReport>({ state: "not-a-state" }))
          );
          assert.isTrue(Exit.hasDies(exit));
          yield* doc.report("lint", CheckReport.make({ state: "pass" }));
          assert.deepStrictEqual(
            (yield* doc.checks).order,
            ["lint"],
            "the rejected entry never reached the registry, so later reports, reads and passes still work"
          );
          yield* TestClock.adjust("500 millis");
          assert.strictEqual((yield* Ref.get(writes)).length, 1);
        }).pipe(withLayer(layer));
      })
    );

    it.effect("nothing is written before the quiet window elapses", () =>
      Effect.gen(function* () {
        const { writes, layer } = yield* harness();
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "running" }));
          yield* TestClock.adjust("499 millis");
          const got = yield* Ref.get(writes);
          assert.deepStrictEqual(got, []);
          yield* TestClock.adjust("1 millis");
          assert.strictEqual((yield* Ref.get(writes)).length, 1);
        }).pipe(withLayer(layer));
      })
    );

    it.effect("reconciling unchanged state issues no write", () =>
      Effect.gen(function* () {
        const { writes, layer } = yield* harness();
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "clean" }));
          yield* TestClock.adjust("500 millis");
          assert.strictEqual((yield* Ref.get(writes)).length, 1);
          yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "clean" }));
          yield* TestClock.adjust("500 millis");
          yield* doc.flush;
          assert.strictEqual(
            (yield* Ref.get(writes)).length,
            1,
            "the same state renders a byte-identical document, so neither the debounced pass nor flush may write"
          );
        }).pipe(withLayer(layer));
      })
    );

    it.effect("a steady stream of reports still writes by maxWait — the staleness bound", () =>
      Effect.gen(function* () {
        const { writes, layer } = yield* harness({ quiet: "500 millis", maxWait: "2 seconds" });
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          for (let step = 0; step < 5; step += 1) {
            yield* doc.report("build", CheckReport.make({ state: "running", outcome: `step ${step}` }));
            yield* TestClock.adjust("400 millis");
          }
          const all = yield* Ref.get(writes);
          assert.strictEqual(
            all.length,
            1,
            "reports every 400ms never let the quiet window elapse: exactly one write, at the staleness bound"
          );
          assert.include(all[0] ?? "", "step 4", "and it carries the latest state, not the first");
        }).pipe(withLayer(layer));
      })
    );

    it.effect("a maxWait between quiet-window multiples flushes at its exact deadline", () =>
      Effect.gen(function* () {
        const { writes, layer } = yield* harness({ quiet: "500 millis", maxWait: "750 millis" });
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass" }));
          yield* TestClock.adjust("400 millis");
          yield* doc.report("build", CheckReport.make({ state: "fail" }));
          yield* TestClock.adjust("100 millis");
          const got1 = yield* Ref.get(writes);
          assert.deepStrictEqual(got1, [], "the report at 400ms prevents settling at 500ms");
          yield* TestClock.adjust("249 millis");
          const got2 = yield* Ref.get(writes);
          assert.deepStrictEqual(got2, [], "no write before the 750ms deadline");
          yield* TestClock.adjust("1 millis");
          const all = yield* Ref.get(writes);
          assert.strictEqual(all.length, 1, "exactly one write at 750ms, before the next full quiet interval");
          assert.include(all[0] ?? "", "fail", "the deadline flush carries the latest report");
          assert.notInclude(all[0] ?? "", "pass");
        }).pipe(withLayer(layer));
        assert.strictEqual((yield* Ref.get(writes)).length, 1, "scope finalization does not duplicate the write");
      })
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
          yield* doc.report("build", CheckReport.make({ state: "fail" }));
          yield* doc.flush;
          const all = yield* Ref.get(writes);
          assert.strictEqual(all.length, 2, "resolution is not terminal: the check resolves again");
          const final = all[1] ?? "";
          assert.strictEqual(
            Str.split(final, `BEGIN ${NS}.${KEY}.check-build`).length - 1,
            1,
            "one region for the check, not one per resolution"
          );
          const parsed = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: final }));
          assert.deepStrictEqual(parsed.region("check-build"), O.some("fail"));
        }).pipe(withLayer(layer));
      })
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
        }).pipe(withLayer(layer));
      })
    );
  });

  describe("lifecycle", () => {
    it.effect("the scope closing inside the quiet window still lands the final state", () =>
      Effect.gen(function* () {
        const { writes, layer } = yield* harness();
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass" }));
        }).pipe(withLayer(layer));
        const all = yield* Ref.get(writes);
        assert.strictEqual(all.length, 1, "the finalizer flushed the last burst");
        assert.include(all[0] ?? "", "pass");
      })
    );

    it.effect("a failing background pass is retried, not fatal", () =>
      Effect.gen(function* () {
        const broken = yield* Ref.make(true);
        const writes = yield* Ref.make<ReadonlyArray<string>>([]);
        const layer = CheckDocument.layer({
          namespace: NS,
          key: KEY,
          render: perCheck,
          sink: Effect.fn("sink")(function* (rendered) {
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
          const got3 = yield* Ref.get(writes);
          assert.deepStrictEqual(got3, [], "the write failed and was logged");
          yield* Ref.set(broken, false);
          yield* doc.report("build", CheckReport.make({ state: "pass" }));
          yield* TestClock.adjust("500 millis");
          const all = yield* Ref.get(writes);
          assert.strictEqual(all.length, 1, "the daemon survived the failure and wrote the next state");
          assert.include(all[0] ?? "", "pass");
        }).pipe(withLayer(layer));
      })
    );

    it.effect("checks reads back the registry in first-report order, last write winning", () =>
      Effect.gen(function* () {
        const { writes, layer } = yield* harness();
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("alpha", CheckReport.make({ state: "running" }));
          yield* doc.report("beta", CheckReport.make({ state: "running" }));
          const before = yield* doc.checks;
          yield* doc.report("alpha", CheckReport.make({ state: "fail", outcome: "boom" }));
          const { checks, order } = yield* doc.checks;
          assert.isTrue(HashMap.isHashMap(checks));
          assert.deepStrictEqual(order, ["alpha", "beta"]);
          assert.deepStrictEqual(
            O.map(HashMap.get(checks, "alpha"), (entry) => entry.state),
            O.some("fail")
          );
          assert.deepStrictEqual(
            O.map(HashMap.get(checks, "alpha"), (entry) => entry.outcome),
            O.some("boom")
          );
          assert.deepStrictEqual(
            O.map(HashMap.get(before.checks, "alpha"), (entry) => entry.state),
            O.some("running")
          );
          assert.deepStrictEqual(before.order, ["alpha", "beta"]);
          yield* doc.flush;
          const document = Result.getOrThrow(
            ManagedDocument.parseResult({ namespace: NS, key: KEY, text: (yield* Ref.get(writes))[0] ?? "" })
          );
          assert.deepStrictEqual(
            A.map(document.regions, (region) => region.key),
            ["check-alpha", "check-beta"]
          );
        }).pipe(withLayer(layer));
      })
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
        }).pipe(withLayer(layer));
      })
    );

    it.effect("kind sink: the write path's failure surfaces from flush", () =>
      Effect.gen(function* () {
        const { layer } = yield* harness({ sink: () => Effect.fail("403: resource not accessible") });
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass" }));
          const failure = yield* Effect.flip(doc.flush);
          assert.strictEqual(failure.kind, "sink");
        }).pipe(withLayer(layer));
      })
    );

    it.effect("kind sink: a HUNG sink fails at the timeout bound instead of stalling the reconciler", () =>
      Effect.gen(function* () {
        const calls = yield* Ref.make(0);
        const sinkHangingOnFirstCall = () =>
          Effect.flatMap(
            Ref.updateAndGet(calls, (n) => n + 1),
            (n) => (n === 1 ? Effect.never : Effect.void)
          );
        const { layer } = yield* harness({
          sink: sinkHangingOnFirstCall,
          sinkTimeout: "1 second",
        });
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass" }));
          const flipped = yield* doc.flush.pipe(Effect.flip, Effect.forkChild);
          yield* TestClock.adjust("1 second");
          const failure = yield* Fiber.join(flipped);
          assert.instanceOf(failure, CheckDocumentError);
          assert.strictEqual(
            failure.kind,
            "sink",
            "the pass holds the permit the final flush waits on, so an unbounded hung sink would stall every pass and teardown"
          );
        }).pipe(withLayer(layer));
      })
    );
  });

  describe("the stamp ordering", () => {
    const stamp = (at: string, runId: string) => ({ at, runId });

    it("compares at as epoch when both sides parse — format differences do not order", () => {
      assert.isTrue(
        CheckDocumentStamp.isAtLeastAsRecent(
          stamp("2024-01-01T00:00:00.000Z", "2"),
          stamp("2024-01-01T00:00:00Z", "1")
        ),
        "the same instant spelled two ways is a tie decided by runId, not a lexical order"
      );
      assert.isFalse(
        CheckDocumentStamp.isAtLeastAsRecent(stamp("2024-01-01T00:00:00.000Z", "1"), stamp("2024-01-01T00:00:00Z", "2"))
      );
      assert.isTrue(
        CheckDocumentStamp.isAtLeastAsRecent(stamp("2024-01-02T00:00:00Z", "1"), stamp("2024-01-01T00:00:00Z", "999")),
        "a genuinely later instant wins regardless of runId"
      );
    });

    it("equal stamps compare at-least-as-recent — a run may refine its own regions", () => {
      assert.isTrue(
        CheckDocumentStamp.isAtLeastAsRecent(stamp("2024-01-01T00:00:00Z", "42"), stamp("2024-01-01T00:00:00Z", "42"))
      );
    });

    it("breaks at-ties on runId numerically when both parse — 10 beats 9", () => {
      const at = "2024-01-01T00:00:00Z";
      assert.isTrue(
        CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "10"), stamp(at, "9")),
        'lexically "10" < "9"; the numeric order must win'
      );
      assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "9"), stamp(at, "10")));
    });

    it("orders adjacent decimal runIds beyond the safe-integer range in both directions", () => {
      const at = "2024-01-01T00:00:00Z";
      assert.isFalse(
        CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "9007199254740992"), stamp(at, "9007199254740993"))
      );
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "9007199254740993"), stamp(at, "9007199254740992")));
      assert.isFalse(
        CheckDocumentStamp.isAtLeastAsRecent(
          stamp(at, "999999999999999999999999999999"),
          stamp(at, "1000000000000000000000000000000")
        )
      );
      assert.isTrue(
        CheckDocumentStamp.isAtLeastAsRecent(
          stamp(at, "1000000000000000000000000000000"),
          stamp(at, "999999999999999999999999999999")
        )
      );
    });

    it("preserves decimal signs, leading zeros and whitespace without rounding", () => {
      const at = "2024-01-01T00:00:00Z";
      assert.isFalse(
        CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "-9007199254740993"), stamp(at, "-9007199254740992"))
      );
      assert.isTrue(
        CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "-9007199254740992"), stamp(at, "-9007199254740993"))
      );
      assert.isTrue(
        CheckDocumentStamp.isAtLeastAsRecent(stamp(at, " +0009007199254740993 "), stamp(at, "9007199254740993"))
      );
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "-0"), stamp(at, "+000")));
    });

    it("preserves numeric fallback for non-decimal spellings and lexical fallback for non-finite values", () => {
      const at = "2024-01-01T00:00:00Z";
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "1e1"), stamp(at, "9")));
      assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "9"), stamp(at, "1e1")));
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "0x10"), stamp(at, "15")));
      assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "15"), stamp(at, "0x10")));
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "9.5"), stamp(at, "9")));
      assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "9"), stamp(at, "9.5")));
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "Infinity"), stamp(at, "10")));
      assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "10"), stamp(at, "Infinity")));
    });

    it("interprets zone-less stamps as UTC and compares explicit offsets by instant", () => {
      assert.isTrue(
        CheckDocumentStamp.isAtLeastAsRecent(stamp("2024-01-01T00:00:00", "2"), stamp("2024-01-01T00:00:00Z", "1"))
      );
      assert.isFalse(
        CheckDocumentStamp.isAtLeastAsRecent(stamp("2024-01-01T00:00:00", "1"), stamp("2024-01-01T00:00:00Z", "2"))
      );
      assert.isTrue(
        CheckDocumentStamp.isAtLeastAsRecent(
          stamp("2024-01-01T01:00:00+01:00", "2"),
          stamp("2024-01-01T00:00:00Z", "1")
        )
      );
      assert.isFalse(
        CheckDocumentStamp.isAtLeastAsRecent(
          stamp("2024-01-01T01:00:00+01:00", "1"),
          stamp("2024-01-01T00:00:00Z", "2")
        )
      );
    });

    it("uses lexical at order when exactly one stamp is invalid, ignoring runId", () => {
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp("invalid", "1"), stamp("2024-01-01T00:00:00Z", "999")));
      assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp("2024-01-01T00:00:00Z", "999"), stamp("invalid", "1")));
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp("invalid", "2"), stamp("invalid", "1")));
      assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp("invalid", "1"), stamp("invalid", "2")));
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
      assert.isFalse(
        CheckDocumentStamp.isAtLeastAsRecent(stamp(at, ""), stamp(at, "0")),
        'Number("") is a finite 0, so a numeric blank would tie "0" and outrank "-1"'
      );
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "0"), stamp(at, "")));
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, "-1"), stamp(at, "")));
      assert.isTrue(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, ""), stamp(at, "")));
      assert.isFalse(CheckDocumentStamp.isAtLeastAsRecent(stamp(at, " "), stamp(at, "0")));
    });
  });

  describe("the staleness guard", () => {
    const NEWER = { at: "2024-01-02T00:00:00Z", runId: "200" };
    const OLDER = { at: "2024-01-01T00:00:00Z", runId: "100" };

    const sharedLiveDocumentHarness = Effect.fn("sharedLiveDocumentHarness")(function* (
      remote: Ref.Ref<string | undefined>,
      stamp?: { readonly at: string; readonly runId: string }
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
        const newer = yield* sharedLiveDocumentHarness(remote, NEWER);
        const older = yield* sharedLiveDocumentHarness(remote, OLDER);

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "newer run" }));
          const newerRunFlush = yield* doc.flush;
          assert.strictEqual(newerRunFlush, "written");
        }).pipe(withLayer(newer.layer));
        const afterNewer = yield* Ref.get(remote);

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "fail", outcome: "stale rerun" }));
          const delayedOlderRunFlush = yield* doc.flush;
          assert.strictEqual(delayedOlderRunFlush, "stale");
        }).pipe(withLayer(older.layer));

        const got6 = yield* Ref.get(older.writes);
        assert.deepStrictEqual(got6, [], "the stale run must not write");
        const got7 = yield* Ref.get(remote);
        assert.strictEqual(got7, afterNewer, "the newer run's document is intact");
        const parsed = Result.getOrThrow(
          ManagedDocument.parseResult({ namespace: NS, key: KEY, text: afterNewer ?? "" })
        );
        assert.deepStrictEqual(parsed.region("check-build"), O.some("pass — newer run"));
      })
    );

    it.effect("a run that stays stale announces the drop once — repeats fall to debug", () =>
      Effect.gen(function* () {
        const lines = yield* Ref.make<ReadonlyArray<string>>([]);
        const collector = Logger.make((entry) =>
          MutableRef.update(lines.ref, (all) => [...all, String(entry.message)])
        );
        const remote = yield* Ref.make<string | undefined>(undefined);
        const newer = yield* sharedLiveDocumentHarness(remote, NEWER);
        const older = yield* sharedLiveDocumentHarness(remote, OLDER);

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "newer run" }));
          const flush8 = yield* doc.flush;
          assert.strictEqual(flush8, "written");
        }).pipe(withLayer(newer.layer));

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "fail", outcome: "stale rerun" }));
          const flush9 = yield* doc.flush;
          assert.strictEqual(flush9, "stale");
          const flush10 = yield* doc.flush;
          assert.strictEqual(flush10, "stale");
        }).pipe(withLayer(older.layer), withLayer(Logger.layer([collector])));

        const got11 = yield* Ref.get(lines);
        const dropped = A.filter(got11, Str.includes("pass dropped"));
        assert.strictEqual(
          dropped.length,
          1,
          "the debug-level repeat is below the default minimum level: one INFO drop line across two stale passes"
        );
      })
    );

    it.effect("a newer run's pass against an older document writes and replaces", () =>
      Effect.gen(function* () {
        const remote = yield* Ref.make<string | undefined>(undefined);
        const older = yield* sharedLiveDocumentHarness(remote, OLDER);
        const newer = yield* sharedLiveDocumentHarness(remote, NEWER);

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "running", outcome: "older run" }));
          const flush12 = yield* doc.flush;
          assert.strictEqual(flush12, "written");
        }).pipe(withLayer(older.layer));

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass", outcome: "newer run" }));
          const flush13 = yield* doc.flush;
          assert.strictEqual(flush13, "written");
        }).pipe(withLayer(newer.layer));

        const final = (yield* Ref.get(remote)) ?? "";
        const parsed = Result.getOrThrow(ManagedDocument.parseResult({ namespace: NS, key: KEY, text: final }));
        assert.deepStrictEqual(parsed.region("check-build"), O.some("pass — newer run"));
        assert.deepStrictEqual(
          parsed.entry("check-build"),
          O.some({ content: "pass — newer run", meta: { at: NEWER.at, runId: NEWER.runId } })
        );
      })
    );

    it.effect("an equal stamp passes — a run refines its own regions", () =>
      Effect.gen(function* () {
        const remote = yield* Ref.make<string | undefined>(undefined);
        const first = yield* sharedLiveDocumentHarness(remote, NEWER);
        const second = yield* sharedLiveDocumentHarness(remote, NEWER);

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "running" }));
          const flush14 = yield* doc.flush;
          assert.strictEqual(flush14, "written");
        }).pipe(withLayer(first.layer));

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass" }));
          const flush15 = yield* doc.flush;
          assert.strictEqual(flush15, "written");
        }).pipe(withLayer(second.layer));

        const final = (yield* Ref.get(remote)) ?? "";
        assert.include(final, "pass");
      })
    );

    it.effect("regions carrying no stamp are not evidence of a newer run", () =>
      Effect.gen(function* () {
        const remote = yield* Ref.make<string | undefined>(undefined);
        const unstamped = yield* sharedLiveDocumentHarness(remote);
        const stamped = yield* sharedLiveDocumentHarness(remote, OLDER);

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "running" }));
          const flush16 = yield* doc.flush;
          assert.strictEqual(flush16, "written", "an unstamped layer writes first, as before stamps existed");
        }).pipe(withLayer(unstamped.layer));

        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass" }));
          const flush17 = yield* doc.flush;
          assert.strictEqual(flush17, "written", "no stamp on the document, so any stamped pass may write");
        }).pipe(withLayer(stamped.layer));
      })
    );

    it.effect("a byte-identical pass reports unchanged — the stamp does not defeat suppression", () =>
      Effect.gen(function* () {
        const remote = yield* Ref.make<string | undefined>(undefined);
        const { writes, layer } = yield* sharedLiveDocumentHarness(remote, NEWER);
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass" }));
          const flush18 = yield* doc.flush;
          assert.strictEqual(flush18, "written");
          const flush19 = yield* doc.flush;
          assert.strictEqual(flush19, "unchanged", "the same state and per-run stamp render byte-identical text");
          assert.strictEqual((yield* Ref.get(writes)).length, 1);
        }).pipe(withLayer(layer));
      })
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
        }).pipe(withLayer(layer));
      })
    );

    it.effect("the function-form sink still reports written and unchanged outcomes", () =>
      Effect.gen(function* () {
        const { writes, layer } = yield* harness();
        yield* Effect.gen(function* () {
          const doc = yield* CheckDocument;
          yield* doc.report("build", CheckReport.make({ state: "pass" }));
          const flush20 = yield* doc.flush;
          assert.strictEqual(flush20, "written");
          const flush21 = yield* doc.flush;
          assert.strictEqual(flush21, "unchanged");
          assert.strictEqual((yield* Ref.get(writes)).length, 1);
        }).pipe(withLayer(layer));
      })
    );
  });

  describe("test double", () => {
    it.effect("an unstubbed member dies loudly, naming itself", () =>
      Effect.gen(function* () {
        const doc = yield* CheckDocument;
        const exit = yield* Effect.exit(doc.report("build", CheckReport.make({ state: "pass" })));
        assert.isTrue(exit._tag === "Failure");
      }).pipe(withLayer(CheckDocument.layerTest()))
    );

    it.effect("layerTest serves a stubbed member", () =>
      Effect.gen(function* () {
        const doc = yield* CheckDocument;
        yield* doc.report("build", CheckReport.make({ state: "pass" }));
      }).pipe(
        withLayer(CheckDocument.layerTest({ report: dual(2, (_check: string, _report: CheckReport) => Effect.void) }))
      )
    );

    it.effect("a stubbed flush carries the outcome type", () =>
      Effect.gen(function* () {
        const doc = yield* CheckDocument;
        const flush22 = yield* doc.flush;
        assert.strictEqual(flush22, "unchanged");
      }).pipe(withLayer(CheckDocument.layerTest({ flush: Effect.succeed("unchanged" as const) })))
    );
  });
});

describe("CheckFlushOutcome schema contract", () => {
  it.effect("accepts exactly the three reconciliation outcomes", () =>
    Effect.gen(function* () {
      for (const outcome of ["written", "unchanged", "stale"]) {
        const value = yield* S.decodeUnknownEffect(CheckFlushOutcome)(outcome);
        assert.strictEqual(value, outcome);
      }
      assert.strictEqual(CheckFlushOutcome.literals.length, 3);
      assert.isFalse(S.is(CheckFlushOutcome)("failed"));
      assert.isFalse(S.is(CheckFlushOutcome)(undefined));
    })
  );
});

describe("Opaque conformance (W3-b)", () => {
  it("make copies plain records and S.is accepts them structurally", () => {
    const input = { state: "pass", outcome: "clean" } as const;
    const report = CheckReport.make(input);
    assert.notStrictEqual<object>(report, input);
    assert.deepStrictEqual<object>(report, input);
    assert.isTrue(S.is(CheckReport)({ state: "pass" }));
    assert.isTrue(S.is(CheckDocumentStamp)({ at: "2026-01-01T00:00:00Z", runId: "1" }));
    assert.isTrue(
      S.is(CheckDocumentSnapshot)({ checks: HashMap.make(["build", { state: "pass" }]), order: ["build"] })
    );
    assert.isFalse(S.is(CheckReport)({ state: "cancelled" }));
  });

  it.effect("each checks read admits a fresh snapshot from plain registry state", () =>
    Effect.gen(function* () {
      const { layer } = yield* harness();
      yield* Effect.gen(function* () {
        const doc = yield* CheckDocument;
        yield* doc.report("build", CheckReport.make({ state: "pass" }));
        const first = yield* doc.checks;
        const second = yield* doc.checks;
        assert.notStrictEqual(first, second);
        assert.deepStrictEqual(first.order, second.order);
        assert.isTrue(S.is(CheckDocumentSnapshot)(first));
      }).pipe(withLayer(layer));
    })
  );
});
