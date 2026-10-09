# git (lab port of @effected/git)

[![npm](https://img.shields.io/npm/v/@effected%2Fgit?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/git)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Typed git introspection as an Effect service. A read tier answers the questions monorepo tooling actually asks — `Git.show` reads a file's content at any ref without checking it out, `Git.nameStatus` types each changed path as added, renamed, deleted and so on, `Git.workingChanges` gathers the full working-tree delta, `Git.commitInfo` returns a commit's sha, signature verdict and raw message — and a clearly-marked mutating tier (`checkout`, `fetch`, the submodule pair, `sparseCheckoutSet`, `configSet`, `add`) changes repository state on purpose. Subprocesses run through Effect core's `ChildProcessSpawner` contract, required in `R` and provided once at your application's edge, so this package has zero runtime dependencies and zero `node:` imports.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Why @effected/git

Shelling out to git looks easy until you have to interpret the answers. git speaks through exit codes and stderr prose, and the prose changes with the question: an unknown ref, a directory that is not a repository, a path absent at a ref, and a genuinely failed command all come back as "non-zero exit plus a sentence". Code that string-matches stderr at every call site gets this wrong somewhere, eventually, in a different way each time.

This package reads git's exit codes and stderr in exactly one classification step and hands you typed answers instead: a path absent at a valid ref is `Option.none` from `show` (a fact about the ref, not an error), a ref that does not resolve is `false` from `refExists` and a typed `UnknownRefError` elsewhere, a directory outside any work tree is `NotARepositoryError`, and everything else is a `GitCommandError` carrying the exit code and stderr intact. Spawn-level platform failures and the 30-second per-run ceiling are absorbed into that same taxonomy — no `PlatformError` and no timeout defect ever leaks from a `Git` method. Every command the service spawns pins `LC_ALL=C`, so the classification is stable across locales, plus a set of non-interactive pins (`GIT_TERMINAL_PROMPT=0` and an empty `GIT_ASKPASS`), and a member that reaches a remote adds `-o BatchMode=yes` to the ssh command git would otherwise have used — so a credential-requiring remote, over https or ssh, fails fast instead of blocking on a prompt, a passphrase, or a host-key confirmation. Tree listings use NUL-terminated output, so a path containing a space — or a newline — survives parsing.

There is no opt-out through the service, and the pins win: `extendEnv: true` merges the parent environment, but a pinned key beats it, so `GIT_TERMINAL_PROMPT=1` in your environment does not re-enable prompting. A caller who genuinely wants git to prompt runs a `GitCommand` value themselves — those are pure and carry no environment at all, so they inherit yours untouched.

The ssh pin is the one that adapts to you rather than overriding you. Before a member that reaches a remote spawns, the service resolves the ssh command git would have used on its own — your `GIT_SSH_COMMAND`, else your `core.sshCommand`, else plain `ssh` — and appends `-o BatchMode=yes` to *that*, so a custom identity file, jump host or port survives. It leaves your setup strictly alone in four cases: when `GIT_SSH` is what decides (it names a program and takes no arguments, so there is nothing to append to and pinning anything would displace it); when the program is not OpenSSH (`plink` has no `-o KEY=VALUE` form, so appending would break it rather than degrade it); when `ssh.variant` or `GIT_SSH_VARIANT` tells git the command is not OpenSSH regardless of its name; and when you already set `BatchMode` yourself — OpenSSH honors the first value given for a repeated option, so your choice stands either way. In every one of those, the other pins still apply; only the ssh-level one is skipped.

`GitCommand` is exported alongside the service: 24 pure constructors producing Effect core `Command` values you can inspect, log, or test against without spawning anything.

## Install

```bash
npm install @effected/git effect
```

```bash
pnpm add @effected/git effect
```

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency, and it is the only one — git has no runtime dependencies of its own.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

The subprocess spawner comes from Effect core's `ChildProcessSpawner` contract, not from a platform package. A consumer provides it once at the edge — `NodeServices.layer` from `@effect/platform-node` on Node — and a test provides a scripted spawner built with `ChildProcessSpawner.make`, no processes involved.

## Quick start

Read a file at a ref, list what changed, and probe a branch — all without touching the working tree:

```ts
import { Git } from "@effected/git";
import { NodeServices } from "@effect/platform-node";
import { Effect, Layer, Option } from "effect";

const program = Effect.gen(function* () {
  const git = yield* Git;
  const manifest = yield* git.show("/repo", "v1.2.0", "package.json");
  const changed = yield* git.changedFiles("/repo", { base: "main", head: "HEAD" });
  const released = yield* git.refExists("/repo", "refs/tags/v1.2.0");
  return { manifest: Option.getOrNull(manifest), changed, released };
});

const GitLive = Git.layer.pipe(Layer.provide(NodeServices.layer));

Effect.runPromise(program.pipe(Effect.provide(GitLive))).then(console.log);
// { manifest: "…the package.json as it was at v1.2.0…", changed: ["src/index.ts"], released: true }
```

The error channel tells you what can actually happen — and `show` on a path that did not exist at the ref is not one of those things:

```ts
import { Git, NotARepositoryError, UnknownRefError } from "@effected/git";
import { Effect, Option } from "effect";

const contentAt = (cwd: string, ref: string, path: string) =>
  Effect.gen(function* () {
    const git = yield* Git;
    return yield* git.show(cwd, ref, path);
  }).pipe(
    Effect.catchTag("UnknownRefError", () => Effect.succeed(Option.none<string>())),
    Effect.catchTag("NotARepositoryError", (e) => Effect.die(e)),
  );
// Effect<Option<string>, GitCommandError, Git> — absent-at-ref was already Option.none, no catch needed
```

## Features

Twenty-six service methods: eighteen that read repository state and eight that mutate it, all funneled through the same one-step classification.

- Content and trees: `Git.show(cwd, ref, path)` — file content at a ref, `Option.none` when the path is absent there — and `Git.lsTree(cwd, ref)` with an optional pathspec, returning typed `LsTreeEntry` values (mode, type, oid, path), NUL-parsed.
- Diffs: `Git.changedFiles(cwd, { base, head })` — paths changed across a range — and `Git.nameStatus`, which types each change as added, modified, deleted, renamed, copied and more, carries `oldPath` on renames, and takes either a `base...head` range or the working tree versus a single ref.
- Working tree: `Git.unstagedChanges`, `Git.stagedChanges`, `Git.untrackedFiles` and `Git.workingChanges` (their deduplicated union), plus `Git.status` as typed porcelain `StatusEntry` values.
- Probes: `Git.refExists` (`true`/`false`, including `false` for refs that do not resolve at all), `Git.mergeBase` and `Git.revParse` (resolved SHAs), `Git.repoRoot` (physical — symlinks resolved), `Git.commonDir` (the absolute, symlink-resolved directory a repository shares with all its linked worktrees, so two answers compare with `===` across worktrees), and the `Option`-answering `Git.defaultBranch` (unset remote HEAD → `Option.none`, remote prefix stripped), `Git.currentBranch` (detached HEAD → `Option.none`), `Git.configGet` and `Git.remoteUrl`.
- Configuration reads: `Git.configGet`, `Git.configGetAll` and `Git.configList` take an optional `scope` (`"local" | "global" | "system" | "worktree"`, the `GitConfigScope` type). **Omitted still means the MERGED read** — the value git itself would use, which includes whatever the machine's `~/.gitconfig` sets — so pass `{ scope: "local" }` to ask what this checkout alone declares. `configList` accepts `file` or `scope`, never both: git takes one source.
- Commits: `Git.commitInfo(cwd, ref?)` — a typed `CommitInfo` with the sha, the `%G?` signature verdict and the raw, untrimmed message.
- History: `Git.log(cwd, { paths?, follow?, limit?, firstParentDiffMerges? })` — the commit walk as typed `CommitLogEntry` values, each carrying the sha, both dates decoded to `DateTime.Utc`, the author identity and the paths that commit touched. Scope it with a pathspec, walk a single path across renames with `follow: true`, and give merge commits a path listing with `firstParentDiffMerges`. An unborn `HEAD` and a pathspec no commit touched are both the empty listing, never a failure.
- Mutating tier, each method marked as such: `Git.checkout` (with a detach option), `Git.fetch` (remote, ref, depth, tag), `Git.fetchAny` (tries the tag form first, falls back to the plain form on `UnknownRefError` or `GitCommandError`), `Git.submoduleUpdate`, `Git.submoduleAdd`, `Git.sparseCheckoutSet` (explicit cone flag), `Git.configSet` (the write is repository-local, always: a bare `git config` writes the checkout's own `.git/config`, and no global or system scope is offered — a write has no defensible "effective value" default the way a read does) and `Git.add`. Nothing here serializes concurrent access — the caller owns that, per working tree.
- `GitCommand.*` — all 24 invocations as pure, inspectable `Command` values.
- Errors: `GitCommandError`, `NotARepositoryError`, `UnknownRefError` — classification happens once, inside the service. A ref the remote does not have surfaces as `UnknownRefError` too, the typed signal a tag-then-branch fetch fallback branches on with `Effect.orElse`.

## Need a git command this package does not have?

`Git`'s scope is closed by its consumers, not by git's porcelain, so it will
always be missing something. When you hit that, **do not copy this package's
private `src/internal/run.ts`** — reach for
[`@effected/commands`](../commands)' `Run.collect`, which is the public,
maintained, bounded version of the same "spawn one command and collect
stdout/stderr/exit-code concurrently under one scope" discipline:

```ts
import { Run } from "@effected/commands";
import { ChildProcess } from "effect/process";

const shortlog = ChildProcess.make("git", ["shortlog", "-sn", "HEAD"], {
  // The pins Git applies to its own spawns, which you make yourself here:
  // LC_ALL=C keeps stderr classifiable; the next two keep a credential-
  // requiring remote from blocking on a prompt (an empty GIT_ASKPASS is a
  // hard stop that also suppresses core.askPass and SSH_ASKPASS). extendEnv
  // keeps PATH.
  //
  // No GIT_SSH_COMMAND here, deliberately: `shortlog` is local. If YOUR
  // command reaches a remote and you want the same non-interactive
  // guarantee, resolve what git would have used first — GIT_SSH_COMMAND,
  // else core.sshCommand, else GIT_SSH, else plain ssh — and append
  // `-o BatchMode=yes` to that. Pinning a bare `ssh` instead silently
  // displaces a configured core.sshCommand or GIT_SSH, because the
  // environment variable outranks both in git's own precedence order.
  env: {
    LC_ALL: "C",
    GIT_TERMINAL_PROMPT: "0",
    GIT_ASKPASS: "",
    SSH_ASKPASS_REQUIRE: "never",
  },
  extendEnv: true,
}).pipe((command) => ChildProcess.setCwd(command, cwd));

const output = yield* Run.collect(shortlog);
// output.stdout / output.stderr / output.exitCode — a non-zero exit is DATA
// here, not an error, which is what lets you classify stderr the way Git does.
```

`Run.collect` gets you three things the hand-rolled copy will not: the
`{ concurrency: "unbounded" }` triple-collect that keeps a full OS pipe buffer
from deadlocking the run, a 16 MiB per-stream capture ceiling instead of
unbounded memory, and redaction of declared secrets out of both the captured
output and any error it raises. `@effected/commands` is a boundary package with
`effect` as its only peer, so taking that edge costs a consumer nothing beyond
the `ChildProcessSpawner` layer it is already providing to `Git`.

`Git` itself deliberately does **not** take that edge — see
`@effected/git`'s design doc for why — so the two implementations are parallel
by design. The one to build new code on is `Run.collect`.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/git` 0.20.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/git/GitConfig.ts:23 * derived from the offset.
- scratchpad/effected/git/internal/config.ts:5 // Never exported from the package. This module emits raw carriers (plain

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
