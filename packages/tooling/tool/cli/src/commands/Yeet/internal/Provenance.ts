/**
 * Pull request provenance detection and Markdown rendering for Yeet publish.
 *
 * **Gotchas**
 *
 * Claude transcript discovery is deliberately bounded to the current checkout
 * and its main clone. Sessions launched from a third directory are left to the
 * interactive `claude --resume` picker.
 *
 * When multiple Claude sessions share one checkout, the newest recent
 * transcript wins. Modification time cannot honestly identify which concurrent
 * session invoked publish, so the footer may select the other live session.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { repoPathToClaudeProjectName, shellQuote } from "@beep/repo-ai-metrics";
import { LiteralKit } from "@beep/schema";
import {
  Clock,
  Config,
  ConfigProvider,
  Context,
  Duration,
  Effect,
  FileSystem,
  Order,
  Path,
  pipe,
  Result,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { renderPrettyCommandJson } from "../../../internal/cli/Json.ts";
import { runGitOutput } from "./GitExec.ts";
import type { PlatformError } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Yeet/internal/Provenance");
const recentClaudeSessionWindow = Duration.hours(6);
const futureClaudeSessionSkew = Duration.minutes(1);
const provenanceDetectionTimeout = Duration.seconds(2);
/** Absolute or home-tokenized path safe to record in public PR provenance. */
const PrProvenancePath = S.String.check(
  S.isPattern(/^(?:\/|~(?:\/|$))/u, {
    identifier: "PrProvenancePath",
    title: "PR provenance path",
    description: "An absolute or '~/'-prefixed filesystem path recorded in pull request provenance.",
    message: "Expected an absolute path or a home-tokenized path starting with '~/'",
  })
).pipe(
  $I.annoteSchema("PrProvenancePath", {
    description: "Absolute or home-tokenized clone or linked-worktree path recorded in pull request provenance.",
  })
);

/**
 * Harness that originated a Yeet publish invocation.
 *
 * **Example** (Inspect supported harnesses)
 *
 * ```ts
 * import { PrProvenanceHarness } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PrProvenanceHarness.Options)
 * ```
 *
 * **Details**
 *
 * Unknown is the safe fallback when bounded detection cannot identify a live
 * Claude Code or Codex session.
 *
 * @category models
 * @since 0.0.0
 */
export const PrProvenanceHarness = LiteralKit(["claude-code", "codex", "unknown"]).pipe(
  $I.annoteSchema("PrProvenanceHarness", {
    description: "Harness that originated a Yeet pull request publish invocation.",
  })
);

/**
 * Runtime type for {@link PrProvenanceHarness}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type PrProvenanceHarness = typeof PrProvenanceHarness.Type;

/**
 * Clone, worktree, branch, and resumable harness identity for a Yeet PR.
 *
 * **Example** (Construct Codex provenance)
 *
 * ```ts
 * import { PrProvenance } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const provenance = PrProvenance.make({
 *   branch: "feat/example",
 *   clonePath: "~/beep-effect",
 *   harness: "codex",
 *   resumeCommand: "cd ~/'beep-effect' &&\n  codex resume --last",
 *   sessionId: O.none(),
 *   worktreePath: O.none(),
 * })
 * console.log(provenance.harness)
 * ```
 *
 * **Details**
 *
 * `clonePath` is the absolute or home-tokenized main clone path. `worktreePath`
 * is present only when publish runs from a linked worktree.
 *
 * @category models
 * @since 0.0.0
 */
export class PrProvenance extends S.Class<PrProvenance>($I`PrProvenance`)(
  {
    branch: S.String,
    clonePath: PrProvenancePath,
    harness: PrProvenanceHarness,
    resumeCommand: S.String,
    sessionId: S.OptionFromNullOr(S.String),
    worktreePath: S.OptionFromNullOr(PrProvenancePath),
  },
  $I.annote("PrProvenance", {
    description: "Origin and paste-ready resume command recorded in a Yeet pull request body.",
  })
) {}

/**
 * Convert an absolute launch path to Claude Code's project-directory key.
 *
 * **Example** (Munge a launch path)
 *
 * ```ts
 * import { mungeClaudeProjectPath } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(mungeClaudeProjectPath("/home/user/beep.effect"))
 * // -home-user-beep.effect
 * ```
 *
 * @param launchPath - Absolute path the harness session was launched from.
 * @returns The munged directory name under `~/.claude/projects`.
 * @category utilities
 * @since 0.0.0
 */
export const mungeClaudeProjectPath = repoPathToClaudeProjectName;

/**
 * Replace a path's leading home-directory segment with `~`.
 *
 * **Example** (Tokenize a checkout path)
 *
 * ```ts
 * import { tokenizeHomePath } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(tokenizeHomePath("/home/user", "/home/user/src/repo"))
 * // ~/src/repo
 * ```
 *
 * @param home - Absolute home directory supplied by the runtime configuration.
 * @param path - Filesystem path to make safe for public provenance.
 * @returns The home-tokenized path, or the original path when it is outside home.
 * @category formatting
 * @since 0.0.0
 */
export const tokenizeHomePath = (home: string, path: string): string => {
  const normalizedHome = Str.replace(/\/+$/u, "")(home);
  if (Str.isEmpty(normalizedHome)) {
    return path;
  }
  if (path === normalizedHome) {
    return "~";
  }
  return Str.startsWith(`${normalizedHome}/`)(path) ? `~/${Str.slice(Str.length(normalizedHome) + 1)(path)}` : path;
};

const tokenizeConfiguredHomePath = (home: O.Option<string>, path: string): string =>
  pipe(
    home,
    O.map((homePath) => tokenizeHomePath(homePath, path)),
    O.getOrElse(() => path)
  );

const sessionOrder = Order.mapInput(
  Order.Number,
  (candidate: readonly [launchPath: string, sessionId: string, modifiedAtMillis: number]) => -candidate[2]
);

/**
 * Find the newest recent Claude Code transcript across launch-path candidates.
 *
 * **Example** (Search fixture project directories)
 *
 * ```ts
 * import { findRecentClaudeSession } from "@beep/repo-cli/test/Yeet"
 *
 * const session = findRecentClaudeSession("/tmp/projects", ["/tmp/repo"], 0)
 * console.log(session.pipe !== undefined)
 * ```
 *
 * @param projectsRoot - Fixture-safe root containing Claude project folders.
 * @param launchPaths - Absolute checkout and clone paths to inspect.
 * @param nowMillis - Current epoch milliseconds used for the six-hour bound.
 * @returns The launch path and session id of the newest recent transcript.
 * @category detection
 * @since 0.0.0
 */
export const findRecentClaudeSession = Effect.fn("PrProvenance.findRecentClaudeSession")(function* (
  projectsRoot: string,
  launchPaths: ReadonlyArray<string>,
  nowMillis: number
): Effect.fn.Return<
  O.Option<readonly [launchPath: string, sessionId: string]>,
  PlatformError.PlatformError,
  FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidates = yield* pipe(
    launchPaths,
    A.dedupe,
    Effect.forEach(
      Effect.fnUntraced(function* (launchPath) {
        const directory = path.join(projectsRoot, mungeClaudeProjectPath(launchPath));
        const exists = yield* fs.exists(directory);
        if (!exists) {
          return A.empty<readonly [string, string, number]>();
        }
        const names = yield* fs.readDirectory(directory);
        return yield* pipe(
          names,
          A.filter(Str.endsWith(".jsonl")),
          Effect.forEach(
            Effect.fnUntraced(function* (name) {
              const info = yield* fs.stat(path.join(directory, name));
              return pipe(
                info.mtime,
                O.map((mtime) => [launchPath, path.basename(name, ".jsonl"), mtime.getTime()] as const)
              );
            }),
            { concurrency: 8 }
          ),
          Effect.map(A.getSomes)
        );
      }),
      { concurrency: 2 }
    ),
    Effect.map(A.flatten)
  );
  return pipe(
    candidates,
    A.filter(
      (candidate) =>
        candidate[2] >= nowMillis - Duration.toMillis(recentClaudeSessionWindow) &&
        candidate[2] <= nowMillis + Duration.toMillis(futureClaudeSessionSkew)
    ),
    A.sort(sessionOrder),
    A.head,
    O.map(([launchPath, sessionId]) => [launchPath, sessionId] as const)
  );
});

const shellQuoteDirectory = (directory: string): string => {
  if (directory === "~") {
    return directory;
  }
  return Str.startsWith("~/")(directory) ? `~/${shellQuote(Str.slice(2)(directory))}` : shellQuote(directory);
};

/**
 * Build the paste-ready command for a detected harness.
 *
 * **Example** (Build a Codex resume command)
 *
 * ```ts
 * import { resumeCommandFor } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(resumeCommandFor("codex", "/repo", O.none()))
 * ```
 *
 * @param harness - Detected harness the publish ran under.
 * @param directory - Directory the resume command must start from.
 * @param sessionId - Session identifier when the harness exposes one.
 * @returns A paste-ready shell command resuming the originating session.
 * @category formatting
 * @since 0.0.0
 */
export const resumeCommandFor = (
  harness: PrProvenanceHarness,
  directory: string,
  sessionId: O.Option<string>
): string =>
  PrProvenanceHarness.$match(harness, {
    "claude-code": () =>
      O.match(sessionId, {
        onNone: () => `cd ${shellQuoteDirectory(directory)} &&\n  claude --resume`,
        onSome: (id) => `cd ${shellQuoteDirectory(directory)} &&\n  claude --resume ${shellQuote(id)}`,
      }),
    codex: () =>
      `cd ${shellQuoteDirectory(directory)} &&\n  ${pipe(
        sessionId,
        O.map((id) => `codex resume ${shellQuote(id)}`),
        O.getOrElse(() => "codex resume --last")
      )}`,
    unknown: () => `cd ${shellQuoteDirectory(directory)} &&\n  claude --resume`,
  });

const encodePrProvenanceJson = S.encodeUnknownResult(S.fromJsonString(PrProvenance));

/**
 * Render provenance as the trailing Markdown section of a pull request body.
 *
 * **Example** (Render a generic footer)
 *
 * ```ts
 * import { PrProvenance, renderPrProvenance } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const footer = renderPrProvenance(PrProvenance.make({
 *   branch: "feat/example",
 *   clonePath: "/repo",
 *   harness: "unknown",
 *   resumeCommand: "cd '/repo' &&\n  claude --resume",
 *   sessionId: O.none(),
 *   worktreePath: O.none(),
 * }))
 * console.log(footer)
 * ```
 *
 * @param provenance - Detected origin facts for the publishing session.
 * @returns The Markdown footer section appended to the pull request body.
 * @category formatting
 * @since 0.0.0
 */
export const renderPrProvenance = (provenance: PrProvenance): string => {
  const worktreeLine = pipe(
    provenance.worktreePath,
    O.map((worktreePath) => `- Worktree: \`${worktreePath}\`\n`),
    O.getOrElse(() => "")
  );
  const encoded = pipe(provenance, encodePrProvenanceJson, Result.getOrThrow, renderPrettyCommandJson, Str.trimEnd);
  return `---

## Provenance

- Clone: \`${provenance.clonePath}\`
${worktreeLine}- Branch: \`${provenance.branch}\`
- Harness: \`${provenance.harness}\`

Resume this session:

\`\`\`sh
${provenance.resumeCommand}
\`\`\`

<!-- yeet-provenance
${encoded}
-->
`;
};

/**
 * Contract for bounded PR provenance detection.
 *
 * @category services
 * @since 0.0.0
 */
export interface PrProvenanceServiceShape {
  readonly detect: (cwd: string, branch: string) => Effect.Effect<PrProvenance>;
}

/**
 * Service tag for bounded PR provenance detection.
 *
 * **Example** (Access the detector)
 *
 * ```ts
 * import { PrProvenanceService } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(PrProvenanceService, (service) => service.detect("/repo", "feat/example"))
 * console.log(program.pipe !== undefined)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PrProvenanceService extends Context.Service<PrProvenanceService, PrProvenanceServiceShape>()(
  $I`PrProvenanceService`
) {}

type PrProvenanceRequirements = FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner;

const makeUnknownProvenance = (
  home: O.Option<string>,
  clonePath: string,
  checkoutPath: string,
  worktreePath: O.Option<string>,
  branch: string
): PrProvenance =>
  PrProvenance.make({
    branch,
    clonePath: tokenizeConfiguredHomePath(home, clonePath),
    harness: "unknown",
    resumeCommand: resumeCommandFor("unknown", tokenizeConfiguredHomePath(home, checkoutPath), O.none()),
    sessionId: O.none(),
    worktreePath: O.map(worktreePath, (value) => tokenizeConfiguredHomePath(home, value)),
  });

/**
 * Detect Codex markers and read its exact resumable thread id.
 *
 * **Example** (Inspect the active environment provider)
 *
 * ```ts
 * import { detectCodexEnvironment } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(detectCodexEnvironment.pipe !== undefined)
 * ```
 *
 * @returns Whether any `CODEX_` marker exists and the exact thread id when set.
 * @category detection
 * @since 0.0.0
 */
export const detectCodexEnvironment = Effect.fn("PrProvenance.detectCodexEnvironment")(function* () {
  const provider = yield* ConfigProvider.ConfigProvider;
  const codexNode = yield* provider.load(["CODEX"]);
  const threadId = yield* Config.option(Config.string("CODEX_THREAD_ID"));
  return [O.isSome(threadId) || P.isTagged("Record")(codexNode), threadId] as const;
});

const detectGitPaths = Effect.fn("PrProvenance.detectGitPaths")(function* (cwd: string) {
  const path = yield* Path.Path;
  const [commonDirectoryOutput, checkoutOutput] = yield* Effect.all(
    [runGitOutput(cwd, ["rev-parse", "--git-common-dir"]), runGitOutput(cwd, ["rev-parse", "--show-toplevel"])],
    { concurrency: 2 }
  );
  const checkoutPath = path.resolve(Str.trim(checkoutOutput));
  const clonePath = path.dirname(path.resolve(checkoutPath, Str.trim(commonDirectoryOutput)));
  const worktreePath = checkoutPath === clonePath ? O.none<string>() : O.some(checkoutPath);
  return [clonePath, checkoutPath, worktreePath] as const;
});

/**
 * Detect harness provenance after Git has resolved clone and checkout paths.
 *
 * **Example** (Build a bounded harness detector)
 *
 * ```ts
 * import { detectPrProvenanceFromPaths } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const detection = detectPrProvenanceFromPaths("/repo", "/repo", O.none(), "feat/example")
 * console.log(detection.pipe !== undefined)
 * ```
 *
 * @param clonePath - Absolute main clone path resolved by Git.
 * @param checkoutPath - Absolute current checkout or linked-worktree path.
 * @param worktreePath - Current checkout when it differs from the main clone.
 * @param branch - Branch being published.
 * @returns Detected harness provenance with Git identity preserved.
 * @category detection
 * @since 0.0.0
 */
export const detectPrProvenanceFromPaths = Effect.fn("PrProvenance.detectFromPaths")(function* (
  clonePath: string,
  checkoutPath: string,
  worktreePath: O.Option<string>,
  branch: string
) {
  const path = yield* Path.Path;
  const home = yield* Config.option(Config.string("HOME")).pipe(Effect.orElseSucceed(O.none<string>));
  const publicPath = (value: string): string => tokenizeConfiguredHomePath(home, value);
  const publicClonePath = publicPath(clonePath);
  const publicWorktreePath = O.map(worktreePath, publicPath);
  const [isCodex, codexThreadId] = yield* detectCodexEnvironment();
  if (isCodex) {
    return PrProvenance.make({
      branch,
      clonePath: publicClonePath,
      harness: "codex",
      resumeCommand: resumeCommandFor("codex", publicPath(checkoutPath), codexThreadId),
      sessionId: codexThreadId,
      worktreePath: publicWorktreePath,
    });
  }

  const nowMillis = yield* Clock.currentTimeMillis;
  const claudeSession = yield* pipe(
    home,
    O.map((value) =>
      findRecentClaudeSession(path.join(value, ".claude", "projects"), [checkoutPath, clonePath], nowMillis)
    ),
    O.getOrElse(() => Effect.succeed(O.none<readonly [string, string]>()))
  );

  if (O.isSome(claudeSession)) {
    const [launchPath, sessionId] = claudeSession.value;
    return PrProvenance.make({
      branch,
      clonePath: publicClonePath,
      harness: "claude-code",
      resumeCommand: resumeCommandFor("claude-code", publicPath(launchPath), O.some(sessionId)),
      sessionId: O.some(sessionId),
      worktreePath: publicWorktreePath,
    });
  }

  return PrProvenance.make({
    branch,
    clonePath: publicClonePath,
    harness: "unknown",
    resumeCommand: resumeCommandFor("unknown", publicPath(checkoutPath), O.none()),
    sessionId: O.none(),
    worktreePath: publicWorktreePath,
  });
});

const makePrProvenanceService = Effect.fn("PrProvenanceService.make")(function* () {
  const path = yield* Path.Path;
  const runtimeContext = yield* Effect.context<PrProvenanceRequirements>();
  const home = yield* Config.option(Config.string("HOME")).pipe(Effect.orElseSucceed(O.none<string>));
  return PrProvenanceService.of({
    detect: Effect.fn("PrProvenanceService.detect")((cwd, branch) => {
      const checkoutFallback = path.resolve(cwd);
      const gitFallback = makeUnknownProvenance(home, checkoutFallback, checkoutFallback, O.none(), branch);
      return detectGitPaths(cwd).pipe(
        Effect.provide(runtimeContext),
        Effect.matchCauseEffect({
          onFailure: () => Effect.succeed(gitFallback),
          onSuccess: ([clonePath, checkoutPath, worktreePath]) => {
            const fallback = makeUnknownProvenance(home, clonePath, checkoutPath, worktreePath, branch);
            return detectPrProvenanceFromPaths(clonePath, checkoutPath, worktreePath, branch).pipe(
              Effect.provide(runtimeContext),
              Effect.catchCause(() => Effect.succeed(fallback)),
              Effect.timeoutOrElse({
                duration: provenanceDetectionTimeout,
                orElse: () => Effect.succeed(fallback),
              })
            );
          },
        })
      );
    }),
  });
});

/**
 * Construct the live bounded detector used by Yeet publish.
 *
 * **Example** (Reference the live layer)
 *
 * ```ts
 * import { makePrProvenanceServiceLive } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(makePrProvenanceServiceLive.pipe !== undefined)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makePrProvenanceServiceLive = makePrProvenanceService;
