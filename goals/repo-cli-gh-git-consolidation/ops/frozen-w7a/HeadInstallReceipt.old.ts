/**
 * Frozen pre-W7 bodies for `ops/yeet-differential-w7.ts`: the install-input reader (`collectHeadInstallInputs`) of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/HeadInstallReceipt.ts`, verbatim from the lane base 8602b24203 except for import paths, the
 * `old` name prefix, and the retiring Yeet `runGitOutput`/`runGitPathList` wrappers, which resolve to the inlined
 * copies in `GitRunners.old.ts`.
 */

import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { runGitFoldedStdout } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/GitExec.ts";
import { HeadInstallInputs } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/HeadInstallReceipt.ts";
import { oldRunGitOutput } from "./GitRunners.old.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import type { RunFoldedStdoutOptions } from "../../../../packages/tooling/tool/cli/src/internal/process/StepExec.ts";

const ABSENT_LOCKFILE = "absent";
const LOCKFILE_PATH = "bun.lock";
const ROOT_INSTALL_CONFIG_PATHS = ["bunfig.toml", ".npmrc"] as const;
const textEncoder = new TextEncoder();

export const isRootInstallConfigPath = (path: string): boolean => A.contains(ROOT_INSTALL_CONFIG_PATHS, path);

export const isManifestPath = (path: string): boolean => path === "package.json" || Str.endsWith("/package.json")(path);

export const isInstallInputPath = (path: string): boolean =>
  path === LOCKFILE_PATH || isRootInstallConfigPath(path) || isManifestPath(path) || Str.startsWith("patches/")(path);

export const installInputLine = (line: string): Result.Result<string, string> => {
  const [meta, path] = Str.split("\t")(line);
  return pipe(
    O.all({ meta: O.fromUndefinedOr(meta), inputPath: O.filter(O.fromUndefinedOr(path), isInstallInputPath) }),
    O.flatMap(({ meta, inputPath }) => O.map(A.get(Str.split(" ")(meta), 2), (blob) => `${inputPath}\0${blob}`)),
    Result.fromOption(() => line)
  );
};

export const foldInstallInputs: RunFoldedStdoutOptions["fold"] = (stdout) =>
  stdout.pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.filterMap(installInputLine),
    Stream.map((entry) => `${entry}\n`),
    Stream.mkString
  );

export const oldCollectHeadInstallInputs = Effect.fn("Yeet.oldCollectHeadInstallInputs")(function* (
  repoRoot: string,
  commitSha: string
): Effect.fn.Return<
  HeadInstallInputs,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Digest.Digest
> {
  const treeSha = yield* oldRunGitOutput(repoRoot, ["rev-parse", `${commitSha}^{tree}`]);
  const entries = pipe(
    yield* runGitFoldedStdout(repoRoot, ["ls-tree", "-r", "--full-tree", commitSha], foldInstallInputs),
    Str.split("\n"),
    A.filter(Str.isNonEmpty)
  );
  const lockfileDigest = pipe(
    A.findFirst(entries, Str.startsWith(`${LOCKFILE_PATH}\0`)),
    O.map(Str.slice(LOCKFILE_PATH.length + 1)),
    O.getOrElse(() => ABSENT_LOCKFILE)
  );
  return HeadInstallInputs.make({
    commitSha,
    treeSha,
    lockfileDigest,
    manifestsDigest: yield* (yield* Digest.Digest).digestHex(
      Digest.sha256,
      textEncoder.encode(
        A.join(
          A.filter(entries, (entry) => !Str.startsWith(`${LOCKFILE_PATH}\0`)(entry)),
          "\n"
        )
      )
    ),
    // `process.versions.bun` is absent when the CLI runs under Node.
    bunVersion: process.versions.bun ?? "none",
    platform: yield* HostProcessPlatform,
    architecture: yield* HostProcessArchitecture,
  });
});
