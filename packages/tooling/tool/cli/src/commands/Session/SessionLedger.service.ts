/**
 * The workstation session ledger: an append-only JSON Lines file per
 * repository under the beep state root, shared by every clone and lane on the
 * machine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Config, Console, Context, DateTime, Effect, FileSystem, Layer, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { runGitOutput } from "../../internal/repo-run/index.ts";
import {
  emptyWhenNotFound,
  repositoryJsonLinesFileName,
  resolveWorkstationStateDir,
} from "../../internal/state/WorkstationState.ts";
import { detectPrRepository } from "../Yeet/internal/ProvenanceFooter.ts";
import { SessionLedgerError } from "./Session.errors.ts";
import { SessionLedgerRow, SessionLedgerRowJson } from "./Session.schemas.ts";
import type { PlatformError } from "effect";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/index.ts";
import type { PrNumber, PrProvenanceHarness, PrRepository } from "../Yeet/internal/Provenance.ts";
import type { SessionLedgerState } from "./Session.schemas.ts";

const $I = $RepoCliId.create("commands/Session/SessionLedger.service");

/**
 * Service contract: append a row, or list every row of one repository.
 *
 * **Example** (Describe a list)
 *
 * ```ts
 * import { PrRepository } from "@beep/repo-cli/test/Session"
 * import type { SessionLedgerShape } from "@beep/repo-cli/test/Session"
 *
 * const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * const listAll = (ledger: SessionLedgerShape) => ledger.list(repository)
 * console.log(listAll.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface SessionLedgerShape {
  readonly append: (row: SessionLedgerRow) => Effect.Effect<void, SessionLedgerError>;
  readonly list: (repository: PrRepository) => Effect.Effect<ReadonlyArray<SessionLedgerRow>, SessionLedgerError>;
}

/**
 * Context tag for the session ledger.
 *
 * **Example** (Request the ledger)
 *
 * ```ts
 * import { SessionLedger } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* SessionLedger }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SessionLedger extends Context.Service<SessionLedger, SessionLedgerShape>()($I`SessionLedger`) {}

/**
 * Parse JSON Lines ledger content, keeping the rows that decode and counting
 * the non-empty lines that do not.
 *
 * **Example** (Count a corrupt line)
 *
 * ```ts
 * import { decodeSessionLedger } from "@beep/repo-cli/test/Session"
 *
 * console.log(decodeSessionLedger("not-json\n").corruptLineCount) // 1
 * ```
 *
 * @param content - The raw file content.
 * @returns The decoded rows and the corrupt-line count.
 * @category parsing
 * @since 0.0.0
 */
export const decodeSessionLedger = (
  content: string
): { readonly rows: ReadonlyArray<SessionLedgerRow>; readonly corruptLineCount: number } => {
  let rows = A.empty<SessionLedgerRow>();
  let corruptLineCount = 0;
  for (const line of A.filter(A.map(Str.split(content, "\n"), Str.trim), Str.isNonEmpty)) {
    const decoded = SessionLedgerRowJson.decodeOption(line);
    if (O.isSome(decoded)) {
      rows = A.append(rows, decoded.value);
    } else {
      corruptLineCount += 1;
    }
  }
  return { rows, corruptLineCount };
};

const mapPlatformError = (cause: PlatformError.PlatformError): SessionLedgerError =>
  SessionLedgerError.make({
    reason: cause.reason._tag === "PermissionDenied" ? "denied" : "io",
    message: cause.message,
    cause,
  });

/**
 * The ledger file name for a repository.
 *
 * **Example** (Name the file)
 *
 * ```ts
 * import { PrRepository, sessionLedgerFileName } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionLedgerFileName(PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" })))
 * // "github.com__beep-effect__beep-effect.jsonl"
 * ```
 *
 * @param repository - The GitHub repository the ledger belongs to.
 * @returns A JSON Lines file name with no local data in it.
 * @category formatting
 * @since 0.0.0
 */
export const sessionLedgerFileName: (repository: PrRepository) => string = repositoryJsonLinesFileName;

/**
 * Build the filesystem-backed ledger.
 *
 * **Example** (Build the live ledger effect)
 *
 * ```ts
 * import { makeSessionLedgerLive } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeSessionLedgerLive())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeSessionLedgerLive = Effect.fn("SessionLedger.makeLive")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* resolveWorkstationStateDir({ override: "BEEP_SESSION_STATE_ROOT", store: "sessions" });
  const fileFor = (repository: PrRepository): string => path.join(directory, sessionLedgerFileName(repository));
  return SessionLedger.of({
    append: Effect.fn("SessionLedger.append")((row) =>
      SessionLedgerRowJson.encode(row).pipe(
        Effect.mapError((cause) =>
          SessionLedgerError.make({ reason: "decode", message: "Failed to encode the session ledger row.", cause })
        ),
        Effect.flatMap((encoded) =>
          fs
            .makeDirectory(directory, { recursive: true, mode: 0o700 })
            .pipe(
              Effect.andThen(fs.writeFileString(fileFor(row.repository), `${encoded}\n`, { flag: "a", mode: 0o600 })),
              Effect.mapError(mapPlatformError)
            )
        )
      )
    ),
    list: Effect.fn("SessionLedger.list")((repository) =>
      fs.readFileString(fileFor(repository)).pipe(
        Effect.map(decodeSessionLedger),
        Effect.tap((result) =>
          result.corruptLineCount > 0
            ? Console.warn(`[session] skipped ${result.corruptLineCount} corrupt ledger line(s)`)
            : Effect.void
        ),
        Effect.map((result) => result.rows),
        emptyWhenNotFound(mapPlatformError)
      )
    ),
  });
});

/**
 * Live filesystem ledger layer.
 *
 * **Example** (Provide the live ledger)
 *
 * ```ts
 * import { layerSessionLedgerLive, SessionLedger } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () { return yield* SessionLedger }).pipe(Effect.provide(layerSessionLedgerLive))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerSessionLedgerLive = Layer.effect(SessionLedger, makeSessionLedgerLive());

/**
 * In-memory ledger layer for tests.
 *
 * **Example** (Provide the memory layer)
 *
 * ```ts
 * import { layerSessionLedgerMemory, SessionLedger } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () { return yield* SessionLedger }).pipe(Effect.provide(layerSessionLedgerMemory))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const layerSessionLedgerMemory = Layer.effect(
  SessionLedger,
  Ref.make(A.empty<SessionLedgerRow>()).pipe(
    Effect.map((rows) =>
      SessionLedger.of({
        append: Effect.fn("SessionLedger.memory.append")((row) => Ref.update(rows, A.append(row))),
        list: Effect.fn("SessionLedger.memory.list")((repository) =>
          Ref.get(rows).pipe(
            Effect.map(
              A.filter(
                (row) =>
                  row.repository.host === repository.host &&
                  row.repository.owner === repository.owner &&
                  row.repository.name === repository.name
              )
            )
          )
        ),
      })
    )
  )
);

const gitAdapter: GitCommandErrorAdapter<SessionLedgerError> = {
  onSpawnFailure: (commandLine) => (cause) =>
    SessionLedgerError.make({ reason: "git", message: `spawn ${commandLine}: ${String(cause)}` }),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    SessionLedgerError.make({ reason: "git", message: `${commandLine} exited with ${exitCode}` }),
  onTruncated: O.none(),
};

const gitLine = Effect.fn("SessionLedger.gitLine")(function* (cwd: string, args: ReadonlyArray<string>) {
  return Str.trim(yield* runGitOutput(cwd, args, gitAdapter));
});

/**
 * The checkout facts a ledger row is stamped with.
 *
 * **Example** (Describe a checkout)
 *
 * ```ts
 * import { PrRepository } from "@beep/repo-cli/test/Session"
 * import type { SessionCheckoutFacts } from "@beep/repo-cli/test/Session"
 *
 * const facts: SessionCheckoutFacts = {
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   clone: "/work/beep-effect",
 *   checkout: "/work/beep-effect-worktrees/lane",
 *   lane: "lane",
 *   branch: "feat/lane",
 * }
 * console.log(facts.lane) // "lane"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SessionCheckoutFacts {
  readonly branch: string;
  readonly checkout: string;
  readonly clone: string;
  readonly lane: string;
  readonly repository: PrRepository;
}

/**
 * Read the repository, owning clone, checkout, lane name, and branch of a
 * git working directory.
 *
 * **Example** (Build the probe effect)
 *
 * ```ts
 * import { sessionCheckoutFacts } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(sessionCheckoutFacts("/work/beep-effect"))) // true
 * ```
 *
 * @param cwd - Any directory inside the checkout.
 * @returns The facts, or a git error when the directory is not a GitHub checkout.
 * @category utilities
 * @since 0.0.0
 */
export const sessionCheckoutFacts = Effect.fn("SessionLedger.checkoutFacts")(function* (cwd: string) {
  const path = yield* Path.Path;
  const repository = yield* detectPrRepository(cwd).pipe(
    Effect.mapError((error) => SessionLedgerError.make({ reason: "git", message: error.message, cause: error }))
  );
  const checkout = path.resolve(yield* gitLine(cwd, ["rev-parse", "--show-toplevel"]));
  const common = yield* gitLine(cwd, ["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  const branch = yield* gitLine(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const facts: SessionCheckoutFacts = {
    repository,
    clone: path.dirname(path.resolve(common)),
    checkout,
    lane: path.basename(checkout),
    branch,
  };
  return facts;
});

const optionalConfigString = (name: string): Effect.Effect<O.Option<string>> =>
  Config.option(Config.String(name)).pipe(Effect.orElseSucceed(O.none));

/**
 * The harness running this process and its session id, from the environment
 * Claude Code and Codex export to their tool shells.
 *
 * **Example** (Build the probe effect)
 *
 * ```ts
 * import { sessionHarness } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(sessionHarness)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sessionHarness: Effect.Effect<{
  readonly harness: PrProvenanceHarness;
  readonly sessionId: O.Option<string>;
}> = Effect.gen(function* () {
  const claude = yield* optionalConfigString("CLAUDE_CODE_SESSION_ID");
  if (O.isSome(claude)) return { harness: "claude-code" as const, sessionId: claude };
  const codex = yield* optionalConfigString("CODEX_THREAD_ID");
  if (O.isSome(codex)) return { harness: "codex" as const, sessionId: codex };
  return { harness: "unknown" as const, sessionId: O.none<string>() };
});

/**
 * What a `session note` says, before it is stamped with checkout facts.
 *
 * **Example** (Describe a note)
 *
 * ```ts
 * import type { SessionNoteInput } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * const input: SessionNoteInput = { cwd: "/work/beep-effect", state: "open", next: "resume", summary: O.none(), pr: O.none() }
 * console.log(input.state) // "open"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface SessionNoteInput {
  readonly checkoutOverride?: O.Option<string>;
  readonly cwd: string;
  readonly next: string;
  readonly pr: O.Option<PrNumber>;
  readonly state: SessionLedgerState;
  readonly summary: O.Option<string>;
}

/**
 * Stamp a ledger row with the checkout's facts, the harness identity, and the
 * clock, without writing it.
 *
 * **Example** (Build the row effect)
 *
 * ```ts
 * import { buildSessionRow } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const row = buildSessionRow({ cwd: "/work/beep-effect", state: "open", next: "resume", summary: O.none(), pr: O.none() })
 * console.log(Effect.isEffect(row)) // true
 * ```
 *
 * @param input - Where the session is and what it says.
 * @returns The row to append.
 * @category commands
 * @since 0.0.0
 */
export const buildSessionRow = Effect.fn("SessionLedger.buildRow")(function* (input: SessionNoteInput) {
  const facts = yield* sessionCheckoutFacts(input.cwd);
  const identity = yield* sessionHarness;
  const path = yield* Path.Path;
  const checkout = O.getOrElse(input.checkoutOverride ?? O.none<string>(), () => facts.checkout);
  return SessionLedgerRow.make({
    schemaVersion: "session-ledger/v1",
    repository: facts.repository,
    clone: facts.clone,
    checkout,
    lane: path.basename(checkout),
    branch: facts.branch,
    state: input.state,
    next: input.next,
    summary: input.summary,
    pr: input.pr,
    harness: identity.harness,
    sessionId: identity.sessionId,
    recordedAt: yield* DateTime.now,
  });
});

/**
 * Stamp a row for a checkout and append it to the ledger in context.
 *
 * **Example** (Build the write effect)
 *
 * ```ts
 * import { noteSession } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const write = noteSession({ cwd: "/work/beep-effect", state: "open", next: "resume", summary: O.none(), pr: O.none() })
 * console.log(Effect.isEffect(write)) // true
 * ```
 *
 * @param input - Where the session is and what it says.
 * @returns The appended row.
 * @category commands
 * @since 0.0.0
 */
export const noteSession = Effect.fn("SessionLedger.note")(function* (input: SessionNoteInput) {
  const row = yield* buildSessionRow(input);
  const ledger = yield* SessionLedger;
  yield* ledger.append(row);
  return row;
});

/**
 * Record that a sweep finished a checkout's work. `executeSweep` calls this
 * for every entrypoint (`sweep`, `sweep --retire`, `merge`,
 * `monitor --until-merged`) once it has observed the pull request MERGED.
 * Best effort: a missing ledger, a non-GitHub origin, or an unreadable
 * checkout never fails the sweep.
 *
 * **Example** (Build the effect)
 *
 * ```ts
 * import { recordSweepDone } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(recordSweepDone({ gitCwd: "/work/beep-effect", checkout: "/work/lane", branch: "feat/x" }))) // true
 * ```
 *
 * @param input - The clone to probe git in, the checkout the row is for, and the merged branch.
 * @category commands
 * @since 0.0.0
 */
export const recordSweepDone = Effect.fn("SessionLedger.recordSweepDone")(function* (input: {
  readonly gitCwd: string;
  readonly checkout: string;
  readonly branch: string;
}) {
  yield* Effect.gen(function* () {
    const row = yield* buildSessionRow({
      cwd: input.gitCwd,
      state: "done",
      next: `merged and swept ${input.branch}`,
      summary: O.none(),
      pr: O.none(),
      checkoutOverride: O.some(input.checkout),
    });
    const ledger = yield* makeSessionLedgerLive();
    yield* ledger.append(row);
  }).pipe(Effect.ignore);
});
