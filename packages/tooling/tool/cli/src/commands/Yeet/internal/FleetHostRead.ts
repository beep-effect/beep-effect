/**
 * Read-only fleet-host journal reads over the existing workstation SSH
 * wrappers (certainty-scorecard PERIL-11 slice 3, SPEC D18).
 *
 * One remote command per host, built only from fixed tokens and the host's
 * validated home-relative roots: `find` lists the run journals under the
 * roots and `tail` prints each one whole behind a `==> path <==` header. No
 * remote file, directory or lock is created. The output is parsed in memory
 * and folded by `yeet economics`; it is never written or printed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { OutputBound, repoRunOutputBound, runCapturedStreams } from "@beep/repo-cli-kit/process/StepExec";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { fleetStateDirectory, readOptionalFleetStateFile } from "../../Worktree/internal/FleetRoots.ts";
import { WorktreeCommandError } from "../../Worktree/Worktree.errors.ts";
import { FleetHostRoot, FleetHostsDocument, FleetHostUnreachableReason } from "./FleetHosts.schemas.ts";
import type * as FileSystem from "effect/FileSystem";
import type { FleetHostRoute } from "./FleetHosts.schemas.ts";
import type { PrRepository } from "./Provenance.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/FleetHostRead");

// `find <roots> <suffix>`: list regular run journals at most eight levels under each root, never
// through a symbolic link (find's default -P), skipping dependency and git trees, and print each
// whole behind a header. `tail -v -c +1` reads a file from its first byte; it writes nothing.
const READ_COMMAND_PROGRAM = "find";
const READ_COMMAND_SUFFIX: ReadonlyArray<string> = [
  "-maxdepth",
  "8",
  "(",
  "-name",
  "node_modules",
  "-o",
  "-name",
  ".git",
  ")",
  "-prune",
  "-o",
  "-type",
  "f",
  "-path",
  "*/runs/*/attempts.ndjson",
  "-exec",
  "tail",
  "-v",
  "-c",
  "+1",
  "--",
  "{}",
  "+",
];

const quoteToken = (token: string): string => `'${token}'`;
const isTokenRun = A.makeEquivalence(Str.Equivalence);
const QUOTED_TOKEN = /^'([^']*)'$/u;
const isFleetHostRoot = S.is(FleetHostRoot);

// The tokens of a single-quoted command line, or none when any token is not one plain quoted word.
const unquoteTokens = (command: string): O.Option<ReadonlyArray<string>> =>
  O.all(
    A.map(Str.split(command, " "), (token) =>
      pipe(
        Str.match(QUOTED_TOKEN)(token),
        O.flatMap((match) => O.fromUndefinedOr(match[1]))
      )
    )
  );

const isReadOnlyTokens = (tokens: ReadonlyArray<string>): boolean => {
  const roots = A.dropRight(A.drop(tokens, 1), A.length(READ_COMMAND_SUFFIX));
  return (
    O.contains(A.head(tokens), READ_COMMAND_PROGRAM) &&
    A.isReadonlyArrayNonEmpty(roots) &&
    A.every(roots, isFleetHostRoot) &&
    isTokenRun(A.takeRight(tokens, A.length(READ_COMMAND_SUFFIX)), READ_COMMAND_SUFFIX)
  );
};

/**
 * Whether a remote command line is exactly the read-only journal read.
 *
 * **Details**
 *
 * The line must be `find`, one or more {@link FleetHostRoot} roots, and the
 * fixed listing suffix, each a single-quoted word. Anything else (another
 * program, an extra `-exec`, `-delete`, a redirect, a root with a shell
 * metacharacter) is refused.
 *
 * **Example** (Accept the read, refuse a write)
 *
 * ```ts
 * import { fleetHostReadCommand, isReadOnlyFleetHostCommand } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(isReadOnlyFleetHostCommand(fleetHostReadCommand(["YeeBois/projects"]))) // true
 * console.log(isReadOnlyFleetHostCommand("'mkdir' '-p' 'x'")) // false
 * ```
 *
 * @param command - A remote command line.
 * @returns `true` only for the read-only journal read.
 * @category predicates
 * @since 0.0.0
 */
export const isReadOnlyFleetHostCommand = (command: string): boolean =>
  O.exists(unquoteTokens(command), isReadOnlyTokens);

/**
 * A remote command line that {@link isReadOnlyFleetHostCommand} accepts.
 *
 * **Example** (Check a command line)
 *
 * ```ts
 * import { FleetHostReadCommand } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(FleetHostReadCommand)("'rm' '-rf' 'x'")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetHostReadCommand = S.String.check(
  S.makeFilter(
    isReadOnlyFleetHostCommand,
    $I.annote("FleetHostReadCommandReadOnly", {
      title: "Read-only fleet host command",
      description: "The fixed find-and-tail journal read over validated home-relative roots.",
      message: "Expected the read-only fleet host journal read",
    })
  )
).pipe(
  S.brand("FleetHostReadCommand"),
  $I.annoteSchema("FleetHostReadCommand", {
    description: "The read-only remote command that lists and prints a fleet host's run journals.",
  })
);

/**
 * A read-only remote command line; see {@link FleetHostReadCommand}.
 *
 * @category models
 * @since 0.0.0
 */
export type FleetHostReadCommand = typeof FleetHostReadCommand.Type;

/**
 * Build the remote command that reads a host's run journals.
 *
 * **Details**
 *
 * Each token is single-quoted, so the remote shell runs `find` with the
 * roots and the fixed suffix verbatim: no glob, group or redirect is
 * interpreted. The roots are relative to the login's home directory.
 *
 * **Example** (Read two roots)
 *
 * ```ts
 * import { FleetHostRoot, fleetHostReadCommand } from "@beep/repo-cli/test/Yeet"
 *
 * const command = fleetHostReadCommand([FleetHostRoot.make("YeeBois/projects")])
 * console.log(command.startsWith("'find' 'YeeBois/projects' '-maxdepth' '8'")) // true
 * ```
 *
 * @param roots - The host's home-relative roots.
 * @returns The read-only command line.
 * @category constructors
 * @since 0.0.0
 */
export const fleetHostReadCommand = (roots: A.NonEmptyReadonlyArray<FleetHostRoot>): FleetHostReadCommand =>
  FleetHostReadCommand.make(A.join(A.map([READ_COMMAND_PROGRAM, ...roots, ...READ_COMMAND_SUFFIX], quoteToken), " "));

/**
 * One file the remote read printed, held in memory only.
 *
 * **Example** (A printed journal)
 *
 * ```ts
 * import { FleetHostFile } from "@beep/repo-cli/test/Yeet"
 *
 * const file = FleetHostFile.make({ path: "p/r/.beep/yeet/runs/main-1/attempts.ndjson", contents: "" })
 * console.log(file.contents.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetHostFile extends S.Opaque<FleetHostFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String,
    contents: S.String,
  }).pipe(
    $I.annoteSchema("FleetHostFile", {
      description: "One file a fleet host read printed: its home-relative path and exact text, held in memory only.",
    })
  )
) {}

const HEADER = /^(.*?)==> (.+) <==$/u;

interface FleetHostHeader {
  readonly index: number;
  readonly path: string;
  readonly prefix: string;
}

const headerAt = (line: string, index: number): O.Option<FleetHostHeader> =>
  pipe(
    Str.match(HEADER)(line),
    O.flatMap((match) => O.all([O.fromUndefinedOr(match[1]), O.fromUndefinedOr(match[2])])),
    O.map(([prefix, path]) => ({ index, path, prefix }))
  );

/**
 * Split the read's output into the files it printed.
 *
 * **Details**
 *
 * `tail -v` prints `==> path <==` before each file and a newline between
 * files of one invocation, so a file's text is every line up to the next
 * header, joined with newlines: exact, a torn last line included. When
 * `find` batches the files into a second `tail`, that header follows the
 * previous file's bytes directly; text before it on the same line is the
 * previous file's unterminated last line. A path printed twice (two roots
 * reaching one directory) keeps its first copy.
 *
 * **Example** (Two files)
 *
 * ```ts
 * import { parseFleetHostReadOutput } from "@beep/repo-cli/test/Yeet"
 *
 * const files = parseFleetHostReadOutput("==> a/runs/r/attempts.ndjson <==\n{}\n\n==> b/runs/r/attempts.ndjson <==\n{}\n")
 * console.log(files.map((file) => file.contents)) // ["{}\n", "{}\n"]
 * ```
 *
 * @param output - The read command's standard output.
 * @returns Each printed file's path and exact text.
 * @category parsing
 * @since 0.0.0
 */
export const parseFleetHostReadOutput = (output: string): ReadonlyArray<FleetHostFile> => {
  const lines = Str.split(output, "\n");
  const headers = A.getSomes(A.map(lines, headerAt));
  const files = A.map(headers, (header, position) => {
    const next = A.get(headers, position + 1);
    const end = O.getOrElse(
      O.map(next, (following) => following.index),
      () => A.length(lines)
    );
    const tail = O.match(next, {
      onNone: A.empty<string>,
      onSome: (following) => (Str.isNonEmpty(following.prefix) ? A.of(following.prefix) : A.empty<string>()),
    });
    const body = A.take(A.drop(lines, header.index + 1), end - header.index - 1);
    return FleetHostFile.make({ path: header.path, contents: A.join(A.appendAll(body, tail), "\n") });
  });
  return A.dedupeWith(files, (self, that) => Str.Equivalence(self.path, that.path));
};

/**
 * Where a printed journal belongs: its run and, for a live checkout, the
 * checkout path; none for a store partition's journal.
 *
 * **Example** (A store journal)
 *
 * ```ts
 * import { FleetHostJournalPath } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const location = FleetHostJournalPath.make({ checkout: O.none(), runId: "main-1" })
 * console.log(O.isNone(location.checkout)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetHostJournalPath extends S.Opaque<FleetHostJournalPath, { readonly brand: unique symbol }>()(
  S.Struct({
    checkout: S.OptionFromNullOr(S.String),
    runId: S.String,
  }).pipe(
    $I.annoteSchema("FleetHostJournalPath", {
      description: "A printed journal's run, and its home-relative checkout path, none for the host's store.",
    })
  )
) {}

const LIVE_PACKET_SEGMENTS: ReadonlyArray<string> = [".beep", "yeet"];
const STORE_ATTEMPTS_SEGMENT = "attempts";

/**
 * Classify a printed path as a live checkout's run journal or the host's
 * attempt-journal store partition for `repositoryKey`.
 *
 * **Details**
 *
 * A live journal is `<checkout>/.beep/yeet/runs/<runId>/attempts.ndjson`; a
 * store journal is `<…>/attempts/<repositoryKey>/runs/<runId>/attempts.ndjson`.
 * Any other path (another repository's partition, a deeper match of the
 * `find` pattern) is none, and economics counts it as a skipped file.
 *
 * **Example** (A live checkout and a store partition)
 *
 * ```ts
 * import { classifyFleetHostJournalPath } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const key = "github.com__o__r"
 * const live = classifyFleetHostJournalPath("p/r1/.beep/yeet/runs/main-1/attempts.ndjson", key)
 * const store = classifyFleetHostJournalPath(`s/attempts/${key}/runs/main-1/attempts.ndjson`, key)
 * console.log(O.getOrNull(O.flatMap(live, (entry) => entry.checkout))) // "p/r1"
 * console.log(O.exists(store, (entry) => O.isNone(entry.checkout))) // true
 * ```
 *
 * @param path - A path the read printed, relative to the host's home.
 * @param repositoryKey - The fleet's `host__owner__name` key.
 * @returns The run and checkout, or none for a path that is not this fleet's run journal.
 * @category parsing
 * @since 0.0.0
 */
export const classifyFleetHostJournalPath: {
  (repositoryKey: string): (path: string) => O.Option<FleetHostJournalPath>;
  (path: string, repositoryKey: string): O.Option<FleetHostJournalPath>;
} = dual(2, (path: string, repositoryKey: string): O.Option<FleetHostJournalPath> => {
  const segments = Str.split(path, "/");
  const count = A.length(segments);
  const base = A.take(segments, count - 3);
  const runId = O.getOrElse(A.get(segments, count - 2), () => "");
  const isRunJournal =
    count >= 4 && O.contains(A.get(segments, count - 3), "runs") && O.contains(A.last(segments), "attempts.ndjson");
  const isLive = isTokenRun(A.takeRight(base, 2), LIVE_PACKET_SEGMENTS);
  const isStore =
    O.contains(A.last(base), repositoryKey) && O.contains(A.get(base, A.length(base) - 2), STORE_ATTEMPTS_SEGMENT);
  const checkout = isLive ? O.some(A.join(A.dropRight(base, 2), "/")) : O.none<string>();
  return isRunJournal && Str.isNonEmpty(runId) && (isLive || isStore)
    ? O.some(FleetHostJournalPath.make({ checkout: O.filter(checkout, Str.isNonEmpty), runId }))
    : O.none();
});

/**
 * What a fleet-host shell returns: the exit status and the bounded
 * standard output. Standard error is drained and dropped.
 *
 * **Example** (A clean read)
 *
 * ```ts
 * import { FleetHostShellOutput } from "@beep/repo-cli/test/Yeet"
 *
 * const output = FleetHostShellOutput.make({ exitCode: 0, stdout: "", truncated: false })
 * console.log(output.exitCode) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetHostShellOutput extends S.Opaque<FleetHostShellOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    exitCode: S.Finite,
    stdout: S.String,
    truncated: S.Boolean,
  }).pipe(
    $I.annoteSchema("FleetHostShellOutput", {
      description: "A fleet host read's exit status and bounded standard output.",
    })
  )
) {}

/**
 * The shell failures a fleet-host read reports as unreachable.
 *
 * **Example** (Recognise a timeout)
 *
 * ```ts
 * import { FleetHostShellFailure } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FleetHostShellFailure.is.timeout("timeout")) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const FleetHostShellFailure = FleetHostUnreachableReason.pick([
  "timeout",
  "spawn-failed",
  "refused-command",
]).pipe(
  $I.annoteSchema("FleetHostShellFailure", {
    description: "Why a fleet host shell ran nothing to completion: timeout, spawn failure, or a refused command.",
  })
);

/**
 * The shell failures a fleet-host read reports; see {@link FleetHostShellFailure}.
 *
 * @category errors
 * @since 0.0.0
 */
export type FleetHostShellFailure = typeof FleetHostShellFailure.Type;

/**
 * Raised by a {@link FleetHostShell} that ran nothing to completion.
 *
 * **Example** (A refused command)
 *
 * ```ts
 * import { FleetHostShellError } from "@beep/repo-cli/test/Yeet"
 *
 * const error = FleetHostShellError.make({ reason: "refused-command", message: "not the journal read" })
 * console.log(error.reason) // "refused-command"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class FleetHostShellError extends S.TaggedError<FleetHostShellError, { readonly brand: unique symbol }>(
  $I`FleetHostShellError`
)(
  "FleetHostShellError",
  {
    reason: FleetHostShellFailure,
    message: S.String,
  },
  $I.annoteError<FleetHostShellError>("FleetHostShellError", {
    description: "A fleet host shell timed out, could not start its route, or refused a non-read command.",
  })
) {}

/**
 * Operations the fleet-host shell provides.
 *
 * **Example** (Describe a read)
 *
 * ```ts
 * import { FleetHostRoot, fleetHostReadCommand } from "@beep/repo-cli/test/Yeet"
 * import type { FleetHostShellShape } from "@beep/repo-cli/test/Yeet"
 *
 * const read = (shell: FleetHostShellShape) =>
 *   shell.run("ssh-tbk-worker", fleetHostReadCommand([FleetHostRoot.make("YeeBois/projects")]))
 * console.log(read.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface FleetHostShellShape {
  readonly run: (
    route: FleetHostRoute,
    command: FleetHostReadCommand
  ) => Effect.Effect<FleetHostShellOutput, FleetHostShellError>;
}

/**
 * How long one host's read may take: a YubiKey touch (the wrappers' 60 s
 * window) plus the transfer.
 *
 * @category constants
 * @since 0.0.0
 */
export const FLEET_HOST_READ_TIMEOUT = Duration.minutes(2);

// The workstation's 371 live journals totalled 8.9 MB; 64 MiB leaves a host room for several times that.
const FLEET_HOST_OUTPUT_BOUND = OutputBound.make({
  maxChars: 64 * 1024 * 1024,
  truncatedNotice: "",
});

const makeFleetHostShellLive = Effect.fn("FleetHostShell.makeLive")(function* () {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const secureRandom = yield* SecureRandom.SecureRandom;
  const isReadCommand = S.is(FleetHostReadCommand);
  const run = (route: FleetHostRoute, command: FleetHostReadCommand) =>
    isReadCommand(command)
      ? runCapturedStreams({
          command: route,
          args: [command],
          extendEnv: true,
          stdin: "ignore",
          stdoutBound: FLEET_HOST_OUTPUT_BOUND,
          stderrBound: repoRunOutputBound,
        }).pipe(
          Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
          Effect.provideService(SecureRandom.SecureRandom, secureRandom),
          Effect.mapError(() =>
            FleetHostShellError.make({ reason: "spawn-failed", message: `${route} could not be started.` })
          ),
          Effect.timeoutOption(FLEET_HOST_READ_TIMEOUT),
          Effect.flatMap(
            O.match({
              onNone: () =>
                Effect.fail(
                  FleetHostShellError.make({ reason: "timeout", message: `${route} did not finish in time.` })
                ),
              onSome: (output) =>
                Effect.succeed(
                  FleetHostShellOutput.make({
                    exitCode: output.exitCode,
                    stdout: output.stdout,
                    truncated: output.truncated,
                  })
                ),
            })
          )
        )
      : Effect.fail(
          FleetHostShellError.make({ reason: "refused-command", message: "Only the read-only journal read may run." })
        );
  return { run } satisfies FleetHostShellShape;
});

/**
 * Service boundary that runs the read-only journal read on a fleet host over
 * its existing workstation SSH wrapper.
 *
 * **Details**
 *
 * The live layer runs `<route> <command>` with standard input closed, so the
 * wrapper's plain (non-`--admin`) login runs exactly the one command; it
 * refuses any command line that is not {@link FleetHostReadCommand} before
 * starting anything. Tests provide a fake layer; no test reaches a real host.
 *
 * **Example** (Request the shell)
 *
 * ```ts
 * import { FleetHostShell } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* FleetHostShell }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class FleetHostShell extends Context.Service<FleetHostShell, FleetHostShellShape>()($I`FleetHostShell`, {
  make: makeFleetHostShellLive(),
}) {
  /** Live shell over the workstation SSH wrappers on `PATH`. */
  static readonly layer: Layer.Layer<
    FleetHostShell,
    never,
    ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
  > = Layer.effect(FleetHostShell, FleetHostShell.make);
}

const decodeHostsDocument = S.decodeUnknownEffect(S.fromJsonString(FleetHostsDocument));

/**
 * Read `<state>/beep/fleet/<repo-key>/hosts.json`, the fleet hosts economics
 * may read.
 *
 * **Details**
 *
 * A missing file is none; a file that does not decode fails with a typed
 * error. `BEEP_FLEET_STATE_ROOT` relocates the state directory, as it does
 * for `roots.json`.
 *
 * **Example** (Build the read)
 *
 * ```ts
 * import { readConfiguredFleetHosts } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const read = readConfiguredFleetHosts({ host: "github.com", owner: "beep-effect", name: "beep-effect" })
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @param repository - The repository whose fleet hosts are read.
 * @returns The decoded document, or none when no `hosts.json` exists.
 * @category utilities
 * @since 0.0.0
 */
export const readConfiguredFleetHosts = Effect.fn("FleetHostRead.readConfigured")(function* (
  repository: PrRepository
): Effect.fn.Return<O.Option<FleetHostsDocument>, WorktreeCommandError, FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const directory = yield* fleetStateDirectory(repository);
  const file = path.join(directory, "hosts.json");
  const content = yield* readOptionalFleetStateFile(file);
  return yield* Effect.transposeOption(
    O.map(content, (text) =>
      decodeHostsDocument(text).pipe(
        Effect.mapError(WorktreeCommandError.new(`Failed to decode ${file} as a fleet hosts document.`, { path: file }))
      )
    )
  );
});
