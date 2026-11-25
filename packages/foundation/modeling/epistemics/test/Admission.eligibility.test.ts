import { GenerationFact, SourceResolution, TrustedClaimBinding } from "@beep/epistemics/Admission";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { fixture, flow, logOf, portsFor, requestFor, tokenFor } from "./support/Admissions.ts";
import { activity, Claims } from "./support/Claims.ts";
import type { AdmissionPorts } from "@beep/epistemics/Admission";
import type { ClaimId } from "@beep/epistemics/ClaimCore.schema";

const utc = DateTime.makeUnsafe;
const accepted = (result: typeof flow.AdmissionResult.Type) =>
  O.getOrThrow(O.liftPredicate(flow.AdmissionResult.guards.Admitted)(result)).admission;
const tagOf = (result: typeof flow.AdmissionResult.Type) =>
  flow.AdmissionResult.match(result, { Admitted: () => "Admitted", Refused: (result) => result.refusal._tag });
class SelectedBackendError extends S.TaggedError<SelectedBackendError, { readonly brand: unique symbol }>(
  Claims.$I.make("SelectedBackendError")
)(
  "SelectedBackendError",
  {},
  Claims.$I.annote("SelectedBackendError", { description: "A synthetic selected-time source backend failure." })
) {}
const viewOf = (options: {
  readonly claim: ClaimId;
  readonly records: ReadonlyArray<typeof Claims.ClaimRecord.Type>;
  readonly admissions: ReadonlyArray<typeof Claims.Admission.Type>;
  readonly retractions: ReadonlyArray<typeof Claims.Retraction.Type>;
  readonly asOf: number;
  readonly ports: AdmissionPorts<typeof Claims.Admission.Type, SelectedBackendError>;
  readonly historicalPorts: AdmissionPorts<typeof Claims.Admission.Type, SelectedBackendError>;
}) =>
  flow.viewAt({
    ...options,
    log: logOf(options.records),
    records: HashMap.fromIterable(
      A.map(options.records, (record): readonly [ClaimId, typeof Claims.ClaimRecord.Type] => [record.claim, record])
    ),
    stances: A.empty<typeof Claims.StanceRecord.Type>(),
    validSelection: HashSet.fromIterable(A.map(options.records, (record) => record.claim)),
    asOf: utc(options.asOf),
  });

it.layer(Digest.layerWebCrypto, { timeout: "30 seconds" })("admission eligibility edges", (it) => {
  it.effect("L4-2 refuses an admission dated before its native generation ended", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const early = tokenFor({ action: "approve-a", revision: "1", issued: 1, nonce: "a" });
      const result = yield* flow.admit({
        ...request,
        token: early,
        at: utc(5),
        ports: {
          ...request.ports,
          verifyToken: () => Effect.succeed(true),
          generation: () => Effect.succeed(GenerationFact.makeOption({ activity, at: utc(8) })),
        },
      });
      expect(tagOf(result)).toBe("MissingGeneration");
      const onTime = yield* flow.admit({
        ...request,
        token: early,
        at: utc(8),
        ports: {
          ...request.ports,
          verifyToken: () => Effect.succeed(true),
          generation: () => Effect.succeed(GenerationFact.makeOption({ activity, at: utc(8) })),
        },
      });
      expect(tagOf(onTime)).toBe("Admitted");
    })
  );
  it.effect(
    "L4-4 historically unavailable or ambiguous grounding stays unknown when the selected snapshot resolves",
    () =>
      Effect.gen(function* () {
        const value = yield* fixture();
        const request = requestFor(value);
        const admitted = yield* flow.admit(request).pipe(Effect.map(accepted));
        const views = yield* Effect.forEach(
          [SourceResolution.cases.Unavailable.make({}), SourceResolution.cases.Ambiguous.make({})],
          (resolution) =>
            viewOf({
              claim: value.a.claim,
              records: [value.a],
              admissions: [admitted],
              retractions: [],
              asOf: 50,
              ports: request.ports,
              historicalPorts: { ...request.ports, resolveAt: () => Effect.succeed(resolution) },
            }),
          { concurrency: 1 }
        );
        expect(views).toMatchObject([
          { _tag: "Viewed", eligibility: { _tag: "Unknown", reason: "snapshot-unavailable" } },
          { _tag: "Viewed", eligibility: { _tag: "Unknown", reason: "ambiguous-grounding" } },
        ]);
      })
  );
  it.effect("L4-4 an unavailable historical clearing binding keeps the named retraction uncertain", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const first = yield* flow.admit(request).pipe(Effect.map(accepted));
      const prior = Claims.Retraction.make({ claim: value.a.claim, actor: "human", reason: "withdrawn", at: utc(40) });
      const digest = yield* flow.retractionDigest(prior);
      const token = tokenFor({ action: "readmit-a", revision: "2", issued: 55, nonce: "d" });
      const approve = TrustedClaimBinding.cases.Claim.make({ claim: value.a.claim, clearsRetraction: O.none() });
      const resolution = SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" });
      const ports = portsFor({
        fixture: value,
        tokens: [value.token, token],
        resolution,
        bindings: HashMap.make(
          ["approve-a:1", approve],
          [
            "readmit-a:2",
            TrustedClaimBinding.cases.Claim.make({ claim: value.a.claim, clearsRetraction: O.some(digest) }),
          ]
        ),
      });
      const readmitted = yield* flow
        .admit({
          ...request,
          token,
          action: token.action,
          revision: token.revision,
          at: utc(60),
          clears: O.some(prior),
          ports,
        })
        .pipe(Effect.map(accepted));
      const result = yield* viewOf({
        claim: value.a.claim,
        records: [value.a],
        admissions: [first, readmitted],
        retractions: [prior],
        asOf: 65,
        ports,
        historicalPorts: portsFor({
          fixture: value,
          tokens: [value.token, token],
          resolution,
          bindings: HashMap.make(["approve-a:1", approve]),
        }),
      });
      expect(result).toMatchObject({
        _tag: "Viewed",
        eligibility: { _tag: "Unknown", reason: "uncertain-retraction" },
        directRetraction: false,
      });
    })
  );
  it.effect("L4-4 selected-time lookups for another claim's admission cannot fail the view", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const token = tokenFor({ action: "approve-b", revision: "1", issued: 20, nonce: "b" });
      const ports = portsFor({
        fixture: value,
        tokens: [token],
        resolution: SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" }),
        bindings: HashMap.make([
          "approve-b:1",
          TrustedClaimBinding.cases.Claim.make({ claim: value.b.claim, clearsRetraction: O.none() }),
        ]),
      });
      const other = yield* flow
        .admit({
          ...requestFor(value),
          record: value.b,
          token,
          action: token.action,
          revision: token.revision,
          ports,
        })
        .pipe(Effect.map(accepted));
      const failing = SelectedBackendError.make({});
      const result = yield* viewOf({
        claim: value.a.claim,
        records: [value.a, value.b],
        admissions: [other],
        retractions: [],
        asOf: 50,
        ports: { ...ports, resolveAt: () => Effect.fail(failing) },
        historicalPorts: ports,
      });
      expect(result).toMatchObject({
        _tag: "Viewed",
        eligibility: { _tag: "Ineligible", reasons: ["unresolved-stance"] },
      });
    })
  );
  it.effect("L4-4 historical lookups for another claim's non-clearing admission cannot fail the view", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const token = tokenFor({ action: "approve-b", revision: "1", issued: 20, nonce: "b" });
      const ports = portsFor({
        fixture: value,
        tokens: [token],
        resolution: SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" }),
        bindings: HashMap.make([
          "approve-b:1",
          TrustedClaimBinding.cases.Claim.make({ claim: value.b.claim, clearsRetraction: O.none() }),
        ]),
      });
      const other = yield* flow
        .admit({
          ...requestFor(value),
          record: value.b,
          token,
          action: token.action,
          revision: token.revision,
          ports,
        })
        .pipe(Effect.map(accepted));
      const failing = SelectedBackendError.make({});
      const broken = {
        ...ports,
        resolveAt: () => Effect.fail(failing),
        resolveBinding: () => Effect.fail(failing),
      };
      const result = yield* viewOf({
        claim: value.a.claim,
        records: [value.a, value.b],
        admissions: [other],
        retractions: [],
        asOf: 50,
        ports: broken,
        historicalPorts: broken,
      });
      expect(result).toMatchObject({
        _tag: "Viewed",
        eligibility: { _tag: "Ineligible", reasons: ["unresolved-stance"] },
      });
    })
  );
});
