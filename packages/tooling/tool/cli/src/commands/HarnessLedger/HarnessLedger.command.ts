/**
 * `beep harness-ledger` — single writer of the append-only harness evidence
 * ledger at `harness-ledger/rows/YYYY-MM.jsonl`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  agentEvidenceRoot,
  aiMetricsStateHome,
  BehavioralClaim,
  ContextSurfaceKind,
  HarnessLedgerDelta,
  hookPulseLedgerDir,
  LedgerDisposition,
  MechanismClass,
} from "@beep/repo-ai-metrics";
import { findRepoRoot } from "@beep/repo-utils";
import { A, O, pipe, Str } from "@beep/utils";
import { Config, Console, DateTime, Effect } from "effect";
import * as S from "effect/Schema";
import { Command, Flag } from "effect/unstable/cli";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { jsonFlag } from "../../internal/cli/Flags.ts";
import { printCommandJson } from "../../internal/cli/Json.ts";
import { printLines } from "../../internal/cli/Printer.ts";
import { HarnessLedgerInputError, HarnessLedgerIoError } from "./HarnessLedger.errors.ts";
import {
  HarnessLedgerAdmission,
  HarnessLedgerDispositionOptions,
  HarnessLedgerListEntry,
  HarnessLedgerListOptions,
  HarnessLedgerMonth,
  HarnessLedgerProposeOptions,
  HarnessLedgerPruneOptions,
  HarnessLedgerPruneReport,
  parseHarnessEditSpec,
  parseHarnessSurfaceSpec,
} from "./HarnessLedger.schemas.ts";
import { HarnessLedgerService, HarnessLedgerServiceLive } from "./HarnessLedger.service.ts";
import { encodeLedgerRowValue } from "./internal/LedgerFiles.ts";
import type { HarnessLedgerRow } from "@beep/repo-ai-metrics";
import type { HarnessLedgerCommandError } from "./HarnessLedger.errors.ts";

const encodeListJson = S.encodeUnknownEffect(S.toCodecJson(S.Array(HarnessLedgerListEntry)));
const encodePruneJson = S.encodeUnknownEffect(S.toCodecJson(HarnessLedgerPruneReport));
const decodeMonth = S.decodeUnknownEffect(HarnessLedgerMonth);
const decodeDispositionOptions = S.decodeEffect(HarnessLedgerDispositionOptions);

const resolveRepoRoot = findRepoRoot().pipe(
  Effect.mapError(HarnessLedgerIoError.wrap("Failed to locate the repo root."))
);

const reportFailure = (command: string) => (error: HarnessLedgerCommandError) =>
  Console.error(`[harness-ledger:${command}] ${error.message}`).pipe(
    Effect.andThen(failWithReportedExit(`harness-ledger ${command}: ${error.message}`))
  );

const optionalNonEmpty = (value: O.Option<string>): O.Option<string> =>
  pipe(value, O.map(Str.trim), O.filter(Str.isNonEmpty));

const shortHypothesis = (row: HarnessLedgerRow): string =>
  O.match(row.hypothesis, {
    onNone: () => "-",
    onSome: (claim) => (Str.length(claim.claim) > 48 ? `${pipe(claim.claim, Str.slice(0, 47))}…` : claim.claim),
  });

const modelFlag = Flag.String("model").pipe(
  Flag.withDescription('Model id for the fingerprint (recorded as "unknown" when absent)'),
  Flag.optional
);
const reasoningEffortFlag = Flag.String("reasoning-effort").pipe(
  Flag.withDescription('Reasoning effort for the fingerprint (recorded as "unknown" when absent)'),
  Flag.optional
);

const listModelFlag = Flag.String("model").pipe(
  Flag.withDescription(
    "Compare --stale against this model id; when absent the model is not compared (each row's recorded model stands in)"
  ),
  Flag.optional
);
const listReasoningEffortFlag = Flag.String("reasoning-effort").pipe(
  Flag.withDescription(
    "Compare --stale against this reasoning effort; when absent the effort is not compared (each row's recorded effort stands in)"
  ),
  Flag.optional
);

// ---------------------------------------------------------------------------
// propose
// ---------------------------------------------------------------------------

const buildHypothesis = Effect.fn("HarnessLedger.buildHypothesis")(function* (
  claim: O.Option<string>,
  expectedSurface: O.Option<ContextSurfaceKind>,
  expectedMetric: O.Option<string>
) {
  const parts = [optionalNonEmpty(claim), expectedSurface, optionalNonEmpty(expectedMetric)] as const;
  if (A.every(parts, O.isNone)) {
    return O.none<BehavioralClaim>();
  }
  const [text, surface, metric] = parts;
  if (O.isNone(text) || O.isNone(surface) || O.isNone(metric)) {
    return yield* HarnessLedgerInputError.new(
      "--hypothesis, --expected-surface, and --expected-metric are given together or not at all."
    );
  }
  return O.some(
    BehavioralClaim.make({ claim: text.value, expectedSurface: surface.value, expectedMetric: metric.value })
  );
});

/**
 * `bun run beep harness-ledger propose` — record a proposed harness edit and
 * capture the harness fingerprint at creation.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { harnessLedgerProposeCommand } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(harnessLedgerProposeCommand.name) // "propose"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const harnessLedgerProposeCommand = Command.make(
  "propose",
  {
    mechanism: Flag.Literals("mechanism", MechanismClass.Options).pipe(
      Flag.withDescription(`Mechanism class: ${A.join(MechanismClass.Options, " | ")}`)
    ),
    edit: Flag.String("edit").pipe(Flag.withDescription("Edit reference: commit:<sha> | diff:<sha256> | pending")),
    hypothesis: Flag.String("hypothesis").pipe(Flag.withDescription("Falsifiable behavioral claim"), Flag.optional),
    expectedSurface: Flag.Literals("expected-surface", ContextSurfaceKind.Options).pipe(
      Flag.withDescription("Surface kind the claim expects to move"),
      Flag.optional
    ),
    expectedMetric: Flag.String("expected-metric").pipe(
      Flag.withDescription("Metric the claim expects to move"),
      Flag.optional
    ),
    model: modelFlag,
    reasoningEffort: reasoningEffortFlag,
    repoRevision: Flag.String("repo-revision").pipe(
      Flag.withDescription("Repo revision the edit applies to (never part of the fingerprint)"),
      Flag.optional
    ),
    json: jsonFlag,
  },
  Effect.fn(function* (input) {
    return yield* Effect.gen(function* () {
      const repoRoot = yield* resolveRepoRoot;
      const edit = yield* parseHarnessEditSpec(Str.trim(input.edit));
      const hypothesis = yield* buildHypothesis(input.hypothesis, input.expectedSurface, input.expectedMetric);
      const ledger = yield* HarnessLedgerService;
      const row = yield* ledger.propose(
        HarnessLedgerProposeOptions.make({
          repoRoot,
          mechanismClass: input.mechanism,
          edit,
          hypothesis,
          modelId: optionalNonEmpty(input.model),
          reasoningEffort: optionalNonEmpty(input.reasoningEffort),
          repoRevision: optionalNonEmpty(input.repoRevision),
        })
      );
      if (input.json) {
        return yield* printCommandJson(yield* encodeLedgerRowValue(row));
      }
      return yield* printLines([row.rowId, `Harness-Ledger: ${row.rowId}`]);
    }).pipe(
      Effect.catchTags({
        HarnessLedgerBusyError: reportFailure("propose"),
        HarnessLedgerInputError: reportFailure("propose"),
        HarnessLedgerChainError: reportFailure("propose"),
        HarnessLedgerIoError: reportFailure("propose"),
      })
    );
  })
).pipe(
  Command.withDescription("Append a proposed harness-edit row and print its Harness-Ledger trailer"),
  Command.provide(HarnessLedgerServiceLive)
);

// ---------------------------------------------------------------------------
// disposition
// ---------------------------------------------------------------------------

const buildDelta = Effect.fn("HarnessLedger.buildDelta")(function* (score: O.Option<number>, cost: O.Option<number>) {
  if (O.isNone(score) && O.isNone(cost)) {
    return O.none<HarnessLedgerDelta>();
  }
  if (O.isNone(score) || O.isNone(cost)) {
    return yield* HarnessLedgerInputError.new("--score and --cost are given together or not at all.");
  }
  return O.some(HarnessLedgerDelta.make({ score: score.value, cost: cost.value }));
});

/**
 * `bun run beep harness-ledger disposition` — append a row recording a human
 * disposition of the latest row of a chain.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { harnessLedgerDispositionCommand } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(harnessLedgerDispositionCommand.name) // "disposition"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const harnessLedgerDispositionCommand = Command.make(
  "disposition",
  {
    row: Flag.String("row").pipe(Flag.withDescription("Row id to supersede (must be the latest row of its chain)")),
    to: Flag.Literals("to", HarnessLedgerAdmission.Options).pipe(
      Flag.withDescription(`Disposition: ${A.join(HarnessLedgerAdmission.Options, " | ")}`)
    ),
    evidence: Flag.String("evidence").pipe(Flag.withDescription("Evidence for the disposition (required)")),
    score: Flag.Finite("score").pipe(Flag.withDescription("Measured score delta (with --cost)"), Flag.optional),
    cost: Flag.Finite("cost").pipe(Flag.withDescription("Measured cost delta (with --score)"), Flag.optional),
    resurrectWhen: Flag.String("resurrect-when").pipe(
      Flag.withDescription("Condition that would justify revisiting (only with --to tombstoned)"),
      Flag.optional
    ),
    touched: Flag.String("touched").pipe(
      Flag.atLeast(0),
      Flag.withDescription("Observed context surface <kind>:<name>; repeat for several")
    ),
    json: jsonFlag,
  },
  Effect.fn(function* (input) {
    return yield* Effect.gen(function* () {
      const repoRoot = yield* resolveRepoRoot;
      const evidence = Str.trim(input.evidence);
      if (Str.isEmpty(evidence)) {
        return yield* HarnessLedgerInputError.new("--evidence is required and must be non-empty.");
      }
      const delta = yield* buildDelta(input.score, input.cost);
      const touched = yield* Effect.forEach(input.touched, (spec) => parseHarnessSurfaceSpec(Str.trim(spec)));
      const options = yield* decodeDispositionOptions({
        repoRoot,
        rowId: Str.trim(input.row),
        to: input.to,
        evidence,
        touched: A.map(touched, (surface) => ({ kind: surface.kind, name: surface.name })),
      }).pipe(Effect.mapError(() => HarnessLedgerInputError.new(`--row "${input.row}" is not hl-<yyyymmdd>-<8 hex>.`)));
      const ledger = yield* HarnessLedgerService;
      const row = yield* ledger.disposition(
        HarnessLedgerDispositionOptions.make({
          ...options,
          delta,
          resurrectWhen: optionalNonEmpty(input.resurrectWhen),
        })
      );
      if (input.json) {
        return yield* printCommandJson(yield* encodeLedgerRowValue(row));
      }
      return yield* printLines([
        `${row.rowId} ${row.disposition} (supersedes ${O.getOrElse(row.previousRowId, () => "-")})`,
        `Harness-Ledger: ${row.rowId}`,
      ]);
    }).pipe(
      Effect.catchTags({
        HarnessLedgerBusyError: reportFailure("disposition"),
        HarnessLedgerInputError: reportFailure("disposition"),
        HarnessLedgerChainError: reportFailure("disposition"),
        HarnessLedgerIoError: reportFailure("disposition"),
      })
    );
  })
).pipe(
  Command.withDescription("Append a disposition row superseding the latest row of a chain"),
  Command.provide(HarnessLedgerServiceLive)
);

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

const listLines = (entries: ReadonlyArray<HarnessLedgerListEntry>): ReadonlyArray<string> =>
  A.match(entries, {
    onEmpty: () => ["No harness ledger rows."],
    onNonEmpty: (rows) => [
      "rowId\tcreatedAt\tmechanism\tdisposition\tstale\tchain\thypothesis",
      ...A.map(rows, (entry) =>
        A.join(
          [
            entry.row.rowId,
            DateTime.formatIso(entry.row.createdAt),
            entry.row.mechanismClass,
            entry.row.disposition,
            entry.stale ? "stale" : "fresh",
            `${entry.chainLength}`,
            shortHypothesis(entry.row),
          ],
          "\t"
        )
      ),
    ],
  });

/**
 * `bun run beep harness-ledger list` — fold every chain to its latest row.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { harnessLedgerListCommand } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(harnessLedgerListCommand.name) // "list"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const harnessLedgerListCommand = Command.make(
  "list",
  {
    stale: Flag.Boolean("stale").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Only rows whose harness surfaces changed, or whose model/effort differs from an explicit --model/--reasoning-effort; omitted components are not compared"
      )
    ),
    disposition: Flag.Literals("disposition", LedgerDisposition.Options).pipe(
      Flag.withDescription("Only chains whose latest row has this disposition"),
      Flag.optional
    ),
    month: Flag.String("month").pipe(
      Flag.withDescription("Only chains whose latest row was written in YYYY-MM"),
      Flag.optional
    ),
    model: listModelFlag,
    reasoningEffort: listReasoningEffortFlag,
    json: jsonFlag,
  },
  Effect.fn(function* (input) {
    return yield* Effect.gen(function* () {
      const repoRoot = yield* resolveRepoRoot;
      const month = yield* O.match(optionalNonEmpty(input.month), {
        onNone: () => Effect.succeedNone,
        onSome: (value) =>
          decodeMonth(value).pipe(
            Effect.asSome,
            Effect.mapError(() => HarnessLedgerInputError.new(`--month "${value}" is not YYYY-MM.`))
          ),
      });
      const ledger = yield* HarnessLedgerService;
      const entries = yield* ledger.list(
        HarnessLedgerListOptions.make({
          repoRoot,
          staleOnly: input.stale,
          disposition: input.disposition,
          month,
          modelId: optionalNonEmpty(input.model),
          reasoningEffort: optionalNonEmpty(input.reasoningEffort),
        })
      );
      if (input.json) {
        const encoded = yield* encodeListJson(entries).pipe(
          Effect.mapError(HarnessLedgerIoError.wrap("Failed to encode ledger list output."))
        );
        return yield* printCommandJson(encoded);
      }
      return yield* printLines(listLines(entries));
    }).pipe(
      Effect.catchTags({
        HarnessLedgerInputError: reportFailure("list"),
        HarnessLedgerChainError: reportFailure("list"),
        HarnessLedgerIoError: reportFailure("list"),
      })
    );
  })
).pipe(
  Command.withDescription("List the latest row of every ledger chain with staleness"),
  Command.provide(HarnessLedgerServiceLive)
);

// ---------------------------------------------------------------------------
// prune-proposals
// ---------------------------------------------------------------------------

const resolveHookPulseDir = Effect.gen(function* () {
  const configuredRoot = optionalNonEmpty(yield* Config.option(Config.String("BEEP_AGENT_EVIDENCE_ROOT")));
  if (O.isSome(configuredRoot)) {
    return hookPulseLedgerDir(configuredRoot.value);
  }
  const stateHome = aiMetricsStateHome({
    homeDir: yield* Config.option(Config.String("HOME")),
    stateHome: yield* Config.option(Config.String("XDG_STATE_HOME")),
  });
  return yield* O.match(stateHome, {
    onNone: () =>
      HarnessLedgerInputError.new("Neither XDG_STATE_HOME nor HOME is set; pass --state-dir <hook-events dir>."),
    onSome: (home) => Effect.succeed(hookPulseLedgerDir(agentEvidenceRoot(home))),
  });
}).pipe(
  Effect.catchTag("ConfigError", () => HarnessLedgerInputError.new("Failed to read the state-home environment."))
);

const pruneLines = (report: HarnessLedgerPruneReport): ReadonlyArray<string> => [
  `window: last ${report.windowSessions} sessions; observed ${report.sessionsObserved} ending ${O.match(
    report.windowEnd,
    {
      onNone: () => "-",
      onSome: DateTime.formatIso,
    }
  )}`,
  `shards read: ${report.shardsRead}; undecodable lines skipped: ${report.undecodableLines}`,
  `candidates: ${report.candidates}; touched: ${report.touchedCandidates}; already proposed: ${report.alreadyProposed}`,
  ...A.match(report.proposals, {
    onEmpty: () => ["No pruning proposals."],
    onNonEmpty: (proposals) =>
      A.map(
        proposals,
        (proposal) =>
          `${proposal.row.rowId}\t${proposal.candidate.kind}:${proposal.candidate.name}\t${proposal.row.mechanismClass}\t${O.getOrElse(proposal.row.dispositionEvidence, () => "-")}`
      ),
  }),
  "dry run: nothing written (--write is refused until sessions are scoped by harness hash).",
];

/**
 * `bun run beep harness-ledger prune-proposals` — propose retiring skills,
 * and MCP servers with zero observed touches in the last N sessions.
 *
 * **Details**
 *
 * D9 restricts the window to sessions under the current harness hash. That
 * restriction is deferred until hook-pulse stamps the harness hash at
 * SessionStart; today the read-only window spans the last N sessions regardless
 * of regime. Writes fail until that filter exists.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { harnessLedgerPruneProposalsCommand } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(harnessLedgerPruneProposalsCommand.name) // "prune-proposals"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const harnessLedgerPruneProposalsCommand = Command.make(
  "prune-proposals",
  {
    window: Flag.Int("window").pipe(
      Flag.withDefault(30),
      Flag.withDescription("Number of most recent hook-pulse sessions to observe")
    ),
    stateDir: Flag.String("state-dir").pipe(
      Flag.withDescription(
        "Hook-pulse shard directory (default: $XDG_STATE_HOME/beep/agent-evidence/hook-events, or ~/.local/state/…)"
      ),
      Flag.optional
    ),
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Request append (blocked until current-harness session filtering exists)")
    ),
    model: modelFlag,
    reasoningEffort: reasoningEffortFlag,
    json: jsonFlag,
  },
  Effect.fn(function* (input) {
    return yield* Effect.gen(function* () {
      if (input.window < 1) {
        return yield* HarnessLedgerInputError.new("--window must be at least 1.");
      }
      const repoRoot = yield* resolveRepoRoot;
      const stateDir = yield* O.match(optionalNonEmpty(input.stateDir), {
        onNone: () => resolveHookPulseDir,
        onSome: Effect.succeed,
      });
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({
          repoRoot,
          stateDir,
          windowSessions: input.window,
          write: input.write,
          modelId: optionalNonEmpty(input.model),
          reasoningEffort: optionalNonEmpty(input.reasoningEffort),
        })
      );
      if (input.json) {
        const encoded = yield* encodePruneJson(report).pipe(
          Effect.mapError(HarnessLedgerIoError.wrap("Failed to encode prune-proposals output."))
        );
        return yield* printCommandJson(encoded);
      }
      return yield* printLines(pruneLines(report));
    }).pipe(
      Effect.catchTags({
        HarnessLedgerBusyError: reportFailure("prune-proposals"),
        HarnessLedgerInputError: reportFailure("prune-proposals"),
        HarnessLedgerChainError: reportFailure("prune-proposals"),
        HarnessLedgerIoError: reportFailure("prune-proposals"),
      })
    );
  })
).pipe(
  Command.withDescription(
    "Propose retiring zero-touch skills and MCP servers over the last N sessions (current-harness-hash window deferred until hook-pulse stamps it at SessionStart)"
  ),
  Command.provide(HarnessLedgerServiceLive)
);

/**
 * `bun run beep harness-ledger` — harness evidence ledger command group.
 *
 * **Example** (Log command name)
 *
 * ```ts
 * import { harnessLedgerCommand } from "@beep/repo-cli/commands/HarnessLedger"
 *
 * console.log(harnessLedgerCommand.name) // "harness-ledger"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const harnessLedgerCommand = Command.make("harness-ledger", {}, () =>
  printLines([
    "Harness ledger commands:",
    "- bun run beep harness-ledger propose --mechanism <class> --edit <commit:<sha>|diff:<sha256>|pending> [--hypothesis <claim> --expected-surface <kind> --expected-metric <name>] [--model <id>] [--reasoning-effort <level>] [--repo-revision <sha>] [--json]",
    '- bun run beep harness-ledger disposition --row <rowId> --to <accepted|rejected|deferred|waived|tombstoned> --evidence "<text>" [--score <n> --cost <n>] [--resurrect-when "<text>"] [--touched <kind>:<name> ...] [--json]',
    "- bun run beep harness-ledger list [--stale] [--disposition <d>] [--month YYYY-MM] [--model <id>] [--reasoning-effort <level>] [--json]",
    "- bun run beep harness-ledger prune-proposals [--window <sessions>] [--state-dir <dir>] [--write] [--json]",
  ])
).pipe(
  Command.withDescription("Append-only harness evidence ledger (propose, disposition, list, prune-proposals)"),
  Command.withSubcommands([
    harnessLedgerProposeCommand,
    harnessLedgerDispositionCommand,
    harnessLedgerListCommand,
    harnessLedgerPruneProposalsCommand,
  ])
);
