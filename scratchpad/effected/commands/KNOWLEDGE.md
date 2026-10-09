# commands — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/commands/CLAUDE.md -->
# @effected/commands

Structured command running and CLI tool discovery over core's
`ChildProcessSpawner`: **run a command and get a typed result** (`Run`), and
**find out whether a tool is here and which copy to use** (`ToolDiscovery`).
Boundary tier; `effect` is the only peer.

Durable knowledge about this package lives in the OKF bundle, not here. Start
at `okf/modules/commands.md` and load what the task needs:

- The package as a whole — the one rule (every subprocess concept is core's,
  and no implementation of one is), tier and dependencies, the module map,
  what `Run` decides, errors, redaction and retry, tool discovery, test
  doubles, observability, consumers → `okf/modules/commands.md` — Load when:
  changing or extending any source module, changing a surface's shape, or
  before adding anything that smells like a `Command` type, a spawner, a
  platform layer, a `node:` import or a shell helper.
- Why `LocalExec` is declared here and implemented by `@effected/workspaces`
  → `okf/decisions/commands-workspaces-edge-inverts.md`,
  `okf/decisions/contract-inversion-default.md` — Load when: tempted to add
  an `@effected/*` edge, or touching `LocalExec`, `ExecContext` or the
  package-manager prefix table.
- `Run.text` corrupts fixed-column output; `npm run` eats flags without a
  `--` → `okf/gotchas/run-text-trims-fixed-columns.md`,
  `okf/gotchas/npm-run-eats-flags.md` — Load when: parsing porcelain-style
  output, or editing a script-runner prefix.
- `collect` must drain stdout, stderr and the exit code concurrently, and
  only the e2e backpressure test can prove it →
  `okf/invariants/collect-drains-both-pipes-concurrently.md` — Load when:
  touching `collectRaw` or anything under `__test__/e2e/`.
- What this package deliberately leaves to `@effected/github-actions`
  (signalling a pid, readiness polling, archives) →
  `okf/limitations/commands-no-process-supervision.md` — Load when: asked
  to add process supervision, a poll helper or a `tar` wrapper here.
- Requiring core services in `R` rather than owning a backend →
  `okf/conventions/require-in-r-default.md`.

## Working here

Tests live in `__test__/` (unit plus `e2e/`): `@effect/vitest`, `it.effect`,
`assert.*` — never `expect`. Unit suites stub the spawner with the public
`src/ScriptedSpawner.ts` double and assert on its spawn log; e2e runs real
`node` through `@effect/platform-node`, which is a **devDependency for e2e
only** — never a dependency or peer.

```bash
pnpm vitest run packages/commands/__test__   # from the repo root, always
pnpm build --filter @effected/commands       # never `node savvy.build.ts`
```

Run vitest from the repo root. From *inside* the package vitest does not load
the root config, so `--project @effected/commands` fails with
`No projects matched the filter` and a positional filter finds no test files.

`savvy.build.ts` carries the narrow `_base` suppression
(`{ messageId: "ae-forgotten-export", pattern: "_base" }`) for the
synthesized class-factory bases; a clean prod `issues.json` has 0 warnings,
0 errors. **Never widen it** — a genuine `ae-unresolved-link` is fixed by
spelling schema-declared fields and shape-interface members in backticks,
not suppressed.


---
<!-- okf/modules/commands.md -->
---
type: Module
title: "@effected/commands"
description: The kit's tool-and-output layer over core's subprocess contract — structured running and CLI tool discovery.
status: stable
kind: package
resource: ../../packages/commands
tags: [bundle, dx]
sources:
  - id: scripted-spawner
    resource: ../../packages/commands/src/ScriptedSpawner.ts
  - id: scripted-spawner-test
    resource: ../../packages/commands/__test__/ScriptedSpawner.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-28T18:00:23Z
  body_sha256: 2e14f18a97026241df8e32e8ad4ba2282490fe8b460b5d059b056f95877c0132
---

# @effected/commands

`@effected/commands` is the kit's tool-and-output layer over core's
subprocess contract. It owns two concerns every consumer repository had
re-invented:

- **Structured running** (`Run`) — take a core `ChildProcess.Command`, run
  it to completion, and get a typed result: collected stdout/stderr/exit
  code, trimmed text, lines, schema-decoded JSON, a boolean probe, or a
  stream — with a non-zero exit as a typed error where that is the right
  reading, an optional timeout, an optional live tee, and secrets redacted
  out of both the error and the captured output.
- **Tool discovery** (`ToolDiscovery`) — is this tool available here,
  globally on `PATH` or project-locally through the package manager's
  exec, what version is each, and which copy should run?

The two are one package because `ToolDiscovery` is `Run`'s first consumer:
discovery is a spawn plus a classification, and splitting them would put a
probe on one side of a package boundary and the runner it probes with on
the other. `Redaction` and `Retry` are policies `Run` applies or hands to a
caller, and `LocalExec` is the seam discovery resolves through — every
module in the package is on the same dependency chain.

The package is designed against core's `effect/process`
vocabulary, never around it: a caller builds a `ChildProcess.Command` with
core's own constructors and combinators and hands it here to be run.

## The one rule

**Every subprocess concept in this package is core's, and no
implementation of one is.** The only new vocabulary is the *outcome*
(collected output, typed failure), the *policy* (timeout, redaction,
transience), and the *tool* (discovery, version, source).

This rule is stated sharply because it has two failure modes and the
second is subtle. Inventing a parallel `Command` / `CommandRunner` /
`CommandSpawnError` vocabulary is the obvious one; implementing core's
contract — porting a platform spawner backend in here — is the one that
still looks correct, because a package can speak core's types faithfully
and be wrong by supplying them. Concretely, never add: a `Command` type, a
service wrapping `ChildProcessSpawner`, a spawner backend, a platform
layer, a `node:child_process` import, or a shell helper. `Run` is free
functions, not a service, for exactly this reason — core's spawner *is*
the runner service.

A previous `@effected/commands` was deleted for violating this rule twice:
first by inventing `Command`/`CommandRunner`/`CommandSpawnError`, then by
deleting that and porting `@effect/platform-node-shared`'s spawner
directly into the package. The second attempt is the subtle one, and the
reason the rule is phrased to cover implementation as well as invention.

## Tier and dependencies

**Boundary tier**, and it stays there only because the workspaces edge
inverts — see
[contract inversion is the default answer to a tier-dragging edge](../decisions/contract-inversion-default.md)
and [the commands-specific rationale](../decisions/commands-workspaces-edge-inverts.md).

- `effect` is the only peer. Zero runtime dependencies, zero
  `@effected/*` edges, zero `node:` imports anywhere in `src/`.
- IO arrives through `R`: core's `ChildProcessSpawner` for every run,
  core's `Stdio` for the teeing variant only.
- `@effect/platform-node` is a devDependency for the e2e suite only —
  never a dependency or peer.

## The workspaces edge inverts

`ToolDiscovery`'s local resolution needs to know how to run a
project-local binary (`pnpm exec`, `npx --no --`, `yarn exec`, `bun x
--no-install`), which means knowing the workspace root and the package
manager — both `@effected/workspaces`' knowledge, and `workspaces` is
integrated tier. Taking that edge directly would drag this package to
integrated, and through the `@effected/npm` → `commands` edge would drag
`npm`, `lockfiles` (pure) and `package-json` up a tier with it — four
packages, including a pure one.

So the contract inverts: `commands` declares `LocalExec` in
`packages/commands/src/LocalExec.ts` and requires it in `R`;
`@effected/workspaces` ships the layer that implements it. The contract is
deliberately smaller than "the workspaces surface" — it is an argv prefix
and a directory (`ExecContext`), not a workspace model.

- **`commands` never touches a path or an ambient `cwd`.** The whole
  question moves behind the contract.
- **The prefix table lives here, once.** `LocalExec.prefixes(launcher)` is
  the single home of the four package managers' argv — `exec`, `dlx` and
  script-runner prefixes. `scriptPrefix` is a required `ExecContext`
  field: an optional one would hand every implementation the question
  "what does absent mean?", which an execution context has no honest
  answer to. npm's script prefix carries a trailing `--`
  (`["npm", "run", "--"]`), live-probed: bare `npm run <script> --flag`
  silently claims the flag for npm itself, while the other three managers
  forward post-script arguments without help — see
  [npm run eats a flag meant for the script](../gotchas/npm-run-eats-flags.md).
- **A consumer with no monorepo pays nothing.** A single-package checkout
  wires `LocalExec.layerNone` or `LocalExec.layerFor("npm")` and never
  installs `@effected/workspaces`.

The graph stays acyclic by construction: `workspaces` takes the edge on
`commands`, and `commands` has no `@effected/*` edges at all.

## Module map

Module-per-concept, no barrels; `src/index.ts` re-exports only. See
`packages/commands/src/`:

| Module | Owns |
| --- | --- |
| `Run.ts` | the structured run combinators, `CommandOutput`, `CommandFailedError`, `CommandOutputError` |
| `Redaction.ts` | value-based secret scrubbing plus the secret-flag heuristic backstop |
| `Retry.ts` | transience classification and the retry policy — vocabulary for `Effect.retry`, not a retrying runner |
| `LocalExec.ts` | the inverted contract: `LocalExec`, `ExecContext`, `LocalExecError`, the prefix table, the layers |
| `Tool.ts` | `Tool`, the `VersionProbe` union, the `ToolSource` / `MismatchPolicy` literals |
| `ToolDiscovery.ts` | the service and its layer, `ResolvedTool`, the tool errors, the evidence cache |
| `ScriptedSpawner.ts` | the public scripted `ChildProcessSpawner` double |
| `internal/capture.ts` | bounded stream capture; not exported |

`Run`, `Redaction` and `Retry` are static classes with a private
constructor, not `as const` namespace objects: an object literal's member
types are inferred in the built `.d.ts` and lose their TSDoc entirely,
while a class's `static readonly` declarations keep it.

## What `Run` decides

- **`RunOptions` carries only what a core `Command` cannot.** `cwd`,
  `env`, `extendEnv`, `stdin`, `shell`, kill signals and fd wiring are all
  `ChildProcess.CommandOptions` fields with core combinators; duplicating
  them here is exactly the re-declaration the one rule forbids. What is
  left is genuinely ours: a deadline (no default — an install and a
  `rev-parse` cannot share one), a redaction set, and a capture bound.
- **`Run.extendEnv` exists because core's `setEnv` is a trap.** `setEnv`
  merges into `options.env` but never sets `extendEnv`, and the Node
  spawner resolves the child environment as `extendEnv ? { ...process.env,
  ...env } : env` — so a command built with a bare `setEnv({ VAR: x })`
  spawns a child whose entire environment is that one variable: no
  `PATH`, no `HOME`, silent at the type level. `Run.extendEnv` merges like
  `setEnv` and forces `extendEnv: true` even over a construction-time
  `false`, because inheriting the parent environment is its whole
  purpose; a hermetic environment is what bare `setEnv` remains for. A
  unit control pins core's own `setEnv` behaviour so a beta that changes
  it fails loudly.
- **A non-zero exit is a result for `collect`, `exitCode`, `succeeds` and
  `jsonLine`, and a typed failure for `text`, `lines` and `json`.** The
  split is deliberate. The interpreting helpers also trim — `Run.text`
  trims the whole result, which silently corrupts fixed-column output
  whose first column can be whitespace (`git status --porcelain` is the
  canonical case) — see
  [`Run.text`'s trim silently corrupts fixed-column output](../gotchas/run-text-trims-fixed-columns.md).
  Parse that from `collect`'s untrimmed `stdout` instead.
- **Collection is concurrent, and that is load-bearing.** `collect` reads
  stdout, stderr and the exit code under `{ concurrency: "unbounded" }`:
  sequential collection deadlocks the moment either OS pipe buffer fills,
  because the child blocks writing to a full pipe while the reader that
  would drain it waits on the other stream. A mock spawner over
  in-memory streams cannot reproduce it, and pressure on one stream
  alone does not discriminate, which is why the e2e backpressure test in
  `packages/commands/__test__/e2e/Run.e2e.test.ts` is not optional — see
  [`Run.collect` drains both pipes concurrently](../invariants/collect-drains-both-pipes-concurrently.md).
- **Teeing is a separate combinator, not an option.** Only `collectTee`
  requires core `Stdio` in `R`, and an option cannot vary the `R`
  channel — a boolean would tax every plain `collect` caller with a
  requirement it never uses.
- **Capture is bounded.** Unbounded collection of a child's output is a
  memory-exhaustion vector, so an overflow fails typed as
  `CommandOutputError` rather than dying. Genuinely large output is
  `Run.stream`'s job.
- **`Run.collect` is the kit's one spawn-and-collect implementation, and
  it is public on purpose.** A consumer needing `@effected/git`-shaped
  discipline for a command `Git` does not model composes `Run.collect`
  rather than re-deriving the triple-collect; `@effected/git`'s own
  private internal runner is deliberately parallel, not a second
  sanctioned copy.

### `Run.jsonLine` is framing, not a lenient `Run.json`

`json` parses the whole of stdout and requires a zero exit, which is right
for a child that prints a document and wrong for a child that talks a
protocol. `jsonLine` scans stdout lines from the end and takes the first
that both parses and decodes under the schema, so a child's own logging is
tolerated on both sides of the payload — including a line written from an
exit hook after the payload flushed.

If multiple lines decode, the last wins, so a child must not emit two
schema-valid lines and a consumer's envelope should be discriminated (a
required `ok` literal). It parses regardless of the exit code, because a
protocol payload discriminates success in-band and therefore outranks the
code. When nothing decodes anywhere, the typed `CommandOutputError` carries
the run's context — exit code and both redacted streams — with `kind:
"schema"` plus the last parseable line's decode failure when at least one
line was JSON, and `"notJson"` only when none was.
`@effected/workspaces`' `ConfigDependencyHooks.layerSubprocess` is the
in-kit consumer; do not hand-roll last-line parsing at a call site.

### `Run.detach` encodes an ordering invariant

Core can already spawn a child that outlives its parent.
`CommandOptions.detached` defaults to `true` off Windows, and the Node
backend's `acquireRelease` release checks an `isReferenced` flag and skips
the kill for an unref'd child. So `detach` is spawn → `unref` → pid, and
the ordering *is* the point: reversed, the child dies with the scope. An
e2e pair pins it both ways, because the survival half alone would pass
even if scope close never killed anything.

Two halves of a detached child's lifecycle are deliberately not here:
signalling a bare pid later (no handle survives an Actions `main` → `post`
boundary, and it needs `node:process.kill`, which a boundary package may
not import) and routing a detached child's output to a log file (core's
`CommandOptions` accepts only `"pipe" | "inherit" | "ignore" |
"overlapped" | Sink`, and the Node backend maps a `Sink` to `"pipe"`,
defeating detachment — a recorded upstream gap). Both belong to
`@effected/github-actions`, which is licensed for `node:` imports.

## Errors

Two, both structurally routable — see `packages/commands/src/Run.ts`.
`CommandFailedError` carries `kind: "nonZero" | "spawn" | "timeout"` plus
the command and its redacted argv, with ergonomic statics filling the rest
from the `Command` value the caller already has. `CommandOutputError`
carries `kind: "notJson" | "schema" | "tooLarge"`, and the combinators that
parse independently of the exit code also populate the run's exit code and
both streams, stored redacted, so a bad payload is diagnosable without
re-running the child.

There is no `reason: string` — a prose field invites consumers to match
substrings on it, so `kind` plus structured fields carry the routing and
`message` stays a rendering, never a routing surface. `message` is
tail-truncated, because npm writes warnings first and the real error last.
`stdout` is carried alongside `stderr`, for the same reason: npm routes
real errors to stdout often enough that dropping it hid causes.

An opted-in timeout is absorbed into `CommandFailedError { kind: "timeout"
}` rather than surfacing core's `Cause.TimeoutError`, the same absorption
`@effected/git` performs so consumers only ever see one taxonomy.

## Redaction and retry

`Redaction` is value-based first: the caller already holds its secrets as
`Redacted`, passes them in `RunOptions.redact`, and `Run` scrubs them from
argv and from captured stdout/stderr before either reaches an error. The
flag heuristic (`--token <v>` and friends) stays on by default as a
backstop for secrets a caller forgot to declare — it is guesswork on its
own, since it protects `--token <v>` and misses `--registry-key=<v>`.

`Retry` is vocabulary, not a retrying runner: core's `Effect.retry` already
takes `{ while, schedule, times }`, and what was missing was the
classifier. `isTransient` and the exported pattern list let a consumer
extend rather than fork, and `Retry.transient()` is a ready-made options
bag. A caller needing a reset between attempts composes that itself — a
reset is domain logic and does not belong in a retry policy.

## Tool discovery

`ToolDiscovery.resolve(tool)` answers with a `ResolvedTool` naming the
source it chose, the versions it saw, and whether they disagree; the
policy (`source`, `onMismatch`) is the caller's.

- **No shell, ever.** Probing availability by interpolating a tool name
  into `sh -c "command -v <name>"` is an injection hazard and broken on
  Windows. Absence is a spawn failure, never an exit code: the probe
  spawns the tool itself with its version flag, a `PlatformError` whose
  `reason._tag` is `"NotFound"` means absent, and any completed run means
  present. A tool whose `--version` exits 1 exists.
- **Option-injection guard.** A tool name that is empty or begins with
  `-` is refused before any spawn, typed as its own `ToolRefusedError` —
  not `ToolNotFoundError`, which carries a `searched` list a refusal has
  no answer for.
- **The cache holds evidence, not answers.** The cached value is the
  probe outcome, keyed by `(name, version probe)` as a `Schema.Class`
  whose structural `Equal`/`Hash` the cache uses directly, and policy is
  applied per call — caching resolved values by name alone would let a
  second `Tool` with different constraints silently inherit the first
  caller's policy decision.
- **Core `Cache`, not a bare `Ref`,** for in-flight de-duplication: two
  fibers resolving one tool concurrently produce one probe. Core `Cache`
  does not share `Effect.cached`'s interrupt-poisoning property, but it
  does memoize failures for the entry's TTL, which is why the
  `timeToLive` function is load-bearing.
- **Only a positive result is memoized forever.** "Not found" is a
  successful lookup carrying negative evidence, and memoizing it would
  make a tool installed mid-process — an action that provisions a runtime
  and then uses it — permanently absent.

## Test doubles

`ToolDiscovery.makeTest` / `layerTest` follow the kit convention: every
unstubbed member dies naming itself, because a fabricated `ResolvedTool`
would leak into consumer logic as fact. `LocalExec.makeTest` deliberately
does not, and that is a recorded exception: its one member has a correct
real answer for the unstubbed case (`Option.none()` *is* the global-only
wiring, not a fabrication). The test for whether a default is admissible is
"would a real implementation legitimately answer this?", never "is it
convenient".

`ScriptedSpawner` is a public scripted double of core's
`ChildProcessSpawner` — `make(script)` returns a layer plus the spawn log,
with statics building the two common spawn-failure `PlatformError`s. It is
not an exception to the one rule: it implements nothing for production, it
*provides* core's own contract from a caller's script, the test-side
analogue of `makeTest` on a service. The spawn log records whether `unref`
actually ran, which is what lets a consumer test pin `Run.detach`'s
ordering. Every recorder is `Effect.suspend` / `Effect.sync`-wrapped, so
a spawn is logged when the effect *runs*, never when it is merely
constructed — an eager recorder would report calls that never happened,
and the double's own suite pins the distinction along with the `unref`
flag.[^scripted-spawner][^scripted-spawner-test] Standard commands only —
a piped command reaching it dies loudly naming the workaround, because
scripting a pipeline honestly means modeling core's `PipeOptions` routing
and dying beats a silently wrong answer.

## What this package deliberately does not do

- **No `Command` type and no runner service.** Core declares both;
  `ResolvedTool.command(...)` returns a core `Command` and `Run` is free
  functions over it.
- **No spawner backend, no platform layer, no shell helper.** A
  misbehaving backend is fixed upstream, not shimmed here; a consumer
  running a configured command string builds `ChildProcess.make("sh",
  ["-c", str])` itself and owns the injection surface.
- **No package-manager detection, no PATH or `which` implementation.**
  The first is inverted to `LocalExec`; the second is unnecessary, because
  probing by spawn answers the only question asked without a filesystem
  scan, `PATHEXT` handling or a `FileSystem` requirement.
- **No process supervision, no readiness polling.** `detach` hands back a
  pid and stops. The reap half and the poll-until-predicate helper are
  `@effected/github-actions`'.
- **No archive helper.** An honest archive API is not a `tar` wrapper — it
  has to answer determinism (mtimes, uid/gid, entry order), `bsdtar`
  -versus-GNU flag divergence and whether extraction is in scope — so
  shipping one here would sink that design into the wrong package.
- **No ambient `cwd`, no `process.env` reads, no `node:` imports.**
- **Version constraints on a `Tool` stay deferred.** The hazard is
  asymmetric: refusing a tool that works because `tar (GNU tar) 1.35` is
  not a bare semver is worse than not checking at all.

See also
[the workspaces edge inverts rather than dragging four packages integrated](../decisions/commands-workspaces-edge-inverts.md)
and
[the limitations this package deliberately does not lift](../limitations/commands-no-process-supervision.md).

## Observability

Named `Effect.fn` spans on every public fallible boundary, stable
identifiers only in annotations — the executable name, argc, the resulting
exit code, the tool name and resolved source — and never argv values and
never captured output, since argv is where secrets appear. No metrics: a
library should not decide cardinality for the consumer paying the bill. No
logging inside the combinators.

## Testing

`@effect/vitest`, `it.effect`, `assert.*` — never `expect`; tests in
`__test__/`, e2e under `__test__/e2e/`.

- Unit suites stub core's spawner with the public `ScriptedSpawner`, which
  is why the double is itself directly tested: it is load-bearing
  machinery for every suite here and downstream. The spawn log is what
  makes "cached", "concurrent resolves share one probe" and "the guard
  refuses before any spawn" real assertions about probe counts rather
  than plausible ones.
- Redaction gets a property test, not examples: no rendered message, no
  `args` array and no captured stream ever contains a secret's value.
- e2e runs real processes through `@effect/platform-node`: the ENOENT →
  `NotFound` mapping the whole absence classification rests on, the
  dual-stream backpressure deadlock, and `detach` surviving its scope both
  ways.
- Run vitest from the repo root. From inside the package vitest does not load
  the root config, so a project-filtered run fails at startup with
  `No projects matched the filter` (exit 1).

Build through `pnpm build --filter @effected/commands`, never the raw
script. `savvy.build.ts` carries the narrow `_base` suppression for the
synthesized class-factory bases; never widen it. A genuine
`ae-unresolved-link` warning is fixed, not suppressed: a schema-declared
field and a shape-interface member are not `{@link}` targets, so spell them
in backticks.

## Consumers

- **`@effected/workspaces`** — implements `LocalExec` and takes the only
  inbound edge; also a `Run` caller, since
  `ConfigDependencyHooks.layerSubprocess` runs its replay child through
  `Run.jsonLine`.
- **`@effected/npm`** — `PackagePublish` runs `npm publish` through `Run`,
  with the publish token in `RunOptions.redact`.
- **`@effected/github-actions`** — the general-purpose runner behind
  action work, plus the owner of the two lifecycle halves this package
  declines.

[^scripted-spawner]: `packages/commands/src/ScriptedSpawner.ts` — the
    module comment on lazy recorders, and the `unref: Effect.sync(...)`
    that flips the record's `unrefed` flag only when it runs.
[^scripted-spawner-test]: `packages/commands/__test__/ScriptedSpawner.test.ts`
    — "records spawns in call order, only when the effect actually runs"
    and "unrefed flips only when the handle's unref actually RUNS".


---
<!-- okf/decisions/commands-workspaces-edge-inverts.md -->
---
type: Decision
title: "commands' workspaces edge inverts rather than dragging four packages integrated"
description: Why @effected/commands declares LocalExec instead of depending on @effected/workspaces directly.
status: draft
tags: [bundle, architecture]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 3016bd9c75b8daf44d61d79804e95461a97f0390cc5f50d410e5efa9c4ee36c5
---

# commands' workspaces edge inverts rather than dragging four packages integrated

## Context

`ToolDiscovery`'s local resolution needs to know how to run a
project-local binary — `pnpm exec`, `npx --no --`, `yarn exec`, `bun x
--no-install` — which means knowing the workspace root and the package
manager. Both of those are `@effected/workspaces`' knowledge, and
`workspaces` is integrated tier.

## Decision

`@effected/commands` declares a narrow `LocalExec` contract in
`packages/commands/src/LocalExec.ts` and requires it in `R`;
`@effected/workspaces` ships the layer that implements it, per the kit's
[general contract-inversion pattern](contract-inversion-default.md). The
contract is deliberately smaller than "the workspaces surface" — an argv
prefix plus a directory (`ExecContext`), not a workspace model.
`LocalExec.prefixes(launcher)` is the single home of the four package
managers' argv (`exec`, `dlx`, script-runner prefixes), so neither package
reimplements the other's knowledge, and `scriptPrefix` is a required
`ExecContext` field rather than an optional one an implementation could
forget.

## Alternatives rejected

- **A direct dependency edge from `commands` to `workspaces`.** Taking
  that edge directly would drag `commands` to integrated tier under the
  kit's dependency policy, and through the `@effected/npm` → `commands`
  edge it would drag `npm`, `lockfiles` (pure tier) and `package-json` up
  a tier with it — four packages, including a pure one, plus pnpm's
  catalog engine, in the tree of anyone who merely wanted to check whether
  `tar` exists.
- **Folding tool discovery into `@effected/workspaces` itself.** Rejected
  because discovery's natural home is beside the runner it probes with
  (`Run`), and a consumer wanting only process-running and discovery
  should not have to take the entire workspace-discovery-and-graph engine
  to get it.

## Consequences

`commands` never touches a path or an ambient `cwd` — that whole question
moves behind the `LocalExec` contract, landing in the package that already
has a policy for it, or in the application at its edge. A consumer with no
monorepo pays nothing: a single-package checkout wires `LocalExec.
layerNone` or `LocalExec.layerFor("npm")` and never installs
`@effected/workspaces`. The dependency graph stays acyclic by construction:
`workspaces` takes the edge on `commands`, and `commands` has no
`@effected/*` edges at all.


---
<!-- okf/decisions/contract-inversion-default.md -->
---
type: Decision
title: Contract inversion is the default answer to a tier-dragging edge
description: When package A needs behaviour only package B can implement, A declares the narrow contract and B ships the layer implementing it, rather than A taking a direct dependency edge on B — the pattern now runs three times across the kit.
status: draft
tags:
  - architecture
sources:
  - id: npm-index
    resource: ../../packages/npm/src/index.ts
  - id: commands-local-exec
    resource: ../../packages/commands/src/LocalExec.ts
  - id: sbom-identity-token
    resource: ../../packages/sbom/src/IdentityToken.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 4a5c0ef34e155a7b54dfa9687645912d059b5754a5614ef3baae8356a423247d
---

# Contract inversion is the default answer to a tier-dragging edge

## Context

A package sometimes needs behaviour that only a heavier, later-tiered
package can actually provide — dependency resolution against a real
workspace, a locally installed tool runner, a live OIDC token issuer. The
naive fix is a direct dependency edge from the package that needs the
behaviour to the package that can supply it. That edge tags along the
dependency policy's tier-propagation rule: any package depending on an
integrated-tier package becomes integrated itself, and every dependent of
*that* package inherits the same widening.

## Decision

The kit's standing default is **contract inversion**: the package that
needs the behaviour (`A`) declares a narrow contract describing exactly
what it needs, and the package that can actually implement it (`B`)
ships the layer satisfying that contract. `A` never takes a dependency
edge on `B`; `B` depends on `A` instead, to implement `A`'s interface.
This pattern now runs three times across the kit:

- `@effected/npm` declares the `CatalogResolver` and `WorkspaceResolver`
  contracts;[^npm-index] `@effected/workspaces` ships the layers
  implementing them, because catalog resolution needs
  `pnpm-workspace.yaml` plus the lockfile, and workspace-version
  resolution needs the discovered package list — both things only
  `workspaces` actually has.
- `@effected/commands` declares the `LocalExec` contract;[^commands-local-exec]
  `@effected/workspaces` ships that layer too, for the same reason: only
  `workspaces` knows how to resolve a locally installed tool inside a
  discovered monorepo.
- `@effected/sbom` declares the `IdentityToken` contract;[^sbom-identity-token]
  `@effected/github-actions` ships the layer that implements it against a
  live OIDC token issuer, because only the Actions runtime has a runner
  to ask.

## Alternatives rejected

- **A direct dependency edge from the needing package to the
  implementing package** (`npm` → `workspaces`, `commands` → `workspaces`,
  `sbom` → `github-actions`). Rejected in each case because it would
  propagate the implementing package's tier under the dependency policy's
  R2 rule — `workspaces` is integrated, so a direct edge from `commands`
  would have made `commands` integrated too, and would have dragged a
  pure package (`lockfiles`) and a boundary package (`package-json`)
  integrated behind it through their own edges into `commands`.
- **Merging the contract and the implementation into one package.**
  Rejected because the contract's natural home is beside the package that
  needs it and whose API surface it belongs to — a consumer wanting only
  `npm`'s dependency-resolution vocabulary should not have to take
  `workspaces`' entire discovery-and-graph engine to get it.

## Consequences

Contract inversion keeps the low-tier package's dependency surface
narrow — a pure or boundary package presents a clean interface without
importing the integrated package that eventually satisfies it — at the
cost of an extra indirection a reader has to trace: finding out that
`LocalExec` is actually implemented by `workspaces` means reading
`commands`' own documentation or module layout, not just its
`package.json`. Any future tier-dragging edge in the kit is expected to
resolve the same way: declare the contract at the lower tier, implement
it at the higher one, never invert that.

[^npm-index]: `packages/npm/src/index.ts:17-18,21,106` — `CatalogResolver`
    and `WorkspaceResolver` exported as contracts from `@effected/npm`,
    implemented elsewhere.
[^commands-local-exec]: `packages/commands/src/LocalExec.ts:13` — "the
    `@effected/workspaces` contributes, through `LocalExec`" — the
    contract `commands` declares and `workspaces` implements.
[^sbom-identity-token]: `packages/sbom/src/IdentityToken.ts:13-14` — "…
    implements it (`ActionsIdentityToken.layer`, over its
    `OidcTokenIssuer`), and a consumer already holding a token uses
    `IdentityToken.layerStatic`" — the contract `sbom` declares and
    `github-actions` implements.


---
<!-- okf/gotchas/run-text-trims-fixed-columns.md -->
---
type: Gotcha
title: Run.text trims output that depends on fixed columns
description: Run.text trims the whole captured result, which silently corrupts a command's output whenever its meaning depends on a leading column of whitespace, such as git status --porcelain.
status: stable
resource: ../../packages/commands/src/Run.ts
stale_after: "2027-03-13T00:00:00Z"
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 06d54d9d910e41882f3fb390a199ff59aa08120f0a3124f2af6c6b8392abcbb1
---

# Run.text trims output that depends on fixed columns

## What a reader sees

A command run through `Run.text` — for example `git status --porcelain`
— returns a string that parses incorrectly: a status code that should
occupy a specific leading column looks shifted, or an expected leading
space is simply gone.

## What they would wrongly conclude

That the underlying command produced different output than expected, or
that the parsing logic reading the result is buggy, rather than suspecting
the helper that captured the output in the first place.

## What is actually true

`Run.text` trims the entire captured result before returning it. That is
deliberate for the common case — trailing newlines and incidental leading
whitespace are noise for most command output — but it silently corrupts
any output whose meaning depends on fixed-column formatting, most
canonically `git status --porcelain`, whose first column can legitimately
be a space that means something (an unmodified index state, in porcelain
format) and gets stripped along with everything else `Run.text` decides is
whitespace to discard.

## The check

Never parse fixed-column command output — porcelain-style status lines,
anything documented as depending on column position — from `Run.text`.
Use `Run.collect` instead and read `stdout` untrimmed, since `collect`
returns a result rather than committing to any particular trimming
policy.[^run-text]

[^run-text]: `packages/commands/src/Run.ts:343-348` — `Run.text`'s
    implementation trims `checked.stdout` unconditionally as its return
    value; `collect`'s untrimmed `stdout` is the escape hatch.


---
<!-- okf/gotchas/npm-run-eats-flags.md -->
---
type: Gotcha
title: npm run silently claims flags meant for the script
description: "`npm run <script> --flag` delivers nothing to the script itself — npm claims the flag for its own argument parsing — while pnpm, yarn and bun all forward post-script arguments without any extra syntax."
status: stable
resource: ../../packages/commands/src/LocalExec.ts
stale_after: "2027-03-13T00:00:00Z"
tags:
  - dx
  - compat
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 7aba7384e283f656889b8d344182f78fb872df37f7b41414eaec2ee762b0b44e
---

# npm run silently claims flags meant for the script

## What a reader sees

Code that runs a package-manager script with an appended flag —
`npm run build --watch`, say — across multiple package managers, expecting
the flag to reach the script the same way in every case.

## What they would wrongly conclude

That the flag reaches the script consistently regardless of which package
manager ran it, since the invocation reads identically apart from the
manager name.

## What is actually true

npm's argument handling is the odd one out among the four major package
managers: bare `npm run <script> --flag` silently claims `--flag` for
npm's own argument parsing rather than forwarding it to the script, with
no error and no warning that the flag went missing. This was confirmed by
a live probe against npm 11: `npm run args --flag` delivers nothing extra
to the script, while `npm run -- args --flag` correctly delivers `--flag`
to it. pnpm, yarn and bun all forward post-script arguments to the
underlying script without needing any extra separator.

## The check

When building a script invocation that must work uniformly across package
managers, use each manager's own script prefix rather than a hand-written
one — npm's carries a mandatory trailing `--` (`["npm", "run", "--"]`)
specifically to defeat this behavior, while the other three do not need
it.[^local-exec] Never assume a flag appended after an `npm run <script>`
invocation reaches the script without verifying the `--` separator is
present.

[^local-exec]: `packages/commands/src/LocalExec.ts:41-56,191-196` — the
    prefix table's comment documents the live probe result, and
    `scriptPrefix` is a required `ExecContext` field specifically so no
    implementation can supply an "obvious" default that gets this wrong.


---
<!-- okf/invariants/collect-drains-both-pipes-concurrently.md -->
---
type: Invariant
title: Run.collect drains stdout, stderr and the exit code concurrently
description: "@effected/commands' collectRaw reads a child's stdout, stderr and exit code under { concurrency: \"unbounded\" }; sequential collection deadlocks once either OS pipe buffer fills, and only an e2e test with pressure on both pipes at once can detect the regression."
status: stable
resource: ../../packages/commands/__test__/e2e/Run.e2e.test.ts
tags:
  - testing
sources:
  - id: run-collect-raw
    resource: ../../packages/commands/src/Run.ts
  - id: run-e2e-backpressure
    resource: ../../packages/commands/__test__/e2e/Run.e2e.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 096bab8ff379cbfb0950990338b7bef180e9323b3588cb1ccb176b39141edd12
---

# Run.collect drains stdout, stderr and the exit code concurrently

## The property

Every [`@effected/commands`](../modules/commands.md) `Run` combinator
that collects a child's output — `collect`,
`collectTee`, and the `text` / `lines` / `json` / `jsonLine` / `exitCode` /
`succeeds` family built on them — reads stdout, stderr and the exit code
**at the same time**, never one after another. A child that writes more
than one OS pipe buffer to each stream completes and its output is
captured in full.

## Why it must hold

Sequential collection deadlocks the moment either pipe buffer fills: the
child blocks writing to a full pipe while the reader that would drain it
is still waiting on the other stream, and the exit code never arrives
because the child never exits. The failure is silent — a hang, not an
error — and it only appears for children with enough output on both
streams, so it escapes small-fixture tests and surfaces in production
against a chatty `npm install` or `git fetch`.

## The mechanism

`collectRaw` in `packages/commands/src/Run.ts` runs the three reads under
`{ concurrency: "unbounded" }`, with a source comment naming the option as
load-bearing rather than stylistic.[^run-collect-raw]

The property is pinned by the e2e backpressure test in
`packages/commands/__test__/e2e/Run.e2e.test.ts`, which spawns a real
`node` child that writes 1 MiB to stdout, 1 MiB to stderr, and then the
same again, and asserts both captured streams total 2 MiB with exit code
0. If the concurrency option is ever relaxed, the test hangs to its
30-second timeout instead of failing fast.[^run-e2e-backpressure]

Two things about the test are not negotiable:

- **It has to be e2e.** A scripted spawner over in-memory streams has no
  pipe buffer and cannot reproduce the deadlock, so the unit suites
  cannot stand in for it.
- **The pressure has to be on both pipes at once.** Large output on one
  stream alone does not discriminate sequential from concurrent
  collection — the sequential reader drains that stream to completion,
  then reads the quiet one, and passes.

## What would break it

Rewriting `collectRaw` to read stdout, then stderr, then the exit code
(or to any `concurrency` below 3), or deleting the e2e backpressure test —
after which the deadlock would return unobserved. Neither change is
acceptable; a refactor that needs to touch the collection order must keep
the test green under a real platform layer.

[^run-collect-raw]: `packages/commands/src/Run.ts` — `collectRaw`'s
    `Effect.all(..., { concurrency: "unbounded" })` over the stdout,
    stderr and exit-code reads, with the comment that the option is
    load-bearing.
[^run-e2e-backpressure]: `packages/commands/__test__/e2e/Run.e2e.test.ts`
    — "collect drains stdout and stderr concurrently under simultaneous
    backpressure on BOTH pipes", the 30 s-timeout test whose header
    comment says do not delete it.


---
<!-- okf/limitations/commands-no-process-supervision.md -->
---
type: Limitation
title: "@effected/commands does not supervise or archive processes"
description: Reap-after-detach, readiness polling, and archive helpers are deliberately absent, and stay a level up.
status: stable
bounds: ../modules/commands.md
tags: [bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: d0c735290241fa38dec255c5118816939af61c313421c352bcec422fc3b62e5a
---

# @effected/commands does not supervise or archive processes

## The condition

A consumer wants to signal a detached process after the fact, poll a
long-running process until it becomes ready, or extract/create an archive
(tarball or similar) as part of a command pipeline.

## The symptom

None of this exists in `@effected/commands`. `Run.detach` hands back a pid
and stops — it does not signal that pid again later, and it does not poll
anything to readiness. There is no archive helper of any kind.

## Why this is acceptable

Signalling a bare pid later needs `node:process.kill`, which a boundary
package may not import, and no handle survives an Actions `main` → `post`
process boundary anyway — the pid is genuinely all that can cross it. The
reap half and the poll-until-predicate helper both belong to
`@effected/github-actions`, which is licensed for `node:` imports and
already owns the phase-boundary machinery that motivates them.

An honest archive API is not a thin `tar` wrapper: it has to answer
determinism (mtimes, uid/gid, entry order), `bsdtar`-versus-GNU flag
divergence, and whether extraction is in scope, and shipping a
half-answer here would sink that design into the wrong package. The
trigger to revisit is a second consumer needing archives, or an
attestation pipeline needing byte-reproducible artifacts — at that point
it is a new package (`@effected/archive`), built on this one, not a bolt-on
here.

Process supervision and package-manager or `PATH`/`which` detection are
similarly out of scope: package-manager detection is inverted to
`LocalExec` rather than duplicated, and probing a tool by spawning it
answers the only real question without a filesystem scan, `PATHEXT`
handling, or a `FileSystem` requirement.

## What the fix would take

A reap/poll helper is `@effected/github-actions`' to add when a second
consumer needs it outside the Actions runtime. An archive package is a new
kit package, designed once a second consumer's determinism requirements are
known, rather than guessed at here.


---
<!-- okf/conventions/require-in-r-default.md -->
---
type: Convention
title: Require the consolidated core's contract in R; never re-implement or re-declare it
description: Effect v4 folded platform, rpc and cluster contracts into core; a library needing one requires the core service in R and lets the app provide the platform layer, and never builds its own backend for a contract core already declares.
status: stable
stale_after: "2027-03-13T00:00:00Z"
tags:
  - architecture
sources:
  - id: effect-process
    resource: ../../.repos/effect/packages/effect/src/process/ChildProcessSpawner.ts
  - id: effect-filesystem
    resource: ../../.repos/effect/packages/effect/src/FileSystem.ts
  - id: git-src
    resource: ../../packages/git/src
  - id: commands-src
    resource: ../../packages/commands/src
generated:
  by: "okfit/claude-code"
  at: 2026-09-28T18:00:23Z
  body_sha256: 8d8d95fc2e7882368a878e457d3b0c89558f6188686eec7ddfa237ac7fc2f89a
---

# Require the consolidated core's contract in R; never re-implement or re-declare it

Effect v4 consolidated what were separate packages into `effect` core:
functionality that lived in `@effect/platform`, `@effect/rpc` and
`@effect/cluster` now lives directly inside `effect`, including the
service **contracts** for platform concerns — `FileSystem`,[^effect-filesystem]
`Path`, `Terminal`, `Stdio`, and `effect/process`'s
`ChildProcess` plus `ChildProcessSpawner`.[^effect-process] The packages
that remain separate are platform-specific, provider-specific or
technology-specific **implementations** of those contracts:
`@effect/platform-*` (for example `@effect/platform-node`'s
`NodeServices.layer`, which provides
`ChildProcessSpawner | Crypto | FileSystem | Path | Stdio | Terminal` in
one layer), `@effect/sql-*`, `@effect/ai-*`, `@effect/opentelemetry`,
`@effect/atom-*` and `@effect/vitest`.

## The standing rule

This kit is in the business of business logic — schemas for data,
services for behaviour, layers that compose. It never re-implements
platform specifics. A library that needs a platform capability requires
the core-declared service in its `R` channel, and the application
provides the platform layer once at the edge. This is free under
[R3](dependency-policy.md#r3-tier-2-does-not-propagate) — it is how
`walker`, `xdg` and `config-file` consume `FileSystem` — and it is
categorically different from taking `@effect/platform-*` as a dependency
edge, which is what [R2](dependency-policy.md#r2-tier-3-propagates)
taxes. The two must not be conflated.

Three operating rules follow:

1. **Before designing any seam or contract, grep the vendored Effect
   source for the core contract first.** If core declares the service,
   require it in `R`; the seam already exists.
2. **A direct `node:` import in library code is a code smell, most of
   the time.** The sanctioned exceptions are documented Node-only
   overlays — a default layer or a sync escape hatch — never a contract
   or a business-logic path.
3. **Platform packages are legitimate devDependencies for integration
   tests, and legitimate dependencies only in applications and app-edge
   packages.**

## Two separate failure modes, not one

`@effected/commands` took two attempts to get right, because clearing
one failure mode does not clear the other:

- **Re-declaring a core concept.** The first design invented a
  `Command`/`CommandRunner` vocabulary for something core already
  declares. It survived several review gates because reviewers checked
  the code against the design brief instead of checking the brief
  against core.
- **Implementing a core concept.** The second design imported core's
  vocabulary faithfully and deleted every invented type — it passed the
  re-declaration check outright — and was still wrong, because it shipped
  a **backend** for a contract core already implements. A reviewer
  holding only "don't reinvent core" as a rule would have approved it.

The general form, and the invariant `@effected/commands` ships under:
every subprocess concept is core's, and no implementation of one is;
`@effected/commands`'s `Run` and `ToolDiscovery` require core's
`ChildProcessSpawner` in `R` rather than owning a spawn
backend.[^commands-src] `@effected/git` is the same invariant from the
consuming end — it simply requires the core `ChildProcessSpawner` in
`R`.[^git-src]

## Core owning a primitive is not the same as core's primitive fitting

The rule above answers *does core declare this?* It does not answer the
question that actually decides a call site: does core's version have the
shape this site needs? A sweep of the kit against the vendored core, for
hand-rolled re-rolls of the late-landing modules (`Crypto`, `Encoding`,
`Graph`, `encoding/Toml`/`Yaml`), found most candidates already
adopted and every remaining one kept for a shape mismatch rather than
inertia. The mismatches recur in five shapes, each invisible from the
module name alone and each cheap to miss:

1. **A sync call site against an `Effect` primitive.** `Crypto.digest`
   returns an `Effect` requiring `Crypto` in `R`; a sync function or a
   module-level constant cannot call it without becoming effectful or
   acquiring a runtime, which is a public-surface change to buy a
   dependency removal.
2. **A streaming site against a one-shot primitive.** `Crypto.digest`
   takes the whole payload with no `update`/`digest` accumulator, so
   hashing a stream through it means buffering the stream — fine for a
   key or a short manifest, wrong for an artifact of unbounded size.
3. **A canonical value against a lenient codec.** Core's base64 decoder
   maps several textual spellings onto identical bytes and strips
   embedded CRLF while rejecting an unpadded form some grammars allow.
   Where a value's text is load-bearing — an integrity hash, a signature,
   a cache key — a decoder that accepts synonyms is not a drop-in for one
   that denies them, and encoding is unaffected by the same argument
   because core's encoders emit the canonical spelling either way.
4. **A typed error channel against a throwing API.** Core's `Graph`
   traversals throw a `GraphError` on a cycle, arriving as a defect
   outside the declared error channel rather than a typed failure — a
   reason to adopt the module only where the throw is unreachable or the
   payload does not matter, not a reason to avoid it outright.
5. **A superset against a subset.** Core's `encoding/Toml` and
   `encoding/Yaml` export a single `parse`. The kit's
   `@effected/toml` and `@effected/yaml` are strict supersets — parse,
   edit, format, comment fidelity — so a same-named core module is not
   evidence of duplication, and there is nothing to fold in.

Absence is its own answer and the cheapest one to check first: core's
`Crypto` has no HMAC, no signing, no key derivation and no cipher, so an
AWS SigV4 signer or a PBKDF2 + AES-GCM envelope is not a migration
candidate at all — it is `node:crypto` or WebCrypto `subtle` under
operating rule 2's overlay exception, decided before the tier and peer
decisions are made rather than discovered mid-implementation.

Two standing rules come out of the sweep. **Probe the shape, do not read
the name** — every judgement above came from running the primitive
against the call site's actual inputs, and three of the five shapes are
undetectable from a signature alone. And **record the verdict at the
site, in both directions** — an adoption and a considered keep are
equally worth a comment naming the core module, the version probed and
the deciding fact, because otherwise the next audit re-runs the probe and
the one after that "fixes" the keep.

## The vendored source is the style oracle, not just the API authority

The vendored `effect` source settles more than existence and signatures:
it is the paradigm reference. Core source is written with one concept per
module and a consistent `@since`-annotated public surface, contracts
shaped as `Context.Service` classes with a `make` that derives the rich
surface from one primitive (`ChildProcessSpawner.make(spawn)`), branded
scalars for domain numbers (`ExitCode`, `ProcessId`), `dual`
data-first/data-last combinators, values that are themselves `Effect`s
where yielding is the natural verb, and doc-comment examples that
compile.[^effect-process] When designing a kit module, read how core
writes the analogous module and match its paradigms — naming, factoring,
where options objects go, how errors are shaped. The more the kit's
constructs read like core's, the cheaper every consumer's mental model
gets, and the easier the kit's pieces compose with the wider ecosystem.
Divergence is allowed, but it must be a recorded decision with a reason,
never a habit.

[^effect-process]: `.repos/effect/packages/effect/src/process/ChildProcessSpawner.ts`
    — the core contract, its `make` factory deriving the rich surface
    from one `spawn` primitive, and the doc-comment style this repo's
    modules match.
[^effect-filesystem]: `.repos/effect/packages/effect/src/FileSystem.ts` —
    the core-declared `FileSystem` service contract, implemented by
    `@effect/platform-node` and required in `R` by boundary packages
    such as `walker` and `config-file`.
[^git-src]: `packages/git/src/` — requires core's `ChildProcessSpawner`
    in `R` rather than owning a subprocess backend.
[^commands-src]: `packages/commands/src/` — `Run` and `ToolDiscovery`
    require core's `ChildProcessSpawner` in `R`.
