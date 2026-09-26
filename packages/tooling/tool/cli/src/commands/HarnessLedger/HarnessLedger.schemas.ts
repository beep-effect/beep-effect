/**
 * Schemas for the harness ledger command suite: command options, CLI token
 * codecs, list entries, and pruning-proposal reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import {
  BehavioralClaim,
  ContextSurfaceId,
  ContextSurfaceKind,
  HarnessEditRef,
  HarnessEditRefKind,
  HarnessLedgerDelta,
  HarnessLedgerRow,
  HarnessLedgerRowId,
  LedgerDisposition,
  MechanismClass,
} from "@beep/repo-ai-metrics";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { O, pipe, Str } from "@beep/utils";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { HarnessLedgerInputError } from "./HarnessLedger.errors.ts";

const $I = $RepoCliId.create("commands/HarnessLedger/HarnessLedger.schemas");

const WindowSessions = S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(1));

/**
 * Dispositions a human may record with `harness-ledger disposition`.
 *
 * **Details**
 *
 * `proposed` is excluded: only `propose` and `prune-proposals` open a chain
 * with it.
 *
 * **Example** (Checking an admission outcome)
 *
 * ```ts
 * import { HarnessLedgerAdmission } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(HarnessLedgerAdmission.is.accepted(HarnessLedgerAdmission.Enum.accepted)) // true
 * console.log(HarnessLedgerAdmission.is.accepted(HarnessLedgerAdmission.Enum.rejected)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HarnessLedgerAdmission = LiteralKit(LedgerDisposition.omitOptions(["proposed"])).pipe(
  $I.annoteSchema("HarnessLedgerAdmission", {
    description: "Human admission outcome recorded by a disposition row.",
  })
);

/**
 * Decoded admission outcome.
 *
 * @category models
 * @since 0.0.0
 */
export type HarnessLedgerAdmission = typeof HarnessLedgerAdmission.Type;

/**
 * Context surface kinds `prune-proposals` enumerates from the repo.
 *
 * **Example** (Listing prunable kinds)
 *
 * ```ts
 * import { PrunableSurfaceKind } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(PrunableSurfaceKind.Options) // ["skill", "hook", "mcp-server"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PrunableSurfaceKind = LiteralKit(ContextSurfaceKind.pickOptions(["skill", "hook", "mcp-server"])).pipe(
  $I.annoteSchema("PrunableSurfaceKind", {
    description: "Pruning surface kinds; hook rows remain decodable, but enumeration waits for execution telemetry.",
  })
);

/**
 * Decoded prunable surface kind.
 *
 * @category models
 * @since 0.0.0
 */
export type PrunableSurfaceKind = typeof PrunableSurfaceKind.Type;

/**
 * Mechanism class a pruning proposal records for each prunable surface kind.
 *
 * **Example** (Mapping a hook to its mechanism)
 *
 * ```ts
 * import { prunableSurfaceMechanism } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(prunableSurfaceMechanism("hook")) // "control_flow"
 * ```
 *
 * @param kind - Surface family being pruned: a skill directory, a hook file, or an `.mcp.json` server entry.
 * @returns The mechanism class the proposal row carries.
 * @category utilities
 * @since 0.0.0
 */
export const prunableSurfaceMechanism: (kind: PrunableSurfaceKind) => MechanismClass = PrunableSurfaceKind.$match({
  skill: () => MechanismClass.Enum.skill,
  hook: () => MechanismClass.Enum.control_flow,
  "mcp-server": () => MechanismClass.Enum.client_tool,
});

/**
 * Ledger month key `YYYY-MM`, the stem of a `harness-ledger/rows/*.jsonl` file.
 *
 * **Example** (Validating a month key)
 *
 * ```ts
 * import { HarnessLedgerMonth } from "@beep/repo-cli/commands/HarnessLedger"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HarnessLedgerMonth)("2026-09")) // true
 * console.log(S.is(HarnessLedgerMonth)("2026-9")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HarnessLedgerMonth = S.String.check(S.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/)).pipe(
  $I.annoteSchema("HarnessLedgerMonth", {
    description: "Ledger month key YYYY-MM naming one append-only rows file.",
  })
);

/**
 * Decoded ledger month key.
 *
 * @category models
 * @since 0.0.0
 */
export type HarnessLedgerMonth = typeof HarnessLedgerMonth.Type;

/**
 * One declared context surface, `<kind>:<name>`, before hashing.
 *
 * **Example** (Constructing a surface reference)
 *
 * ```ts
 * import { HarnessLedgerSurfaceRef } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(HarnessLedgerSurfaceRef.make({ kind: "skill", name: "yeet" }).name) // "yeet"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessLedgerSurfaceRef extends S.Class<HarnessLedgerSurfaceRef>($I`HarnessLedgerSurfaceRef`)(
  {
    kind: ContextSurfaceKind,
    name: S.NonEmptyString,
  },
  $I.annote("HarnessLedgerSurfaceRef", {
    description: "A context surface named by kind and bare name, hashed before it enters a row.",
  })
) {}

const EditSpecPrefix = LiteralKit(["commit", "diff"]);
const decodeEditSpecPrefix = S.decodeUnknownEffect(EditSpecPrefix);
const editKindForPrefix = EditSpecPrefix.$match({
  commit: () => HarnessEditRefKind.Enum.commit,
  diff: () => HarnessEditRefKind.Enum["diff-digest"],
});
const decodeEditRef = S.decodeUnknownEffect(HarnessEditRef);
const decodeSurfaceRef = S.decodeUnknownEffect(HarnessLedgerSurfaceRef);

const splitPrefixed = (spec: string): O.Option<readonly [string, string]> =>
  pipe(
    spec,
    Str.indexOf(":"),
    O.map((index) => [pipe(spec, Str.slice(0, index)), pipe(spec, Str.slice(index + 1))] as const)
  );

/**
 * Parse an `--edit` token: `commit:<sha>`, `diff:<sha256>`, or `pending`.
 *
 * **Example** (Parsing a commit edit)
 *
 * ```ts
 * import { parseHarnessEditSpec } from "@beep/repo-cli/commands/HarnessLedger"
 * import * as Effect from "effect/Effect"
 *
 * const edit = Effect.runSync(parseHarnessEditSpec("commit:489ea7c488"))
 * console.log(edit.kind) // "commit"
 * ```
 *
 * @param spec - Raw `--edit` value.
 * @returns The decoded edit reference.
 * @category parsing
 * @since 0.0.0
 */
export const parseHarnessEditSpec = Effect.fn("HarnessLedger.parseHarnessEditSpec")(function* (spec: string) {
  const invalid = HarnessLedgerInputError.new(`--edit "${spec}" is not commit:<sha>, diff:<sha256>, or pending.`);
  if (spec === HarnessEditRefKind.Enum.pending) {
    return yield* decodeEditRef({ kind: HarnessEditRefKind.Enum.pending }).pipe(Effect.mapError(() => invalid));
  }
  const [prefix, ref] = yield* Effect.fromOption(splitPrefixed(spec)).pipe(Effect.mapError(() => invalid));
  const kind = yield* decodeEditSpecPrefix(prefix).pipe(
    Effect.map(editKindForPrefix),
    Effect.mapError(() => invalid)
  );
  return yield* decodeEditRef({ kind, ref }).pipe(Effect.mapError(() => invalid));
});

/**
 * Parse a `--touched` or `--expected-surface`-style token `<kind>:<name>`.
 *
 * **Example** (Parsing a skill surface)
 *
 * ```ts
 * import { parseHarnessSurfaceSpec } from "@beep/repo-cli/commands/HarnessLedger"
 * import * as Effect from "effect/Effect"
 *
 * const surface = Effect.runSync(parseHarnessSurfaceSpec("skill:yeet"))
 * console.log(surface.kind) // "skill"
 * ```
 *
 * @param spec - Raw `<kind>:<name>` value.
 * @returns The decoded surface reference.
 * @category parsing
 * @since 0.0.0
 */
export const parseHarnessSurfaceSpec = Effect.fn("HarnessLedger.parseHarnessSurfaceSpec")(function* (spec: string) {
  const invalid = HarnessLedgerInputError.new(
    `--touched "${spec}" is not <kind>:<name> with kind one of ${ContextSurfaceKind.Options.join(" | ")}.`
  );
  const [kind, name] = yield* Effect.fromOption(splitPrefixed(spec)).pipe(Effect.mapError(() => invalid));
  return yield* decodeSurfaceRef({ kind, name }).pipe(Effect.mapError(() => invalid));
});

/**
 * Options for `harness-ledger propose`.
 *
 * **Example** (Proposing a pending skill edit)
 *
 * ```ts
 * import { HarnessLedgerProposeOptions } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * const options = HarnessLedgerProposeOptions.make({
 *   repoRoot: "/repo",
 *   mechanismClass: "skill",
 *   edit: { kind: "pending" }
 * })
 * console.log(options.mechanismClass) // "skill"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessLedgerProposeOptions extends S.Class<HarnessLedgerProposeOptions>($I`HarnessLedgerProposeOptions`)(
  {
    repoRoot: S.String,
    mechanismClass: MechanismClass,
    edit: HarnessEditRef,
    hypothesis: S.OptionFromOptionalKey(BehavioralClaim).pipe(SchemaUtils.withNoneDefault),
    modelId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    reasoningEffort: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    repoRevision: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("HarnessLedgerProposeOptions", {
    description: "Inputs for proposing one harness edit and capturing its fingerprint.",
  })
) {}

/**
 * Options for `harness-ledger disposition`.
 *
 * **Example** (Rejecting a proposal)
 *
 * ```ts
 * import { HarnessLedgerDispositionOptions } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * const options = HarnessLedgerDispositionOptions.make({
 *   repoRoot: "/repo",
 *   rowId: "hl-20260925-0a1b2c3d",
 *   to: "rejected",
 *   evidence: "score regressed on 3 of 4 tasks"
 * })
 * console.log(options.to) // "rejected"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessLedgerDispositionOptions extends S.Class<HarnessLedgerDispositionOptions>(
  $I`HarnessLedgerDispositionOptions`
)(
  {
    repoRoot: S.String,
    rowId: HarnessLedgerRowId,
    to: HarnessLedgerAdmission,
    evidence: S.NonEmptyString,
    delta: S.OptionFromOptionalKey(HarnessLedgerDelta).pipe(SchemaUtils.withNoneDefault),
    resurrectWhen: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    touched: S.Array(HarnessLedgerSurfaceRef).pipe(SchemaUtils.withKeyDefaults([])),
  },
  $I.annote("HarnessLedgerDispositionOptions", {
    description: "Inputs for appending a disposition row that supersedes the latest row of a chain.",
  })
) {}

/**
 * Options for `harness-ledger list`.
 *
 * **Example** (Listing stale rows)
 *
 * ```ts
 * import { HarnessLedgerListOptions } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(HarnessLedgerListOptions.make({ repoRoot: "/repo", staleOnly: true }).staleOnly) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessLedgerListOptions extends S.Class<HarnessLedgerListOptions>($I`HarnessLedgerListOptions`)(
  {
    repoRoot: S.String,
    staleOnly: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    disposition: S.OptionFromOptionalKey(LedgerDisposition).pipe(SchemaUtils.withNoneDefault),
    month: S.OptionFromOptionalKey(HarnessLedgerMonth).pipe(SchemaUtils.withNoneDefault),
    modelId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    reasoningEffort: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("HarnessLedgerListOptions", {
    description: "Filters for listing the latest row of every ledger chain.",
  })
) {}

/**
 * The latest row of one ledger chain, with its staleness and chain length.
 *
 * **Example** (Reading an entry's staleness)
 *
 * ```ts
 * import { HarnessLedgerListEntry } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(typeof HarnessLedgerListEntry.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessLedgerListEntry extends S.Class<HarnessLedgerListEntry>($I`HarnessLedgerListEntry`)(
  {
    row: HarnessLedgerRow,
    stale: S.Boolean,
    chainLength: WindowSessions,
  },
  $I.annote("HarnessLedgerListEntry", {
    description: "Latest row of a ledger chain plus whether its fingerprint is stale.",
  })
) {}

/**
 * Options for `harness-ledger prune-proposals`.
 *
 * **Example** (Dry-running a five-session window)
 *
 * ```ts
 * import { HarnessLedgerPruneOptions } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * const options = HarnessLedgerPruneOptions.make({ repoRoot: "/repo", stateDir: "/state", windowSessions: 5 })
 * console.log(options.write) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessLedgerPruneOptions extends S.Class<HarnessLedgerPruneOptions>($I`HarnessLedgerPruneOptions`)(
  {
    repoRoot: S.String,
    stateDir: S.String,
    windowSessions: WindowSessions,
    write: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    modelId: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
    reasoningEffort: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("HarnessLedgerPruneOptions", {
    description: "Repo root, hook-pulse state dir, session window, and write mode for pruning proposals.",
  })
) {}

/**
 * One prunable surface found in the repo, with its hashed id.
 *
 * **Example** (Describing a skill candidate)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { PruneSurfaceCandidate } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * const candidate = PruneSurfaceCandidate.make({ kind: "skill", name: "yeet", surfaceId: Sha256Hex.make("a".repeat(64)) })
 * console.log(candidate.name) // "yeet"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PruneSurfaceCandidate extends S.Class<PruneSurfaceCandidate>($I`PruneSurfaceCandidate`)(
  {
    kind: PrunableSurfaceKind,
    name: S.NonEmptyString,
    surfaceId: ContextSurfaceId,
  },
  $I.annote("PruneSurfaceCandidate", {
    description: "A skill, hook, or MCP server found in the repo, keyed by its hashed surface id.",
  })
) {}

/**
 * One zero-touch surface and the proposal row that would retire it.
 *
 * **Example** (Reading a proposal's surface)
 *
 * ```ts
 * import { PruneProposal } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(typeof PruneProposal.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PruneProposal extends S.Class<PruneProposal>($I`PruneProposal`)(
  {
    candidate: PruneSurfaceCandidate,
    row: HarnessLedgerRow,
  },
  $I.annote("PruneProposal", {
    description: "A zero-touch surface paired with the proposed ledger row.",
  })
) {}

/**
 * Observed hook-pulse window: the last N distinct sessions by newest event,
 * the surface ids they touched, and decode tallies.
 *
 * **Example** (Describing an empty window)
 *
 * ```ts
 * import { ObservedSessionWindow } from "@beep/repo-cli/commands/HarnessLedger"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const window = ObservedSessionWindow.make({
 *   sessionsObserved: 0,
 *   windowEnd: O.none(),
 *   touched: HashSet.empty(),
 *   shardsRead: 0,
 *   undecodableLines: 0
 * })
 * console.log(window.sessionsObserved) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ObservedSessionWindow extends S.Class<ObservedSessionWindow>($I`ObservedSessionWindow`)(
  {
    sessionsObserved: S.Finite,
    windowEnd: S.OptionFromOptionalKey(S.DateTimeUtcFromString),
    touched: S.HashSet(S.String),
    shardsRead: S.Finite,
    undecodableLines: S.Finite,
  },
  $I.annote("ObservedSessionWindow", {
    description: "Last N hook-pulse sessions, the surface ids they touched, and shard decode tallies.",
  })
) {}

/**
 * Result of one `prune-proposals` scan.
 *
 * **Details**
 *
 * `undecodableLines` counts hook-pulse lines that did not decode as
 * `HookPulseV1`; they are skipped, not fatal. `alreadyProposed` counts
 * zero-touch surfaces skipped because an open `proposed` chain already targets
 * them.
 *
 * **Example** (Checking a dry run)
 *
 * ```ts
 * import { HarnessLedgerPruneReport } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(typeof HarnessLedgerPruneReport.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HarnessLedgerPruneReport extends S.Class<HarnessLedgerPruneReport>($I`HarnessLedgerPruneReport`)(
  {
    windowSessions: WindowSessions,
    sessionsObserved: S.Finite,
    windowEnd: S.OptionFromOptionalKey(S.DateTimeUtcFromString),
    shardsRead: S.Finite,
    undecodableLines: S.Finite,
    candidates: S.Finite,
    touchedCandidates: S.Finite,
    alreadyProposed: S.Finite,
    proposals: S.Array(PruneProposal),
  },
  $I.annote("HarnessLedgerPruneReport", {
    description: "Session window, decode tallies, and the zero-touch proposals of one pruning scan.",
  })
) {}
