import { CitationBuiltinCleaners } from "@beep/law-practice-server/internal/Citation/BuiltinCleaners";
import {
  CitationCleanerRuntime,
  makeCitationCleanerPipeline,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import {
  CitationCleanerProtocols,
  makeCitationCleanerRegistry,
} from "@beep/law-practice-server/internal/Citation/CleanerRegistry";
import { CitationCleanerValues } from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { makeCitationDocumentCleanerProtocols } from "@beep/law-practice-server/internal/Citation/DocumentCleanerProtocols";
import { CitationDocumentInputProtocols } from "@beep/law-practice-server/internal/Citation/InputDocument";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Scope from "effect/Scope";
import { makeCitationCleanerRegistryHarness } from "./CitationCleanerRegistry.fixtures.ts";

const setup = Effect.fn("DocumentCleanerProtocolsTest.setup")(function* (
  host?: CitationDocumentInputProtocols["Service"],
  iterations?: number
) {
  const h = yield* makeCitationCleanerRegistryHarness();
  const policy = yield* defaultCitationEnginePolicy;
  const make = makeCitationDocumentCleanerProtocols({
    ...policy.limits,
    resolutionIterations: iterations ?? policy.limits.resolutionIterations,
  }).pipe(
    Effect.provideService(CitationCleanerValues, h.values),
    Effect.provideService(CitationCleanerProtocols, h.protocols)
  );
  const adapter = yield* host === undefined
    ? make
    : make.pipe(Effect.provideService(CitationDocumentInputProtocols, host));
  const registry = yield* makeCitationCleanerRegistry(policy.limits).pipe(
    Effect.provideService(CitationCleanerValues, h.values),
    Effect.provideService(CitationBuiltinCleaners, h.builtins),
    Effect.provideService(CitationCleanerProtocols, adapter.cleaner)
  );
  const pipeline = yield* makeCitationCleanerPipeline(policy.limits).pipe(
    Effect.provideService(CitationCleanerRuntime, registry.runtime)
  );
  return { h, policy, adapter, pipeline };
});

it.effect("shares named tuple authority with the real cleaner and starts fresh iteration on each opening", () =>
  Effect.gen(function* () {
    const { h, adapter, pipeline } = yield* setup();
    const configuredNames = ["underscores"];
    const steps = yield* adapter.create({ kind: "tuple", names: configuredNames });
    configuredNames[0] = "html";
    const observed1 = yield* adapter.document.truth(steps);
    expect(observed1).toBe(true);
    const observed2 = yield* adapter.document.containsHtml(steps);
    expect(observed2).toBe(false);
    const plan = yield* adapter.document.plan(steps);
    const source = yield* h.values.sourceText("__A__");
    for (const _attempt of [0, 1]) {
      const result = yield* pipeline.runOwned({ value: source, plan });
      const text = yield* h.values.getText(result.value);
      expect(O.getOrThrow(text).text).toBe("A");
      expect(result.producedTextUtf16).toBe(1);
    }
    const observed3 = yield* h.calls;
    expect(observed3).toEqual([]);
  })
);

it.effect("retains exact list/tuple insertion errors, empty truth and original container ownership", () =>
  Effect.gen(function* () {
    const { h, adapter } = yield* setup();
    const list = yield* adapter.create({ kind: "list", names: [] });
    const tuple = yield* adapter.create({ kind: "tuple", names: ["html"] });
    const observed4 = yield* adapter.document.truth(list);
    expect(observed4).toBe(false);
    const observed5 = yield* adapter.document.containsHtml(tuple);
    expect(observed5).toBe(true);
    const listFailure = yield* adapter.document.insertSourceHtml(list).pipe(Effect.flip);
    const tupleFailure = yield* adapter.document.insertSourceHtml(tuple).pipe(Effect.flip);
    expect(listFailure).toMatchObject({ sourceError: "TypeError" });
    expect(tupleFailure).toMatchObject({ sourceError: "AttributeError" });
    const observed6 = yield* adapter.document.truth(list);
    expect(observed6).toBe(false);
    const other = yield* makeCitationCleanerRegistryHarness();
    const forgedOwner = yield* other.values.sourceText("html");
    const invalid = yield* adapter.document.containsHtml(forgedOwner).pipe(Effect.flip);
    expect(invalid).toMatchObject({ reason: "unissued-value" });
    const empty = yield* h.values.sourceText("");
    const observed7 = yield* adapter.document.truth(empty);
    expect(observed7).toBe(false);
  })
);

it.effect("delegates host containers without inspection and preserves plan laziness", () =>
  Effect.gen(function* () {
    const failure = new Error("host defect must not be touched during plan selection");
    let calls = 0;
    const host = CitationDocumentInputProtocols.of({
      truth: Effect.fn("DocumentCleanerProtocolsTest.hostTruth")(() => Effect.succeed(false)),
      containsHtml: Effect.fn("DocumentCleanerProtocolsTest.hostContains")(() => Effect.succeed(true)),
      insertSourceHtml: Effect.fn("DocumentCleanerProtocolsTest.hostInsert")(() => Effect.die(failure)),
      plan: Effect.fn("DocumentCleanerProtocolsTest.hostPlan")(() =>
        Effect.sync(() => {
          calls++;
          return "host-plan";
        })
      ),
      warnHtmlAdded: Effect.void,
    });

    const { h, adapter } = yield* setup(host);
    const value = yield* h.values.retainHost(
      Object.defineProperty({}, "then", {
        get: () => {
          throw failure;
        },
      })
    );
    const observed8 = yield* adapter.document.truth(value);
    expect(observed8).toBe(false);
    const observed9 = yield* adapter.document.containsHtml(value);
    expect(observed9).toBe(true);
    const observed10 = yield* adapter.document.plan(value);
    expect(observed10).toBe("host-plan");
    expect(calls).toBe(1);
  })
);

it.effect("invalidates issued containers when the capturing scope closes", () =>
  Effect.gen(function* () {
    const { h, policy } = yield* setup();
    const owner = yield* Scope.make();
    const adapter = yield* makeCitationDocumentCleanerProtocols(policy.limits).pipe(
      Effect.provideService(Scope.Scope, owner),
      Effect.provideService(CitationCleanerValues, h.values),
      Effect.provideService(CitationCleanerProtocols, h.protocols)
    );
    const value = yield* adapter.create({ kind: "list", names: [] });
    yield* Scope.close(owner, Exit.void);
    const result = yield* adapter.document.truth(value).pipe(Effect.flip);
    expect(result).toMatchObject({ reason: "closed-owner" });
  })
);

it.effect("refuses complete container work before issuing any values", () =>
  Effect.gen(function* () {
    const { h, adapter } = yield* setup(undefined, 2);
    const before = yield* h.values.snapshot;
    const result = yield* adapter.create({ kind: "list", names: ["html", "underscores"] }).pipe(Effect.flip);
    expect(result).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "resolutionIterations" });
    const after = yield* h.values.snapshot;
    expect(after).toEqual(before);
  })
);

it.effect("shares membership consumption with cleaning and never restarts an exhausted named generator", () =>
  Effect.gen(function* () {
    const { h, adapter, pipeline } = yield* setup();
    const steps = yield* adapter.create({ kind: "generator", names: ["html", "underscores"] });
    const created = yield* adapter.inspect(steps);
    expect(O.getOrThrow(O.getOrThrow(created).generator)).toEqual({ position: 0, state: "GEN_CREATED" });
    const found = yield* adapter.document.containsHtml(steps);
    expect(found).toBe(true);
    const suspended = yield* adapter.inspect(steps);
    expect(O.getOrThrow(O.getOrThrow(suspended).generator)).toEqual({ position: 1, state: "GEN_SUSPENDED" });
    const plan = yield* adapter.document.plan(steps);
    const source = yield* h.values.sourceText("__A__");
    const first = yield* pipeline.runOwned({ value: source, plan });
    const text = yield* h.values.getText(first.value);
    expect(O.getOrThrow(text).text).toBe("A");
    const second = yield* pipeline.runOwned({ value: source, plan });
    expect(second.value).toBe(source);
    const closed = yield* adapter.inspect(steps);
    expect(O.getOrThrow(O.getOrThrow(closed).generator)).toEqual({ position: 2, state: "GEN_CLOSED" });
    const truth = yield* adapter.document.truth(steps);
    expect(truth).toBe(true);
  })
);

it.effect("closes an empty named generator on membership without changing its truth or insertion failure", () =>
  Effect.gen(function* () {
    const { adapter } = yield* setup();
    const steps = yield* adapter.create({ kind: "generator", names: [] });
    const truth = yield* adapter.document.truth(steps);
    expect(truth).toBe(true);
    const found = yield* adapter.document.containsHtml(steps);
    expect(found).toBe(false);
    const closed = yield* adapter.inspect(steps);
    expect(O.getOrThrow(O.getOrThrow(closed).generator)).toEqual({ position: 0, state: "GEN_CLOSED" });
    const failure = yield* adapter.document.insertSourceHtml(steps).pipe(Effect.flip);
    expect(failure).toMatchObject({ sourceError: "AttributeError" });
  })
);

it.effect("keeps a generator suspended after matching its last item until another pull exhausts it", () =>
  Effect.gen(function* () {
    const { adapter } = yield* setup();
    const steps = yield* adapter.create({ kind: "generator", names: ["html"] });
    const first = yield* adapter.document.containsHtml(steps);
    expect(first).toBe(true);
    const suspended = yield* adapter.inspect(steps);
    expect(O.getOrThrow(O.getOrThrow(suspended).generator)).toEqual({ position: 1, state: "GEN_SUSPENDED" });
    const second = yield* adapter.document.containsHtml(steps);
    expect(second).toBe(false);
    const closed = yield* adapter.inspect(steps);
    expect(O.getOrThrow(O.getOrThrow(closed).generator)).toEqual({ position: 1, state: "GEN_CLOSED" });
  })
);
