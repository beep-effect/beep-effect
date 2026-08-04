import { ContradictionTriageServiceLive } from "@beep/epistemic-server/layer";
import { ContradictionListPayload } from "@beep/epistemic-use-cases/public";
import {
  ContradictionCandidatePage,
  ContradictionRepositoryUnavailable,
  ContradictionReviewer,
  ContradictionReviewScope,
  ContradictionTriageRepository,
  ContradictionTriageService,
} from "@beep/epistemic-use-cases/server";
import { SourceTextResolver } from "@beep/file-processing/SourceText";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { UserPrincipal } from "@beep/shared-domain/entity/Principal";
import * as SharedIdentity from "@beep/shared-domain/identity/Shared";
import { provideScopedLayer } from "@beep/test-utils";
import { assert, describe, it } from "@effect/vitest";
import { Crypto, DateTime, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import * as Tracer from "effect/Tracer";

const ACTION_SPAN = "epistemic.contradiction.list_candidates";
const PORT_SPAN = "epistemic.contradiction.list";
const ADAPTER_SPAN = "db.query";

const payload = ContradictionListPayload.make({
  disposition: "open",
  knownAt: DateTime.makeUnsafe(2_000),
  limit: PosInt.make(20),
  offset: NonNegativeInt.make(0),
  validAt: DateTime.makeUnsafe(1_000),
});

const emptyPage = ContradictionCandidatePage.make({
  items: [],
  total: NonNegativeInt.make(0),
});

const TestCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (_algorithm, data) => Effect.succeed(data),
    randomBytes: (size) => new Uint8Array(size).fill(1),
  })
);

const TestReviewer = Layer.succeed(
  ContradictionReviewer,
  ContradictionReviewer.of(
    UserPrincipal.make({
      userId: SharedIdentity.UserId.make(1),
    })
  )
);

const TestReviewScope = Layer.succeed(
  ContradictionReviewScope,
  ContradictionReviewScope.of({
    orgId: SharedIdentity.OrganizationId.make(1),
    sourceScopeRef: "workspace:1",
  })
);

const TestSourceTextResolver = Layer.succeed(
  SourceTextResolver,
  SourceTextResolver.of({
    resolve: Effect.fnUntraced(function* () {
      return yield* Effect.die("SourceTextResolver is not used by listCandidates");
    }),
  })
);

const makeRepository = (fail: boolean) =>
  ContradictionTriageRepository.of({
    get: Effect.fnUntraced(function* () {
      return yield* Effect.die("get is not used by listCandidates");
    }),
    getExpanded: Effect.fnUntraced(function* () {
      return yield* Effect.die("getExpanded is not used by listCandidates");
    }),
    list: Effect.fn(ADAPTER_SPAN)(function* () {
      yield* Effect.annotateCurrentSpan({
        "db.operation": "select",
        "db.system": "postgresql",
      });
      if (fail) {
        return yield* ContradictionRepositoryUnavailable.during("list", "injected adapter failure");
      }
      return emptyPage;
    }),
    review: Effect.fnUntraced(function* () {
      return yield* Effect.die("review is not used by listCandidates");
    }),
    submit: Effect.fnUntraced(function* () {
      return yield* Effect.die("submit is not used by listCandidates");
    }),
  });

const makeServiceLayer = (fail: boolean) =>
  ContradictionTriageServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(ContradictionTriageRepository, makeRepository(fail)),
        TestCrypto,
        TestReviewer,
        TestReviewScope,
        TestSourceTextResolver
      )
    )
  );

const makeRecordingTracer = (): {
  readonly captured: Array<Tracer.NativeSpan>;
  readonly tracer: Tracer.Tracer;
} => {
  const captured: Array<Tracer.NativeSpan> = [];
  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      captured.push(span);
      return span;
    },
  });
  return { captured, tracer };
};

const runList = (fail: boolean, tracer: Tracer.Tracer) =>
  Effect.gen(function* () {
    const service = yield* ContradictionTriageService;
    return yield* service.listCandidates(payload);
  }).pipe(provideScopedLayer(makeServiceLayer(fail)), Effect.withTracer(tracer));

const onlySpan = (captured: ReadonlyArray<Tracer.NativeSpan>, name: string): Tracer.NativeSpan => {
  const matches = A.filter(captured, (span) => Eq.equals(span.name, name));
  assert.lengthOf(matches, 1);
  return O.getOrThrow(A.head(matches));
};

const parentName = (span: Tracer.NativeSpan): string | undefined =>
  O.getOrUndefined(O.flatMap(span.parent, (parent) => (P.isTagged("Span")(parent) ? O.some(parent.name) : O.none())));

const assertSafeAttributes = (span: Tracer.NativeSpan): void => {
  const forbidden = /(candidate|locator|org|payload|query|source_ref|source_text|user)/i;
  A.forEach(A.fromIterable(span.attributes.keys()), (key) => {
    assert.notMatch(key, forbidden);
  });
};

const assertTopology = (captured: ReadonlyArray<Tracer.NativeSpan>) => {
  const action = onlySpan(captured, ACTION_SPAN);
  const port = onlySpan(captured, PORT_SPAN);
  const adapter = onlySpan(captured, ADAPTER_SPAN);

  assert.isUndefined(parentName(action));
  assert.strictEqual(parentName(port), ACTION_SPAN);
  assert.strictEqual(parentName(adapter), PORT_SPAN);
  assert.deepEqual(
    A.map(
      A.filter(captured, (span) => Str.includes("contradiction")(span.name)),
      (span) => span.name
    ),
    [ACTION_SPAN, PORT_SPAN]
  );
  assert.strictEqual(action.attributes.get("epistemic.contradiction.disposition"), "open");
  assert.strictEqual(adapter.attributes.get("db.operation"), "select");
  assert.strictEqual(adapter.attributes.get("db.system"), "postgresql");
  assertSafeAttributes(action);
  assertSafeAttributes(port);
  assertSafeAttributes(adapter);

  return action;
};

describe("ContradictionTriage observability", () => {
  it.effect(
    "emits one action, port, and technical adapter span with a bounded success outcome",
    Effect.fnUntraced(function* () {
      const { captured, tracer } = makeRecordingTracer();

      yield* runList(false, tracer);

      const action = assertTopology(captured);
      assert.strictEqual(action.attributes.get("epistemic.contradiction.outcome"), "listed");
      assert.isFalse(action.attributes.has("epistemic.contradiction.failure_reason"));
    })
  );

  it.effect(
    "records a bounded failure outcome without leaking adapter details",
    Effect.fnUntraced(function* () {
      const { captured, tracer } = makeRecordingTracer();

      const error = yield* Effect.flip(runList(true, tracer));

      assert.strictEqual(error.reason, "unavailable");
      const action = assertTopology(captured);
      assert.strictEqual(action.attributes.get("epistemic.contradiction.outcome"), "failed");
      assert.strictEqual(action.attributes.get("epistemic.contradiction.failure_reason"), "unavailable");
    })
  );
});
