import {
  CitationReferenceTokenConfiguration,
  CitationReferenceTokenFailure,
  makeCitationReferenceTokenExtraction as makeOwnedCitationReferenceTokenExtraction,
} from "@beep/law-practice-server/internal/Citation/ReferenceTokenExtraction";
import { CitationTokenDispatchBindings } from "@beep/law-practice-server/internal/Citation/TokenDispatch";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { readCitationCaseMetadataConfiguration } from "./CitationCaseMetadata.fixtures.ts";
import { installCitationOwnedTestStage } from "./CitationConfigurationOwnership.fixtures.ts";
import { installCitationFrozenMetadataRuntime } from "./CitationFrozenEditions.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { readCitationPinExtractionCorpus } from "./CitationPinExtraction.fixtures.ts";
import { readCitationReferenceTokenCorpus } from "./CitationReferenceToken.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const makeCitationReferenceTokenExtraction = installCitationOwnedTestStage({
  schema: CitationReferenceTokenConfiguration,
  install: makeOwnedCitationReferenceTokenExtraction,
  invalid: () => CitationReferenceTokenFailure.make({ reason: "invalid-configuration" }),
});

const install = Effect.fnUntraced(function* () {
  const corpus = yield* readCitationReferenceTokenCorpus();
  const cases = yield* readCitationCaseMetadataConfiguration();
  const pin = yield* readCitationPinExtractionCorpus();
  const setup = yield* installCitationFrozenMetadataRuntime("bun");
  const editions = yield* S.decodeEffect(CitationTokenDispatchBindings)(corpus.editionBindings);
  const configuration = {
    pin: pin.configuration,
    names: cases.names,
    editions,
    supra: corpus.configuration.supra,
  };
  const make = (input: unknown, limits = setup.limits) =>
    makeCitationReferenceTokenExtraction(limits, setup.runtime, input).pipe(
      Effect.flatMap((stage) =>
        makeCitationTestScaffoldBinding(limits).pipe(Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) })))
      ),
      Effect.provideContext(setup.provided),
      DateTime.withCurrentZoneOffset(0)
    );
  return { corpus, configuration, make, limits: setup.limits };
});
const refuses = Effect.fnUntraced(function* <A, E, R>(body: Effect.Effect<A, E, R>, expected: object) {
  const failure = yield* Effect.flip(body);
  expect(failure).toMatchObject(expected);
});
const invalidConfiguration = { _tag: "CitationReferenceTokenFailure", reason: "invalid-configuration" };

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("reference-token refusals", (it) => {
  it.effect(
    "refuses a context pattern beyond patternUtf16 only for tokens that reach the context helper",
    () =>
      Effect.gen(function* () {
        const { configuration, corpus, make, limits } = yield* install();
        // The pin pattern is the longest raw pattern; its wrapped context form is
        // five units longer. One unit of headroom passes every installation check.
        const pin = configuration.pin.pattern;
        const stage = yield* make(configuration, { ...limits, patternUtf16: pin.bytes.length / pin.width + 1 });
        const row = (kind: string) =>
          Effect.fromOption(A.findFirst(corpus.cases, (row) => row.expected.kind === kind && row.markup === null));
        const section = yield* row("UnknownCitation");
        const unknown = yield* stage.extract({ ...section, geometry: O.none() });
        expect(unknown.outcome._tag).toBe("UnknownCitation");
        const id = yield* row("IdCitation");
        yield* refuses(stage.extract({ ...id, geometry: O.none() }), {
          _tag: "CitationSafetyLimitExceeded",
          limit: "patternUtf16",
        });
      }),
    { timeout: 60_000 }
  );

  it.effect(
    "refuses malformed, unauthenticated and ambiguous installation data",
    () =>
      Effect.gen(function* () {
        const { configuration, make } = yield* install();
        yield* refuses(make({ ...configuration, editions: "none" }), invalidConfiguration);
        const pin = { ...configuration.pin, pattern: configuration.supra.pattern };
        yield* refuses(make({ ...configuration, pin }), invalidConfiguration);
        const supra = { ...configuration.supra, pattern: configuration.pin.pattern };
        yield* refuses(make({ ...configuration, supra }), invalidConfiguration);
        const first = A.getUnsafe(configuration.editions, 0);
        const duplicate = A.append(configuration.editions, { ...first });
        yield* refuses(make({ ...configuration, editions: duplicate }), invalidConfiguration);
      }),
    { timeout: 60_000 }
  );

  it.effect(
    "refuses malformed requests and unbound edition ids",
    () =>
      Effect.gen(function* () {
        const { configuration, corpus, make } = yield* install();
        const stage = yield* make(configuration);
        const invalidInput = { _tag: "CitationReferenceTokenFailure", reason: "invalid-input" };
        yield* refuses(stage.extract({ index: "first" }), invalidInput);
        const short = yield* Effect.fromOption(
          A.findFirst(corpus.cases, (row) => row.expected.kind === "ShortCaseCitation" && row.markup === null)
        );
        const request = { ...short, geometry: O.none() };
        const incoherent = { ...request, token: { ...short.token, data: null } };
        yield* refuses(stage.extract(incoherent), invalidInput);
        const unbound = { ...request, token: { ...short.token, exact: [99_999] } };
        yield* refuses(stage.extract(unbound), {
          _tag: "CitationReferenceTokenFailure",
          reason: "missing-edition",
        });
      }),
    { timeout: 60_000 }
  );
});
