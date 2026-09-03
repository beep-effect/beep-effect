/**
 * Deterministic, opt-in contradiction-triage fixtures for browser QA.
 *
 * The seed is intentionally inert unless `BEEP_CONTRADICTION_QA_SEED=1`.
 * Enabled runs require an isolated `BEEP_CONTRADICTION_QA_VAULT_ROOT`; the
 * database is expected to be isolated independently through `CHAT_DB_PATH`.
 *
 * Every persisted identity is deterministic. Existing fixture rows and source
 * bytes are reused only when they exactly match, while any collision fails
 * closed without updating the existing record.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import { EvidenceVerification, manifestationKeyFor } from "@beep/epistemic-domain/entities/EvidenceVerification";
import {
  BeliefVersionRef,
  ContradictionAssessment,
  ContradictionBeliefPair,
  ContradictionMatchBasis,
  ContradictionProposalId,
  ContradictionReceiptKey,
  ContradictionResolutionProposal,
  contradictionEvidenceDigest,
  contradictionProposalDigest,
} from "@beep/epistemic-domain/values/Contradiction";
import { Confidence, EvidenceSpan } from "@beep/epistemic-domain/values/EvidenceSpan";
import { LogicalEdgeIdentity, logicalEdgeKey } from "@beep/epistemic-domain/values/LogicalEdgeIdentity";
import { DbSchema } from "@beep/epistemic-tables";
import { fromEdgeVersionRow } from "@beep/epistemic-tables/entities/EdgeVersion";
import { fromEvidenceRow, toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import {
  fromEvidenceVerificationRow,
  toEvidenceVerificationInsert,
} from "@beep/epistemic-tables/entities/EvidenceVerification";
import {
  ContradictionTriageRepository,
  EdgeAuthorityRepository,
  RecordEdgeFact,
  SubmitContradictionCandidate,
} from "@beep/epistemic-use-cases/server";
import { resolvePathWithinCanonicalRoot } from "@beep/file-processing/PathSafety";
import {
  SOURCE_TEXT_PAGE_CODE_UNITS,
  UTF8_SOURCE_TEXT_EXTRACTOR_NAME,
  UTF8_SOURCE_TEXT_EXTRACTOR_VERSION,
} from "@beep/file-processing/SourceText";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { PostgresDrizzle } from "@beep/postgres";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/provenance/VerifiedTextAnchor";
import { Cuid } from "@beep/schema/Cuid";
import { PosInt } from "@beep/schema/Int";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { NonNegativeInt } from "@beep/schema/Number";
import { PosixPath } from "@beep/schema/PosixPath";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import { SystemPrincipal } from "@beep/shared-domain/entity/Principal";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as EpistemicIdentity from "@beep/shared-domain/identity/Epistemic";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import { WorkspaceVaultRootPath } from "@beep/workspace-domain/entities/Workspace";
import { Workspace } from "@beep/workspace-use-cases/server";
import * as Config from "effect/Config";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { JsonObject } from "@beep/schema/Json";
import type * as Crypto from "effect/Crypto";

const $I = $ProfessionalDesktopId.create("contradiction/ContradictionQaSeed");

/**
 * Exact environment switch that enables contradiction browser-QA fixtures.
 *
 * **Example** (Enable QA seed environment)
 *
 * ```ts
 * import { CONTRADICTION_QA_SEED_ENV } from "@/contradiction/ContradictionQaSeed"
 *
 * const qaEnvironment = { [CONTRADICTION_QA_SEED_ENV]: "1" }
 * console.log(qaEnvironment.BEEP_CONTRADICTION_QA_SEED === "1") // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_QA_SEED_ENV = "BEEP_CONTRADICTION_QA_SEED";

/**
 * Isolated workspace-vault root required by the enabled QA seed.
 *
 * **Example** (Set isolated vault root)
 *
 * ```ts
 * import { CONTRADICTION_QA_VAULT_ROOT_ENV } from "@/contradiction/ContradictionQaSeed"
 *
 * const qaEnvironment = { [CONTRADICTION_QA_VAULT_ROOT_ENV]: "/tmp/contradiction-qa-vault" }
 * console.log(qaEnvironment.BEEP_CONTRADICTION_QA_VAULT_ROOT) // "/tmp/contradiction-qa-vault"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_QA_VAULT_ROOT_ENV = "BEEP_CONTRADICTION_QA_VAULT_ROOT";

/**
 * Vault-relative UTF-8 source used by the verified QA evidence.
 *
 * **Example** (Verify source locator prefix)
 *
 * ```ts
 * import { CONTRADICTION_QA_SOURCE_LOCATOR } from "@/contradiction/ContradictionQaSeed"
 * import * as Str from "effect/String"
 *
 * const isQaFixture = Str.startsWith("qa/")(CONTRADICTION_QA_SOURCE_LOCATOR)
 * console.log(isQaFixture) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_QA_SOURCE_LOCATOR = PosixPath.make("qa/contradiction-triage/surrogate-boundary.txt");

/**
 * UTF-16 offset where the verified QA quote begins.
 *
 * **Details**
 *
 * The quote's leading surrogate pair crosses the nominal page boundary, so the
 * authority-owned page selector must return page one even though nominal integer
 * division predicts page zero.
 *
 * **Example** (Check anchor before boundary)
 *
 * ```ts
 * import { CONTRADICTION_QA_ANCHOR_START } from "@/contradiction/ContradictionQaSeed"
 * import { SOURCE_TEXT_PAGE_CODE_UNITS } from "@beep/file-processing/SourceText"
 *
 * const startsBeforeNominalBoundary =
 *   CONTRADICTION_QA_ANCHOR_START === SOURCE_TEXT_PAGE_CODE_UNITS - 1
 * console.log(startsBeforeNominalBoundary) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_QA_ANCHOR_START = NonNegativeInt.make(SOURCE_TEXT_PAGE_CODE_UNITS - 1);

/**
 * Exact quote bound to the verified QA evidence.
 *
 * @category constants
 * @since 0.0.0
 */
const CONTRADICTION_QA_ANCHOR_QUOTE = "🧭 The executed amendment sets the renewal deadline to 30 June 2027.";

/**
 * Complete canonical UTF-8 source written into the isolated QA vault.
 *
 * **Example** (Confirm source includes emoji)
 *
 * ```ts
 * import { CONTRADICTION_QA_SOURCE_TEXT } from "@/contradiction/ContradictionQaSeed"
 * import * as Str from "effect/String"
 *
 * console.log(Str.includes("🧭")(CONTRADICTION_QA_SOURCE_TEXT)) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CONTRADICTION_QA_SOURCE_TEXT = `${Str.repeat(CONTRADICTION_QA_ANCHOR_START)(
  "a"
)}${CONTRADICTION_QA_ANCHOR_QUOTE}
The renewal notice was generated before the executed amendment was indexed.
This source remains deliberately longer than one canonical source-text page.`;

const ContradictionQaSeedErrorReason = LiteralKit([
  "belief-conflict",
  "candidate-conflict",
  "evidence-conflict",
  "source-conflict",
  "storage-unavailable",
  "vault-root-conflict",
  "verification-conflict",
]).pipe(
  $I.annoteSchema("ContradictionQaSeedErrorReason", {
    description: "Bounded collision and availability reasons emitted while seeding contradiction browser-QA data.",
  })
);

type ContradictionQaSeedErrorReason = typeof ContradictionQaSeedErrorReason.Type;

/**
 * Sanitized contradiction browser-QA seed failure.
 *
 * **Example** (Create and identify error)
 *
 * ```ts
 * import { ContradictionQaSeedError } from "@/contradiction/ContradictionQaSeed"
 *
 * const error = ContradictionQaSeedError.new("source-conflict", "The QA source differs.")
 * console.log(ContradictionQaSeedError.is(error)) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ContradictionQaSeedError extends S.TaggedError<ContradictionQaSeedError>($I`ContradictionQaSeedError`)(
  "ContradictionQaSeedError",
  {
    message: S.NonEmptyString,
    reason: ContradictionQaSeedErrorReason,
  },
  $I.annoteError<ContradictionQaSeedError>("ContradictionQaSeedError", {
    description: "Fail-closed collision or availability failure from the contradiction browser-QA seed.",
  })
) {
  /**
   * Construct a sanitized seed error.
   *
   * **Example** (Construct error with reason)
   *
   * ```ts
   * import { ContradictionQaSeedError } from "@/contradiction/ContradictionQaSeed"
   *
   * const error = ContradictionQaSeedError.new("storage-unavailable", "The QA database is unavailable.")
   * console.log(error.reason) // "storage-unavailable"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly new = (reason: ContradictionQaSeedErrorReason, message: string): ContradictionQaSeedError =>
    ContradictionQaSeedError.make({ message, reason });

  /**
   * Test whether an unknown value is a contradiction QA seed error.
   *
   * **Example** (Test for seed error)
   *
   * ```ts
   * import { ContradictionQaSeedError } from "@/contradiction/ContradictionQaSeed"
   *
   * const error = ContradictionQaSeedError.new("verification-conflict", "The anchor differs.")
   * console.log(ContradictionQaSeedError.is(error)) // true
   * ```
   *
   * @category guards
   * @since 0.0.0
   */
  static readonly is = S.is(ContradictionQaSeedError);
}

class ContradictionQaFact extends S.Class<ContradictionQaFact>($I`ContradictionQaFact`)(
  {
    issue: S.NonEmptyString,
    statement: S.NonEmptyString,
    value: S.NonEmptyString,
  },
  $I.annote("ContradictionQaFact", {
    description: "Exact persisted fact used by one contradiction browser-QA belief or proposal.",
  })
) {
  static readonly equivalence = S.toEquivalence(ContradictionQaFact);
  static readonly decodeOption = S.decodeUnknownOption(ContradictionQaFact);
}

const evidenceSpecificationFields = {
  artifactFixtureKey: S.String,
  createdAt: S.Finite,
  publicIdSuffix: Cuid,
  span: S.toEncoded(EvidenceSpan),
  spanFixtureKey: S.String,
};

// Self-typed annotations (examples, toArbitrary, ...) must live in an explicitly
// annotated const: inline in the extends clause they force TS to resolve the
// class while its base type is still being computed (TS2310/TS2506).
const evidenceSpecificationAnnotations: S.Annotations.Declaration<
  EvidenceSpecification,
  readonly [S.Struct<typeof evidenceSpecificationFields>]
> = $I.annoteClass<S.declare<EvidenceSpecification>, readonly [S.Struct<typeof evidenceSpecificationFields>]>(
  "EvidenceSpecification",
  {
    description: "Deterministic evidence fixture specification consumed by the contradiction browser-QA seed.",
    examples: [
      {
        artifactFixtureKey: "artifactFixtureKey",
        createdAt: 1,
        publicIdSuffix: Cuid.make("a123"),
        span: {
          confidence: 0.99,
          endChar: Str.length("The renewal notice lists 15 July 2027."),
          quote: "The renewal notice lists 15 July 2027.",
          startChar: 0,
        },
        spanFixtureKey: "",
      },
    ],
  }
);

class EvidenceSpecification extends S.Class<EvidenceSpecification>($I`EvidenceSpecification`)(
  evidenceSpecificationFields,
  evidenceSpecificationAnnotations
) {
  static readonly deadlineVerified = EvidenceSpecification.make({
    artifactFixtureKey: "qa.contradiction.deadline.executed-amendment",
    createdAt: 1_767_225_600_100,
    publicIdSuffix: Cuid.decodeUnknownSync("deadline"),
    span: {
      confidence: 0.99,
      endChar: CONTRADICTION_QA_ANCHOR_START + Str.length(CONTRADICTION_QA_ANCHOR_QUOTE),
      quote: CONTRADICTION_QA_ANCHOR_QUOTE,
      startChar: CONTRADICTION_QA_ANCHOR_START,
    },
    spanFixtureKey: "qa.contradiction.deadline.executed-amendment.anchor",
  });

  static readonly deadlineUnverified = EvidenceSpecification.make({
    artifactFixtureKey: "qa.contradiction.deadline.renewal-notice",
    createdAt: 1_767_225_600_200,
    publicIdSuffix: Cuid.decodeUnknownSync("notice"),
    span: {
      confidence: 0.91,
      endChar: Str.length("The renewal notice lists 15 July 2027."),
      quote: "The renewal notice lists 15 July 2027.",
      startChar: 0,
    },
    spanFixtureKey: "qa.contradiction.deadline.renewal-notice.anchor",
  });

  static readonly capAgreement = EvidenceSpecification.make({
    artifactFixtureKey: "qa.contradiction.liability-cap.executed-agreement",
    createdAt: 1_767_225_601_100,
    publicIdSuffix: Cuid.decodeUnknownSync("agreement"),
    span: {
      confidence: 0.97,
      endChar: Str.length("Liability is capped at USD 1,000,000."),
      quote: "Liability is capped at USD 1,000,000.",
      startChar: 0,
    },
    spanFixtureKey: "qa.contradiction.liability-cap.executed-agreement.anchor",
  });

  static readonly capEmail = EvidenceSpecification.make({
    artifactFixtureKey: "qa.contradiction.liability-cap.negotiation-email",
    createdAt: 1_767_225_601_200,
    publicIdSuffix: Cuid.decodeUnknownSync("email"),
    span: {
      confidence: 0.88,
      endChar: Str.length("The negotiated cap is USD 750,000."),
      quote: "The negotiated cap is USD 750,000.",
      startChar: 0,
    },
    spanFixtureKey: "qa.contradiction.liability-cap.negotiation-email.anchor",
  });
}

class BeliefSpecification extends S.Class<BeliefSpecification>($I`BeliefSpecification`)(
  {
    fact: ContradictionQaFact,
    identity: S.toEncoded(LogicalEdgeIdentity),
    recordedAt: S.Finite,
  },
  $I.annote("BeliefSpecification", {
    description: "Deterministic belief fixture specification consumed by the contradiction browser-QA seed.",
  })
) {
  static readonly deadlineAmendment = BeliefSpecification.make({
    fact: ContradictionQaFact.make({
      issue: "Renewal deadline",
      statement: "The executed amendment sets the renewal deadline to 30 June 2027.",
      value: "2027-06-30",
    }),
    identity: {
      evidenceScope: "qa:contradiction:deadline:executed-amendment",
      matterScope: "qa:contract-review",
      orgScope: "1",
      qualifiers: {
        fixture: "contradiction-qa",
        side: "executed-amendment",
      },
      relation: "supports",
      source: {
        entityRef: "qa:contract:renewal-deadline",
        kind: "entity",
      },
      target: {
        observationRef: "qa:observation:deadline:executed-amendment",
        kind: "observation",
      },
    },
    recordedAt: 1_767_225_600_300,
  });

  static readonly deadlineNotice = BeliefSpecification.make({
    fact: ContradictionQaFact.make({
      issue: "Renewal deadline",
      statement: "The renewal notice lists the renewal deadline as 15 July 2027.",
      value: "2027-07-15",
    }),
    identity: {
      evidenceScope: "qa:contradiction:deadline:renewal-notice",
      matterScope: "qa:contract-review",
      orgScope: "1",
      qualifiers: {
        fixture: "contradiction-qa",
        side: "renewal-notice",
      },
      relation: "supports",
      source: {
        entityRef: "qa:contract:renewal-deadline",
        kind: "entity",
      },
      target: {
        observationRef: "qa:observation:deadline:renewal-notice",
        kind: "observation",
      },
    },
    recordedAt: 1_767_225_600_400,
  });

  static readonly capAgreement = BeliefSpecification.make({
    fact: ContradictionQaFact.make({
      issue: "Liability cap",
      statement: "The executed agreement caps aggregate liability at USD 1,000,000.",
      value: "USD 1000000",
    }),
    identity: {
      evidenceScope: "qa:contradiction:liability-cap:executed-agreement",
      matterScope: "qa:contract-review",
      orgScope: "1",
      qualifiers: {
        fixture: "contradiction-qa",
        side: "executed-agreement",
      },
      relation: "supports",
      source: {
        entityRef: "qa:contract:liability-cap",
        kind: "entity",
      },
      target: {
        observationRef: "qa:observation:liability-cap:agreement",
        kind: "observation",
      },
    },
    recordedAt: 1_767_225_601_300,
  });

  static readonly capEmail = BeliefSpecification.make({
    fact: ContradictionQaFact.make({
      issue: "Liability cap",
      statement: "The negotiation email records an agreed liability cap of USD 750,000.",
      value: "USD 750000",
    }),
    identity: {
      evidenceScope: "qa:contradiction:liability-cap:negotiation-email",
      matterScope: "qa:contract-review",
      orgScope: "1",
      qualifiers: {
        fixture: "contradiction-qa",
        side: "negotiation-email",
      },
      relation: "supports",
      source: {
        entityRef: "qa:contract:liability-cap",
        kind: "entity",
      },
      target: {
        observationRef: "qa:observation:liability-cap:email",
        kind: "observation",
      },
    },
    recordedAt: 1_767_225_601_400,
  });
}

const candidateSpecificationFields = {
  confidence: S.Finite,
  detector: S.String,
  leftBelief: EdgeVersion,
  leftEvidence: Evidence,
  proposalFact: ContradictionQaFact,
  proposalRationale: S.String,
  proposalSeed: S.String,
  receiptSeed: S.String,
  recordedAt: S.Finite,
  rightBelief: EdgeVersion,
  rightEvidence: Evidence,
};

const CandidateSpecification = LiteralKit(["left", "right"])
  .toTaggedUnion("proposalLosingBelief")({
    left: candidateSpecificationFields,
    right: candidateSpecificationFields,
  })
  .pipe(
    $I.annoteSchema("CandidateSpecification", {
      description: "Contradiction candidate fixture discriminated on which persisted belief the proposal supersedes.",
    })
  );

type CandidateSpecification = typeof CandidateSpecification.Type;

const evidenceTable = DbSchema.evidence;
const evidenceVerificationTable = DbSchema.evidenceVerification;
const edgeVersionTable = DbSchema.edgeVersion;
const desktopOrganizationId = Shared.OrganizationId.make(1);
const desktopWorkspaceId = WorkspaceIdentity.WorkspaceId.make(1);
const systemPrincipal = SystemPrincipal.make({
  component: "Runtime",
  kind: "System",
});
const schemaVersion = "0.0.0";
const pendingEvidenceId = EpistemicIdentity.EvidenceId.make(1);
const pendingVerificationId = Epistemic.EvidenceVerificationId.make(1);
const verificationPublicIdSuffix = Cuid.decodeUnknownSync("anchor");
const instant = DateTime.makeUnsafe;
const decodeEvidence = S.decodeUnknownEffect(Evidence);
const decodeWorkspaceVaultRootPath = S.decodeUnknownEffect(WorkspaceVaultRootPath);
const decodeSha256HexFromBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const decodeSourceTextDigest = S.decodeUnknownEffect(SourceTextDigest);
const decodeEvidenceIds = S.decodeUnknownEffect(S.NonEmptyArray(EpistemicIdentity.EvidenceId));
const bytesEquivalent = S.toEquivalence(S.Uint8Array);
const evidenceSpanEquivalent = S.toEquivalence(EvidenceSpan);
const sourceBytes = new TextEncoder().encode(CONTRADICTION_QA_SOURCE_TEXT);

const fixtureValidFrom = instant(1_767_225_600_000);

const seedError = (reason: ContradictionQaSeedErrorReason, message: string): ContradictionQaSeedError =>
  ContradictionQaSeedError.new(reason, message);

const storageUnavailable =
  (operation: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ContradictionQaSeedError, R> =>
    effect.pipe(
      Effect.mapError(() =>
        seedError("storage-unavailable", `Contradiction QA seed storage operation failed: ${operation}.`)
      )
    );

const sourceConflict =
  (operation: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ContradictionQaSeedError, R> =>
    effect.pipe(
      Effect.mapError(() => seedError("source-conflict", `Contradiction QA source operation failed: ${operation}.`))
    );

const factMatches = (actual: Readonly<Record<string, unknown>>, expected: ContradictionQaFact): boolean =>
  pipe(
    ContradictionQaFact.decodeOption(actual),
    O.exists((decoded) => ContradictionQaFact.equivalence(decoded, expected))
  );

const factRecord = (fact: ContradictionQaFact): JsonObject => ({
  issue: fact.issue,
  statement: fact.statement,
  value: fact.value,
});

const evidenceMatches = (actual: Evidence, expected: Evidence): boolean =>
  Eq.equals(actual.publicId, expected.publicId) &&
  Eq.equals(actual.orgId, expected.orgId) &&
  Eq.equals(actual.artifactFixtureKey, expected.artifactFixtureKey) &&
  Eq.equals(actual.spanFixtureKey, expected.spanFixtureKey) &&
  evidenceSpanEquivalent(actual.span, expected.span) &&
  Eq.equals(actual.createdAt, expected.createdAt) &&
  Eq.equals(actual.source, expected.source);

const verificationMatches = (actual: EvidenceVerification, expected: EvidenceVerification): boolean =>
  Eq.equals(actual.publicId, expected.publicId) &&
  Eq.equals(actual.orgId, expected.orgId) &&
  Eq.equals(actual.evidenceId, expected.evidenceId) &&
  Eq.equals(actual.manifestationKey, expected.manifestationKey) &&
  S.toEquivalence(EvidenceVerification.fields.verifiedAnchor)(actual.verifiedAnchor, expected.verifiedAnchor);

const edgeMatches = (
  actual: EdgeVersion,
  expectedLogicalKey: EdgeVersion["logicalKey"],
  specification: BeliefSpecification
): boolean =>
  Eq.equals(actual.logicalKey, expectedLogicalKey) &&
  Eq.equals(actual.orgId, desktopOrganizationId) &&
  Eq.equals(actual.version, PosInt.make(1)) &&
  Eq.equals(actual.recordedAt, instant(specification.recordedAt)) &&
  Eq.equals(actual.validFrom, fixtureValidFrom) &&
  O.isNone(actual.validTo) &&
  O.isNone(actual.expiredAt) &&
  factMatches(actual.fact, specification.fact);

const makeEvidence = Effect.fn("ContradictionQaSeed.makeEvidence")(function* (specification: EvidenceSpecification) {
  return yield* decodeEvidence({
    artifactFixtureKey: specification.artifactFixtureKey,
    createdAt: specification.createdAt,
    createdByPrincipal: systemPrincipal,
    entityType: EpistemicIdentity.EvidenceId.entityType,
    id: pendingEvidenceId,
    orgId: desktopOrganizationId,
    publicId: PublicEntityId.fromCuid(EpistemicIdentity.EvidenceId, specification.publicIdSuffix),
    rowVersion: 1,
    schemaVersion,
    source: "System",
    span: specification.span,
    spanFixtureKey: specification.spanFixtureKey,
    updatedAt: specification.createdAt,
    updatedByPrincipal: systemPrincipal,
  }).pipe(Effect.mapError(() => seedError("evidence-conflict", "A contradiction QA evidence fixture is invalid.")));
});

const ensureEvidence = Effect.fn("ContradictionQaSeed.ensureEvidence")(function* (
  specification: EvidenceSpecification
) {
  const db = yield* PostgresDrizzle;
  const expected = yield* makeEvidence(specification);
  const selected = yield* db.select().from(evidenceTable).pipe(storageUnavailable("select evidence"));
  const existing = pipe(
    selected,
    A.map(fromEvidenceRow),
    A.findFirst(
      (row) => Eq.equals(row.publicId, expected.publicId) || Eq.equals(row.spanFixtureKey, expected.spanFixtureKey)
    )
  );

  if (O.isSome(existing)) {
    return evidenceMatches(existing.value, expected)
      ? existing.value
      : yield* seedError(
          "evidence-conflict",
          "A contradiction QA evidence identity is already owned by different persisted content."
        );
  }

  yield* db
    .insert(evidenceTable)
    .values(toEvidenceInsert(expected))
    .onConflictDoNothing({ target: evidenceTable.publicId })
    .pipe(storageUnavailable("insert evidence"));
  const persisted = yield* db.select().from(evidenceTable).pipe(storageUnavailable("reselect evidence"));
  const inserted = pipe(
    persisted,
    A.map(fromEvidenceRow),
    A.findFirst((row) => Eq.equals(row.publicId, expected.publicId))
  );

  if (O.isNone(inserted) || !evidenceMatches(inserted.value, expected)) {
    return yield* seedError(
      "evidence-conflict",
      "The contradiction QA evidence could not be recovered exactly after insertion."
    );
  }
  return inserted.value;
});

const ensureBelief = Effect.fn("ContradictionQaSeed.ensureBelief")(function* (specification: BeliefSpecification) {
  const db = yield* PostgresDrizzle;
  const repository = yield* EdgeAuthorityRepository;
  const identity = yield* S.decodeEffect(LogicalEdgeIdentity)(specification.identity).pipe(
    Effect.mapError(() => seedError("belief-conflict", "A contradiction QA belief identity is invalid."))
  );
  const expectedLogicalKey = logicalEdgeKey(identity);
  const selected = yield* db.select().from(edgeVersionTable).pipe(storageUnavailable("select edge versions"));
  const sameLogicalEdge = pipe(
    selected,
    A.map(fromEdgeVersionRow),
    A.filter((row) => Eq.equals(row.logicalKey, expectedLogicalKey))
  );
  const exact = A.findFirst(sameLogicalEdge, (row) => edgeMatches(row, expectedLogicalKey, specification));

  if (O.isSome(exact)) {
    return exact.value;
  }
  if (A.length(sameLogicalEdge) > 0) {
    return yield* seedError(
      "belief-conflict",
      "A contradiction QA belief identity is already owned by a different edge version."
    );
  }

  return yield* repository
    .record(
      RecordEdgeFact.make({
        fact: factRecord(specification.fact),
        identity,
        orgId: desktopOrganizationId,
        recordedAt: instant(specification.recordedAt),
        recordedBy: systemPrincipal,
        schemaVersion,
        source: "System",
        validFrom: fixtureValidFrom,
        validTo: O.none(),
      })
    )
    .pipe(
      Effect.mapError((error) =>
        P.isTagged("EdgeRepositoryUnavailable")(error)
          ? seedError("storage-unavailable", "The contradiction QA belief repository is unavailable.")
          : seedError(
              "belief-conflict",
              "The contradiction QA belief could not be recorded without changing existing history."
            )
      )
    );
});

const digestText = Effect.fn("ContradictionQaSeed.digestText")(function* (value: string) {
  return yield* decodeSha256HexFromBytes(new TextEncoder().encode(value)).pipe(
    Effect.mapError(() =>
      seedError("storage-unavailable", "A deterministic contradiction QA identity digest could not be computed.")
    )
  );
});

const ensureVerification = Effect.fn("ContradictionQaSeed.ensureVerification")(function* (
  evidence: Evidence,
  verifiedAnchor: EvidenceVerification["verifiedAnchor"]
) {
  const db = yield* PostgresDrizzle;
  const createdAt = instant(1_767_225_600_500);
  const manifestationKey = yield* Effect.fromResult(manifestationKeyFor(evidence.id, verifiedAnchor)).pipe(
    storageUnavailable("encode evidence verification manifestation")
  );
  const expected = EvidenceVerification.make({
    createdAt,
    createdByPrincipal: systemPrincipal,
    entityType: Epistemic.EvidenceVerificationId.entityType,
    evidenceId: evidence.id,
    id: pendingVerificationId,
    manifestationKey,
    orgId: desktopOrganizationId,
    publicId: PublicEntityId.fromCuid(Epistemic.EvidenceVerificationId, verificationPublicIdSuffix),
    rowVersion: PosInt.make(1),
    schemaVersion,
    source: "System",
    updatedAt: createdAt,
    updatedByPrincipal: systemPrincipal,
    verifiedAnchor,
  });
  const selected = yield* db
    .select()
    .from(evidenceVerificationTable)
    .pipe(storageUnavailable("select evidence verification"));
  const decodedSelected = yield* Effect.forEach(
    selected,
    (row) => Effect.fromResult(fromEvidenceVerificationRow(row)),
    { concurrency: 1 }
  ).pipe(storageUnavailable("decode selected evidence verification"));
  const existing = pipe(
    decodedSelected,
    A.findFirst(
      (row) => Eq.equals(row.publicId, expected.publicId) || Eq.equals(row.manifestationKey, expected.manifestationKey)
    )
  );

  if (O.isSome(existing)) {
    if (!verificationMatches(existing.value, expected)) {
      return yield* seedError(
        "verification-conflict",
        "A contradiction QA verification identity is already owned by different persisted content."
      );
    }
    return;
  }

  const insert = yield* Effect.fromResult(toEvidenceVerificationInsert(expected, evidence)).pipe(
    storageUnavailable("encode evidence verification insert")
  );
  yield* db
    .insert(evidenceVerificationTable)
    .values(insert)
    .onConflictDoNothing()
    .pipe(storageUnavailable("insert evidence verification"));
  const persisted = yield* db
    .select()
    .from(evidenceVerificationTable)
    .pipe(storageUnavailable("reselect evidence verification"));
  const decodedPersisted = yield* Effect.forEach(
    persisted,
    (row) => Effect.fromResult(fromEvidenceVerificationRow(row)),
    { concurrency: 1 }
  ).pipe(storageUnavailable("decode reselected evidence verification"));
  const inserted = pipe(
    decodedPersisted,
    A.findFirst((row) => Eq.equals(row.manifestationKey, expected.manifestationKey))
  );
  if (O.isNone(inserted) || !verificationMatches(inserted.value, expected)) {
    return yield* seedError(
      "verification-conflict",
      "The contradiction QA evidence verification could not be recovered exactly after insertion."
    );
  }
});

const submitCandidate = Effect.fn("ContradictionQaSeed.submitCandidate")(function* (
  specification: CandidateSpecification
) {
  const repository = yield* ContradictionTriageRepository;
  const left = BeliefVersionRef.make({
    edgeVersionId: specification.leftBelief.id,
    logicalKey: specification.leftBelief.logicalKey,
    version: specification.leftBelief.version,
  });
  const right = BeliefVersionRef.make({
    edgeVersionId: specification.rightBelief.id,
    logicalKey: specification.rightBelief.logicalKey,
    version: specification.rightBelief.version,
  });
  const pair = ContradictionBeliefPair.make({ left, right });
  const leftEvidenceIds = yield* decodeEvidenceIds([specification.leftEvidence.id]).pipe(
    Effect.mapError(() => seedError("candidate-conflict", "The contradiction QA left evidence identity is invalid."))
  );
  const rightEvidenceIds = yield* decodeEvidenceIds([specification.rightEvidence.id]).pipe(
    Effect.mapError(() => seedError("candidate-conflict", "The contradiction QA right evidence identity is invalid."))
  );
  const matchBasis = ContradictionMatchBasis.make({
    detector: specification.detector,
    detectorVersion: schemaVersion,
    evidenceDigest: contradictionEvidenceDigest(leftEvidenceIds, rightEvidenceIds),
    kind: "independent-evidence",
    leftEvidenceIds,
    rightEvidenceIds,
  });
  const losingBelief = CandidateSpecification.match(specification, {
    left: () => left,
    right: () => right,
  });
  const proposalId = ContradictionProposalId.make(yield* digestText(specification.proposalSeed));
  const proposalContent = {
    fact: factRecord(specification.proposalFact),
    losingBelief,
    proposalId,
    rationale: specification.proposalRationale,
    validFrom: fixtureValidFrom,
    validTo: O.none<DateTime.Utc>(),
  };
  const proposalDigest = yield* Effect.fromResult(contradictionProposalDigest(proposalContent)).pipe(
    Effect.mapError(() => seedError("candidate-conflict", "The contradiction QA proposal digest could not be encoded."))
  );
  const proposal = ContradictionResolutionProposal.make({
    ...proposalContent,
    proposalDigest,
  });

  yield* repository
    .submit(
      SubmitContradictionCandidate.make({
        assessment: ContradictionAssessment.make({
          confidence: Confidence.make(specification.confidence),
          proposals: [proposal],
        }),
        matchBasis,
        orgId: desktopOrganizationId,
        pair,
        receiptKey: ContradictionReceiptKey.make(yield* digestText(specification.receiptSeed)),
        recordedAt: instant(specification.recordedAt),
        receivedBy: systemPrincipal,
        schemaVersion,
        source: "System",
        validFrom: fixtureValidFrom,
        validTo: O.none(),
      })
    )
    .pipe(
      Effect.mapError((error) =>
        P.isTagged("ContradictionRepositoryUnavailable")(error)
          ? seedError("storage-unavailable", "The contradiction QA candidate repository is unavailable.")
          : seedError(
              "candidate-conflict",
              "A contradiction QA candidate identity is already owned by different persisted content."
            )
      )
    );
});

const prepareCanonicalSource = Effect.fn("ContradictionQaSeed.prepareCanonicalSource")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const configuredRoot = yield* Config.string(CONTRADICTION_QA_VAULT_ROOT_ENV);
  const decodedRoot = yield* decodeWorkspaceVaultRootPath(configuredRoot).pipe(
    Effect.mapError(() =>
      seedError("vault-root-conflict", "The contradiction QA vault root must be an absolute filesystem path.")
    )
  );
  yield* fs.makeDirectory(decodedRoot, { recursive: true }).pipe(sourceConflict("create QA vault root"));
  const canonicalRoot = yield* fs.realPath(decodedRoot).pipe(sourceConflict("canonicalize QA vault root"));
  const canonicalVaultRoot = yield* decodeWorkspaceVaultRootPath(canonicalRoot).pipe(
    Effect.mapError(() => seedError("vault-root-conflict", "The canonical contradiction QA vault root is invalid."))
  );
  const vaultStore = yield* Workspace.WorkspaceVaultStore;
  const vaultConfig = yield* vaultStore
    .getVaultConfig(desktopWorkspaceId)
    .pipe(storageUnavailable("read workspace vault configuration"));

  if (O.isSome(vaultConfig.vaultRootPath)) {
    const configuredCanonicalRoot = yield* fs
      .realPath(vaultConfig.vaultRootPath.value)
      .pipe(
        Effect.mapError(() => seedError("vault-root-conflict", "The existing workspace vault root is unavailable."))
      );
    if (!Eq.equals(configuredCanonicalRoot, canonicalRoot)) {
      return yield* seedError(
        "vault-root-conflict",
        "Workspace 1 already has a different vault root; the QA seed refused to replace it."
      );
    }
  }

  let target = yield* resolvePathWithinCanonicalRoot({
    canonicalRoot,
    candidate: CONTRADICTION_QA_SOURCE_LOCATOR,
  }).pipe(sourceConflict("resolve canonical QA source"));
  const exists = yield* fs.exists(target).pipe(sourceConflict("inspect canonical QA source"));
  if (exists) {
    const existingBytes = yield* fs.readFile(target).pipe(sourceConflict("read canonical QA source"));
    if (!bytesEquivalent(existingBytes, sourceBytes)) {
      return yield* seedError(
        "source-conflict",
        "The contradiction QA source path already contains different bytes and was not overwritten."
      );
    }
  } else {
    yield* fs
      .makeDirectory(path.dirname(target), { recursive: true })
      .pipe(sourceConflict("create canonical QA source directory"));
    target = yield* resolvePathWithinCanonicalRoot({
      canonicalRoot,
      candidate: CONTRADICTION_QA_SOURCE_LOCATOR,
    }).pipe(sourceConflict("recheck canonical QA source"));
    yield* fs
      .writeFile(target, sourceBytes, { flag: "wx", mode: 0o600 })
      .pipe(sourceConflict("write canonical QA source"));
  }

  if (O.isNone(vaultConfig.vaultRootPath)) {
    yield* vaultStore
      .setVaultRoot(
        Workspace.SetWorkspaceVaultInput.make({
          vaultRootPath: canonicalVaultRoot,
          workspaceId: desktopWorkspaceId,
        })
      )
      .pipe(
        Effect.mapError(() =>
          seedError("vault-root-conflict", "Workspace 1 could not adopt the isolated contradiction QA vault root.")
        )
      );
  }

  const digest = yield* decodeSha256HexFromBytes(sourceBytes).pipe(
    Effect.mapError(() => seedError("source-conflict", "The contradiction QA source digest could not be computed."))
  );
  const sourceDigest = yield* decodeSourceTextDigest(`sha256:${digest}`).pipe(
    Effect.mapError(() => seedError("source-conflict", "The contradiction QA source digest was invalid."))
  );
  const source = SourceTextIdentity.make({
    extractor: SourceTextExtractor.make({
      name: UTF8_SOURCE_TEXT_EXTRACTOR_NAME,
      version: UTF8_SOURCE_TEXT_EXTRACTOR_VERSION,
    }),
    locator: CONTRADICTION_QA_SOURCE_LOCATOR,
    normalizationVersion: "1",
    scopeRef: `workspace:${desktopWorkspaceId}`,
    sourceDigest,
    sourceRef: "qa:contradiction:surrogate-boundary-source",
    textDigest: sourceDigest,
  });
  const anchor = TextAnchor.make({
    endChar: NonNegativeInt.make(CONTRADICTION_QA_ANCHOR_START + Str.length(CONTRADICTION_QA_ANCHOR_QUOTE)),
    quote: CONTRADICTION_QA_ANCHOR_QUOTE,
    startChar: CONTRADICTION_QA_ANCHOR_START,
  });

  return yield* verifyTextAnchor(
    VerifyTextAnchorInput.make({
      anchor,
      expectedSource: source,
      source,
      sourceText: CONTRADICTION_QA_SOURCE_TEXT,
    })
  ).pipe(
    Effect.mapError(() =>
      seedError("source-conflict", "The contradiction QA source anchor could not be verified exactly.")
    )
  );
});

/**
 * Seed deterministic contradiction browser-QA fixtures when explicitly enabled.
 *
 * **Details**
 *
 * Disabled execution reads only the opt-in flag. Enabled execution refuses to
 * replace a configured vault root, source file, evidence row, verification, edge
 * history, candidate, or receipt whose deterministic identity already belongs to
 * different content.
 *
 * **Example** (Confirm seed returns Effect)
 *
 * ```ts
 * import { seedContradictionQaFixtures } from "@/contradiction/ContradictionQaSeed"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(seedContradictionQaFixtures()))
 * ```
 *
 * @effects When enabled, writes one isolated source file and inserts only absent
 * deterministic workspace, evidence, verification, edge, candidate, and receipt
 * records.
 * @category workflows
 * @since 0.0.0
 */
export const seedContradictionQaFixtures = Effect.fn("ContradictionQaSeed.seed")(function* () {
  const enabled = yield* Config.option(Config.string(CONTRADICTION_QA_SEED_ENV));
  if (!O.contains(enabled, "1")) {
    return;
  }

  const verifiedAnchor = yield* prepareCanonicalSource();
  const [verifiedDeadlineEvidence, unverifiedDeadlineEvidence, agreementCapEvidence, emailCapEvidence] =
    yield* Effect.all(
      [
        ensureEvidence(EvidenceSpecification.deadlineVerified),
        ensureEvidence(EvidenceSpecification.deadlineUnverified),
        ensureEvidence(EvidenceSpecification.capAgreement),
        ensureEvidence(EvidenceSpecification.capEmail),
      ],
      { concurrency: 1 }
    );
  yield* ensureVerification(verifiedDeadlineEvidence, toTextAnchorVerificationReceipt(verifiedAnchor));

  const [deadlineAmendment, deadlineNotice, capAgreement, capEmail] = yield* Effect.all(
    [
      ensureBelief(BeliefSpecification.deadlineAmendment),
      ensureBelief(BeliefSpecification.deadlineNotice),
      ensureBelief(BeliefSpecification.capAgreement),
      ensureBelief(BeliefSpecification.capEmail),
    ],
    { concurrency: 1 }
  );

  yield* Effect.all(
    [
      submitCandidate(
        CandidateSpecification.cases.right.make({
          confidence: 0.98,
          detector: "professional-desktop.qa.deadline-conflict",
          leftBelief: deadlineAmendment,
          leftEvidence: verifiedDeadlineEvidence,
          proposalFact: ContradictionQaFact.make({
            issue: "Renewal deadline",
            statement: "The executed amendment controls and the renewal deadline is 30 June 2027.",
            value: "2027-06-30",
          }),
          proposalRationale: "The executed amendment post-dates and controls over the generated renewal notice.",
          proposalSeed: "professional-desktop.qa.deadline.proposal",
          receiptSeed: "professional-desktop.qa.deadline.receipt",
          recordedAt: 1_767_225_600_700,
          rightBelief: deadlineNotice,
          rightEvidence: unverifiedDeadlineEvidence,
        })
      ),
      submitCandidate(
        CandidateSpecification.cases.right.make({
          confidence: 0.94,
          detector: "professional-desktop.qa.liability-cap-conflict",
          leftBelief: capAgreement,
          leftEvidence: agreementCapEvidence,
          proposalFact: ContradictionQaFact.make({
            issue: "Liability cap",
            statement: "The executed agreement controls and caps aggregate liability at USD 1,000,000.",
            value: "USD 1000000",
          }),
          proposalRationale:
            "The executed agreement is the authoritative final instrument; the negotiation email is superseded.",
          proposalSeed: "professional-desktop.qa.liability-cap.proposal",
          receiptSeed: "professional-desktop.qa.liability-cap.receipt",
          recordedAt: 1_767_225_601_700,
          rightBelief: capEmail,
          rightEvidence: emailCapEvidence,
        })
      ),
    ],
    { concurrency: 1, discard: true }
  );

  yield* Effect.logInfo("contradiction browser-QA fixtures seeded").pipe(
    Effect.annotateLogs({
      component: "professional-desktop",
      candidates: 2,
      verifiedEvidence: 1,
    })
  );
});

/**
 * Boot-time contradiction browser-QA seed.
 *
 * **Details**
 *
 * Repository services come from the published slice Layers composed by the
 * desktop runtime. An enabled failure is promoted to a defect so browser QA
 * cannot continue against an empty or partially conflicting fixture database.
 *
 * **Example** (Confirm seed is Layer)
 *
 * ```ts
 * import { ContradictionQaSeedLive } from "@/contradiction/ContradictionQaSeed"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(ContradictionQaSeedLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ContradictionQaSeedLive: Layer.Layer<
  never,
  never,
  | ContradictionTriageRepository
  | Crypto.Crypto
  | EdgeAuthorityRepository
  | FileSystem.FileSystem
  | Path.Path
  | PostgresDrizzle
  | Workspace.WorkspaceVaultStore
> = Layer.effectDiscard(
  seedContradictionQaFixtures().pipe(
    Effect.tapError((error) =>
      Effect.logError("contradiction browser-QA seed failed").pipe(
        Effect.annotateLogs({
          component: "professional-desktop",
          reason: ContradictionQaSeedError.is(error) ? error.reason : "configuration",
        })
      )
    ),
    Effect.orDie
  )
);
