import { SourceTextResolver } from "@beep/file-processing/SourceText";
import { CitationEngineConfiguration, CitationEngineDefaultConfiguration } from "@beep/law-practice-server/layer";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture, buildCitationEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const unused = SourceTextResolver.of({
  resolve: Effect.fn("EngineBoundaryRefusalTest.resolve")(() => Effect.die("a refused engine resolves nothing")),
});
// A fresh, valid copy with one field replaced by a malformed value: the real
// boundary must refuse it, whatever the stage below would have done.
const replaced = <A extends object>(make: (value: A) => A, value: A, field: keyof A, malformed: unknown) => {
  const copy = make({ ...value });
  expect(Reflect.set(copy, field, malformed)).toBe(true);
  return copy;
};

const privateName = "private_source_name";
const incoherentDescriptor = (c: CitationEngineConfiguration) => {
  const discovery = c.annotation.geometry.discovery;
  const [first, ...rest] = discovery.bindings;
  const binding =
    first === undefined ? undefined : { ...first, profile: { ...first.profile, names: { [privateName]: 0 } } };
  return {
    ...c.annotation,
    geometry: { ...c.annotation.geometry, discovery: { ...discovery, bindings: [binding, ...rest] } },
  };
};

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "engine configuration boundaries",
  (it) => {
    it.effect(
      "refuses malformed limits, runtime and stage configuration at CitationEngineLive before any child starts",
      () =>
        Effect.gen(function* () {
          const installed = yield* installCitationDefaultConfigurationFixture("bun");
          const before = yield* installed.setup.observed.snapshot;
          const cases: ReadonlyArray<
            readonly [keyof CitationEngineConfiguration, (c: CitationEngineConfiguration) => unknown]
          > = [
            ["limits", (c) => ({ ...c.limits, sourceUtf16: -1 })],
            ["runtime", (c) => ({ ...c.runtime, kind: "unsupported" })],
            ["extraction", (c) => ({ ...c.extraction, engineArtifact: "not-a-digest" })],
            // A capture name outside its profile's group range breaks the ProfileNames rule.
            ["annotation", incoherentDescriptor],
          ];
          for (const [field, malformed] of cases) {
            const failure = yield* buildCitationEngineFixture(installed, unused, (configuration) =>
              replaced(CitationEngineConfiguration.make, configuration, field, malformed(configuration))
            ).pipe(Effect.flip);
            expect(failure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
            // The refusal is closed: no capture name, pattern or source text rides on it.
            const encoded = yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(failure);
            expect(encoded).not.toContain(privateName);
            expect(String(failure)).not.toContain(privateName);
          }
          const after = yield* installed.setup.observed.snapshot;
          expect(after).toEqual(before);
        }),
      { timeout: 120_000 }
    );
    it.effect(
      "refuses malformed limits, runtime and asset configuration at the default engine before any child starts",
      () =>
        Effect.gen(function* () {
          const installed = yield* installCitationDefaultConfigurationFixture("bun");
          const built = yield* buildCitationDefaultEngineFixture(installed, unused);
          const before = yield* installed.setup.observed.snapshot;
          const cases: ReadonlyArray<
            readonly [keyof CitationEngineDefaultConfiguration, (c: CitationEngineDefaultConfiguration) => unknown]
          > = [
            ["limits", (c) => ({ ...c.limits, sourceUtf16: -1 })],
            ["runtime", (c) => ({ ...c.runtime, kind: "unsupported" })],
            ["assets", (c) => ({ ...c.assets, parserCatalog: "" })],
          ];
          for (const [field, malformed] of cases) {
            const configuration = replaced(
              CitationEngineDefaultConfiguration.make,
              built.configuration,
              field,
              malformed(built.configuration)
            );
            const failure = yield* built.build(configuration).pipe(Effect.flip);
            expect(failure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
          }
          const after = yield* installed.setup.observed.snapshot;
          expect(after).toEqual(before);
        }),
      { timeout: 180_000 }
    );
  }
);
