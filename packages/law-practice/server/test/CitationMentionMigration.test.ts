import {
  Citation,
  CitationAmbiguous,
  CitationComponentAnchor,
  CitationComponentReceipt,
  CitationDocument,
  CitationDocumentReceipt,
  CitationFootnoteReceipt,
  CitationFootnoteZone,
  CitationGroupMember,
  CitationMentionReceipt,
  CitationOverlapWarning,
  CitationResolution,
  CitationResolved,
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
import { runDefaultCitationCallbackSession } from "@beep/law-practice-server/internal/Citation/DefaultCallbacks";
import {
  projectCitationDocumentReceipt,
  restoreCitationDocument,
} from "@beep/law-practice-server/internal/Citation/Document";
import { makeCitationMention } from "@beep/law-practice-server/internal/Citation/Mention";
import { citationMentionIdV1 } from "@beep/law-practice-server/internal/Citation/MentionIdentityV1";
import {
  CitationDocumentReceiptRead,
  CitationMentionReceiptRead,
  readCitationDocumentReceipt,
  readCitationMentionReceipt,
} from "@beep/law-practice-server/internal/Citation/ReceiptRead";
import { prepareCitationResolution } from "@beep/law-practice-server/internal/Citation/ResolutionInput";
import { resolveSixFormCitationMentions } from "@beep/law-practice-server/internal/Citation/Resolve";
import { CitationResourceIdentity } from "@beep/law-practice-server/internal/Citation/ResourceIdentity";
import {
  CitationSessionResourceDescriptors,
  makeCitationSessionDocumentProjector,
} from "@beep/law-practice-server/internal/Citation/SessionDocument";
import { CitationEngineResolutionInput } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  VerifiedTextAnchor,
  VerifySourceTextIdentityInput,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifySourceTextIdentity,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/text/VerifiedTextAnchor";
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
import type { VerifiedSourceText } from "@beep/text/VerifiedTextAnchor";

// `fixtures/citation-document-receipt-v3.json` holds three receipts over one synthetic text, exactly as
// `projectCitationDocumentReceipt` and the session projector wrote them under citation-document-receipt/v3 and
// citation-mention-receipt/v1 before mention ids moved to cm2. Receipts held outside the process keep those bytes, so
// the file is never regenerated and its digest is pinned; `projected` below builds the same scene under v4 today.
const frozenDigest = "ec3554e18331b56bc4e9758ca33a7065948dc9f92ee89e32548e6a07d1cef90d";
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
  canonical: S.Unknown,
  canonicalBindings: S.Unknown,
});
const FrozenJson = S.fromJsonString(Frozen);
const Json = S.fromJsonString(S.Unknown);
const MentionJson = S.fromJsonString(CitationMentionReceipt);
const Mentions = S.Struct({ mentions: S.Array(S.Unknown) });
const MentionReceipts = S.Array(CitationMentionReceipt);
const MentionFields = S.Struct({
  id: S.String,
  engineArtifact: Sha256Hex,
  citation: S.Struct({ type: S.String }),
  anchor: TextAnchorVerificationReceipt,
});
const encoder = new TextEncoder();
const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const suffix = Str.slice(4);

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
// footnote zone, the fourth an overlap warning, a signal and an evidence confidence.
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
  const mentions = yield* Effect.forEach(
    plain,
    Effect.fnUntraced(function* (mention, index) {
      if (index === 0)
        return yield* makeCitationMention({
          ...mention,
          components: [CitationComponentAnchor.make({ name: "volume", anchor: volume })],
          footnote: CitationFootnoteZone.makeOption({ label: O.some("1"), anchor: zone }),
        });
      if (index !== 3) return mention;
      return yield* makeCitationMention({
        ...mention,
        signal: O.some("see also"),
        warnings: [CitationOverlapWarning.make({ previousMentionId })],
        evidenceConfidence: UnitInterval.makeOption(0.5),
      });
    }),
    { concurrency: 1 }
  );
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

// The session projector, with the identity each callback resource already carries as its descriptor: the Hashable branch
// of `makeCitationRegisteredSessionDescriptors`.
const projectSession = Effect.fn("CitationMigrationTest.projectSession")(function* (
  state: Effect.Success<ReturnType<typeof runDefaultCitationCallbackSession>>
) {
  const projector = yield* makeCitationSessionDocumentProjector().pipe(
    Effect.provideService(
      CitationSessionResourceDescriptors,
      CitationSessionResourceDescriptors.of({
        describe: Effect.fn("CitationMigrationTest.describe")(function* (resource: CitationCallbackResource) {
          return resource._tag === "Hashable"
            ? resource.identity
            : yield* CitationCallbackFailure.make({ reason: "invalid-input" });
        }),
      })
    )
  );
  return yield* projector.project(state);
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
  return yield* projectSession(state);
});

// The default callback session over the full case, the missing-page case, its supra and the ambiguous short form. Its
// authorities are the canonical keys of the two cases, so the missing-page key embeds a mention id, while every group
// and list id is a session node. The short form keeps both authorities as candidates, in the receipt and its bindings.
const canonicalSession = Effect.fn("CitationMigrationTest.canonicalSession")(function* (
  data: Effect.Success<typeof scene>
) {
  const mentions = A.filter(data.input.mentions, (_, index) => A.contains([0, 1, 2, 5], index));
  const state = yield* runDefaultCitationCallbackSession({ ...data.input, mentions });
  return yield* projectSession(state);
});

// The three receipts, projected now by the production code: v4 receipts over the same scene. The bundled resolvers leave
// every resolution confidence empty, so the document gives the projector one on a Resolved and one on the Ambiguous
// decision, as a producer that fills it would.
const projected = Effect.gen(function* () {
  const data = yield* scene;
  const custom = yield* session(data);
  const resolved = yield* resolveSixFormCitationMentions(data.input);
  const canonical = yield* canonicalSession(data);
  const document = CitationDocument.make({
    ...resolved,
    resolutions: A.map(resolved.resolutions, (resolution, index) => {
      if (resolution.status === "Ambiguous")
        return CitationAmbiguous.make({ ...resolution, confidence: UnitInterval.makeOption(0.25) });
      return index === 1 && resolution.status === "Resolved"
        ? CitationResolved.make({ ...resolution, confidence: UnitInterval.makeOption(0.75) })
        : resolution;
    }),
    detachedCitations: custom.document.detachedCitations,
  });
  const receipt = yield* projectCitationDocumentReceipt({ document, editions: data.editions });
  return { document, receipt, custom, canonical };
}).pipe(Effect.withSpan("CitationMigrationTest.projected"));

// What each v3 receipt stores, read only as far as these tests compare ids.
const Ids = S.Array(S.Struct({ id: S.String }));
const StoredIds = S.Struct({
  authorities: Ids,
  groups: Ids,
  memberLists: Ids,
  detachedCitations: Ids,
  mentions: Ids,
});
const Stored = S.Struct({ document: StoredIds, session: StoredIds, canonical: StoredIds });
const idsOf = A.map((node: { readonly id: string }) => node.id);

const readFrozen = Effect.gen(function* () {
  const frozen = yield* S.decodeEffect(FrozenJson)(frozenText);
  const stored = yield* S.decodeUnknownEffect(Stored)(frozen);
  return {
    frozen,
    stored,
    document: yield* readCitationDocumentReceipt(frozen.document),
    session: yield* readCitationDocumentReceipt(frozen.session),
    canonical: yield* readCitationDocumentReceipt(frozen.canonical),
    restore: {
      editions: frozen.editions,
      expectedSource: frozen.expectedSource,
      expectedEngineArtifact: frozen.engineArtifact,
      sourceText: frozen.sourceText,
    },
  };
});

// The frozen document receipt with one stored string replaced everywhere it occurs.
const frozenDocumentWith = Effect.fn("CitationMigrationTest.frozenDocumentWith")(function* (from: string, to: string) {
  const { frozen } = yield* readFrozen;
  const text = yield* S.encodeEffect(Json)(frozen.document);
  return yield* S.decodeEffect(Json)(Str.replaceAll(from, to)(text));
});

const refusalOf = Effect.fn("CitationMigrationTest.refusalOf")(function* (input: unknown) {
  const error = yield* S.decodeUnknownEffect(CitationDocumentReceiptRead)(input).pipe(Effect.flip);
  const failure = yield* readCitationDocumentReceipt(input).pipe(Effect.flip);
  expect(failure).toMatchObject({ _tag: "CitationReceiptReadFailure" });
  return String(error);
});

const staleV1 = `cm1:${Str.repeat(64)("f")}`;
// The cm2 ids of the seven mentions, minted over their OccurrenceIds.
const GOLDEN_MENTIONS: ReadonlyArray<string> = [
  "cm2:11b7430caeae6d07fcf6df9bf3247b4e5627c4a33f3c1bf7db55108743efaa67",
  "cm2:003220b3c8fbf45b9503157215fff82ff7d2478bb98c0051630bd74f1ce0f97c",
  "cm2:0f7ce6fa1a5c0979947e7adc7f579dbbe2de8230333b439b7dabba6f0b80144b",
  "cm2:bd2ba12423c6fe498448da084c95457c4293d4bc1f65f8ae340b452be6a15a50",
  "cm2:ee6458f763e67ad8844b41cbf1c8291e2bd86f6f45345ce3a5cfd96357fe0c2b",
  "cm2:16ef9e2ea86c04774e917d9cb6c295008b30aa4f805004fc28993c279714c6ee",
  "cm2:3183d8a8ac57aaea9c0ddfabbc5702c39346a60cd3de046b3f14211f22c124e5",
];
// The citation-authority/v2 case-occurrence key of the missing-page mention.
const GOLDEN_MISSING_PAGE = "ca1:041eb5451633d193b323b58a49f95ca76d585f3c6d0cfd26d76ae26bf5d38b79";

const coherentReceipt = Arbitrary.schema(
  S.Struct({
    ...CitationMentionReceipt.fields,
    footnote: S.OptionFromNullOr(
      S.Struct({ label: CitationFootnoteReceipt.fields.label, before: S.String, after: S.String })
    ),
  })
).pipe(
  Arbitrary.map((receipt) => {
    const { anchor, source } = receipt.anchor;
    return CitationMentionReceipt.make({
      ...receipt,
      components: A.map(receipt.components, (component) =>
        CitationComponentReceipt.make({
          name: component.name,
          anchor: TextAnchorVerificationReceipt.make({ anchor: component.anchor.anchor, source }),
        })
      ),
      footnote: O.map(receipt.footnote, ({ label, before, after }) => {
        const lead = Str.takeRight(before, anchor.startChar);
        return CitationFootnoteReceipt.make({
          label,
          anchor: TextAnchorVerificationReceipt.make({
            anchor: TextAnchor.make({
              startChar: anchor.startChar - Str.length(lead),
              endChar: anchor.endChar + Str.length(after),
              quote: `${lead}${anchor.quote}${after}`,
            }),
            source,
          }),
        });
      }),
    });
  })
);

const representativesOf = (receipt: CitationDocumentReceipt) =>
  A.getSomes(A.map(receipt.authorities, (authority) => authority.representative));

const candidatesOf = (receipt: CitationDocumentReceipt) =>
  A.map(
    A.filter(receipt.resolutions, CitationResolution.guards.Ambiguous),
    (decision) => decision.candidateAuthorityIds
  );

it.layer(BunCrypto.layer)("frozen citation-document-receipt/v3", (it) => {
  it.effect("is the captured file", () =>
    Effect.gen(function* () {
      const digest = yield* S.decodeEffect(Sha256HexFromBytes)(encoder.encode(frozenText));
      expect(digest).toBe(frozenDigest);
    })
  );

  it.effect("converts a frozen v3 receipt on read to the v2 identifiers", () =>
    Effect.gen(function* () {
      const fresh = yield* projected;
      const read = yield* readFrozen;
      // Every converted receipt is the receipt today's code projects over the same scene.
      expect(read.document).toEqual(fresh.receipt);
      expect(read.session).toEqual(fresh.custom.receipt);
      expect(read.canonical).toEqual(fresh.canonical.receipt);
      expect(read.document.schemaVersion).toBe("citation-document-receipt/v4");
      expect(A.map(read.document.mentions, (mention) => mention.schemaVersion)).toEqual(
        A.replicate("citation-mention-receipt/v2", 7)
      );
      expect(idsOf(read.document.mentions)).toEqual(GOLDEN_MENTIONS);
      expect(A.every(idsOf(read.document.mentions), Str.startsWith("cm2:"))).toBe(true);

      const { document, session, canonical } = read.stored;
      // The full case keeps its ca1 and default ids; the missing-page case takes the citation-authority/v2 key and its
      // default group and list follow it.
      const [fullCase, missingPage] = idsOf(document.authorities);
      expect(idsOf(read.document.authorities)).toEqual([fullCase, GOLDEN_MISSING_PAGE]);
      expect(idsOf(read.document.groups)).toEqual([
        A.getUnsafe(idsOf(document.groups), 0),
        `cg1:${suffix(GOLDEN_MISSING_PAGE)}`,
      ]);
      expect(idsOf(read.document.memberLists)).toEqual([
        A.getUnsafe(idsOf(document.memberLists), 0),
        `cl1:${suffix(GOLDEN_MISSING_PAGE)}`,
      ]);
      expect(missingPage).not.toBe(GOLDEN_MISSING_PAGE);
      // Detached ids, external authorities and session-node group and list ids are kept.
      expect(idsOf(read.document.detachedCitations)).toEqual(idsOf(document.detachedCitations));
      expect(idsOf(read.session.authorities)).toEqual(idsOf(session.authorities));
      expect(idsOf(read.session.groups)).toEqual(idsOf(session.groups));
      expect(idsOf(read.session.memberLists)).toEqual(idsOf(session.memberLists));
      expect(idsOf(read.session.detachedCitations)).toEqual(idsOf(session.detachedCitations));
      expect(idsOf(read.canonical.authorities)).toEqual([fullCase, GOLDEN_MISSING_PAGE]);
      expect(idsOf(read.canonical.groups)).toEqual(idsOf(canonical.groups));
      expect(idsOf(read.canonical.memberLists)).toEqual(idsOf(canonical.memberLists));
    })
  );

  it.effect("covers every identifier the conversion reads, rewrites or keeps", () =>
    Effect.gen(function* () {
      const { document, session, canonical } = yield* readFrozen;
      expect(A.map(document.resolutions, (resolution) => resolution.status)).toEqual([
        "Resolved",
        "Resolved",
        "Resolved",
        "Resolved",
        "Resolved",
        "Ambiguous",
        "Unresolved",
      ]);
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
      // The conversion carries these optional values over unread; each is present at least once.
      expect(A.getSomes(A.map(document.mentions, (mention) => mention.signal))).toEqual(["see also"]);
      expect(A.getSomes(A.map(document.mentions, (mention) => mention.evidenceConfidence))).toEqual([0.5]);
      const resolved = A.filter(document.resolutions, CitationResolution.guards.Resolved);
      const ambiguous = A.filter(document.resolutions, CitationResolution.guards.Ambiguous);
      expect(A.getSomes(A.map(resolved, (resolution) => resolution.confidence))).toEqual([0.75]);
      expect(A.getSomes(A.map(ambiguous, (resolution) => resolution.confidence))).toEqual([0.25]);

      // References that follow a rewritten authority.
      const keys = idsOf(document.authorities);
      expect(idsOf(canonical.authorities)).toEqual(keys);
      expect(A.map(document.groups, (group) => group.authorityId)).toEqual(keys);
      expect(A.map(canonical.groups, (group) => group.authorityId)).toEqual(keys);
      expect(candidatesOf(document)).toEqual([keys]);
      expect(candidatesOf(canonical)).toEqual([keys]);
      expect(candidatesOf(session)).toEqual([]);

      // References that follow a rewritten mention: decisions, warnings, representatives and members.
      const ids = A.map(document.mentions, (mention) => mention.id);
      const at = (index: number) => A.getUnsafe(ids, index);
      const mentionAt = (index: number) => CitationGroupMember.cases.Mention.make({ mentionId: at(index) });
      expect(A.map(document.resolutions, (resolution) => resolution.mentionId)).toEqual(ids);
      expect(A.map(canonical.resolutions, (resolution) => resolution.mentionId)).toEqual([at(0), at(1), at(2), at(5)]);
      expect(A.flatMap(document.mentions, (mention) => mention.warnings)).toEqual([
        CitationOverlapWarning.make({ previousMentionId: at(2) }),
      ]);
      expect(representativesOf(document)).toEqual([mentionAt(0), mentionAt(1)]);
      expect(A.map(document.memberLists, (list) => list.members)).toEqual([
        [mentionAt(0), mentionAt(3), mentionAt(4)],
        [mentionAt(1), mentionAt(2)],
      ]);
      expect(A.flatMap(session.memberLists, (list) => list.members)).toEqual([
        CitationGroupMember.cases.Detached.make({ detachedId: A.getUnsafe(session.detachedCitations, 0).id }),
        mentionAt(0),
        mentionAt(1),
        mentionAt(2),
      ]);
      expect(A.map(canonical.memberLists, (list) => list.members)).toEqual([
        [mentionAt(0)],
        [mentionAt(1), mentionAt(2)],
      ]);
    })
  );

  it.effect("restores the converted receipt to the same document as a fresh v4 projection", () =>
    Effect.gen(function* () {
      const { document, receipt } = yield* projected;
      const read = yield* readFrozen;
      const restored = yield* restoreCitationDocument({ ...read.restore, receipt: read.document });
      expect(restored.mentions).toEqual(document.mentions);
      expect(restored.authorities).toEqual(document.authorities);
      expect(restored.resolutions).toEqual(document.resolutions);
      expect(restored.groups).toEqual(document.groups);
      expect(restored.memberLists).toEqual(document.memberLists);
      expect(restored.detachedCitations).toEqual(document.detachedCitations);
      const again = yield* projectCitationDocumentReceipt({ document: restored, editions: read.restore.editions });
      expect(again).toEqual(receipt);
    })
  );

  it.effect("refuses a v3 mention whose stored cm1 does not match its recomputation", () =>
    Effect.gen(function* () {
      const { stored } = yield* readFrozen;
      // Every reference to the first mention moves with it, so the receipt is coherent apart from that one id.
      const tampered = yield* frozenDocumentWith(A.getUnsafe(idsOf(stored.document.mentions), 0), staleV1);
      const tamperedRefusal = yield* refusalOf(tampered);
      expect(tamperedRefusal).toContain("is not the recomputation of its own receipt");
    })
  );

  it.effect("refuses a dangling v3 reference", () =>
    Effect.gen(function* () {
      const { stored } = yield* readFrozen;
      const third = A.getUnsafe(idsOf(stored.document.mentions), 2);
      const warning = yield* frozenDocumentWith(`"previousMentionId":"${third}"`, `"previousMentionId":"${staleV1}"`);
      const warningRefusal = yield* refusalOf(warning);
      expect(warningRefusal).toContain("references a mention it does not hold");
      const first = A.getUnsafe(idsOf(stored.document.mentions), 0);
      const member = yield* frozenDocumentWith(
        `"_tag":"Mention","mentionId":"${first}"`,
        `"_tag":"Mention","mentionId":"${staleV1}"`
      );
      const memberRefusal = yield* refusalOf(member);
      expect(memberRefusal).toContain("references a mention it does not hold");
      // An authority reference that names no authority is refused by the live coherence check.
      const [fullCase] = idsOf(stored.document.authorities);
      const authority = yield* frozenDocumentWith(
        `"authorityId":"${fullCase}"`,
        `"authorityId":"ca1:${Str.repeat(64)("e")}"`
      );
      const authorityRefusal = yield* refusalOf(authority);
      expect(authorityRefusal).toContain("Citation document relationships are incoherent.");
    })
  );

  it.effect("never encodes v3", () =>
    Effect.gen(function* () {
      const read = yield* readFrozen;
      const written = yield* S.encodeEffect(CitationDocumentReceiptRead)(read.document);
      expect(written.schemaVersion).toBe("citation-document-receipt/v4");
      const v3 = yield* S.encodeUnknownEffect(CitationDocumentReceiptRead)(read.frozen.document).pipe(Effect.flip);
      expect(String(v3)).not.toContain("citation-document-receipt/v4");
      const mention = yield* S.encodeEffect(CitationMentionReceiptRead)(A.getUnsafe(read.document.mentions, 0));
      expect(mention.schemaVersion).toBe("citation-mention-receipt/v2");
    })
  );

  it.effect("refuses v1 and v2 documents", () =>
    Effect.gen(function* () {
      for (const version of ["citation-document-receipt/v1", "citation-document-receipt/v2"]) {
        const older = yield* frozenDocumentWith("citation-document-receipt/v3", version);
        yield* refusalOf(older);
      }
    })
  );

  it.effect("grants no proof: the converted receipt still needs the source text", () =>
    Effect.gen(function* () {
      const read = yield* readFrozen;
      expect(A.some(read.document.mentions, (mention) => S.is(VerifiedTextAnchor)(mention.anchor))).toBe(false);
      const tampered = yield* restoreCitationDocument({
        ...read.restore,
        receipt: read.document,
        sourceText: `${read.restore.sourceText}!`,
      }).pipe(Effect.flip);
      expect(tampered).toMatchObject({ _tag: "CitationDocumentFailure", reason: "unverifiable-evidence" });
    })
  );

  it.effect("restores with re-derived bindings", () =>
    Effect.gen(function* () {
      const { custom, canonical } = yield* projected;
      const read = yield* readFrozen;
      yield* Effect.forEach(
        [
          { receipt: read.session, fresh: custom, stored: read.frozen.sessionBindings },
          { receipt: read.canonical, fresh: canonical, stored: read.frozen.canonicalBindings },
        ],
        Effect.fnUntraced(function* ({ receipt, fresh, stored }) {
          const input = { ...read.restore, receipt };
          // The adapter re-derives its bindings; the v3 bindings it once returned are not converted.
          const restored = yield* restoreCitationDocument({ ...input, resourceBindings: fresh.resourceBindings });
          expect(restored.authorities).toEqual(fresh.document.authorities);
          expect(restored.resolutions).toEqual(fresh.document.resolutions);
          expect(restored.groups).toEqual(fresh.document.groups);
          expect(restored.memberLists).toEqual(fresh.document.memberLists);
          expect(restored.detachedCitations).toEqual(fresh.document.detachedCitations);
          const unbound = yield* restoreCitationDocument(input).pipe(Effect.flip);
          expect(unbound).toMatchObject({ _tag: "CitationDocumentFailure", reason: "stale-authority" });
          const old = yield* restoreCitationDocument({ ...input, resourceBindings: stored }).pipe(Effect.flip);
          expect(old).toMatchObject({ _tag: "CitationDocumentFailure", reason: "invalid-input" });
        }),
        { concurrency: 1, discard: true }
      );
    })
  );

  it.effect("converts a standalone v1 mention receipt and refuses one with warnings", () =>
    Effect.gen(function* () {
      const read = yield* readFrozen;
      const { mentions } = yield* S.decodeUnknownEffect(Mentions)(read.frozen.document);
      const first = yield* readCitationMentionReceipt(A.getUnsafe(mentions, 0));
      expect(first).toEqual(A.getUnsafe(read.document.mentions, 0));
      const withWarning = yield* S.decodeUnknownEffect(CitationMentionReceiptRead)(A.getUnsafe(mentions, 3)).pipe(
        Effect.flip
      );
      expect(String(withWarning)).toContain("A standalone v1 mention receipt references other mentions.");
      const failure = yield* readCitationMentionReceipt(A.getUnsafe(mentions, 3)).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationReceiptReadFailure" });
      const stale = yield* frozenDocumentWith(A.getUnsafe(idsOf(read.stored.document.mentions), 0), staleV1);
      const { mentions: staleMentions } = yield* S.decodeUnknownEffect(Mentions)(stale);
      const staleError = yield* S.decodeUnknownEffect(CitationMentionReceiptRead)(A.getUnsafe(staleMentions, 0)).pipe(
        Effect.flip
      );
      expect(String(staleError)).toContain("is not the recomputation of its own receipt");
    })
  );

  it.effect("refuses a v1 mention whose quote holds a lone surrogate: it has no OccurrenceId", () =>
    Effect.gen(function* () {
      const read = yield* readFrozen;
      const { mentions } = yield* S.decodeUnknownEffect(Mentions)(read.frozen.document);
      const text = yield* S.encodeEffect(Json)(A.getUnsafe(mentions, 6));
      const ill = yield* S.decodeEffect(Json)(
        Str.replaceAll('"quote":"Doe, supra"', '"quote":"Doe, supr\\ud800"')(text)
      );
      const fields = yield* S.decodeUnknownEffect(MentionFields)(ill);
      const recomputed = yield* citationMentionIdV1(fields.anchor, fields.engineArtifact, fields.citation.type);
      const illText = yield* S.encodeEffect(Json)(ill);
      const restamped = yield* S.decodeEffect(Json)(Str.replaceAll(fields.id, recomputed)(illText));
      const error = yield* S.decodeUnknownEffect(CitationMentionReceiptRead)(restamped).pipe(Effect.flip);
      expect(String(error)).toContain("could not be recomputed or minted");
    })
  );

  it.effect("serves only v2 mention receipts to the resolution input", () =>
    Effect.gen(function* () {
      const read = yield* readFrozen;
      const { mentions } = yield* S.decodeUnknownEffect(Mentions)(read.frozen.document);
      const live = yield* S.encodeEffect(MentionReceipts)(read.document.mentions);
      const input = { source: read.frozen.expectedSource, sourceText: read.frozen.sourceText };
      const served = yield* S.decodeEffect(CitationEngineResolutionInput)({ ...input, mentions: live });
      expect(served.mentions).toEqual(read.document.mentions);
      const v1 = yield* S.decodeUnknownEffect(CitationEngineResolutionInput)({ ...input, mentions }).pipe(Effect.flip);
      expect(v1._tag).toBe("SchemaError");
    })
  );

  it.effect("is the identity on a v4 receipt", () =>
    Effect.gen(function* () {
      const fresh = yield* projected;
      for (const receipt of [fresh.receipt, fresh.custom.receipt, fresh.canonical.receipt]) {
        const written = yield* S.encodeEffect(CitationDocumentReceipt)(receipt);
        const read = yield* readCitationDocumentReceipt(written);
        expect(read).toEqual(receipt);
        const again = yield* S.encodeEffect(CitationDocumentReceiptRead)(read);
        expect(again).toEqual(written);
      }
    })
  );

  it.effect.prop(
    "is the identity on any v2 mention receipt",
    [coherentReceipt],
    ([receipt]) =>
      Effect.gen(function* () {
        const written = yield* S.encodeEffect(MentionJson)(receipt);
        const decoded = yield* S.decodeEffect(Json)(written);
        const read = yield* readCitationMentionReceipt(decoded);
        const again = yield* S.encodeEffect(MentionJson)(read);
        expect(again).toBe(written);
      }),
    { arbitrary: fcRuns(10) }
  );
});
