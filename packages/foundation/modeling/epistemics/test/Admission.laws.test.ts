import {
  ClaimSetPreimage,
  GenerationFact,
  makeAdmissionArrows,
  RetractionPreimage,
  SourceResolution,
  TrustedClaimBinding,
} from "@beep/epistemics/Admission";
import { ClaimId } from "@beep/epistemics/ClaimCore";
import { ActivityId } from "@beep/schema/ContentHash";
import { it } from "@beep/test-runner";
import { TextAnchor } from "@beep/text/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fixture, flow, requestFor, tokenFor } from "./support/Admissions.ts";
import { activity, Claims, Core } from "./support/Claims.ts";

const id = (char: string) => ClaimId.make(`sha256:${Str.repeat(64)(char)}`);
const utc = DateTime.makeUnsafe;
const tagOf = (result: typeof flow.AdmissionResult.Type) =>
  flow.AdmissionResult.match(result, { Admitted: () => "Admitted", Refused: (result) => result.refusal._tag });
const isAdmission = S.is(Claims.Admission);
const TokenJson = S.toCodecJson(Claims.HumanAdmissionToken);
const AdmissionJson = S.toCodecJson(Claims.Admission);
const ownerRefuses = makeAdmissionArrows({
  ...Claims,
  Admission: Claims.Admission.check(
    S.makeFilter(
      () => false,
      Claims.$I.annote("OwnerRefuses", {
        description: "The synthetic owner refuses record construction after verification.",
      })
    )
  ),
});
class SourceBackendError extends S.TaggedError<SourceBackendError, { readonly brand: unique symbol }>(
  Claims.$I.make("SourceBackendError")
)(
  "SourceBackendError",
  {},
  Claims.$I.annote("SourceBackendError", { description: "A synthetic typed source backend failure." })
) {}

it.layer(Digest.layerWebCrypto, { timeout: "30 seconds" })("scoped admission arrows", (it) => {
  it.effect("L4-2 a schema-valid token alone grants nothing and refusal appends zero records", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const encoded = yield* S.encodeEffect(TokenJson)(value.token);
      const decoded = yield* S.decodeEffect(TokenJson)(encoded);
      let writes = 0;
      const result = yield* flow.admit({
        ...request,
        token: decoded,
        ports: { ...request.ports, verifyToken: () => Effect.succeed(false) },
      });
      if (flow.AdmissionResult.guards.Admitted(result)) writes += 1;
      expect(tagOf(result)).toBe("InvalidToken");
      expect(writes).toBe(0);
      const accepted = yield* flow.admit(request);
      expect(tagOf(accepted)).toBe("Admitted");
      if (flow.AdmissionResult.guards.Admitted(accepted)) {
        const wire = yield* S.encodeEffect(AdmissionJson)(accepted.admission);
        const stored = yield* S.decodeEffect(AdmissionJson)(wire);
        const refused = yield* flow.revalidate({
          record: value.a,
          admission: stored,
          clears: O.none(),
          ports: { ...request.ports, verifyToken: () => Effect.succeed(false) },
        });
        expect(tagOf(refused)).toBe("InvalidToken");
        expect(isAdmission(stored)).toBe(true);
        for (const changed of [
          { ...stored, actor: "other" },
          { ...stored, scope: "other" },
          { ...stored, action: "other" },
          { ...stored, revision: "other" },
        ])
          expect(isAdmission(changed)).toBe(false);
      }
    })
  );
  it.effect("L4-2 A-authorizing action refuses B despite the same verified occurrence and caller binding hints", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const hint = {
        ...request,
        record: value.b,
        trustedBinding: TrustedClaimBinding.cases.Claim.make({ claim: value.b.claim, clearsRetraction: O.none() }),
      };
      const result = yield* flow.admit(hint);
      expect(tagOf(result)).toBe("InvalidBinding");
      expect(HashSet.has(value.a.core.supportAtCreation, value.occurrence)).toBe(true);
      expect(HashSet.has(value.b.core.supportAtCreation, value.occurrence)).toBe(true);
      expect(value.a.claim).not.toBe(value.b.claim);
    })
  );
  it.effect("L4-2 claim-set bindings require both a re-minted digest and trusted immutable membership", () =>
    Effect.gen(function* () {
      yield* ClaimSetPreimage.verifyGolden();
      yield* RetractionPreimage.verifyGolden();
      const value = yield* fixture();
      const request = requestFor(value);
      const members = HashSet.make(value.a.claim, value.b.claim);
      const digest = yield* ClaimSetPreimage.mint([members]);
      const binding = TrustedClaimBinding.cases.ClaimSet.make({ digest, members, clearsRetraction: O.none() });
      const both = yield* flow.admit({
        ...request,
        record: value.b,
        ports: { ...request.ports, resolveBinding: () => Effect.succeed(binding) },
      });
      expect(tagOf(both)).toBe("Admitted");
      const badDigest = yield* flow.admit({
        ...request,
        ports: {
          ...request.ports,
          resolveBinding: () =>
            Effect.succeed(TrustedClaimBinding.cases.ClaimSet.make({ ...binding, digest: id("f") })),
        },
      });
      expect(tagOf(badDigest)).toBe("InvalidBinding");
      const otherMembers = HashSet.make(value.b.claim);
      const otherDigest = yield* ClaimSetPreimage.mint([otherMembers]);
      const absent = yield* flow.admit({
        ...request,
        ports: {
          ...request.ports,
          resolveBinding: () =>
            Effect.succeed(
              TrustedClaimBinding.cases.ClaimSet.make({
                digest: otherDigest,
                members: otherMembers,
                clearsRetraction: O.none(),
              })
            ),
        },
      });
      expect(tagOf(absent)).toBe("InvalidBinding");
    })
  );
  it.effect("L4-2 refuses empty, tampered, unauthorized, future and mismatched request bindings", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const changedCore = Core.make({ ...value.a.core, proposition: { ...value.a.core.proposition, text: "changed" } });
      const requests = [
        { ...request, grounding: [] },
        { ...request, record: Claims.ClaimRecord.make({ ...value.a, core: changedCore }) },
        { ...request, scope: "other" },
        { ...request, ports: { ...request.ports, authenticate: () => Effect.succeedNone } },
        { ...request, ports: { ...request.ports, authenticate: () => Effect.succeedSome("other") } },
        ...A.map(["actor", "action", "revision", "scope"], (field) => ({
          ...request,
          token: Claims.HumanAdmissionToken.make({ ...value.token, [field]: "other" }),
        })),
        { ...request, token: tokenFor({ action: "approve-a", revision: "1", issued: 31, nonce: "a" }) },
      ];
      const results = yield* Effect.forEach(requests, (request) => flow.admit(request), { concurrency: 1 });
      expect(A.map(results, tagOf)).toEqual([
        "EmptyGrounding",
        "InvalidClaim",
        "DeniedScope",
        "DeniedScope",
        "InvalidToken",
        ...A.makeBy(5, () => "InvalidToken"),
      ]);
      const owner = yield* ownerRefuses.admit(request);
      expect(owner._tag).toBe("Refused");
    })
  );
  it.effect.each(TrustedClaimBinding.cases.Unavailable.fields.reason.literals)(
    "L4-2 refuses %s trusted action state",
    (reason) =>
      Effect.gen(function* () {
        const value = yield* fixture();
        const request = requestFor(value);
        const binding = yield* S.decodeEffect(TrustedClaimBinding)({ _tag: "Unavailable", reason });
        const result = yield* flow.admit({
          ...request,
          ports: { ...request.ports, resolveBinding: () => Effect.succeed(binding) },
        });
        expect(tagOf(result)).toBe("InvalidBinding");
      })
  );
  it.effect("L4-2 requires native claim generation without requiring annotation generation times", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const results = yield* Effect.all(
        [
          flow.admit({ ...request, ports: { ...request.ports, generation: () => Effect.succeedNone } }),
          flow.admit({
            ...request,
            ports: {
              ...request.ports,
              generation: () =>
                Effect.succeed(GenerationFact.makeOption({ activity: ActivityId.make(id("f")), at: utc(0) })),
            },
          }),
          flow.admit({
            ...request,
            ports: {
              ...request.ports,
              generation: () => Effect.succeed(GenerationFact.makeOption({ activity, at: utc(11) })),
            },
          }),
        ],
        { concurrency: 1 }
      );
      expect(A.map(results, tagOf)).toEqual(["MissingGeneration", "MissingGeneration", "MissingGeneration"]);
    })
  );
  it.effect.each([
    { resolution: SourceResolution.cases.Missing.make({}), expected: "GroundingMissing" },
    { resolution: SourceResolution.cases.Stale.make({}), expected: "GroundingStale" },
    { resolution: SourceResolution.cases.Ambiguous.make({}), expected: "GroundingAmbiguous" },
    { resolution: SourceResolution.cases.Denied.make({}), expected: "DeniedScope" },
    { resolution: SourceResolution.cases.Unavailable.make({}), expected: "GroundingUnavailable" },
  ])("L4-2 refuses $expected current grounding without changing the core", ({ resolution, expected }) =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const original = yield* S.encodeEffect(Claims.ClaimRecord)(value.a);
      const result = yield* flow.admit({
        ...request,
        ports: { ...request.ports, resolveCurrent: () => Effect.succeed(resolution) },
      });
      const after = yield* S.encodeEffect(Claims.ClaimRecord)(value.a);
      expect(tagOf(result)).toBe(expected);
      expect(after).toEqual(original);
    })
  );
  it.effect("L4-2 remints every receipt, re-verifies source identity and preserves typed backend failures", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const wrong = TextAnchorVerificationReceipt.make({
        ...value.receipt,
        anchor: TextAnchor.make({ startChar: 0, endChar: 4, quote: "fake" }),
      });
      const malformed = TextAnchorVerificationReceipt.make({
        ...value.receipt,
        anchor: TextAnchor.make({ startChar: 0, endChar: 1, quote: "\ud800" }),
      });
      const results = yield* Effect.all(
        [
          flow.admit({ ...request, grounding: [wrong] }),
          flow.admit({ ...request, grounding: [malformed] }),
          flow.admit({
            ...request,
            ports: {
              ...request.ports,
              resolveCurrent: () =>
                Effect.succeed(SourceResolution.cases.Resolved.make({ source: value.source, text: "fake" })),
            },
          }),
        ],
        { concurrency: 1 }
      );
      expect(A.map(results, tagOf)).toEqual(["WrongClaimOccurrence", "GroundingInvalid", "GroundingStale"]);
      const error = SourceBackendError.make({});
      const failed = yield* flow
        .admit({ ...request, ports: { ...request.ports, resolveCurrent: () => error } })
        .pipe(Effect.result);
      assertFailure(failed, error);
    })
  );
  it.effect.prop(
    "L4-2 generated fresh/stale and wrong-claim combinations never bypass the exact binding",
    [S.Tuple([S.Boolean, S.Boolean])],
    ([[stale, wrongClaim]]) =>
      Effect.gen(function* () {
        const value = yield* fixture();
        const request = requestFor(value);
        const result = yield* flow.admit({
          ...request,
          record: wrongClaim ? value.b : value.a,
          ports: {
            ...request.ports,
            resolveCurrent: () =>
              Effect.succeed(
                stale
                  ? SourceResolution.cases.Stale.make({})
                  : SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" })
              ),
          },
        });
        expect(tagOf(result)).toBe(wrongClaim ? "InvalidBinding" : stale ? "GroundingStale" : "Admitted");
      })
  );
  it.effect("L4-2 revalidation rejects a different claim and an invented clearing field", () =>
    Effect.gen(function* () {
      const value = yield* fixture();
      const request = requestFor(value);
      const first = yield* flow.admit(request);
      if (flow.AdmissionResult.guards.Admitted(first)) {
        const wrong = yield* flow.revalidate({
          record: value.b,
          admission: first.admission,
          clears: O.none(),
          ports: request.ports,
        });
        expect(tagOf(wrong)).toBe("InvalidClaim");
        const forged = Claims.Admission.make({ ...first.admission, clearsRetraction: O.some(id("f")) });
        const missing = yield* flow.revalidate({
          record: value.a,
          admission: forged,
          clears: O.none(),
          ports: request.ports,
        });
        expect(tagOf(missing)).toBe("InvalidBinding");
      }
    })
  );
});
