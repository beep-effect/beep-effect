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
 * session invoked publish, so local resume detection may select the other live
 * session. Session identity never enters the public footer.
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
import { dual } from "effect/Function";
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
/** Absolute or home-tokenized path retained only for local resume detection. */
const PrProvenancePath = S.String.check(
  S.isPattern(/^(?:\/|~(?:\/|$))/u, {
    identifier: "PrProvenancePath",
    title: "PR provenance path",
    description: "An absolute or '~/'-prefixed filesystem path retained for local resume detection.",
    message: "Expected an absolute path or a home-tokenized path starting with '~/'",
  })
).pipe(
  $I.annoteSchema("PrProvenancePath", {
    description: "Absolute or home-tokenized clone or linked-worktree path retained for local resume detection.",
  })
);

const forbiddenGitBranchCharacter = /[\u0000-\u0020\u007f~^:?*[\\]/u;

/**
 * Git-valid branch name carried by local and public Yeet provenance.
 *
 * **Details**
 *
 * The refinement mirrors `git check-ref-format --branch`: it rejects option-like
 * names, invalid path components, revision syntax, controls, whitespace, and
 * Git's forbidden ref characters while retaining punctuation that is valid in
 * a branch and must instead be escaped by each output context.
 *
 * **Example** (Validate a hostile but valid branch)
 *
 * ```ts
 * import { PrProvenanceBranch } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(PrProvenanceBranch)("feat/escaped`payload-->tail")) // true
 * console.log(S.is(PrProvenanceBranch)("branch with spaces")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PrProvenanceBranch = S.NonEmptyString.check(
  S.makeFilter<string>(
    (branch) =>
      (!Str.startsWith("-")(branch) &&
        branch !== "@" &&
        O.isNone(Str.match(forbiddenGitBranchCharacter)(branch)) &&
        !Str.includes("..")(branch) &&
        !Str.includes("@{")(branch) &&
        !Str.startsWith("/")(branch) &&
        !Str.endsWith("/")(branch) &&
        !Str.endsWith(".")(branch) &&
        A.every(
          Str.split("/")(branch),
          (component) =>
            Str.isNonEmpty(component) && !Str.startsWith(".")(component) && !Str.endsWith(".lock")(component)
        )) || {
        path: [],
        issue: "Expected a valid Git branch name",
      },
    {
      identifier: $I`PrProvenanceBranchCheck`,
      title: "Git-valid provenance branch",
      description: "A non-option Git branch name accepted by git check-ref-format --branch.",
    }
  )
).pipe(
  $I.annoteSchema("PrProvenanceBranch", {
    description: "Git-valid branch name shared by local and public Yeet provenance.",
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
 * Local clone, worktree, branch, and resumable harness identity for Yeet.
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
 * is present only when publish runs from a linked worktree. Rendering projects
 * this local model into {@link PublicPrProvenance}; paths and resumable identity
 * never enter the pull request body.
 *
 * @category models
 * @since 0.0.0
 */
export class PrProvenance extends S.Class<PrProvenance>($I`PrProvenance`)(
  {
    branch: PrProvenanceBranch,
    clonePath: PrProvenancePath,
    harness: PrProvenanceHarness,
    resumeCommand: S.String,
    sessionId: S.OptionFromNullOr(S.String),
    worktreePath: S.OptionFromNullOr(PrProvenancePath),
  },
  $I.annote("PrProvenance", {
    description: "Local origin and paste-ready resume command detected for a Yeet publish invocation.",
  })
) {}

/**
 * Public projection of Yeet provenance safe to append to a pull request.
 *
 * **Details**
 *
 * Local clone paths, linked-worktree paths, resume commands, and AI session
 * identifiers deliberately do not cross this boundary.
 *
 * **Example** (Construct public provenance)
 *
 * ```ts
 * import { PublicPrProvenance } from "@beep/repo-cli/test/Yeet"
 *
 * const provenance = PublicPrProvenance.make({
 *   schemaVersion: 1,
 *   branch: "feat/example",
 *   harness: "codex",
 * })
 * console.log(provenance.branch)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PublicPrProvenance extends S.Class<PublicPrProvenance>($I`PublicPrProvenance`)(
  {
    schemaVersion: S.Literal(1),
    branch: PrProvenanceBranch,
    harness: PrProvenanceHarness,
  },
  $I.annote("PublicPrProvenance", {
    description: "Public, non-resumable provenance appended to a Yeet pull request body.",
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
 * @param path - Filesystem path to normalize for local resume output.
 * @returns The home-tokenized path, or the original path when it is outside home.
 * @category formatting
 * @since 0.0.0
 */
export const tokenizeHomePath: {
  (home: string, path: string): string;
  (path: string): (home: string) => string;
} = dual(2, (home: string, path: string): string => {
  const normalizedHome = Str.replace(/\/+$/u, "")(home);
  if (Str.isEmpty(normalizedHome)) {
    return path;
  }
  if (path === normalizedHome) {
    return "~";
  }
  return Str.startsWith(`${normalizedHome}/`)(path) ? `~/${Str.slice(Str.length(normalizedHome) + 1)(path)}` : path;
});

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
export const resumeCommandFor: {
  (harness: PrProvenanceHarness, directory: string, sessionId: O.Option<string>): string;
  (directory: string, sessionId: O.Option<string>): (harness: PrProvenanceHarness) => string;
} = dual(3, (harness: PrProvenanceHarness, directory: string, sessionId: O.Option<string>): string =>
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
  })
);

const encodePublicPrProvenanceJson = S.encodeUnknownResult(S.fromJsonString(PublicPrProvenance));

const escapeHtmlText = (value: string): string =>
  pipe(
    value,
    Str.replaceAll("&", "&amp;"),
    Str.replaceAll("<", "&lt;"),
    Str.replaceAll(">", "&gt;"),
    Str.replaceAll("`", "&#96;"),
    Str.replaceAll("\r", "&#13;"),
    Str.replaceAll("\n", "&#10;")
  );

const escapeHtmlCommentJson = (value: string): string =>
  pipe(value, Str.replaceAll("&", "\\u0026"), Str.replaceAll("<", "\\u003c"), Str.replaceAll(">", "\\u003e"));

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
  const publicProvenance = PublicPrProvenance.make({
    schemaVersion: 1,
    branch: provenance.branch,
    harness: provenance.harness,
  });
  const encoded = pipe(
    publicProvenance,
    encodePublicPrProvenanceJson,
    Result.getOrThrow,
    renderPrettyCommandJson,
    Str.trimEnd,
    escapeHtmlCommentJson
  );
  const visibleBranch = escapeHtmlText(provenance.branch);
  return `---

## Provenance

- Branch: <code>${visibleBranch}</code>
- Harness: \`${provenance.harness}\`

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
