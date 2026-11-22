import {
  Citation,
  CitationComponentAnchor,
  CitationDocument,
  CitationDocumentReceipt,
  CitationFootnoteZone,
  CitationMention,
  CitationMentionReceipt,
  CitationOverlapWarning,
} from "@beep/law-practice-domain/values";
import {
  CitationAuthorityEdition,
  CitationAuthorityIdentityInput,
} from "@beep/law-practice-server/internal/Citation/AuthorityIdentity";
import { CitationCallbackResult } from "@beep/law-practice-server/internal/Citation/CallbackResource";
import {
  CitationCallbackDictionary,
  CitationCallbackFailure,
  CitationCallbackResource,
  CitationResolutionCallbacks,
  CitationResolutionWork,
  makeCitationCallbackDictionary,
  makeCitationResolutionWork,
  runPreparedCitationCallbackSession,
} from "@beep/law-practice-server/internal/Citation/CallbackSession";
import {
  projectCitationDocumentReceipt,
  restoreCitationDocument,
} from "@beep/law-practice-server/internal/Citation/Document";
import { makeCitationMention } from "@beep/law-practice-server/internal/Citation/Mention";
import { prepareCitationResolution } from "@beep/law-practice-server/internal/Citation/ResolutionInput";
import { resolveSixFormCitationMentions } from "@beep/law-practice-server/internal/Citation/Resolve";
import {
  CitationResourceBinding,
  CitationResourceIdentity,
} from "@beep/law-practice-server/internal/Citation/ResourceIdentity";
import {
  CitationSessionResourceDescriptors,
  makeCitationSessionDocumentProjector,
} from "@beep/law-practice-server/internal/Citation/SessionDocument";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  VerifySourceTextIdentityInput,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifySourceTextIdentity,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import cases from "../../use-cases/test/fixtures/eyecite/authority-identity-cases.json" with { type: "json" };
import type { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";

// `fixtures/citation-document-receipt-v3.json` holds two receipts over one synthetic text, exactly as
// `projectCitationDocumentReceipt` and the session projector wrote them under citation-document-receipt/v3 and
// citation-mention-receipt/v1 (`projected` below). Receipts held outside the process keep those bytes, so the file
// is never regenerated and its digest is pinned.
const frozenDigest = "ebd1382134f61e6e60be9fb9a2fdeb145fd572f74389605cab57f2b9538dbaac";
const frozenText = pipe(
  import.meta.glob<string>("./fixtures/citation-document-receipt-v3.json", {
    eager: true,
    import: "default",
    query: "?raw",
  }),
  R.values,
  A.join("")
);
const Frozen = S.Struct({
  sourceText: S.String,
  expectedSource: SourceTextIdentity,
  engineArtifact: Sha256Hex,
  editions: S.Array(CitationAuthorityEdition),
  document: S.Unknown,
  session: S.Unknown,
  sessionBindings: S.Unknown,
});
const FrozenJson = S.fromJsonString(Frozen);
const Json = S.fromJsonString(S.Unknown);
const MentionJson = S.fromJsonString(CitationMentionReceipt);
const Bindings = S.Array(CitationResourceBinding);
const encoder = new TextEncoder();
const artifact = Sha256Hex.make(Str.repeat(64)("a"));

const quotes = ["1 U.S. 1", "1 U.S. ___", "Roe, supra", "1 U.S. 1", "Id.", "1 U.S., at 3", "Doe, supra"];
const sourceText = `😀 ${A.join(quotes, "; ")}.`;
const starts = A.map(
  quotes,
  (_, index) => Str.length(`😀 ${A.join(A.take(quotes, index), "; ")}`) + (index > 0 ? 2 : 0)
);

const authorityCase = Effect.fn("CitationMigrationTest.case")((name: string) =>
  Effect.fromOption(A.findFirst(cases.cases, (row) => row.name === name)).pipe(
    Effect.flatMap((row) => S.decodeUnknownEffect(CitationAuthorityIdentityInput)(row.input))
  )
);
const anchorAt = (verifiedSource: VerifiedSourceText, startChar: number, quote: string) =>
  verifyTextAnchorAgainstVerifiedSource(
    VerifyTextAnchorAgainstVerifiedSourceInput.make({
      verifiedSource,
      anchor: TextAnchor.make({ startChar, endChar: startChar + Str.length(quote), quote }),
    })
  );

// One full case cited twice and by an Id., one missing-page case (its authority key embeds the mention id) cited
// again by a supra, an ambiguous short form and an unresolved supra; the first mention carries a component and a
// footnote zone, the fourth an overlap warning.
const scene = Effect.gen(function* () {
  const digest = SourceTextDigest.make(
    `sha256:${yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(sourceText))}`
  );
  const source = SourceTextIdentity.make({
    scopeRef: "matter:fixture",
    sourceRef: "source:fixture",
    locator: PosixPath.make("source.txt"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });
  const verifiedSource = yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({ source, expectedSource: source, sourceText })
  );
  const full = yield* authorityCase("case");
  const missingPage = yield* authorityCase("missing-page");
  const missingWire = yield* S.encodeEffect(Citation)(missingPage.citation);
  if (missingWire.type !== "case") return yield* Effect.die("case model required");
  const roe = yield* S.decodeEffect(Citation)({
    ...missingWire,
    metadata: { ...missingWire.metadata, plaintiff: "Roe" },
  });
  const wire = yield* S.encodeEffect(Citation)(full.citation);
  if (wire.type !== "case") return yield* Effect.die("case model required");
  const locator = { pinCite: null, parenthetical: null };
  const id = yield* S.decodeEffect(Citation)({ type: "id", components: {}, metadata: locator });
  const short = yield* S.decodeEffect(Citation)({
    type: "shortFormCase",
    components: { volume: "1", reporter: "U.S." },
    publication: wire.publication,
    metadata: {
      ...locator,
      year: null,
      month: null,
      day: null,
      court: null,
      plaintiff: null,
      antecedentGuess: null,
    },
  });
  const supra = Effect.fn("CitationMigrationTest.supra")((antecedentGuess: string) =>
    S.decodeEffect(Citation)({
      type: "supra",
      components: {},
      metadata: { ...locator, antecedentGuess, volume: null },
    })
  );
  const roeSupra = yield* supra("Roe");
  const doeSupra = yield* supra("Doe");
  const zone = yield* anchorAt(verifiedSource, 0, sourceText);
  const volume = yield* anchorAt(verifiedSource, A.getUnsafe(starts, 0), "1");
  const plain = yield* Effect.forEach(
    A.zip(A.zip(starts, quotes), [full.citation, roe, roeSupra, full.citation, id, short, doeSupra]),
    Effect.fnUntraced(function* ([[start, quote], citation]) {
      const anchor = yield* anchorAt(verifiedSource, start, quote);
      return yield* makeCitationMention({
        citation,
        anchor,
        engineArtifact: artifact,
        components: [],
        footnote: O.none(),
        signal: O.none(),
        warnings: [],
        evidenceConfidence: O.none(),
      });
    }),
    { concurrency: 1 }
  );
  const previousMentionId = A.getUnsafe(plain, 2).id;
  const mentions = A.map(plain, (mention, index) => {
    if (index === 0)
      return CitationMention.make({
        ...mention,
        components: [CitationComponentAnchor.make({ name: "volume", anchor: volume })],
        footnote: CitationFootnoteZone.makeOption({ label: O.some("1"), anchor: zone }),
      });
    return index === 3
      ? CitationMention.make({ ...mention, warnings: [CitationOverlapWarning.make({ previousMentionId })] })
      : mention;
  });
  const policy = yield* defaultCitationEnginePolicy;
  const editions = O.toArray(full.selectedEdition);
  return {
    source,
    editions,
    input: { verifiedSource, mentions, editions, engineArtifact: artifact, limits: policy.limits },
    detachedModel: yield* S.decodeEffect(Citation)({
      ...wire,
      components: { volume: "9", reporter: "U.S.", page: "9" },
    }),
  };
}).pipe(Effect.withSpan("CitationMigrationTest.scene"));

const external = (key: string) =>
  CitationCallbackResource.cases.Hashable.make({
    identity: CitationResourceIdentity.cases.External.make({
      scope: artifact,
      key: Sha256Hex.make(Str.repeat(64)(key)),
    }),
    truthy: true,
    value: null,
  });

// A callback session over the first three mentions: one external resource owns every decision, a second one owns a
// list of one detached citation. Its group, list and detached ids are session nodes.
const session = Effect.fn("CitationMigrationTest.session")(function* (data: Effect.Success<typeof scene>) {
  const prepared = yield* prepareCitationResolution({ ...data.input, mentions: A.take(data.input.mentions, 3) });
  const work = yield* makeCitationResolutionWork(prepared.limits);
  const dictionary = yield* makeCitationCallbackDictionary(prepared).pipe(
    Effect.provideService(CitationResolutionWork, work)
  );
  const chosen = external("b");
  const other = external("c");
  const refuse = () => Effect.fail(CitationCallbackFailure.make({ reason: "invalid-input" }));
  const callbacks = CitationResolutionCallbacks.of({
    full: Effect.fn("CitationMigrationTest.full")(function* () {
      const reference = yield* dictionary.registerDetached(data.detachedModel);
      const list = yield* dictionary.allocate([reference]);
      yield* dictionary.set(other, list);
      return chosen;
    }),
    shortCase: refuse,
    supra: Effect.fn("CitationMigrationTest.chosenSupra")(() =>
      Effect.succeed(CitationCallbackResult.make({ resource: chosen }))
    ),
    reference: refuse,
    id: refuse,
  });
  const state = yield* runPreparedCitationCallbackSession(prepared).pipe(
    Effect.provideService(CitationResolutionWork, work),
    Effect.provideService(CitationCallbackDictionary, dictionary),
    Effect.provideService(CitationResolutionCallbacks, callbacks)
  );
  const projector = yield* makeCitationSessionDocumentProjector().pipe(
    Effect.provideService(
      CitationSessionResourceDescriptors,
      CitationSessionResourceDescriptors.of({
        describe: Effect.fn("CitationMigrationTest.describe")(function* (resource: CitationCallbackResource) {
          return resource._tag === "Hashable" ? resource.identity : yield* refuse();
        }),
      })
    )
  );
  return yield* projector.project(state);
});

const encodeFrozen = Effect.fn("CitationMigrationTest.encode")(function* (
  data: Omit<typeof Frozen.Type, "document" | "session" | "sessionBindings"> & {
    readonly document: CitationDocumentReceipt;
    readonly session: CitationDocumentReceipt;
    readonly sessionBindings: typeof Bindings.Type;
  }
) {
  const document = yield* S.encodeEffect(CitationDocumentReceipt)(data.document);
  const session = yield* S.encodeEffect(CitationDocumentReceipt)(data.session);
  const sessionBindings = yield* S.encodeEffect(Bindings)(data.sessionBindings);
  return yield* S.encodeEffect(FrozenJson)({ ...data, document, session, sessionBindings });
});

// Both receipts, projected now by the production code, in the shape of the frozen file.
const projected = Effect.gen(function* () {
  const data = yield* scene;
  const custom = yield* session(data);
  const resolved = yield* resolveSixFormCitationMentions(data.input);
  const document = CitationDocument.make({ ...resolved, detachedCitations: custom.document.detachedCitations });
  const receipt = yield* projectCitationDocumentReceipt({ document, editions: data.editions });
  const json = yield* encodeFrozen({
    sourceText,
    expectedSource: data.source,
    engineArtifact: artifact,
    editions: data.editions,
    document: receipt,
    session: custom.receipt,
    sessionBindings: custom.resourceBindings,
  });
  return { document, receipt, custom, json };
}).pipe(Effect.withSpan("CitationMigrationTest.projected"));

const readFrozen = Effect.gen(function* () {
  const frozen = yield* S.decodeEffect(FrozenJson)(frozenText);
  return {
    frozen,
    // The file's JSON without its formatting.
    json: yield* S.decodeEffect(Json)(frozenText).pipe(Effect.flatMap(S.encodeEffect(Json))),
    document: yield* S.decodeUnknownEffect(CitationDocumentReceipt)(frozen.document),
    session: yield* S.decodeUnknownEffect(CitationDocumentReceipt)(frozen.session),
    sessionBindings: yield* S.decodeUnknownEffect(Bindings)(frozen.sessionBindings),
    restore: {
      editions: frozen.editions,
      expectedSource: frozen.expectedSource,
      expectedEngineArtifact: frozen.engineArtifact,
      sourceText: frozen.sourceText,
    },
  };
});

it.layer(BunCrypto.layer)("frozen citation-document-receipt/v3", (it) => {
  it.effect("is the captured file, and the production projections still write it", () =>
    Effect.gen(function* () {
      const digest = yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(frozenText));
      expect(digest).toBe(frozenDigest);
      const fresh = yield* projected;
      const read = yield* readFrozen;
      expect(fresh.json).toBe(read.json);
    })
  );

  it.effect("decodes to the projected receipts and encodes back to the same bytes", () =>
    Effect.gen(function* () {
      const fresh = yield* projected;
      const read = yield* readFrozen;
      expect(read.document).toEqual(fresh.receipt);
      expect(read.session).toEqual(fresh.custom.receipt);
      expect(read.sessionBindings).toEqual(fresh.custom.resourceBindings);
      const { document, session, sessionBindings } = read;
      const rewritten = yield* encodeFrozen({ ...read.frozen, document, session, sessionBindings });
      expect(rewritten).toBe(read.json);
    })
  );

  it.effect.prop(
    "any mention receipt decodes and encodes back to the same bytes",
    [Arbitrary.schema(CitationMentionReceipt)],
    ([receipt]) =>
      Effect.gen(function* () {
        const written = yield* S.encodeEffect(MentionJson)(receipt);
        const read = yield* S.decodeEffect(MentionJson)(written);
        const rewritten = yield* S.encodeEffect(MentionJson)(read);
        expect(rewritten).toBe(written);
      }),
    { arbitrary: fcRuns(10) }
  );

  it.effect("restores the document receipt and projects the same bytes again", () =>
    Effect.gen(function* () {
      const { document, receipt } = yield* projected;
      const read = yield* readFrozen;
      const restored = yield* restoreCitationDocument({ ...read.restore, receipt: read.document });
      expect(restored.authorities).toEqual(document.authorities);
      expect(restored.resolutions).toEqual(document.resolutions);
      expect(restored.groups).toEqual(document.groups);
      expect(restored.memberLists).toEqual(document.memberLists);
      expect(restored.detachedCitations).toEqual(document.detachedCitations);
      const again = yield* projectCitationDocumentReceipt({ document: restored, editions: read.restore.editions });
      expect(again).toEqual(receipt);

      const tampered = yield* restoreCitationDocument({
        ...read.restore,
        receipt: read.document,
        sourceText: `${read.restore.sourceText}!`,
      }).pipe(Effect.flip);
      expect(tampered).toMatchObject({ _tag: "CitationDocumentFailure", reason: "unverifiable-evidence" });
    })
  );

  it.effect("restores the session receipt only with its out-of-band bindings", () =>
    Effect.gen(function* () {
      const { custom } = yield* projected;
      const read = yield* readFrozen;
      const input = { ...read.restore, receipt: read.session };
      const restored = yield* restoreCitationDocument({ ...input, resourceBindings: read.sessionBindings });
      expect(restored.groups).toEqual(custom.document.groups);
      expect(restored.memberLists).toEqual(custom.document.memberLists);
      expect(restored.detachedCitations).toEqual(custom.document.detachedCitations);
      const unbound = yield* restoreCitationDocument(input).pipe(Effect.flip);
      expect(unbound).toMatchObject({ _tag: "CitationDocumentFailure", reason: "stale-authority" });
    })
  );

  it.effect("covers every identifier the v4 step reads, rewrites or keeps", () =>
    Effect.gen(function* () {
      const { document, session } = yield* readFrozen;
      expect(A.map(document.resolutions, (resolution) => resolution.status)).toEqual([
        "Resolved",
        "Resolved",
        "Resolved",
        "Resolved",
        "Resolved",
        "Ambiguous",
        "Unresolved",
      ]);
      const [fullCase, missingPage] = document.authorities;
      const suffix = (id: string) => Str.slice(4)(id);
      // Both authorities own default groups and lists; the second key embeds the second mention's id.
      expect(A.map(document.groups, (group) => suffix(group.id))).toEqual([
        suffix(fullCase?.id ?? ""),
        suffix(missingPage?.id ?? ""),
      ]);
      expect(A.map(document.memberLists, (list) => A.length(list.members))).toEqual([3, 2]);
      expect(A.map(document.mentions, (mention) => A.length(mention.warnings))).toEqual([0, 0, 0, 1, 0, 0, 0]);
      expect(A.map(document.mentions, (mention) => A.length(mention.components))).toEqual([1, 0, 0, 0, 0, 0, 0]);
      expect(A.map(document.mentions, (mention) => O.isSome(mention.footnote))).toEqual([
        true,
        false,
        false,
        false,
        false,
        false,
        false,
      ]);
      expect(document.detachedCitations).toHaveLength(1);
      // Session nodes: no group or list id is a slice of an authority digest.
      expect(session.groups).toHaveLength(2);
      expect(
        A.intersection(
          A.map(session.groups, (group) => suffix(group.id)),
          A.map(session.authorities, (authority) => suffix(authority.id))
        )
      ).toEqual([]);
      expect(session.detachedCitations).toEqual(document.detachedCitations);
    })
  );
});
