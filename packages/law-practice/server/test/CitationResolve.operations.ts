import { fileURLToPath } from "node:url";
import { Citation } from "@beep/law-practice-domain/values";
import { CitationAuthorityEdition } from "@beep/law-practice-server/_test/Citation/AuthorityIdentity";
import { CitationOracleOperations } from "@beep/law-practice-use-cases/test";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CitationResolutionContext } from "./CitationResolve.fixtures.ts";

type Observation = Extract<CitationOracleOperations["cases"][number], { readonly operation: "resolve_citations" }>;
type OracleCitation = Observation["payload"]["value"]["input"]["citations"][number];
const kinds = {
  FullCaseCitation: "case",
  ShortCaseCitation: "shortFormCase",
  FullLawCitation: "law",
  FullJournalCitation: "journal",
  SupraCitation: "supra",
  IdCitation: "id",
  ReferenceCitation: "reference",
  UnknownCitation: "unknown",
} satisfies Record<OracleCitation["citationType"], (typeof Citation.Encoded)["type"]>;
const Callbacks = S.Struct({
  resolve_full_citation: S.Struct({ callable: S.Literal("eyecite.resolve.resolve_full_citation") }),
  resolve_shortcase_citation: S.Struct({ callable: S.Literal("eyecite.resolve._resolve_shortcase_citation") }),
  resolve_supra_citation: S.Struct({ callable: S.Literal("eyecite.resolve._resolve_supra_citation") }),
  resolve_reference_citation: S.Struct({ callable: S.Literal("eyecite.resolve._resolve_reference_citation") }),
  resolve_id_citation: S.Struct({ callable: S.Literal("eyecite.resolve._resolve_id_citation") }),
});
const Ref = S.Struct({ artifactSha256: Sha256Hex });
const ResourceFields = S.Struct({ all_editions: S.Array(Ref), edition_guess: S.NullOr(Ref) });
const Metadata = S.Struct({ fields: S.JsonObject });
const Edition = S.Struct({
  pythonType: S.Literal("eyecite.models.Edition"),
  fields: S.Struct({ short_name: S.NonEmptyString }),
});
const Vocabulary = S.Struct({
  publicArtifactVersion: S.NonEmptyString,
  editions: S.Array(S.Struct({ artifactSha256: Sha256Hex, reporterId: S.optionalKey(S.NonEmptyString) })),
});
const corpusUrl = new URL("../../use-cases/test/fixtures/eyecite/operation-cases.json", import.meta.url);
const vocabularyUrl = new URL("../../use-cases/test/fixtures/eyecite/vocabulary-mapping.json", import.meta.url);

/**
 * Test-only projection of every existing default resolution observation.
 * Original positions remain in the corpus; new witnesses are semantic-only.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const loadResolutionOperationContexts = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(fileURLToPath(corpusUrl));
  const corpus = yield* S.decodeEffect(S.fromJsonString(CitationOracleOperations))(raw);
  const corpusSha256 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
  const vocabulary = yield* S.decodeEffect(S.fromJsonString(Vocabulary))(
    yield* fs.readFileString(fileURLToPath(vocabularyUrl))
  );
  const editions = HashMap.fromIterable(
    A.map(vocabulary.editions, (edition) => Tuple.make(edition.artifactSha256, edition))
  );
  const observations = A.filter(corpus.cases, (row) => row.operation === "resolve_citations");
  const artifacts = corpus.artifacts;
  const project = Effect.fn("ResolveTest.projectOracleCitation")(function* (source: OracleCitation) {
    const meta = yield* S.decodeUnknownEffect(Metadata)(source.fields.metadata);
    const read = Effect.fn("ResolveTest.readMetadata")(function* (key: string) {
      return yield* S.decodeUnknownEffect(S.NullOr(S.String))(yield* Effect.fromOption(R.get(meta.fields, key)));
    });
    let metadata: S.JsonObject = {
      pinCite: yield* read("pin_cite"),
      parenthetical: yield* read("parenthetical"),
    };
    let publication: S.Json = null;
    let selectedEdition: O.Option<CitationAuthorityEdition> = O.none();
    const kind = source.citationType;
    if (
      kind === "FullCaseCitation" ||
      kind === "ShortCaseCitation" ||
      kind === "FullLawCitation" ||
      kind === "FullJournalCitation"
    ) {
      const resource = yield* S.decodeUnknownEffect(ResourceFields)(source.fields);
      const refs = A.map(resource.all_editions, (ref) => ref.artifactSha256);
      const selected = resource.edition_guess?.artifactSha256 ?? null;
      publication = { editions: refs, selectedEdition: selected };
      if (kind === "FullCaseCitation" || kind === "ShortCaseCitation") {
        const values = yield* Effect.forEach(refs, (ref) =>
          Effect.gen(function* () {
            const entry = yield* Effect.fromOption(HashMap.get(editions, ref));
            const reporterId = yield* Effect.fromOption(O.fromUndefinedOr(entry.reporterId));
            return { edition: ref, reporterId };
          })
        );
        publication = {
          vocabularyVersion: vocabulary.publicArtifactVersion,
          editions: values,
          selectedEdition: selected,
        };
        const court = yield* read("court");
        metadata = R.set<string, S.Json, string, S.Json>(
          metadata,
          "court",
          court === null ? null : { status: "unmapped", value: court }
        );
      }
      for (const key of ["year", "month", "day"])
        metadata = R.set<string, S.Json, string, S.Json>(metadata, key, yield* read(key));
      if (selected !== null) {
        const artifact = yield* Effect.fromOption(R.get(artifacts, selected));
        if (artifact.kind !== "model-value") return yield* Effect.die("Expected model edition artifact");
        const digest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(artifact.payload.raw));
        if (digest !== selected) return yield* Effect.die("Edition artifact hash mismatch");
        const edition = yield* S.decodeUnknownEffect(Edition)(artifact.payload.value);
        selectedEdition = O.some(
          yield* S.decodeEffect(CitationAuthorityEdition)({ edition: selected, shortName: edition.fields.short_name })
        );
      }
    }
    if (kind === "FullCaseCitation" || kind === "ReferenceCitation") {
      for (const [from, to] of R.toEntries({
        plaintiff: "plaintiff",
        defendant: "defendant",
        resolved_case_name_short: "shortCaseName",
        resolved_case_name: "caseName",
      }))
        metadata = R.set<string, S.Json, string, S.Json>(metadata, to, yield* read(from));
    }
    if (kind === "FullCaseCitation")
      metadata = R.set<string, S.Json, string, S.Json>(metadata, "additionalText", yield* read("extra"));
    if (kind === "FullCaseCitation" || kind === "ShortCaseCitation" || kind === "SupraCitation")
      metadata = R.set<string, S.Json, string, S.Json>(metadata, "antecedentGuess", yield* read("antecedent_guess"));
    if (kind === "FullLawCitation")
      metadata = R.set<string, S.Json, string, S.Json>(metadata, "publisher", yield* read("publisher"));
    if (kind === "SupraCitation")
      metadata = R.set<string, S.Json, string, S.Json>(metadata, "volume", yield* read("volume"));
    const citation = yield* S.decodeUnknownEffect(Citation)({
      type: kinds[kind],
      components: source.fields.groups,
      metadata,
      ...(publication === null ? {} : { publication }),
    });
    return { citation, selectedEdition };
  });
  const contexts = yield* Effect.forEach(observations, (row) =>
    Effect.gen(function* () {
      const body = row.payload.value;
      yield* S.decodeUnknownEffect(Callbacks)(body.input);
      const digest = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(row.payload.raw));
      if (digest !== row.normalizedSha256) return yield* Effect.die("Observation payload hash mismatch");
      if (body.outcome.kind !== "success")
        return yield* Effect.die("Expected successful committed default observation");
      let text = "";
      let descriptors = HashMap.empty<Sha256Hex, CitationAuthorityEdition>();
      const mentions = yield* Effect.forEach(body.input.citations, (source) =>
        Effect.gen(function* () {
          const projected = yield* project(source);
          if (O.isSome(projected.selectedEdition))
            descriptors = HashMap.set(
              descriptors,
              projected.selectedEdition.value.edition,
              projected.selectedEdition.value
            );
          const start = Str.length(text);
          const quote = source.matchedText;
          text = `${text}${quote}; `;
          return { citation: projected.citation, start, end: start + Str.length(quote), quote };
        })
      );
      const context = CitationResolutionContext.make({
        name: row.id,
        text,
        mentions,
        editions: descriptors.pipe(HashMap.values, A.fromIterable),
        outcome: { status: "value", groups: A.map(body.stages.resolutionGroups, (group) => group.members) },
      });
      return { context, sourceSiteId: row.sourceSiteId, sourceNormalizedSha256: row.normalizedSha256 };
    })
  );
  return { corpusSha256, contexts, sourceSiteIds: A.dedupe(A.map(observations, (row) => row.sourceSiteId)) };
}).pipe(Effect.withSpan("ResolveTest.loadOperationContexts"));
