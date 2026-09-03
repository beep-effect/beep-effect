/**
 * Resolve, inspect, and resume workstation-local agent sessions recorded for a PR.
 *
 * **Gotchas**
 *
 * Resume state is local to the publishing workstation. Missing state, invalid
 * references, and unresumable selections use exit code 4 for caller-visible
 * lookup or selection failures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { shellQuote } from "@beep/repo-ai-metrics";
import { Config, Console, Context, DateTime, Effect, FileSystem, Path, pipe, Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { renderPrettyCommandJson } from "../../../internal/cli/Json.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { distinctPrSessions, PrProvenanceLabel, PrRepository, PrSessionRecord } from "./Provenance.ts";
import { detectPrRepository } from "./ProvenanceFooter.ts";
import { makePrSessionRegistryLive } from "./PrSessionRegistry.ts";
import { PrRef, ResolvedResume } from "./Resume.schemas.ts";
import type { ConfigError } from "effect/Config";
import type { PlatformError } from "effect/PlatformError";
import type { PrNumber } from "./Provenance.ts";
import type { ResumeOptions } from "./Resume.schemas.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/Resume");
const encodeResolved = S.encodeUnknownResult(S.fromJsonString(S.Array(ResolvedResume)));

/**
 * Live Claude index and process evidence used to prevent an accidental session fork.
 *
 * **Example** (Describe a live Claude session)
 *
 * ```ts
 * import { ClaudeLiveSession } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const live = ClaudeLiveSession.make({
 *   pid: 4242,
 *   sessionId: "session-local-only",
 *   cwd: "/worktrees/beep-effect10",
 *   name: O.some("footer-revival"),
 * })
 * console.log(live.pid) // 4242
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaudeLiveSession extends S.Class<ClaudeLiveSession>($I`ClaudeLiveSession`)(
  { pid: S.Int, sessionId: S.String, cwd: S.String, name: S.OptionFromNullOr(S.String) },
  $I.annote("ClaudeLiveSession", { description: "A matching live Claude index and process entry." })
) {}

class ClaudeIndex extends S.Class<ClaudeIndex>($I`ClaudeIndex`)(
  { pid: S.Int, sessionId: S.String, cwd: S.String, name: S.optionalKey(S.String) },
  $I.annote("ClaudeIndex", { description: "Narrow live Claude session index boundary." })
) {}
const decodeClaudeIndex = S.decodeUnknownOption(S.fromJsonString(ClaudeIndex));

class PrLink extends S.Class<PrLink>($I`PrLink`)(
  {
    type: S.String,
    prNumber: S.Finite,
    sessionId: S.optionalKey(S.String),
    prUrl: S.optionalKey(S.String),
    prRepository: S.optionalKey(S.String),
  },
  $I.annote("PrLink", { description: "Narrow Claude transcript PR-link record." })
) {}
const decodePrLink = S.decodeUnknownOption(S.fromJsonString(PrLink));
class TranscriptCwd extends S.Class<TranscriptCwd>($I`TranscriptCwd`)(
  { cwd: S.optionalKey(S.String) },
  $I.annote("TranscriptCwd", { description: "Narrow transcript record carrying the session cwd." })
) {}
const decodeCwd = S.decodeUnknownOption(S.fromJsonString(TranscriptCwd));

/**
 * Parse a number or GitHub PR URL into its PR number and optional repository.
 *
 * **Gotchas**
 *
 * Invalid, zero, or negative references fail with a typed command error carrying
 * exit code 4 so CLI callers can distinguish lookup input from execution failure.
 *
 * **Example** (Parse a URL)
 *
 * ```ts
 * import { parsePrRef } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSync(parsePrRef("https://github.com/o/r/pull/42")).pr) // 42
 * ```
 *
 * @param ref - Positive decimal PR number or GitHub pull-request URL.
 * @returns The validated number and normalized URL repository identity when present.
 * @category parsing
 * @since 0.0.0
 */
export const parsePrRef = Effect.fn("Resume.parsePrRef")(function* (ref: string) {
  return yield* S.decodeEffect(PrRef)(ref).pipe(
    Effect.mapError((cause) => YeetCommandError.make({ message: `Invalid PR reference: ${ref}`, cause, exitCode: 4 }))
  );
});

const preferredRole = (record: PrSessionRecord): boolean => record.role === "created" || record.role === "pushed";

/**
 * Select a one-based agent record after sorting local history newest-first.
 *
 * **Details**
 *
 * An explicit agent number indexes the sorted history. Without one, the newest
 * `created` or `pushed` row wins before falling back to the newest row of any role.
 *
 * **Example** (Select the default publishing session)
 *
 * ```ts
 * import { PrRepository, PrSessionRecord, selectResumeRecord } from "@beep/repo-cli/test/Yeet"
 * import { DateTime } from "effect"
 * import * as O from "effect/Option"
 *
 * const record = PrSessionRecord.make({
 *   schemaVersion: 1,
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   prNumber: O.some(42),
 *   prUrl: O.none(),
 *   branch: "feat/yeet-pr-resume-footer",
 *   harness: "codex",
 *   hostHarness: O.none(),
 *   sessionId: O.some("thread-local-only"),
 *   hostSessionId: O.none(),
 *   sessionHome: O.some("/worktrees/beep-effect10"),
 *   sessionHomeSource: "transcript",
 *   entrypoint: "codex-tui",
 *   sessionName: O.none(),
 *   nameSource: "unknown",
 *   model: "gpt-5.4",
 *   clonePath: "/src/beep-effect",
 *   checkoutPath: "/worktrees/beep-effect10",
 *   worktreePath: O.some("/worktrees/beep-effect10"),
 *   workspace: "beep-effect10",
 *   sessionWorkspace: O.none(),
 *   childSession: false,
 *   headSha: "abcdef123456",
 *   runId: "run-42",
 *   role: "pushed",
 *   recordedAt: DateTime.makeUnsafe("2026-09-03T12:00:00Z"),
 * })
 * console.log(O.map(selectResumeRecord([record], O.none()), (selected) => selected.role))
 * // { _id: "Option", _tag: "Some", value: "pushed" }
 * ```
 *
 * @param records - Local session history to sort and select from.
 * @param agent - Optional one-based position in the newest-first history.
 * @returns The selected record, or `None` when the history or explicit position is empty.
 * @category getters
 * @since 0.0.0
 */
export const selectResumeRecord: {
  (records: ReadonlyArray<PrSessionRecord>, agent: O.Option<PrNumber>): O.Option<PrSessionRecord>;
  (agent: O.Option<PrNumber>): (records: ReadonlyArray<PrSessionRecord>) => O.Option<PrSessionRecord>;
} = dual(2, (records: ReadonlyArray<PrSessionRecord>, agent: O.Option<PrNumber>): O.Option<PrSessionRecord> => {
  const distinct = distinctPrSessions(records);
  if (O.isSome(agent)) return A.get(distinct, agent.value - 1);
  return O.orElse(A.findFirst(distinct, preferredRole), () => A.head(distinct));
});

/**
 * Correlate a Claude session record with its live index and process-table entry.
 *
 * **Gotchas**
 *
 * A matching index alone is insufficient: the PID directory must also exist.
 * This live guard prevents `yeet resume` from forking an already-running Claude
 * session unless the caller explicitly uses `--force`.
 *
 * **Example** (Build a fixture-safe liveness check)
 *
 * ```ts
 * import { isClaudeSessionLive, PrRepository, PrSessionRecord } from "@beep/repo-cli/test/Yeet"
 * import { DateTime, Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const record = PrSessionRecord.make({
 *   schemaVersion: 1,
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   prNumber: O.some(42),
 *   prUrl: O.none(),
 *   branch: "feat/yeet-pr-resume-footer",
 *   harness: "claude-code",
 *   hostHarness: O.none(),
 *   sessionId: O.some("session-local-only"),
 *   hostSessionId: O.none(),
 *   sessionHome: O.some("/worktrees/beep-effect10"),
 *   sessionHomeSource: "index",
 *   entrypoint: "claude-desktop",
 *   sessionName: O.some("footer-revival"),
 *   nameSource: "user",
 *   model: "claude-sonnet-4.5",
 *   clonePath: "/src/beep-effect",
 *   checkoutPath: "/worktrees/beep-effect10",
 *   worktreePath: O.some("/worktrees/beep-effect10"),
 *   workspace: "beep-effect10",
 *   sessionWorkspace: O.none(),
 *   childSession: false,
 *   headSha: "abcdef123456",
 *   runId: "run-42",
 *   role: "created",
 *   recordedAt: DateTime.makeUnsafe("2026-09-03T12:00:00Z"),
 * })
 * const check = isClaudeSessionLive(record, "/fixtures/claude/sessions", "/fixtures/proc")
 * console.log(Effect.isEffect(check)) // true
 * ```
 *
 * @param record - Local session row whose exact Claude session id may be live.
 * @param sessionsRoot - Fixture-safe directory containing Claude live-index JSON files.
 * @param procRoot - Fixture-safe process root used to confirm the indexed PID exists.
 * @returns Matching live session evidence, or `None` when either side of the guard is absent.
 * @category detection
 * @since 0.0.0
 */
export const isClaudeSessionLive = Effect.fn("Resume.isClaudeSessionLive")(function* (
  record: PrSessionRecord,
  sessionsRoot: string,
  procRoot: string
) {
  if (record.harness !== "claude-code" || O.isNone(record.sessionId)) return O.none<ClaudeLiveSession>();
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const names = yield* fs.readDirectory(sessionsRoot).pipe(Effect.orElseSucceed(() => A.empty<string>()));
  const indexes = yield* Effect.forEach(
    A.filter(names, Str.endsWith(".json")),
    (name) =>
      fs.readFileString(path.join(sessionsRoot, name)).pipe(
        Effect.map(decodeClaudeIndex),
        Effect.orElseSucceed(() => O.none<ClaudeIndex>())
      ),
    { concurrency: 8 }
  );
  const sessionId = record.sessionId.value;
  const matching = pipe(
    indexes,
    A.getSomes,
    A.findFirst((index) => index.sessionId === sessionId)
  );
  if (O.isNone(matching) || !(yield* fs.exists(path.join(procRoot, `${matching.value.pid}`)))) return O.none();
  return O.some(
    ClaudeLiveSession.make({
      pid: matching.value.pid,
      sessionId: matching.value.sessionId,
      cwd: matching.value.cwd,
      name: O.fromUndefinedOr(matching.value.name),
    })
  );
});

const transcriptFallback = Effect.fn("Resume.transcriptFallback")(function* (
  home: string,
  repository: PrRepository,
  pr: PrNumber
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(home, ".claude", "projects");
  const names = yield* fs.readDirectory(root, { recursive: true }).pipe(Effect.orElseSucceed(() => A.empty<string>()));
  const records = yield* Effect.forEach(
    A.filter(names, Str.endsWith(".jsonl")),
    Effect.fnUntraced(function* (name) {
      const transcriptPath = path.join(root, name);
      const content = yield* fs.readFileString(transcriptPath);
      const lines = pipe(Str.split("\n")(content), A.filter(Str.isNonEmpty));
      const links = pipe(
        lines,
        A.map((line) => decodePrLink(line)),
        A.getSomes
      );
      const normalizedCurrent = PrRepository.make({
        host: "github.com",
        owner: Str.toLowerCase(repository.owner),
        name: Str.toLowerCase(repository.name),
      });
      const repositoryEquivalence = S.toEquivalence(PrRepository);
      const matchingLink = A.findFirst(links, (link) => {
        if (link.type !== "pr-link" || link.prNumber !== pr) return false;
        const candidate = link.prRepository ?? link.prUrl;
        if (candidate === undefined) return false;
        const match = Str.match(
          /^(?:https:\/\/github\.com\/|github\.com[/:])?([^/\s]+)\/([^/\s]+?)(?:\.git)?(?:\/pull\/[1-9][0-9]*)?$/iu
        )(candidate);
        if (O.isNone(match) || match.value[1] === undefined || match.value[2] === undefined) return false;
        const normalized = S.decodeOption(PrRepository)({
          host: "github.com",
          owner: Str.toLowerCase(match.value[1]),
          name: Str.toLowerCase(match.value[2]),
        });
        return O.isSome(normalized) && repositoryEquivalence(normalized.value, normalizedCurrent);
      });
      if (O.isNone(matchingLink)) return O.none<PrSessionRecord>();
      const cwd = pipe(
        lines,
        A.map((line) => decodeCwd(line)),
        A.getSomes,
        A.map((row) => O.fromUndefinedOr(row.cwd)),
        A.getSomes,
        A.head,
        O.getOrElse(() => home)
      );
      const info = yield* fs.stat(transcriptPath);
      const recordedAt = pipe(info.mtime, O.map(DateTime.fromDateUnsafe), O.getOrElse(DateTime.nowUnsafe));
      const sessionId = path.basename(name, ".jsonl");
      const workspace = S.decodeOption(PrProvenanceLabel)(path.basename(cwd)).pipe(
        O.getOrElse<PrProvenanceLabel>(() => "unknown")
      );
      return O.some(
        PrSessionRecord.make({
          schemaVersion: 1,
          repository,
          prNumber: O.some(pr),
          prUrl: O.none(),
          branch: "unknown",
          harness: "claude-code",
          hostHarness: O.none(),
          sessionId: O.some(sessionId),
          hostSessionId: O.none(),
          sessionHome: O.some(cwd),
          sessionHomeSource: "transcript",
          entrypoint: "unknown",
          sessionName: O.none(),
          nameSource: "unknown",
          model: "unknown",
          clonePath: cwd,
          checkoutPath: cwd,
          worktreePath: O.none(),
          workspace,
          sessionWorkspace: O.none(),
          childSession: false,
          headSha: "unknown",
          runId: `pr-link-${pr}`,
          role: "created",
          recordedAt,
        })
      );
    }),
    { concurrency: 8 }
  );
  return distinctPrSessions(A.getSomes(records));
});

const commandParts = (record: PrSessionRecord): O.Option<readonly [string, ReadonlyArray<string>]> =>
  O.flatMap(record.sessionId, (id) =>
    record.harness === "claude-code"
      ? O.some(["claude", ["--resume", id]] as const)
      : record.harness === "codex"
        ? O.some(["codex", ["resume", id]] as const)
        : O.none()
  );
const commandText = (command: string, args: ReadonlyArray<string>): string =>
  `${command} ${pipe(args, A.map(shellQuote), A.join(" "))}`;

/**
 * Service contract for resolving options and optionally launching the recorded harness.
 *
 * **Example** (Implement a non-launching resumer)
 *
 * ```ts
 * import { ResumeOptions } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import type { HarnessResumerShape } from "@beep/repo-cli/test/Yeet"
 *
 * const resumer: HarnessResumerShape = { run: () => Effect.void }
 * const options = ResumeOptions.make({
 *   ref: { pr: 42, repository: O.none() },
 *   list: true,
 *   print: false,
 *   force: false,
 *   json: false,
 *   agent: O.none(),
 * })
 * console.log(Effect.isEffect(resumer.run(options))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface HarnessResumerShape {
  readonly run: (
    options: ResumeOptions
  ) => Effect.Effect<
    void,
    YeetCommandError | ConfigError | PlatformError,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  >;
}
/**
 * Context service tag for terminal resume resolution and harness execution.
 *
 * **Example** (Construct a fixture resumer service)
 *
 * ```ts
 * import { HarnessResumer, ResumeOptions } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const service = HarnessResumer.of({ run: () => Effect.void })
 * const options = ResumeOptions.make({
 *   ref: { pr: 42, repository: O.none() },
 *   list: false,
 *   print: true,
 *   force: false,
 *   json: false,
 *   agent: O.none(),
 * })
 * console.log(Effect.isEffect(service.run(options))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class HarnessResumer extends Context.Service<HarnessResumer, HarnessResumerShape>()($I`HarnessResumer`) {}

const sessionCwd = (record: PrSessionRecord, home: string): string =>
  pipe(
    record.sessionHome,
    O.orElse(() => O.some(record.clonePath)),
    O.getOrElse(() => home)
  );

const resolveResumeRecords = Effect.fn("HarnessResumer.resolveRecords")(function* (options: ResumeOptions) {
  const prRef = options.ref;
  const pr = prRef.pr;
  const cwd = yield* Config.string("PWD").pipe(Config.withDefault("."));
  const home = yield* Config.string("HOME");
  const repository = yield* O.match(prRef.repository, {
    onNone: () => detectPrRepository(cwd),
    onSome: Effect.succeed,
  });
  const registry = yield* makePrSessionRegistryLive();
  const local = yield* registry
    .lookup(repository, pr)
    .pipe(Effect.mapError((cause) => YeetCommandError.make({ message: cause.message, cause })));
  const records = A.isReadonlyArrayNonEmpty(local) ? local : yield* transcriptFallback(home, repository, pr);
  if (A.isReadonlyArrayEmpty(records))
    return yield* YeetCommandError.make({
      message: `No local session state for ${pipe(
        prRef.repository,
        O.map(() => `${repository.owner}/${repository.name} `),
        O.getOrElse(() => "")
      )}PR #${pr}. Claude users can try: claude --from-pr ${pr}`,
      exitCode: 4,
    });
  return { home, pr, records: distinctPrSessions(records) };
});

const resolveDisplayRows = (
  options: ResumeOptions,
  pr: PrNumber,
  home: string,
  records: ReadonlyArray<PrSessionRecord>
): ReadonlyArray<ResolvedResume> => {
  const selectedRecords = options.list
    ? records
    : pipe(
        selectResumeRecord(records, options.agent),
        O.map(A.of),
        O.getOrElse(() => A.empty<PrSessionRecord>())
      );
  return A.map(selectedRecords, (record, index) => {
    const parts = commandParts(record);
    return ResolvedResume.make({
      pr,
      sequence: index + 1,
      harness: record.harness,
      workspace: record.workspace,
      status: O.isSome(parts) ? "resumable" : "not-resumable",
      command: O.map(parts, ([command, args]) => commandText(command, args)),
      cwd: sessionCwd(record, home),
    });
  });
};

const renderResumeRows = Effect.fn("HarnessResumer.renderRows")(function* (
  options: ResumeOptions,
  rows: ReadonlyArray<ResolvedResume>
) {
  if (options.json) {
    return yield* Console.log(pipe(rows, encodeResolved, Result.getOrThrow, renderPrettyCommandJson, Str.trimEnd));
  }
  yield* Effect.forEach(
    rows,
    (item) =>
      Console.log(
        `${item.sequence}. ${item.harness} · ${item.workspace} · ${item.status} · ${O.getOrElse(item.command, () => "no resume command")} · cwd ${item.cwd}`
      ),
    { discard: true }
  );
});

const resumeSelectedSession = Effect.fn("HarnessResumer.resumeSelectedSession")(function* (
  path: Path.Path,
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  options: ResumeOptions,
  pr: PrNumber,
  home: string,
  records: ReadonlyArray<PrSessionRecord>
) {
  const selected = selectResumeRecord(records, options.agent);
  if (O.isNone(selected))
    return yield* YeetCommandError.make({ message: `Agent selection is out of range for PR #${pr}.`, exitCode: 4 });
  if (!options.force) {
    const live = yield* isClaudeSessionLive(selected.value, path.join(home, ".claude", "sessions"), "/proc");
    if (O.isSome(live)) {
      yield* Console.log(
        `Session is already live: ${O.getOrElse(live.value.name, () => "unnamed")} · ${live.value.cwd} · pid ${live.value.pid}`
      );
      return;
    }
  }
  const parts = commandParts(selected.value);
  if (O.isNone(parts))
    return yield* YeetCommandError.make({ message: `Recorded agent for PR #${pr} is not resumable.`, exitCode: 4 });
  const exitCode = yield* spawner
    .exitCode(
      ChildProcess.make(parts.value[0], parts.value[1], {
        cwd: sessionCwd(selected.value, home),
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })
    )
    .pipe(
      Effect.mapError((cause) => YeetCommandError.make({ message: "Failed to spawn the recorded harness.", cause }))
    );
  if (exitCode !== 0)
    return yield* YeetCommandError.make({ message: `Harness exited with code ${exitCode}.`, exitCode });
});

/**
 * Construct the live resumer that resolves local records and spawns supported harnesses.
 *
 * **Details**
 *
 * Listing and printing stop before process launch. Normal execution applies the
 * Claude live guard, selects a local working directory, and inherits terminal IO.
 *
 * **Example** (Build the live resumer effect)
 *
 * ```ts
 * import { makeHarnessResumerLive } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(makeHarnessResumerLive())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeHarnessResumerLive = Effect.fn("HarnessResumer.makeLive")(function* () {
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  return HarnessResumer.of({
    run: Effect.fn("HarnessResumer.run")(function* (options) {
      const { home, pr, records } = yield* resolveResumeRecords(options);
      if (options.list || options.print) {
        return yield* renderResumeRows(options, resolveDisplayRows(options, pr, home, records));
      }
      yield* resumeSelectedSession(path, spawner, options, pr, home, records);
    }),
  });
});

/**
 * Execute one `yeet resume` invocation using the live local registry and harness services.
 *
 * **Gotchas**
 *
 * Invalid PR references, absent local state, out-of-range agents, and recorded
 * harnesses without an exact resume command fail with exit code 4.
 *
 * **Example** (Build a print-only resume invocation)
 *
 * ```ts
 * import { ResumeOptions, runYeetResume } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const options = ResumeOptions.make({
 *   ref: { pr: 42, repository: O.none() },
 *   list: false,
 *   print: true,
 *   force: false,
 *   json: false,
 *   agent: O.none(),
 * })
 * console.log(Effect.isEffect(runYeetResume(options))) // true
 * ```
 *
 * @param options - Validated lookup, selection, output, and force controls.
 * @returns An effect that lists, prints, guards, or launches the selected local session.
 * @category workflows
 * @since 0.0.0
 */
export const runYeetResume = Effect.fn("Resume.runYeetResume")(function* (options: ResumeOptions) {
  const resumer = yield* makeHarnessResumerLive();
  yield* resumer.run(options);
});
