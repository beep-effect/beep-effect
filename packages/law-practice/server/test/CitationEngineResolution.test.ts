import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { citationAuthorityMentionIds } from "@beep/law-practice-domain/values";
import { captureCitationMentionReceiptData } from "@beep/law-practice-server/internal/Citation/Mention";
import { CitationEngineResolutionInput } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as Tuple from "effect/Tuple";
import { makeCitationCanonicalResolutionComparison } from "./CitationCanonicalResolution.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { assertCitationWorkerCompositionReleased } from "./CitationRegexWorker.fixtures.ts";
import { prepareCitationResolutionContext } from "./CitationResolve.fixtures.ts";
import { loadResolutionOperationContexts } from "./CitationResolve.operations.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true, concurrent: false })(
  "public engine original resolution groups",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `matches all 30 original resolution assertions using authenticated default configuration on ${kind}`,
        () =>
          Effect.gen(function* () {
            const installed = yield* installCitationDefaultConfigurationFixture(kind);
            const current = yield* Ref.make(O.none<VerifiedSourceText>());
            const currentOperation = yield* Ref.make(O.none<typeof installed.setup.operation>());
            const resolver = SourceTextResolver.of({
              resolve: Effect.fn("EngineResolutionTest.source")(function* (request) {
                const selected = yield* Ref.get(current);
                const proof = yield* Effect.fromOption(selected, () =>
                  SourceTextResolverError.new("source-unavailable", "resolution witness not installed")
                );
                expect(request.identity).toEqual(proof.source);
                const owner = yield* Ref.get(currentOperation);
                const operation = yield* Effect.fromOption(owner, () =>
                  SourceTextResolverError.new("source-unavailable", "resolution admission witness not installed")
                );
                const state = yield* operation.snapshot;
                expect(state).toMatchObject({ active: 1, queued: 0 });
                return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
              }),
            });
            const { engine, operation, admission } = yield* buildCitationDefaultEngineFixture(installed, resolver);
            yield* Ref.set(currentOperation, O.some(operation));
            const canonical = yield* makeCitationCanonicalResolutionComparison();
            const observations = yield* loadResolutionOperationContexts;
            expect(observations.contexts).toHaveLength(30);
            expect(observations.sourceSiteIds).toHaveLength(2);
            expect(
              A.dedupe(A.flatMap(observations.contexts, (row) => A.map(row.context.mentions, (m) => m.citation.type)))
            ).toHaveLength(8);
            expect(A.reduce(observations.contexts, 0, (total, row) => total + row.context.mentions.length)).toBe(94);
            for (const row of observations.contexts) {
              const input = yield* prepareCitationResolutionContext(row.context, installed.engineArtifact);
              yield* Ref.set(current, O.some(input.verifiedSource));
              const request = CitationEngineResolutionInput.make({
                source: input.verifiedSource.source,
                sourceText: input.verifiedSource.sourceText,
                mentions: A.map(input.mentions, captureCitationMentionReceiptData),
              });
              const result = yield* engine.resolve(request);
              const indices = HashMap.fromIterable(
                A.map(result.document.mentions, (mention, index) => Tuple.make(mention.id, index))
              );
              const groups = A.map(result.document.authorities, (authority) =>
                A.map(citationAuthorityMentionIds(result.document, authority.id), (id) =>
                  O.getOrElse(HashMap.get(indices, id), () => -1)
                )
              );
              if (row.context.outcome.status !== "value") return yield* Effect.die("expected original groups");
              expect(groups, row.context.name).toEqual(row.context.outcome.groups);
              yield* canonical.compare(
                row.context.name,
                row.sourceCitationModels,
                row.sourceResolutionGroups,
                result.document
              );
              expect(result.source.source).toEqual(input.verifiedSource.source);
              expect(result.document.mentions).toEqual(input.mentions);
              expect(result.report).toMatchObject({ operation: "resolve", engineArtifact: installed.engineArtifact });
            }
            yield* canonical.verify;
            yield* assertCitationWorkerCompositionReleased(operation, admission, installed.setup.observed.snapshot, 0);
          }),
        { timeout: 180000 }
      );
    }
  }
);
