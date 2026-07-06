/**
 * Repository knowledge-card extraction for research repo-card.
 *
 * Walks the research clone library (theme directories holding git clones,
 * up to two levels deep) and GitHub stars, producing one markdown card per
 * repository.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, FileSystem, Path, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess } from "effect/unstable/process";
import { ResearchCommandError } from "../Research.errors.js";
import type { ChildProcessSpawner } from "effect/unstable/process";

/**
 * Facts gathered about one cloned repository.
 *
 * @internal
 * @category models
 */
export interface ClonedRepoInfo {
  readonly hasLicense: boolean;
  readonly lastCommitIso: O.Option<string>;
  readonly localPath: string;
  readonly readmeExcerpt: O.Option<string>;
  readonly remoteUrl: O.Option<string>;
  readonly slugOwner: string;
  readonly slugRepo: string;
}

/**
 * One starred repository from the GitHub API.
 *
 * @internal
 * @category models
 */
export class StarredRepo extends S.Class<StarredRepo>("StarredRepo")({
  description: S.String.pipe(S.NullOr, S.optionalKey),
  full_name: S.String,
  html_url: S.String,
  language: S.String.pipe(S.NullOr, S.optionalKey),
  topics: S.Array(S.String).pipe(S.optionalKey),
}) {}

const decodeStarredRepos = S.decodeUnknownEffect(S.Array(StarredRepo));

const runForOutput = Effect.fn("RepoCards.runForOutput")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
): Effect.fn.Return<O.Option<string>, never, ChildProcessSpawner.ChildProcessSpawner> {
  const result = yield* Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* ChildProcess.make(command, [...args], { cwd, stderr: "pipe", stdout: "pipe" });
      const output = yield* handle.stdout.pipe(
        Stream.decodeText(),
        Stream.runFold(
          () => "",
          (acc, chunk) => acc + chunk
        )
      );
      const exitCode = yield* handle.exitCode;
      return { exitCode, output: Str.trim(output) };
    })
  ).pipe(Effect.option);
  return result.pipe(
    O.filter((run) => run.exitCode === 0 && Str.isNonEmpty(run.output)),
    O.map((run) => run.output)
  );
});

const CLONE_SEARCH_DEPTH = 3;

/**
 * Find git clone directories beneath the research root, up to three levels
 * deep (themes and theme/repos groupings holding clones). Descent stops at
 * the first `.git` so vendored repos inside clones are not double-counted.
 *
 * @internal
 * @category utilities
 */
export const discoverClones = Effect.fn("RepoCards.discoverClones")(function* (
  researchRoot: string
): Effect.fn.Return<ReadonlyArray<string>, ResearchCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const listDirs = Effect.fn("RepoCards.listDirs")(function* (dir: string) {
    const entries = yield* fs
      .readDirectory(dir)
      .pipe(ResearchCommandError.mapError(`Failed listing research directory "${dir}".`));
    const dirs: Array<string> = [];
    for (const entry of entries) {
      const candidate = path.join(dir, entry);
      const info = yield* fs.stat(candidate).pipe(Effect.option);
      if (O.isSome(info) && info.value.type === "Directory") {
        dirs.push(candidate);
      }
    }
    return dirs;
  });

  const isClone = (dir: string) => fs.exists(path.join(dir, ".git")).pipe(Effect.orElseSucceed(() => false));

  const clones: Array<string> = [];
  const walk: (dir: string, depth: number) => Effect.Effect<void, ResearchCommandError> = Effect.fnUntraced(
    function* (dir, depth) {
      for (const child of yield* listDirs(dir)) {
        if (yield* isClone(child)) {
          clones.push(child);
        } else if (depth < CLONE_SEARCH_DEPTH) {
          yield* walk(child, depth + 1);
        }
      }
    }
  );
  yield* walk(researchRoot, 1);
  return clones;
});

const README_NAMES = ["README.md", "readme.md", "Readme.md", "README.MD"];
const README_MAX_LINES = 80;

const stripBadges = (line: string): string =>
  line
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .trimEnd();

const readmeExcerptOf = Effect.fn("RepoCards.readmeExcerptOf")(function* (
  repoDir: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  for (const name of README_NAMES) {
    const content = yield* fs.readFileString(path.join(repoDir, name)).pipe(Effect.option);
    if (O.isSome(content)) {
      const lines = Str.split(content.value, "\n");
      const excerpt = A.map(A.take(lines, README_MAX_LINES), stripBadges);
      return O.some(Str.trim(A.join(excerpt, "\n")));
    }
  }
  return O.none();
});

/**
 * Normalize a git remote to a browsable https URL.
 *
 * @internal
 * @param remote - Git remote URL in SSH or HTTPS form.
 * @returns Browsable HTTPS URL, with a trailing `.git` suffix removed.
 * @category utilities
 */
export const remoteToHttpsUrl = (remote: string): string => {
  const sshMatch = remote.match(/^git@([^:]+):(.+?)(\.git)?$/);
  if (!P.isNull(sshMatch)) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }
  return remote.replace(/\.git$/, "");
};

/**
 * Derive owner/repo slug parts from a remote URL or local dirname.
 *
 * @internal
 * @param remoteUrl - Optional git remote URL to parse first.
 * @param localDirname - Local directory name used as the fallback repo slug.
 * @returns Owner and repository slug parts.
 * @category utilities
 */
export const slugPartsOf = (remoteUrl: O.Option<string>, localDirname: string): readonly [string, string] =>
  remoteUrl.pipe(
    O.flatMap((url) => {
      const match = remoteToHttpsUrl(url).match(/^https?:\/\/[^/]+\/([^/]+)\/([^/?#]+)/);
      return P.isNull(match) ? O.none() : O.some([match[1] ?? "unknown", match[2] ?? localDirname] as const);
    }),
    O.getOrElse(() => ["local", localDirname] as const)
  );

/**
 * Gather remote, README, license, and last-commit facts for one clone.
 *
 * @internal
 * @category utilities
 */
export const inspectClone = Effect.fn("RepoCards.inspectClone")(function* (
  repoDir: string
): Effect.fn.Return<
  ClonedRepoInfo,
  ResearchCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const remoteUrl = (yield* runForOutput("git", ["remote", "get-url", "origin"], repoDir)).pipe(
    O.map(remoteToHttpsUrl)
  );
  const lastCommitIso = yield* runForOutput("git", ["log", "-1", "--format=%cI"], repoDir);
  const readmeExcerpt = yield* readmeExcerptOf(repoDir);
  let hasLicense = false;
  for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]) {
    if (yield* fs.exists(path.join(repoDir, name)).pipe(Effect.orElseSucceed(() => false))) {
      hasLicense = true;
      break;
    }
  }
  const [slugOwner, slugRepo] = slugPartsOf(remoteUrl, path.basename(repoDir));
  return { hasLicense, lastCommitIso, localPath: repoDir, readmeExcerpt, remoteUrl, slugOwner, slugRepo };
});

/**
 * List the authenticated user's starred repositories via the `gh` CLI.
 *
 * @internal
 * @category utilities
 */
export const listStarredRepos = Effect.fn("RepoCards.listStarredRepos")(function* (
  cwd: string
): Effect.fn.Return<ReadonlyArray<StarredRepo>, ResearchCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* runForOutput(
    "gh",
    ["api", "user/starred", "--paginate", "--jq", ".[] | {full_name, html_url, description, language, topics}"],
    cwd
  );
  if (O.isNone(output)) {
    return yield* ResearchCommandError.make({
      message: "Failed listing GitHub stars via `gh api user/starred`; is gh installed and authenticated?",
    });
  }
  const parsed = yield* Effect.try({
    catch: (cause) => ResearchCommandError.new(cause, "GitHub stars output was not valid JSON lines."),
    try: () =>
      Str.split(output.value, "\n")
        .filter(Str.isNonEmpty)
        .map((line) => JSON.parse(line) as unknown),
  });
  return yield* decodeStarredRepos(parsed).pipe(
    ResearchCommandError.mapError("GitHub stars failed schema validation.")
  );
});
