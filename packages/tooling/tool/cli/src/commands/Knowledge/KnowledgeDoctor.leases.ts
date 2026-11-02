/**
 * Knowledge-doctor debt leases: the lease file schema, `.github/CODEOWNERS` owner resolution, and the
 * pure lease evaluation that the gating check and `knowledge doctor leases` share.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { matchCodeownersOwners } from "../../internal/Codeowners.ts";
import { KnowledgeDoctorInputError } from "./Knowledge.errors.ts";
import { KnowledgeCommitSha } from "./Knowledge.refs.ts";
import { KnowledgeBaselineKey } from "./KnowledgeDoctor.schemas.ts";
import type * as AST from "effect/SchemaAST";

const $I = $RepoCliId.create("commands/Knowledge/KnowledgeDoctor.leases");

/**
 * Repository path of the debt-lease file, the only author-written suppression.
 *
 * **Example** (Read the lease path)
 *
 * ```ts
 * import { KNOWLEDGE_DOCTOR_LEASES_PATH } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 *
 * console.log(KNOWLEDGE_DOCTOR_LEASES_PATH) // "goals/knowledge-doctor.leases.jsonc"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_DOCTOR_LEASES_PATH = "goals/knowledge-doctor.leases.jsonc";

/**
 * Repository path of the owner table lease owners resolve from, always read at the merge-base.
 *
 * **Example** (Read the owner table path)
 *
 * ```ts
 * import { KNOWLEDGE_CODEOWNERS_PATH } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 *
 * console.log(KNOWLEDGE_CODEOWNERS_PATH) // ".github/CODEOWNERS"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_CODEOWNERS_PATH = ".github/CODEOWNERS";

/**
 * The longest a lease may run from `issued` to `expires` (K7).
 *
 * **Example** (Read the cap in days)
 *
 * ```ts
 * import { KNOWLEDGE_LEASE_MAX_LIFETIME } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toDays(KNOWLEDGE_LEASE_MAX_LIFETIME)) // 30
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_LEASE_MAX_LIFETIME = Duration.days(30);

/**
 * How long before expiry a lease is reported as expiring, the yeet T-7 warning window.
 *
 * **Example** (Read the window in days)
 *
 * ```ts
 * import { KNOWLEDGE_LEASE_WARNING_WINDOW } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as Duration from "effect/Duration"
 *
 * console.log(Duration.toDays(KNOWLEDGE_LEASE_WARNING_WINDOW)) // 7
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_LEASE_WARNING_WINDOW = Duration.days(7);

/**
 * Active leases one document may hold (K7).
 *
 * **Example** (Read the per-document quota)
 *
 * ```ts
 * import { KNOWLEDGE_LEASES_PER_DOCUMENT } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 *
 * console.log(KNOWLEDGE_LEASES_PER_DOCUMENT) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_LEASES_PER_DOCUMENT = 2;

/**
 * Active leases the repository may hold (K7).
 *
 * **Example** (Read the repository quota)
 *
 * ```ts
 * import { KNOWLEDGE_LEASES_PER_REPO } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 *
 * console.log(KNOWLEDGE_LEASES_PER_REPO) // 20
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const KNOWLEDGE_LEASES_PER_REPO = 20;

/**
 * One debt lease: a time-boxed, owned suppression of one introduced finding.
 *
 * **Details**
 *
 * `key` is the leased finding's baseline key and `document` the repository path of the document the
 * finding sits in; the gate applies the lease only when the finding with that key sits in that
 * document, and the owner check reads the document's CODEOWNERS owners (K27). `issued` is immutable
 * once the lease is on the base branch, so renewal cannot outrun the 30-day cap.
 *
 * **Example** (Decode a lease row)
 *
 * ```ts
 * import { KnowledgeDebtLease } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const lease = S.decodeUnknownEffect(KnowledgeDebtLease)({
 *   key: `knowledge-doctor/v1:${"a".repeat(64)}`,
 *   document: "docs/README.md",
 *   owner: "@kriegcloud",
 *   reason: "The target lands in the next PR.",
 *   issued: "2026-10-14T00:00:00Z",
 *   expires: "2026-10-28T00:00:00Z",
 * })
 *
 * console.log(Effect.isEffect(lease)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDebtLease extends S.Opaque<KnowledgeDebtLease, { readonly brand: unique symbol }>()(
  S.Struct({
    key: KnowledgeBaselineKey,
    document: S.String,
    owner: S.String,
    reason: S.NonEmptyString,
    issued: S.DateTimeUtcFromString,
    expires: S.DateTimeUtcFromString,
    tracking: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeDebtLease", {
      description: "A time-boxed, CODEOWNERS-owned suppression of one introduced knowledge-doctor finding.",
    })
  )
) {}

/**
 * The committed lease file `goals/knowledge-doctor.leases.jsonc`.
 *
 * **Example** (An empty lease file)
 *
 * ```ts
 * import { KnowledgeDebtLeases } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 *
 * console.log(KnowledgeDebtLeases.make({ leases: [] }).schemaVersion) // "knowledge-doctor-leases/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeDebtLeases extends S.Opaque<KnowledgeDebtLeases, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("knowledge-doctor-leases/v1"),
    leases: S.Array(KnowledgeDebtLease),
  }).pipe(
    $I.annoteSchema("KnowledgeDebtLeases", {
      description: "Every debt lease the repository holds.",
    })
  )
) {}

/**
 * Where a lease stands relative to `now`.
 *
 * **Details**
 *
 * `expiring` means at most seven days remain (the yeet warning); `expired` means `expires` is not
 * after `now`, so the gate drops the lease and the finding blocks again. A future-issued row can
 * have `active` status, but its `lease-issued-in-future` violation makes it ineffective.
 *
 * **Example** (Recognize an expiring lease)
 *
 * ```ts
 * import { KnowledgeLeaseStatus } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 *
 * console.log(KnowledgeLeaseStatus.is.expiring("expiring")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeLeaseStatus = LiteralKit(["active", "expiring", "expired"]).pipe(
  $I.annoteSchema("KnowledgeLeaseStatus", {
    description: "Whether a debt lease is active, within its seven-day warning window, or expired.",
  })
);

/**
 * Where a lease stands relative to `now`.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeLeaseStatus = typeof KnowledgeLeaseStatus.Type;

/**
 * The lease rules a lease can break, each reported as the finding kind of the same name.
 *
 * **Example** (Recognize the owner violation)
 *
 * ```ts
 * import { KnowledgeLeaseViolation } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 *
 * console.log(KnowledgeLeaseViolation.is["lease-owner-unresolved"]("lease-owner-unresolved")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const KnowledgeLeaseViolation = LiteralKit([
  "lease-owner-unresolved",
  "lease-issued-in-future",
  "lease-lifetime-exceeded",
  "lease-quota-exceeded",
]).pipe(
  $I.annoteSchema("KnowledgeLeaseViolation", {
    description: "A debt-lease rule a lease breaks: owner, future issue date, lifetime, or quota.",
  })
);

/**
 * The lease rules a lease can break.
 *
 * @category models
 * @since 0.0.0
 */
export type KnowledgeLeaseViolation = typeof KnowledgeLeaseViolation.Type;

/**
 * One lease as the evaluation sees it: its status, violations, and a sentence per violation.
 *
 * **Details**
 *
 * A lease suppresses its finding only when `violations` is empty and `status` is not `expired`.
 *
 * **Example** (A clean active lease)
 *
 * ```ts
 * import { KnowledgeLeaseRow } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as DateTime from "effect/DateTime"
 *
 * const row = KnowledgeLeaseRow.make({
 *   key: `knowledge-doctor/v1:${"a".repeat(64)}`,
 *   document: "docs/README.md",
 *   owner: "@kriegcloud",
 *   expires: DateTime.makeUnsafe("2026-10-28T00:00:00Z"),
 *   status: "active",
 *   violations: [],
 *   details: [],
 * })
 *
 * console.log(row.status) // "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeLeaseRow extends S.Opaque<KnowledgeLeaseRow, { readonly brand: unique symbol }>()(
  S.Struct({
    key: KnowledgeBaselineKey,
    document: S.String,
    owner: S.String,
    expires: S.DateTimeUtcFromString,
    status: KnowledgeLeaseStatus,
    violations: S.Array(KnowledgeLeaseViolation),
    details: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("KnowledgeLeaseRow", {
      description: "One debt lease with its expiry status and every rule it breaks.",
    })
  )
) {}

/**
 * The `knowledge doctor leases --json` document that yeet's verify step reads.
 *
 * **Example** (An empty lease report)
 *
 * ```ts
 * import { KnowledgeLeasesReport } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as DateTime from "effect/DateTime"
 *
 * const report = KnowledgeLeasesReport.make({
 *   tree: "1111111111111111111111111111111111111111",
 *   mergeBase: "2222222222222222222222222222222222222222",
 *   now: DateTime.makeUnsafe("2026-10-14T00:00:00Z"),
 *   leases: [],
 * })
 *
 * console.log(report.schemaVersion) // "knowledge-doctor-leases-report/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeLeasesReport extends S.Opaque<KnowledgeLeasesReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("knowledge-doctor-leases-report/v1"),
    tree: KnowledgeCommitSha,
    mergeBase: KnowledgeCommitSha,
    now: S.DateTimeUtcFromString,
    leases: S.Array(KnowledgeLeaseRow),
  }).pipe(
    $I.annoteSchema("KnowledgeLeasesReport", {
      description: "Every debt lease of one tree with its status and violations at one instant.",
    })
  )
) {}

/**
 * Encodes a lease report as one JSON line.
 *
 * **Example** (Encoding is effectful)
 *
 * ```ts
 * import { encodeKnowledgeLeasesReportJson } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(encodeKnowledgeLeasesReportJson({}))) // true
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const encodeKnowledgeLeasesReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<string, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<string, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.encodeUnknownEffect(S.fromJsonString(KnowledgeLeasesReport)));

/**
 * Decodes a lease report from its JSON line.
 *
 * **Example** (Decoding is effectful)
 *
 * ```ts
 * import { decodeKnowledgeLeasesReportJson } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(decodeKnowledgeLeasesReportJson("{}"))) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeKnowledgeLeasesReportJson: {
  (options?: AST.ParseOptions): (input: unknown) => Effect.Effect<KnowledgeLeasesReport, S.SchemaError>;
  (input: unknown, options?: AST.ParseOptions): Effect.Effect<KnowledgeLeasesReport, S.SchemaError>;
} = dual(SchemaUtils.isCodecDataFirst, S.decodeUnknownEffect(S.fromJsonString(KnowledgeLeasesReport)));

/* -------------------------------------------------------------------------------------------------
 * CODEOWNERS
 * ---------------------------------------------------------------------------------------------- */

/**
 * Resolves the owner set of a repository path from `.github/CODEOWNERS` text.
 *
 * **Details**
 *
 * GitHub semantics: the last matching line wins, patterns follow gitignore rules (`*` stays within one
 * path segment, `**` crosses segments, a leading or inner `/` anchors to the root, a trailing `/`
 * matches only below a directory), and `#` starts a comment. A winning line with no owners leaves the
 * path deliberately unowned, so the set is empty, as it is when nothing matches. This is the K6 owner
 * binding; the skills patch series resolves the same grammar to one joined owner string.
 *
 * **Example** (Let the last match win)
 *
 * ```ts
 * import { resolveKnowledgeCodeowners } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 *
 * const codeowners = "* @kriegcloud\ndocs/ @docs-team @kriegcloud\n"
 *
 * console.log(resolveKnowledgeCodeowners(codeowners, "docs/README.md")) // [ "@docs-team", "@kriegcloud" ]
 * ```
 *
 * @param codeowners - The CODEOWNERS file text.
 * @param repoPath - A repository-relative path with forward slashes.
 * @returns The winning line's owners, empty when the path has no owner.
 * @category utilities
 * @since 0.0.0
 */
export const resolveKnowledgeCodeowners: {
  (repoPath: string): (codeowners: string) => ReadonlyArray<string>;
  (codeowners: string, repoPath: string): ReadonlyArray<string>;
} = dual(
  2,
  (codeowners: string, repoPath: string): ReadonlyArray<string> =>
    O.getOrElse(matchCodeownersOwners(codeowners, repoPath), A.empty<string>)
);

/* -------------------------------------------------------------------------------------------------
 * Evaluation
 * ---------------------------------------------------------------------------------------------- */

/**
 * The inputs of one lease evaluation.
 *
 * **Details**
 *
 * `baseLeases` are the merge-base rows, which pin `issued`; `codeowners` is the merge-base
 * `.github/CODEOWNERS` text, `O.none()` when the file is absent there; `leases` are the scanned
 * tree's rows; `now` is the instant expiry is judged at.
 *
 * **Example** (No leases)
 *
 * ```ts
 * import { KnowledgeLeaseEvaluationInput } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const input = KnowledgeLeaseEvaluationInput.make({
 *   leases: [],
 *   baseLeases: [],
 *   codeowners: O.none(),
 *   now: DateTime.makeUnsafe("2026-10-14T00:00:00Z"),
 * })
 *
 * console.log(input.leases.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeLeaseEvaluationInput extends S.Opaque<
  KnowledgeLeaseEvaluationInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    baseLeases: S.Array(KnowledgeDebtLease),
    codeowners: S.Option(S.String),
    leases: S.Array(KnowledgeDebtLease),
    now: S.DateTimeUtc,
  }).pipe(
    $I.annoteSchema("KnowledgeLeaseEvaluationInput", {
      description:
        "Tree leases, merge-base leases, merge-base CODEOWNERS text, and the instant a lease evaluation judges at.",
    })
  )
) {}

const leaseStatus = (lease: KnowledgeDebtLease, now: DateTime.Utc): KnowledgeLeaseStatus => {
  if (!DateTime.isGreaterThan(lease.expires, now)) {
    return "expired";
  }
  return Duration.isLessThanOrEqualTo(DateTime.distance(now, lease.expires), KNOWLEDGE_LEASE_WARNING_WINDOW)
    ? "expiring"
    : "active";
};

const leaseIssuedOrder: Order.Order<KnowledgeDebtLease> = Order.combine(
  Order.mapInput(DateTime.Order, (lease: KnowledgeDebtLease) => lease.issued),
  Order.mapInput(Order.String, (lease: KnowledgeDebtLease) => lease.key)
);

type LeaseVerdict = readonly [KnowledgeLeaseViolation, string];

const ownerVerdict = (lease: KnowledgeDebtLease, codeowners: string): O.Option<LeaseVerdict> => {
  const owners = resolveKnowledgeCodeowners(codeowners, lease.document);
  return A.contains(owners, lease.owner)
    ? O.none()
    : O.some([
        "lease-owner-unresolved",
        `Owner ${lease.owner} is not a merge-base CODEOWNERS owner of ${lease.document} (owners: ${
          A.isReadonlyArrayNonEmpty(owners) ? A.join(owners, " ") : "none"
        }).`,
      ]);
};

const lifetimeVerdicts = (
  lease: KnowledgeDebtLease,
  baseIssued: HashMap.HashMap<string, DateTime.Utc>,
  now: DateTime.Utc
): ReadonlyArray<LeaseVerdict> => {
  const lifetime = DateTime.distance(lease.issued, lease.expires);
  const tooLong = Duration.isGreaterThan(lifetime, KNOWLEDGE_LEASE_MAX_LIFETIME);
  const inverted = Duration.isLessThan(lifetime, Duration.zero);
  const mutated = O.exists(HashMap.get(baseIssued, lease.key), (issued) => !DateTime.Equivalence(issued, lease.issued));
  const futureIssued = DateTime.isGreaterThan(lease.issued, now);
  return A.getSomes([
    futureIssued
      ? O.some<LeaseVerdict>([
          "lease-issued-in-future",
          `Lease issued at ${DateTime.formatIso(lease.issued)} is in the future relative to ${DateTime.formatIso(now)}.`,
        ])
      : O.none(),
    tooLong || inverted
      ? O.some<LeaseVerdict>([
          "lease-lifetime-exceeded",
          `Lease runs from ${DateTime.formatIso(lease.issued)} to ${DateTime.formatIso(lease.expires)}; the cap is 30 days.`,
        ])
      : O.none(),
    mutated
      ? O.some<LeaseVerdict>([
          "lease-lifetime-exceeded",
          "Lease issued date differs from the merge-base row; issued is immutable, so renewal cannot outrun the cap.",
        ])
      : O.none(),
  ]);
};

// Earliest-issued leases keep their quota slot; every later non-expired lease past a quota breaks it.
const quotaVerdicts = (
  leases: ReadonlyArray<KnowledgeDebtLease>,
  now: DateTime.Utc
): HashMap.HashMap<string, LeaseVerdict> => {
  const live = A.sort(
    A.filter(leases, (lease) => !DateTime.isGreaterThan(lease.issued, now) && leaseStatus(lease, now) !== "expired"),
    leaseIssuedOrder
  );
  return A.reduce(
    live,
    {
      verdicts: HashMap.empty<string, LeaseVerdict>(),
      perDocument: HashMap.empty<string, number>(),
      repo: 0,
    },
    (state, lease) => {
      const documentCount = O.getOrElse(HashMap.get(state.perDocument, lease.document), () => 0);
      const verdict =
        documentCount >= KNOWLEDGE_LEASES_PER_DOCUMENT
          ? O.some<LeaseVerdict>([
              "lease-quota-exceeded",
              `${lease.document} already holds ${KNOWLEDGE_LEASES_PER_DOCUMENT} active lease(s).`,
            ])
          : state.repo >= KNOWLEDGE_LEASES_PER_REPO
            ? O.some<LeaseVerdict>([
                "lease-quota-exceeded",
                `The repository already holds ${KNOWLEDGE_LEASES_PER_REPO} active lease(s).`,
              ])
            : O.none<LeaseVerdict>();
      return O.match(verdict, {
        onSome: (value) => ({ ...state, verdicts: HashMap.set(state.verdicts, lease.key, value) }),
        onNone: () => ({
          verdicts: state.verdicts,
          perDocument: HashMap.set(state.perDocument, lease.document, documentCount + 1),
          repo: state.repo + 1,
        }),
      });
    }
  ).verdicts;
};

const leaseRowOrder = Order.mapInput(Order.String, (row: KnowledgeLeaseRow) => row.key);

/**
 * Evaluates every lease of a tree: expiry status, owner binding, lifetime, and quotas.
 *
 * **Details**
 *
 * Owners resolve from the merge-base CODEOWNERS, never the tree's own, so a branch cannot grant itself
 * ownership (K6). `issued` is compared against the merge-base row with the same key. Quotas count
 * non-expired leases in `issued` order, so the earliest leases keep their slots. Rows are sorted by
 * key. Future-issued rows are ineffective and do not occupy quota slots.
 *
 * **Gotchas**
 *
 * Leases without a CODEOWNERS file fail closed with `missing-codeowners`; an empty lease list never
 * reads CODEOWNERS.
 *
 * **Example** (No leases need no owner table)
 *
 * ```ts
 * import {
 *   evaluateKnowledgeLeases,
 *   KnowledgeLeaseEvaluationInput,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const rows = evaluateKnowledgeLeases(
 *   KnowledgeLeaseEvaluationInput.make({
 *     leases: [],
 *     baseLeases: [],
 *     codeowners: O.none(),
 *     now: DateTime.makeUnsafe("2026-10-14T00:00:00Z"),
 *   })
 * )
 *
 * console.log(Effect.isEffect(rows)) // true
 * ```
 *
 * @param input - Tree leases, merge-base leases, merge-base CODEOWNERS text, and the instant to judge at.
 * @returns One row per lease, sorted by key.
 * @category use-cases
 * @since 0.0.0
 */
export const evaluateKnowledgeLeases = Effect.fn("KnowledgeDoctor.evaluateLeases")(function* (
  input: KnowledgeLeaseEvaluationInput
) {
  if (A.isReadonlyArrayEmpty(input.leases)) {
    return A.empty<KnowledgeLeaseRow>();
  }
  const codeowners = yield* Effect.fromOption(input.codeowners).pipe(
    Effect.mapError(() =>
      KnowledgeDoctorInputError.of(
        "missing-codeowners",
        KNOWLEDGE_CODEOWNERS_PATH,
        `${A.length(input.leases)} lease(s) exist but the merge-base tree has no ${KNOWLEDGE_CODEOWNERS_PATH}.`
      )
    )
  );
  const baseIssued = HashMap.fromIterable(A.map(input.baseLeases, (lease) => [lease.key, lease.issued] as const));
  const quotas = quotaVerdicts(input.leases, input.now);
  const rows = A.map(input.leases, (lease) => {
    const verdicts = A.appendAll(
      A.appendAll(O.toArray(ownerVerdict(lease, codeowners)), lifetimeVerdicts(lease, baseIssued, input.now)),
      O.toArray(HashMap.get(quotas, lease.key))
    );
    return KnowledgeLeaseRow.make({
      key: lease.key,
      document: lease.document,
      owner: lease.owner,
      expires: lease.expires,
      status: leaseStatus(lease, input.now),
      violations: A.dedupe(A.map(verdicts, ([violation]) => violation)),
      details: A.map(verdicts, ([, detail]) => detail),
    });
  });
  return A.sort(rows, leaseRowOrder);
});

/**
 * Whether a lease row still suppresses its finding: not expired and free of violations.
 *
 * **Example** (A violating lease does not suppress)
 *
 * ```ts
 * import { isKnowledgeLeaseEffective, KnowledgeLeaseRow } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as DateTime from "effect/DateTime"
 *
 * const row = KnowledgeLeaseRow.make({
 *   key: `knowledge-doctor/v1:${"a".repeat(64)}`,
 *   document: "docs/README.md",
 *   owner: "@someone",
 *   expires: DateTime.makeUnsafe("2026-10-28T00:00:00Z"),
 *   status: "active",
 *   violations: ["lease-owner-unresolved"],
 *   details: [],
 * })
 *
 * console.log(isKnowledgeLeaseEffective(row)) // false
 * ```
 *
 * @param row - One evaluated lease.
 * @returns `true` when the lease is unexpired and breaks no rule.
 * @category predicates
 * @since 0.0.0
 */
export const isKnowledgeLeaseEffective = (row: KnowledgeLeaseRow): boolean =>
  row.status !== "expired" && A.isReadonlyArrayEmpty(row.violations);

/**
 * Renders the warning lines yeet prints for a lease report: expiring, expired, and violating leases.
 *
 * **Example** (A clean report warns about nothing)
 *
 * ```ts
 * import {
 *   KnowledgeLeasesReport,
 *   knowledgeLeaseWarnings,
 * } from "@beep/repo-cli/commands/Knowledge/KnowledgeDoctor.leases"
 * import * as DateTime from "effect/DateTime"
 *
 * const report = KnowledgeLeasesReport.make({
 *   tree: "1111111111111111111111111111111111111111",
 *   mergeBase: "2222222222222222222222222222222222222222",
 *   now: DateTime.makeUnsafe("2026-10-14T00:00:00Z"),
 *   leases: [],
 * })
 *
 * console.log(knowledgeLeaseWarnings(report)) // []
 * ```
 *
 * @param report - The decoded `knowledge doctor leases --json` report.
 * @returns One line per lease that needs attention, in key order.
 * @category formatting
 * @since 0.0.0
 */
export const knowledgeLeaseWarnings = (report: KnowledgeLeasesReport): ReadonlyArray<string> =>
  A.getSomes(
    A.map(report.leases, (row) =>
      row.status === "active" && A.isReadonlyArrayEmpty(row.violations)
        ? O.none()
        : O.some(
            `knowledge lease ${row.key} on ${row.document} (${row.owner}) ${row.status}, expires ${DateTime.formatIso(
              row.expires
            )}${A.isReadonlyArrayEmpty(row.details) ? "" : `: ${A.join(row.details, " ")}`}`
          )
    )
  );
