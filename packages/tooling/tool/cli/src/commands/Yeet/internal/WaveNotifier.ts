/**
 * Dead-owner escalation for `--until-ready` waves (goals/yeet-pr-events W9).
 *
 * When a new wave lands on a monitored pull request, the inbox hook hands it
 * to the owner session at its next prompt or tool call. A dead owner has no
 * next prompt, so the detached monitor, the only process that knows there is
 * no live owner, reads the PR session registry, probes each recorded owner,
 * and, when none is live, spawns the pr-wave notifier
 * (`.claude/hooks/yeet-pr-wave-notifier.sh`) with a wave descriptor.
 *
 * **Details**
 *
 * Unknown liveness counts as dead (pr-event-awareness D19). The only probe is
 * `isClaudeSessionLive`, which reads Claude sessions only, so every
 * Codex-attributed owner escalates as `non-claude-harness` until the
 * resume-footer Codex live guard ships. That is intended, and the notifier's
 * ledger records it on every row.
 *
 * The descriptor file is the idempotency claim: it is created exclusively
 * under `<checkout>/.beep/yeet/pr-wave-notifier/waves/<waveKey>.json`, so a
 * wave escalates once even across monitor restarts. Only its local desktop
 * fields carry pull request content; the notifier keeps ntfy and its evidence
 * ledger generic.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Config, Console, DateTime, Effect, FileSystem, HashSet, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Hex from "effect/encoding/Hex";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { describeYeetInboxRow } from "./Inbox.ts";
import { YeetPrWave } from "./InboxView.ts";
import { distinctPrSessions, PrNumber, PrRepository } from "./Provenance.ts";
import { makePrSessionRegistryLive } from "./PrSessionRegistry.ts";
import { isClaudeSessionLive, selectResumeRecord } from "./Resume.ts";
import type { ChildProcessSpawner } from "effect/process";
import type { PrSessionRecord } from "./Provenance.ts";
import type { PrSessionRegistryError } from "./PrSessionRegistry.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/WaveNotifier");

/**
 * Checkout-relative path of the pr-wave notifier worker.
 *
 * **Example** (Name the worker)
 *
 * ```ts
 * import { YEET_PR_WAVE_NOTIFIER_WORKER } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_PR_WAVE_NOTIFIER_WORKER) // ".claude/hooks/yeet-pr-wave-notifier.sh"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_PR_WAVE_NOTIFIER_WORKER = ".claude/hooks/yeet-pr-wave-notifier.sh";

/**
 * The notifier's ledger namespace under the agent-evidence root.
 *
 * **Details**
 *
 * The worker appends `pr-wave-<day>-<waveKey>.ndjson` rows under
 * `${BEEP_AGENT_EVIDENCE_ROOT}/pr-wave/notification-events/`, a sibling of the
 * sequence-break notifier's `sequence-break/` namespace that never collides
 * with it.
 *
 * **Example** (Name the ledger namespace)
 *
 * ```ts
 * import { YEET_PR_WAVE_LEDGER_NAMESPACE } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_PR_WAVE_LEDGER_NAMESPACE) // "pr-wave/notification-events"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_PR_WAVE_LEDGER_NAMESPACE = "pr-wave/notification-events";

/**
 * Schema version stamped on every wave descriptor.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import { YEET_PR_WAVE_DESCRIPTOR_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_PR_WAVE_DESCRIPTOR_SCHEMA_VERSION) // "yeet-pr-wave-descriptor/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_PR_WAVE_DESCRIPTOR_SCHEMA_VERSION = "yeet-pr-wave-descriptor/v1";

/**
 * Why a wave's owner counts as live or dead.
 *
 * **Details**
 *
 * `claude-session-live` is the only live reason. Every other reason escalates:
 * `no-owner-record` (the registry names no session for the pull request),
 * `non-claude-harness` (the newest owner is Codex or unknown, which no probe
 * can see yet), `claude-session-not-live` (no recorded Claude session has a
 * live index and process), `registry-unreadable`, and
 * `repository-unresolved` (the pull request URL names no GitHub repository).
 *
 * **Example** (List the reasons)
 *
 * ```ts
 * import { YeetPrWaveOwnerReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetPrWaveOwnerReason.is["non-claude-harness"]("non-claude-harness")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetPrWaveOwnerReason = LiteralKit([
  "claude-session-live",
  "no-owner-record",
  "non-claude-harness",
  "claude-session-not-live",
  "registry-unreadable",
  "repository-unresolved",
]).pipe(
  $I.annoteSchema("YeetPrWaveOwnerReason", {
    description: "Why a pull request wave's owner session counts as live or dead.",
  })
);

/**
 * Why a wave's owner counts as live or dead.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetPrWaveOwnerReason = typeof YeetPrWaveOwnerReason.Type;

/**
 * The liveness verdict for a pull request's owner sessions.
 *
 * **Example** (A Codex owner is dead)
 *
 * ```ts
 * import { YeetPrWaveOwnerVerdict } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const verdict = YeetPrWaveOwnerVerdict.make({
 *   live: false,
 *   reason: "non-claude-harness",
 *   owner: O.some("codex · beep-effect10"),
 * })
 * console.log(verdict.live) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrWaveOwnerVerdict extends S.Class<YeetPrWaveOwnerVerdict>($I`YeetPrWaveOwnerVerdict`)(
  {
    live: S.Boolean,
    reason: YeetPrWaveOwnerReason,
    owner: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("YeetPrWaveOwnerVerdict", {
    description: "Whether a pull request's owner session is live, why, and the owner's harness and workspace label.",
  })
) {}

/**
 * Desktop urgency for a wave: `critical` when it holds a P0 row.
 *
 * **Example** (List the urgencies)
 *
 * ```ts
 * import { YeetPrWaveUrgency } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetPrWaveUrgency.Options) // ["critical", "normal"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetPrWaveUrgency = LiteralKit(["critical", "normal"]).pipe(
  $I.annoteSchema("YeetPrWaveUrgency", { description: "notify-send urgency for a pull request wave." })
);

/**
 * Desktop urgency for a wave.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetPrWaveUrgency = typeof YeetPrWaveUrgency.Type;

/**
 * The wave descriptor the monitor hands to the pr-wave notifier.
 *
 * **Details**
 *
 * `prNumber` is a positive integer, the only shape the worker accepts, so
 * every descriptor this schema admits is one the worker runs. `rowIds` are
 * the rows whose acks resolve the notifier; `headSha` and
 * `prNumber` let it notice a superseding push through the wave record.
 * `summary`, `resumeCommand`, `desktopTitle`, and `desktopBody` are local
 * presentation only: the worker shows them on the desktop and never sends
 * them to ntfy or writes them to its ledger.
 *
 * **Example** (Build a descriptor)
 *
 * ```ts
 * import { YeetPrWaveDescriptor } from "@beep/repo-cli/test/Yeet"
 *
 * const descriptor = YeetPrWaveDescriptor.make({
 *   waveKey: "feedfacefeedface",
 *   prNumber: 7,
 *   headSha: "abc1234",
 *   checkout: "/repo",
 *   rowIds: ["lint-abc"],
 *   urgency: "critical",
 *   ownerReason: "no-owner-record",
 *   summary: "P0 Lint (pr #7 @ abc1234) · owner: none recorded",
 *   resumeCommand: "bun run beep yeet resume 7",
 *   desktopTitle: "PR #7: new wave, no live owner",
 *   desktopBody: "P0 Lint\nbun run beep yeet resume 7",
 *   createdAt: "2026-09-28T00:00:00.000Z",
 * })
 * console.log(descriptor.schemaVersion) // "yeet-pr-wave-descriptor/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrWaveDescriptor extends S.Class<YeetPrWaveDescriptor>($I`YeetPrWaveDescriptor`)(
  {
    schemaVersion: S.Literal(YEET_PR_WAVE_DESCRIPTOR_SCHEMA_VERSION).pipe(
      S.withConstructorDefault(Effect.succeed(YEET_PR_WAVE_DESCRIPTOR_SCHEMA_VERSION))
    ),
    waveKey: S.String,
    prNumber: PrNumber,
    headSha: S.NonEmptyString,
    checkout: S.String,
    rowIds: S.NonEmptyArray(S.String),
    urgency: YeetPrWaveUrgency,
    ownerReason: YeetPrWaveOwnerReason,
    summary: S.String,
    resumeCommand: S.String,
    desktopTitle: S.String,
    desktopBody: S.String,
    createdAt: S.String,
  },
  $I.annote("YeetPrWaveDescriptor", {
    description:
      "One dead-owner wave for the pr-wave notifier: rows that resolve it, the head it belongs to, and local desktop text.",
  })
) {}

/**
 * JSON string codec for one wave descriptor.
 *
 * **Example** (Reject garbage)
 *
 * ```ts
 * import { YeetPrWaveDescriptorJson } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(YeetPrWaveDescriptorJson.decodeOption("not json"))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const YeetPrWaveDescriptorJson = JsonStringCodec(YeetPrWaveDescriptor);

/**
 * What one escalation attempt did.
 *
 * **Details**
 *
 * `owner-live` spawned nothing: the inbox hook carries the wave.
 * `already-escalated` found the wave's descriptor claimed by an earlier poll
 * or monitor. `spawned` and `spawn-failed` report the detached launch.
 *
 * **Example** (List the outcomes)
 *
 * ```ts
 * import { YeetPrWaveEscalationOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetPrWaveEscalationOutcome.Options.length) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetPrWaveEscalationOutcome = LiteralKit([
  "owner-live",
  "spawned",
  "already-escalated",
  "spawn-failed",
]).pipe($I.annoteSchema("YeetPrWaveEscalationOutcome", { description: "What one dead-owner escalation attempt did." }));

/**
 * What one escalation attempt did.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YeetPrWaveEscalationOutcome = typeof YeetPrWaveEscalationOutcome.Type;

/**
 * The result of one escalation attempt.
 *
 * **Example** (A live owner spawns nothing)
 *
 * ```ts
 * import { YeetPrWaveEscalation, YeetPrWaveOwnerVerdict } from "@beep/repo-cli/test/Yeet"
 *
 * const result = YeetPrWaveEscalation.make({
 *   outcome: "owner-live",
 *   waveKey: "feedfacefeedface",
 *   owner: YeetPrWaveOwnerVerdict.make({ live: true, reason: "claude-session-live" }),
 * })
 * console.log(result.outcome) // "owner-live"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrWaveEscalation extends S.Class<YeetPrWaveEscalation>($I`YeetPrWaveEscalation`)(
  {
    outcome: YeetPrWaveEscalationOutcome,
    waveKey: S.String,
    owner: YeetPrWaveOwnerVerdict,
  },
  $I.annote("YeetPrWaveEscalation", {
    description: "One escalation attempt's outcome, the wave key it claimed, and the owner verdict behind it.",
  })
) {}

const ownerLabel = (record: PrSessionRecord): string => `${record.harness} · ${record.workspace}`;

/**
 * Decide an owner verdict from registry rows and the live Claude session ids.
 *
 * **Details**
 *
 * Any recorded session whose id is live makes the owner live. Otherwise the
 * reason names the owner `yeet resume` would pick: no row, a non-Claude
 * harness (unprobed, so dead), or a Claude session that is not live.
 *
 * **Example** (No record is dead)
 *
 * ```ts
 * import { decideYeetPrWaveOwner } from "@beep/repo-cli/test/Yeet"
 * import * as HashSet from "effect/HashSet"
 *
 * console.log(decideYeetPrWaveOwner([], HashSet.empty()).reason) // "no-owner-record"
 * ```
 *
 * @param records - The pull request's registry rows.
 * @param liveSessionIds - Claude session ids the probe found live.
 * @returns The owner verdict.
 * @category utilities
 * @since 0.0.0
 */
export const decideYeetPrWaveOwner: {
  (liveSessionIds: HashSet.HashSet<string>): (records: ReadonlyArray<PrSessionRecord>) => YeetPrWaveOwnerVerdict;
  (records: ReadonlyArray<PrSessionRecord>, liveSessionIds: HashSet.HashSet<string>): YeetPrWaveOwnerVerdict;
} = dual(
  2,
  (records: ReadonlyArray<PrSessionRecord>, liveSessionIds: HashSet.HashSet<string>): YeetPrWaveOwnerVerdict => {
    const live = A.findFirst(distinctPrSessions(records), (record) =>
      O.exists(record.sessionId, (id) => HashSet.has(liveSessionIds, id))
    );
    if (O.isSome(live)) {
      return YeetPrWaveOwnerVerdict.make({
        live: true,
        reason: "claude-session-live",
        owner: O.some(ownerLabel(live.value)),
      });
    }
    return O.match(selectResumeRecord(records, O.none()), {
      onNone: () => YeetPrWaveOwnerVerdict.make({ live: false, reason: "no-owner-record" }),
      onSome: (record) =>
        YeetPrWaveOwnerVerdict.make({
          live: false,
          reason: record.harness === "claude-code" ? "claude-session-not-live" : "non-claude-harness",
          owner: O.some(ownerLabel(record)),
        }),
    });
  }
);

/**
 * Probe a pull request's recorded owners and decide the verdict.
 *
 * **Details**
 *
 * Each distinct Claude session is checked with `isClaudeSessionLive` against
 * `sessionsRoot` and `procRoot`; a probe that fails counts as not live.
 * Non-Claude sessions are never probed, which is why a Codex owner is dead.
 *
 * **Example** (Build the probe)
 *
 * ```ts
 * import { probeYeetPrWaveOwner } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(probeYeetPrWaveOwner([], "/sessions", "/proc"))) // true
 * ```
 *
 * @param records - The pull request's registry rows.
 * @param sessionsRoot - Directory holding Claude's live session index files.
 * @param procRoot - Process root that confirms an indexed PID exists.
 * @returns The owner verdict; never an error.
 * @category detection
 * @since 0.0.0
 */
export const probeYeetPrWaveOwner = Effect.fn("YeetWaveNotifier.probeOwner")(function* (
  records: ReadonlyArray<PrSessionRecord>,
  sessionsRoot: string,
  procRoot: string
) {
  const live = yield* Effect.forEach(
    A.filter(distinctPrSessions(records), (record) => record.harness === "claude-code"),
    (record) => isClaudeSessionLive(record, sessionsRoot, procRoot).pipe(Effect.orElseSucceed(O.none)),
    { concurrency: 4 }
  );
  return decideYeetPrWaveOwner(records, HashSet.fromIterable(A.map(A.getSomes(live), (session) => session.sessionId)));
});

/**
 * Derive a wave's opaque key: a digest of its pull request, head, rows, and red set.
 *
 * **Details**
 *
 * The key is the only wave identity the notifier's ledger carries. The same
 * rows on the same head with the same red set are the same wave; a rerun that
 * comes back red changes the red set and so the key.
 *
 * **Example** (Build the key effect)
 *
 * ```ts
 * import { yeetPrWaveKey } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(yeetPrWaveKey(7, "abc1234", ["lint-abc"], ""))) // true
 * ```
 *
 * @param prNumber - The pull request.
 * @param headSha - The head the wave belongs to.
 * @param rowIds - The wave's row ids, in any order.
 * @param redSetKey - The head's required red set key, or empty.
 * @returns Sixteen lowercase hex characters.
 * @category utilities
 * @since 0.0.0
 */
export const yeetPrWaveKey = Effect.fn("YeetWaveNotifier.waveKey")(function* (
  prNumber: number,
  headSha: string,
  rowIds: ReadonlyArray<string>,
  redSetKey: string
) {
  const crypto = yield* Crypto.Crypto;
  const text = A.join([`${prNumber}`, headSha, A.join(A.sort(rowIds, Order.String), ","), redSetKey], "\n");
  const bytes = yield* crypto
    .digest("SHA-256", new TextEncoder().encode(text))
    .pipe(Effect.mapError(YeetCommandError.new("Failed to hash the pull request wave key.")));
  return Str.takeLeft(16)(Hex.encode(bytes));
});

const oneLine = (text: string, limit: number): string =>
  pipe(text, Str.replaceAll(/[\u0000-\u001f\u007f-\u009f]+/gu, " "), Str.trim, (line) =>
    Str.length(line) > limit ? `${Str.slice(0, limit - 1)(line)}…` : line
  );

/**
 * The local resume command a desktop notification names.
 *
 * **Example** (Name the resume command)
 *
 * ```ts
 * import { yeetPrWaveResumeCommand } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(yeetPrWaveResumeCommand(7)) // "bun run beep yeet resume 7"
 * ```
 *
 * @param prNumber - Number of the pull request whose wave the operator should pick up.
 * @returns The exact command the operator pastes to resume that pull request's session.
 * @category formatting
 * @since 0.0.0
 */
export const yeetPrWaveResumeCommand = (prNumber: number): string => `bun run beep yeet resume ${prNumber}`;

/**
 * Render a wave's one-line attributed summary for the local desktop body.
 *
 * **Details**
 *
 * The first row (severity and description), a count of the rest, and the
 * owner the verdict attributes the pull request to, capped at 200 characters
 * with control characters removed.
 *
 * **Example** (Summarize an ownerless wave)
 *
 * ```ts
 * import { renderYeetPrWaveSummary } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof renderYeetPrWaveSummary) // "function"
 * ```
 *
 * @param wave - The wave to summarize.
 * @param owner - The owner verdict.
 * @returns One line naming the first row, the rest's count, and the owner.
 * @category formatting
 * @since 0.0.0
 */
export const renderYeetPrWaveSummary: {
  (owner: YeetPrWaveOwnerVerdict): (wave: YeetPrWave) => string;
  (wave: YeetPrWave, owner: YeetPrWaveOwnerVerdict): string;
} = dual(2, (wave: YeetPrWave, owner: YeetPrWaveOwnerVerdict): string => {
  const [first, ...rest] = wave.entries;
  const more = A.isReadonlyArrayNonEmpty(rest) ? ` (+${A.length(rest)} more)` : Str.empty;
  const attributed = O.getOrElse(owner.owner, () => "none recorded");
  return oneLine(
    `${first.row.severity} ${describeYeetInboxRow(first.row)}${more} · owner: ${attributed} (${owner.reason})`,
    200
  );
});

/**
 * Everything one dead-owner wave's descriptor is assembled from.
 *
 * **Example** (Reference the input schema)
 *
 * ```ts
 * import { YeetPrWaveDescriptorInput } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof YeetPrWaveDescriptorInput.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetPrWaveDescriptorInput extends S.Class<YeetPrWaveDescriptorInput>($I`YeetPrWaveDescriptorInput`)(
  {
    wave: YeetPrWave,
    headSha: S.NonEmptyString,
    checkout: S.String,
    waveKey: S.String,
    owner: YeetPrWaveOwnerVerdict,
    createdAt: S.String,
  },
  $I.annote("YeetPrWaveDescriptorInput", {
    description: "The wave, head, checkout, wave key, owner verdict, and time a wave descriptor is built from.",
  })
) {}

/**
 * Assemble the descriptor for one dead-owner wave.
 *
 * **Details**
 *
 * The urgency is `critical` when any row is P0. The title and body name the
 * pull request, the one-line summary, and `yeet resume <pr>`; they are the
 * only fields the notifier shows, and only on the local desktop.
 *
 * **Example** (Build the descriptor)
 *
 * ```ts
 * import { makeYeetPrWaveDescriptor } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof makeYeetPrWaveDescriptor) // "function"
 * ```
 *
 * @param input - The wave, head, checkout, wave key, dead owner verdict, and time.
 * @returns The descriptor, whose desktop fields alone carry pull request content.
 * @category constructors
 * @since 0.0.0
 */
export const makeYeetPrWaveDescriptor = ({
  wave,
  headSha,
  checkout,
  waveKey,
  owner,
  createdAt,
}: YeetPrWaveDescriptorInput): YeetPrWaveDescriptor => {
  const summary = renderYeetPrWaveSummary(wave, owner);
  const resumeCommand = yeetPrWaveResumeCommand(wave.prNumber);
  const rows = A.length(wave.entries);
  return YeetPrWaveDescriptor.make({
    waveKey,
    prNumber: wave.prNumber,
    headSha,
    checkout,
    rowIds: A.map(wave.entries, (entry) => entry.row.id),
    urgency: A.some(wave.entries, (entry) => entry.row.severity === "P0") ? "critical" : "normal",
    ownerReason: owner.reason,
    summary,
    resumeCommand,
    desktopTitle: `PR #${wave.prNumber}: ${rows} new inbox row(s), no live owner`,
    desktopBody: `${summary}\n${resumeCommand}`,
    createdAt,
  });
};

const decodeRepository = S.decodeUnknownOption(PrRepository);

/**
 * Read the GitHub repository out of a pull request URL.
 *
 * **Example** (Parse a pull request URL)
 *
 * ```ts
 * import { yeetPrWaveRepository } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(yeetPrWaveRepository("https://github.com/beep-effect/beep-effect/pull/7"))) // true
 * ```
 *
 * @param url - The pull request URL.
 * @returns The repository, or `None` when the URL is not a github.com pull request.
 * @category utilities
 * @since 0.0.0
 */
export const yeetPrWaveRepository = (url: string): O.Option<PrRepository> =>
  pipe(
    Str.match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/[1-9][0-9]*/u)(url),
    O.flatMap((match) =>
      decodeRepository({
        host: "github.com",
        owner: Str.toLowerCase(match[1] ?? ""),
        name: Str.toLowerCase(match[2] ?? ""),
      })
    )
  );

// Injectable reads for `escalateYeetPrWave`: `lookup` defaults to the live PR
// session registry, `sessionsRoot` to `$HOME/.claude/sessions`, `procRoot` to
// `/proc`, and `now` to the clock. It carries effects, so it is no schema.
interface EscalationOptions {
  readonly lookup?:
    | ((
        repository: PrRepository,
        pr: PrNumber
      ) => Effect.Effect<ReadonlyArray<PrSessionRecord>, PrSessionRegistryError>)
    | undefined;
  readonly now?: Effect.Effect<DateTime.Utc> | undefined;
  readonly procRoot?: string | undefined;
  readonly sessionsRoot?: string | undefined;
}

const liveRegistryLookup = (repository: PrRepository, pr: PrNumber) =>
  makePrSessionRegistryLive().pipe(Effect.flatMap((registry) => registry.lookup(repository, pr)));

const resolveOwner = Effect.fn("YeetWaveNotifier.resolveOwner")(function* (
  prUrl: O.Option<string>,
  prNumber: number,
  options: EscalationOptions
) {
  const repository = O.flatMap(prUrl, yeetPrWaveRepository);
  if (O.isNone(repository)) {
    return YeetPrWaveOwnerVerdict.make({ live: false, reason: "repository-unresolved" });
  }
  const records = yield* (options.lookup ?? liveRegistryLookup)(repository.value, prNumber).pipe(Effect.option);
  if (O.isNone(records)) {
    return YeetPrWaveOwnerVerdict.make({ live: false, reason: "registry-unreadable" });
  }
  const home = yield* Config.String("HOME").pipe(Effect.orElseSucceed(() => "/nonexistent"));
  return yield* probeYeetPrWaveOwner(
    records.value,
    options.sessionsRoot ?? `${home}/.claude/sessions`,
    options.procRoot ?? "/proc"
  );
});

// `setsid -f` puts the notifier in its own session so it outlives the monitor
// poll, and the inner redirect closes the capture pipe at once: the worker
// holds no descriptor of this process, so the capture returns immediately.
const detachScript = 'exec bash "$0" "$@" </dev/null >/dev/null 2>&1';

// The descriptor is the once-per-wave claim. `exists` means an earlier poll or
// monitor already claimed this wave; `failed` means nothing was claimed, so a
// later poll may try again.
const claimDescriptor = Effect.fn("YeetWaveNotifier.claimDescriptor")(function* (
  descriptorPath: string,
  descriptor: YeetPrWaveDescriptor
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const json = yield* YeetPrWaveDescriptorJson.encode(descriptor).pipe(Effect.option);
  if (O.isNone(json)) return "failed" as const;
  yield* fs.makeDirectory(path.dirname(descriptorPath), { recursive: true, mode: 0o700 }).pipe(Effect.ignore);
  return yield* fs.writeFileString(descriptorPath, `${json.value}\n`, { flag: "wx", mode: 0o600 }).pipe(
    Effect.as("claimed" as const),
    Effect.catchTag("PlatformError", (error) =>
      Effect.succeed(error.reason._tag === "AlreadyExists" ? ("exists" as const) : ("failed" as const))
    )
  );
});

/**
 * Escalate one wave to the human when its pull request has no live owner.
 *
 * **Details**
 *
 * Resolves the owner verdict (registry, then the Claude-only live probe;
 * unknown is dead). A live owner spawns nothing. Otherwise the wave's
 * descriptor is claimed exclusively under
 * `<checkout>/.beep/yeet/pr-wave-notifier/waves/<waveKey>.json`, so the same
 * wave escalates once, and the notifier worker is launched detached with the
 * descriptor path as its only argument. A spawn that fails releases the
 * claim, so a later attempt launches it. Nothing fails the caller: every
 * failure is an outcome, and only `spawned` and `already-escalated` settle a
 * wave; the caller retries `owner-live` (the owner may die) and `spawn-failed`.
 *
 * **Example** (Build the escalation)
 *
 * ```ts
 * import { escalateYeetPrWave } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(typeof escalateYeetPrWave) // "function"
 * ```
 *
 * @param checkout - The checkout whose inbox holds the wave.
 * @param wave - The new wave on the monitored pull request.
 * @param headSha - The head the monitor observed.
 * @param prUrl - The pull request URL, which names the repository.
 * @param options - Injectable registry, probe roots, and clock.
 * @returns What the attempt did, the wave key, and the owner verdict.
 * @category services
 * @since 0.0.0
 */
export const escalateYeetPrWave = Effect.fn("YeetWaveNotifier.escalate")(function* (
  checkout: string,
  wave: YeetPrWave,
  headSha: string,
  prUrl: O.Option<string>,
  options: EscalationOptions = {}
): Effect.fn.Return<
  YeetPrWaveEscalation,
  never,
  Crypto.Crypto | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const rowIds = A.map(wave.entries, (entry) => entry.row.id);
  const waveKey = yield* yeetPrWaveKey(
    wave.prNumber,
    headSha,
    rowIds,
    O.getOrElse(wave.redSetKey, () => Str.empty)
  ).pipe(Effect.orElseSucceed(() => Str.empty));
  const owner = yield* resolveOwner(prUrl, wave.prNumber, options);
  const result = (outcome: YeetPrWaveEscalationOutcome) => YeetPrWaveEscalation.make({ outcome, waveKey, owner });
  // A live owner is re-probed on every later poll (the monitor does not
  // account the wave), so it stays quiet here instead of logging each poll.
  if (owner.live) return result("owner-live");
  const worker = path.join(checkout, YEET_PR_WAVE_NOTIFIER_WORKER);
  const descriptorPath = path.join(checkout, ".beep", "yeet", "pr-wave-notifier", "waves", `${waveKey}.json`);
  if (Str.isEmpty(waveKey) || !(yield* fs.exists(worker).pipe(Effect.orElseSucceed(() => false)))) {
    yield* Console.error(
      `[yeet] wave on PR #${wave.prNumber}: no live owner (${owner.reason}) and the pr-wave notifier is unavailable`
    );
    return result("spawn-failed");
  }
  const createdAt = DateTime.formatIso(yield* options.now ?? DateTime.now);
  const claimed = yield* claimDescriptor(
    descriptorPath,
    makeYeetPrWaveDescriptor(YeetPrWaveDescriptorInput.make({ wave, headSha, checkout, waveKey, owner, createdAt }))
  );
  if (claimed === "exists") return result("already-escalated");
  if (claimed === "failed") {
    yield* Console.error(
      `[yeet] wave on PR #${wave.prNumber}: no live owner (${owner.reason}); the wave descriptor could not be written`
    );
    return result("spawn-failed");
  }
  const spawned = yield* runRepoCommandCapture(
    "setsid",
    ["-f", "bash", "-c", detachScript, worker, descriptorPath],
    checkout
  ).pipe(Effect.option);
  if (O.isNone(spawned) || spawned.value.exitCode !== 0) {
    // Release the claim so the next poll, or a restarted monitor, launches it.
    yield* fs.remove(descriptorPath).pipe(Effect.ignore);
    yield* Console.error(
      `[yeet] wave on PR #${wave.prNumber}: no live owner (${owner.reason}); the pr-wave notifier failed to start`
    );
    return result("spawn-failed");
  }
  yield* Console.log(
    `[yeet] wave on PR #${wave.prNumber}: no live owner (${owner.reason}); escalated to the pr-wave notifier (wave ${waveKey})`
  );
  return result("spawned");
});
