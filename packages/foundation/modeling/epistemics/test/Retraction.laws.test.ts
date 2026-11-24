import { AdmissionRefused, ClaimViewResult, SourceResolution, TrustedClaimBinding } from "@beep/epistemics/Admission";
import { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import { ClaimLogEntry, orphanedDerivations } from "@beep/epistemics/ClaimLog";
import { it } from "@beep/test-runner";
import { TextAnchor } from "@beep/text/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import { assertEquals, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixture, flow, logOf, portsFor, requestFor, tokenFor } from "./support/Admissions.ts";
import { activity, arrows, Claims, Core, coreAt } from "./support/Claims.ts";
import type { AdmissionPorts } from "@beep/epistemics/Admission";

const a = ClaimId.make(`sha256:${Str.repeat(64)("a")}`);
const b = ClaimId.make(`sha256:${Str.repeat(64)("b")}`);
const c = ClaimId.make(`sha256:${Str.repeat(64)("c")}`);
const d = ClaimId.make(`sha256:${Str.repeat(64)("d")}`);
const e = ClaimId.make(`sha256:${Str.repeat(64)("e")}`);
const f = ClaimId.make(`sha256:${Str.repeat(64)("f")}`);
const graph = HashMap.make(
  [a, HashSet.empty<ClaimId>()],
  [b, HashSet.make(a)],
  [c, HashSet.make(a)],
  [d, HashSet.make(b, c)],
  [e, HashSet.make(a, f)],
  [f, HashSet.empty<ClaimId>()]
);
const topological = [a, f, b, c, d, e];

it("L4-4 roots and partly supported claims survive while whole dead chains and diamonds flag transitively", () => {
  assertEquals(orphanedDerivations(graph, HashSet.empty()), HashSet.empty());
  assertEquals(orphanedDerivations(graph, HashSet.make(a)), HashSet.make(b, c, d));
  assertEquals(orphanedDerivations(HashSet.make(a, f))(graph), HashSet.make(b, c, d, e));
  assertEquals(orphanedDerivations(graph, HashSet.make(a, d)), HashSet.make(b, c));
  expect(HashSet.has(orphanedDerivations(graph, HashSet.make(a, f)), a)).toBe(false);
});
it.prop(
  "L4-4 coherent DAG retraction subsets equal an independent topological fixed point",
  [S.Array(S.Boolean).check(S.isMinLength(6), S.isMaxLength(6))],
  ([flags]) => {
    const retracted = HashSet.fromIterable(A.filter(topological, (_, i) => O.contains(A.get(flags, i), true)));
    const dead = A.reduce(topological, retracted, (dead, claim) => {
      const parents = O.getOrThrow(HashMap.get(graph, claim));
      return !HashSet.isEmpty(parents) && HashSet.every(parents, (parent) => HashSet.has(dead, parent))
        ? HashSet.add(dead, claim)
        : dead;
    });
    const expected = HashSet.difference(dead, retracted);
    assertEquals(orphanedDerivations(graph, retracted), expected);
    const reordered = graph.pipe(HashMap.toEntries, A.reverse, HashMap.fromIterable);
    assertEquals(orphanedDerivations(reordered, HashSet.fromIterable([...retracted, ...retracted])), expected);
  }
);

const AdmissionJson = S.toCodecJson(Claims.Admission);
const utc = DateTime.makeUnsafe;
const stanceOf = (result: ClaimViewResult) =>
  O.flatMap(O.liftPredicate(ClaimViewResult.guards.Viewed)(result), (viewed) => viewed.stance);
const accepted = (result: typeof flow.AdmissionResult.Type) =>
  O.getOrThrow(O.liftPredicate(flow.AdmissionResult.guards.Admitted)(result)).admission;
const viewRequest = (options: {
  readonly value: Effect.Success<ReturnType<typeof fixture>>;
  readonly claim: ClaimId;
  readonly records: ReadonlyArray<typeof Claims.ClaimRecord.Type>;
  readonly admissions: ReadonlyArray<typeof Claims.Admission.Type>;
  readonly retractions: ReadonlyArray<typeof Claims.Retraction.Type>;
  readonly asOf: number;
  readonly ports: AdmissionPorts<typeof Claims.Admission.Type>;
}) => ({
  claim: options.claim,
  log: logOf(options.records),
  records: HashMap.fromIterable(
    A.map(options.records, (record): readonly [ClaimId, typeof Claims.ClaimRecord.Type] => [record.claim, record])
  ),
  admissions: options.admissions,
  retractions: options.retractions,
  stances: A.empty<typeof Claims.StanceRecord.Type>(),
  validSelection: HashSet.fromIterable(A.map(options.records, (record) => record.claim)),
  asOf: utc(options.asOf),
  ports: options.ports,
});

it.layer(Digest.layerWebCrypto, { timeout: "30 seconds" })("selected-time claim eligibility", (it) => {
  it.effect("L4-4 selected source denial preserves historically verified admitted stance", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const admitted = yield* flow.admit(request).pipe(Effect.map(accepted));
      const encoded = yield* S.encodeEffect(AdmissionJson)(admitted);
      const decoded = yield* S.decodeEffect(AdmissionJson)(encoded);
      const result = yield* flow.viewAt(
        viewRequest({
          value,
          claim: value.a.claim,
          records: [value.a],
          admissions: [decoded],
          retractions: [],
          asOf: 50,
          ports: {
            ...request.ports,
            resolveAt: ({ at }) =>
              DateTime.toEpochMillis(at) === 30
                ? request.ports.resolveAt({ scope: request.scope, receipt: value.receipt, at })
                : Effect.succeed(SourceResolution.cases.Denied.make({})),
          },
        })
      );
      expect(result).toMatchObject({
        _tag: "Viewed",
        eligibility: { _tag: "Ineligible", reasons: ["unverified-admission"] },
      });
      if (ClaimViewResult.guards.Viewed(result)) assertSome(result.stance, "admitted");
    })
  );
  it.effect(
    "L4-4 unavailable selected binding preserves verified history but decoded records need historical proof",
    () =>
      Effect.gen(function* () {
        const value = yield* fixture();
        const request = requestFor(value);
        const admitted = yield* flow.admit(request).pipe(Effect.map(accepted));
        const encoded = yield* S.encodeEffect(AdmissionJson)(admitted);
        const decoded = yield* S.decodeEffect(AdmissionJson)(encoded);
        const base = viewRequest({
          value,
          claim: value.a.claim,
          records: [value.a],
          admissions: [decoded],
          retractions: [],
          asOf: 50,
          ports: {
            ...request.ports,
            resolveBinding: () => Effect.succeed(TrustedClaimBinding.cases.Unavailable.make({ reason: "stale" })),
          },
        });
        const verifiedHistory = yield* flow.viewAt({ ...base, historicalPorts: request.ports });
        expect(verifiedHistory).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Unknown", reason: "authorization-unavailable" },
        });
        if (ClaimViewResult.guards.Viewed(verifiedHistory)) assertSome(verifiedHistory.stance, "admitted");
        const historicalUnavailable = yield* flow.viewAt({
          ...base,
          ports: request.ports,
          historicalPorts: base.ports,
        });
        expect(historicalUnavailable).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Unknown", reason: "authorization-unavailable" },
        });
        const unverifiedHistory = yield* flow.viewAt(base);
        expect(unverifiedHistory).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Unknown", reason: "authorization-unavailable" },
        });
        if (ClaimViewResult.guards.Viewed(unverifiedHistory)) assertNone(unverifiedHistory.stance);
      })
  );
  it.effect(
    "L4-4 direct retraction preserves admitted stance, historical time excludes future events and missing snapshots stay unknown",
    () =>
      Effect.gen(function* () {
        const value = yield* fixture();
        const request = requestFor(value);
        const admitted = yield* flow.admit(request).pipe(Effect.map(accepted));
        const retraction = Claims.Retraction.make({
          claim: value.a.claim,
          actor: "human",
          reason: "withdrawn",
          at: utc(40),
        });
        const base = viewRequest({
          value,
          claim: value.a.claim,
          records: [value.a, value.b],
          admissions: [admitted],
          retractions: [retraction],
          asOf: 50,
          ports: request.ports,
        });
        const after = yield* flow.viewAt(base);
        expect(after).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Ineligible", reasons: ["direct-retraction"] },
          directRetraction: true,
        });
        if (ClaimViewResult.guards.Viewed(after)) assertSome(after.stance, "admitted");
        const before = yield* flow.viewAt({ ...base, asOf: utc(35) });
        expect(before).toMatchObject({ _tag: "Viewed", eligibility: { _tag: "Eligible" }, directRetraction: false });
        let current = 0;
        const snapshots: Array<number> = [];
        const unknown = yield* flow.viewAt({
          ...base,
          asOf: utc(35),
          ports: {
            ...request.ports,
            resolveCurrent: () => {
              current += 1;
              return Effect.succeed(SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" }));
            },
            resolveAt: ({ at }) => {
              snapshots.push(DateTime.toEpochMillis(at));
              return Effect.succeed(SourceResolution.cases.Unavailable.make({}));
            },
          },
        });
        expect(unknown).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Unknown", reason: "snapshot-unavailable" },
        });
        expect(current).toBe(0);
        expect(snapshots).toEqual([30, 35]);
      })
  );
  it.effect(
    "L4-4 stance is unresolved without events, explicit latest events govern, and incompatible ties refuse the view",
    () =>
      Effect.gen(function* () {
        const value = yield* fixture();
        const request = requestFor(value);
        const admitted = yield* flow.admit(request).pipe(Effect.map(accepted));
        const base = viewRequest({
          value,
          claim: value.a.claim,
          records: [value.a],
          admissions: [],
          retractions: [],
          asOf: 50,
          ports: request.ports,
        });
        const unresolved = yield* flow.viewAt(base);
        expect(unresolved).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Ineligible", reasons: ["unresolved-stance"] },
        });
        const proposed = Claims.StanceRecord.cases.Proposed.make({
          claim: value.a.claim,
          generatedBy: activity,
          at: utc(45),
        });
        const verbatim = Claims.StanceRecord.cases.Verbatim.make({
          claim: value.a.claim,
          generatedBy: activity,
          at: utc(20),
        });
        const other = Claims.StanceRecord.cases.Verbatim.make({
          claim: value.b.claim,
          generatedBy: activity,
          at: utc(49),
        });
        const future = Claims.StanceRecord.cases.Verbatim.make({
          claim: value.a.claim,
          generatedBy: activity,
          at: utc(51),
        });
        const latest = yield* flow.viewAt({
          ...base,
          admissions: [admitted],
          stances: [proposed, verbatim, other, future],
        });
        expect(latest).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Ineligible", reasons: ["not-admitted"] },
        });
        assertSome(stanceOf(latest), "proposed");
        const reversed = yield* flow.viewAt({
          ...base,
          admissions: [admitted],
          stances: [future, other, verbatim, proposed],
        });
        expect(reversed).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Ineligible", reasons: ["not-admitted"] },
        });
        assertSome(stanceOf(reversed), "proposed");
        const tied = yield* flow.viewAt({
          ...base,
          admissions: [admitted],
          stances: [Claims.StanceRecord.cases.Proposed.make({ ...proposed, at: admitted.at })],
        });
        expect(tied._tag).toBe("AmbiguousStance");
        const counterfeit = Claims.Admission.make({
          ...admitted,
          token: tokenFor({ action: "approve-a", revision: "1", issued: 20, nonce: "f" }),
        });
        const noAuthority = yield* flow.viewAt({ ...base, admissions: [counterfeit] });
        expect(noAuthority).toMatchObject({ _tag: "Viewed", eligibility: { reasons: ["unresolved-stance"] } });
        const malformed = Claims.Admission.make({
          ...admitted,
          grounding: [
            TextAnchorVerificationReceipt.make({
              ...value.receipt,
              anchor: TextAnchor.make({ startChar: 0, endChar: 1, quote: "\ud800" }),
            }),
          ],
        });
        const noMembership = yield* flow.viewAt({ ...base, admissions: [malformed] });
        expect(noMembership).toMatchObject({ _tag: "Viewed", eligibility: { reasons: ["unresolved-stance"] } });
        const ascending = yield* flow.viewAt({ ...base, stances: [verbatim, proposed] });
        const descending = yield* flow.viewAt({ ...base, stances: [proposed, verbatim] });
        assertSome(stanceOf(ascending), "proposed");
        assertSome(stanceOf(descending), "proposed");
        const stale = yield* flow.viewAt({
          ...base,
          admissions: [admitted],
          historicalPorts: request.ports,
          ports: { ...request.ports, resolveAt: () => Effect.succeed(SourceResolution.cases.Stale.make({})) },
        });
        expect(stale).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Ineligible", reasons: ["unverified-admission"] },
        });
        const ambiguous = yield* flow.viewAt({
          ...base,
          admissions: [admitted],
          ports: { ...request.ports, resolveAt: () => Effect.succeed(SourceResolution.cases.Ambiguous.make({})) },
        });
        expect(ambiguous).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Unknown", reason: "ambiguous-grounding" },
        });
        const forged = Claims.Admission.make({ ...admitted, claim: ClaimId.make(`sha256:${Str.repeat(64)("f")}`) });
        const skipped = yield* flow.viewAt({
          ...base,
          admissions: [forged, Claims.Admission.make({ ...admitted, at: utc(60) })],
        });
        expect(skipped).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Ineligible", reasons: ["unresolved-stance"] },
        });
      })
  );
  it.effect("L4-4 nonselected cores and invalid log, body and retraction inputs never qualify", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const base = viewRequest({
        value,
        claim: value.a.claim,
        records: [value.a],
        admissions: [],
        retractions: [],
        asOf: 35,
        ports: request.ports,
      });
      const absent = yield* flow.viewAt({ ...base, validSelection: HashSet.empty() });
      const future = yield* flow.viewAt({ ...base, asOf: utc(5) });
      expect(absent).toMatchObject({ _tag: "Viewed", eligibility: { reasons: ["not-selected"] } });
      expect(future).toMatchObject({ _tag: "Viewed", eligibility: { reasons: ["not-selected"] } });
      const duplicate = yield* flow.viewAt({ ...base, log: [...base.log, ...base.log] });
      const missing = yield* flow.viewAt({ ...base, records: HashMap.empty() });
      const changedCore = Core.make({ ...value.a.core, proposition: { ...value.a.core.proposition, text: "changed" } });
      const changed = yield* flow.viewAt({
        ...base,
        records: HashMap.make([value.a.claim, Claims.ClaimRecord.make({ ...value.a, core: changedCore })]),
      });
      const projection = yield* flow.viewAt({
        ...base,
        log: A.map(base.log, (entry) => ClaimLogEntry.make({ ...entry, logicalKey: "other" })),
      });
      const invalidRetraction = yield* flow.viewAt({
        ...base,
        retractions: [Claims.Retraction.make({ claim: value.a.claim, actor: "human", reason: "\ud800", at: utc(34) })],
      });
      expect(A.map([duplicate, missing, changed, projection, invalidRetraction], (result) => result._tag)).toEqual(
        A.makeBy(5, () => "InvalidLog")
      );
    })
  );
  it.effect(
    "L4-4 authorized fresh readmission clears only its exact earlier retraction and equal-time or later retractions win",
    () =>
      Effect.gen(function* () {
        const value = yield* fixture();
        const request = requestFor(value);
        const first = yield* flow.admit(request).pipe(Effect.map(accepted));
        const prior = Claims.Retraction.make({
          claim: value.a.claim,
          actor: "human",
          reason: "withdrawn",
          at: utc(40),
        });
        const digest = yield* flow.retractionDigest(prior);
        const token = tokenFor({ action: "readmit-a", revision: "2", issued: 55, nonce: "d" });
        const early = tokenFor({ action: "readmit-a", revision: "3", issued: 30, nonce: "e" });
        const ports = portsFor({
          fixture: value,
          tokens: [value.token, token, early],
          resolution: SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" }),
          bindings: HashMap.make(
            ["approve-a:1", TrustedClaimBinding.cases.Claim.make({ claim: value.a.claim, clearsRetraction: O.none() })],
            [
              "readmit-a:2",
              TrustedClaimBinding.cases.Claim.make({ claim: value.a.claim, clearsRetraction: O.some(digest) }),
            ],
            [
              "readmit-a:3",
              TrustedClaimBinding.cases.Claim.make({ claim: value.a.claim, clearsRetraction: O.some(digest) }),
            ]
          ),
        });
        const readmission = {
          ...request,
          token,
          action: token.action,
          revision: token.revision,
          at: utc(60),
          clears: O.some(prior),
          ports,
        };
        const earlyReadmission = { ...readmission, token: early, action: early.action, revision: early.revision };
        const readmitted = yield* flow.admit(readmission).pipe(Effect.map(accepted));
        const base = viewRequest({
          value,
          claim: value.a.claim,
          records: [value.a],
          admissions: [first, readmitted],
          retractions: [prior],
          asOf: 65,
          ports,
        });
        const live = yield* flow.viewAt(base);
        expect(live).toMatchObject({ _tag: "Viewed", eligibility: { _tag: "Eligible" }, directRetraction: false });
        const later = Claims.Retraction.make({ ...prior, at: utc(70), reason: "again" });
        const blocked = yield* flow.viewAt({ ...base, asOf: utc(75), retractions: [prior, later] });
        expect(blocked).toMatchObject({
          _tag: "Viewed",
          eligibility: { reasons: ["direct-retraction"] },
          directRetraction: true,
        });
        const equal = Claims.Retraction.make({ ...prior, at: utc(60), reason: "simultaneous" });
        const tied = yield* flow.viewAt({ ...base, asOf: utc(60), retractions: [prior, equal] });
        expect(tied).toMatchObject({ _tag: "Viewed", eligibility: { reasons: ["direct-retraction"] } });
        const historical = yield* flow.viewAt({ ...base, asOf: utc(50) });
        expect(historical).toMatchObject({ _tag: "Viewed", eligibility: { reasons: ["direct-retraction"] } });
        const unknownClear = yield* flow.viewAt({
          ...base,
          ports: {
            ...ports,
            resolveAt: ({ at }) =>
              Effect.succeed(
                DateTime.toEpochMillis(at) === 60
                  ? SourceResolution.cases.Unavailable.make({})
                  : SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" })
              ),
          },
        });
        expect(unknownClear).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Unknown", reason: "uncertain-retraction" },
        });
        const staleClear = yield* flow.viewAt({
          ...base,
          ports: {
            ...ports,
            resolveAt: ({ at }) =>
              Effect.succeed(
                DateTime.toEpochMillis(at) === 60
                  ? SourceResolution.cases.Stale.make({})
                  : SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" })
              ),
          },
        });
        expect(staleClear).toMatchObject({ _tag: "Viewed", eligibility: { reasons: ["direct-retraction"] } });
        const wrongRetraction = Claims.Retraction.make({ ...prior, claim: value.b.claim });
        const malformedRetraction = Claims.Retraction.make({ ...prior, reason: "\ud800" });
        const justAfter = yield* flow.admit({ ...earlyReadmission, at: utc(41) });
        expect(justAfter._tag).toBe("Admitted");
        const failures = yield* Effect.all(
          [
            flow.admit({ ...earlyReadmission, at: utc(35) }),
            flow.admit({ ...earlyReadmission, at: utc(40) }),
            flow.admit({ ...readmission, clears: O.some(wrongRetraction) }),
            flow.admit({ ...readmission, clears: O.some(malformedRetraction) }),
          ],
          { concurrency: 1 }
        );
        expect(
          A.map(failures, (result) => (flow.AdmissionResult.guards.Refused(result) ? result.refusal : result._tag))
        ).toStrictEqual(
          A.replicate(
            AdmissionRefused.cases.InvalidBinding.make({ claim: value.a.claim, reason: "clearing-mismatch" }),
            4
          )
        );
        const second = Claims.Retraction.make({ ...prior, at: utc(39), reason: "first withdrawal" });
        const perDigest = yield* flow.viewAt({ ...base, retractions: [second, prior] });
        expect(perDigest).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Ineligible", reasons: ["direct-retraction"] },
          directRetraction: true,
        });
      })
  );
  it.effect(
    "L4-4 wholly orphaned derivations block, partial live support survives, and child admission alone cannot clear an orphan",
    () =>
      Effect.gen(function* () {
        const value = yield* fixture();
        const request = requestFor(value);
        const childCore = Core.make({
          ...coreAt({ at: 20, subject: 3, parents: HashSet.make(value.a.claim) }),
          supportAtCreation: HashSet.make(value.occurrence),
        });
        const childId = yield* arrows.mint(childCore);
        const child = Claims.ClaimRecord.make({ claim: childId, core: childCore });
        const token = tokenFor({ action: "approve-child", revision: "1", issued: 25, nonce: "c" });
        const ports = portsFor({
          fixture: value,
          tokens: [token],
          resolution: SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" }),
          bindings: HashMap.make([
            "approve-child:1",
            TrustedClaimBinding.cases.Claim.make({ claim: child.claim, clearsRetraction: O.none() }),
          ]),
        });
        const admitted = yield* flow
          .admit({ ...request, record: child, token, action: token.action, at: utc(30), ports })
          .pipe(Effect.map(accepted));
        const prior = Claims.Retraction.make({
          claim: value.a.claim,
          actor: "human",
          reason: "withdrawn",
          at: utc(40),
        });
        const base = viewRequest({
          value,
          claim: child.claim,
          records: [value.a, value.b, child],
          admissions: [admitted],
          retractions: [prior],
          asOf: 50,
          ports,
        });
        const orphan = yield* flow.viewAt(base);
        expect(orphan).toMatchObject({ _tag: "Viewed", eligibility: { reasons: ["derived-orphan"] }, orphan: true });
        const laterAdmission = Claims.Admission.make({ ...admitted, at: utc(45) });
        const stillOrphan = yield* flow.viewAt({ ...base, admissions: [admitted, laterAdmission] });
        expect(stillOrphan).toMatchObject({ _tag: "Viewed", eligibility: { reasons: ["derived-orphan"] } });
        const partialCore = Core.make({ ...childCore, derivedFrom: HashSet.make(value.a.claim, value.b.claim) });
        const partialId = yield* arrows.mint(partialCore);
        const partial = Claims.ClaimRecord.make({ claim: partialId, core: partialCore });
        const partialPorts = {
          ...ports,
          resolveBinding: () =>
            Effect.succeed(TrustedClaimBinding.cases.Claim.make({ claim: partial.claim, clearsRetraction: O.none() })),
        };
        const partialAdmission = yield* flow
          .admit({ ...request, record: partial, token, action: token.action, ports: partialPorts })
          .pipe(Effect.map(accepted));
        const live = yield* flow.viewAt(
          viewRequest({
            value,
            claim: partial.claim,
            records: [value.a, value.b, partial],
            admissions: [partialAdmission],
            retractions: [prior],
            asOf: 50,
            ports: partialPorts,
          })
        );
        expect(live).toMatchObject({ _tag: "Viewed", eligibility: { _tag: "Eligible" }, orphan: false });
        const digest = yield* flow.retractionDigest(prior);
        const rootToken = tokenFor({ action: "restore-root", revision: "2", issued: 55, nonce: "d" });
        const restoredPorts = portsFor({
          fixture: value,
          tokens: [token, rootToken],
          resolution: SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" }),
          bindings: HashMap.make(
            [
              "approve-child:1",
              TrustedClaimBinding.cases.Claim.make({ claim: child.claim, clearsRetraction: O.none() }),
            ],
            [
              "restore-root:2",
              TrustedClaimBinding.cases.Claim.make({ claim: value.a.claim, clearsRetraction: O.some(digest) }),
            ]
          ),
        });
        const restoredResult = yield* flow.admit({
          ...request,
          token: rootToken,
          action: rootToken.action,
          revision: rootToken.revision,
          at: utc(60),
          clears: O.some(prior),
          ports: restoredPorts,
        });
        const restored = accepted(restoredResult);
        const healedRequest = { ...base, admissions: [admitted, restored], asOf: utc(65), ports: restoredPorts };
        const healed = yield* flow.viewAt(healedRequest);
        expect(healed).toMatchObject({ _tag: "Viewed", eligibility: { _tag: "Eligible" }, orphan: false });
        const uncertain = yield* flow.viewAt({
          ...healedRequest,
          ports: {
            ...restoredPorts,
            resolveAt: ({ at }) =>
              Effect.succeed(
                DateTime.toEpochMillis(at) === 60
                  ? SourceResolution.cases.Unavailable.make({})
                  : SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" })
              ),
          },
        });
        expect(uncertain).toMatchObject({
          _tag: "Viewed",
          eligibility: { _tag: "Unknown", reason: "uncertain-retraction" },
        });
      })
  );
});
