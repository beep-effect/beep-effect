/**
 * The knowledge doctor's sealed baseline: the baseline, promotions, and identity-sidecar schemas,
 * durable baseline keys, the mint that cannot launder, the seal guard, and the introduced-only ratchet
 * of the gating check.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Jsonc } from "@beep/jsonc/Jsonc";
import { LiteralKit } from "@beep/schema";
import { Str } from "@beep/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import {
  KNOWLEDGE_DOCTOR_BASELINE_PENDING_MESSAGE,
  KnowledgeDoctorGateError,
  KnowledgeDoctorInputError,
  KnowledgeMintRefusal,
  KnowledgeOperationalError,
  KnowledgeSealBroken,
} from "./Knowledge.errors.ts";
import {
  decodeKnowledgeUtf8,
  KnowledgeCommitSha,
  knowledgeLengthPrefix,
  knowledgeSha256Hex,
} from "./Knowledge.refs.ts";
import { KnowledgeFindingCandidate, KnowledgeFindingKind, KnowledgeFindingLocation } from "./Knowledge.schemas.ts";
import { knowledgeFindingsFromCandidates } from "./Knowledge.service.ts";
import { knowledgeDoctorDocumentId } from "./KnowledgeDoctor.evaluators.ts";
import { groupKnowledgeDoctorFindings } from "./KnowledgeDoctor.grouping.ts";
import {
  evaluateKnowledgeLeases,
  isKnowledgeLeaseEffective,
  KNOWLEDGE_CODEOWNERS_PATH,
  KNOWLEDGE_DOCTOR_LEASES_PATH,
  KnowledgeDebtLeases,
  KnowledgeLeaseEvaluationInput,
  resolveKnowledgeCodeowners,
} from "./KnowledgeDoctor.leases.ts";
import {
  KnowledgeBaselineKey,
  KnowledgeDoctorFinding,
  KnowledgeDoctorRatchet,
  KnowledgeDoctorReport,
  KnowledgePathRemoval,
  KnowledgeRatchetEntry,
  KnowledgeSpanClass,
} from "./KnowledgeDoctor.schemas.ts";
import type { KnowledgeDoctorInputReason } from "./Knowledge.errors.ts";
import type { KnowledgeTreeOracle } from "./Knowledge.refs.ts";
import type { KnowledgeDebtLease, KnowledgeLeaseRow } from "./KnowledgeDoctor.leases.ts";

const $I = $RepoCliId.create("commands/Knowledge/KnowledgeDoctor.baseline");

const nfc = Str.normalize("NFC");
const textEncoder = new TextEncoder();

/**
 * Repository path of the sealed baseline, next to the goals-doctor baseline.
 *
 * **Example** (Read the baseline path)
 *
 * ```ts
 * import { KNOWLEDGE_DOCTOR_BASELINE_PATH } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KNOWLEDGE_DOCTOR_BASELINE_PATH) // "goals/knowledge-doctor.baseline.jsonc"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_DOCTOR_BASELINE_PATH = "goals/knowledge-doctor.baseline.jsonc";

/**
 * Repository path of the append-only promotions file (K11, K12).
 *
 * **Example** (Read the promotions path)
 *
 * ```ts
 * import { KNOWLEDGE_DOCTOR_PROMOTIONS_PATH } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KNOWLEDGE_DOCTOR_PROMOTIONS_PATH) // "goals/knowledge-doctor.promotions.jsonc"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_DOCTOR_PROMOTIONS_PATH = "goals/knowledge-doctor.promotions.jsonc";

/**
 * Repository path of the durable-identity sidecar (C6 tier 3).
 *
 * **Example** (Read the sidecar path)
 *
 * ```ts
 * import { KNOWLEDGE_DOCTOR_IDENTITY_PATH } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KNOWLEDGE_DOCTOR_IDENTITY_PATH) // "goals/knowledge-doctor.identity.jsonc"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_DOCTOR_IDENTITY_PATH = "goals/knowledge-doctor.identity.jsonc";

/**
 * The note every minted baseline carries; editing it on a branch is `baseline-tamper`.
 *
 * **Example** (The note names the only writer)
 *
 * ```ts
 * import { KNOWLEDGE_DOCTOR_BASELINE_NOTE } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KNOWLEDGE_DOCTOR_BASELINE_NOTE.includes("CI mint")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_DOCTOR_BASELINE_NOTE =
  "Sealed knowledge-doctor baseline. Only the CI mint writes it, and a re-mint at mintedAt reproduces it byte for byte. A branch may only delete entries; any other edit is baseline-tamper.";

const KEY_VERSION = "knowledge-doctor-key/v1";
const KEY_PREFIX = "knowledge-doctor/v1:";

/**
 * Named groups of the sealed baseline, so inherited debt reads by its cause rather than as one pile.
 *
 * **Details**
 *
 * The mint assigns exactly one group per entry, in this order:
 * `skill-provenance` (skill lock, source, and license kinds), `packet-claim-drift`,
 * `historical-claim` (historical citation kinds), `prohibition-of-retired-surface` (the line names a
 * surface as retired, removed, deprecated, or not to be imported, the bulk fallback the C PR 2b risk-1
 * ruling reserved), `deleted-target-rot` (the target's path, or the directory of the named package,
 * was deleted or renamed away in the minted commit's history), and `unresolved-reference` for every
 * other missing target.
 *
 * **Example** (Recognize the rot group)
 *
 * ```ts
 * import { KnowledgeBaselineGroup } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KnowledgeBaselineGroup.is["deleted-target-rot"]("deleted-target-rot")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeBaselineGroup = LiteralKit([
  "skill-provenance",
  "packet-claim-drift",
  "historical-claim",
  "prohibition-of-retired-surface",
  "deleted-target-rot",
  "unresolved-reference",
]).pipe(
  $I.annoteSchema("KnowledgeBaselineGroup", {
    description: "Named cause group of one sealed knowledge-doctor baseline entry.",
  })
);

/**
 * Named groups of the sealed baseline.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeBaselineGroup = typeof KnowledgeBaselineGroup.Type;

/**
 * The span classes a sealed entry may carry: every class except `unclassified` (contract 4).
 *
 * **Example** (Unclassified spans are not sealable)
 *
 * ```ts
 * import { KnowledgeSealableSpanClass } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KnowledgeSealableSpanClass.literals.includes("verified")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeSealableSpanClass = KnowledgeSpanClass.pick([
  "verified",
  "generated-example",
  "historical-with-commit",
]).pipe(
  $I.annoteSchema("KnowledgeSealableSpanClass", {
    description: "Span classes a sealed baseline entry may carry; unclassified spans are never sealed.",
  })
);

/**
 * The span classes a sealed entry may carry.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeSealableSpanClass = typeof KnowledgeSealableSpanClass.Type;

/**
 * One sealed baseline entry: an inherited finding's key and the fields that describe it.
 *
 * **Details**
 *
 * `document` is the document's path at `mintedAt` and `owners` its CODEOWNERS owners there. A
 * branch may delete an entry; changing any field is a relabel, which is `baseline-tamper`.
 *
 * **Example** (Describe a rot entry)
 *
 * ```ts
 * import { KnowledgeBaselineEntry } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * const entry = KnowledgeBaselineEntry.make({
 *   key: `knowledge-doctor/v1:${"a".repeat(64)}`,
 *   group: "deleted-target-rot",
 *   kind: "broken-tracked-path",
 *   document: "docs/README.md",
 *   subject: "repo-path:docs/old.md",
 *   spanClass: "verified",
 *   owners: ["@kriegcloud"],
 * })
 *
 * console.log(entry.group) // "deleted-target-rot"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeBaselineEntry extends S.Opaque<KnowledgeBaselineEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    key: KnowledgeBaselineKey,
    group: KnowledgeBaselineGroup,
    kind: KnowledgeFindingKind,
    document: S.String,
    subject: S.String,
    spanClass: KnowledgeSealableSpanClass,
    owners: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeBaselineEntry", {
      description: "One sealed inherited knowledge-doctor finding: key, named group, kind, document, subject, owners.",
    })
  )
) {}

/**
 * The sealed baseline file `goals/knowledge-doctor.baseline.jsonc`.
 *
 * **Details**
 *
 * Entries are sorted by key. `mintedAt` is the default-branch commit the CI mint scanned; re-minting
 * there reproduces the file byte for byte (contract 8).
 *
 * **Example** (An empty first seal)
 *
 * ```ts
 * import {
 *   KNOWLEDGE_DOCTOR_BASELINE_NOTE,
 *   KnowledgeDoctorBaseline,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * const baseline = KnowledgeDoctorBaseline.make({
 *   mintedAt: "1111111111111111111111111111111111111111",
 *   note: KNOWLEDGE_DOCTOR_BASELINE_NOTE,
 *   entries: [],
 * })
 *
 * console.log(baseline.schemaVersion) // "knowledge-doctor-baseline/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorBaseline extends S.Opaque<KnowledgeDoctorBaseline, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("knowledge-doctor-baseline/v1"),
    mintedAt: KnowledgeCommitSha,
    note: S.String,
    entries: S.Array(KnowledgeBaselineEntry),
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorBaseline", {
      description: "Sealed knowledge-doctor baseline minted by CI at one default-branch commit.",
    })
  )
) {}

/**
 * One promotion: a finding kind leaving its report-only window (C7).
 *
 * **Example** (Promote the paths form)
 *
 * ```ts
 * import { KnowledgeDoctorPromotion } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * const row = KnowledgeDoctorPromotion.make({
 *   kind: "broken-tracked-path",
 *   promotedAt: "1111111111111111111111111111111111111111",
 *   windowEvidence: "goals/knowledge-surface-automation/research/c7-window-paths.md",
 * })
 *
 * console.log(row.kind) // "broken-tracked-path"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorPromotion extends S.Opaque<KnowledgeDoctorPromotion, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: KnowledgeFindingKind,
    promotedAt: KnowledgeCommitSha,
    windowEvidence: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorPromotion", {
      description: "A finding kind promoted from report-only to blocking, with its C7 window evidence.",
    })
  )
) {}

/**
 * The append-only promotions file `goals/knowledge-doctor.promotions.jsonc`.
 *
 * **Example** (No promotions yet)
 *
 * ```ts
 * import { KnowledgeDoctorPromotions } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KnowledgeDoctorPromotions.make({ promotions: [] }).schemaVersion) // "knowledge-doctor-promotions/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorPromotions extends S.Opaque<KnowledgeDoctorPromotions, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("knowledge-doctor-promotions/v1"),
    promotions: S.Array(KnowledgeDoctorPromotion),
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorPromotions", {
      description: "Append-only, human-reviewed list of promoted knowledge-doctor finding kinds.",
    })
  )
) {}

/**
 * One identity-sidecar mapping: a document lineage lost, from its path at `mintedAt` to its path now.
 *
 * **Example** (Map a multi-hop move)
 *
 * ```ts
 * import { KnowledgeIdentityMapping } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KnowledgeIdentityMapping.make({ from: "docs/a.md", to: "docs/b/a.md" }).to) // "docs/b/a.md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeIdentityMapping extends S.Opaque<KnowledgeIdentityMapping, { readonly brand: unique symbol }>()(
  S.Struct({
    from: S.String,
    to: S.String,
  }).pipe(
    $I.annoteSchema("KnowledgeIdentityMapping", {
      description: "A document path at mintedAt and the path it has now, for moves git lineage loses.",
    })
  )
) {}

/**
 * The identity sidecar `goals/knowledge-doctor.identity.jsonc` (C6 tier 3).
 *
 * **Example** (An empty sidecar)
 *
 * ```ts
 * import { KnowledgeDoctorIdentity } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KnowledgeDoctorIdentity.make({ mappings: [] }).schemaVersion) // "knowledge-doctor-identity/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorIdentity extends S.Opaque<KnowledgeDoctorIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("knowledge-doctor-identity/v1"),
    mappings: S.Array(KnowledgeIdentityMapping),
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorIdentity", {
      description: "Durable-identity sidecar mappings for documents rename lineage provably loses.",
    })
  )
) {}

/* -------------------------------------------------------------------------------------------------
 * Seal files
 * ---------------------------------------------------------------------------------------------- */

/**
 * The seal inputs read from one tree; each is `O.none()` when the tree does not track it.
 *
 * **Details**
 *
 * `baselineText` is the baseline file's exact text, kept for the byte comparison with a re-mint;
 * `codeowners` is the tree's `.github/CODEOWNERS` text.
 *
 * **Example** (A tree without seal files)
 *
 * ```ts
 * import { KnowledgeSealFiles } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import * as O from "effect/Option"
 *
 * const files = KnowledgeSealFiles.make({
 *   baseline: O.none(),
 *   baselineText: O.none(),
 *   codeowners: O.none(),
 *   identity: O.none(),
 *   leases: O.none(),
 *   promotions: O.none(),
 * })
 *
 * console.log(O.isNone(files.baseline)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSealFiles extends S.Opaque<KnowledgeSealFiles, { readonly brand: unique symbol }>()(
  S.Struct({
    baseline: S.Option(KnowledgeDoctorBaseline),
    baselineText: S.Option(S.String),
    codeowners: S.Option(S.String),
    identity: S.Option(KnowledgeDoctorIdentity),
    leases: S.Option(KnowledgeDebtLeases),
    promotions: S.Option(KnowledgeDoctorPromotions),
  }).pipe(
    $I.annoteSchema("KnowledgeSealFiles", {
      description: "The baseline, promotions, leases, identity sidecar, and CODEOWNERS read from one tree.",
    })
  )
) {}

const readTrackedText = Effect.fn("KnowledgeDoctor.readTrackedText")(function* (
  tree: KnowledgeTreeOracle,
  repoPath: string
) {
  if (!A.some(tree.trackedEntries, (entry) => entry.path === repoPath)) {
    return O.none<string>();
  }
  const bytes = yield* tree.readBytes(repoPath);
  return yield* decodeKnowledgeUtf8(bytes, repoPath).pipe(
    Effect.mapError(() =>
      KnowledgeDoctorInputError.of("malformed-utf8", repoPath, `${repoPath} at ${tree.commit} is not valid UTF-8.`)
    ),
    Effect.asSome
  );
});

// Decodes the JSONC text of one seal file, failing with the file's typed input error.
const decodeKnowledgeSealText = <Schema extends S.Top & { readonly DecodingServices: never }>(
  schema: Schema,
  reason: KnowledgeDoctorInputReason,
  repoPath: string,
  text: string
): Effect.Effect<Schema["Type"], KnowledgeDoctorInputError> =>
  Jsonc.bind(schema)
    .decode(text)
    .pipe(
      Effect.mapError((error) =>
        KnowledgeDoctorInputError.of(reason, repoPath, `${repoPath} does not decode: ${error.message}`)
      )
    );

const readSealFile = <Schema extends S.Top & { readonly DecodingServices: never }>(
  tree: KnowledgeTreeOracle,
  repoPath: string,
  schema: Schema,
  reason: KnowledgeDoctorInputReason
) =>
  Effect.flatMap(readTrackedText(tree, repoPath), (text) =>
    O.match(text, {
      onNone: () => Effect.succeedNone,
      onSome: (value) => Effect.asSome(decodeKnowledgeSealText(schema, reason, repoPath, value)),
    })
  );

/**
 * Reads and decodes every seal input of one tree: baseline, promotions, leases, identity sidecar, and
 * CODEOWNERS.
 *
 * **Details**
 *
 * Reads only tracked bytes of the given tree. A tracked file that is not UTF-8 fails with
 * `malformed-utf8`, and one that does not decode with its file's `undecodable-*` reason; an untracked
 * file is `O.none()`.
 *
 * **Example** (Read an empty tree)
 *
 * ```ts
 * import { readKnowledgeSealFiles } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { makeKnowledgeDoctorMemoryTree } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readKnowledgeSealFiles(makeKnowledgeDoctorMemoryTree({ files: {} })))) // true
 * ```
 *
 * @param tree - The tree to read.
 * @returns The decoded seal inputs.
 * @category use-cases
 * @since 0.0.0
 */
export const readKnowledgeSealFiles = Effect.fn("KnowledgeDoctor.readSealFiles")(function* (tree: KnowledgeTreeOracle) {
  const baselineText = yield* readTrackedText(tree, KNOWLEDGE_DOCTOR_BASELINE_PATH);
  const baseline = yield* O.match(baselineText, {
    onNone: () => Effect.succeedNone,
    onSome: (text) =>
      Effect.asSome(
        decodeKnowledgeSealText(KnowledgeDoctorBaseline, "undecodable-baseline", KNOWLEDGE_DOCTOR_BASELINE_PATH, text)
      ),
  });
  return KnowledgeSealFiles.make({
    baseline,
    baselineText,
    promotions: yield* readSealFile(
      tree,
      KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
      KnowledgeDoctorPromotions,
      "undecodable-promotions"
    ),
    leases: yield* readSealFile(tree, KNOWLEDGE_DOCTOR_LEASES_PATH, KnowledgeDebtLeases, "undecodable-leases"),
    identity: yield* readSealFile(
      tree,
      KNOWLEDGE_DOCTOR_IDENTITY_PATH,
      KnowledgeDoctorIdentity,
      "undecodable-identity"
    ),
    codeowners: yield* readTrackedText(tree, KNOWLEDGE_CODEOWNERS_PATH),
  });
});

/* -------------------------------------------------------------------------------------------------
 * Keys and durable identity
 * ---------------------------------------------------------------------------------------------- */

const decodeBaselineKey = S.decodeUnknownEffect(KnowledgeBaselineKey);

/**
 * Computes the durable baseline key of one finding from its length-prefixed preimage.
 *
 * **Details**
 *
 * The preimage is the key version, kind, durable document id, NFC subject, and occurrence, each
 * byte-length prefixed, so no two field splits collide. The Stage-1 `findingId` is unchanged; the key
 * is a separate digest over the durable identity (K10).
 *
 * **Example** (Keys are effectful digests)
 *
 * ```ts
 * import { makeKnowledgeBaselineKey } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeKnowledgeBaselineKey("broken-tracked-path", "tree:docs/a.md", "repo-path:x", 0))) // true
 * ```
 *
 * @param kind - The finding kind.
 * @param durableDocumentId - The document id under its path at `mintedAt`.
 * @param subject - The finding subject.
 * @param occurrence - Zero-based index among identical kind, document, and subject triples.
 * @returns The `knowledge-doctor/v1:<sha256>` key.
 * @category identifiers
 * @since 0.0.0
 */
export const makeKnowledgeBaselineKey = Effect.fn("KnowledgeDoctor.makeBaselineKey")(function* (
  kind: KnowledgeFindingKind,
  durableDocumentId: string,
  subject: string,
  occurrence: number
) {
  const preimage = A.join(
    A.map([KEY_VERSION, kind, nfc(durableDocumentId), nfc(subject), `${occurrence}`], knowledgeLengthPrefix),
    ""
  );
  const digest = yield* knowledgeSha256Hex(
    textEncoder.encode(preimage),
    "Failed to compute a knowledge-doctor baseline key."
  );
  return yield* decodeBaselineKey(`${KEY_PREFIX}${digest}`).pipe(
    KnowledgeOperationalError.mapError("Computed knowledge-doctor baseline key failed schema validation.")
  );
});

const TREE_DOCUMENT_PREFIX = "tree:";

/**
 * The repository path a doctor finding's document has in the scanned tree.
 *
 * **Example** (Read the document path)
 *
 * ```ts
 * import { KnowledgeFinding, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { knowledgeFindingDocumentPath } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { KnowledgeDoctorFinding } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const row = KnowledgeDoctorFinding.make({
 *   finding: KnowledgeFinding.make({
 *     findingId: `knowledge-finding/v1:${"1".repeat(64)}`,
 *     kind: "broken-tracked-path",
 *     severity: "blocking",
 *     documentId: "tree:docs/README.md",
 *     subject: "repo-path:docs/old.md",
 *     occurrence: 0,
 *     location: KnowledgeFindingLocation.make({ path: "docs/README.md" }),
 *     message: "Tracked path does not exist: docs/old.md.",
 *     remediation: "Update the inline path.",
 *   }),
 *   spanClass: "verified",
 *   origin: "owned",
 *   evaluator: O.some("paths"),
 *   causeKey: "path:docs/old.md",
 * })
 *
 * console.log(knowledgeFindingDocumentPath(row)) // "docs/README.md"
 * ```
 *
 * @param row - One doctor finding.
 * @returns The `tree:` document id's path, or the location path for any other document id.
 * @category utilities
 * @since 0.0.0
 */
export const knowledgeFindingDocumentPath = (row: KnowledgeDoctorFinding): string =>
  Str.startsWith(TREE_DOCUMENT_PREFIX)(row.finding.documentId)
    ? Str.slice(TREE_DOCUMENT_PREFIX.length)(row.finding.documentId)
    : row.finding.location.path;

const GOVERNANCE_KINDS = HashSet.make<ReadonlyArray<KnowledgeFindingKind>>(
  "baseline-tamper",
  "lease-expired",
  "lease-owner-unresolved",
  "lease-issued-in-future",
  "lease-lifetime-exceeded",
  "lease-quota-exceeded"
);

/**
 * Whether a finding kind is a governance kind: a seal or lease finding, never baselined or leased.
 *
 * **Example** (Tamper is governance)
 *
 * ```ts
 * import { isKnowledgeGovernanceKind } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(isKnowledgeGovernanceKind("baseline-tamper")) // true
 * ```
 *
 * @param kind - A finding kind.
 * @returns `true` for `baseline-tamper` and the lease kinds.
 * @category predicates
 * @since 0.0.0
 */
export const isKnowledgeGovernanceKind = (kind: KnowledgeFindingKind): boolean => HashSet.has(GOVERNANCE_KINDS, kind);

/**
 * Whether a finding may enter the sealed baseline or carry a lease.
 *
 * **Details**
 *
 * Only owned, blocking findings outside the `unclassified` class and the governance kinds are
 * baselineable; delegated findings keep their domain gate (K4) and unclassified spans their Stage-1
 * delta (K9).
 *
 * **Example** (A delegated finding is not baselineable)
 *
 * ```ts
 * import { KnowledgeFinding, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { isKnowledgeBaselineable } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { KnowledgeDoctorFinding } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const row = KnowledgeDoctorFinding.make({
 *   finding: KnowledgeFinding.make({
 *     findingId: `knowledge-finding/v1:${"1".repeat(64)}`,
 *     kind: "delegated-goals-doctor-finding",
 *     severity: "blocking",
 *     documentId: "tree:goals/demo",
 *     subject: "goals-doctor:manifest-invalid:demo",
 *     occurrence: 0,
 *     location: KnowledgeFindingLocation.make({ path: "goals/demo" }),
 *     message: "manifest-invalid: demo",
 *     remediation: "Fix the manifest.",
 *   }),
 *   spanClass: "verified",
 *   origin: "delegated",
 *   evaluator: O.none(),
 *   causeKey: "goals-doctor:manifest-invalid:demo",
 * })
 *
 * console.log(isKnowledgeBaselineable(row)) // false
 * ```
 *
 * @param row - One doctor finding.
 * @returns `true` when the finding may be sealed or leased.
 * @category predicates
 * @since 0.0.0
 */
export const isKnowledgeBaselineable = (row: KnowledgeDoctorFinding): boolean =>
  row.origin === "owned" &&
  row.spanClass !== "unclassified" &&
  row.finding.severity === "blocking" &&
  !isKnowledgeGovernanceKind(row.finding.kind);

type KeyedRow = { readonly row: KnowledgeDoctorFinding; readonly entry: KnowledgeRatchetEntry };

const keyedRows = Effect.fn("KnowledgeDoctor.keyedRows")(function* (
  findings: ReadonlyArray<KnowledgeDoctorFinding>,
  identity: HashMap.HashMap<string, string>
) {
  return yield* Effect.forEach(A.filter(findings, isKnowledgeBaselineable), (row) => {
    const path = knowledgeFindingDocumentPath(row);
    const durable = O.getOrElse(HashMap.get(identity, path), () => path);
    return Effect.map(
      makeKnowledgeBaselineKey(
        row.finding.kind,
        knowledgeDoctorDocumentId(durable),
        row.finding.subject,
        row.finding.occurrence
      ),
      (key): KeyedRow => ({ row, entry: KnowledgeRatchetEntry.make({ findingId: row.finding.findingId, key }) })
    );
  });
});

/**
 * The inputs of durable-identity resolution.
 *
 * **Details**
 *
 * `renames` are git lineage pairs `[path at mintedAt, current path]`; `sidecar` the identity-sidecar
 * mappings; `mintedAtPaths` and `headPaths` the tracked paths at `mintedAt` and now.
 *
 * **Example** (No renames)
 *
 * ```ts
 * import { KnowledgeIdentityInput } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import * as HashSet from "effect/HashSet"
 *
 * const input = KnowledgeIdentityInput.make({
 *   renames: [],
 *   sidecar: [],
 *   mintedAtPaths: HashSet.empty(),
 *   headPaths: HashSet.empty(),
 * })
 *
 * console.log(input.renames.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeIdentityInput extends S.Opaque<KnowledgeIdentityInput, { readonly brand: unique symbol }>()(
  S.Struct({
    renames: S.Array(S.Tuple([S.String, S.String])),
    sidecar: S.Array(KnowledgeIdentityMapping),
    mintedAtPaths: S.HashSet(S.String),
    headPaths: S.HashSet(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeIdentityInput", {
      description: "Rename lineage, sidecar mappings, and the tracked paths at mintedAt and now.",
    })
  )
) {}

/**
 * Each scanned document's durable path, plus the sidecar mappings the C6 rules rejected.
 *
 * **Example** (An empty resolution)
 *
 * ```ts
 * import { KnowledgeIdentityResolution } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import * as HashMap from "effect/HashMap"
 *
 * const resolution = KnowledgeIdentityResolution.make({ identity: HashMap.empty(), rejected: [] })
 *
 * console.log(HashMap.size(resolution.identity)) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeIdentityResolution extends S.Opaque<
  KnowledgeIdentityResolution,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    identity: S.HashMap(S.String, S.String),
    rejected: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeIdentityResolution", {
      description: "Current-to-durable document path map and the rejected identity-sidecar mappings.",
    })
  )
) {}

/**
 * Resolves each scanned document's durable identity: its path at `mintedAt` (C6 order).
 *
 * **Details**
 *
 * Tier 1 (a document-level `beep:ref` identity) has no dual-write surface yet, so it is empty (K26).
 * Tier 2 is git rename lineage from `mintedAt` to the scanned tree. Tier 3 is the sidecar, admitted
 * per mapping only when the source existed at `mintedAt` and is absent now, the target is absent at
 * `mintedAt` and present now, the mapping is one-to-one, and lineage does not already place the
 * target. Rejected mappings are returned as `from -> to: reason`.
 *
 * **Example** (A rename keeps its old identity)
 *
 * ```ts
 * import {
 *   KnowledgeIdentityInput,
 *   resolveKnowledgeDocumentIdentity,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const resolution = resolveKnowledgeDocumentIdentity(
 *   KnowledgeIdentityInput.make({
 *     renames: [["docs/old.md", "docs/new.md"]],
 *     sidecar: [],
 *     mintedAtPaths: HashSet.make("docs/old.md"),
 *     headPaths: HashSet.make("docs/new.md"),
 *   })
 * )
 *
 * console.log(O.getOrNull(HashMap.get(resolution.identity, "docs/new.md"))) // "docs/old.md"
 * ```
 *
 * @param input - Lineage renames as `[mintedAt path, current path]`, sidecar mappings, and both path sets.
 * @returns The current-to-durable path map and the rejected sidecar mappings.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveKnowledgeDocumentIdentity = (input: KnowledgeIdentityInput): KnowledgeIdentityResolution => {
  const lineage = HashMap.fromIterable(A.map(input.renames, ([from, to]) => [to, from] as const));
  const count = (values: ReadonlyArray<string>, value: string): number =>
    A.length(A.filter(values, (candidate) => candidate === value));
  const sources = A.map(input.sidecar, (mapping) => mapping.from);
  const targets = A.map(input.sidecar, (mapping) => mapping.to);
  const reason = (mapping: KnowledgeIdentityMapping): O.Option<string> =>
    A.findFirst(
      [
        [!HashSet.has(input.mintedAtPaths, mapping.from), "source absent at mintedAt"],
        [HashSet.has(input.headPaths, mapping.from), "source still present"],
        [HashSet.has(input.mintedAtPaths, mapping.to), "target present at mintedAt"],
        [!HashSet.has(input.headPaths, mapping.to), "target absent now"],
        [count(sources, mapping.from) > 1 || count(targets, mapping.to) > 1, "not one-to-one"],
        [HashMap.has(lineage, mapping.to), "lineage already maps the target"],
      ] as const,
      ([rejected]) => rejected
    ).pipe(O.map(([, why]) => why));
  const [admitted, rejected] = A.partition(input.sidecar, (mapping) =>
    O.match(reason(mapping), {
      onNone: () => Result.succeed(mapping),
      onSome: (why) => Result.fail(`${mapping.from} -> ${mapping.to}: ${why}`),
    })
  );
  return KnowledgeIdentityResolution.make({
    identity: A.reduce(admitted, lineage, (map, mapping) => HashMap.set(map, mapping.to, mapping.from)),
    rejected,
  });
};

/* -------------------------------------------------------------------------------------------------
 * Groups
 * ---------------------------------------------------------------------------------------------- */

const KIND_GROUPS: ReadonlyArray<readonly [ReadonlyArray<KnowledgeFindingKind>, KnowledgeBaselineGroup]> = [
  [
    [
      "skill-lock-coverage-drift",
      "unresolvable-skill-source",
      "floating-github-skill-source",
      "skill-license-unrecorded",
    ],
    "skill-provenance",
  ],
  [["packet-status-claim-drift"], "packet-claim-drift"],
  [["historical-claim-unverified", "historical-marker-on-live-surface"], "historical-claim"],
];

const PROHIBITION_PATTERN =
  /\b(?:retired|retire[sd]?|do not (?:import|use|add|reintroduce|restore)|don['’]t (?:import|use)|never (?:import|use|reintroduce)|no longer (?:exists?|ships?|used)|(?:was|were|has been|have been) (?:removed|deleted)|deprecated|superseded|not (?:a )?compatibility surfaces?)\b/iu;

const PACKAGE_SUBJECT_PATTERN = /^beep-(?:package|subpath|export):@beep\/([^/#\s]+)/u;

/**
 * The short names of every workspace package whose `package.json` the history deleted or renamed
 * away: each such directory's last segment and its last two segments joined with `-`.
 *
 * **Example** (A deleted driver package)
 *
 * ```ts
 * import { knowledgeRemovedPackageNames } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { KnowledgePathRemoval } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const names = knowledgeRemovedPackageNames([
 *   KnowledgePathRemoval.make({
 *     path: "packages/drivers/courtlistener/package.json",
 *     commit: "1111111111111111111111111111111111111111",
 *     subject: "chore: drop the driver",
 *     change: "deleted",
 *     renamedTo: O.none(),
 *   }),
 * ])
 *
 * console.log(HashSet.has(names, "courtlistener")) // true
 * ```
 *
 * @param removals - The tree's deleted and renamed-away paths.
 * @returns The package short names those removals retired.
 * @category utilities
 * @since 0.0.0
 */
export const knowledgeRemovedPackageNames = (removals: ReadonlyArray<KnowledgePathRemoval>): HashSet.HashSet<string> =>
  HashSet.fromIterable(
    A.flatMap(removals, (removal) => {
      if (!Str.endsWith("/package.json")(removal.path)) {
        return A.empty<string>();
      }
      const segments = A.dropRight(Str.split("/")(removal.path), 1);
      return A.appendAll(
        A.takeRight(segments, 1),
        A.length(segments) >= 2 ? [A.join(A.takeRight(segments, 2), "-")] : []
      );
    })
  );

/**
 * The facts one finding's baseline group is read from.
 *
 * **Details**
 *
 * `line` is the finding's source line, `attributed` whether its cause group has an authoring
 * commit, and `removedPackages` the package short names the history retired.
 *
 * **Example** (Construct a complete baseline group)
 *
 * ```ts
 * import { KnowledgeBaselineGroupInput } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { KnowledgeFinding, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import { KnowledgeDoctorFinding } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KnowledgeBaselineGroupInput)({ attributed: true })) // false
 * const row = KnowledgeDoctorFinding.make({
 *   finding: KnowledgeFinding.make({
 *     findingId: `knowledge-finding/v1:${"1".repeat(64)}`,
 *     kind: "unknown-beep-symbol",
 *     severity: "blocking",
 *     documentId: "tree:standards/ARCHITECTURE.md",
 *     subject: "beep-package:@beep/gone",
 *     occurrence: 0,
 *     location: KnowledgeFindingLocation.make({ path: "standards/ARCHITECTURE.md", line: 3 }),
 *     message: "Unknown package.",
 *     remediation: "Respell it.",
 *   }),
 *   spanClass: "verified",
 *   origin: "owned",
 *   evaluator: O.some("symbols"),
 *   causeKey: "beep-package:@beep/gone",
 * })
 * const group = KnowledgeBaselineGroupInput.make({
 *   row,
 *   line: O.some("`@beep/gone` is retired."),
 *   attributed: false,
 *   removedPackages: HashSet.empty(),
 * })
 * console.log(S.is(KnowledgeBaselineGroupInput)(group)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeBaselineGroupInput extends S.Opaque<
  KnowledgeBaselineGroupInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    row: KnowledgeDoctorFinding,
    line: S.Option(S.String),
    attributed: S.Boolean,
    removedPackages: S.HashSet(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeBaselineGroupInput", {
      description: "A finding, its source line, its attribution, and the retired package names its group is read from.",
    })
  )
) {}

/**
 * Assigns one finding its named baseline group.
 *
 * **Details**
 *
 * Kind groups come first (skills, packet claims, historical claims). Then a line that names its
 * target as retired, removed, deprecated, or not to be imported is `prohibition-of-retired-surface`;
 * a target the history deleted (an attributed cause group, or a package whose `package.json` was
 * removed) is `deleted-target-rot`; anything else is `unresolved-reference`.
 *
 * **Example** (A prohibition line)
 *
 * ```ts
 * import { KnowledgeFinding, KnowledgeFindingLocation } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import {
 *   classifyKnowledgeBaselineGroup,
 *   KnowledgeBaselineGroupInput,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { KnowledgeDoctorFinding } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const row = KnowledgeDoctorFinding.make({
 *   finding: KnowledgeFinding.make({
 *     findingId: `knowledge-finding/v1:${"1".repeat(64)}`,
 *     kind: "unknown-beep-symbol",
 *     severity: "blocking",
 *     documentId: "tree:standards/ARCHITECTURE.md",
 *     subject: "beep-package:@beep/gone",
 *     occurrence: 0,
 *     location: KnowledgeFindingLocation.make({ path: "standards/ARCHITECTURE.md", line: 3 }),
 *     message: "Unknown package.",
 *     remediation: "Respell it.",
 *   }),
 *   spanClass: "verified",
 *   origin: "owned",
 *   evaluator: O.some("symbols"),
 *   causeKey: "beep-package:@beep/gone",
 * })
 *
 * const group = classifyKnowledgeBaselineGroup(
 *   KnowledgeBaselineGroupInput.make({
 *     row,
 *     line: O.some("`@beep/gone` is retired; do not import it."),
 *     attributed: false,
 *     removedPackages: HashSet.empty(),
 *   })
 * )
 *
 * console.log(group) // "prohibition-of-retired-surface"
 * ```
 *
 * @param input - The finding, its source line, whether its cause group is attributed, and the removed packages.
 * @returns The finding's named group.
 * @category utilities
 * @since 0.0.0
 */
export const classifyKnowledgeBaselineGroup = (input: KnowledgeBaselineGroupInput): KnowledgeBaselineGroup =>
  pipe(
    A.findFirst(KIND_GROUPS, ([kinds]) => A.contains(kinds, input.row.finding.kind)),
    O.map(([, group]) => group),
    O.getOrElse((): KnowledgeBaselineGroup => {
      if (O.exists(input.line, (line) => PROHIBITION_PATTERN.test(line))) {
        return "prohibition-of-retired-surface";
      }
      const removedPackage = pipe(
        O.fromNullishOr(PACKAGE_SUBJECT_PATTERN.exec(input.row.finding.subject)?.[1]),
        O.exists((name) => HashSet.has(input.removedPackages, name))
      );
      return input.attributed || removedPackage ? "deleted-target-rot" : "unresolved-reference";
    })
  );

/* -------------------------------------------------------------------------------------------------
 * Mint
 * ---------------------------------------------------------------------------------------------- */

/**
 * The inputs of one mint, all read at the minted commit.
 *
 * @category models
 * @since 0.0.0
 */
export interface KnowledgeMintInput {
  /** Seal files at the minted commit: the previous baseline, promotions, leases, and CODEOWNERS. */
  readonly files: KnowledgeSealFiles;
  /** Promotion rows as of the previous baseline's `mintedAt`; empty on the first seal. */
  readonly previousPromotions: ReadonlyArray<KnowledgeDoctorPromotion>;
  /** The minted commit's deleted and renamed-away paths; `O.none()` (shallow history) fails closed. */
  readonly removals: O.Option<ReadonlyArray<KnowledgePathRemoval>>;
  /** The doctor report of the minted commit. */
  readonly report: KnowledgeDoctorReport;
  /** The minted tree, for the source lines the prohibition group reads. */
  readonly tree: KnowledgeTreeOracle;
}

const entryOrder = Order.mapInput(Order.String, (entry: KnowledgeBaselineEntry) => entry.key);
const promotedKinds = (promotions: O.Option<KnowledgeDoctorPromotions>): HashSet.HashSet<KnowledgeFindingKind> =>
  HashSet.fromIterable(
    A.map(
      O.match(promotions, { onNone: A.empty<KnowledgeDoctorPromotion>, onSome: (file) => file.promotions }),
      (row) => row.kind
    )
  );

const sourceLine = Effect.fn("KnowledgeDoctor.sourceLine")(function* (
  tree: KnowledgeTreeOracle,
  cache: HashMap.HashMap<string, ReadonlyArray<string>>,
  row: KnowledgeDoctorFinding
) {
  const path = row.finding.location.path;
  const lines = yield* O.match(HashMap.get(cache, path), {
    onSome: Effect.succeed,
    onNone: () =>
      A.some(tree.trackedEntries, (entry) => entry.path === path)
        ? tree.readBytes(path).pipe(
            Effect.flatMap((bytes) => decodeKnowledgeUtf8(bytes, `Malformed UTF-8 in tracked file "${path}".`)),
            Effect.map(Str.split(/\r?\n/u))
          )
        : Effect.succeed(A.empty<string>()),
  });
  const line = pipe(
    O.fromUndefinedOr(row.finding.location.line),
    O.flatMap((number) => A.get(lines, number - 1))
  );
  return [HashMap.set(cache, path, lines), line] as const;
});

/**
 * Mints the sealed baseline of one commit; the mint cannot launder (contract 9).
 *
 * **Details**
 *
 * The output is the commit's baselineable findings intersected with the previous baseline's keys,
 * the findings of kinds promoted since the previous mint, and, on the first seal, everything. Leased
 * or lease-expired findings are never minted. A baselineable finding of an already promoted kind that
 * none of these admit is refused (`KnowledgeMintRefusal`), so a main-red finding or an expired lease
 * never becomes sealed debt; findings of kinds still in their report-only window are left out. Keys
 * use the documents' own paths, the identity at `mintedAt`. Entries are sorted by key and grouped by
 * {@link classifyKnowledgeBaselineGroup}. The mint is pure over its inputs, which is what lets
 * `verify-mint` reproduce it byte for byte; writing the file is the CI job's step.
 *
 * **Example** (Mint is effectful)
 *
 * ```ts
 * import { mintKnowledgeBaseline } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(typeof mintKnowledgeBaseline) // "function"
 * ```
 *
 * @param input - The minted commit's report, tree, removals, seal files, and the previous promotions.
 * @returns The baseline, or the refusal listing the findings it may not absorb.
 * @category use-cases
 * @since 0.0.0
 */
export const mintKnowledgeBaseline = Effect.fn("KnowledgeDoctor.mint")(function* (input: KnowledgeMintInput) {
  const removals = yield* Effect.fromOption(input.removals).pipe(
    Effect.mapError(() =>
      KnowledgeDoctorInputError.of(
        "shallow-history",
        input.report.tree,
        `Cannot mint at ${input.report.tree} without its full history: the rot group reads deleted paths.`
      )
    )
  );
  const keyed = yield* keyedRows(input.report.findings, HashMap.empty());
  const previousKeys = HashSet.fromIterable(
    A.map(
      O.match(input.files.baseline, { onNone: A.empty<KnowledgeBaselineEntry>, onSome: (file) => file.entries }),
      (entry) => entry.key
    )
  );
  const firstSeal = O.isNone(input.files.baseline);
  const promotedNow = promotedKinds(input.files.promotions);
  const promotedBefore = HashSet.fromIterable(A.map(input.previousPromotions, (row) => row.kind));
  const leasedKeys = HashSet.fromIterable(
    A.map(
      O.match(input.files.leases, { onNone: A.empty<KnowledgeDebtLease>, onSome: (file) => file.leases }),
      (lease) => lease.key
    )
  );
  const unleased = A.filter(keyed, ({ entry }) => !HashSet.has(leasedKeys, entry.key));
  const admits = ({ row, entry }: KeyedRow): boolean =>
    firstSeal ||
    HashSet.has(previousKeys, entry.key) ||
    (HashSet.has(promotedNow, row.finding.kind) && !HashSet.has(promotedBefore, row.finding.kind));
  const admitted = A.filter(unleased, admits);
  const refused = A.filter(
    unleased,
    (keyedRow) => !admits(keyedRow) && HashSet.has(promotedNow, keyedRow.row.finding.kind)
  );
  if (A.isReadonlyArrayNonEmpty(refused)) {
    return yield* KnowledgeMintRefusal.make({
      message: `knowledge doctor mint: ${A.length(refused)} blocking finding(s) at ${input.report.tree} are neither previous keys nor newly promoted; fix them before the mint.`,
      refused: A.sort(
        A.map(refused, ({ row }) => row.finding.findingId),
        Order.String
      ),
    });
  }
  const attributed = HashSet.fromIterable(
    A.map(
      A.filter(input.report.groups, (group) => O.isSome(group.attribution)),
      (group) => group.causeKey
    )
  );
  const removedPackages = knowledgeRemovedPackageNames(removals);
  let cache = HashMap.empty<string, ReadonlyArray<string>>();
  let entries = A.empty<KnowledgeBaselineEntry>();
  for (const { row, entry } of admitted) {
    const [nextCache, line] = yield* sourceLine(input.tree, cache, row);
    cache = nextCache;
    const document = knowledgeFindingDocumentPath(row);
    entries = A.append(
      entries,
      KnowledgeBaselineEntry.make({
        key: entry.key,
        group: classifyKnowledgeBaselineGroup(
          KnowledgeBaselineGroupInput.make({
            row,
            line,
            attributed: HashSet.has(attributed, row.causeKey),
            removedPackages,
          })
        ),
        kind: row.finding.kind,
        document,
        subject: row.finding.subject,
        spanClass: row.spanClass === "unclassified" ? "verified" : row.spanClass,
        owners: O.match(input.files.codeowners, {
          onNone: A.empty<string>,
          onSome: (codeowners) => resolveKnowledgeCodeowners(codeowners, document),
        }),
      })
    );
  }
  return KnowledgeDoctorBaseline.make({
    mintedAt: input.report.tree,
    note: KNOWLEDGE_DOCTOR_BASELINE_NOTE,
    entries: A.sort(entries, entryOrder),
  });
});

const encodeBaseline = S.encodeUnknownEffect(KnowledgeDoctorBaseline);
const stringifyBaseline = SchemaGetter.stringifyJson({ space: 2 });

/**
 * Renders a baseline as the exact committed text: entries sorted by key, two-space JSON, one
 * trailing newline.
 *
 * **Example** (Render an empty seal)
 *
 * ```ts
 * import {
 *   encodeKnowledgeBaselineText,
 *   KNOWLEDGE_DOCTOR_BASELINE_NOTE,
 *   KnowledgeDoctorBaseline,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import * as Effect from "effect/Effect"
 *
 * const text = encodeKnowledgeBaselineText(
 *   KnowledgeDoctorBaseline.make({
 *     mintedAt: "1111111111111111111111111111111111111111",
 *     note: KNOWLEDGE_DOCTOR_BASELINE_NOTE,
 *     entries: [],
 *   })
 * )
 *
 * console.log(Effect.isEffect(text)) // true
 * ```
 *
 * @param baseline - The baseline to render.
 * @returns The canonical file text.
 * @category encoding
 * @since 0.0.0
 */
export const encodeKnowledgeBaselineText = Effect.fn("KnowledgeDoctor.encodeBaselineText")(function* (
  baseline: KnowledgeDoctorBaseline
) {
  const encoded = yield* encodeBaseline(
    KnowledgeDoctorBaseline.make({ ...baseline, entries: A.sort(baseline.entries, entryOrder) })
  ).pipe(KnowledgeOperationalError.mapError("Failed to encode the knowledge-doctor baseline."));
  const rendered = yield* SchemaGetter.run(stringifyBaseline, O.some(encoded), {}).pipe(
    KnowledgeOperationalError.mapError("Failed to render the knowledge-doctor baseline.")
  );
  return `${O.getOrElse(rendered, () => "")}\n`;
});

/**
 * Compares a committed baseline's exact text with a re-mint at its `mintedAt`.
 *
 * **Example** (Verification is effectful)
 *
 * ```ts
 * import {
 *   KNOWLEDGE_DOCTOR_BASELINE_NOTE,
 *   KnowledgeDoctorBaseline,
 *   verifyKnowledgeBaselineText,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import * as Effect from "effect/Effect"
 *
 * const minted = KnowledgeDoctorBaseline.make({
 *   mintedAt: "1111111111111111111111111111111111111111",
 *   note: KNOWLEDGE_DOCTOR_BASELINE_NOTE,
 *   entries: [],
 * })
 *
 * console.log(Effect.isEffect(verifyKnowledgeBaselineText("{}", minted))) // true
 * ```
 *
 * @param committed - The committed file text.
 * @param minted - The re-minted baseline.
 * @returns Nothing when the texts are byte-identical; `KnowledgeSealBroken` otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const verifyKnowledgeBaselineText = Effect.fn("KnowledgeDoctor.verifyBaselineText")(function* (
  committed: string,
  minted: KnowledgeDoctorBaseline
) {
  const expected = yield* encodeKnowledgeBaselineText(minted);
  if (committed !== expected) {
    return yield* KnowledgeSealBroken.make({
      message: `${KNOWLEDGE_DOCTOR_BASELINE_PATH} differs from the re-mint at ${minted.mintedAt} (${A.length(
        minted.entries
      )} minted entries); only the CI mint may write it.`,
      mintedAt: minted.mintedAt,
    });
  }
});

/* -------------------------------------------------------------------------------------------------
 * Seal guard
 * ---------------------------------------------------------------------------------------------- */

/**
 * The CI-side facts `--accept-mint` admits a non-removal baseline change on (C8 conditions iii, iv).
 *
 * **Example** (A reproducible mint)
 *
 * ```ts
 * import { KnowledgeMintAcceptance } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(KnowledgeMintAcceptance.make({ mintedAtIsAncestor: true, reproduces: true }).reproduces) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeMintAcceptance extends S.Opaque<KnowledgeMintAcceptance, { readonly brand: unique symbol }>()(
  S.Struct({
    mintedAtIsAncestor: S.Boolean,
    reproduces: S.Boolean,
  }).pipe(
    $I.annoteSchema("KnowledgeMintAcceptance", {
      description:
        "Whether the minted commit is an ancestor of the merge-base and the baseline re-mints byte for byte.",
    })
  )
) {}

/**
 * The inputs of the seal guard.
 *
 * **Details**
 *
 * `acceptMint` is present only when CI passed `--accept-mint` for the mint App's branch;
 * `changedPaths` are the paths the branch changes relative to the merge-base.
 *
 * **Example** (Compare complete seal inputs)
 *
 * ```ts
 * import { KnowledgeSealFiles, KnowledgeSealGuardInput } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KnowledgeSealGuardInput)({ changedPaths: [] })) // false
 * const emptySeal = KnowledgeSealFiles.make({
 *   baseline: O.none(), baselineText: O.none(), codeowners: O.none(),
 *   identity: O.none(), leases: O.none(), promotions: O.none(),
 * })
 * const input = KnowledgeSealGuardInput.make({
 *   acceptMint: O.none(), base: emptySeal, changedPaths: [], head: emptySeal,
 * })
 * console.log(S.is(KnowledgeSealGuardInput)(input)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeSealGuardInput extends S.Opaque<KnowledgeSealGuardInput, { readonly brand: unique symbol }>()(
  S.Struct({
    acceptMint: S.Option(KnowledgeMintAcceptance),
    base: KnowledgeSealFiles,
    changedPaths: S.Array(S.String),
    head: KnowledgeSealFiles,
  }).pipe(
    $I.annoteSchema("KnowledgeSealGuardInput", {
      description: "Base and head seal files, the branch's changed paths, and the CI mint acceptance facts.",
    })
  )
) {}

const BASELINE_REMEDIATION =
  "Restore the baseline from the merge-base; a branch may only delete entries, and only the CI mint (branch automation/knowledge-baseline-mint with --accept-mint) adds or changes them.";
const PROMOTION_REMEDIATION =
  "Restore the existing promotion rows; a promotion PR appends exactly one row for a kind not yet promoted and changes nothing else.";

const tamper = (repoPath: string, rule: string, message: string, remediation: string): KnowledgeFindingCandidate =>
  KnowledgeFindingCandidate.make({
    kind: "baseline-tamper",
    documentId: knowledgeDoctorDocumentId(repoPath),
    subject: `baseline-tamper:${repoPath}:${rule}`,
    location: KnowledgeFindingLocation.make({ path: repoPath }),
    message,
    remediation,
  });

const entryEquivalence = S.toEquivalence(KnowledgeBaselineEntry);
const promotionEquivalence = S.toEquivalence(KnowledgeDoctorPromotion);

const onlyChanges = (changedPaths: ReadonlyArray<string>, repoPath: string): boolean =>
  A.length(changedPaths) === 1 && A.contains(changedPaths, repoPath);

// What a head baseline adds or changes relative to the base one; empty for a pure deletion.
const nonRemovalChanges = (
  head: KnowledgeDoctorBaseline,
  base: O.Option<KnowledgeDoctorBaseline>
): ReadonlyArray<string> =>
  O.match(base, {
    onNone: () => [`adds the baseline file with ${A.length(head.entries)} entries`],
    onSome: (previous) => {
      const byKey = HashMap.fromIterable(A.map(previous.entries, (entry) => [entry.key, entry] as const));
      const added = A.filter(head.entries, (entry) => !HashMap.has(byKey, entry.key));
      const relabeled = A.filter(head.entries, (entry) =>
        O.exists(HashMap.get(byKey, entry.key), (before) => !entryEquivalence(before, entry))
      );
      return A.getSomes([
        A.isReadonlyArrayNonEmpty(added) ? O.some(`adds ${A.length(added)} entr(ies)`) : O.none(),
        A.isReadonlyArrayNonEmpty(relabeled) ? O.some(`relabels ${A.length(relabeled)} entr(ies)`) : O.none(),
        head.mintedAt !== previous.mintedAt ? O.some(`changes mintedAt to ${head.mintedAt}`) : O.none(),
        head.note !== previous.note ? O.some("edits the note") : O.none(),
      ]);
    },
  });

// Findings for a branch that keeps a sealed baseline but changes it.
const sealedBaselineChanges = (
  input: KnowledgeSealGuardInput,
  head: KnowledgeDoctorBaseline
): ReadonlyArray<KnowledgeFindingCandidate> => {
  const changes = nonRemovalChanges(head, input.base.baseline);
  if (A.isReadonlyArrayEmpty(changes)) {
    return [];
  }
  const summary = `The branch ${A.join(changes, ", ")}`;
  return O.match(input.acceptMint, {
    onNone: () => [tamper(KNOWLEDGE_DOCTOR_BASELINE_PATH, "non-removal", `${summary}.`, BASELINE_REMEDIATION)],
    onSome: (acceptance) =>
      A.getSomes([
        onlyChanges(input.changedPaths, KNOWLEDGE_DOCTOR_BASELINE_PATH)
          ? O.none()
          : O.some(
              tamper(
                KNOWLEDGE_DOCTOR_BASELINE_PATH,
                "mint-diff-not-baseline-only",
                `${summary}, but the mint PR also changes ${A.join(
                  A.filter(input.changedPaths, (path) => path !== KNOWLEDGE_DOCTOR_BASELINE_PATH),
                  ", "
                )}.`,
                BASELINE_REMEDIATION
              )
            ),
        acceptance.mintedAtIsAncestor
          ? O.none()
          : O.some(
              tamper(
                KNOWLEDGE_DOCTOR_BASELINE_PATH,
                "minted-at-not-ancestor",
                `${summary}, but mintedAt ${head.mintedAt} is not an ancestor of the merge-base.`,
                BASELINE_REMEDIATION
              )
            ),
        acceptance.reproduces
          ? O.none()
          : O.some(
              tamper(
                KNOWLEDGE_DOCTOR_BASELINE_PATH,
                "mint-not-reproducible",
                `${summary}, but a re-mint at ${head.mintedAt} does not reproduce it byte for byte.`,
                BASELINE_REMEDIATION
              )
            ),
      ]),
  });
};

const baselineTamper = (input: KnowledgeSealGuardInput): ReadonlyArray<KnowledgeFindingCandidate> =>
  O.match(input.head.baseline, {
    onNone: () =>
      A.fromOption(
        O.map(input.base.baseline, () =>
          tamper(
            KNOWLEDGE_DOCTOR_BASELINE_PATH,
            "removed",
            "The branch removes the sealed baseline.",
            BASELINE_REMEDIATION
          )
        )
      ),
    onSome: (head) => sealedBaselineChanges(input, head),
  });

const promotionRows = (files: KnowledgeSealFiles): ReadonlyArray<KnowledgeDoctorPromotion> =>
  O.match(files.promotions, { onNone: A.empty<KnowledgeDoctorPromotion>, onSome: (file) => file.promotions });

const promotionTamper = (input: KnowledgeSealGuardInput): ReadonlyArray<KnowledgeFindingCandidate> => {
  const baseRows = promotionRows(input.base);
  const headRows = promotionRows(input.head);
  const prefixKept =
    A.length(headRows) >= A.length(baseRows) &&
    A.every(baseRows, (row, index) =>
      O.exists(A.get(headRows, index), (headRow) => promotionEquivalence(row, headRow))
    );
  if (!prefixKept) {
    return [
      tamper(
        KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
        "edited-or-removed",
        "The branch edits or removes an existing promotion row; the file is append-only.",
        PROMOTION_REMEDIATION
      ),
    ];
  }
  const appended = A.drop(headRows, A.length(baseRows));
  const basePromoted = HashSet.fromIterable(A.map(baseRows, (row) => row.kind));
  return A.match(appended, {
    onEmpty: () => [],
    onNonEmpty: (rows) =>
      A.getSomes([
        A.length(rows) > 1
          ? O.some(
              tamper(
                KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
                "more-than-one-row",
                `The branch appends ${A.length(rows)} promotion rows; a promotion PR appends exactly one.`,
                PROMOTION_REMEDIATION
              )
            )
          : O.none(),
        onlyChanges(input.changedPaths, KNOWLEDGE_DOCTOR_PROMOTIONS_PATH)
          ? O.none()
          : O.some(
              tamper(
                KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
                "promotion-diff-not-promotions-only",
                "A promotion PR changes the promotions file and nothing else.",
                PROMOTION_REMEDIATION
              )
            ),
        A.some(rows, (row) => HashSet.has(basePromoted, row.kind))
          ? O.some(
              tamper(
                KNOWLEDGE_DOCTOR_PROMOTIONS_PATH,
                "kind-already-promoted",
                "The appended row promotes a kind the merge-base already promotes.",
                PROMOTION_REMEDIATION
              )
            )
          : O.none(),
      ]),
  });
};

/**
 * The seal guard: `baseline-tamper` candidates for every non-mint edit of the baseline or the
 * promotions file.
 *
 * **Details**
 *
 * A branch may only delete baseline entries; key order is canonicalized away because entries compare
 * by key. Adding an entry, relabeling one (kind, subject, class, group, document, or owners),
 * changing `mintedAt`, editing the note, adding the file, or removing it is tamper, unless
 * `--accept-mint` holds all of: the branch changes only the baseline, `mintedAt` is an ancestor of the
 * merge-base, and the re-mint reproduces the file (C8). Promotion rows are append-only: the base rows
 * must stay a prefix, and a branch may append exactly one row for a kind not yet promoted while
 * changing nothing else (K12).
 *
 * **Example** (No seal files, no tamper)
 *
 * ```ts
 * import {
 *   KnowledgeSealFiles,
 *   KnowledgeSealGuardInput,
 *   knowledgeSealGuard,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import * as O from "effect/Option"
 *
 * const empty = KnowledgeSealFiles.make({
 *   baseline: O.none(),
 *   baselineText: O.none(),
 *   codeowners: O.none(),
 *   identity: O.none(),
 *   leases: O.none(),
 *   promotions: O.none(),
 * })
 * const input = KnowledgeSealGuardInput.make({ acceptMint: O.none(), base: empty, head: empty, changedPaths: [] })
 *
 * console.log(knowledgeSealGuard(input).length) // 0
 * ```
 *
 * @param input - Base and head seal files, the branch's changed paths, and the mint acceptance facts.
 * @returns One `baseline-tamper` candidate per broken rule.
 * @category use-cases
 * @since 0.0.0
 */
export const knowledgeSealGuard = (input: KnowledgeSealGuardInput): ReadonlyArray<KnowledgeFindingCandidate> =>
  A.appendAll(baselineTamper(input), promotionTamper(input));

/* -------------------------------------------------------------------------------------------------
 * Check
 * ---------------------------------------------------------------------------------------------- */

/**
 * The inputs of one gating check, all read before the pure classification runs.
 *
 * **Details**
 *
 * `headPaths` are the scanned tree's tracked paths and `mintedAtPaths` those at the baseline's
 * `mintedAt` (only the identity sidecar reads them). `renames` is the rename lineage from `mintedAt`
 * as `[path at mintedAt, current path]`, `report` the read-only scan of the tree under check, and
 * `removals` the tree's path removals, for regrouping with the governance findings.
 *
 * **Example** (Check a scanned report against empty seals)
 *
 * ```ts
 * import { KnowledgeDoctorCheckInput, KnowledgeSealFiles } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { KnowledgeDoctorReport, KnowledgeSpanCounts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as DateTime from "effect/DateTime"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(KnowledgeDoctorCheckInput)({ baseRef: "main" })) // false
 * const emptySeal = KnowledgeSealFiles.make({
 *   baseline: O.none(), baselineText: O.none(), codeowners: O.none(),
 *   identity: O.none(), leases: O.none(), promotions: O.none(),
 * })
 * const report = KnowledgeDoctorReport.make({
 *   treeish: "HEAD",
 *   tree: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4",
 *   mode: "report",
 *   spanCounts: KnowledgeSpanCounts.make({
 *     verified: 0, "generated-example": 0, "historical-with-commit": 0, unclassified: 0,
 *   }),
 *   uncheckedOptionCount: 0,
 *   rootHistory: "available",
 *   groups: [], findings: [], ratchet: O.none(),
 * })
 * const input = KnowledgeDoctorCheckInput.make({
 *   acceptMint: O.none(), base: emptySeal, baseRef: "origin/main",
 *   changedPaths: [], head: emptySeal, headPaths: HashSet.empty(),
 *   mergeBase: "1111111111111111111111111111111111111111",
 *   mintedAtPaths: HashSet.empty(), now: DateTime.makeUnsafe("2026-10-14T00:00:00Z"),
 *   removals: O.some([]), renames: [], report,
 * })
 * console.log(S.is(KnowledgeDoctorCheckInput)(input)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDoctorCheckInput extends S.Opaque<KnowledgeDoctorCheckInput, { readonly brand: unique symbol }>()(
  S.Struct({
    acceptMint: S.Option(KnowledgeMintAcceptance),
    base: KnowledgeSealFiles,
    baseRef: S.String,
    changedPaths: S.Array(S.String),
    head: KnowledgeSealFiles,
    headPaths: S.HashSet(S.String),
    mergeBase: KnowledgeCommitSha,
    mintedAtPaths: S.HashSet(S.String),
    now: S.DateTimeUtc,
    removals: KnowledgePathRemoval.pipe(S.Array, S.Option),
    renames: S.Array(S.Tuple([S.String, S.String])),
    report: KnowledgeDoctorReport,
  }).pipe(
    $I.annoteSchema("KnowledgeDoctorCheckInput", {
      description: "A scanned report plus every seal, lease, identity, and history input of one gating check.",
    })
  )
) {}

const ratchetOrder = Order.mapInput(Order.String, (entry: KnowledgeRatchetEntry) => entry.findingId);
const doctorFindingOrder = Order.mapInput(Order.String, (row: KnowledgeDoctorFinding) => row.finding.findingId);

const leaseCandidates = (
  rows: ReadonlyArray<KnowledgeLeaseRow>,
  causeKeys: HashMap.HashMap<string, string>
): ReadonlyArray<readonly [KnowledgeFindingCandidate, string]> =>
  A.flatMap(rows, (row) => {
    const location = KnowledgeFindingLocation.make({ path: KNOWLEDGE_DOCTOR_LEASES_PATH });
    const candidate = (kind: KnowledgeFindingKind, rule: string, message: string, remediation: string) =>
      KnowledgeFindingCandidate.make({
        kind,
        documentId: knowledgeDoctorDocumentId(KNOWLEDGE_DOCTOR_LEASES_PATH),
        subject: `lease:${row.key}:${rule}`,
        location,
        message,
        remediation,
      });
    const expired =
      row.status === "expired"
        ? [
            [
              candidate(
                "lease-expired",
                "expired",
                `Lease on ${row.document} expired; its finding is introduced again.`,
                "Fix the leased finding or remove the lease; an expired lease is never renewed past its cap."
              ),
              O.getOrElse(HashMap.get(causeKeys, row.key), () => `lease:${row.key}`),
            ] as const,
          ]
        : [];
    const violations = A.map(
      row.violations,
      (violation) =>
        [
          candidate(
            violation,
            violation,
            A.join(row.details, " "),
            "Fix the lease row: a merge-base CODEOWNERS owner, at most 30 days from an unchanged issued date, within the quotas."
          ),
          `lease:${row.key}`,
        ] as const
    );
    return A.appendAll(expired, violations);
  });

/**
 * Classifies a scanned tree against the sealed baseline, leases, and the seal guard.
 *
 * **Details**
 *
 * Every baselineable finding gets its durable key (contract 10). A key in the baseline is
 * `inherited`; a key under an effective lease on the finding's own document is `leased`; any other key
 * is `introduced` when its kind is promoted at the merge-base and `pending` while the kind is still
 * report-only (K24). Unclassified and delegated findings never enter the ratchet. Governance findings
 * (seal-guard tamper, expired and violating leases) join the report's findings as blocking rows, and
 * the cause groups are rebuilt over the union. Without a baseline on either side the check refuses,
 * exactly as the gate did before the first seal; a branch that removes the baseline is classified
 * against the merge-base's copy and reported as tamper.
 *
 * **Example** (Check is effectful)
 *
 * ```ts
 * import { checkKnowledgeDoctorReport } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 *
 * console.log(typeof checkKnowledgeDoctorReport) // "function"
 * ```
 *
 * @param input - The scanned report and every seal, lease, identity, and history input.
 * @returns The report in `check` mode with its ratchet and governance findings.
 * @category use-cases
 * @since 0.0.0
 */
export const checkKnowledgeDoctorReport = Effect.fn("KnowledgeDoctor.check")(function* (
  input: KnowledgeDoctorCheckInput
) {
  const baseline = yield* Effect.fromOption(O.orElse(input.head.baseline, () => input.base.baseline)).pipe(
    Effect.mapError(() =>
      KnowledgeDoctorInputError.make({
        reason: "missing-baseline",
        subject: KNOWLEDGE_DOCTOR_BASELINE_PATH,
        message: KNOWLEDGE_DOCTOR_BASELINE_PENDING_MESSAGE,
        remediation: "Run `bun run beep knowledge doctor --report` until the CI mint opens the first sealed baseline.",
      })
    )
  );
  const resolution = resolveKnowledgeDocumentIdentity(
    KnowledgeIdentityInput.make({
      renames: input.renames,
      sidecar: O.match(input.head.identity, {
        onNone: A.empty<KnowledgeIdentityMapping>,
        onSome: (file) => file.mappings,
      }),
      mintedAtPaths: input.mintedAtPaths,
      headPaths: input.headPaths,
    })
  );
  const keyed = yield* keyedRows(input.report.findings, resolution.identity);
  const leaseRows = yield* evaluateKnowledgeLeases(
    KnowledgeLeaseEvaluationInput.make({
      leases: O.match(input.head.leases, { onNone: A.empty<KnowledgeDebtLease>, onSome: (file) => file.leases }),
      baseLeases: O.match(input.base.leases, { onNone: A.empty<KnowledgeDebtLease>, onSome: (file) => file.leases }),
      codeowners: input.base.codeowners,
      now: input.now,
    })
  );
  const effective = HashMap.fromIterable(
    A.map(A.filter(leaseRows, isKnowledgeLeaseEffective), (row) => [row.key, row.document] as const)
  );
  const baselineKeys = HashSet.fromIterable(A.map(baseline.entries, (entry) => entry.key));
  const promoted = promotedKinds(input.base.promotions);
  const bucketOf = ({ row, entry }: KeyedRow): "inherited" | "leased" | "introduced" | "pending" => {
    if (HashSet.has(baselineKeys, entry.key)) {
      return "inherited";
    }
    if (O.exists(HashMap.get(effective, entry.key), (document) => document === knowledgeFindingDocumentPath(row))) {
      return "leased";
    }
    return HashSet.has(promoted, row.finding.kind) ? "introduced" : "pending";
  };
  const bucket = (name: ReturnType<typeof bucketOf>) =>
    A.sort(
      A.map(
        A.filter(keyed, (keyedRow) => bucketOf(keyedRow) === name),
        ({ entry }) => entry
      ),
      ratchetOrder
    );
  const currentKeys = HashSet.fromIterable(A.map(keyed, ({ entry }) => entry.key));
  const causeKeys = HashMap.fromIterable(A.map(keyed, ({ row, entry }) => [entry.key, row.causeKey] as const));
  const governance = A.appendAll(
    A.map(
      knowledgeSealGuard(
        KnowledgeSealGuardInput.make({
          acceptMint: input.acceptMint,
          base: input.base,
          head: input.head,
          changedPaths: input.changedPaths,
        })
      ),
      (candidate) => [candidate, `seal:${candidate.subject}`] as const
    ),
    leaseCandidates(leaseRows, causeKeys)
  );
  const governanceFindings = yield* knowledgeFindingsFromCandidates(A.map(governance, ([candidate]) => candidate));
  const governanceRows = A.zipWith(governanceFindings, governance, (finding, [, causeKey]) =>
    KnowledgeDoctorFinding.make({
      finding,
      spanClass: "verified",
      origin: "owned",
      evaluator: O.none(),
      causeKey,
    })
  );
  const findings = A.sort(A.appendAll(input.report.findings, governanceRows), doctorFindingOrder);
  return KnowledgeDoctorReport.make({
    ...input.report,
    mode: "check",
    findings,
    groups: groupKnowledgeDoctorFindings(findings, input.removals),
    ratchet: O.some(
      KnowledgeDoctorRatchet.make({
        baseRef: input.baseRef,
        mergeBase: input.mergeBase,
        mintedAt: baseline.mintedAt,
        promotedKinds: A.sort(A.fromIterable(promoted), Order.String),
        introduced: bucket("introduced"),
        pending: bucket("pending"),
        inherited: bucket("inherited"),
        leased: bucket("leased"),
        resolved: A.sort(
          A.filter(
            A.map(baseline.entries, (entry) => entry.key),
            (key) => !HashSet.has(currentKeys, key)
          ),
          Order.String
        ),
        identityRejected: resolution.rejected,
      })
    ),
  });
});

/**
 * The gate verdict of a checked report: introduced and governance blocking counts.
 *
 * **Example** (A read-only report never fails the gate)
 *
 * ```ts
 * import { knowledgeDoctorGateFailure } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.baseline"
 * import { KnowledgeDoctorReport, KnowledgeSpanCounts } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.schemas"
 * import * as O from "effect/Option"
 *
 * const report = KnowledgeDoctorReport.make({
 *   treeish: "HEAD",
 *   tree: "1111111111111111111111111111111111111111",
 *   mode: "report",
 *   spanCounts: KnowledgeSpanCounts.make({ verified: 0, "generated-example": 0, "historical-with-commit": 0, unclassified: 0 }),
 *   uncheckedOptionCount: 0,
 *   rootHistory: "available",
 *   groups: [],
 *   findings: [],
 *   ratchet: O.none(),
 * })
 *
 * console.log(O.isNone(knowledgeDoctorGateFailure(report))) // true
 * ```
 *
 * @param report - A checked report.
 * @returns The gate error when introduced or governance findings exist.
 * @category use-cases
 * @since 0.0.0
 */
export const knowledgeDoctorGateFailure = (report: KnowledgeDoctorReport): O.Option<KnowledgeDoctorGateError> => {
  const introduced = O.match(report.ratchet, { onNone: () => 0, onSome: (ratchet) => A.length(ratchet.introduced) });
  const governance = A.length(A.filter(report.findings, (row) => isKnowledgeGovernanceKind(row.finding.kind)));
  return introduced + governance === 0
    ? O.none()
    : O.some(
        KnowledgeDoctorGateError.make({
          message: `knowledge doctor: ${introduced} introduced and ${governance} governance blocking finding(s).`,
          introducedCount: S.Natural.make(introduced),
          governanceCount: S.Natural.make(governance),
        })
      );
};
