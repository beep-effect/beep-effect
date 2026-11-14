import * as NodeURL from "node:url";
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { CourtReporterArtifact } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { CitationExtractorConfiguration, CitationExtractorLive } from "@beep/law-practice-server/layer";
import { CitationExtractor, CitationExtractorInput } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { citationFixtureEngineBuild } from "./CitationEngineArtifact.fixtures.ts";
import { makeCitationBundledTestRuntime } from "./CitationNativeSpawner.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import type { Citation, CitationDocument, CitationMention, CitationResolution } from "@beep/law-practice-domain/values";
import type { VerifiedTextAnchor } from "@beep/provenance/VerifiedTextAnchor";

const Range = S.Struct({ start: S.Natural, end: S.Natural, quote: S.String });
const Link = S.Struct({
  status: S.String,
  sameAuthorityAs: S.optionalKey(S.Natural),
  candidateAuthorities: S.Array(S.Natural).pipe(S.optionalKey),
});
const Profile = S.fromJsonString(
  S.Struct({
    cases: S.Array(
      S.Struct({
        id: S.String,
        text: S.String,
        expected: S.Array(
          S.Struct({
            form: S.String,
            anchor: Range,
            pin: S.NullOr(Range),
            antecedent: S.NullOr(Range),
            lexicalCore: S.NullOr(Range),
            fields: S.Record(S.String, S.NullOr(S.Union([S.String, S.Finite]))),
            link: Link,
          })
        ),
      })
    ),
  })
);
const forms = {
  case: "full-case",
  shortFormCase: "short-case",
  id: "id",
  supra: "supra",
  law: "law",
  journal: "journal",
  reference: "reference",
  unknown: "unknown",
};
const observation = (anchor: VerifiedTextAnchor) => ({
  start: anchor.anchor.startChar,
  end: anchor.anchor.endChar,
  quote: anchor.anchor.quote,
});
const part = (citation: Citation, key: string) =>
  O.fromUndefinedOr(citation.components[key]).pipe(O.flatten, O.getOrNull);
const fields = (citation: Citation) => {
  const pinCite = O.getOrNull(citation.metadata.pinCite);
  switch (citation.type) {
    case "case":
      return {
        volume: part(citation, "volume"),
        reporter: part(citation, "reporter"),
        page: part(citation, "page"),
        pinCite,
      };
    case "shortFormCase":
      return {
        volume: part(citation, "volume"),
        reporter: part(citation, "reporter"),
        pinCite,
      };
    case "supra":
      return { antecedent: O.getOrNull(citation.metadata.antecedentGuess), pinCite };
    case "law":
      return {
        title: part(citation, "title"),
        section: part(citation, "section"),
        pinCite,
      };
    default:
      return { pinCite };
  }
};
type Row = (typeof Profile.Type)["cases"][number];
const firstAuthorities = (document: CitationDocument) => {
  const first = new Map<string, number>();
  A.forEach(document.mentions, (mention, index) => {
    if (mention.citation.type !== "case" && mention.citation.type !== "law") return;
    const resolution = A.getUnsafe(document.resolutions, index);
    if (resolution.status === "Resolved" && !first.has(resolution.authorityId))
      first.set(resolution.authorityId, index);
  });
  return first;
};
const linkOf = (resolution: CitationResolution, first: Map<string, number>) => {
  if (resolution.status === "Resolved")
    return { status: resolution.status, sameAuthorityAs: first.get(resolution.authorityId) };
  if (resolution.status === "Ambiguous")
    return {
      status: resolution.status,
      candidateAuthorities: A.map(resolution.candidateAuthorityIds, (id) => first.get(id)).sort(),
    };
  return { status: resolution.status };
};
const assertComponents = (id: string, mention: CitationMention, expected: Row["expected"][number]) => {
  for (const name of ["pin", "antecedent", "lexicalCore"] as const) {
    const component = O.map(
      A.findFirst(mention.components, (component) => component.name === name),
      (component) => observation(component.anchor)
    );
    expect(O.getOrNull(component), `${id}:${name}`).toEqual(expected[name]);
  }
};
const assertFields = (id: string, citation: Citation, expected: Row["expected"][number]) => {
  const actual = fields(citation);
  for (const [key, value] of R.toEntries(expected.fields)) {
    const want = key === "title" && value !== null ? `${value}` : value;
    expect(Reflect.get(actual, key), `${id}:${key}`).toEqual(want);
  }
};
const assertDocument = (row: Row, document: CitationDocument) => {
  const first = firstAuthorities(document);
  expect(A.length(document.mentions), row.id).toBe(A.length(row.expected));
  A.forEach(document.mentions, (mention, index) => {
    const expected = A.getUnsafe(row.expected, index);
    const form =
      mention.citation.type === "law"
        ? part(mention.citation, "title") === "35"
          ? "usc"
          : "cfr"
        : forms[mention.citation.type];
    expect(form, row.id).toBe(expected.form);
    expect(observation(mention.anchor), row.id).toEqual(expected.anchor);
    assertComponents(row.id, mention, expected);
    assertFields(row.id, mention.citation, expected);
    expect(linkOf(A.getUnsafe(document.resolutions, index), first), `${row.id}:link`).toEqual(expected.link);
  });
};
const install = Effect.fnUntraced(function* (
  profile: typeof Profile.Type,
  runtime: Parameters<typeof CitationExtractorConfiguration.make>[0]["runtime"],
  limits: Parameters<typeof CitationExtractorConfiguration.make>[0]["installation"]["limits"]
) {
  const implementation = yield* S.decodeEffect(Sha256HexFromBytes)(
    new TextEncoder().encode("six-form-projection-test")
  );
  const sources = yield* Effect.forEach(profile.cases, (row) => citationFixtureSourceProof(row.text));
  const resolver = SourceTextResolver.of({
    resolve: Effect.fnUntraced(function* (request) {
      const source = A.findFirst(sources, (source) =>
        S.toEquivalence(SourceTextIdentity)(source.source, request.identity)
      );
      if (O.isNone(source)) return yield* Effect.die("unregistered test source");
      return ResolvedSourceText.make({ identity: source.value.source, text: source.value.sourceText });
    }),
  });
  const configuration = CitationExtractorConfiguration.make({
    runtime,
    installation: {
      implementation,
      runtime: citationFixtureEngineBuild(runtime.kind).runtime,
      limits,
      vocabularyVersion: Result.getOrThrow(CourtReporterArtifact).artifactVersion,
    },
  });
  const context = yield* Layer.build(
    CitationExtractorLive(configuration).pipe(Layer.provide(Layer.succeed(SourceTextResolver, resolver)))
  );
  return Context.get(context, CitationExtractor);
});
it.layer(Layer.mergeAll(BunServices.layer, BunCrypto.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "verified six-form adapter",
  (it) => {
    for (const kind of ["bun", "node"] as const)
      it.effect(
        `${kind} public Layer matches frozen fields, verified original/component anchors and local links`,
        () =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-six-form-projection-" });
            const runtime = yield* makeCitationBundledTestRuntime(
              kind,
              NodeURL.fileURLToPath(
                kind === "bun"
                  ? new URL("../src/internal/Citation/RecognizerWorker.entry.ts", import.meta.url)
                  : new URL("../src/internal/Citation/RecognizerWorker.node.entry.ts", import.meta.url)
              ),
              cwd
            );
            const raw = yield* fs.readFileString(
              NodeURL.fileURLToPath(new URL("./fixtures/citation-six-form-profile.json", import.meta.url))
            );
            const profile = yield* S.decodeEffect(Profile)(raw);
            const { limits } = yield* defaultCitationEnginePolicy;
            const extractor = yield* install(profile, runtime, limits);
            let count = 0;
            for (const row of profile.cases) {
              const source = yield* citationFixtureSourceProof(row.text);
              const result = yield* extractor.extract(
                CitationExtractorInput.make({ source: source.source, sourceText: row.text })
              );
              const document = result.document;
              const mentions = document.mentions;
              expect(result.report.recognizedMentions).toBe(A.length(mentions));
              assertDocument(row, document);
              count += A.length(mentions);
            }
            expect(count).toBe(33);
          }),
        30_000
      );
  }
);
