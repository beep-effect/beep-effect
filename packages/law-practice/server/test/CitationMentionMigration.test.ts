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
  CitationMentionId,
  CitationMentionReceipt,
  CitationOverlapWarning,
  CitationResolution,
  CitationResolved,
  FullCitation,
} from "@beep/law-practice-domain/values";
import {
  CitationAuthorityEdition,
  CitationAuthorityIdentityInput,
  makeCitationAuthorityId,
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
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import {
  TextAnchorVerificationReceipt,
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
// citation-mention-receipt/v1 (`projected` below). Receipts held outside the process keep those bytes, so the file
// is never regenerated and its digest is pinned.
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
const Bindings = S.Array(CitationResourceBinding);
const encoder = new TextEncoder();
const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const isFull = S.is(FullCitation);
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

const encodeFrozen = Effect.fn("CitationMigrationTest.encode")(function* (
  data: Omit<typeof Frozen.Type, "document" | "session" | "sessionBindings" | "canonical" | "canonicalBindings"> & {
    readonly document: CitationDocumentReceipt;
    readonly session: CitationDocumentReceipt;
    readonly sessionBindings: typeof Bindings.Type;
    readonly canonical: CitationDocumentReceipt;
    readonly canonicalBindings: typeof Bindings.Type;
  }
) {
  const document = yield* S.encodeEffect(CitationDocumentReceipt)(data.document);
  const session = yield* S.encodeEffect(CitationDocumentReceipt)(data.session);
  const sessionBindings = yield* S.encodeEffect(Bindings)(data.sessionBindings);
  const canonical = yield* S.encodeEffect(CitationDocumentReceipt)(data.canonical);
  const canonicalBindings = yield* S.encodeEffect(Bindings)(data.canonicalBindings);
  return yield* S.encodeEffect(FrozenJson)({
    ...data,
    document,
    session,
    sessionBindings,
    canonical,
    canonicalBindings,
  });
});

// The three receipts, projected now by the production code, in the shape of the frozen file. The bundled resolvers leave
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
  const json = yield* encodeFrozen({
    sourceText,
    expectedSource: data.source,
    engineArtifact: artifact,
    editions: data.editions,
    document: receipt,
    session: custom.receipt,
    sessionBindings: custom.resourceBindings,
    canonical: canonical.receipt,
    canonicalBindings: canonical.resourceBindings,
  });
  return { document, receipt, custom, canonical, json };
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
    canonical: yield* S.decodeUnknownEffect(CitationDocumentReceipt)(frozen.canonical),
    canonicalBindings: yield* S.decodeUnknownEffect(Bindings)(frozen.canonicalBindings),
    restore: {
      editions: frozen.editions,
      expectedSource: frozen.expectedSource,
      expectedEngineArtifact: frozen.engineArtifact,
      sourceText: frozen.sourceText,
    },
  };
});

// What the v4 step does to each id a receipt owns. An authority key embeds a mention id when the production key of some
// full mention is that id and differs under another mention id; a group or list id follows it when it is its slice.
const fatesOf = Effect.fn("CitationMigrationTest.fates")(function* (receipt: CitationDocumentReceipt) {
  const { frozen } = yield* readFrozen;
  const otherId = CitationMentionId.make(`cm1:${Str.repeat(64)("f")}`);
  const embedding = yield* Effect.forEach(
    receipt.mentions,
    Effect.fnUntraced(function* ({ citation, id }) {
      if (!isFull(citation)) return O.none();
      const selectedEdition = O.flatMap(citation.publication.selectedEdition, (selected) =>
        A.findFirst(frozen.editions, (edition) => edition.edition === selected)
      );
      const key = yield* makeCitationAuthorityId({ citation, mentionId: id, selectedEdition });
      const other = yield* makeCitationAuthorityId({ citation, mentionId: otherId, selectedEdition });
      return key === other ? O.none() : O.some(suffix(key));
    }),
    { concurrency: 1 }
  );
  const rewritten = A.intersection(
    A.getSomes(embedding),
    A.map(receipt.authorities, (authority) => suffix(authority.id))
  );
  const fates = A.map((node: { readonly id: string }) =>
    A.contains(rewritten, suffix(node.id)) ? "rewritten" : "kept"
  );
  return {
    authorities: fates(receipt.authorities),
    groups: fates(receipt.groups),
    memberLists: fates(receipt.memberLists),
    detachedCitations: fates(receipt.detachedCitations),
  };
});

// Mention receipts that are coherent by construction: every nested anchor takes the primary anchor's source, and a
// footnote zone is the primary range extended on both sides. `Arbitrary.schema(CitationMentionReceipt)` draws each
// source on its own, so the coherence filter discards every receipt that has a component or a footnote.
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
      expect(read.canonical).toEqual(fresh.canonical.receipt);
      expect(read.canonicalBindings).toEqual(fresh.canonical.resourceBindings);
      const { document, session, sessionBindings, canonical, canonicalBindings } = read;
      const rewritten = yield* encodeFrozen({
        ...read.frozen,
        document,
        session,
        sessionBindings,
        canonical,
        canonicalBindings,
      });
      expect(rewritten).toBe(read.json);
    })
  );

  it.effect.prop(
    "any mention receipt decodes and encodes back to the same bytes",
    [coherentReceipt],
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

  it.effect("restores each session receipt only with its out-of-band bindings", () =>
    Effect.gen(function* () {
      const { custom, canonical } = yield* projected;
      const read = yield* readFrozen;
      yield* Effect.forEach(
        [
          { receipt: read.session, resourceBindings: read.sessionBindings, document: custom.document },
          { receipt: read.canonical, resourceBindings: read.canonicalBindings, document: canonical.document },
        ],
        Effect.fnUntraced(function* ({ receipt, resourceBindings, document }) {
          const input = { ...read.restore, receipt };
          const restored = yield* restoreCitationDocument({ ...input, resourceBindings });
          expect(restored.authorities).toEqual(document.authorities);
          expect(restored.resolutions).toEqual(document.resolutions);
          expect(restored.groups).toEqual(document.groups);
          expect(restored.memberLists).toEqual(document.memberLists);
          expect(restored.detachedCitations).toEqual(document.detachedCitations);
          const unbound = yield* restoreCitationDocument(input).pipe(Effect.flip);
          expect(unbound).toMatchObject({ _tag: "CitationDocumentFailure", reason: "stale-authority" });
        }),
        { concurrency: 1, discard: true }
      );
    })
  );

  it.effect("covers every identifier the v4 step reads, rewrites or keeps", () =>
    Effect.gen(function* () {
      const { document } = yield* readFrozen;
      expect(A.map(document.resolutions, (resolution) => resolution.status)).toEqual([
        "Resolved",
        "Resolved",
        "Resolved",
        "Resolved",
        "Resolved",
        "Ambiguous",
        "Unresolved",
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
      // The v4 step carries these optional values over unread; each is present at least once.
      expect(A.getSomes(A.map(document.mentions, (mention) => mention.signal))).toEqual(["see also"]);
      expect(A.getSomes(A.map(document.mentions, (mention) => mention.evidenceConfidence))).toEqual([0.5]);
      const resolved = A.filter(document.resolutions, CitationResolution.guards.Resolved);
      const ambiguous = A.filter(document.resolutions, CitationResolution.guards.Ambiguous);
      expect(A.getSomes(A.map(resolved, (resolution) => resolution.confidence))).toEqual([0.75]);
      expect(A.getSomes(A.map(ambiguous, (resolution) => resolution.confidence))).toEqual([0.25]);
      expect(document.detachedCitations).toHaveLength(1);
    })
  );

  // The v4 step rewrites every mention id, and with it each authority whose key embeds one and each group or list id that
  // is a slice of such an authority. It keeps every other authority, session-node and detached id.
  it.effect("states what the v4 step keeps and rewrites in each receipt", () =>
    Effect.gen(function* () {
      const { document, session, sessionBindings, canonical, canonicalBindings } = yield* readFrozen;
      const documentFates = yield* fatesOf(document);
      expect(documentFates).toEqual({
        authorities: ["kept", "rewritten"],
        groups: ["kept", "rewritten"],
        memberLists: ["kept", "rewritten"],
        detachedCitations: ["kept"],
      });
      // External keys: the missing-page mention is there, but no authority is its case-occurrence key.
      const sessionFates = yield* fatesOf(session);
      expect(sessionFates).toEqual({
        authorities: ["kept", "kept"],
        groups: ["kept", "kept"],
        memberLists: ["kept", "kept"],
        detachedCitations: ["kept"],
      });
      // Canonical keys under session nodes: the authority is rewritten, its group and list ids are kept.
      const canonicalFates = yield* fatesOf(canonical);
      expect(canonicalFates).toEqual({
        authorities: ["kept", "rewritten"],
        groups: ["kept", "kept"],
        memberLists: ["kept", "kept"],
        detachedCitations: [],
      });

      // References that follow a rewritten authority: the document's and the canonical session's keys are the same two.
      const keys = A.map(document.authorities, (authority) => authority.id);
      expect(A.map(canonical.authorities, (authority) => authority.id)).toEqual(keys);
      expect(A.map(document.groups, (group) => group.authorityId)).toEqual(keys);
      expect(A.map(canonical.groups, (group) => group.authorityId)).toEqual(keys);
      expect(candidatesOf(document)).toEqual([keys]);
      expect(candidatesOf(canonical)).toEqual([keys]);
      expect(candidatesOf(session)).toEqual([]);

      // References that follow a rewritten mention: decisions, warnings, representatives, members and the out-of-band
      // bindings.
      const ids = A.map(document.mentions, (mention) => mention.id);
      const at = (index: number) => A.getUnsafe(ids, index);
      const mentionAt = (index: number) => CitationGroupMember.cases.Mention.make({ mentionId: at(index) });
      expect(A.map(document.resolutions, (resolution) => resolution.mentionId)).toEqual(ids);
      expect(A.map(canonical.resolutions, (resolution) => resolution.mentionId)).toEqual([at(0), at(1), at(2), at(5)]);
      expect(A.flatMap(document.mentions, (mention) => mention.warnings)).toEqual([
        CitationOverlapWarning.make({ previousMentionId: at(2) }),
      ]);
      expect(representativesOf(document)).toEqual([mentionAt(0), mentionAt(1)]);
      expect(representativesOf(session)).toEqual([]);
      expect(representativesOf(canonical)).toEqual([]);
      expect(A.map(document.memberLists, (list) => list.members)).toEqual([
        [mentionAt(0), mentionAt(3), mentionAt(4)],
        [mentionAt(1), mentionAt(2)],
      ]);
      expect(A.flatMap(session.memberLists, (list) => list.members)).toEqual([
        CitationGroupMember.cases.Detached.make({
          detachedId: A.getUnsafe(session.detachedCitations, 0).id,
        }),
        mentionAt(0),
        mentionAt(1),
        mentionAt(2),
      ]);
      expect(A.map(canonical.memberLists, (list) => list.members)).toEqual([
        [mentionAt(0)],
        [mentionAt(1), mentionAt(2)],
      ]);
      expect(session.detachedCitations).toEqual(document.detachedCitations);
      expect(A.map(sessionBindings, (binding) => binding.identity._tag)).toEqual(["External", "External"]);
      expect(A.map(canonicalBindings, (binding) => binding.identity._tag)).toEqual(["Canonical", "Canonical"]);
      expect(A.map(canonicalBindings, (binding) => binding.decisions)).toEqual([[at(0)], [at(1), at(2)]]);
      expect(A.map(canonicalBindings, (binding) => binding.candidates)).toEqual([
        [{ mentionId: at(5), position: 0 }],
        [{ mentionId: at(5), position: 1 }],
      ]);
    })
  );
});
