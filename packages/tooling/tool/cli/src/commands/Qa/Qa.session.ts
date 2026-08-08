/**
 * Shared round, target, and provenance helpers for the `beep qa` group.
 *
 * Everything here is what more than one subcommand needs: where `.beep/qa`
 * lives, how `--url`/`--app` resolve to a capture target, how a round's
 * `events.ndjson` decodes, and the commit/tool provenance stamped into
 * `session.json`. Subcommand-specific logic stays in its own module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { ActionEvent, decodeActionEventJson, RoundNumber, SessionId, SessionStore } from "@beep/qa-capture";
import { SchemaUtils } from "@beep/schema";
import { A, O, Str, thunkEmptyReadonlyRecord } from "@beep/utils";
import { Effect, FileSystem, flow, Path, pipe } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { runCaptured } from "../../internal/process/index.ts";
import { QaCommandError } from "./Qa.errors.ts";
import type { RoundLayout } from "@beep/qa-capture";
import type { R } from "@beep/utils";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Qa/Qa.session");

/**
 * Portless dev-server port every `*.beep.localhost` app is proxied on.
 *
 * **Example** (Logging the constant value)
 *
 * ```ts
 * import { PORTLESS_PORT } from "@beep/repo-cli/commands/Qa/Qa.session"
 *
 * console.log(PORTLESS_PORT) // 1355
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PORTLESS_PORT = 1355;

/**
 * Resolve the `.beep/qa` root for a checkout.
 *
 * **Example** (Resolving QA root path)
 *
 * ```ts
 * import { qaRootPath } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.map(Effect.service(Path.Path), (path) => qaRootPath(path, "/repo"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const qaRootPath: {
  (cwd: string): (path: Path.Path) => string;
  (path: Path.Path, cwd: string): string;
} = dual(2, (path: Path.Path, cwd: string): string => path.join(cwd, ".beep", "qa"));

/**
 * Portless URL of a repo dev-server app.
 *
 * **Example** (Building app portless URL)
 *
 * ```ts
 * import { portlessUrlForApp } from "@beep/repo-cli/commands/Qa/Qa.session"
 *
 * console.log(portlessUrlForApp("storybook")) // "http://storybook.beep.localhost:1355"
 * ```
 *
 * @param app - Portless app name, for example storybook.
 * @returns The app's canonical portless dev-server URL.
 * @category utilities
 * @since 0.0.0
 */
export const portlessUrlForApp = (app: string): string => `http://${app}.beep.localhost:${PORTLESS_PORT}`;

/**
 * The page a capture round drives, with the CORS origins its witness may post from.
 *
 * **Example** (Creating a CaptureTarget)
 *
 * ```ts
 * import { CaptureTarget } from "@beep/repo-cli/commands/Qa/Qa.session"
 *
 * const target = CaptureTarget.make({
 *   allowedOrigins: ["http://storybook.beep.localhost:1355"],
 *   url: "http://storybook.beep.localhost:1355/iframe.html"
 * })
 * console.log(target.url)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CaptureTarget extends S.Class<CaptureTarget>($I`CaptureTarget`)(
  {
    allowedOrigins: S.Array(S.String).pipe(
      $I.annoteKey("CaptureTarget.allowedOrigins", {
        description: "Exact origins the collector accepts witness posts from.",
      })
    ),
    url: S.String.pipe(
      $I.annoteKey("CaptureTarget.url", {
        description: "Absolute URL the harness or browser navigates to.",
      })
    ),
  },
  $I.annote("CaptureTarget", {
    description: "The page a capture round drives, with its allowed witness origins.",
  })
) {}

const originsOf = (url: URL): ReadonlyArray<string> => {
  const suffix = Str.isEmpty(url.port) ? "" : `:${url.port}`;
  return pipe(
    A.make(url.origin, `${url.protocol}//localhost${suffix}`, `${url.protocol}//127.0.0.1${suffix}`),
    A.dedupe
  );
};

/**
 * The `--url` / `--app` pair {@link resolveCaptureTarget} resolves a page from.
 *
 * **Example** (Request with optional app)
 *
 * ```ts
 * import { CaptureTargetRequest } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import * as O from "effect/Option"
 *
 * const request = CaptureTargetRequest.make({ app: O.some("storybook"), url: O.none() })
 * console.log(O.isSome(request.app)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CaptureTargetRequest extends S.Class<CaptureTargetRequest>($I`CaptureTargetRequest`)(
  {
    app: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CaptureTargetRequest.app", {
        description: "Portless app name to expand into a dev-server URL.",
      })
    ),
    url: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("CaptureTargetRequest.url", {
        description: "Absolute URL, which wins over `app` when both are supplied.",
      })
    ),
  },
  $I.annote("CaptureTargetRequest", {
    description: "Unresolved capture target as the operator supplied it on the command line.",
  })
) {}

/**
 * Resolve `--url` / `--app` into the page a round drives.
 *
 * **Details**
 *
 * `--url` wins when both are supplied; `--app` expands through the portless
 * naming mandate rather than a numeric localhost port.
 *
 * **Example** (Resolving from app flag)
 *
 * ```ts
 * import { CaptureTargetRequest, resolveCaptureTarget } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = resolveCaptureTarget(CaptureTargetRequest.make({ app: O.some("storybook"), url: O.none() }))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - The --url / --app pair as supplied on the command line.
 * @returns An Effect resolving the capture target, failing when neither flag yields a usable URL.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveCaptureTarget = (options: CaptureTargetRequest): Effect.Effect<CaptureTarget, QaCommandError> =>
  pipe(
    O.orElse(options.url, () => O.map(options.app, portlessUrlForApp)),
    O.match({
      onNone: () =>
        Effect.fail(
          QaCommandError.make({
            message: "qa record needs a capture target: pass --url <absolute-url> or --app <portless-app-name>.",
          })
        ),
      onSome: (raw) =>
        Effect.try({
          try: () => new URL(raw),
          catch: (cause) => QaCommandError.new(cause, `qa record could not parse "${raw}" as an absolute URL.`),
        }).pipe(Effect.map((url) => CaptureTarget.make({ allowedOrigins: originsOf(url), url: raw }))),
    })
  );

// Both round resolvers accept an explicit `--round` the same way and differ
// only in what they do when the flag is absent, so the decode branch is shared
// and the discovery branch is the parameter.
const roundOrDiscovered = (
  round: O.Option<number>,
  onNone: () => Effect.Effect<RoundNumber, QaCommandError, SessionStore>
): Effect.Effect<RoundNumber, QaCommandError, SessionStore> =>
  O.match(round, {
    onNone,
    onSome: (value) =>
      S.decodeUnknownEffect(RoundNumber)(value).pipe(
        QaCommandError.mapError(`qa --round ${value} is not a positive round number.`)
      ),
  });

/**
 * Resolve an explicit `--round` flag, or discover the next free round.
 *
 * **Example** (Resolving explicit round number)
 *
 * ```ts
 * import { resolveRound } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = resolveRound("/repo/.beep/qa", O.some(3))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
// Two distinct public round resolvers with the same signature. The shared
// decode branch is already factored into roundOrDiscovered; what remains is
// entry-point boilerplate that only merging the two public APIs could remove.
// fallow-ignore-next-line code-duplication -- two public round resolvers; the shared decode branch is already extracted to roundOrDiscovered
export const resolveRound = Effect.fn("QaSession.resolveRound")(function* (
  qaRoot: string,
  round: O.Option<number>
): Effect.fn.Return<RoundNumber, QaCommandError, SessionStore> {
  const store = yield* SessionStore;
  return yield* roundOrDiscovered(round, () =>
    store
      .discoverNextRound(qaRoot)
      .pipe(QaCommandError.mapError("qa could not discover the next round under .beep/qa."))
  );
});

/**
 * Resolve an existing round directory, defaulting to the highest recorded round.
 *
 * **Example** (Resolving highest existing round)
 *
 * ```ts
 * import { resolveExistingRound } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const program = resolveExistingRound("/repo/.beep/qa", O.none())
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const resolveExistingRound = Effect.fn("QaSession.resolveExistingRound")(function* (
  qaRoot: string,
  round: O.Option<number>
): Effect.fn.Return<RoundNumber, QaCommandError, SessionStore> {
  const store = yield* SessionStore;
  return yield* roundOrDiscovered(round, () =>
    store.discoverNextRound(qaRoot).pipe(
      QaCommandError.mapError("qa could not inspect .beep/qa for recorded rounds."),
      Effect.flatMap((next) =>
        next > 1
          ? Effect.succeed(RoundNumber.make(next - 1))
          : Effect.fail(
              QaCommandError.make({
                message: "qa found no recorded rounds under .beep/qa; run `bun run beep qa record` first.",
              })
            )
      )
    )
  );
});

/**
 * Witness events decoded from one round's NDJSON log.
 *
 * **Example** (Creating empty event log)
 *
 * ```ts
 * import { QaEventLog } from "@beep/repo-cli/commands/Qa/Qa.session"
 *
 * const log = QaEventLog.make({ events: [], rejectedCount: 0 })
 * console.log(log.rejectedCount) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QaEventLog extends S.Class<QaEventLog>($I`QaEventLog`)(
  {
    events: S.Array(ActionEvent).pipe(
      $I.annoteKey("QaEventLog.events", {
        description: "Events that decoded cleanly, in log order.",
      })
    ),
    rejectedCount: S.Int.pipe(
      $I.annoteKey("QaEventLog.rejectedCount", {
        description: "Lines that failed schema decoding; recorded, never fatal.",
      })
    ),
  },
  $I.annote("QaEventLog", {
    description: "Witness events decoded from one round's NDJSON log.",
  })
) {}

/**
 * Read and decode a round's `events.ndjson`, tolerating undecodable lines.
 *
 * **Details**
 *
 * A malformed line is counted, not raised: a partially-written log from an
 * interrupted session must still yield every event it did flush.
 *
 * **Example** (Reading round event log)
 *
 * ```ts
 * import { readEventLog } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect } from "effect"
 *
 * const program = readEventLog("/repo/.beep/qa/round-1/events.ndjson")
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const readEventLog = Effect.fn("QaSession.readEventLog")(function* (
  eventsPath: string
): Effect.fn.Return<QaEventLog, QaCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs
    .exists(eventsPath)
    .pipe(QaCommandError.mapError(`qa could not inspect the witness log at ${eventsPath}.`));
  if (!exists) {
    return QaEventLog.make({ events: [], rejectedCount: 0 });
  }
  const raw = yield* fs
    .readFileString(eventsPath)
    .pipe(QaCommandError.mapError(`qa could not read the witness log at ${eventsPath}.`));
  const lines = pipe(
    raw,
    Str.split("\n"),
    A.map(Str.trim),
    A.filter((line) => !Str.isEmpty(line))
  );
  const decoded = yield* Effect.forEach(lines, (line) => Effect.option(decodeActionEventJson(line)));
  return QaEventLog.make({
    events: A.getSomes(decoded),
    rejectedCount: A.length(A.filter(decoded, O.isNone)),
  });
});

const capturedText = (command: string, args: ReadonlyArray<string>) =>
  runCaptured({ args, command, source: "stdout", trim: true }).pipe(
    Effect.map((step) => (step.exitCode === 0 ? O.some(step.output) : O.none<string>())),
    Effect.orElseSucceed(O.none<string>)
  );

/**
 * Commit provenance of the checkout a round was recorded from.
 *
 * **Example** (Creating dirty commit provenance)
 *
 * ```ts
 * import { CommitProvenance } from "@beep/repo-cli/commands/Qa/Qa.session"
 *
 * const commit = CommitProvenance.make({ dirty: true, sha: "a73f509b5a" })
 * console.log(commit.dirty) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CommitProvenance extends S.Class<CommitProvenance>($I`CommitProvenance`)(
  {
    dirty: S.Boolean.pipe(
      $I.annoteKey("CommitProvenance.dirty", {
        description: "Whether the working tree had uncommitted changes at capture time.",
      })
    ),
    sha: S.String.pipe(
      $I.annoteKey("CommitProvenance.sha", {
        description: 'Resolved HEAD commit sha, or "unknown" outside a git checkout.',
      })
    ),
  },
  $I.annote("CommitProvenance", {
    description: "Commit provenance of the checkout a capture round was recorded from.",
  })
) {}

/**
 * Read HEAD sha and dirty state, degrading to `unknown` outside a checkout.
 *
 * **Example** (Reading HEAD commit state)
 *
 * ```ts
 * import { readCommitProvenance } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readCommitProvenance("/repo"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const readCommitProvenance = Effect.fn("QaSession.readCommitProvenance")(function* (
  cwd: string
): Effect.fn.Return<CommitProvenance, never, ChildProcessSpawner.ChildProcessSpawner> {
  const [sha, status] = yield* Effect.all(
    [capturedText("git", ["-C", cwd, "rev-parse", "HEAD"]), capturedText("git", ["-C", cwd, "status", "--porcelain"])],
    { concurrency: 2 }
  );
  return CommitProvenance.make({
    dirty: O.match(status, { onNone: () => false, onSome: (text) => !Str.isEmpty(text) }),
    sha: O.getOrElse(sha, () => "unknown"),
  });
});

const thunkUnknown = (): string => "unknown";

const firstLineVersion: (text: string) => string = flow(Str.split("\n"), A.head, O.getOrElse(thunkUnknown));

const toolVersion = (tool: string, output: O.Option<string>): R.ReadonlyRecord<string, string> =>
  pipe(
    output,
    O.map((text): R.ReadonlyRecord<string, string> => ({ [tool]: firstLineVersion(text) })),
    O.getOrElse(thunkEmptyReadonlyRecord<string, string>)
  );

/**
 * Best-effort versions of the native tools a round depends on.
 *
 * **Details**
 *
 * Every probe degrades to an omitted key rather than failing the capture: a
 * missing exiftool must not stop a recording that has already started.
 *
 * **Example** (Collecting native tool versions)
 *
 * ```ts
 * import { collectToolVersions } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(collectToolVersions())) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const collectToolVersions = Effect.fn("QaSession.collectToolVersions")(function* (): Effect.fn.Return<
  Readonly<Record<string, string>>,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> {
  const [ffmpeg, exiftool] = yield* Effect.all(
    [capturedText("ffmpeg", ["-version"]), capturedText("exiftool", ["-ver"])],
    { concurrency: 2 }
  );
  return {
    bun: Bun.version,
    ...toolVersion("ffmpeg", ffmpeg),
    ...toolVersion("exiftool", exiftool),
  };
});

/**
 * Build the session identifier stamped into every artifact of a round.
 *
 * **Example** (Building round session id)
 *
 * ```ts
 * import { makeSessionId } from "@beep/repo-cli/commands/Qa/Qa.session"
 *
 * console.log(makeSessionId(2, 1754000000000)) // "qa-round-2-1754000000000"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const makeSessionId: {
  (startedAtEpochMs: number): (round: number) => SessionId;
  (round: number, startedAtEpochMs: number): SessionId;
} = dual(
  2,
  (round: number, startedAtEpochMs: number): SessionId => SessionId.make(`qa-round-${round}-${startedAtEpochMs}`)
);

/**
 * Path of the recording-start hint the playwright harness writes.
 *
 * **Example** (Resolving record hint path)
 *
 * ```ts
 * import { RoundLayout } from "@beep/qa-capture"
 * import { recordHintPath } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect, Path } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const path = yield* Path.Path
 *   const layout = RoundLayout.make({
 *     clipsDir: "/repo/.beep/qa/round-1/clips",
 *     eventsPath: "/repo/.beep/qa/round-1/events.ndjson",
 *     framesDir: "/repo/.beep/qa/round-1/frames",
 *     reportPath: "/repo/.beep/qa/round-1/report.md",
 *     root: "/repo/.beep/qa/round-1",
 *     round: 1,
 *     sessionPath: "/repo/.beep/qa/round-1/session.json",
 *     sheetsDir: "/repo/.beep/qa/round-1/sheets",
 *     videoDir: "/repo/.beep/qa/round-1/video"
 *   })
 *   return recordHintPath(path, layout)
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const recordHintPath: {
  (layout: RoundLayout): (path: Path.Path) => string;
  (path: Path.Path, layout: RoundLayout): string;
} = dual(2, (path: Path.Path, layout: RoundLayout): string => path.join(layout.videoDir, "record-hint.json"));

const RecordHint = S.Struct({
  recordStartHintEpochMs: S.Finite,
});

const RecordHintJson = S.fromJsonString(RecordHint);

/**
 * Read the harness recording-start hint, when the round produced one.
 *
 * **Example** (Reading recording start hint)
 *
 * ```ts
 * import { readRecordStartHint } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(readRecordStartHint("/repo/.beep/qa/round-1/video/record-hint.json"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const readRecordStartHint = Effect.fn("QaSession.readRecordStartHint")(function* (
  hintPath: string
): Effect.fn.Return<O.Option<number>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(hintPath).pipe(
    Effect.flatMap(S.decodeUnknownEffect(RecordHintJson)),
    Effect.map((hint) => O.some(hint.recordStartHintEpochMs)),
    Effect.orElseSucceed(O.none<number>)
  );
});

/**
 * Write the recording-start hint the clock correlator falls back to.
 *
 * **Example** (Writing recording start hint)
 *
 * ```ts
 * import { writeRecordStartHint } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect } from "effect"
 *
 * const program = writeRecordStartHint("/repo/.beep/qa/round-1/video/record-hint.json", 1754000000000)
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const writeRecordStartHint = Effect.fn("QaSession.writeRecordStartHint")(function* (
  hintPath: string,
  epochMs: number
): Effect.fn.Return<void, QaCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const json = yield* S.encodeEffect(RecordHintJson)({ recordStartHintEpochMs: epochMs }).pipe(
    QaCommandError.mapError("qa could not encode the recording-start hint.")
  );
  yield* fs
    .writeFileString(hintPath, json)
    .pipe(QaCommandError.mapError(`qa could not write the recording-start hint at ${hintPath}.`));
});

/**
 * Locate the recorded video inside a round's `video/` directory.
 *
 * **Details**
 *
 * Prefers the canonical `capture.webm` the harness renames to, then falls back
 * to the first recorded container playwright or OBS left behind.
 *
 * **Example** (Discovering recorded video file)
 *
 * ```ts
 * import { discoverRecordedVideo } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(discoverRecordedVideo("/repo/.beep/qa/round-1/video"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const discoverRecordedVideo = Effect.fn("QaSession.discoverRecordedVideo")(function* (
  videoDir: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const entries = yield* fs.readDirectory(videoDir).pipe(Effect.orElseSucceed((): ReadonlyArray<string> => []));
  const videos = pipe(
    entries,
    A.filter((entry) => A.contains([".webm", ".mkv", ".mp4"], Str.toLowerCase(path.extname(entry)))),
    A.sort(Str.Order)
  );
  return pipe(
    O.orElse(
      A.findFirst(videos, (entry) => entry === "capture.webm"),
      () => A.head(videos)
    ),
    O.map((entry) => path.join(videoDir, entry))
  );
});
