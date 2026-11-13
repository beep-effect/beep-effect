import { citationCaseNameWordText, makeCitationCaseName } from "@beep/law-practice-server/internal/Citation/CaseName";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { readCitationCaseNameCorpus } from "./CitationCaseName.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("plain case-name refusals", (it) => {
  it.effect("spells a None token and keeps native text identity", () =>
    Effect.sync(() => {
      deepStrictEqual(Array.from(citationCaseNameWordText(null).bytes), [78, 111, 110, 101]);
      const text = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array([65]) });
      strictEqual(citationCaseNameWordText(text), text);
    })
  );

  it.effect("refuses malformed configuration and malformed requests before scanning", () =>
    Effect.gen(function* () {
      const setup = yield* setupCitationMetadataRuntime("bun", undefined, false, true, 8192);
      const malformed = yield* makeCitationCaseName(setup.limits, setup.runtime, { scan: null }).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding(setup.limits).pipe(
            Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
          )
        ),
        Effect.provideContext(setup.provided),
        Effect.flip
      );
      expect(malformed).toMatchObject({ _tag: "CitationCaseNameScanFailure", reason: "invalid-configuration" });
      const loaded = yield* readCitationCaseNameCorpus();
      const stage = yield* makeCitationCaseName(setup.limits, setup.runtime, loaded.configuration).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestScaffoldBinding(setup.limits).pipe(
            Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
          )
        ),
        Effect.provideContext(setup.provided)
      );
      const invalid = yield* stage.extract({ words: "none" }).pipe(Effect.flip);
      expect(invalid).toMatchObject({ _tag: "CitationCaseNameScanFailure", reason: "invalid-input" });
      const observed = yield* setup.observed.snapshot;
      expect(observed).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
});
