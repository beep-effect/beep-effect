import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { CitationDocument, citationAuthorityMentionIds } from "@beep/law-practice-domain/values";
import { restoreCitationDocument } from "@beep/law-practice-server/internal/Citation/Document";
import {
  makeCitationSourceDocument,
  makeCitationSourcePairDocument,
} from "@beep/law-practice-server/internal/Citation/SourceDocument";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { assertCitationWorkerCompositionObserved } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";

it.layer(Layer.merge(citationTokenizerTestLayer, BunCrypto.layer), { excludeTestServices: true })(
  "connected verified citation document",
  (it) => {
    for (const kind of ["bun", "node"] as const) {
      it.effect(
        `extracts, groups and restores a raw verified source on ${kind}`,
        () =>
          Effect.gen(function* () {
            const installed = yield* installCitationDefaultConfigurationFixture(kind);
            const { setup, provided, defaultConfiguration, engineArtifact } = installed;
            const text = "Foo v. Bar, 1 U.S. 1 (2000). Id. at 2.";
            const proof = yield* citationFixtureSourceProof(text);
            const markup =
              kind === "bun" ? yield* citationFixtureSourceProof("<p>Independent markup source</p>") : null;
            const sameSource = S.toEquivalence(SourceTextIdentity);
            let resolves = 0;
            const resolver = SourceTextResolver.of({
              resolve: Effect.fn("SourceDocumentTest.resolve")(function* (request) {
                const state = yield* setup.operation.snapshot;
                expect(state).toMatchObject({ active: 1, queued: 0 });
                resolves++;
                const selected = markup !== null && sameSource(request.identity, markup.source) ? markup : proof;
                return ResolvedSourceText.make({ identity: selected.source, text: selected.sourceText });
              }),
            });
            const factory = markup === null ? makeCitationSourceDocument : makeCitationSourcePairDocument;
            const stage = yield* factory(setup.limits, setup.runtime, {
              extraction: defaultConfiguration,
              engineArtifact,
            }).pipe(
              Effect.provideContext(provided),
              Effect.provideService(SourceTextResolver, resolver),
              DateTime.withCurrentZoneOffset(0)
            );
            const refused = yield* stage.extract(null).pipe(Effect.flip);
            expect(refused).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
            expect(resolves).toBe(0);
            const admission = yield* setup.operation.snapshot;
            expect(admission).toMatchObject({ active: 0, queued: 0 });
            const invocation = stage.extract(
              markup === null
                ? { source: proof.source, sourceText: text, role: "plain", cleanSteps: [] }
                : {
                    plain: { source: proof.source, sourceText: text },
                    markup: { source: markup.source, sourceText: markup.sourceText },
                    cleanSteps: [],
                  }
            );
            const closed: Effect.Effect<Effect.Success<typeof invocation>, CitationEngineFailure> = invocation;
            const result = yield* closed;
            expect(S.is(CitationDocument)(result.document)).toBe(true);
            expect(result.document.mentions).toHaveLength(2);
            expect(result.document.authorities).toHaveLength(1);
            expect(A.map(result.document.resolutions, (resolution) => resolution.status)).toEqual([
              "Resolved",
              "Resolved",
            ]);
            expect(
              A.map(result.document.mentions, (mention) => [
                mention.anchor.anchor.startChar,
                mention.anchor.anchor.endChar,
              ])
            ).toEqual([
              [12, 20],
              [29, 37],
            ]);
            const authority = A.getUnsafe(result.document.authorities, 0);
            expect(citationAuthorityMentionIds(result.document, authority.id)).toHaveLength(2);
            expect(result.document.source).toEqual(result.source.source.source);
            const restored = yield* restoreCitationDocument({
              receipt: result.receipt,
              editions: result.editions,
              resourceBindings: result.resourceBindings,
              expectedSource: result.source.source.source,
              expectedEngineArtifact: engineArtifact,
              sourceText: result.source.source.sourceText,
            });
            expect(restored).toEqual(result.document);
            expect(result.source.parent).toEqual(markup === null ? proof.source : markup.source);
            expect(resolves).toBe(markup === null ? 1 : 2);
            yield* assertCitationWorkerCompositionObserved(setup.operation, setup.admission, setup.observed.snapshot);
          }),
        { timeout: 180000 }
      );
    }
    it.effect(
      "preserves the original extraction shortcut without native children and retains unverified semantics",
      () =>
        Effect.gen(function* () {
          const installed = yield* installCitationDefaultConfigurationFixture("bun");
          const { setup, provided, defaultConfiguration, engineArtifact } = installed;
          const proof = yield* citationFixtureSourceProof("eyecite");
          const resolver = SourceTextResolver.of({
            resolve: Effect.fn("SourceDocumentTest.shortcut")(() =>
              Effect.succeed(ResolvedSourceText.make({ identity: proof.source, text: "eyecite" }))
            ),
          });
          const stage = yield* makeCitationSourcePairDocument(setup.limits, setup.runtime, {
            extraction: defaultConfiguration,
            engineArtifact,
          }).pipe(
            Effect.provideContext(provided),
            Effect.provideService(SourceTextResolver, resolver),
            DateTime.withCurrentZoneOffset(0)
          );
          const result = yield* stage.extract({
            plain: { source: proof.source, sourceText: "eyecite" },
            get markup() {
              throw new Error("shortcut ignores markup");
            },
          });
          expect(result.semantic.citations.length).toBeGreaterThan(0);
          expect(result.occurrences.unverified.length).toBe(result.semantic.citations.length);
          expect(result.document.mentions).toEqual([]);
          expect(result.document.authorities).toEqual([]);
          const exits = yield* setup.observed.snapshot;
          expect(exits).toEqual({ spawned: 0, confirmed: 0 });
        })
    );
  }
);
