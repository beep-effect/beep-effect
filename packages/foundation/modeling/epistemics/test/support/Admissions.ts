import { GenerationFact, makeAdmissionArrows, SourceResolution, TrustedClaimBinding } from "@beep/epistemics/Admission";
import { ClaimLogEntry } from "@beep/epistemics/ClaimLog";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
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
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { activity, arrows, Claims, Core, coreAt } from "./Claims.ts";
import type { AdmissionPorts } from "@beep/epistemics/Admission";

/**
 * Synthetic admission arrows.
 * **Example** (Inspect admission)
 * ```ts
 * import { flow } from "./Admissions"
 * console.log(typeof flow.admit)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const flow = makeAdmissionArrows(Claims);
const sameToken = S.toEquivalence(Claims.HumanAdmissionToken);

/**
 * Explicit synthetic human token data, without authority.
 * **Example** (Create token data)
 * ```ts
 * import { tokenFor } from "./Admissions"
 * console.log(tokenFor({ action: "approve", revision: "1", issued: 20, nonce: "a" }).action)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const tokenFor = (options: {
  readonly action: string;
  readonly revision: string;
  readonly issued: number;
  readonly nonce: string;
}) =>
  Claims.HumanAdmissionToken.make({
    actor: "human",
    scope: "fixture",
    action: options.action,
    revision: options.revision,
    issuedAt: DateTime.makeUnsafe(options.issued),
    attestation: Sha256PrefixedDigest.make(`sha256:${Str.repeat(64)(options.nonce)}`),
  });

/**
 * Two minted claims sharing one actually verified occurrence.
 * **Example** (Inspect fixture construction)
 * ```ts
 * import { fixture } from "./Admissions"
 * console.log(typeof fixture)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const fixture = Effect.fn("TestAdmission.fixture")(function* () {
  const digest = SourceTextDigest.make("sha256:1e7dc6d6c16565406afd121a89164b990879f5f47695e03b9c3fd0f07395a4ca");
  const source = SourceTextIdentity.make({
    scopeRef: "fixture",
    sourceRef: "source",
    locator: SourceTextLocator.make("fixture.txt"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "1",
  });
  const proof = yield* verifyTextAnchor(
    VerifyTextAnchorInput.make({
      expectedSource: source,
      source,
      sourceText: "fact",
      anchor: TextAnchor.make({ startChar: 0, endChar: 4, quote: "fact" }),
    })
  );
  const receipt = toTextAnchorVerificationReceipt(proof);
  const occurrence = yield* mintOccurrenceId(Anchored.make({ receipt }));
  const left = Core.make({ ...coreAt({ at: 10, subject: 1 }), supportAtCreation: HashSet.make(occurrence) });
  const right = Core.make({ ...coreAt({ at: 11, subject: 2 }), supportAtCreation: HashSet.make(occurrence) });
  const leftId = yield* arrows.mint(left);
  const rightId = yield* arrows.mint(right);
  return {
    a: Claims.ClaimRecord.make({ claim: leftId, core: left }),
    b: Claims.ClaimRecord.make({ claim: rightId, core: right }),
    source,
    receipt,
    occurrence,
    token: tokenFor({ action: "approve-a", revision: "1", issued: 20, nonce: "a" }),
  };
});
type Fixture = Effect.Success<ReturnType<typeof fixture>>;

/**
 * Trusted immutable synthetic action state and source resolvers.
 * **Example** (Inspect the fixture port builder)
 * ```ts
 * import { portsFor } from "./Admissions"
 * console.log(typeof portsFor)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const portsFor = (options: {
  readonly fixture: Fixture;
  readonly bindings: HashMap.HashMap<string, TrustedClaimBinding>;
  readonly tokens: ReadonlyArray<typeof Claims.HumanAdmissionToken.Type>;
  readonly resolution: SourceResolution;
}): AdmissionPorts<typeof Claims.Admission.Type> => ({
  authenticate: () => Effect.succeedSome("human"),
  verifyToken: (token) => Effect.succeed(A.some(options.tokens, (known) => sameToken(token, known))),
  resolveBinding: (request) =>
    Effect.succeed(
      O.getOrElse(HashMap.get(options.bindings, `${request.action}:${request.revision}`), () =>
        TrustedClaimBinding.cases.Unavailable.make({ reason: "missing" })
      )
    ),
  generation: (id) =>
    Effect.succeed(
      HashMap.get(HashMap.make([activity, GenerationFact.make({ activity, at: DateTime.makeUnsafe(0) })]), id)
    ),
  resolveCurrent: () => Effect.succeed(options.resolution),
  resolveAt: () => Effect.succeed(options.resolution),
});

/**
 * One exact-claim action and current synthetic source.
 * **Example** (Inspect exact-claim ports)
 * ```ts
 * import { basePorts } from "./Admissions"
 * console.log(typeof basePorts)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const basePorts = (value: Fixture) =>
  portsFor({
    fixture: value,
    tokens: [value.token],
    resolution: SourceResolution.cases.Resolved.make({ source: value.source, text: "fact" }),
    bindings: HashMap.make([
      "approve-a:1",
      TrustedClaimBinding.cases.Claim.make({ claim: value.a.claim, clearsRetraction: O.none() }),
    ]),
  });

/**
 * An explicit admission request at time 30.
 * **Example** (Inspect request construction)
 * ```ts
 * import { requestFor } from "./Admissions"
 * console.log(typeof requestFor)
 * ```
 * @category testing
 * @since 0.0.0
 */
export const requestFor = (value: Fixture) => ({
  record: value.a,
  actor: value.token.actor,
  action: value.token.action,
  revision: value.token.revision,
  scope: value.token.scope,
  token: value.token,
  grounding: [value.receipt],
  at: DateTime.makeUnsafe(30),
  clears: O.none<typeof Claims.Retraction.Type>(),
  ports: basePorts(value),
});

/**
 * Checked fixtures' projection log at explicit native generation end zero.
 * **Example** (Inspect log construction)
 * ```ts
 * import { logOf } from "./Admissions"
 * console.log(logOf([]))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const logOf = (records: ReadonlyArray<typeof Claims.ClaimRecord.Type>) =>
  A.map(records, (record) =>
    ClaimLogEntry.make({ ...record.core, claim: record.claim, generatedAt: DateTime.makeUnsafe(0) })
  );
