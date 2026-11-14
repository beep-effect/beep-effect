import {
  CitationHtmlDiscoveryConfiguration,
  makeCitationHtmlDiscovery as makeOwnedCitationHtmlDiscovery,
} from "@beep/law-practice-server/internal/Citation/HtmlDiscovery";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { installCitationOwnedTestStage } from "./CitationConfigurationOwnership.fixtures.ts";
import { readCitationHtmlDiscoveryCorpus } from "./CitationHtmlDiscovery.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const makeCitationHtmlDiscovery = installCitationOwnedTestStage({
  schema: CitationHtmlDiscoveryConfiguration,
  install: makeOwnedCitationHtmlDiscovery,
});

const setup = Effect.fnUntraced(function* () {
  const loaded = yield* readCitationHtmlDiscoveryCorpus();
  const runtime = yield* setupCitationMetadataRuntime("bun", undefined, false, true, 8192);
  const make = (policy: CitationEngineLimits, configuration: unknown) =>
    makeCitationHtmlDiscovery(policy, runtime.runtime, configuration).pipe(
      Effect.flatMap((stage) =>
        makeCitationTestScaffoldBinding(policy).pipe(
          Effect.map((bind) => ({ ...stage, discover: bind(stage.discover) }))
        )
      ),
      Effect.provideContext(runtime.provided)
    );
  return { ...loaded, runtime, make };
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("HTML discovery refusals", (it) => {
  it.effect("refuses unauthenticated fixed-pattern configuration", () =>
    Effect.gen(function* () {
      const { configuration, make, runtime } = yield* setup();
      const swapped = {
        ...configuration,
        patterns: { placeholder: configuration.patterns.emphasis, emphasis: configuration.patterns.placeholder },
      };
      const tampered = yield* make(runtime.limits, swapped).pipe(Effect.flip);
      expect(tampered).toMatchObject({ _tag: "CitationHtmlDiscoveryFailure", reason: "invalid-configuration" });
    })
  );

  it.effect(
    "refuses more emphasis matches than the token ceiling",
    () =>
      Effect.gen(function* () {
        const { configuration, corpus, make, runtime } = yield* setup();
        const row = yield* Effect.fromOption(A.findFirst(corpus.cases, (row) => row.tags.length > 1));
        const stage = yield* make({ ...runtime.limits, tokens: 1 }, configuration);
        const refused = yield* stage.discover(row.markup).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "tokens" });
      }),
    { timeout: 10_000 }
  );
});
