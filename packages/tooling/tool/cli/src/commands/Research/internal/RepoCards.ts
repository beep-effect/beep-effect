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

import { Git } from "@beep/git/Git";
import { GitHubClient } from "@beep/github/GitHubClient";
import { $RepoCliId } from "@beep/identity/packages";
import { runCaptured } from "@beep/repo-cli-kit/process/StepExec";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubClientRequest, GithubIdentity, layerGithubClientFor } from "../../../internal/github/GithubIdentity.ts";
import { ResearchCommandError } from "../Research.errors.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

const $I = $RepoCliId.create("commands/Research/internal/RepoCards");

/**
 * Facts gathered about one cloned repository.
 *
 * @internal
 * @category models
 */
export class ClonedRepoInfo extends S.Opaque<ClonedRepoInfo, { readonly brand: unique symbol }>()(
  S.Struct({
    hasLicense: S.Boolean,
    lastCommitIso: S.OptionFromOptionalKey(S.String),
    localPath: S.String,
    readmeExcerpt: S.OptionFromOptionalKey(S.String),
    remoteUrl: S.OptionFromOptionalKey(S.String),
    slugOwner: S.String,
    slugRepo: S.String,
  }).pipe(
    $I.annoteSchema("ClonedRepoInfo", {
      title: "Cloned Repo Info",
      description: "Facts gathered about one cloned repository before rendering a research repo card.",
    })
  )
) {}

/**
 * One starred repository from the GitHub API.
 *
 * @internal
 * @category models
 */
export class StarredRepo extends S.Opaque<StarredRepo, { readonly brand: unique symbol }>()(
  S.Struct({
    description: S.String.pipe(S.NullOr, S.optionalKey),
    full_name: S.String,
    html_url: S.String,
    language: S.String.pipe(S.NullOr, S.optionalKey),
    topics: S.Array(S.String).pipe(S.optionalKey),
  }).pipe(
    $I.annoteSchema("StarredRepo", {
      title: "Starred Repo",
      description: "One starred repository row returned by the GitHub API.",
    })
  )
) {}

const decodeStarredRepos = S.decodeUnknownEffect(S.Array(StarredRepo));

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
  pipe(
    line,
    Str.replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, ""),
    Str.replace(/!\[[^\]]*\]\([^)]*\)/g, ""),
    Str.trimEnd
  );

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
const remoteToHttpsUrl = (remote: string): string => {
  const sshMatch = O.getOrNull(Str.match(/^git@([^:]+):(.+?)(\.git)?$/)(remote));
  if (!P.isNull(sshMatch)) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }
  return Str.replace(/\.git$/, "")(remote);
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
export const slugPartsOf: {
  (localDirname: string): (remoteUrl: O.Option<string>) => readonly [string, string];
  (remoteUrl: O.Option<string>, localDirname: string): readonly [string, string];
} = dual(2, (remoteUrl: O.Option<string>, localDirname: string): readonly [string, string] =>
  remoteUrl.pipe(
    O.flatMap((url) => {
      const match = O.getOrNull(Str.match(/^https?:\/\/[^/]+\/([^/]+)\/([^/?#]+)/)(remoteToHttpsUrl(url)));
      return P.isNull(match) ? O.none() : O.some([match[1] ?? "unknown", match[2] ?? localDirname] as const);
    }),
    O.getOrElse(() => ["local", localDirname] as const)
  )
);

/**
 * Gather remote, README, license, and last-commit facts for one clone.
 *
 * **Details**
 * Git read failures leave their facts absent. Commit timestamps use UTC ISO format.
 *
 * **Example** (Inspect a local research clone)
 *
 * ```ts
 * import { inspectClone } from "@beep/repo-cli/test/Research"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(inspectClone(".")))
 * ```
 *
 * @internal
 * @since 0.0.0
 * @category utilities
 */
export const inspectClone = Effect.fn("RepoCards.inspectClone")(function* (
  repoDir: string
): Effect.fn.Return<
  ClonedRepoInfo,
  ResearchCommandError,
  FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const remoteUrl = yield* Git.use((git) => git.remoteUrl(repoDir)).pipe(
    Effect.provideServiceEffect(Git, Git.make),
    Effect.orElseSucceed(O.none<string>),
    Effect.map(O.map(remoteToHttpsUrl))
  );
  const lastCommitIso = yield* Git.use((git) => git.log(repoDir, { limit: 1 })).pipe(
    Effect.provideServiceEffect(Git, Git.make),
    Effect.map((rows) => O.map(A.head(rows), (entry) => DateTime.formatIso(entry.committedAt))),
    Effect.orElseSucceed(O.none<string>)
  );
  const readmeExcerpt = yield* readmeExcerptOf(repoDir);
  let hasLicense = false;
  for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "COPYING"]) {
    if (yield* fs.exists(path.join(repoDir, name)).pipe(Effect.orElseSucceed(() => false))) {
      hasLicense = true;
      break;
    }
  }
  const [slugOwner, slugRepo] = slugPartsOf(remoteUrl, path.basename(repoDir));
  return ClonedRepoInfo.make({
    hasLicense,
    lastCommitIso,
    localPath: repoDir,
    readmeExcerpt,
    remoteUrl,
    slugOwner,
    slugRepo,
  });
});

/**
 * List every page of the authenticated gh user's starred repositories over REST.
 *
 * **Example** (Read the current login's stars)
 *
 * ```ts
 * import { listStarredRepos } from "@beep/repo-cli/test/Research"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(listStarredRepos(".")))
 * ```
 *
 * @internal
 * @since 0.0.0
 * @category utilities
 */
export const listStarredRepos = Effect.fn("RepoCards.listStarredRepos")(function* (
  cwd: string
): Effect.fn.Return<
  ReadonlyArray<StarredRepo>,
  ResearchCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> {
  const identity = GithubIdentity.make({
    kind: "gh-cli",
    tokenRef: O.none(),
    appId: O.none(),
    installationId: O.none(),
    privateKeyRef: O.none(),
  });
  const rows = yield* Effect.flatMap(
    Layer.build(layerGithubClientFor(GithubClientRequest.make({ identity, cwd }), { retry: "off" })),
    (services) =>
      Effect.provideContext(
        GitHubClient.use((client) => client.paginate("GET /user/starred", { per_page: 100 })),
        services
      )
  ).pipe(
    Effect.scoped,
    ResearchCommandError.mapError(
      "Failed listing GitHub stars via `gh api user/starred`; is gh installed and authenticated?"
    )
  );
  return yield* decodeStarredRepos(rows).pipe(ResearchCommandError.mapError("GitHub stars failed schema validation."));
});
