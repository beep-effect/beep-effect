import { SourceTextResolver } from "@beep/file-processing/SourceText";
import { CourtReporterArtifact } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import {
  ownCitationConfiguration,
  ownedDerive,
  ownedField,
  ownedItems,
  ownedStruct,
} from "@beep/law-practice-server/internal/Citation/ConfigurationOwnership";
import {
  CitationEngineConfiguration,
  CitationEngineDefaultConfiguration,
  CitationExtractorConfiguration,
} from "@beep/law-practice-server/layer";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { citationFixtureEngineBuild } from "./CitationEngineArtifact.fixtures.ts";
import { buildCitationDefaultEngineFixture, buildCitationEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const Patterns = S.Struct({
  name: S.String,
  patterns: S.Array(CitationPythonUnicodeStorage),
});
const Wrapped = S.Struct({ pattern: CitationPythonUnicodeStorage });
const refused = () => "refused" as const;

it.effect("detaches caller buffers through the JSON codec at the boundary", () =>
  Effect.gen(function* () {
    const bytes = new Uint8Array([65, 66]);
    const raw = { name: "fixed", patterns: [{ width: 1, bytes }] };
    const owned = yield* ownCitationConfiguration(Patterns, raw, refused);
    expect(owned).toEqual(raw);
    const pattern = A.getUnsafe(ownedItems(ownedField(owned, "patterns")), 0);
    expect(pattern.bytes).not.toBe(bytes);
    bytes[0] = 90;
    expect(pattern.bytes[0]).toBe(65);
  })
);

it.effect("refuses configuration outside the schema with the caller's closed failure", () =>
  Effect.gen(function* () {
    const failure = yield* ownCitationConfiguration(Patterns, { name: 1, patterns: null }, refused).pipe(Effect.flip);
    expect(failure).toBe("refused");
  })
);

it.effect("projects and assembles owned values without another detach", () =>
  Effect.gen(function* () {
    const owned = yield* ownCitationConfiguration(
      Patterns,
      { name: "fixed", patterns: [{ width: 1, bytes: new Uint8Array([67]) }] },
      refused
    );
    const patterns = ownedField(owned, "patterns");
    expect(patterns).toBe(owned.patterns);
    const items = ownedItems(patterns);
    expect(A.length(items)).toBe(1);
    const first = A.getUnsafe(items, 0);
    const assembled = ownedStruct(Wrapped, { pattern: first });
    expect(assembled.pattern).toEqual(first);
  })
);

it.effect("derives an owned value from an owned input without another detach", () =>
  Effect.gen(function* () {
    const owned = yield* ownCitationConfiguration(
      Patterns,
      { name: "fixed", patterns: [{ width: 1, bytes: new Uint8Array([68]) }] },
      refused
    );
    const derived = yield* ownedDerive(owned, (input) =>
      Effect.succeed({ count: input.patterns.length, name: input.name })
    );
    expect(derived).toEqual({ count: 1, name: "fixed" });
    const failure = yield* ownedDerive(owned, () => Effect.fail("derivation refused" as const)).pipe(Effect.flip);
    expect(failure).toBe("derivation refused");
  })
);

// Every object (including arrays and buffers) reachable from a value, in visit order.
const reachableObjects = (root: unknown): ReadonlyArray<object> => {
  const seen: Array<object> = [];
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null || seen.includes(value)) return;
    seen.push(value);
    if (ArrayBuffer.isView(value)) return;
    for (const key of Reflect.ownKeys(value)) visit(Reflect.get(value, key));
  };
  visit(root);
  return seen;
};
// Owning a valid configuration keeps no object or buffer the caller can reach.
const expectDetached = Effect.fnUntraced(function* <Schema extends S.Codec<unknown, unknown>>(
  schema: Schema,
  raw: unknown
) {
  const owned = yield* ownCitationConfiguration(schema, raw, refused);
  const caller = reachableObjects(raw);
  const shared = A.filter(reachableObjects(owned), (value) => caller.includes(value));
  expect(shared).toEqual([]);
});
it.effect("keeps a pass-through leaf by reference, which is why boundary schemas have none", () =>
  Effect.gen(function* () {
    const payload = { kept: true };
    const raw = { payload };
    const owned = yield* ownCitationConfiguration(S.Struct({ payload: S.Unknown }), raw, refused);
    const caller = reachableObjects(raw);
    expect(A.filter(reachableObjects(owned), (value) => caller.includes(value))).toEqual([payload]);
  })
);
const unused = SourceTextResolver.of({
  resolve: Effect.fn("ConfigurationOwnershipTest.resolve")(() => Effect.die("ownership tests resolve nothing")),
});

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "boundary schemas own detached values",
  (it) => {
    it.effect(
      "keeps no caller reference in owned engine, default engine and extractor configuration",
      () =>
        Effect.gen(function* () {
          const installed = yield* installCitationDefaultConfigurationFixture("bun");
          const engine = yield* buildCitationEngineFixture(installed, unused);
          yield* expectDetached(CitationEngineConfiguration, engine.configuration);
          const defaults = yield* buildCitationDefaultEngineFixture(installed, unused);
          yield* expectDetached(CitationEngineDefaultConfiguration, defaults.configuration);
          const implementation = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode("ownership"));
          const extractor = CitationExtractorConfiguration.make({
            runtime: installed.setup.runtime,
            installation: {
              implementation,
              runtime: citationFixtureEngineBuild("bun").runtime,
              limits: installed.setup.limits,
              vocabularyVersion: Result.getOrThrow(CourtReporterArtifact).artifactVersion,
            },
          });
          yield* expectDetached(CitationExtractorConfiguration, extractor);
        }),
      { timeout: 180_000 }
    );
  }
);
