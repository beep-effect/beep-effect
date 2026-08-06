/**
 * Rung-1 proof for the derived, fail-closed candor gate.
 *
 * Every fixture is hand-constructed and slice-isolated: no other slice is
 * booted, no app runtime layer is used, and the only capability the gate
 * reaches for is the `SourceTextResolver` port, satisfied here by a fixture
 * layer. `Crypto.Crypto` comes from a Web Crypto test layer rather than a
 * platform package, so this proof adds no dependency to the package. The
 * digests and anchors are real: `verifyTextAnchor` runs a genuine SHA-256 over
 * the resolved text on every covered path.
 */

import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { CandorDisposition, CitingApplicationIdentity, PatentCitationEvent } from "@beep/law-practice-domain";
import {
  CandorGateVerdict,
  CandorPolicy,
  CandorPolicyLive,
  CandorRecordReader,
  CandorRecordReaderShape,
} from "@beep/law-practice-use-cases/CandorPolicy";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { Sha256HexFromBytes } from "@beep/schema";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { baseEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const SCOPE_REF = "matter:candor";
const FILING_ENCODED = { applicationNumber: "16138242", kind: "UsptoNormalized" } as const;
const utf8 = new TextEncoder();

const TEXT_A = "Smith discloses a hinge assembly.";
const TEXT_A2 = "Smith discloses a hinge assembly with a detent.";
const TEXT_B = "Jones discloses a latch.";

// ---------------------------------------------------------------------------
// Crypto: Web Crypto rather than a platform package, so this proof adds no
// dependency. `verifyTextAnchor` needs a real SHA-256 or every anchor fails.
// ---------------------------------------------------------------------------

const TestCrypto = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    digest: (algorithm, data) =>
      Effect.tryPromise({
        catch: (cause) =>
          PlatformError.systemError({
            _tag: "Unknown",
            cause,
            description: "Could not compute digest",
            method: "digest",
            module: "Crypto",
          }),
        try: () =>
          globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data)).then((buffer) => new Uint8Array(buffer)),
      }),
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
  })
);

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

type Observation = {
  readonly encoded: Record<string, unknown>;
  readonly identity: SourceTextIdentity;
  readonly text: string;
};

type SourceEntry = {
  readonly identity: SourceTextIdentity;
  readonly text: string;
};

/**
 * One exact observation of one logical source. Two observations built from the
 * same `name` with different text are two versions of the same source, which is
 * what makes declared supersession meaningful.
 */
const observation = Effect.fnUntraced(function* (name: string, text: string) {
  const hex = yield* S.decodeUnknownEffect(Sha256HexFromBytes)(utf8.encode(text));
  const digest = `sha256:${hex}`;
  const encoded = {
    extractor: { name: "utf8", version: "1" },
    locator: `${name}.txt`,
    normalizationVersion: "1",
    scopeRef: SCOPE_REF,
    sourceDigest: digest,
    sourceRef: `source:${name}`,
    textDigest: digest,
  };
  const identity = yield* S.decodeUnknownEffect(SourceTextIdentity)(encoded);
  return { encoded, identity, text } satisfies Observation;
});

/** What the resolver will hand back for an observation, text overridable. */
const sourceEntry = (o: Observation, text?: string): SourceEntry => ({ identity: o.identity, text: text ?? o.text });

const groundingOf = (o: Observation) => ({
  anchor: { endChar: Str.length(o.text), quote: o.text, startChar: 0 },
  source: o.encoded,
});

const userPrincipal = { kind: "User", userId: 1 } as const;
const agentPrincipal = { agentId: 1, agentVersionId: 1, kind: "Agent", onBehalfOfUserId: 1 } as const;

type EventOptions = {
  readonly discovery?: "AiDiscovered" | "ExaminerObserved";
  readonly possibleDuplicateOf?: number;
  readonly quarantine?: { readonly rawDetail: string; readonly reason: "unknown-code" | "malformed-record" };
  readonly reference?: string;
  readonly supersedes?: { readonly eventId: number; readonly textDigest: string };
};

const eventFixture = (id: number, o: Observation, options: EventOptions = {}) =>
  S.decodeUnknownEffect(PatentCitationEvent)({
    ...baseEntityFixtureInput(LawPractice.PatentCitationEventId.entityType, id),
    actor: "Applicant",
    citingApplication: FILING_ENCODED,
    discovery:
      options.discovery === "ExaminerObserved"
        ? { kind: "ExaminerObserved" }
        : { kind: "AiDiscovered", model: { name: "reference-extractor", version: "3" } },
    grounding: groundingOf(o),
    observedAt: id,
    possibleDuplicateOf: options.possibleDuplicateOf ?? null,
    quarantine: options.quarantine ?? null,
    reference: { number: options.reference ?? "7654321" },
    supersedes: options.supersedes ?? null,
  });

type DispositionOptions = {
  readonly lifecycle?: "active" | "superseded" | "withdrawn";
  readonly principal?: typeof userPrincipal | typeof agentPrincipal;
  readonly rule56?: "Submit" | "DoNotSubmit" | null;
  readonly supersedes?: number;
};

const dispositionFixture = (
  id: number,
  target: { readonly eventId: number; readonly textDigest: string },
  options: DispositionOptions = {}
) =>
  S.decodeUnknownEffect(CandorDisposition)({
    ...baseEntityFixtureInput(LawPractice.CandorDispositionId.entityType, id),
    citingApplication: FILING_ENCODED,
    createdByPrincipal: options.principal ?? userPrincipal,
    decidedAt: id,
    disposes: target,
    lifecycle: options.lifecycle ?? "active",
    litigationFrameJudgment: null,
    rule56Judgment: options.rule56 === undefined ? "Submit" : options.rule56,
    supersedes: options.supersedes ?? null,
  });

const targets = (id: number, o: Observation) => ({ eventId: id, textDigest: o.identity.textDigest });

// ---------------------------------------------------------------------------
// Scenario layers
// ---------------------------------------------------------------------------

type Fixture = {
  readonly dispositions: ReadonlyArray<CandorDisposition>;
  readonly events: ReadonlyArray<PatentCitationEvent>;
  readonly sources: ReadonlyArray<SourceEntry>;
};

const readerLayer = (build: Effect.Effect<Fixture, S.SchemaError, Crypto.Crypto>) =>
  Layer.effect(
    CandorRecordReader,
    Effect.map(build, (fixture) =>
      CandorRecordReaderShape.make({
        dispositionsForFiling: () => Effect.succeed(fixture.dispositions),
        eventsForFiling: () => Effect.succeed(fixture.events),
      })
    )
  );

const resolverLayer = (build: Effect.Effect<Fixture, S.SchemaError, Crypto.Crypto>) =>
  Layer.effect(
    SourceTextResolver,
    Effect.map(build, (fixture) =>
      SourceTextResolver.of({
        resolve: Effect.fnUntraced(function* (request) {
          const found = A.findFirst(
            fixture.sources,
            (source) => source.identity.textDigest === request.identity.textDigest
          );
          return yield* O.match(found, {
            onNone: () =>
              Effect.fail(
                SourceTextResolverError.new("source-unavailable", "No canonical source text for that identity.")
              ),
            onSome: (source) =>
              Effect.succeed(ResolvedSourceText.make({ identity: source.identity, text: source.text })),
          });
        }),
      })
    )
  );

const scenario = (build: Effect.Effect<Fixture, S.SchemaError, Crypto.Crypto>) =>
  Layer.mergeAll(CandorPolicyLive, readerLayer(build), resolverLayer(build)).pipe(Layer.provideMerge(TestCrypto));

const evaluateFiling = Effect.fnUntraced(function* () {
  const filing = yield* S.decodeUnknownEffect(CitingApplicationIdentity)(FILING_ENCODED);
  const policy = yield* CandorPolicy;
  return yield* policy.evaluate(filing);
});

const reasons = (verdict: CandorGateVerdict) =>
  A.sort(
    A.map(verdict.uncovered, (entry) => entry.reason),
    Order.String
  );
const blockedEventIds = (verdict: CandorGateVerdict) =>
  A.sort(
    A.map(verdict.uncovered, (entry) => entry.eventId),
    Order.Number
  );

/** Assert a blocking verdict whose reasons are exactly `expected` (sorted). */
const expectBlocked = (verdict: CandorGateVerdict, expected: ReadonlyArray<string>) => {
  expect(CandorGateVerdict.isBlocked(verdict)).toBe(true);
  expect(reasons(verdict)).toEqual(expected);
};

const expectReleased = (verdict: CandorGateVerdict) => {
  expect(CandorGateVerdict.isBlocked(verdict)).toBe(false);
  expect(verdict.uncovered).toEqual([]);
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const undisposed = Effect.fnUntraced(function* () {
  const a = yield* observation("a", TEXT_A);
  return { dispositions: [], events: [yield* eventFixture(1, a)], sources: [sourceEntry(a)] } satisfies Fixture;
});

const disposed = Effect.fnUntraced(function* () {
  const a = yield* observation("a", TEXT_A);
  return {
    dispositions: [yield* dispositionFixture(10, targets(1, a))],
    events: [yield* eventFixture(1, a)],
    sources: [sourceEntry(a)],
  } satisfies Fixture;
});

/** Two references, each its own source, both current and AI-discovered. */
const twoReferences = (disposeFirst: boolean, disposeSecond: boolean) =>
  Effect.fnUntraced(function* () {
    const a = yield* observation("a", TEXT_A);
    const b = yield* observation("b", TEXT_B);
    const dispositions = A.getSomes([
      disposeFirst ? O.some(yield* dispositionFixture(10, targets(1, a))) : O.none(),
      disposeSecond ? O.some(yield* dispositionFixture(11, targets(2, b))) : O.none(),
    ]);
    return {
      dispositions,
      events: [yield* eventFixture(1, a), yield* eventFixture(2, b, { reference: "8123456" })],
      sources: [sourceEntry(a), sourceEntry(b)],
    } satisfies Fixture;
  });

/**
 * Event 1 observes source `a`; event 2 observes a newer version of the same
 * source and declares that it supersedes event 1. `order` and `replay` vary how
 * the records arrive without changing what was declared.
 */
const supersession = (options: {
  readonly disposeNewer: boolean;
  readonly disposeOlder: boolean;
  readonly replay?: boolean;
  readonly reverseOrder?: boolean;
}) =>
  Effect.fnUntraced(function* () {
    const older = yield* observation("a", TEXT_A);
    const newer = yield* observation("a", TEXT_A2);
    const olderEvent = yield* eventFixture(1, older);
    const newerEvent = yield* eventFixture(2, newer, { supersedes: targets(1, older) });

    const ordered = options.reverseOrder === true ? [newerEvent, olderEvent] : [olderEvent, newerEvent];
    const events = options.replay === true ? A.append(ordered, olderEvent) : ordered;

    const dispositions = A.getSomes([
      options.disposeOlder ? O.some(yield* dispositionFixture(10, targets(1, older))) : O.none(),
      options.disposeNewer ? O.some(yield* dispositionFixture(11, targets(2, newer))) : O.none(),
    ]);

    return { dispositions, events, sources: [sourceEntry(older), sourceEntry(newer)] } satisfies Fixture;
  });

/** Two observations of one source, neither declaring supersession. */
const forkedLineage = Effect.fnUntraced(function* () {
  const first = yield* observation("a", TEXT_A);
  const second = yield* observation("a", TEXT_A2);
  return {
    dispositions: [yield* dispositionFixture(10, targets(1, first)), yield* dispositionFixture(11, targets(2, second))],
    events: [yield* eventFixture(1, first), yield* eventFixture(2, second)],
    sources: [sourceEntry(first), sourceEntry(second)],
  } satisfies Fixture;
});

const withDisposition = (options: DispositionOptions, extra?: DispositionOptions) =>
  Effect.fnUntraced(function* () {
    const a = yield* observation("a", TEXT_A);
    const first = yield* dispositionFixture(10, targets(1, a), options);
    const dispositions =
      extra === undefined
        ? [first]
        : [first, yield* dispositionFixture(11, targets(1, a), { ...extra, supersedes: 10 })];
    return { dispositions, events: [yield* eventFixture(1, a)], sources: [sourceEntry(a)] } satisfies Fixture;
  });

const withEventOptions = (options: EventOptions) =>
  Effect.fnUntraced(function* () {
    const a = yield* observation("a", TEXT_A);
    return {
      dispositions: [yield* dispositionFixture(10, targets(1, a))],
      events: [yield* eventFixture(1, a, options)],
      sources: [sourceEntry(a)],
    } satisfies Fixture;
  });

const unresolvableSource = Effect.fnUntraced(function* () {
  const a = yield* observation("a", TEXT_A);
  return {
    dispositions: [yield* dispositionFixture(10, targets(1, a))],
    events: [yield* eventFixture(1, a)],
    sources: [],
  } satisfies Fixture;
});

const driftedSource = Effect.fnUntraced(function* () {
  const a = yield* observation("a", TEXT_A);
  return {
    dispositions: [yield* dispositionFixture(10, targets(1, a))],
    events: [yield* eventFixture(1, a)],
    sources: [sourceEntry(a, "The source text has since been rewritten.")],
  } satisfies Fixture;
});

const examinerOnly = Effect.fnUntraced(function* () {
  const a = yield* observation("a", TEXT_A);
  return {
    dispositions: [],
    events: [yield* eventFixture(1, a, { discovery: "ExaminerObserved" })],
    sources: [sourceEntry(a)],
  } satisfies Fixture;
});

// ---------------------------------------------------------------------------
// Proof
// ---------------------------------------------------------------------------

describe("CandorPolicy — one AI-discovered event", () => {
  layer(scenario(undisposed()))((it) => {
    it.effect("blocks promotion while the event carries no disposition", () =>
      Effect.gen(function* () {
        expectBlocked(yield* evaluateFiling(), ["no-disposition"]);
      })
    );
  });

  layer(scenario(disposed()))((it) => {
    it.effect("stops blocking once a disposition covers the exact observation version", () =>
      Effect.gen(function* () {
        expectReleased(yield* evaluateFiling());
      })
    );
  });
});

describe("CandorPolicy — the quantifier above cardinality one", () => {
  layer(scenario(twoReferences(false, false)()))((it) => {
    it.effect("gates on both current events when neither is disposed", () =>
      Effect.gen(function* () {
        const verdict = yield* evaluateFiling();
        expectBlocked(verdict, ["no-disposition", "no-disposition"]);
        expect(blockedEventIds(verdict)).toEqual([1, 2]);
      })
    );
  });

  layer(scenario(twoReferences(true, false)()))((it) => {
    it.effect("stays blocked when only one of the two references is disposed", () =>
      Effect.gen(function* () {
        const verdict = yield* evaluateFiling();
        expectBlocked(verdict, ["no-disposition"]);
        expect(blockedEventIds(verdict)).toEqual([2]);
      })
    );
  });

  layer(scenario(twoReferences(true, true)()))((it) => {
    it.effect("releases only once every current event is disposed", () =>
      Effect.gen(function* () {
        expectReleased(yield* evaluateFiling());
      })
    );
  });
});

describe("CandorPolicy — declared supersession moves currency", () => {
  layer(scenario(supersession({ disposeNewer: false, disposeOlder: true })()))((it) => {
    it.effect("re-blocks when a newer observation of the same source arrives undisposed", () =>
      Effect.gen(function* () {
        const verdict = yield* evaluateFiling();
        expectBlocked(verdict, ["no-disposition", "no-disposition"]);
        expect(blockedEventIds(verdict)).toEqual([1, 2]);
      })
    );
  });

  layer(scenario(supersession({ disposeNewer: true, disposeOlder: true })()))((it) => {
    it.effect("stops blocking the superseded event only once the newer event is disposed", () =>
      Effect.gen(function* () {
        expectReleased(yield* evaluateFiling());
      })
    );
  });

  layer(scenario(supersession({ disposeNewer: false, disposeOlder: true, reverseOrder: true })()))((it) => {
    it.effect("derives the same head when the superseding observation is ingested first", () =>
      Effect.gen(function* () {
        const verdict = yield* evaluateFiling();
        expectBlocked(verdict, ["no-disposition", "no-disposition"]);
        expect(blockedEventIds(verdict)).toEqual([1, 2]);
      })
    );
  });

  layer(scenario(supersession({ disposeNewer: false, disposeOlder: true, replay: true })()))((it) => {
    it.effect("releases nothing when an already-superseded observation is replayed", () =>
      Effect.gen(function* () {
        const verdict = yield* evaluateFiling();
        expectBlocked(verdict, ["no-disposition", "no-disposition"]);
        expect(blockedEventIds(verdict)).toEqual([1, 2]);
      })
    );
  });

  layer(scenario(forkedLineage()))((it) => {
    it.effect("leaves two unsuperseded observations of one source uncovered even when both are disposed", () =>
      Effect.gen(function* () {
        const verdict = yield* evaluateFiling();
        expectBlocked(verdict, ["ambiguous-lineage", "ambiguous-lineage"]);
        expect(blockedEventIds(verdict)).toEqual([1, 2]);
      })
    );
  });
});

describe("CandorPolicy — a judgment must still stand, and a human must have made it", () => {
  layer(scenario(withDisposition({ lifecycle: "withdrawn" })()))((it) => {
    it.effect("does not let a withdrawn disposition cover its event", () =>
      Effect.gen(function* () {
        expectBlocked(yield* evaluateFiling(), ["disposition-not-effective"]);
      })
    );
  });

  layer(scenario(withDisposition({}, { lifecycle: "withdrawn" })()))((it) => {
    it.effect("does not let a superseded disposition cover its event", () =>
      Effect.gen(function* () {
        expectBlocked(yield* evaluateFiling(), ["disposition-not-effective"]);
      })
    );
  });

  layer(scenario(withDisposition({ principal: agentPrincipal })()))((it) => {
    it.effect("never lets an agent principal's disposition cover an AI-discovered event", () =>
      Effect.gen(function* () {
        expectBlocked(yield* evaluateFiling(), ["disposition-author-not-user"]);
      })
    );
  });

  layer(scenario(withDisposition({ rule56: null })()))((it) => {
    it.effect("does not treat a disposition with no Rule 56 decision as coverage", () =>
      Effect.gen(function* () {
        expectBlocked(yield* evaluateFiling(), ["no-rule56-judgment"]);
      })
    );
  });
});

describe("CandorPolicy — evidence that cannot be re-proven blocks", () => {
  layer(scenario(unresolvableSource()))((it) => {
    it.effect("blocks when the canonical source text cannot be resolved", () =>
      Effect.gen(function* () {
        expectBlocked(yield* evaluateFiling(), ["source-unresolved"]);
      })
    );
  });

  layer(scenario(driftedSource()))((it) => {
    it.effect("blocks when the persisted receipt no longer re-verifies against the source", () =>
      Effect.gen(function* () {
        expectBlocked(yield* evaluateFiling(), ["anchor-unverified"]);
      })
    );
  });

  layer(scenario(withEventOptions({ quarantine: { rawDetail: "kind code ZZ", reason: "unknown-code" } })()))((it) => {
    it.effect("treats a quarantined event as uncovered even when it carries a disposition", () =>
      Effect.gen(function* () {
        expectBlocked(yield* evaluateFiling(), ["quarantined"]);
      })
    );
  });

  layer(scenario(withEventOptions({ possibleDuplicateOf: 2 })()))((it) => {
    it.effect("treats a possible duplicate as uncovered rather than resolving it", () =>
      Effect.gen(function* () {
        expectBlocked(yield* evaluateFiling(), ["possible-duplicate"]);
      })
    );
  });
});

describe("CandorPolicy — examiner occurrences record without gating", () => {
  layer(scenario(examinerOnly()))((it) => {
    it.effect("does not gate on an examiner-observed event that carries no disposition", () =>
      Effect.gen(function* () {
        expectReleased(yield* evaluateFiling());
      })
    );
  });
});
