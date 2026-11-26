/**
 * Attorney admission over the claim store ports, the matter wall and the
 * authorized source-text resolver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeAdmissionArrows, SourceResolution } from "@beep/epistemics/Admission";
import {
  ResolveSourceTextRequest,
  SourceTextResolver,
  SourceTextResolverErrorReason,
} from "@beep/file-processing/SourceText";
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import {
  LawAdmission as LawAdmissionRecord,
  LawClaimCore,
  LawRetraction,
  OfficeActionDistinctionGate,
} from "@beep/law-practice-domain/values/LawClaim";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { constant } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { AdmissionBinding, LawClaimAdmissions, LawClaimProposals } from "../ClaimStore/index.ts";
import { LawPrincipal, MatterAccess, MatterAuthority } from "../MatterWall/index.ts";
import { AttorneyAttestation, LawAdmission } from "./LawAdmission.ports.ts";
import { LawAdmissionRefused, LawAdmissionResult } from "./LawAdmission.values.ts";
import type { AdmissionPorts } from "@beep/epistemics/Admission";
import type { SourceTextResolverError } from "@beep/file-processing/SourceText";
import type * as Digest from "effect/crypto/Digest";
import type { LawClaimStoreError } from "../ClaimStore/index.ts";

const $I = $LawPracticeUseCasesId.create("LawAdmission/LawAdmission.service");

const LawAdmissionArrows = makeAdmissionArrows({
  $I,
  ClaimCore: LawClaimCore,
  Admission: LawAdmissionRecord,
  Retraction: LawRetraction,
});

const missing = (): SourceResolution => SourceResolution.cases.Missing.make({});
const stale = (): SourceResolution => SourceResolution.cases.Stale.make({});
const unavailable = (): SourceResolution => SourceResolution.cases.Unavailable.make({});

const resolutionOfReason = SourceTextResolverErrorReason.match({
  "scope-unavailable": (): SourceResolution => SourceResolution.cases.Denied.make({}),
  "locator-invalid": missing,
  "source-unavailable": missing,
  "text-unavailable": missing,
  "page-out-of-range": missing,
  "source-digest-mismatch": stale,
  "text-digest-mismatch": stale,
  "extractor-unavailable": unavailable,
  "extraction-failed": unavailable,
});

const resolutionOfFailure = (error: SourceTextResolverError): SourceResolution => resolutionOfReason(error.reason);

/**
 * Attorney admission: `open` records the trusted binding under the
 * authenticated principal, and `admit` checks the office-action gate before
 * the epistemics admission and stores what it admits.
 *
 * **Details**
 *
 * Authentication is the host-provided principal, then the matter wall with
 * `claim-admission` on the claim's scope. Current text comes through the
 * authorized resolver; a denied scope reads as `Denied`, an absent source as
 * `Missing` and a digest mismatch as `Stale`. No historical snapshot exists in
 * P6, so `resolveAt` answers `Unavailable`.
 *
 * **Example** (Reference the admission layer)
 *
 * ```ts
 * import { LawAdmissionLayer } from "@beep/law-practice-use-cases/LawAdmission"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(LawAdmissionLayer)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LawAdmissionLayer: Layer.Layer<
  LawAdmission,
  never,
  | LawPrincipal
  | MatterAuthority
  | LawClaimProposals
  | LawClaimAdmissions
  | SourceTextResolver
  | AttorneyAttestation
  | Digest.Digest
> = Layer.effect(
  LawAdmission,
  Effect.gen(function* () {
    const { principal } = yield* LawPrincipal;
    const authority = yield* MatterAuthority;
    const proposals = yield* LawClaimProposals;
    const admissions = yield* LawClaimAdmissions;
    const resolver = yield* SourceTextResolver;
    const attestation = yield* AttorneyAttestation;
    const context = yield* Effect.context<Digest.Digest>();
    const resolveCurrent: AdmissionPorts<LawAdmissionRecord, LawClaimStoreError>["resolveCurrent"] = ({ receipt }) =>
      resolver.resolve(ResolveSourceTextRequest.make({ identity: receipt.source })).pipe(
        Effect.match({
          onFailure: resolutionOfFailure,
          onSuccess: (resolved) =>
            SourceResolution.cases.Resolved.make({ source: resolved.identity, text: resolved.text }),
        })
      );
    const ports: AdmissionPorts<LawAdmissionRecord, LawClaimStoreError> = {
      authenticate: Effect.fn("LawAdmission.authenticate")(function* (scope) {
        const access = yield* authority.authorize({ principal, scope, access: "claim-admission" });
        return MatterAccess.guards.Granted(access) ? O.some(principal) : O.none();
      }),
      generation: proposals.generation,
      resolveAt: constant(Effect.succeed(SourceResolution.cases.Unavailable.make({}))),
      resolveBinding: ({ actor, action, revision, scope }) => admissions.binding({ actor, action, revision, scope }),
      resolveCurrent,
      verifyToken: attestation.verify,
    };
    const refused = (refusal: LawAdmissionRefused) => LawAdmissionResult.cases.Refused.make({ refusal });
    return LawAdmission.of({
      open: Effect.fn("LawAdmission.open")(function* (request) {
        const record = yield* proposals.get(request.claim);
        if (O.isNone(record)) return;
        yield* admissions.openAdmission(
          AdmissionBinding.make({
            claim: request.claim,
            actor: principal,
            action: "admit-distinction",
            revision: request.revision,
            scope: record.value.core.scope,
          })
        );
      }),
      admit: Effect.fn("LawAdmission.admit")(function* (request) {
        const { claim } = request;
        const record = yield* proposals.get(claim);
        if (O.isNone(record)) return refused(LawAdmissionRefused.cases.UnknownClaim.make({ claim }));
        if (!OfficeActionDistinctionGate.passes(request.assessments))
          return refused(LawAdmissionRefused.cases.GateNotPassed.make({ claim }));
        const at = yield* DateTime.now;
        const result = yield* LawAdmissionArrows.admit({
          record: record.value,
          actor: principal,
          action: "admit-distinction",
          revision: request.revision,
          scope: record.value.core.scope,
          token: request.token,
          grounding: request.grounding,
          at,
          clears: O.none(),
          ports,
        });
        yield* Effect.annotateCurrentSpan({ "beep.law_practice.admission_outcome": result._tag });
        if (result._tag === "Refused")
          return refused(LawAdmissionRefused.cases.Admission.make({ refusal: result.refusal }));
        const admission = LawAdmissionRecord.make(result.admission);
        yield* admissions.appendAdmission(admission);
        return LawAdmissionResult.cases.Admitted.make({ admission });
      }, Effect.provideContext(context)),
    });
  })
);
