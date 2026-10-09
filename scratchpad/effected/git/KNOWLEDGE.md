# git — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/git/CLAUDE.md -->
# @effected/git

Typed git introspection over core's `ChildProcessSpawner`: a **read tier** that reads a repository's state at any ref without checking it out, a clearly-marked **mutating tier** that changes it, and a **pure git-config core** (`GitConfig` with `Gitmodules` on top, no subprocess anywhere near them). Boundary tier: `effect` is the only peer, zero runtime dependencies, zero `node:` imports in `src/`.

Durable knowledge lives in the OKF bundle at the repo root. Start at `okf/modules/git.md`, then load what the task needs:

- Package design, tiers, the module map, the parsed models and the argv rules → `okf/modules/git.md` — Load when: changing the service surface, adding a member or constructor, or touching a parser or parsed model.
- Error classification (the `ClassifyKind` table, what each kind buys, absorption of `PlatformError` and the timeout) → `okf/decisions/git-classification-happens-once.md`, `okf/limitations/git-stderr-classification-unanchored.md` — Load when: adding a `ClassifyKind` row, a typed error, or asking why a git failure surfaces as the error it does.
- Redaction (the `redactedArgs` mask, error values, span annotations) → `okf/conventions/git-redaction-policy.md` — Load when: adding a constructor that takes a URL, remote or config value, or annotating a span.
- Environment pins and the ssh `BatchMode` resolution → `okf/invariants/git-command-constructors-carry-no-cwd-or-env.md`, `okf/decisions/git-ssh-pin-appends-and-declines.md`, `okf/limitations/git-network-member-latency-multiple-of-timeout.md` — Load when: touching `BASE_ENV`, `resolveSshEnv`, `withBatchMode`, or adding a network-touching member.
- Locating a repository (`repoRoot` is physical, `commonDir` is identity across worktrees) → `okf/modules/git.md`, `okf/decisions/physical-ceiling-is-a-separate-static.md` — Load when: touching `repoRoot` or `commonDir`, or bounding an upward walk by the repository root.
- Config reads versus writes → `okf/gotchas/git-config-read-without-scope-is-merged.md`, `okf/limitations/git-config-set-refuses-dash-leading-values.md` — Load when: touching `configGet`, `configList` or `configSet`.
- Integration-suite traps → `okf/gotchas/git-protocol-file-allow-does-not-reach-submodule-clone.md`, `okf/gotchas/git-log-follow-drops-merge-commits.md` — Load when: writing or debugging a fixture under `__test__/integration/`.
- Testing standards (the shared-fixture `beforeAll`/`afterAll` lifecycle, `assert.*`, the mock spawner) → `okf/conventions/testing-standards.md` — Load when: writing tests or mocking the spawner.

## Operating rules

- Every mutating method's TSDoc opens with the literal word `"Mutating:"`; that is the only tier signal a caller gets, and nothing here serializes concurrent access.
- Every `Git` method funnels through the private `classify` step in `Git.ts`; nothing else in the package may inspect `stderr`, `stdout` or `exitCode`. The stderr matching is unanchored by design — do not "fix" it without discussion.
- A `GitCommand` constructor carries argv and a redaction mask only — no `cwd`, no `env`, no validation. Do not put a pin or a guard back onto one; `assertGitCommand` fails at once.
- A new network-touching member routes through `runForNetwork`; a non-network member never does.
- `parseNameStatus` and `parseStatus` order their rename tokens opposite each other and must never be merged into one implementation.
- Do not delete the dual-stream backpressure integration test; it is the sole regression guard for `runCollected`'s `{ concurrency: "unbounded" }`.
- `@effect/platform-node` is a devDependency for the integration suites only; never in `dependencies` or `peerDependencies`.
- A consumer needing a git read this package lacks gets `@effected/commands`' `Run.collect` (the README recipe), never `src/internal/run.ts`.
- Never widen the narrow `_base` suppression in `savvy.build.ts`; never run `node savvy.build.ts --target prod` directly.

## Commands

```bash
pnpm vitest run packages/git        # @effect/vitest, assert.* — never expect
pnpm build --filter @effected/git   # from the repo root, through turbo
```


---
<!-- okf/modules/git.md -->
---
type: Module
title: git
description: Typed git for the kit — a read tier over a repository's state and a clearly-marked mutating tier, plus a pure git-config document model.
status: stable
kind: package
resource: ../../packages/git
tags:
  - architecture
  - security
generated:
  by: "okfit/claude-code"
  at: 2026-09-29T07:46:37Z
  body_sha256: 9e31a15102a84036509a2b471078370589fd958307a306e3dd76b762613af3c2
---

# git

## Purpose

`@effected/git` is typed git for the kit, one service in two tiers: a
**read tier** that reads a repository's state without touching the
working tree, and a clearly-marked **mutating tier** that changes it (see
`packages/git/src/Git.ts` for the surface). It programs against core's
subprocess contract (`ChildProcessSpawner` and `ChildProcess.Command`
values from `effect/process`), requiring the spawner in its `R`
channel exactly as the kit's boundary packages require core
`FileSystem`; the consumer's platform layer discharges it once at the
edge.

Scope is closed by its consumers, not by git's porcelain — there is no
ambition toward a general git client, and an operation earns a method
here when a consumer needs it typed. Mutating operations live on `Git`
itself, one service, two tiers, never a second service or package. The
tier marker is documentary and absolute: every mutating method's TSDoc
opens with the literal word `"Mutating:"`, and that is the only signal —
nothing in this package serializes concurrent access, so a caller running
a mutating call alongside anything else against the same `cwd` owns the
race, per `cwd`.

## Why it owns git interpretation

Interpreting git — the exit-code and stderr taxonomy, the
absent-vs-error distinction, tree-entry parsing — is a concern that
should exist once, typed, in a package named for it. The consumers would
otherwise interpret git output and exit codes themselves:
[`workspaces`](workspaces.md)' snapshot reader needs "file at ref, or
none," and multiple consumer packages spawn `git` from many call sites.
Those responsibilities live here instead, behind a small typed surface.
`workspaces`' `ChangeDetector` and `WorkspaceSnapshots` service stand on
this package.

## Tier and dependencies

Boundary tier. `effect` is the only peer; there are no `@effected` edges,
no external runtime dependencies and no `node:` built-ins anywhere in
`src/` — spawning is entirely behind core's `ChildProcessSpawner`
contract, required in `R`. Requiring a core-declared service in `R`
costs the consumer nothing: the IO is discharged by the platform layer
provided once at the edge, the same argument that keeps
[`walker`](walker.md), [`xdg`](xdg.md) and [`config-file`](config-file.md)
at boundary tier over core `FileSystem`. `@effect/platform-node` appears
only in `devDependencies`, for the integration suites — devDependencies
never count toward tier.

## Public surface

See `src/GitCommand.ts` and `src/Git.ts`; the index re-exports only.

### `GitCommand` — pure, inspectable invocations

One git-flavored constructor per operation, producing core
`ChildProcess.StandardCommand` values wrapped in `GitInvocation` (see
[the redaction policy](../conventions/git-redaction-policy.md)), covering
both tiers. `GitCommand` and `Git` are static classes with private
constructors, not `as const` namespace objects, per [the grouped-statics
rule](../conventions/no-barrel-re-exports.md). Constructors know the `git`
executable and each operation's argument conventions; they do **not**
know the environment — a constructor sets `extendEnv: true` and nothing
else, returning a value with neither `cwd` nor `env`, so a test can
assert the exact `command`/`args`/`options` an operation runs without
spawning ([the invariant](../invariants/git-command-constructors-carry-no-cwd-or-env.md)
pins this for every constructor). `Git` applies both `cwd` and `env` per
call via `ChildProcess.setCwd` and `ChildProcess.setEnv` at its single
spawn choke point. The environment pins live on the `Git` **service**
because they serve `classify` and the timeout, which live there, and the
ambient environment is read once in `Git.layer` through `ConfigProvider`,
never `process.env`. Each pin exists for a named failure:

- `LC_ALL=C` — classification depends on untranslated stderr text; a
  localized message silently misclassifies a typed domain error into
  `GitCommandError`.
- `GIT_TERMINAL_PROMPT=0` — git's own credential prompt, which otherwise
  blocks until the timeout.
- `GIT_ASKPASS=""` — the askpass chain, which `GIT_TERMINAL_PROMPT=0` does
  not close; an empty value is a hard stop (probed against git 2.55) that
  also suppresses a configured `core.askPass` and `SSH_ASKPASS`.
- `SSH_ASKPASS_REQUIRE=never` — defense in depth for a caller-supplied ssh
  wrapper that swallows the appended `BatchMode` option.
- `GIT_SSH_COMMAND` — the one conditional pin, scoped to the seven
  network-touching members (`lsRemote`, `fetch`, `fetchUnshallow`,
  `push`, `pull`, `submoduleAdd`, `submoduleUpdate`). `ssh` reads from
  `/dev/tty` directly, so `-o BatchMode=yes` is the only lever that makes
  it fail instead of hang; it is appended to what git would have used and
  declines rather than substitutes — see [the ssh pin
  decision](../decisions/git-ssh-pin-appends-and-declines.md), and [the
  latency limitation](../limitations/git-network-member-latency-multiple-of-timeout.md)
  it implies.

Three invariants ride on the argv: **the `-z` rule** — every
path-emitting constructor emits NUL-terminated output and splits on
`"\0"`, never `"\n"`, because git paths may themselves contain newlines,
while ref-emitting constructors split on newlines safely, since refname
grammar forbids one (two parsers, `lsRemote` and `submoduleStatus`, are
line-based with no choice at all because git offers no `-z` mode for
them; only `submoduleStatus` is unsafe, a recorded git-imposed
limitation). `log`'s `-z` does double duty — NUL-terminating the
`--format` output and disabling git's C-style path quoting — which is why
no `core.quotePath` handling exists anywhere in the package.
**`checkIgnore` bakes stdin into the pure command value** (`check-ignore
-z --stdin`), the only constructor that does, because git rejects `-z`
without `--stdin`. And **an explicit relative flag** — `changedFiles`,
`nameStatus` and the working-tree diff constructors pass `--relative` or
`--no-relative` explicitly, never omitted, because git honors a configured
`diff.relative=true` on an omitted flag; `untrackedFiles` inverts it,
adding `--full-name` when `relative` is false, so its `ls-files` output
shares the `--no-relative` diffs' repo-root base and `workingChanges`'
`Set` actually dedups from a nested `cwd`.

Two argv decisions ride on the service's pre-spawn guards. **Every
ref/range positional beginning with `-` is refused typed** as a
`GitCommandError` of `kind: "refused"` — git would parse it as a flag, and
`checkout("-b")` would create a branch. A blanket `--` separator is
deliberately not used because it flips `checkout` into pathspec mode;
`restore` puts its paths behind a literal `--` and guards only its
`source` ref, which is why it is a separate member. **The stash index
constructors render `stash@{n}` from an integer the service validates**
through `rejectNonNaturalNumber`, because every relational guard admits
`NaN`. `GitCommand`'s pure constructors never validate; the `Git` service
is the guards' home, pinned with never-spawn mocks.

### `Git` — the read tier

A `Context.Service` whose layer resolves `ChildProcessSpawner` once at
construction, so every method's `R` is `never`. The service's shape is
the exported `GitShape` interface, not an inferred object type, so a
consumer can write a function accepting any `GitShape` — a test double, a
decorated instance — without naming the service class. Every method
takes `cwd` explicitly. The per-operation ceiling is git's own policy (30
seconds via `Effect.timeoutOrElse`, owned here).

The core read contracts: `show(cwd, ref, path)` returns `Option<string>` —
absent-at-ref degrades to `Option.none`, never an error, the invariant
`WorkspaceSnapshots.at` depends on; `lsTree`, optionally
pathspec-filtered, returns the entries a compiled
[`glob`](glob.md) set filters; `refExists` answers a non-resolving ref as
`false`, never an error; `mergeBase` and `changedFiles` are the
committed-range primitives `ChangeDetector` runs on; `revParse`
normalizes refs for snapshot cache keys. Working-tree primitives
(`unstagedChanges`, `stagedChanges`, `untrackedFiles`) are public service
methods in their own right, with `workingChanges` composing them as a
deduplicated union that takes no ref, so `UnknownRefError` cannot arise
from it. `nameStatus` is the semantically-typed diff, with a typed status
vocabulary and `oldPath` on renames/copies. `lsRemote` reads over the
network and `lsFiles` reads the index — the only read that sees a
staged-but-uncommitted `160000` gitlink — and both are still reads.
`log` is the history walk, the one member whose parser can fail typed
(see [classification](../decisions/git-classification-happens-once.md)).
Introspection probes degrade "not there" to `Option.none`:
`defaultBranch`, `currentBranch` (git's literal `"HEAD"` for detached HEAD
maps to none — a fake branch name would be worse than an honest absence),
`configGet`, `remoteUrl` and `mergeBaseOption`.

Two probes locate a repository, and both answer **physical** paths.
`repoRoot` (`rev-parse --show-toplevel`) is git's symlink-resolved
toplevel, so it need not match the spelling a caller reached the checkout
by — every macOS tmpdir is `/var` reached as `/private/var` — and an
upward walk bounded by it uses [walker](walker.md)'s
`Walker.ascendWithin`, never `ascend`'s lexical `stopAt`. `commonDir`
(`rev-parse --path-format=absolute --git-common-dir`) is repository
**identity**: git answers the same absolute, symlink-resolved directory
from the main checkout, any subdirectory, any linked worktree and any
symlinked path (probed on git 2.55), so two answers compare with `===`,
where `repoRoot` cannot serve because each worktree has its own toplevel.
A bare repository answers its own directory. `--path-format=absolute` is
load-bearing and needs git 2.31 or later: without it git prints `.git`
relative in a plain checkout but absolute inside a linked worktree. An
older git does not refuse the flag: `rev-parse` echoes it to stdout,
answers the relative form and exits 0, so `commonDir` rejects an answer
that starts with `-` or spans lines as a `GitCommandError` rather than
letting it pass as an identity. Only git's terminating newline is
stripped, never `trim`, because a directory name may end in whitespace.
The canonicalization is git's, deliberately — resolving symlinks in this
package would add `FileSystem` to `Git.layer`'s `R`, which stays
`ChildProcessSpawner` alone.

Config reads are
scopeable and config writes are not; [the merged-read
gotcha](../gotchas/git-config-read-without-scope-is-merged.md) explains
the asymmetry.

### `Git` — the mutating tier

Covers checkout, the fetch family, the working-tree restore trio
(`reset`, `clean`, `restore`), branches, tags, stashes, remotes,
worktrees, `commit`/`push`/`pull`, config writes, staging and the
submodule and sparse-checkout operations. `reset` and `clean` fail
loudly on any non-zero exit, so a consumer can restore a tree before
retrying a non-idempotent operation; `clean` passes `--force`
unconditionally, since under git's default `clean.requireForce` a
forceless clean is a guaranteed no-op. `restore` is a separate member
from `checkout`, so `checkout`'s option-like-ref refusal is never
weakened to admit pathspecs. `branchCreate` is one member with two argvs
(`branch [-f]` or `checkout (-b|-B)`), because the delete-then-create
longhand swallows a real edge: `branch -D` refuses the currently
checked-out branch while `checkout -B` resets it fine. `isShallow` is a
dedicated predicate rather than a `revParse` mode, so that member's
contract stays "resolve this ref". `fetchUnshallow` is a distinct mode
and **the caller guards**: git rejects `--unshallow` in a non-shallow
repository and the method does not tolerate that (tolerating would
swallow every other fetch failure shape), so probe with `isShallow`
first; `fetch`'s `unshallow: true` follows the same rule and is refused
typed pre-spawn when combined with `depth`, exactly as git rejects the
pair. `fetch`'s `ref` accepts a full refspec passed through verbatim
(`src:dst`, optionally `+`-prefixed; the guard refuses only a leading
`-`) — never guess-transform a bare ref into a refspec, because under a
single-branch clone a bare-ref fetch updates only `FETCH_HEAD`, and the
`+refs/heads/<b>:refs/remotes/origin/<b>` form is the caller's own
decision. `fetchAny` composes a tag-then-branch fallback as a method,
routing on the caught error's `kind` rather than its stderr text — every
consumer of "fetch this ref, I don't know which kind it is" would
otherwise rebuild the same fallback on stderr strings; a
`kind: "refused"` error re-fails immediately since the plain form would
reject it identically, `NotARepositoryError` propagates from the tag
attempt, and when both attempts fail the plain fetch's error surfaces.
`configSet` writes repository-local, always, and offers no scope; its
guard on `key`, `value` and `file` is [a recorded
limitation](../limitations/git-config-set-refuses-dash-leading-values.md).

### The parsed models

`Git.ts` defines its parsed results as `Schema.Class` models, one per
list parser. Three carry rules a refactor would silently break.
`NameStatusEntry` (`diff --name-status -z`) and `StatusEntry` (`status
--porcelain -z`) order their rename token **opposite** each other — git
emits old-path-then-new-path for the former and new-path-then-old-path
for the latter — so `parseNameStatus` and `parseStatus` must never be
conflated into one implementation. `CommitInfo.message` is the raw `%B`,
deliberately untrimmed including git's trailing format newline, because
this package does not decide what "the message" means for a consumer that
cares about trailing whitespace. `StashEntry`'s array position is the
current stash index. `LsRemoteEntry` carries the near-miss suggestion
policy (`shortName`, `nearMatches`) on the entry value, not in the
service. `ConfigListEntry` splits `--list -z` output on the first newline
so multi-line values survive, and a valueless boolean-shorthand key
surfaces as `""`.

## Rendering status back to text

`StatusEntry.toLine()` and `StatusEntry.format(entries)` take the whole
round trip from `git status --porcelain -z` back to line-oriented text
through this package instead of through each consumer's ad-hoc string
building. The rename convention is decided once, here: the default
renders a rename/copy entry's new path only, a recorded divergence from
git's own non-`-z` `orig -> new` rendering, available opt-in via
`StatusRenderOptions`. Paths are emitted raw, never C-quoted, since the
rendering targets whitespace-insensitive text consumers.

## Errors: classification happens once

See [classification happens once](../decisions/git-classification-happens-once.md).

## The pure git-config core

A pure git-config parser/serializer lives inside this package, not as an
INI codec in `config-file` or as shell-out-only access — git-config is
not INI. `GitConfig` is text-first and lossless: the document holds its
source text plus a structural index, `stringify` returns byte-for-byte
identity on unmodified documents, and every edit compiles to a minimal
text splice and re-parses, so comments, ordering and whitespace outside
the edited span survive. The semantics are git-config's, not generic INI:
case-insensitive section and key names, case-sensitive quoted
subsections, the deprecated `[a.b]` dotted form (whose subsection compares
case-insensitively), multi-valued keys, the bare-`key` boolean shorthand,
quoting, escapes and continuations, and `include`/`includeIf` surfaced by
`includes()` but never resolved. Malformed input fails typed
(`GitConfigParseError`), while a hand-built `GitConfig.make` over
unparseable text dies as a defect — bad wiring, not bad input. `Gitmodules` is the typed view on top: a
`GitmodulesEntry` per submodule section, with entry-level mutations
(`setUrl`/`setPath`/`setBranch`/`setShallow`/`add`/`remove`/`rename`)
compiling into `GitConfig`'s surgical editor so git's own formatting
survives. Its `update` field stays a raw string deliberately, since git
accepts `!command` values there.

## The redaction policy

See [the git redaction policy](../conventions/git-redaction-policy.md).

## Module layout

Six source modules, per the module-per-concept standard: `GitCommand.ts`
(pure invocation constructors, both tiers), `Git.ts` (the service, its
live layer and test double, the error taxonomy, `classify`/`runClassified`
and the parsed-result models), `GitConfig.ts` (the lossless document
model and surgical editor), `Gitmodules.ts` (the typed `.gitmodules`
view), `internal/run.ts` (the collected-run and `available` helpers over
`ChildProcessSpawner`, not exported — `available` has no production
consumer and is kept deliberately with its tests) and `internal/config.ts`
(the git-config engine: raw scanner records and splice/serialize
primitives behind the cycle firewall; it never imports the public
classes, and it recurses nowhere, so no depth cap is needed).

## Observability

Named spans on each `Git` method, annotated with stable identifiers
(`cwd`, `ref`), never file contents. No logging, no metrics —
telemetry-agnostic. The stable-identifiers-only rule is half of [the
redaction policy](../conventions/git-redaction-policy.md).

## Testing

`@effect/vitest`, `it.effect`, `assert.*` — never `expect`; tests in
`__test__/`. Unit tests over a mocked `ChildProcessSpawner` pin the
classification boundary — the full matrix across every `ClassifyKind`,
the absence-family degrades, the option-injection and natural-number
guards rejecting pre-spawn, the parsers with their opposed rename token
orders, and redaction surviving through `classify`. Unit tests over
`GitCommand` constructors assert exact argv and env plus the redaction
mask, with no spawning. `GitConfig`'s conformance corpus is count-guarded
and asserts both lookups and byte-for-byte round-trip. Integration tests
drive fixture repositories through `@effect/platform-node`'s real
`ChildProcessSpawner` layer, with the mutating tier isolated in its own
temp-dir fixtures, using the shared-fixture `beforeAll`/`afterAll`
lifecycle [testing standards](../conventions/testing-standards.md)
sanction for expensive real-world fixtures. Two traps in those suites are
recorded: [`protocol.file.allow` does not reach a submodule
clone](../gotchas/git-protocol-file-allow-does-not-reach-submodule-clone.md),
and [`--follow` drops merge
commits](../gotchas/git-log-follow-drops-merge-commits.md), which is why
`log` has its own history fixture. A new typed error ships with a control: a test asserts
the error fires on its own members, and a control asserts another member
fed the same stderr still fails as the generic `GitCommandError`, so kind
gating is a guarantee rather than an intention. The dual-stream
backpressure integration test is the only thing that exercises
`runCollected`'s `{ concurrency: "unbounded" }` collection and must not
be deleted — a mock spawner over in-memory streams cannot deadlock the
way a real OS pipe can.

## Consumers

[`workspaces`](workspaces.md)' `ChangeDetector` runs on `Git`
(`changedFiles(relative: true)` for the committed range,
`workingChanges(relative: true)` for `includeUncommitted`), and its
`WorkspaceSnapshots` service reads refs through `show`/`lsTree`. A
non-repository surfaces as this package's typed `NotARepositoryError`.
Other consumers use the introspection tier in place of hand-rolled
subprocess helpers, and the mutating tier backs release-automation flows
such as the restore trio for pre-retry cleanup, `branchCreate`/`push`/`commit`
for a release branch, the stash family and porcelain rendering for job
summaries.

A consumer needing a git read `Git` does not have is pointed at
[`commands`](commands.md)' `Run.collect`, never at the private
`internal/run.ts`: `Run.collect` is the public, bounded (16 MiB per
stream), redaction-capable version of the identical discipline, and the
package README's "Need a git command this package does not have?" section
is the sanctioned recipe, including the pins the caller re-applies by
hand. `Git` itself does not take that edge — the package has no
`@effected` edges by design, and consolidating would swap unbounded
capture for a ceiling and add a child span under every member — so the
parallel implementations are deliberate; amend this concept before
changing that.


---
<!-- okf/decisions/git-classification-happens-once.md -->
---
type: Decision
title: Git failure classification happens once, in one private function
description: No consumer of @effected/git ever string-matches stderr; a single private classify step in Git.ts is the only place that inspects stderr, stdout or exitCode.
status: draft
tags:
  - architecture
  - security
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 8e9b17588c6e738162490101484e51aa2488a6aa92f4cb1eec6e382c5bada4c1
---

# Git failure classification happens once, in one private function

## Context

git communicates failure through exit codes and unstructured stderr text.
Every consumer of a git-spawning library that has to interpret that text
itself risks re-deriving — and re-getting-wrong — the same classification
logic, and a change to git's own wording can silently break every
independent implementation at once.

## Decision

No consumer of `@effected/git` ever string-matches stderr. Git's failure
modes are classified in a single private `classify` step in `Git.ts` —
nowhere else in the package inspects `stderr`, `stdout` or `exitCode`.
The base taxonomy is three typed errors carried through every surface the
service has:

- **`GitCommandError`** — git ran and failed in a way that is not a
  recognized domain case, the spawn itself failed, or a pre-spawn guard
  refused the invocation. A required `kind` discriminant
  (`"refused" | "failed"`) splits pre-spawn refusals from genuine git
  failures structurally, so composed retry/fallback logic routes on
  `kind` rather than parsing the `detail` prose.
- **`NotARepositoryError`** — the `cwd` is not inside a git work tree.
  Every consumer branches on this, so it is a distinct tag rather than a
  `GitCommandError` a caller regex-matches.
- **`UnknownRefError`** — the ref does not resolve. Actionable and
  user-facing, so it is distinct from mechanics; the ref-fetching trio's
  failures land here typed, which is the signal `fetchAny`'s
  tag-then-plain fallback branches on.

Three more errors exist on the rule that **a typed error exists only
where a consumer branches**, each raised only by the members introduced
with it: `NonFastForwardError` (`push` rejected because the remote
moved), `DirtyWorktreeError` (git refused before touching anything) and
`MergeConflictError` (git wrote conflict markers). These three are
kind-gated, so adding them changed no other member's error union —
`checkout` failing on dirty-worktree stderr still surfaces as
`GitCommandError`, pinned by a regression test rather than by intent.

`classify` is gated by a `ClassifyKind` selecting which method-specific
rows apply on top of the shared taxonomy (`exitCode === 0` is success,
`"not a git repository"` is `NotARepositoryError`, an unknown-revision
phrase is `UnknownRefError`, anything else non-zero is `GitCommandError`
with `exitCode` and `stderr`). What each kind buys, and which members ride
it:

| kind | members | the row it enables |
| --- | --- | --- |
| `"show"` | `show` | an absent-at-ref phrase degrades to `Option.none()` |
| `"refExists"` | `refExists` | exit 1 is `false`, and so is `unknownRef` — the contract is "does this resolve", so an unrecognized ref syntax must not throw |
| `"quiet"` | `defaultBranch`, `configGet`, `configGetAll`, `checkIgnore`, `mergeBaseOption` | a **silent** exit 1 is absence (`Option.none()` or `[]`); exit 1 with any stderr text stays a real failure |
| `"noSuchRemote"` | `remoteUrl` | `"No such remote"` degrades to `Option.none()` |
| `"push"` | `push` | `[rejected]` together with `non-fast-forward`, `fetch first` or `stale info` is `NonFastForwardError`; git 2.54's remote-moved wording is `fetch first`, not the classic phrase, and the `--force-with-lease` lease failure is `stale info` |
| `"merge"` | `pull`, `stashPop`, `stashApply` | `would be overwritten by` on stderr is `DirtyWorktreeError`; `CONFLICT (`, `Automatic merge failed` or `could not apply` is `MergeConflictError` — the one place `classify` reads **stdout**, because git's merge machinery reports conflicts there while a rebase-mode pull's `could not apply` lands on stderr |
| `"log"` | `log` | an unborn HEAD (`does not have any commits yet`) is the empty listing — scoped to `log` because for every other member an unborn HEAD is a real failure |
| `"generic"` | everything else | none |

`mergeBase` deliberately stays `"generic"` while `mergeBaseOption` is
`"quiet"`: disjoint histories exit 1 silently, and the loud failure is the
contract `mergeBase`'s existing consumers depend on, so the one argv backs
both members. `"couldn't find remote ref"` sits in the unknown-ref
patterns for every member, though only `fetch`, `submoduleUpdate` and
`submoduleAdd` produce it. The two-ref members, `mergeBase` and
`changedFiles`, report `UnknownRefError` with `ref` set to the `"a...b"`
range label rather than either ref alone.

Both `PlatformError` and `Cause.TimeoutError` are absorbed inside
`runClassified` — a spawn-level failure becomes a `GitCommandError` with
`detail` set and no `exitCode`, and the 30-second `GIT_TIMEOUT` becomes
one with `detail: "timed out after 30s"` — so a `Git` method's error
channel only ever sees this package's own typed errors, never core's raw
plumbing. `log` is the one member whose parser can fail: every other
parser is total, but two ISO dates must decode and a record short of its
declared fields cannot be answered plausibly, so `parseLog` returns a
`Result` and both shapes surface as a `GitCommandError` with `detail`,
never a defect.

The stderr matching itself is unanchored substring matching against
`LC_ALL=C`-pinned phrases, an accepted, recorded tradeoff — a path or ref
name that literally contains one of these phrases could theoretically
misclassify, and anchoring is deferred until a real collision is
observed.

## Alternatives rejected

**Let each consumer classify git's stderr for its own needs.**
Rejected because it is the exact failure mode this package exists to
prevent: `@effected/workspaces`' snapshot reader, and every other
consumer spawning `git` directly, would each independently interpret
exit codes and stderr text, and a wording change in a future git release
would silently break every one of them differently.

**One flat `GitError` class with a string `reason`.** Rejected for the
same reason the kit's [per-reason tagged error
decision](github-actions-per-reason-tagged-errors.md) applies elsewhere:
a caller plausibly recovers from `NonFastForwardError` differently than
from `DirtyWorktreeError`, and collapsing them into one class with a
string discriminant removes `catchTag`'s ability to route on the
distinction structurally.

## Consequences

Adding a new typed error must ship with a control test: a test asserting
the error fires on its own member, and a control asserting another
member fed the identical stderr still fails generically — without the
control, kind-gating is an intention rather than a guarantee. Widening an
existing member's typed errors is a silent breaking change to every
`catchTag` written against it, so a new error tag is scoped as narrowly
as the member that needs it.


---
<!-- okf/limitations/git-stderr-classification-unanchored.md -->
---
type: Limitation
title: Git error classification uses unanchored substring matching on stderr
description: A path or ref name that literally contains one of the classification phrases could theoretically misclassify; anchoring is deferred until a real collision is observed.
status: stable
bounds: ../decisions/git-classification-happens-once.md
tags:
  - architecture
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: c26da2ba09b0ab211229634c853ee12a0778e16e061d0f720a07be7954000540
---

# Git error classification uses unanchored substring matching on stderr

## Condition

`@effected/git`'s `classify` step (`packages/git/src/Git.ts`) recognizes
git's domain-specific failures — an unknown ref, a non-fast-forward push
rejection, a dirty-worktree refusal — by matching known phrases as
**unanchored substrings** against stderr pinned to `LC_ALL=C`. A
repository, branch, tag, path or remote name that happens to literally
contain one of these phrases as a substring can trigger this condition.

## Symptom

If a git operation fails for an unrelated reason but the failing
command's stderr happens to contain a phrase from
`UNKNOWN_REF_PATTERNS` or one of the other pattern sets — for instance
because a ref or path name embeds one of those words — `classify` could
in principle route the failure to the wrong typed error (an `UnknownRefError`
for something that was not actually an unresolved ref, or similarly for
the push/merge classification kinds). No such collision has been observed
in practice; this describes a theoretical exposure surface pinned by the
package's own documentation rather than an incident that has occurred.

## Why this is acceptable

Anchoring the matches more precisely (to a specific position in the
stderr line, or to the exact message shape git emits) would add
complexity to every pattern set for a collision that has not been
observed. `LC_ALL=C` pins the message language so at least the risk is
confined to phrases that could appear in a name someone chose, rather
than to translated text varying by locale. The tradeoff is recorded
explicitly in the package's own source comment above
`UNKNOWN_REF_PATTERNS`, precisely so a future reader treats it as a known
and accepted risk rather than rediscovering it as a suspected bug.

## What the fix would take

Anchoring each pattern to a specific structural position in git's stderr
output — for example requiring the phrase to appear as a whole line, or
immediately following a known prefix git always emits for that failure
class — rather than matching it as a substring anywhere in the text. This
is deferred until a real collision is observed in practice, because
tightening every pattern preemptively risks the opposite failure: a
pattern anchored too strictly against an assumption about git's exact
wording that a future git version quietly changes, causing the
classification to stop firing at all.


---
<!-- okf/conventions/git-redaction-policy.md -->
---
type: Convention
title: Every git constructor and error path carries the redaction mask
description: A GitCommand constructor masks its own sensitive positionals into GitInvocation.redactedArgs; classify and span annotations must use only the redacted form.
status: stable
stale_after: "2027-03-13T00:00:00Z"
tags:
  - security
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: f4d5c915eb582945e999d13ab4d782360b0b5fb71cc3f302e89a20998bf4ebb6
---

# Every git constructor and error path carries the redaction mask

This is a stated rule `@effected/git` enforces on itself, not a loose
habit — every constructor and every error path is checked against it
before shipping.

**The mask lives on the pure constructor.** Every `GitCommand` constructor
returns a `GitInvocation { command, redactedArgs }`; the constructor is
the one place that knows which of its own positionals are sensitive. Two
mask kinds exist: a config value (`configSet`) is replaced wholesale by
`<redacted>`; a URL positional keeps everything but an embedded
`userinfo@` credential, so remote names and credential-free URLs stay
fully debuggable. Every remote-accepting constructor rides the URL mask —
`fetch`, `fetchUnshallow`, `lsRemote`, `push`, `pull`, `remoteAdd`,
`remoteSetUrl`, `submoduleAdd` and `submoduleSetUrl`. A new constructor
taking a remote or URL positional must apply the mask; a constructor with
no sensitive positional must produce element-wise identical raw and
redacted argvs, which the test helper's default assertion pins.

**The error model itself is redacted.** `classify` persists only
`redactedArgs` into `GitCommandError.args`, and `message` renders that
redacted vector — raw argv must never survive into an error value. A
pre-spawn guard refusal of a sensitive value reports `<redacted>` too.

**Span annotations carry stable identifiers only** — `cwd`, refs, keys,
paths, remote names — never config values and never URLs.

Both halves of this policy — error redaction and span discipline — are
what a new method must satisfy before it ships. Re-check this convention
against the actual constructor and `classify` implementations on the
listed date, since a policy stated as prose in a package's design
material can silently drift from the code enforcing it as the surface
grows.


---
<!-- okf/invariants/git-command-constructors-carry-no-cwd-or-env.md -->
---
type: Invariant
title: A GitCommand constructor carries no cwd and no environment
description: "Every GitCommand constructor returns a pure value with argv, a redaction mask and extendEnv: true only; the Git service applies cwd and the environment pins per call at its single spawn choke point, and the constructor suite asserts options.env is undefined for every constructor."
status: stable
resource: ../../packages/git/__test__/GitCommand.test.ts
tags:
  - architecture
  - testing
sources:
  - id: git-command-tests
    resource: ../../packages/git/__test__/GitCommand.test.ts
  - id: git-command
    resource: ../../packages/git/src/GitCommand.ts
  - id: git-service
    resource: ../../packages/git/src/Git.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: b0b5e2ad1cf8c2d51cdfb63b91805020b05747613768d2e6d36ff621979d60af
---

# A GitCommand constructor carries no cwd and no environment

## The property

Every `GitCommand` constructor is a pure, context-free value: argv plus
the redaction mask, with `{ extendEnv: true }` as the only spawn option
and neither `cwd` nor `env` set.[^git-command] `Git` applies both at its
single spawn choke point, `runClassified`, via `ChildProcess.setCwd` and
`ChildProcess.setEnv` — each returning a new command and leaving the pure
value untouched.[^git-service]

`extendEnv: true` is not one of the pins. It declares that git inherits
the parent environment at all (git needs `PATH`, `HOME`, `SSH_AUTH_SOCK`)
and forces no value; it is set at construction because core exposes no
run-time combinator for it — only `setCwd` and `setEnv` — and its default
belongs to whichever platform backend implements `ChildProcessSpawner`,
not to core.

## The mechanism

The `assertGitCommand` helper shared by the whole constructor suite
asserts `command.options.env` is `undefined` and no `cwd` is set for
every constructor case, alongside the argv and redaction
checks.[^git-command-tests] A pin that leaks back onto a constructor
fails the suite at once.

## What a refactor would have to break

Putting `LC_ALL`, `GIT_TERMINAL_PROMPT` or any other pin back onto a
`GitCommand` constructor, or making a constructor read the ambient
environment. The pins live on the service because they serve `classify`
and `GIT_TIMEOUT`, which live in `Git.ts`, and because the ssh pin must
be computed from the caller's own environment and the call's `cwd`, which
a pure constructor must never read. The ambient environment is read once,
in `Git.layer`, through `ConfigProvider` — a `Context.Reference`
defaulting to `fromEnv()`, so the read costs nothing in `R`, a test swaps
a provider instead of mutating the environment, and `src/` keeps its
zero-`node:`-imports boundary; a source-level `ConfigError` degrades to
"absent" because the layer's error channel is `never` by
contract.[^git-service]

[^git-command-tests]: `packages/git/__test__/GitCommand.test.ts` —
    `assertGitCommand` asserts `options.env` is `undefined` and no cwd for
    every constructor.
[^git-command]: `packages/git/src/GitCommand.ts` — the private `git`
    helper sets `extendEnv: true` and nothing else.
[^git-service]: `packages/git/src/Git.ts` — `runClassified` applies
    `setCwd` and `setEnv`; `Git.layer` reads `GIT_SSH_COMMAND`, `GIT_SSH`
    and `GIT_SSH_VARIANT` through `ConfigProvider`.


---
<!-- okf/decisions/git-ssh-pin-appends-and-declines.md -->
---
type: Decision
title: "The git ssh BatchMode pin is appended to what git would have used, and declines rather than substitutes"
description: "Before a network-touching Git member spawns, the service walks git's own GIT_SSH_COMMAND > core.sshCommand > GIT_SSH order at that cwd and appends -o BatchMode=yes only where appending is meaningful; every other case leaves the environment unpinned."
status: draft
tags:
  - security
  - architecture
sources:
  - id: git-service
    resource: ../../packages/git/src/Git.ts
  - id: git-unit-tests
    resource: ../../packages/git/__test__/Git.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 067bc6f52b4db9bf3eb3386dd635dd1db9c537caac05316a638bf9760fc8ebd6
---

# The git ssh BatchMode pin is appended to what git would have used, and declines rather than substitutes

## Context

`Git`'s base environment pins (`LC_ALL=C`, `GIT_TERMINAL_PROMPT=0`,
`GIT_ASKPASS=""`, `SSH_ASKPASS_REQUIRE=never`) close every prompt git
itself can raise, but `ssh` reads a key passphrase and a host-key
confirmation from `/dev/tty` directly, so none of them reach it. Probed
under a real pty, first contact with an unknown host hangs a network
member indefinitely until the 30-second `GIT_TIMEOUT` fires; `-o
BatchMode=yes` is the only lever that makes `ssh` fail instead of
block.[^git-service] Pinning it, however, means setting `GIT_SSH_COMMAND`,
which outranks `core.sshCommand`, which outranks `GIT_SSH` (each rung
verified against git 2.55) — so a naive pin of a bare `ssh -o
BatchMode=yes` silently discards a configured deploy key or transport and
turns "prompts for a passphrase" into "cannot reach the remote at all".

## Decision

Before a network-touching member spawns, `resolveSshEnv` walks git's full
precedence order for **that `cwd`** — `GIT_SSH_COMMAND` from the
environment, else `core.sshCommand` in that repository's config, else
`GIT_SSH`, else plain `ssh` — and **appends** `-o BatchMode=yes` to the
resolved command through `withBatchMode`. The result is `BASE_ENV` plus a
`GIT_SSH_COMMAND`, or `BASE_ENV` alone when resolution declines. It
declines, deliberately, in four cases:[^git-service]

- **`GIT_SSH` is the deciding rung.** It names a program and supports no
  arguments, so appending would make git invoke a program of that literal
  name. Resolution returns `BASE_ENV` untouched rather than displace a
  working transport with a bare `ssh`.
- **`ssh.variant` / `GIT_SSH_VARIANT` is anything but `auto`, `ssh`, or
  unset.** git's basename inference is overridable: a program literally
  named `ssh` with `ssh.variant=plink` is invoked with plink's `-P` and no
  `-o SendEnv=` (verified against git 2.55), so the append would corrupt a
  command that passes every name-based check.
- **The program's basename is not `ssh`.** `plink` has no `-o KEY=VALUE`
  form (its switch is `-batch`), so appending breaks a working PuTTY setup
  outright instead of degrading it.
- **The command already sets `BatchMode` as an option.** OpenSSH takes the
  first value obtained for a repeated option (verified with `ssh -G`
  against OpenSSH 10.3), so appending after a caller's `BatchMode=no` is
  inert; the caller's decision stands.

Two properties of the resolution follow from it being per-`cwd` rather
than per-service. The `core.sshCommand` and `ssh.variant` reads happen on
every network call because both are repository-local while one `Git`
instance serves every `cwd`; each is skipped when its environment
counterpart already decides, the two run concurrently, and they go
through the plain (non-network) run path because routing them through the
network path would recurse. And only the seven network-touching members
pay any of it — `lsRemote`, `fetch`, `fetchUnshallow`, `push`, `pull`,
`submoduleAdd`, `submoduleUpdate` — via `runForNetwork`; everything else
spawns with `BASE_ENV` alone, because a member that never invokes `ssh`
has no business pinning an ssh command or paying the config read.

The two guards are **deliberately narrow, and the asymmetry is the
reason**. `sshProgram` is quote-aware but not shell-aware:
`GIT_SSH_COMMAND` is shell-interpreted, so `"/opt/my tools/ssh" -i key`
is a working setup a plain whitespace split would misread as `"/opt/my`
and skip. `DECIDES_BATCH_MODE` matches `BatchMode` only after a `-o`, so
`ssh -F /tmp/BatchMode` — a config-file path — does not read as a
decision. Matching too little is safe (first-wins means an unrecognized
spelling still beats the append), while matching too much silently skips
the pin for a caller who never asked to be prompted. Each guard has a
regression test with a mutant; do not broaden either.[^git-unit-tests]

There is no opt-out through the `Git` service, which builds and spawns
internally. A caller who genuinely wants an interactive prompt takes the
`GitCommand` value and runs it themselves, and gets a plain inherited
environment with no pins at all — the honest shape, since `Git`'s
classification guarantees do not travel with the argv.

## Alternatives rejected

**Substitute a fixed `ssh -o BatchMode=yes`.** Rejected because it
outranks and discards `core.sshCommand` and `GIT_SSH`, converting a
prompt into an unreachable remote for anyone with a deploy key or custom
transport configured.

**Treat `GIT_SSH` as an ordinary rung and append to it.** Rejected: it is
a program name with no argument grammar, so the appended string becomes
part of the program name. This mistake was made once and is why the
decline is recorded.

**Broaden the guards to a whitespace split and a bare `BatchMode` word
match.** Rejected because both broadenings fail in the direction that
silently re-enables prompts, which is the failure the pin exists to
prevent.

## Consequences

A network-touching member's worst-case latency is a multiple of
`GIT_TIMEOUT`, not one instance of it — see [the latency
limitation](../limitations/git-network-member-latency-multiple-of-timeout.md).
A new network-touching member must route through `runForNetwork`, and a
new non-network member must not. The unit harness's `withoutSshProbe`
hides the config probes from `byArgs` so a member's own argv assertions
stay about the member.[^git-unit-tests]

[^git-service]: `packages/git/src/Git.ts` — `BASE_ENV`, `BATCH_MODE`,
    `DECIDES_BATCH_MODE`, `sshProgram`, `withBatchMode`, `resolveSshEnv`
    and `runForNetwork`, with the probe notes in their doc comments.
[^git-unit-tests]: `packages/git/__test__/Git.test.ts` — `withoutSshProbe`
    and the `withBatchMode` decline cases with their mutants.


---
<!-- okf/limitations/git-network-member-latency-multiple-of-timeout.md -->
---
type: Limitation
title: A network-touching Git member's worst-case latency is a multiple of GIT_TIMEOUT
description: "Each ssh-pin config probe is a full classified run with its own 30-second ceiling, so a network member can spend up to 30s probing before its own 30s run, and fetchAny doubles that again."
status: stable
bounds: ../modules/git.md
tags:
  - performance
sources:
  - id: git-service
    resource: ../../packages/git/src/Git.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: aad7fa63e446cd2d882cff369f41acb4822bd869e2ea87ab3abb0ea987a68228
---

# A network-touching Git member's worst-case latency is a multiple of GIT_TIMEOUT

## Condition

A caller invokes one of the seven network-touching `Git` members
(`lsRemote`, `fetch`, `fetchUnshallow`, `push`, `pull`, `submoduleAdd`,
`submoduleUpdate`) and reasons about its worst case from the documented
per-operation ceiling of 30 seconds.

## Symptom

The member can take longer than 30 seconds before its own git process is
even spawned. Under [the ssh pin decision](../decisions/git-ssh-pin-appends-and-declines.md)
each network member first resolves `core.sshCommand` and `ssh.variant`
at the call's `cwd`, and each probe is a full `runFor` carrying its own
`GIT_TIMEOUT` ceiling. A network member can therefore spend up to 30s
probing before its own 30s run, and `fetchAny` — two fetch rounds — can
double that again.[^git-service]

## Why this is acceptable

A local `git config --get` does not hang in practice, so this is a ceiling
change rather than an observed cost: the probes are skipped when their
environment counterpart (`GIT_SSH_COMMAND`, `GIT_SSH_VARIANT`) already
decides, the two run concurrently, and only the network members pay them.
The alternative — one shared deadline across probes and run — would make
a slow probe steal budget from the operation the caller actually asked
for.

## What the fix would take

Making the probes conditional on something cheaper than a spawn, or
sharing one deadline across probes and run. Either change must account
for the ceiling described here rather than rediscover it.

[^git-service]: `packages/git/src/Git.ts` — `resolveSshEnv` runs each
    probe through `runFor`, which wraps `runClassified`'s
    `Effect.timeoutOrElse({ duration: GIT_TIMEOUT })`.


---
<!-- okf/decisions/physical-ceiling-is-a-separate-static.md -->
---
type: Decision
title: A physical ascend ceiling is a separate static taking an Option, not a realpath mode of stopAt
description: Walker.ascendWithin bounds the upward walk by a symlink-resolved ceiling as its own static, so ascend's R stays Path alone, and takes the ceiling as an Option so a stray undefined cannot request an unbounded walk.
status: stable
tags:
  - architecture
sources:
  - id: walker-source
    resource: ../../packages/walker/src/Walker.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-29T06:16:45Z
  body_sha256: be6b99169429f34acc758c0fe7a6e4386fc9335811974401e0aaa2d15976b89f
verified:
  - by: human:spencer
    at: 2026-09-29T06:17:45Z
---

# A physical ascend ceiling is a separate static taking an Option, not a realpath mode of stopAt

## Context

`Walker.ascend`'s `stopAt` is compared lexically, in resolved form on
both sides ([the ascend ceiling fails
closed](ascend-ceiling-fails-closed.md)). `Git.repoRoot` answers a
**physical** path — git resolves symlinks — so when the start directory
is reached through a symlink (every macOS tmpdir: `/var` is
`/private/var`; any symlinked checkout) the lexical chain never spells
git's root, the ceiling never matches, and the ascent runs to the
filesystem root: the same fail-open class the earlier Decision closed,
through a different door. The need surfaced in the vitest-agent
`git-common-dir` dogfood loop, whose config walk-up is bounded by the git
root.[^walker-source]

## Decision

The physical ceiling is a separate static, `Walker.ascendWithin(start,
ceiling, options?)`, and `ascend` is unchanged. It yields `ascend`'s
lexical chain and changes only the stopping test: the nearest ancestor
whose `realPath` equals the ceiling's `realPath`, inclusive. A ceiling
the chain already spells stops with no I/O; a failed `realPath` probe on
an ancestor is absorbed as "not the ceiling", and an unresolvable ceiling
leaves the lexical answer standing. A present relative ceiling dies, for
the reasons the earlier Decision gives.

The ceiling is an `Option<string>`, not `string | undefined`.
`Option.none()` is exactly `ascend(start)` — the natural answer outside
any repository, spelled `Walker.ascendWithin(start, yield*
Effect.option(git.repoRoot(start)))` — and it is the only way to ask for
an unbounded walk, so an accidentally-undefined ceiling cannot become one.

## Alternatives rejected

- **Make `stopAt` compare by realpath.** Rejected: it adds `FileSystem`
  to `ascend`'s `R`, breaking every caller that provides only `Path` —
  [config-file](../modules/config-file.md)'s resolvers among them — for a
  guarantee only callers holding a physical ceiling need.
- **Take the ceiling as `string | undefined`.** Rejected: a stray
  `undefined` from an unwired lookup would silently request the unbounded
  walk the ceiling exists to prevent.
- **Canonicalize the ceiling in `@effected/git`.** Rejected there for the
  mirror reason: it would add `FileSystem` to `Git.layer`'s `R`. Git
  already returns the physical path; the walker side is where the chain
  meets it.

## Consequences

`AscendOptions.stopAt`'s TSDoc warns that it is lexical and points at
`ascendWithin`; [walker](../modules/walker.md) and
[git](../modules/git.md) state the pairing from both sides. Never fold
the physical test back into `stopAt` without first moving every
`Path`-only caller.

[^walker-source]: `packages/walker/src/Walker.ts` — `ascendWithin` and
    its private `ascendToPhysical`, plus the `AscendOptions.stopAt`
    TSDoc warning.


---
<!-- okf/gotchas/git-config-read-without-scope-is-merged.md -->
---
type: Gotcha
title: A Git config read with no scope is the merged view, not the checkout's own
description: "configGet and configList without a scope answer what git would use, not what this repository declares, so an enumerate-then-remove flow reads wider than configRemoveSection writes; configSet has no scope at all and always writes repository-local."
status: stable
resource: ../../packages/git/src/Git.ts
stale_after: "2027-03-20T00:00:00Z"
tags:
  - dx
sources:
  - id: git-service
    resource: ../../packages/git/src/Git.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 5e4ea3f339ab72ee1f4079acfb6008ffba75d308e02492d2afb66d667768cb2b
---

# A Git config read with no scope is the merged view, not the checkout's own

## What a reader sees

`Git.configList(cwd)` or `Git.configGet(cwd, key)` returns entries the
checkout's `.git/config` does not contain, and a flow that enumerates
sections and then calls `configRemoveSection` on each fails or removes
nothing for some of them.

## What they would wrongly conclude

That the read is wrong, or that `configRemoveSection` is silently
skipping sections.

## What is actually true

Omitting `scope` means the **merged** read — system, global and local
layered the way git itself resolves a key. That is the right answer to
"what is the effective value" and the wrong one to "what does this
checkout declare". `configRemoveSection` and `configSet` write only the
repository's own `.git/config`, so an unscoped enumerate-then-remove flow
reads wider than it writes.[^git-service]

`configGet` and `configList` take an optional `scope` of `local`,
`global`, `system` or `worktree`; `{ scope: "local" }` is the precise
read. `file` and `scope` both select a source and git accepts only one,
so passing both fails typed before any spawn.

`configSet` offers no scope. It emits a bare `git config <key> <value>`
and writes the checkout's own `.git/config`, always: a read has a
defensible "effective value" default, a write does not, and a global or
system write leaks onto a shared machine or a CI runner for every
unrelated step. The asymmetry is deliberate and is stated in the method's
TSDoc because the absence of an option is not self-explaining.

## The check

Reach for `{ scope: "local" }` whenever the question is about this
repository rather than about git's resolved answer, and never expect a
write to reach anything a scoped read did not show.

[^git-service]: `packages/git/src/Git.ts` — `configGet` and `configList`
    annotate the span with `scope: "(merged)"` when none is passed;
    `configSet` builds its argv with no scope flag.


---
<!-- okf/limitations/git-config-set-refuses-dash-leading-values.md -->
---
type: Limitation
title: Git.configSet cannot write a value that begins with a dash
description: "configSet guards key, value and file through the option-injection guard because git config has no documented -- separator, so a legitimate value starting with - is refused typed before any spawn."
status: stable
bounds: ../modules/git.md
tags:
  - security
sources:
  - id: git-service
    resource: ../../packages/git/src/Git.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: fa67ebb7dcbac1d9c0a936349d216a1a88a266daa0ec1271ffc34ed5b9857fe8
---

# Git.configSet cannot write a value that begins with a dash

## Condition

A caller passes `Git.configSet` a `key`, `value` or `options.file` whose
first character is `-`.

## Symptom

The call fails with a `GitCommandError` of `kind: "refused"` before
anything is spawned, reporting the value as `<redacted>`. A config value
that legitimately starts with a dash — a negative number, a flag-shaped
string — cannot be written through this method.[^git-service]

## Why this is acceptable

The option-injection guard exists so that no caller-controlled positional
can be parsed by git as a flag. For the ref-taking members the guard is
narrow because a `--` separator is deliberately not used (it would flip
`checkout` into pathspec mode), but `git config` has no documented `--`
separator at all, so there is no argv position at which a dash-leading
value is safe. Refusing all three string inputs is the only shape that
keeps the guarantee, and a dash-leading config value is rare enough that
closing the injection surface wins.

## What the fix would take

Writing such a value through `GitConfig`'s pure surgical editor on the
file's text and saving it, which involves no argv at all, or a future git
version documenting a separator for `config` that the guard could then
rely on.

[^git-service]: `packages/git/src/Git.ts` — `configSet` routes `key`,
    `value` and `options.file` through `rejectOptionLikeRefs`.


---
<!-- okf/gotchas/git-protocol-file-allow-does-not-reach-submodule-clone.md -->
---
type: Gotcha
title: A repo-local protocol.file.allow does not reach a submodule add's internal clone
description: "git 2.38+ refuses a file:// submodule remote by default; setting protocol.file.allow in the superproject's config looks like the fix but the internal clone subprocess never sees it, so only a command-line -c, the environment, or global config authorizes it."
status: stable
stale_after: "2027-03-20T00:00:00Z"
tags:
  - testing
  - security
sources:
  - id: git-surface-int-test
    resource: ../../packages/git/__test__/integration/GitSurface.int.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 64844684013111be805260ef86118306d932b7bd1e31b0dd466fbbe0b230d3ec
---

# A repo-local protocol.file.allow does not reach a submodule add's internal clone

## What a reader sees

A test or fixture that adds a `file://` submodule fails with git's
transport refusal even though the superproject has `git config
protocol.file.allow always` set.

## What they would wrongly conclude

That the config key is misspelled, that `Git.submoduleAdd` strips the
setting, or that the package should pass an allow flag in its argv.

## What is actually true

git 2.38 and later (CVE-2022-39253) blocks `file://` submodule remotes by
default. A repo-local `protocol.file.allow` on the superproject does
**not** reach `git submodule add`'s internal clone subprocess (verified
against git 2.54); only a command-line `-c`, the environment
(`GIT_ALLOW_PROTOCOL=file`), or global config does. Whether to allow the
file transport is a caller-environment decision, not something `Git`'s
argv enables — nothing `@effected/git` spawns sets it, and it must not,
because the refusal is a security default.[^git-surface-int-test]

## The check

`GitSurface.int.test.ts` sets `process.env.GIT_ALLOW_PROTOCOL = "file"`
at module scope; `Git`'s per-call pins merge over `extendEnv: true`, so
the variable reaches every spawn in that file. The `forks` pool's
per-file process isolation keeps it from leaking into other suites. Copy
that shape for any fixture that needs a local submodule remote; do not
add a config write to the superproject expecting it to work.

[^git-surface-int-test]: `packages/git/__test__/integration/GitSurface.int.test.ts`
    — the module-scope `GIT_ALLOW_PROTOCOL` assignment and the comment
    recording the probe.


---
<!-- okf/gotchas/git-log-follow-drops-merge-commits.md -->
---
type: Gotcha
title: git log --follow is not the unfollowed walk plus more
description: "--follow linearizes history and drops merge commits, so a followed and an unfollowed walk over the same path can have the same length; a test comparing their lengths cannot fail for the right reason."
status: stable
stale_after: "2027-03-20T00:00:00Z"
tags:
  - testing
sources:
  - id: git-surface-int-test
    resource: ../../packages/git/__test__/integration/GitSurface.int.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 4c6fda2e4d1aac27c286fae412fe717d34bc04b802f3dbc734f044c945532dd7
---

# git log --follow is not the unfollowed walk plus more

## What a reader sees

A test asserting that `Git.log(cwd, { paths, follow: true })` returns
more entries than the same call without `follow` passes on one fixture
and fails on another, or passes without exercising the rename at all.

## What they would wrongly conclude

That `--follow` simply extends the walk across the rename, so "more
entries" is the property to pin.

## What is actually true

`--follow` linearizes history and **drops merge commits** (probed against
git 2.54), so the followed walk gains the pre-rename commits and loses the
merges. The two walks can be the same length and only their contents
discriminate; a length comparison is a test that cannot fail for the
right reason.[^git-surface-int-test]

This is why `log` has its own integration fixture. It is the only `Git`
member whose answer depends on the shape of history rather than one tree,
so its fixture carries a rename across the scoped path, an off-pathspec
commit and a real conflicted-then-resolved merge — what makes `--follow`
and `--diff-merges=first-parent` falsifiable at all. A mock spawner can
pin the parser; only real git can tell whether `--follow` walked the
rename.

## The check

Assert on the shas or paths a walk contains, never on how many entries it
has relative to another walk.

[^git-surface-int-test]: `packages/git/__test__/integration/GitSurface.int.test.ts`
    — the fixture C describe block and its history diagram.


---
<!-- okf/conventions/testing-standards.md -->
---
type: Convention
title: Testing standards
description: "@effect/vitest as the default runner, assert.* never expect, memfs as the real filesystem double, and why the oracle for a ported algorithm must be external."
status: stable
stale_after: "2027-03-13T00:00:00Z"
tags:
  - testing
sources:
  - id: semver-comparator-test
    resource: ../../packages/semver/__test__/Comparator.test.ts
  - id: memfs-faultinjection-test
    resource: ../../packages/memfs/__test__/FaultInjection.test.ts
  - id: memfs-fs
    resource: ../../packages/memfs/src/MemoryFileSystem.ts
  - id: claude-md
    resource: ../../CLAUDE.md
generated:
  by: "okfit/claude-code"
  at: 2026-09-30T01:39:09Z
  body_sha256: 0c8fb2856835b9ef2052d58921835a5aa9db3f4fa5b497d093afb478eb482498
---

# Testing standards

- `@effect/vitest`: `it.effect` is the default test mode, providing
  `TestClock` and `TestConsole`; `it.live` only when real `Clock` or
  runtime behavior is genuinely required.[^semver-comparator-test] Never
  plain `it()` + `Effect.runPromise` for routine Effect code.
- Shared setup goes through a top-level `layer(ServiceLayer)((it) => {
  ... })`, built once and memoized, scoped to the group; `it.layer(...)`
  for nested isolation. The anti-pattern is repeating
  `Effect.provide(Layer)` inside each test body — provisioning belongs at
  the boundary, not per test.
- An integration suite over a shared, expensive real-world fixture — a
  temp-dir git repository driven by a real spawner, for instance — may
  use plain `beforeAll`/`afterAll` with `Effect.runPromise` to build and
  tear the fixture down once per file; `@effected/git`'s integration
  suites are the sanctioned example. The per-test `Effect.ensuring`
  pattern remains the default for cheap per-test fixtures.
- `TestClock.adjust` for time control with forked fibers.
- Property-based tests use `it.effect.prop` with FastCheck arbitraries;
  Schema inputs go through `Schema.toArbitrary`, since top-level `it.prop`
  does not support Schema inputs.[^semver-comparator-test]
- `assert.*` for uniform, explicit checks — **never `expect`**.
  `flakyTest` is reserved for genuinely flaky integration conditions, not
  a way to paper over a nondeterministic assertion.
- Tests live in each package's `__test__/` directory per repository
  convention, never co-located in `src/` — unit tests as `*.test.ts`,
  plus `e2e/` and `integration/` subdirectories where a package needs
  them.[^claude-md]

## The filesystem double is a real volume

A test needing `FileSystem` provides `@effected/memfs` as a
devDependency, never a hand-rolled `FileSystem.layerNoop` over a `Map`.
`layerNoop` is deny-by-default — it fails every member the fixture's
author did not think to write — so a stub encodes only the semantics that
author had in mind, and a bug depending on anything else cannot
surface.[^memfs-fs] Swapping hand-rolled stubs for a real volume across
the kit surfaced defects in packages that had been passing tests for
years — the value of a faithful double is the tests it stops passing.

Three rules generalize from that migration:

- **Inject a misbehavior as a fault, not as a stub body.**
  `layerWith(seed, { faults })` delegates every method a handler
  declines, so the fixture survives the code under test growing a new
  call — where a `layerNoop` stub starts failing on any unimplemented
  member instead.[^memfs-faultinjection-test] Then prove the fault is
  load-bearing by disabling it and watching the tests it should break
  actually die; a fault nothing depends on is decoration.
- **A handler that records and returns `undefined` is a spy, not a
  replacement.** It counts the call *and* lets it really happen. The
  mutant such a fixture must kill is precisely the one that swallows a
  write while still counting it — a stub body does not kill that mutant,
  a declining handler does.
- **Assertion timing picks the constructor family.** The `layer*` forms
  re-seed a fresh volume per `Effect.provide`, so they fit tests that
  assert *inside* the effect. The `make*` forms plus `Layer.succeed` pin
  one volume's identity for tests that assert *after* it runs. Used
  backwards, a post-run assertion reads a volume nobody wrote to.

A consumer-supplied sync filesystem port takes a volume too — it does not
require `FileSystem`, only a small structural port from its caller, so
the double for it is `MemoryFileSystem.syncFileSystem(volume)`.

A double that exists to control *timing* rather than to hold bytes is a
different artifact and stays hand-written; `@effected/jsonl`'s watch
harness is the standing example of that exception.

## The oracle for a ported algorithm is external

When an implementation and a remembered constant disagree, neither one
is the oracle — climb to the published intermediates instead. A signing
algorithm ported from a specification should be pinned against the
specification's own documented intermediate values (a canonical-request
hash, a signing-key derivation), not against a remembered end-to-end
example that may belong to a different worked case entirely. Where the
artifact has a published schema, the schema is the oracle: an emitted
document format is validated against its own published JSON Schema,
vendored as a test fixture, rather than against a hand-maintained
approximation of that schema.

**Never pin your own output as the fixture.** A snapshot of what the code
currently emits asserts only that it has not changed, which is the one
property that was never in doubt.

[^semver-comparator-test]: `packages/semver/__test__/Comparator.test.ts`
    — `it.effect` as the default mode and `it.effect.prop` with a
    `Comparator` schema arbitrary.
[^memfs-faultinjection-test]: `packages/memfs/__test__/FaultInjection.test.ts`
    — fault-injection tests over `layerWith` `faults`.
[^memfs-fs]: `packages/memfs/src/MemoryFileSystem.ts:274` — contrasts the
    delegate-by-default fault layers with `FileSystem.layerNoop`'s
    deny-by-default behavior.
[^claude-md]: `CLAUDE.md` §Testing — "tests live in each package's
    `__test__/` directory, never co-located in `src/`."
