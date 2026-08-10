/**
 * Pull request provenance detection and Markdown rendering for Yeet publish.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { shellQuote } from "@beep/repo-ai-metrics";
import { LiteralKit } from "@beep/schema";
import { Clock, Config, ConfigProvider, Context, Duration, Effect, FileSystem, Order, Path, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runGitOutput } from "./GitExec.ts";
import type { PlatformError } from "effect";
import type { ChildProcessSpawner } from "effect/unstable/process";

const $I = $RepoCliId.create("commands/Yeet/internal/Provenance");
const recentClaudeSessionWindow = Duration.hours(6);
const provenanceDetectionTimeout = Duration.seconds(2);
const PrProvenanceAbsolutePath = S.String.check(
  S.isPattern(/^\//u, {
    identifier: "PrProvenanceAbsolutePath",
    title: "PR provenance absolute path",
    description: "An absolute filesystem path recorded in pull request provenance.",
    message: "Expected an absolute path starting with '/'",
  })
).pipe(
  $I.annoteSchema("PrProvenanceAbsolutePath", {
    description: "Absolute clone or linked-worktree path recorded in pull request provenance.",
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
 *   clonePath: "/home/user/beep-effect",
 *   harness: "codex",
 *   resumeCommand: "cd '/home/user/beep-effect' && codex resume --last",
 *   sessionId: O.none(),
 *   worktreePath: O.none(),
 * })
 * console.log(provenance.harness)
 * ```
 *
 * **Details**
 *
 * `clonePath` is the absolute main clone path. `worktreePath` is present only
 * when publish runs from a linked worktree.
 *
 * @category models
 * @since 0.0.0
 */
export class PrProvenance extends S.Class<PrProvenance>($I`PrProvenance`)(
  {
    branch: S.String,
    clonePath: PrProvenanceAbsolutePath,
    harness: PrProvenanceHarness,
    resumeCommand: S.String,
    sessionId: S.Option(S.String),
    worktreePath: S.Option(PrProvenanceAbsolutePath),
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
 * // -home-user-beep-effect
 * ```
 *
 * @param launchPath - Absolute path the harness session was launched from.
 * @returns The munged directory name under `~/.claude/projects`.
 * @category utilities
 * @since 0.0.0
 */
export const mungeClaudeProjectPath = (launchPath: string): string => Str.replace(/[/.]/gu, "-")(launchPath);

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
 * @category discovery
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
    A.filter((candidate) => nowMillis - candidate[2] <= Duration.toMillis(recentClaudeSessionWindow)),
    A.sort(sessionOrder),
    A.head,
    O.map(([launchPath, sessionId]) => [launchPath, sessionId] as const)
  );
});

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
        onNone: () => `cd ${shellQuote(directory)} && claude --resume`,
        onSome: (id) => `cd ${shellQuote(directory)} && claude --resume ${shellQuote(id)}`,
      }),
    codex: () => `cd ${shellQuote(directory)} && codex resume --last`,
    unknown: () => `cd ${shellQuote(directory)} && claude --resume`,
  });

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
 *   resumeCommand: "cd '/repo' && claude --resume",
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
  const command = Str.replace(" && ", " &&\n  ")(provenance.resumeCommand);
  return `---

## Provenance

- Clone: \`${provenance.clonePath}\`
${worktreeLine}- Branch: \`${provenance.branch}\`
- Harness: \`${provenance.harness}\`

Resume this session:

\`\`\`sh
${command}
\`\`\`
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

const makeUnknownProvenance = (clonePath: string, branch: string): PrProvenance =>
  PrProvenance.make({
    branch,
    clonePath,
    harness: "unknown",
    resumeCommand: resumeCommandFor("unknown", clonePath, O.none()),
    sessionId: O.none(),
    worktreePath: O.none(),
  });

const hasCodexEnvironment = Effect.fn("PrProvenance.hasCodexEnvironment")(function* () {
  const provider = yield* ConfigProvider.ConfigProvider;
  const root = yield* provider.load([]);
  if (root === undefined || !P.isTagged("Record")(root)) {
    return false;
  }
  return pipe(root.keys, A.fromIterable, A.some(Str.startsWith("CODEX_")));
});

const detectPrProvenanceImpl = Effect.fn("PrProvenance.detectImpl")(function* (cwd: string, branch: string) {
  const path = yield* Path.Path;
  const [commonDirectoryOutput, checkoutOutput] = yield* Effect.all(
    [runGitOutput(cwd, ["rev-parse", "--git-common-dir"]), runGitOutput(cwd, ["rev-parse", "--show-toplevel"])],
    { concurrency: 2 }
  );
  const checkoutPath = path.resolve(Str.trim(checkoutOutput));
  const clonePath = path.dirname(path.resolve(checkoutPath, Str.trim(commonDirectoryOutput)));
  const worktreePath = checkoutPath === clonePath ? O.none<string>() : O.some(checkoutPath);
  const home = yield* Config.option(Config.string("HOME"));
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
      clonePath,
      harness: "claude-code",
      resumeCommand: resumeCommandFor("claude-code", launchPath, O.some(sessionId)),
      sessionId: O.some(sessionId),
      worktreePath,
    });
  }

  const isCodex = yield* hasCodexEnvironment();
  const harness = isCodex ? "codex" : "unknown";
  return PrProvenance.make({
    branch,
    clonePath,
    harness,
    resumeCommand: resumeCommandFor(harness, clonePath, O.none()),
    sessionId: O.none(),
    worktreePath,
  });
});

const makePrProvenanceService = Effect.fn("PrProvenanceService.make")(function* () {
  const path = yield* Path.Path;
  const runtimeContext = yield* Effect.context<PrProvenanceRequirements>();
  return PrProvenanceService.of({
    detect: Effect.fn("PrProvenanceService.detect")((cwd, branch) => {
      const fallback = makeUnknownProvenance(path.resolve(cwd), branch);
      return detectPrProvenanceImpl(cwd, branch).pipe(
        Effect.provide(runtimeContext),
        Effect.catchCause(() => Effect.succeed(fallback)),
        Effect.timeoutOrElse({
          duration: provenanceDetectionTimeout,
          orElse: () => Effect.succeed(fallback),
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
