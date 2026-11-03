import {
  Citation,
  CitationAuthority,
  CitationAuthorityId,
  CitationComponentAnchor,
  CitationDocument,
  CitationDocumentReceipt,
  CitationFootnoteZone,
  CitationGroupMember,
  CitationMemberList,
  CitationMemberListId,
  CitationMention,
  CitationMentionId,
  CitationResolved,
  CitationResourceGroup,
  CitationResourceGroupId,
} from "@beep/law-practice-domain/values";
import {
  CitationAuthorityIdentityInput,
  makeCitationAuthorityId,
} from "@beep/law-practice-server/internal/Citation/AuthorityIdentity";
import {
  projectCitationDocumentReceipt,
  restoreCitationDocument,
} from "@beep/law-practice-server/internal/Citation/Document";
import {
  makeCitationMention,
  restoreCitationMentionAgainstVerifiedSource,
} from "@beep/law-practice-server/internal/Citation/Mention";
import {
  CitationResourceBinding,
  CitationResourceIdentity,
  makeCitationResourceAuthorityId,
} from "@beep/law-practice-server/internal/Citation/ResourceIdentity";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  VerifySourceTextIdentityInput,
  VerifyTextAnchorInput,
  verifySourceTextIdentity,
  verifyTextAnchor,
} from "@beep/provenance/VerifiedTextAnchor";
import { PosixPath, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import cases from "../../use-cases/test/fixtures/eyecite/authority-identity-cases.json" with { type: "json" };
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";

const member = (mentionId: CitationMentionId) => CitationGroupMember.cases.Mention.make({ mentionId });
const membership = (authorityId: CitationAuthorityId, ids: ReadonlyArray<CitationMentionId>) => {
  const id = CitationMemberListId.make(`cl1:${Str.slice(4)(authorityId)}`);
  return {
    groups: [
      CitationResourceGroup.make({
        id: CitationResourceGroupId.make(`cg1:${Str.slice(4)(authorityId)}`),
        authorityId,
        memberListId: id,
      }),
    ],
    memberLists: [CitationMemberList.make({ id, members: A.map(ids, member) })],
    detachedCitations: [],
  };
};
const expectedGroup = (list: CitationMemberList) => ({
  position: 0,
  id: CitationResourceGroupId.make(`cg1:${Str.slice(4)(list.id)}`),
  list,
});
const bindingFor = (
  identity: CitationResourceIdentity,
  authorityId: CitationAuthorityId,
  decisions: ReadonlyArray<CitationMentionId>
) =>
  CitationResourceBinding.make({
    identity,
    decisions,
    groups: [expectedGroup(A.getUnsafe(membership(authorityId, decisions).memberLists, 0))],
  });
const text = "😀 1 U.S. 1; 1 U.S. 1; Id.";
const artifact = Sha256Hex.make(Str.repeat(64)("a"));
const staleAuthority = CitationAuthorityId.make(`ca1:${Str.repeat(64)("f")}`);
const staleMention = CitationMentionId.make(`cm1:${Str.repeat(64)("f")}`);
const Json = S.fromJsonString(CitationDocumentReceipt);
const externalIdentity = () =>
  CitationResourceIdentity.cases.External.make({
    scope: artifact,
    key: Sha256Hex.make(Str.repeat(64)("b")),
  });
const fixture = Effect.gen(function* () {
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text));
  const digest = SourceTextDigest.make(`sha256:${hash}`);
  const source = SourceTextIdentity.make({
    scopeRef: "matter:fixture",
    sourceRef: "source:fixture",
    locator: PosixPath.make("source.txt"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });
  const model = yield* S.decodeUnknownEffect(CitationAuthorityIdentityInput)(A.getUnsafe(cases.cases, 0).input);
  const idCitation = yield* S.decodeEffect(Citation)({
    type: "id",
    components: {},
    metadata: { pinCite: null, parenthetical: null },
  });
  const zone = yield* verifyTextAnchor(
    VerifyTextAnchorInput.make({
      source,
      expectedSource: source,
      sourceText: text,
      anchor: TextAnchor.make({ startChar: 0, endChar: Str.length(text), quote: text }),
    })
  );
  const mentions = yield* Effect.forEach(
    [
      { start: 3, end: 11, citation: model.citation },
      { start: 13, end: 21, citation: model.citation },
      { start: 23, end: 26, citation: idCitation },
    ],
    (row) =>
      Effect.gen(function* () {
        const anchor = yield* verifyTextAnchor(
          VerifyTextAnchorInput.make({
            source,
            expectedSource: source,
            sourceText: text,
            anchor: TextAnchor.make({
              startChar: row.start,
              endChar: row.end,
              quote: Str.slice(row.start, row.end)(text),
            }),
          })
        );
        return yield* makeCitationMention({
          citation: row.citation,
          anchor,
          engineArtifact: artifact,
          components: row.start === 3 ? [CitationComponentAnchor.make({ name: "fullSpan", anchor: zone })] : [],
          footnote:
            row.start === 3 ? O.some(CitationFootnoteZone.make({ label: O.some("1"), anchor: zone })) : O.none(),
          signal: O.none(),
          warnings: [],
          evidenceConfidence: O.none(),
        });
      })
  );
  const first = A.getUnsafe(mentions, 0);
  const authorityId = yield* makeCitationAuthorityId({
    citation: first.citation,
    mentionId: first.id,
    selectedEdition: model.selectedEdition,
  });
  const document = CitationDocument.make({
    source,
    engineArtifact: artifact,
    mentions,
    ...membership(
      authorityId,
      A.map(mentions, (mention) => mention.id)
    ),
    authorities: [CitationAuthority.make({ id: authorityId, representative: O.some(member(first.id)) })],
    resolutions: A.map(mentions, (mention) =>
      CitationResolved.make({ mentionId: mention.id, authorityId, confidence: O.none() })
    ),
  });
  const editions = O.isSome(model.selectedEdition) ? [model.selectedEdition.value] : [];
  const receipt = yield* projectCitationDocumentReceipt({ document, editions });
  const restore = { receipt, editions, expectedSource: source, expectedEngineArtifact: artifact, sourceText: text };
  return { document, editions, receipt, restore };
}).pipe(Effect.withSpan("DocumentPersistenceTest.fixture"));

it.layer(BunCrypto.layer)("whole citation document persistence", (it) => {
  it.effect("persists a resource introduced without a full citation using a trusted out-of-band binding", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const mention = A.getUnsafe(data.document.mentions, 2);
      const identity = externalIdentity();
      const authorityId = yield* makeCitationResourceAuthorityId(identity);
      const resourceBindings = [bindingFor(identity, authorityId, [mention.id])];
      const document = CitationDocument.make({
        ...data.document,
        mentions: [mention],
        ...membership(authorityId, [mention.id]),
        authorities: [CitationAuthority.make({ id: authorityId, representative: O.some(member(mention.id)) })],
        resolutions: [CitationResolved.make({ mentionId: mention.id, authorityId, confidence: O.none() })],
      });
      const receipt = yield* projectCitationDocumentReceipt({ document, editions: [], resourceBindings });
      const restored = yield* restoreCitationDocument({ ...data.restore, receipt, editions: [], resourceBindings });
      expect(restored.mentions).toHaveLength(1);
      expect(A.getUnsafe(restored.mentions, 0).citation.type).toBe("id");
      expect(restored.authorities).toEqual(document.authorities);
      expect("resourceBindings" in receipt).toBe(false);
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, receipt, editions: [] }))).reason).toBe(
        "authority-key-unavailable"
      );
      // A receipt cannot authorize itself by carrying an extra binding field.
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({ ...data.restore, receipt: { ...receipt, resourceBindings }, editions: [] })
        )).reason
      ).toBe("authority-key-unavailable");
    })
  );

  it.effect("supports canonical fallback bindings without a full member and snapshots adapter expectations", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const mention = A.getUnsafe(data.document.mentions, 2);
      const authority = yield* S.decodeUnknownEffect(CitationAuthorityIdentityInput)(A.getUnsafe(cases.cases, 0).input);
      const identity = CitationResourceIdentity.cases.Canonical.make({ authority });
      const authorityId = yield* makeCitationResourceAuthorityId(identity);
      const binding = bindingFor(identity, authorityId, [mention.id]);
      const document = CitationDocument.make({
        ...data.document,
        mentions: [mention],
        ...membership(authorityId, [mention.id]),
        authorities: [CitationAuthority.make({ id: authorityId, representative: O.some(member(mention.id)) })],
        resolutions: [CitationResolved.make({ mentionId: mention.id, authorityId, confidence: O.none() })],
      });
      const crypto = yield* Digest.Digest;
      let hashes = 0;
      const receipt = yield* projectCitationDocumentReceipt({
        document,
        editions: [],
        resourceBindings: [binding],
      }).pipe(
        Effect.provideService(
          Digest.Digest,
          makeTestCitationDigest((algorithm, bytes) =>
            Effect.suspend(() => {
              hashes += 1;
              if (hashes === 1) Reflect.set(binding, "decisions", [staleMention]);
              return crypto.digest(algorithm, bytes);
            })
          )
        )
      );
      expect(receipt.authorities).toEqual(document.authorities);
      const originalBinding = bindingFor(identity, authorityId, [mention.id]);
      const restored = yield* restoreCitationDocument({
        ...data.restore,
        receipt,
        editions: [],
        resourceBindings: [originalBinding],
      });
      expect(restored.authorities).toEqual(document.authorities);
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({ ...data.restore, receipt, editions: [], resourceBindings: [binding] })
        )).reason
      ).toBe("stale-authority");
    })
  );

  it.effect("requires exact binding membership when custom resources merge distinct full keys", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const identity = externalIdentity();
      const authorityId = yield* makeCitationResourceAuthorityId(identity);
      const second = A.getUnsafe(data.document.mentions, 1);
      const wire = yield* S.encodeEffect(Citation)(second.citation);
      const citation = yield* S.decodeEffect(Citation)({ ...wire, components: { ...wire.components, volume: "2" } });
      const mentions = A.map(data.document.mentions, (mention) =>
        mention.id === second.id ? CitationMention.make({ ...mention, citation }) : mention
      );
      const first = A.getUnsafe(mentions, 0);
      const last = A.getUnsafe(mentions, 2);
      const document = CitationDocument.make({
        ...data.document,
        mentions,
        ...membership(
          authorityId,
          A.map(mentions, (mention) => mention.id)
        ),
        authorities: [CitationAuthority.make({ id: authorityId, representative: O.some(member(first.id)) })],
        resolutions: A.map(mentions, (mention) =>
          CitationResolved.make({ mentionId: mention.id, authorityId, confidence: O.none() })
        ),
      });
      const binding = bindingFor(identity, authorityId, [first.id, second.id, last.id]);
      const receipt = yield* projectCitationDocumentReceipt({ document, editions: [], resourceBindings: [binding] });
      const restored = yield* restoreCitationDocument({
        ...data.restore,
        receipt,
        editions: [],
        resourceBindings: [binding],
      });
      expect(restored.authorities).toEqual(document.authorities);
      const incomplete = bindingFor(identity, authorityId, [first.id]);
      expect(
        (yield* Effect.flip(projectCitationDocumentReceipt({ document, editions: [], resourceBindings: [incomplete] })))
          .reason
      ).toBe("stale-authority");
      const extra = bindingFor(identity, authorityId, [first.id, second.id, last.id, staleMention]);
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({ ...data.restore, receipt, editions: [], resourceBindings: [extra] })
        )).reason
      ).toBe("stale-authority");
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({ ...data.restore, receipt, editions: [], resourceBindings: [binding, binding] })
        )).reason
      ).toBe("invalid-input");
      const changed = CitationResourceBinding.make({
        ...binding,
        identity: CitationResourceIdentity.cases.External.make({ scope: artifact, key: artifact }),
      });
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({ ...data.restore, receipt, editions: [], resourceBindings: [changed] })
        )).reason
      ).toBe("stale-authority");
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({
            ...data.restore,
            receipt,
            editions: [],
            resourceBindings: [binding],
            sourceText: `${text}!`,
          })
        )).reason
      ).toBe("unverifiable-evidence");
    })
  );

  it.effect(
    "restores multiple entries for one bound resource and rejects entry identity, position or coverage changes",
    () =>
      Effect.gen(function* () {
        const data = yield* fixture;
        const identity = externalIdentity();
        const authorityId = yield* makeCitationResourceAuthorityId(identity);
        const ids = A.map(data.document.mentions, (mention) => mention.id);
        const firstList = CitationMemberList.make({
          id: CitationMemberListId.make(`cl1:${Str.repeat(64)("b")}`),
          members: [member(A.getUnsafe(ids, 0))],
        });
        const secondList = CitationMemberList.make({
          id: CitationMemberListId.make(`cl1:${Str.repeat(64)("c")}`),
          members: A.map(A.drop(ids, 1), member),
        });
        const firstEntry = CitationResourceGroup.make({
          id: CitationResourceGroupId.make(`cg1:${Str.repeat(64)("b")}`),
          authorityId,
          memberListId: firstList.id,
        });
        const secondEntry = CitationResourceGroup.make({
          id: CitationResourceGroupId.make(`cg1:${Str.repeat(64)("c")}`),
          authorityId,
          memberListId: secondList.id,
        });
        const document = CitationDocument.make({
          ...data.document,
          authorities: [CitationAuthority.make({ id: authorityId, representative: O.none() })],
          groups: [firstEntry, secondEntry],
          memberLists: [firstList, secondList],
          resolutions: A.map(ids, (mentionId) =>
            CitationResolved.make({ mentionId, authorityId, confidence: O.none() })
          ),
        });
        const binding = CitationResourceBinding.make({
          identity,
          decisions: ids,
          groups: [
            { position: 0, id: firstEntry.id, list: firstList },
            { position: 1, id: secondEntry.id, list: secondList },
          ],
        });
        const receipt = yield* projectCitationDocumentReceipt({ document, editions: [], resourceBindings: [binding] });
        const restored = yield* restoreCitationDocument({
          ...data.restore,
          receipt,
          editions: [],
          resourceBindings: [binding],
        });
        expect(restored.groups).toEqual([firstEntry, secondEntry]);
        expect(restored.memberLists).toEqual([firstList, secondList]);
        const changes = [
          CitationResourceBinding.make({ ...binding, groups: A.take(binding.groups, 1) }),
          CitationResourceBinding.make({
            ...binding,
            groups: A.map(binding.groups, (group) => ({ ...group, position: 1 - group.position })),
          }),
          CitationResourceBinding.make({
            ...binding,
            groups: A.map(binding.groups, (group) => ({ ...group, id: firstEntry.id })),
          }),
        ];
        for (const wrong of changes)
          expect(
            (yield* Effect.flip(
              restoreCitationDocument({ ...data.restore, receipt, editions: [], resourceBindings: [wrong] })
            )).reason
          ).toBe("stale-authority");
        const reversed = CitationDocumentReceipt.make({ ...receipt, groups: A.reverse(receipt.groups) });
        expect(
          (yield* Effect.flip(
            restoreCitationDocument({ ...data.restore, receipt: reversed, editions: [], resourceBindings: [binding] })
          )).reason
        ).toBe("stale-authority");
      })
  );

  it.effect(
    "binds exact list order, multiplicity, identity and empty-versus-absent presence separately from decisions",
    () =>
      Effect.gen(function* () {
        const data = yield* fixture;
        const identity = externalIdentity();
        const authorityId = yield* makeCitationResourceAuthorityId(identity);
        const ids = A.map(data.document.mentions, (mention) => mention.id);
        const base = membership(authorityId, ids);
        const list = A.getUnsafe(base.memberLists, 0);
        const ordered = CitationMemberList.make({
          ...list,
          members: [member(A.getUnsafe(ids, 2)), member(A.getUnsafe(ids, 0)), member(A.getUnsafe(ids, 0))],
        });
        const document = CitationDocument.make({
          ...data.document,
          ...base,
          memberLists: [ordered],
          authorities: [CitationAuthority.make({ id: authorityId, representative: O.none() })],
          resolutions: A.map(ids, (mentionId) =>
            CitationResolved.make({ mentionId, authorityId, confidence: O.none() })
          ),
        });
        const binding = CitationResourceBinding.make({ identity, decisions: ids, groups: [expectedGroup(ordered)] });
        const receipt = yield* projectCitationDocumentReceipt({ document, editions: [], resourceBindings: [binding] });
        expect(
          (yield* restoreCitationDocument({ ...data.restore, receipt, editions: [], resourceBindings: [binding] }))
            .memberLists
        ).toEqual([ordered]);
        const wrongOrder = CitationResourceBinding.make({
          ...binding,
          groups: [expectedGroup(CitationMemberList.make({ ...ordered, members: A.reverse(ordered.members) }))],
        });
        expect(
          (yield* Effect.flip(
            restoreCitationDocument({ ...data.restore, receipt, editions: [], resourceBindings: [wrongOrder] })
          )).reason
        ).toBe("stale-authority");
        const wrongId = CitationResourceBinding.make({
          ...binding,
          groups: [
            expectedGroup(
              CitationMemberList.make({ ...ordered, id: CitationMemberListId.make(`cl1:${Str.repeat(64)("e")}`) })
            ),
          ],
        });
        expect(
          (yield* Effect.flip(
            restoreCitationDocument({ ...data.restore, receipt, editions: [], resourceBindings: [wrongId] })
          )).reason
        ).toBe("stale-authority");
        const emptyList = CitationMemberList.make({ ...list, members: [] });
        const empty = CitationDocument.make({ ...document, memberLists: [emptyList] });
        const emptyBinding = CitationResourceBinding.make({ ...binding, groups: [expectedGroup(emptyList)] });
        const emptyReceipt = yield* projectCitationDocumentReceipt({
          document: empty,
          editions: [],
          resourceBindings: [emptyBinding],
        });
        const absentBinding = CitationResourceBinding.make({ ...binding, groups: [] });
        expect(
          (yield* Effect.flip(
            restoreCitationDocument({
              ...data.restore,
              receipt: emptyReceipt,
              editions: [],
              resourceBindings: [absentBinding],
            })
          )).reason
        ).toBe("stale-authority");
        const absent = CitationDocument.make({ ...document, groups: [], memberLists: [] });
        expect(
          (yield* projectCitationDocumentReceipt({ document: absent, editions: [], resourceBindings: [absentBinding] }))
            .groups
        ).toEqual([]);
        // Canonical identity checks alone cannot authorize a changed final list.
        const defaultChanged = CitationDocument.make({
          ...data.document,
          memberLists: A.map(data.document.memberLists, (list) =>
            CitationMemberList.make({ ...list, members: A.reverse(list.members) })
          ),
        });
        expect(
          (yield* Effect.flip(projectCitationDocumentReceipt({ document: defaultChanged, editions: data.editions })))
            .reason
        ).toBe("stale-authority");
      })
  );

  it.effect("checks a full-member identity witness independently of the representative kind", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const mention = A.getUnsafe(data.document.mentions, 2);
      const authorities = A.map(data.document.authorities, (authority) =>
        CitationAuthority.make({ ...authority, representative: O.some(member(mention.id)) })
      );
      const document = CitationDocument.make({ ...data.document, authorities });
      const receipt = yield* projectCitationDocumentReceipt({ document, editions: data.editions });
      const restored = yield* restoreCitationDocument({ ...data.restore, receipt });
      assertSome(A.getUnsafe(restored.authorities, 0).representative, member(mention.id));
      expect(A.getUnsafe(restored.authorities, 0).id).toBe(A.getUnsafe(data.document.authorities, 0).id);
    })
  );

  it.effect("rejects non-full resource identity until a trusted custom key adapter is available", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const mention = A.getUnsafe(data.document.mentions, 2);
      const authority = CitationAuthority.make({ id: staleAuthority, representative: O.some(member(mention.id)) });
      const resolution = CitationResolved.make({
        mentionId: mention.id,
        authorityId: staleAuthority,
        confidence: O.none(),
      });
      const document = CitationDocument.make({
        ...data.document,
        mentions: [mention],
        ...membership(staleAuthority, [mention.id]),
        authorities: [authority],
        resolutions: [resolution],
      });
      const receipt = CitationDocumentReceipt.make({
        ...data.receipt,
        mentions: [A.getUnsafe(data.receipt.mentions, 2)],
        ...membership(staleAuthority, [mention.id]),
        authorities: [authority],
        resolutions: [resolution],
      });
      expect((yield* Effect.flip(projectCitationDocumentReceipt({ document, editions: data.editions }))).reason).toBe(
        "authority-key-unavailable"
      );
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, receipt }))).reason).toBe(
        "authority-key-unavailable"
      );
    })
  );

  it.effect("round-trips the whole graph with fresh anchor proofs and stable IDs", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const wire = yield* S.encodeEffect(Json)(data.receipt);
      const receipt = yield* S.decodeEffect(Json)(wire);
      const restored = yield* restoreCitationDocument({ ...data.restore, receipt });
      expect(A.map(restored.mentions, (mention) => mention.id)).toEqual(
        A.map(data.document.mentions, (mention) => mention.id)
      );
      expect(A.getUnsafe(restored.mentions, 0).anchor).not.toBe(A.getUnsafe(data.document.mentions, 0).anchor);
      expect(
        yield* S.encodeEffect(Json)(
          yield* projectCitationDocumentReceipt({ document: restored, editions: data.editions })
        )
      ).toBe(wire);
      expect(
        (yield* Effect.flip(projectCitationDocumentReceipt({ document: receipt, editions: data.editions }))).reason
      ).toBe("invalid-input");
    })
  );

  it.effect("hashes the raw source once across the whole document and snapshots receipt data", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const crypto = yield* Digest.Digest;
      let hashes = 0;
      const captured = yield* S.encodeEffect(Json)(data.receipt);
      const restored = yield* restoreCitationDocument(data.restore).pipe(
        Effect.provideService(
          Digest.Digest,
          makeTestCitationDigest((algorithm, bytes) =>
            Effect.suspend(() => {
              hashes += 1;
              if (hashes === 1) Reflect.set(A.getUnsafe(data.receipt.resolutions, 0), "authorityId", staleAuthority);
              return crypto.digest(algorithm, bytes);
            })
          )
        )
      );
      expect(hashes).toBe(6); // One source, three mentions, two resolved full keys.
      expect(
        yield* S.encodeEffect(Json)(
          yield* projectCitationDocumentReceipt({ document: restored, editions: data.editions })
        )
      ).toBe(captured);
    })
  );

  it.effect("snapshots runtime graph data before projection starts hashing", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const expected = yield* S.encodeEffect(Json)(data.receipt);
      const crypto = yield* Digest.Digest;
      let hashes = 0;
      const receipt = yield* projectCitationDocumentReceipt({ document: data.document, editions: data.editions }).pipe(
        Effect.provideService(
          Digest.Digest,
          makeTestCitationDigest((algorithm, bytes) =>
            Effect.suspend(() => {
              hashes += 1;
              if (hashes === 1) Reflect.set(A.getUnsafe(data.document.resolutions, 0), "authorityId", staleAuthority);
              return crypto.digest(algorithm, bytes);
            })
          )
        )
      );
      expect(yield* S.encodeEffect(Json)(receipt)).toBe(expected);
    })
  );

  it.effect("rejects coherent graph rewrites with stale occurrence or authority tokens", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const last = A.getUnsafe(data.receipt.mentions, 2);
      const stale = CitationDocumentReceipt.make({
        ...data.receipt,
        memberLists: A.map(data.receipt.memberLists, (list) =>
          CitationMemberList.make({
            ...list,
            members: A.map(list.members, (reference) =>
              reference._tag === "Mention" && reference.mentionId === last.id ? member(staleMention) : reference
            ),
          })
        ),
        mentions: A.map(data.receipt.mentions, (mention) =>
          mention.id === last.id ? { ...mention, id: staleMention } : mention
        ),
        resolutions: A.map(data.receipt.resolutions, (resolution) =>
          resolution.mentionId === last.id ? { ...resolution, mentionId: staleMention } : resolution
        ),
      });
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, receipt: stale }))).reason).toBe(
        "stale-mention"
      );
      const rewritten = CitationDocumentReceipt.make({
        ...data.receipt,
        ...membership(
          staleAuthority,
          A.map(data.receipt.mentions, (mention) => mention.id)
        ),
        authorities: A.map(data.receipt.authorities, (authority) => ({ ...authority, id: staleAuthority })),
        resolutions: A.map(data.receipt.resolutions, (resolution) => ({ ...resolution, authorityId: staleAuthority })),
      });
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, receipt: rewritten }))).reason).toBe(
        "stale-authority"
      );
    })
  );

  it.effect("checks every resolved full citation, including non-representative members", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const second = A.getUnsafe(data.document.mentions, 1);
      const wire = yield* S.encodeEffect(Citation)(second.citation);
      const changed = yield* S.decodeEffect(Citation)({ ...wire, components: { ...wire.components, volume: "2" } });
      const document = CitationDocument.make({
        ...data.document,
        mentions: A.map(data.document.mentions, (mention) =>
          mention.id === second.id ? CitationMention.make({ ...mention, citation: changed }) : mention
        ),
      });
      expect((yield* Effect.flip(projectCitationDocumentReceipt({ document, editions: data.editions }))).reason).toBe(
        "stale-authority"
      );
    })
  );

  it.effect("rejects raw quote/engine drift and missing or duplicate edition descriptors", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, sourceText: `${text}!` }))).reason).toBe(
        "unverifiable-evidence"
      );
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({ ...data.restore, expectedEngineArtifact: Sha256Hex.make(Str.repeat(64)("b")) })
        )).reason
      ).toBe("stale-engine");
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, editions: [] }))).reason).toBe(
        "identity-failed"
      );
      expect(
        (yield* Effect.flip(
          restoreCitationDocument({ ...data.restore, editions: A.appendAll(data.editions, data.editions) })
        )).reason
      ).toBe("invalid-input");
    })
  );

  it.effect("rejects tampered raw anchor quotes even when document references remain coherent", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const first = A.getUnsafe(data.receipt.mentions, 0);
      const anchor = TextAnchorVerificationReceipt.make({
        source: first.anchor.source,
        anchor: TextAnchor.make({ ...first.anchor.anchor, quote: "2 U.S. 2" }),
      });
      const receipt = CitationDocumentReceipt.make({
        ...data.receipt,
        mentions: A.map(data.receipt.mentions, (mention) =>
          mention.id === first.id ? { ...mention, anchor } : mention
        ),
      });
      expect((yield* Effect.flip(restoreCitationDocument({ ...data.restore, receipt }))).reason).toBe(
        "unverifiable-evidence"
      );
    })
  );

  it.effect("rejects a genuine source capability for a different source identity", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const source = SourceTextIdentity.make({ ...data.document.source, scopeRef: "matter:other" });
      const proof = yield* verifySourceTextIdentity(
        VerifySourceTextIdentityInput.make({ source, expectedSource: source, sourceText: text })
      );
      const receipt = A.getUnsafe(data.receipt.mentions, 0);
      expect((yield* Effect.flip(restoreCitationMentionAgainstVerifiedSource(proof, artifact)(receipt))).reason).toBe(
        "unverifiable-evidence"
      );
    })
  );

  it.effect("restores empty documents with source verification and enforces the UTF-16 source ceiling", () =>
    Effect.gen(function* () {
      const data = yield* fixture;
      const receipt = CitationDocumentReceipt.make({
        ...data.receipt,
        mentions: [],
        authorities: [],
        resolutions: [],
        groups: [],
        memberLists: [],
        detachedCitations: [],
      });
      expect((yield* restoreCitationDocument({ ...data.restore, receipt, editions: [] })).mentions).toEqual([]);
      expect(
        (yield* Effect.flip(restoreCitationDocument({ ...data.restore, sourceText: Str.repeat(500_001)("😀") }))).reason
      ).toBe("invalid-input");
    })
  );
});
