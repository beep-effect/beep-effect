/**
 * Edge authority command payloads.
 *
 * **Details**
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
import { SemanticVersion } from "@beep/schema/SemanticVersion";
import { Principal } from "@beep/shared-domain/entity/Principal";
import { SourceKind } from "@beep/shared-domain/entity/SourceKind";
import * as Shared from "@beep/shared-domain/identity/Shared";
import * as Equal from "effect/Equal";
import * as S from "effect/Schema";
import { PosInt } from "../internal/PosInt.ts";

const UnknownRecord = S.Record(S.String, S.Unknown);

const $I = $EpistemicUseCasesId.create("EdgeAuthority/EdgeAuthority.commands");

const edgeFactAuditFields = {
  orgId: Shared.OrganizationId.annotateKey({
    description:
      "Typed organization id stamped on the row; identity.orgScope names the same organization as a digest string.",
  }),
  recordedBy: Principal.annotateKey({
    description: "Principal that asserted the fact; stamped as the row's created and updated principal.",
  }),
  schemaVersion: SemanticVersion.annotateKey({
    description: "Schema version stamped on the written edge version.",
  }),
  source: SourceKind.annotateKey({
    description: "Origin kind stamped on the written edge version.",
  }),
} as const;

const OrgScopeAgreementCheck = S.makeFilter(
  (command: { readonly identity: Pick<LogicalEdgeIdentity, "orgScope">; readonly orgId: Shared.OrganizationId }) =>
    Equal.equals(command.identity.orgScope, `${command.orgId}`)
      ? undefined
      : {
          path: ["identity", "orgScope"],
          issue: `Logical edge identity org scope "${command.identity.orgScope}" does not denote organization ${command.orgId}.`,
        },
  $I.annote("OrgScopeAgreementCheck", {
    title: "Org scope agreement",
    description:
      "The logical edge identity's org scope must denote the command's organization id. The database would accept a mismatched row, filed under another organization's digest partition and mixing two tenants on every read, so the command refuses to decode; the issue sits at identity.orgScope, the component the caller derived.",
  })
);

const RecordEdgeFactFields = S.Struct({
  ...edgeFactAuditFields,
  fact: UnknownRecord.annotateKey({
    description: "Immutable payload asserted by the edge version.",
  }),
  identity: LogicalEdgeIdentity.annotateKey({
    description: "Time-independent identity of the logical edge being asserted.",
  }),
  recordedAt: S.DateTimeUtcFromMillis.annotateKey({
    description: "Inclusive transaction-time lower bound: when the assertion became known.",
  }),
  validFrom: S.DateTimeUtcFromMillis.annotateKey({
    description: "Inclusive valid-time lower bound: when the fact started being true.",
  }),
  validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr).annotateKey({
    description: "Exclusive valid-time upper bound; absent while the fact is still held true.",
  }),
}).pipe(S.check(OrgScopeAgreementCheck));

/**
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
export class RecordEdgeFact extends S.Opaque<RecordEdgeFact, { readonly brand: unique symbol }>()(
  RecordEdgeFactFields.pipe(
    $I.annoteSchema("RecordEdgeFact", {
      description: "Command asserting one fact about a logical epistemic edge over a known valid-time interval.",
    })
  )
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
  recordedAt: S.DateTimeUtcFromMillis.annotateKey({
    description: "Inclusive transaction-time lower bound: when the correction became known.",
  }),
  validFrom: S.DateTimeUtcFromMillis.annotateKey({
    description: "Inclusive valid-time lower bound of the replacement assertion.",
  }),
  validTo: S.DateTimeUtcFromMillis.pipe(S.OptionFromNullOr).annotateKey({
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
export class SupersedeEdgeFact extends S.Opaque<SupersedeEdgeFact, { readonly brand: unique symbol }>()(
  SupersedeEdgeFactFields.pipe(
    $I.annoteSchema("SupersedeEdgeFact", {
      description: "Command replacing the open head of a logical epistemic edge with a new version.",
    })
  )
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
export class EdgeAsOfQuery extends S.Opaque<EdgeAsOfQuery, { readonly brand: unique symbol }>()(
  S.Struct({
    knownAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Transaction-time instant the answer is asked as-of: what was known then.",
    }),
    logicalKey: LogicalEdgeKey.annotateKey({
      description: "Digest naming the logical edge being read.",
    }),
    validAt: S.DateTimeUtcFromMillis.annotateKey({
      description: "Valid-time instant the answer is asked about: what was true then.",
    }),
  }).pipe(
    $I.annoteSchema("EdgeAsOfQuery", {
      description: "Two-axis read contract for one logical epistemic edge.",
    })
  )
) {}
