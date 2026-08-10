/**
 * Edge authority command payloads.
 *
 * These are the only three shapes a caller may hand the bitemporal edge
 * repository: assert a fact, supersede a known version of a fact, and ask what
 * was believed at a point on both axes. Time arrives as epoch millis and decodes
 * to `DateTime.Utc`, exactly as the persisted `EdgeVersion` row does, so a
 * command and the row it produces speak one temporal language.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Derived from Graphiti (https://github.com/getzep/graphiti), v0.29.2,
 * commit ff7e29ccd127d8d9721b5cbb2163a6407ef915fe.
 * Copyright 2024, 2025 Zep Software, Inc. Licensed under the Apache License,
 * Version 2.0. See THIRD_PARTY_NOTICES.md.
 *
 * Modified: reimplemented in Effect/TypeScript over Postgres; no upstream
 * source was copied. Supersession is issued as one command against a single
 * locked repository transaction rather than the donor's caller-assembled
 * resolved-plus-invalidated edge save list, so the caller never holds a
 * partially applied correction.
 */

import { LogicalEdgeIdentity, LogicalEdgeKey } from "@beep/epistemic-domain/values";
import { $EpistemicUseCasesId } from "@beep/identity/packages";
import { UnknownRecord } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { PosInt } from "@beep/schema/Int";
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { SourceKind } from "@beep/shared-domain/entity/SourceKind";
import * as Shared from "@beep/shared-domain/identity/Shared";
import { Equal } from "effect";
import * as S from "effect/Schema";

const $I = $EpistemicUseCasesId.create("EdgeAuthority/EdgeAuthority.commands");

/**
 * Audit provenance every edge write carries. The repository derives the row's
 * `createdAt`/`updatedAt` from the command's `recordedAt` and its principals
 * from `recordedBy`; nothing here is inferred from ambient state.
 *
 * `orgId` is the typed organization the row belongs to. It is carried separately
 * from `identity.orgScope` because the digest needs the org as a string component
 * while the row needs it as an entity id. That the two denote the same
 * organization is enforced by {@link OrgScopeAgreementCheck} on the command
 * schemas themselves — see the check for why it lives here rather than in the
 * repository.
 */
const edgeFactAuditFields = {
  orgId: Shared.OrganizationId.annotateKey({
    description: "Organization the edge version belongs to; must denote the identity's org scope.",
  }),
  recordedBy: Principal.annotateKey({
    description: "Principal that asserted the fact.",
  }),
  schemaVersion: SemanticVersion.annotateKey({
    description: "Schema version stamped on the written edge version.",
  }),
  source: SourceKind.annotateKey({
    description: "Origin kind stamped on the written edge version.",
  }),
} as const;

/**
 * Cross-field agreement between the two places a command names its organization:
 * `identity.orgScope`, the string component folded into the logical-edge digest,
 * and `orgId`, the typed entity id stamped on the row.
 *
 * They must denote the same organization. A disagreement is not a database
 * problem the repository could catch — the write would succeed, producing a row
 * owned by one organization under a digest partitioned by another, and every
 * later read of that logical edge would silently mix two tenants. The command is
 * therefore the enforcement point: a command that cannot be decoded cannot be
 * issued, so the mismatch is unrepresentable rather than merely rejected.
 *
 * The failure is reported at the `identity.orgScope` path, since that is the
 * component the caller derived rather than the id it was given.
 */
const OrgScopeAgreementCheck = S.makeFilter(
  (command: { readonly identity: LogicalEdgeIdentity; readonly orgId: Shared.OrganizationId }) =>
    Equal.equals(command.identity.orgScope, `${command.orgId}`)
      ? undefined
      : {
          path: ["identity", "orgScope"],
          issue: `Logical edge identity org scope "${command.identity.orgScope}" does not denote organization ${command.orgId}.`,
        },
  {
    identifier: $I`OrgScopeAgreementCheck`,
    title: "Org scope agreement",
    description: "The logical edge identity's org scope must denote the command's organization id.",
  }
);

const RecordEdgeFactFields = S.Struct({
  ...edgeFactAuditFields,
  fact: UnknownRecord.annotateKey({
    description: "Immutable payload asserted by the edge version.",
  }),
  identity: LogicalEdgeIdentity.annotateKey({
    description: "Time-independent identity of the logical edge being asserted.",
  }),
  recordedAt: EntitySchema.DateTimeFromMillis.annotateKey({
    description: "Inclusive transaction-time lower bound: when the assertion became known.",
  }),
  validFrom: EntitySchema.DateTimeFromMillis.annotateKey({
    description: "Inclusive valid-time lower bound: when the fact started being true.",
  }),
  validTo: EntitySchema.DateTimeFromMillis.pipe(S.OptionFromNullOr).annotateKey({
    description: "Exclusive valid-time upper bound; absent while the fact is still held true.",
  }),
}).pipe(S.check(OrgScopeAgreementCheck));

/**
 * Assert a fact about a logical edge over a known valid-time interval.
 *
 * **Details**
 *
 * `validFrom` is required, not optional-with-a-default: the donor's null
 * valid-time hole is the reason an edge can participate in supersession without
 * anyone knowing when it started being true, and a required field is the
 * cheapest place to close it. `validTo` absent means the fact is still held
 * true. `recordedAt` is when the assertion became known, which for a late
 * arrival is the arrival instant and not the fact's own valid time.
 *
 * `identity.orgScope` must denote `orgId`; see {@link OrgScopeAgreementCheck}.
 *
 * **Example** (Decode RecordEdgeFact command)
 *
 * ```ts
 * import { RecordEdgeFact } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import * as S from "effect/Schema"
 *
 * const command = S.decodeUnknownSync(RecordEdgeFact)({
 *   fact: { note: "cited in the office action" },
 *   identity: {
 *     evidenceScope: null,
 *     matterScope: null,
 *     orgScope: "1",
 *     qualifiers: {},
 *     relation: "supports",
 *     source: { kind: "claim", claimId: 1 },
 *     target: { kind: "evidence", evidenceId: 2 }
 *   },
 *   orgId: 1,
 *   recordedAt: 1_000,
 *   recordedBy: { kind: "System", component: "Runtime" },
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   validFrom: 1_000,
 *   validTo: null
 * })
 *
 * console.log(command.identity.relation)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class RecordEdgeFact extends S.Class<RecordEdgeFact>($I`RecordEdgeFact`)(
  RecordEdgeFactFields,
  $I.annote("RecordEdgeFact", {
    description: "Command asserting one fact about a logical epistemic edge over a known valid-time interval.",
  })
) {}

const SupersedeEdgeFactFields = S.Struct({
  ...edgeFactAuditFields,
  expectedVersion: PosInt.annotateKey({
    description: "Version the caller believes is the open head of the logical edge.",
  }),
  fact: UnknownRecord.annotateKey({
    description: "Immutable payload asserted by the replacement edge version.",
  }),
  identity: LogicalEdgeIdentity.annotateKey({
    description: "Time-independent identity of the logical edge being superseded.",
  }),
  recordedAt: EntitySchema.DateTimeFromMillis.annotateKey({
    description: "Inclusive transaction-time lower bound: when the correction became known.",
  }),
  validFrom: EntitySchema.DateTimeFromMillis.annotateKey({
    description: "Inclusive valid-time lower bound of the replacement assertion.",
  }),
  validTo: EntitySchema.DateTimeFromMillis.pipe(S.OptionFromNullOr).annotateKey({
    description: "Exclusive valid-time upper bound of the replacement; the invalidating fact's valid time.",
  }),
}).pipe(S.check(OrgScopeAgreementCheck));

/**
 * Replace the version a caller believes is the open head of a logical edge.
 *
 * **Details**
 *
 * `expectedVersion` is the caller's optimistic claim about the head; the
 * repository compares it under a row lock and refuses with a typed
 * `SupersessionConflict` when it disagrees. `validFrom` is required for the same
 * structural reason it is on {@link RecordEdgeFact}, and `identity.orgScope` must
 * denote `orgId` — see {@link OrgScopeAgreementCheck}.
 *
 * When the supersession expresses a fact that became false at a known instant,
 * `validTo` on this replacement carries the valid time of the INVALIDATING fact
 * — never the wall clock at which the correction was made. That is the whole
 * donor rule in one field: a belief that stopped being true at noon stopped
 * being true at noon, no matter when anyone noticed.
 *
 * **Example** (Decode SupersedeEdgeFact command)
 *
 * ```ts
 * import { SupersedeEdgeFact } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import * as S from "effect/Schema"
 *
 * const command = S.decodeUnknownSync(SupersedeEdgeFact)({
 *   expectedVersion: 1,
 *   fact: { note: "withdrawn by the examiner" },
 *   identity: {
 *     evidenceScope: null,
 *     matterScope: null,
 *     orgScope: "1",
 *     qualifiers: {},
 *     relation: "supports",
 *     source: { kind: "claim", claimId: 1 },
 *     target: { kind: "evidence", evidenceId: 2 }
 *   },
 *   orgId: 1,
 *   recordedAt: 2_500,
 *   recordedBy: { kind: "System", component: "Runtime" },
 *   schemaVersion: "0.0.0",
 *   source: "Agent",
 *   validFrom: 1_000,
 *   validTo: 2_000
 * })
 *
 * console.log(command.expectedVersion)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class SupersedeEdgeFact extends S.Class<SupersedeEdgeFact>($I`SupersedeEdgeFact`)(
  SupersedeEdgeFactFields,
  $I.annote("SupersedeEdgeFact", {
    description: "Command replacing the open head of a logical epistemic edge with a new version.",
  })
) {}

/**
 * Ask what was believed about a logical edge at a point on both axes: what was
 * true at `validAt`, as far as anyone knew at `knownAt`.
 *
 * **Details**
 *
 * The two instants are independent on purpose. Holding `validAt` fixed and
 * moving `knownAt` forward replays how belief about one moment changed; that is
 * the question a non-bitemporal store cannot answer at all.
 *
 * **Example** (Decode EdgeAsOfQuery command)
 *
 * ```ts
 * import { EdgeAsOfQuery } from "@beep/epistemic-use-cases/EdgeAuthority"
 * import * as S from "effect/Schema"
 *
 * const query = S.decodeUnknownSync(EdgeAsOfQuery)({
 *   knownAt: 2_500,
 *   logicalKey: "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe",
 *   validAt: 1_500
 * })
 *
 * console.log(query.logicalKey.length)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class EdgeAsOfQuery extends S.Class<EdgeAsOfQuery>($I`EdgeAsOfQuery`)(
  {
    knownAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Transaction-time instant the answer is asked as-of: what was known then.",
    }),
    logicalKey: LogicalEdgeKey.annotateKey({
      description: "Digest naming the logical edge being read.",
    }),
    validAt: EntitySchema.DateTimeFromMillis.annotateKey({
      description: "Valid-time instant the answer is asked about: what was true then.",
    }),
  },
  $I.annote("EdgeAsOfQuery", {
    description: "Two-axis read contract for one logical epistemic edge.",
  })
) {}
