import { makeDocumentCodec } from "@beep/annotation/AnnotationDocument";
import { AnnotationId } from "@beep/annotation/AnnotationId";
import { DocumentKinds, Sentence, TextDocument } from "@beep/annotation/Kinds";
import { ClaimCoreInvalid, ClaimPreimage } from "@beep/epistemics/ClaimCore";
import { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import { AppendResult } from "@beep/epistemics/ClaimLog.schema";
import { ActivityId } from "@beep/schema/ContentHash";
import { it } from "@beep/test-runner";
import { Anchored, mintOccurrenceId } from "@beep/text/Occurrence";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import {
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import golden from "./fixtures/claim-core-v1.json" with { type: "json" };
import { activity, arrows, Claims, Core, coreAt } from "./support/Claims.ts";
import type { ClaimLogEntry } from "@beep/epistemics/ClaimLog";

const id = (hex: string) => ClaimId.make(`sha256:${Str.repeat(64)(hex)}`);
const otherActivity = ActivityId.make(id("e"));
const sourceDigest = SourceTextDigest.make("sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca");
const source = SourceTextIdentity.make({
  scopeRef: "fixture",
  sourceRef: "source",
  locator: SourceTextLocator.make("fixture.txt"),
  sourceDigest,
  textDigest: sourceDigest,
  extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
  normalizationVersion: "1",
});
const CoreJson = S.toCodecJson(Core);
const RecordJson = S.toCodecJson(Claims.ClaimRecord);
const codec = makeDocumentCodec({ schema: TextDocument, kinds: DocumentKinds });
const reason = <A, E>(result: Result.Result<A, E>) =>
  Result.isFailure(result) && S.is(ClaimCoreInvalid)(result.failure) ? result.failure.reason : "success";
const outcome = <A, E, R>(effect: Effect.Effect<A, E, R>) => effect.pipe(Effect.result, Effect.map(reason));

it.layer(Digest.layerWebCrypto, { timeout: "30 seconds" })("immutable claim identity", (it) => {
  it.effect("L4-3 verifies the declared golden and an independent SHA-256 over canonical bytes", () =>
    Effect.gen(function* () {
      yield* ClaimPreimage.verifyGolden();
      const crypto = yield* Digest.Digest;
      const bytes = yield* crypto.digest(Digest.sha256, new TextEncoder().encode(golden.canonical));
      expect(`sha256:${Hex.encode(bytes)}`).toBe(golden.hash);
      expect(ClaimPreimage.golden.hash).toBe(golden.hash);
    })
  );
  it.effect("L4-3 checked codecs normalize parent sets, preserve omitted keys and bind every creation field", () =>
    Effect.gen(function* () {
      const core = coreAt({ at: 10 });
      const claim = yield* arrows.mint(core);
      const record = Claims.ClaimRecord.make({ claim, core });
      const encoded = yield* arrows.encodeClaimRecord(record);
      expect(encoded).not.toHaveProperty("core.supersedes");
      const decoded = yield* arrows.decodeClaimRecord(encoded);
      expect(S.toEquivalence(Claims.ClaimRecord)(decoded, record)).toBe(true);
      const withParents = Core.make({ ...core, derivedFrom: HashSet.make(id("b"), id("c")) });
      const parentId = yield* arrows.mint(withParents);
      const wire = yield* S.encodeEffect(Core)(withParents);
      const repeated = yield* S.decodeEffect(CoreJson)({
        ...wire,
        derivedFrom: [id("c"), id("b"), id("c")],
      });
      const repeatedId = yield* arrows.mint(repeated);
      expect(repeatedId).toBe(parentId);
      expect(parentId).not.toBe(claim);
      const changed = yield* Effect.forEach(
        [
          Core.make({ ...core, scope: "other" }),
          Core.make({ ...core, proposition: { subject: 1, text: "changed" } }),
          Core.make({ ...core, supersedes: O.some(id("d")) }),
        ],
        arrows.mint,
        { concurrency: 1 }
      );
      expect(A.every(changed, (id) => id !== claim)).toBe(true);
    })
  );
  it.effect("L4-3 identity and native generation refusals append nothing", () =>
    Effect.gen(function* () {
      const core = coreAt({ at: 10 });
      const claim = yield* arrows.mint(core);
      const record = Claims.ClaimRecord.make({ claim: id("f"), core });
      const wire = yield* S.encodeEffect(RecordJson)(record);
      const valid = Claims.ClaimRecord.make({ claim, core });
      const reasons = yield* Effect.all(
        [
          outcome(arrows.mint({ ...core, logicalKey: "wrong" })),
          outcome(arrows.decodeClaimRecord({})),
          outcome(arrows.decodeClaimRecord(wire)),
          outcome(arrows.encodeClaimRecord(record)),
          outcome(arrows.appendClaim([], valid, { activity: otherActivity, at: DateTime.makeUnsafe(0) })),
        ],
        { concurrency: 1 }
      );
      expect(reasons).toEqual([
        "invalid-core",
        "invalid-record",
        "key-mismatch",
        "key-mismatch",
        "generation-mismatch",
      ]);
      const refused = yield* arrows.appendClaim([], record, { activity, at: DateTime.makeUnsafe(0) });
      expect(AppendResult.guards.Refused(refused)).toBe(true);
    })
  );
  it.effect.prop(
    "L4-3 minted derivations are acyclic and separate challenges may cycle",
    [S.Int.check(S.isBetween({ minimum: 2, maximum: 12 }))],
    ([size]) =>
      Effect.gen(function* () {
        let parents = HashSet.empty<ClaimId>();
        let log: ReadonlyArray<ClaimLogEntry> = [];
        const records: Array<typeof Claims.ClaimRecord.Type> = [];
        const claims: Array<ClaimId> = [];
        for (const n of A.range(1, size)) {
          const core = coreAt({ at: n, subject: n, scope: "fixture", parents });
          const claim = yield* arrows.mint(core);
          const record = Claims.ClaimRecord.make({ claim, core });
          const appended = yield* arrows.appendClaim(log, record, { activity, at: DateTime.makeUnsafe(0) });
          expect(appended._tag).toBe("Appended");
          log = appended.log;
          records.push(record);
          claims.push(claim);
          parents = HashSet.make(claim);
        }
        const graph = Graph.directed<ClaimId, string>((graph) => {
          const nodes = HashMap.fromIterable(
            A.map(records, (record): readonly [ClaimId, Graph.NodeIndex] => [
              record.claim,
              Graph.addNode(graph, record.claim),
            ])
          );
          A.forEach(records, (record) =>
            A.forEach(A.fromIterable(record.core.derivedFrom), (parent) =>
              Graph.addEdge(
                graph,
                O.getOrThrow(HashMap.get(nodes, parent)),
                O.getOrThrow(HashMap.get(nodes, record.claim)),
                "derived"
              )
            )
          );
        });
        expect(Graph.isAcyclic(graph)).toBe(true);
        const left = O.getOrThrow(A.head(claims));
        const right = O.getOrThrow(A.last(claims));
        expect(
          Claims.Challenge.cases.ByActivity.make({ from: left, to: right, kind: "rebut", generatedBy: activity }).from
        ).toBe(left);
        expect(
          Claims.Challenge.cases.ByPerson.make({
            from: right,
            to: left,
            kind: "undercut",
            actor: "fixture",
            at: DateTime.makeUnsafe(0),
          }).from
        ).toBe(right);
      })
  );
  it.effect("L4-3 production appends refuse missing and later derivation parents", () =>
    Effect.gen(function* () {
      const parentCore = coreAt({ at: 20, subject: 1 });
      const parentId = yield* arrows.mint(parentCore);
      const parent = Claims.ClaimRecord.make({ claim: parentId, core: parentCore });
      const childCore = coreAt({ at: 10, subject: 2, parents: HashSet.make(parent.claim) });
      const childId = yield* arrows.mint(childCore);
      const child = Claims.ClaimRecord.make({ claim: childId, core: childCore });
      const missing = yield* arrows.appendClaim([], child, { activity, at: DateTime.makeUnsafe(0) });
      expect(missing._tag).toBe("Refused");
      if (AppendResult.guards.Refused(missing))
        expect(A.map(missing.violations, (v) => v._tag)).toContain("ParentMissing");
      const prefix = yield* arrows.appendClaim([], parent, { activity, at: DateTime.makeUnsafe(0) });
      const later = yield* arrows.appendClaim(prefix.log, child, { activity, at: DateTime.makeUnsafe(0) });
      expect(later._tag).toBe("Refused");
      expect(later.log).toBe(prefix.log);
      if (AppendResult.guards.Refused(later))
        expect(A.map(later.violations, (v) => v._tag)).toContain("ParentStartsLater");
    })
  );
  it.effect(
    "L4-3 promotion checks a document and runtime proofs while allowing unknown annotation generation time",
    () =>
      Effect.gen(function* () {
        const proof = yield* verifyTextAnchor(
          VerifyTextAnchorInput.make({
            expectedSource: source,
            source,
            sourceText: "fact",
            anchor: TextAnchor.make({ startChar: 0, endChar: 4, quote: "fact" }),
          })
        );
        const anchored = Anchored.make({ receipt: toTextAnchorVerificationReceipt(proof) });
        const occurrence = yield* mintOccurrenceId(anchored);
        const document = yield* codec.assemble({
          text: source,
          generation: { activity, at: O.none() },
          anchors: [anchored],
          annotations: [
            DocumentKinds.Sentence.case.make({ targets: HashSet.make(occurrence), body: Sentence.make({}) }),
          ],
        });
        const candidates = document.annotations.pipe(HashMap.keys, HashSet.fromIterable);
        const core = Core.make({ ...coreAt({ at: 10 }), supportAtCreation: HashSet.make(occurrence) });
        const options = {
          core,
          document,
          candidates,
          verified: [proof],
          generation: { activity, at: DateTime.makeUnsafe(0) },
        };
        const proposed = yield* arrows.promote(options);
        expect(proposed.stance).toBe("proposed");
        const falseReceipt = Anchored.make({
          receipt: { ...anchored.receipt, anchor: TextAnchor.make({ ...anchored.receipt.anchor, quote: "fake" }) },
        });
        const reasons = yield* Effect.all(
          [
            outcome(arrows.promote({ ...options, generation: { activity, at: DateTime.makeUnsafe(11) } })),
            outcome(
              arrows.promote({ ...options, generation: { activity: otherActivity, at: DateTime.makeUnsafe(0) } })
            ),
            outcome(arrows.promote({ ...options, candidates: HashSet.make(AnnotationId.make(id("f"))) })),
            outcome(arrows.promote({ ...options, verified: [] })),
            outcome(arrows.promote({ ...options, candidates: HashSet.empty() })),
            outcome(arrows.promote({ ...options, document: { ...document, anchors: HashMap.empty() } })),
            outcome(
              arrows.promote({
                ...options,
                document: { ...document, anchors: HashMap.make([occurrence, falseReceipt]) },
              })
            ),
            outcome(
              arrows.promote({
                ...options,
                document: { ...document, text: SourceTextIdentity.make({ ...source, sourceRef: "other" }) },
              })
            ),
          ],
          { concurrency: 1 }
        );
        expect(reasons).toEqual([
          "generation-mismatch",
          "generation-mismatch",
          ...A.makeBy(6, () => "invalid-creation-support"),
        ]);
        const unsupported = yield* arrows.promote({
          ...options,
          core: coreAt({ at: 10 }),
          candidates: HashSet.empty(),
          verified: [],
        });
        expect(HashSet.isEmpty(unsupported.core.supportAtCreation)).toBe(true);
      })
  );
});
