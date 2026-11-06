/**
 * Harvest provenance ledger schemas (`harvest-ledger/v1`).
 *
 * **Details**
 *
 * `beep goals harvest` projects the alpha that packets carry (reflection
 * findings and todos, friction receipts, unchecked plan items, manifest status
 * notes and stop conditions, decision files, exploration open questions) into
 * one JSON Lines ledger. Every row cites its file, 1-based line and the commit
 * it was read at, and its id is a content address that stays stable across
 * runs while the cited text and location are unchanged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as S from "effect/Schema";
import { GitCommitSha } from "../Codex/Findings.capture.schemas.ts";
import { PacketRoot, PacketSlug, PacketStatusToken } from "./PacketCore/PacketCore.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/Harvest.schemas");

/**
 * Where a harvested row came from inside a packet or ledger.
 *
 * **Example** (Check source membership)
 *
 * ```ts
 * import { HarvestSource } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 *
 * console.log(HarvestSource.is["friction-receipt"]("friction-receipt")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HarvestSource = LiteralKit([
  "reflection-finding",
  "reflection-todo",
  "friction-receipt",
  "plan-unchecked",
  "status-note",
  "stop-condition",
  "decision-file",
  "open-question",
]).pipe(
  $I.annoteSchema("HarvestSource", {
    description: "Origin of a harvested provenance row (reflection, friction receipt, plan, manifest, decision).",
  })
);

/**
 * Origin of a harvested provenance row.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HarvestSource = typeof HarvestSource.Type;

/**
 * Which packet roots a `beep goals harvest` run reads; `all` also reads
 * tracked ledgers outside any packet.
 *
 * **Example** (Check kind membership)
 *
 * ```ts
 * import { HarvestKind } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 *
 * console.log(HarvestKind.literals) // ["goals", "explorations", "all"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HarvestKind = LiteralKit(["goals", "explorations", "all"]).pipe(
  $I.annoteSchema("HarvestKind", {
    description: "Packet roots a harvest run reads: goals, explorations, or all (plus non-packet ledgers).",
  })
);

/**
 * Packet roots a harvest run reads.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HarvestKind = typeof HarvestKind.Type;

/**
 * Content address of a harvest row: the sha-256 of the canonical JSON of its
 * packet root, slug, source, file, line and text.
 *
 * **Details**
 *
 * The read commit is deliberately excluded, so a row keeps its id across
 * commits until its text or location changes.
 *
 * **Example** (Validate a row id)
 *
 * ```ts
 * import { HarvestRowId } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HarvestRowId)("a".repeat(64))) // true
 * console.log(S.is(HarvestRowId)("abc")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HarvestRowId = Sha256Hex.pipe(
  $I.annoteSchema("HarvestRowId", {
    description: "sha-256 of the canonical JSON of {root, slug, source, file, line, text} for one harvest row.",
  })
);

/**
 * Content address of a harvest row.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HarvestRowId = typeof HarvestRowId.Type;

/**
 * The packet a harvested row belongs to.
 *
 * **Example** (Reference a goal packet)
 *
 * ```ts
 * import { HarvestPacketRef } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 *
 * const ref = HarvestPacketRef.make({ root: "goals", slug: "packet-archive-mechanics" })
 * console.log(ref.root) // "goals"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarvestPacketRef extends S.Class<HarvestPacketRef, { readonly brand: unique symbol }>(
  $I`HarvestPacketRef`
)(
  {
    root: PacketRoot,
    slug: PacketSlug,
  },
  $I.annote("HarvestPacketRef", {
    description: "Packet root and slug a harvested row was read from.",
  })
) {}

/**
 * A harvested row before its packet context, read commit and id are attached:
 * the source, location, text and optional reflection metadata.
 *
 * **Example** (Construct a plan-item draft)
 *
 * ```ts
 * import { HarvestRowDraft } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 *
 * const draft = HarvestRowDraft.make({ source: "plan-unchecked", file: "goals/demo/PLAN.md", line: 4, text: "Ship it" })
 * console.log(draft.line) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarvestRowDraft extends S.Opaque<HarvestRowDraft, { readonly brand: unique symbol }>()(
  S.Struct({
    source: HarvestSource,
    file: S.String,
    line: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    text: S.String,
    category: S.optionalKey(S.String),
    confidence: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("HarvestRowDraft", {
      description: "Harvested row source, location, text and reflection metadata before id and packet context.",
    })
  )
) {}

/**
 * One harvested provenance row.
 *
 * **Details**
 *
 * `packet` is `null` for rows read from a ledger outside any packet (for
 * example `infra/<area>/research/OPPORTUNITIES.md`); `status` is `null` when
 * the row has no packet or the packet manifest names no status. `terminal`
 * marks rows from goals in `completed-retained` or `superseded` and
 * explorations in `graduated` or `killed`.
 *
 * **Example** (Construct a friction-receipt row)
 *
 * ```ts
 * import { HarvestRow } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const row = S.decodeUnknownOption(HarvestRow)({
 *   id: "a".repeat(64),
 *   packet: { root: "goals", slug: "demo" },
 *   status: "active",
 *   terminal: false,
 *   source: "friction-receipt",
 *   file: "goals/demo/research/OPPORTUNITIES.md",
 *   line: 5,
 *   commit: "b".repeat(40),
 *   text: "## O1 — Slow check",
 * })
 * console.log(O.isSome(row)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarvestRow extends S.Class<HarvestRow, { readonly brand: unique symbol }>($I`HarvestRow`)(
  {
    id: HarvestRowId,
    packet: S.NullOr(HarvestPacketRef),
    status: S.NullOr(PacketStatusToken),
    terminal: S.Boolean,
    source: HarvestSource,
    file: S.String,
    line: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    commit: GitCommitSha,
    text: S.String,
    category: S.optionalKey(S.String),
    confidence: S.optionalKey(S.String),
  },
  $I.annote("HarvestRow", {
    description: "One harvested provenance row with its packet, source, file, 1-based line, read commit and text.",
  })
) {}

/**
 * Header line of a harvest ledger file: the ledger metadata without its rows.
 *
 * **Example** (Construct a header)
 *
 * ```ts
 * import { HarvestLedgerHeader } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 *
 * const header = HarvestLedgerHeader.make({
 *   schemaVersion: "harvest-ledger/v1",
 *   sourceCommit: "b".repeat(40),
 *   generatedAt: "2026-11-06T00:00:00.000Z",
 *   rowCount: 0,
 * })
 * console.log(header.rowCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarvestLedgerHeader extends S.Class<HarvestLedgerHeader, { readonly brand: unique symbol }>(
  $I`HarvestLedgerHeader`
)(
  {
    schemaVersion: S.tag("harvest-ledger/v1"),
    sourceCommit: GitCommitSha,
    generatedAt: S.String,
    rowCount: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("HarvestLedgerHeader", {
    description: "First JSON Lines record of a harvest ledger: schema version, source commit, time and row count.",
  })
) {}

/**
 * A complete harvest provenance ledger.
 *
 * **Details**
 *
 * On disk the ledger is JSON Lines: the {@link HarvestLedgerHeader} fields on
 * the first line, then one {@link HarvestRow} per line, each in canonical
 * key-sorted JSON.
 *
 * **Example** (Construct an empty ledger)
 *
 * ```ts
 * import { HarvestLedger } from "@beep/repo-cli/commands/Goals/Harvest.schemas"
 *
 * const ledger = HarvestLedger.make({
 *   schemaVersion: "harvest-ledger/v1",
 *   sourceCommit: "b".repeat(40),
 *   generatedAt: "2026-11-06T00:00:00.000Z",
 *   rowCount: 0,
 *   rows: [],
 * })
 * console.log(ledger.rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarvestLedger extends S.Class<HarvestLedger, { readonly brand: unique symbol }>($I`HarvestLedger`)(
  {
    ...HarvestLedgerHeader.fields,
    rows: S.Array(HarvestRow),
  },
  $I.annote("HarvestLedger", {
    description: "Harvest provenance ledger: header metadata plus every harvested row, in deterministic order.",
  })
) {}
