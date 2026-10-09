# github-actions — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/github-actions/CLAUDE.md -->
# CLAUDE.md — @effected/github-actions

The GitHub Actions **runtime**: the services an action needs to talk to the
runner it runs inside — workflow commands, inputs/outputs/state, cache and blob
store, OIDC, artifacts, tool install, the reporting suite and the
`@effected/sbom` adapters. Integrated tier; peers `effect` and
`@effect/platform-node`; every `@effected/*` arrow points inward.

**`github` talks to the GitHub API; this package talks to the runner.** They
meet at two seams, both here: `GitHubToken` and `ActionLogger.logger`.

## Knowledge bundle

Read `okf/modules/github-actions.md` before adding a module — it is the
authority on what exists, why, and what is deliberately not here. Then load
what matches what you touch:

- Package shape, the closed list of sanctioned `node:` imports, bundle
  reachability, the two structural invariants, testing doubles and disciplines
  → `okf/modules/github-actions.md` — Load when: adding a module, adding a
  dependency, or writing a test here.
- Environment, inputs, logging, outputs/state, secrets, the App-token bridge,
  detached processes and `ChildEnv` → `okf/interfaces/actions-runtime.md` —
  Load when: touching anything `Action.run` composes.
- `RUNNER_DEBUG=1` lowering `References.MinimumLogLevel` to `Debug` inside
  `Action.run` (only ever lowers; opt out with `stepDebugLogLevel: false`)
  → `okf/modules/github-actions.md` §Observability — Load when: touching
  `Action.run`'s composition or why `Effect.logDebug` does or does not show.
- Cache, artifacts, blob store, cache keys, tool and package-manager install
  → `okf/interfaces/actions-storage.md` — Load when: touching `ActionCache`,
  `Artifact`, `BlobStore*`, `CacheKey`, `ToolInstaller` or
  `PackageManagerInstaller`.
- Check surfaces (`CheckState`, `ManagedDocument`, `GitHubMarkdown`,
  `CheckDocument` and its staleness guard) →
  `okf/interfaces/actions-reporting.md` — Load when: touching the reporting
  suite.
- OIDC and provenance adapters → `okf/interfaces/actions-attestation.md` —
  Load when: touching `OidcTokenIssuer`, `ActionsIdentityToken` or
  `ActionsProvenance`.
- Why `@azure/storage-blob` may be imported by exactly three modules, and why
  `@effect/platform-node` is a peer here alone →
  `okf/decisions/azure-blob-confined-to-three-modules.md`,
  `okf/decisions/platform-node-peer-in-one-package.md`,
  `okf/conventions/bundle-reachability-suite.md` — Load when: a reachability
  test fails or you are tempted to hoist a heavy import into `internal/`.
- Per-reason tagged error unions and when to split →
  `okf/decisions/github-actions-per-reason-tagged-errors.md` — Load when:
  adding or reshaping an error class.
- The two structural tests → `okf/invariants/ambient-process-state-read-once.md`
  (a `process.env` read outside `ActionEnvironment` fails
  `__test__/ambientReads.test.ts`) and
  `okf/invariants/redacted-value-only-in-secret.md` (`Redacted.value` outside
  `Secret.ts` fails `__test__/Secret.test.ts`) — Load when: either suite goes
  red.
- Traps → `okf/gotchas/action-input-default-swallows-validation-failure.md`,
  `okf/gotchas/action-r-channel-erasure-and-env-shadowing.md`,
  `okf/gotchas/pnpm-12-placeholder-bin-runs-under-node.md` — Load when: an
  input defaults when it should fail, an `R` channel is cast to `never`, or a
  provisioned pnpm dies at first use.
- Package-manager majors this package must provision →
  `okf/conventions/package-manager-support-policy.md`.
- The line against `github` in full → `okf/glossary/github-split.md`,
  `okf/modules/github.md`.

## Working here

```bash
pnpm vitest run packages/github-actions --coverage.enabled=false   # from the repo root
pnpm build --filter @effected/github-actions
```

Tests use `@effect/vitest` and `assert.*` — **never `expect`** — and live in
`__test__/`. Never run `node savvy.build.ts --target prod`: it skips
`build:dev`, emits no `.d.ts`, and leaves a truncated `issues.json` shaped like
a clean gate. Never add an `@actions/*` dependency, and never add the reverse
edge `sbom → github-actions`.


---
<!-- okf/modules/github-actions.md -->
---
type: Module
title: github-actions
description: The GitHub Actions runner runtime — environment, inputs/outputs/state, workflow commands, storage, reporting and the sbom attestation seam.
status: stable
kind: package
resource: ../../packages/github-actions
tags:
  - architecture
  - bundle
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T01:56:30Z
  body_sha256: f10e59943a6f54802073740255a9eb6d28cdceba0116a3905f243ddabf38a5e2
---

# github-actions

## Purpose

`@effected/github-actions` is the GitHub Actions runtime for the kit: the
services an action needs to talk to the runner it is executing inside. The
line against [`github`](github.md) is sharp: `github` talks to the GitHub
API, `github-actions` talks to the runner. Nothing here reads a `GITHUB_*`
variable on `github`'s behalf, and nothing in `github` imports a workflow
command. The two meet at exactly two seams, both living here: the App-token
bridge and the `Logger` that maps Effect logs onto workflow commands. The
workflow-command grammar itself, `WorkflowCommand` and the `CommandNeutralizer`
the logger uses, is the pure [`@effected/github-commands`](github-commands.md),
a regular dependency (it has no shared-instance contract, so a duplicate is harmless) that this entrypoint re-exports `WorkflowCommand` from.

The package covers four subsystems, each with its own contract doc: the
runner runtime ([`actions-runtime`](../interfaces/actions-runtime.md)),
storage and provisioning ([`actions-storage`](../interfaces/actions-storage.md)),
the reporting suite ([`actions-reporting`](../interfaces/actions-reporting.md))
and the attestation seam ([`actions-attestation`](../interfaces/actions-attestation.md)).

## Tier and dependencies

Integrated tier by construction, and the one package in the kit where
`@effect/platform-node` is a required peer — see
[the platform-node peer decision](../decisions/platform-node-peer-in-one-package.md).
A GitHub Action always compiles into a Node process on a GitHub-provided
runner, so there is no second platform to abstract over.

Two consequences follow from that tier that the rest of the kit does not
get: a direct `node:` import is sanctioned here, and the platform layer is
composed here rather than left to the consumer, which is the point of
`Action.run`. **Sanctioned is not unlimited** — the list is closed and
small. `node:crypto` in `internal/digest.ts` (every `createHash`, spelled
once, including the streamed file digest a multi-gigabyte archive needs)
and `internal/sigv4.ts` (the HMAC core's `Crypto` does not offer — core
exposes random primitives, UUIDs and SHA digests, no HMAC or key
derivation); `node:child_process` and `node:fs` in `DetachedProcess.ts`
for the fd-level detached spawn, plus `process.kill` for reaping a bare
pid. Everything else goes through a core contract: `ToolInstaller`
downloads over `HttpClient` and extracts over `ChildProcessSpawner` in
`R`, the cache and artifact archives are `tar`/`zip` commands spelled in
`internal/archiveCommands.ts` and run through the same spawner, and
`CacheKey` reads over `FileSystem`. No `@actions/*` package is a
dependency: the cache, artifact and tool-cache protocols are implemented
directly against their HTTP APIs, because the official cache client alone
drags a dependency tree larger than this package; globbing is
[`glob`](glob.md), never `@actions/glob`.

Kit edges: [`github`](github.md), [`glob`](glob.md), [`markdown`](markdown.md),
[`npm`](npm.md), [`sbom`](sbom.md), [`templates`](templates.md) and
[`walker`](walker.md), plus one
heavy external dependency, the Azure blob client
(`@azure/storage-blob`).

## Bundle reachability

A consumer that imports only an outputs accessor must be unable to link the
Azure client. Three rules hold the confinement and one measures it:

- The Azure client is imported by exactly three modules —
  `ActionCache.ts`, `Artifact.ts` and `BlobStore.githubCache.ts` (three,
  not the two an outside reading suggests, because the Actions cache's own
  protocol hands back an Azure blob URL for the payload) — and nowhere
  else. No shared helper under `internal/` may import it. See
  [Azure is confined to three modules](../decisions/azure-blob-confined-to-three-modules.md).
- The three are separate named exports in `index.ts`, never gathered into
  a namespace object — see
  [no barrel re-exports](../conventions/no-barrel-re-exports.md).
- `@effected/markdown` is confined the same way: `GitHubMarkdown.ts` is the
  only module allowed to import the markdown engine, and every other
  reporting module composes strings. `@effected/npm` is confined to
  `PackageManagerInstaller.ts` on the same terms; it is not reachable from
  the composed runtime layer, so taking it costs a consumer one explicit
  layer line. `@effected/templates` and `@effected/sbom` are deliberately
  **not** confined — both are small, pure-or-contract-shaped kit packages
  whose presence in an import graph costs nothing worth measuring.
- The confinement is checked, not promised, by
  [the bundle-reachability suite](../conventions/bundle-reachability-suite.md)
  at `packages/github-actions/__test__/reachability.test.ts`.

What that test does **not** prove: it constrains the runtime *import*
graph of `src`, not the *resolver* graph. Every heavy edge here — Azure,
`markdown`, `npm`, and through `sbom` the Sigstore stack — is a declared
dependency of this package, so it is installed for every consumer and a
bundler's resolver still walks it; only a consumer that actually bundles
and tree-shakes sees the benefit. The composed runtime layer
(`Action.run`) deliberately excludes the cache, artifact and blob
services for the same reason: folding them in would put the Azure client
in the bundle of every action that merely sets an output.

## Module topology

Module-per-concept, no barrels; `src/index.ts` re-exports only. `internal/`
holds the request signer, the Twirp client, the results-backend reader,
the archive commands and the digests, and is import-restricted by the
reachability rule above. The blob envelope, cache-key derivation, the
secret declassification seam, the detached-process lifecycle and the
whole reporting suite each absorb a consumer-side hand-roll found in real
actions rather than a new invention.

Two properties of the source tree are pinned structurally rather than
followed by convention: `ActionEnvironment` is the only reader of ambient
process state ([invariant](../invariants/ambient-process-state-read-once.md)),
and `Secret.ts` is the only module that unwraps a `Redacted`
([invariant](../invariants/redacted-value-only-in-secret.md)). A new
default that must read `process.env` goes on the first test's allowlist
with its reason; a new reason to hold plaintext is a new `Secret` member.

## Errors

Typed errors per concept module, with foreign failures wrapped
structurally rather than stringified. Input failures surface as
`ConfigError` — not a bespoke error class — because inputs are
`Config`-backed, which gives a strictly better message naming the missing
key for one fewer error class.

`ActionOutputError`, `BlobEnvelopeError`, `CacheKeyError` and
`DetachedProcessError` are **per-reason tagged unions**, not one class
carrying a `reason` field. Every exported name survives as a union type
alias, so no signature changed when the shape moved. Every error channel
is audited for whether it can actually fire — a pure body wrapped in
`Effect.try` has a dead catch arm, and a channel that cannot fire forces
every caller to handle a case that does not exist.

## Shared vocabulary with `github`

Recorded per concept rather than defaulted: the repo coordinate,
installation tokens, bot identity and the API client are canonical in
[`github`](github.md) and consumed here. The GitHub and runner *contexts*
(run id, attempt, workflow, job, runner OS and temp directory) are
canonical here, since `github` has no use for them. The workflow-command
protocol is canonical here and duplicated nowhere. The check-run
*conclusion* literals are canonical in `github` and mirrored here
structurally — the one deliberate exception, pinned by a test against the
real union, because importing the API client to name a string would put
octokit on the graph of every module that reports progress.

## Observability

Named spans on every public fallible member of every service, uniformly —
partial coverage reads as signal to whoever is tracing. Annotations are
stable identifiers only (a cache or blob key, a tool and version, a pid,
an input or output name), never a value, a secret or a payload, since this
package handles tokens by definition and a span annotation is the easiest
place to leak one. The pure modules carry no spans. The package emits
Effect logs and ships the `Logger` that renders them as workflow commands;
it composes no OpenTelemetry itself.

Step debugging reaches the log level, not just the renderer. When the
runner sets `RUNNER_DEBUG=1`, `Action.run` lowers core's
`References.MinimumLogLevel` from its `Info` default to `Debug` for the
whole program, so `Effect.logDebug` from the action or any kit library
arrives as `::debug::` instead of being filtered before the `Logger` sees
it. It only ever lowers — a `layer` that already set `Trace` keeps it —
and `ActionRunOptions.stepDebugLogLevel: false` opts out. Before this,
every consuming action hand-wired the same few lines
([#853](https://github.com/spencerbeggs/effected/issues/853)); the four
cases (set, unset, opt-out, never-raise) are pinned in
`__test__/Action.test.ts`.

## Testing

`@effect/vitest`, `it.effect`, `assert.*` — never `expect` — tests live in
`__test__/`. No `./testing` subpath, and no behaviour-reimplementing
doubles. Every service ships `makeTest(overrides?)` and
`layerTest(overrides?)`, with unstubbed members dying loudly and naming
themselves; three doubles carry an honest-default exception because dying
would make them useless (the environment double seeds the standard
context variables, the logger double defaults to silent, the dry-run
double defaults to on). Real IO is used where the claim is about the
filesystem (`ToolInstaller` runs under `NodeServices.layer` against real
`tar`), HTTP is tested through `FetchHttpClient.Fetch` so request
construction, status mapping and body decoding all execute, and the two
network protocols get opt-in integration tests, skipped rather than green
without credentials.

The doubles worth knowing before writing a test:

- `ActionEnvironment.makeTest(overrides?, payload?)` / `layerTest` take
  the webhook payload as a **second argument** and serve it directly.
  `layerTest` hard-provides `FileSystem.layerNoop({})` and `make`
  captures the filesystem at construction, so seeding `GITHUB_EVENT_PATH`
  through `overrides` sends the read to a noop filesystem; `undefined`
  means *not served*, so an unarranged payload still fails typed naming
  the variable.
- The runner-file doubles are a real in-memory volume from
  [`memfs`](memfs.md) (a devDependency). `ActionOutputs` and
  `ActionState` both append (`flag: "a"`), and the `Map` stubs they
  replaced were re-implementing append by concatenation — filesystem
  behaviour hand-modelled inside the test of something else. Build the
  pair eagerly (`makeHandle` + `Layer.succeed`, never the
  re-seeding `layer*` form, per memfs's isolation contract) so the
  assertions read the volume the run wrote to, and seed the runner-file
  directory, since a write needs its parent.
- `OidcTokenIssuer.layerFor(claims)` answers a **real, decodable**
  unsigned JWT built from the same claims `claims()` reports, which is
  what makes the provenance path reachable under test.
- `BlobStore.layerMemory` runs the real envelope framing, so a round trip
  through it proves metadata survives storage rather than asserting the
  double.

Disciplines the suite holds itself to: a concurrency test over
`withEnv` needs **two** latches minimum, because a single-latch
interleaving passed against a deliberately wrong save/restore (nested
overrides are LIFO-correct by accident) — the order must force one fiber
to read while the other's override is applied and unrestored; a spy on a
process global is released with `acquireUseRelease`, never
`try`/`finally` inside `Effect.gen`, since a failing assertion leaves
through the error channel and leaks the spy into the next test; the pid
guard, the envelope magic, the `INPUT_` mangling, the `withEnv` scoping,
the hex-vs-binary digest and the tool-cache swap all carry recorded,
discriminating mutants. Two structural suites — the ambient-read
allowlist and the `Redacted.value` scan — are described under module
topology; the reachability suite additionally asserts exact edge sets
for the light modules (`CheckState.ts` reaches `effect` alone and in
particular not `github`, `ManagedDocument.ts` and `CheckDocument.ts` reach
`templates` and `effect` only, `ChildEnv.ts` reaches nothing, `Action.ts`
reaches `@effect/platform-node`, `effect` and `effect/http`).

## The class of feedback this package absorbs

What adoption against real actions asks for is almost never a missing
service — it is a projection a consumer had to write between two things
the kit already owned and got wrong in a way that typechecked (a
many-field claim rename, GFM escaping, a step-summary shape, a table's
columns respelled per call site). That is why the reporting suite's
formatters are type-required rather than defaulted: the defect these
modules delete is never "no API for it", it is "the obvious spelling is
silently wrong". `optionalDependencies` is rejected for the heavy
dependencies and stays rejected — all of them are hard static imports
that throw at module load rather than degrade, and several sit on the
common reporting path.

## Deliberately not here

- The `./testing` subpath and every behaviour-reimplementing double.
- A command runner — superseded by [`commands`](commands.md), which this
  package consumes.
- A glob engine — the kit owns [`glob`](glob.md); only file hashing lands
  here, and conditionally.
- A config-file loader — that dissolves into
  [`config-file`](config-file.md); the environment service is what stays.
- SBOM assembly and signing — [`sbom`](sbom.md)'s, with only the seam
  adapters here (see
  [`actions-attestation`](../interfaces/actions-attestation.md)).
- Workspace discovery, package-manager adapters and changeset analysis —
  the kit already owns all three.

See also [the github-split glossary entry](../glossary/github-split.md)
and [the GitHub Action canon convention](../conventions/github-action-canon.md).


---
<!-- okf/interfaces/actions-runtime.md -->
---
type: Interface
title: actions-runtime
description: The runner runtime a GitHub Action composes through Action.run — environment, config-backed inputs, logging, outputs/state, secrets and the App-token bridge.
status: stable
kind: runtime
resource: ../../packages/github-actions/src/Action.ts
tags:
  - architecture
  - security
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T01:56:30Z
  body_sha256: 6f14830f05c4f2fa996315769f22d1b5cc051f4107d34ee125057638187f5b4a
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:31.377Z
---

# actions-runtime

## Contract

`Action.run(program, options?)` (`packages/github-actions/src/Action.ts`) is
the entry point every action calls: it provides the runtime layer, renders
a failure, sets the exit code and never rejects. The runtime layer provides
the environment, the logger (plus the workflow-command `Logger`), outputs,
state, the platform services and an HTTP client, and deliberately excludes
the cache, artifact and blob services — see
[bundle reachability](../modules/github-actions.md#bundle-reachability).

The layer option a caller passes is **not** self-contained: it is typed so
it may require anything the runtime already provides (the platform, the
HTTP client, every runner service), which lets a consumer's own
requirements travel upward instead of being sub-provided redundantly. The
composition inside is `provideMerge`, not a flat merge, because state
needs outputs (it masks before it persists) and outputs needs the
environment.

Failure rendering is one error line carrying tag and message, plus the
exit code, with the full pretty-printed cause behind the runner's own
debug switch — never a JS stack spliced into the visible error, since in a
bundled action it points at one line of the bundle. `Action.run` does not
wrap the program in a log buffer: an unhandled defect inside such a buffer
would swallow the whole transcript.

### `ActionEnvironment`

The webhook payload's `R` carries no `FileSystem` requirement: the layer
resolves it once at construction. A scoped environment override never
touches the process environment — it seeds an immutable map once at
construction, held in a `Context.Reference` (v4's replacement for a v3
`FiberRef`), so an override is fiber-scoped and two fibers overriding the
same variable concurrently never see each other's values. The trade-off is
explicit: a variable exported mid-run, or set by a child process, is not
observed by an already-seeded reader — the correct trade, since an
action's environment is fixed at start by GitHub's own model. That the
layer is the package's **only** reader of ambient process state is pinned
by [an invariant](../invariants/ambient-process-state-read-once.md).

`GitHubContext.headRef` is an `Option<string>`, not a string: outside a
pull request the runner does not merely omit `GITHUB_HEAD_REF`, it may
write the **empty string**, and both spellings of absence decode to
`None` — the trap lives in the type, not in a call-site check. The
derived `branch` accessor owns the universal fallback (`headRef` when
present, else `refName`), so no consumer hand-rolls the chain. The
encoded form is `string | null` (`Schema.OptionFromNullOr`), so an
encoded context stays plain JSON.

### `ActionInput`

Inputs are read through a `ConfigProvider` that owns the `INPUT_` name
mangling — never through the process environment directly, which closes a
production bug where a consumer read `INPUT_SBOM_CONFIG` and silently got
nothing because the runner uppercases the name and replaces **spaces**
with underscores while leaving dashes alone.

Beyond the toolkit-faithful accessors: a **list** accessor absorbing JSON
arrays, bullet lists and comma-separated values in one implementation, and
a **key-value pairs** accessor whose key is validated unconditionally (an
empty key like `=value` is rejected, because the damage lands far from the
typo) while its value is accepted empty by default (`requireValue` opts
into rejecting it). Every rejection names the offending line.

Absence is one rule across every accessor: a missing input and an input
set to empty are both *missing data*, because the runner writes an empty
string for an input the workflow omitted. An input whose contract is
"empty disables it" needs the option form, not a default, because empty
is classified missing *before* a default is consulted — deleting a
manifest default silently flips every unsupplied run onto the disabled
branch rather than restoring a fallback.

`Action.run` installs an input-aware `ConfigProvider` by default, so a
program that bypasses the typed accessors degrades to the right answer
rather than to the default. It resolves a flat, single string-segment path
first through the `INPUT_` derivation, then through the ambient provider
unchanged; nested and numeric paths pass through untouched. A
caller-supplied provider in the layer option wins by normal last-wins
precedence. Never compose a bare environment provider beneath the input
accessors — it uppercases the config path and the read silently falls
back to its default.

The no-spelled-variable rule extends to tests. `ActionInput.provider` and
`layer` dual-accept **input-name keys** (`with:`-block style,
`{ "biome-version": "…" }`) and mangle them internally, an explicit
`INPUT_`-spelled entry winning on collision; `ActionInput.variable(name)`
exports the derivation for the rare test that must spell the variable —
a hand-written `INPUT_BIOME_VERSION` reads as absent on a real runner.

### Logging and the workflow-command protocol

`WorkflowCommand` is pure: it renders the wire protocol with the required
escaping and nothing else. It lives in the pure
[`@effected/github-commands`](../modules/github-commands.md), which this
package takes as a regular dependency and re-exports it from, so existing imports
keep working; the grammar left so a package that is not an Actions runtime can
use it without the integrated tier. `ActionLogger` owns groups, the buffered
step renderer and annotations, and ships the `Logger` that maps every kit
package's `Effect.log*` calls onto workflow commands — the mapping belongs to
one `Logger` at the edge, not to each library.

The same logger neutralizes the plain text it writes (`CommandNeutralizer`):
the runner reads every line of stdout, so an `Info` message carrying `::` at the
start of a line, or `##[` anywhere, would be a command. The levels that render AS
a command escape their data instead, the buffered transcript and the
`withStep` failure line are neutralized, and the deliberate commands (`group`,
`notice`, `setFailed`, `setSecret`) are not routed through it.

A silent layer is a named constant, not a no-arg factory (which would mint
a fresh layer per call and defeat memoization). Buffering is opt-in and
flushes on every exit path including a defect; only a **success** is ever
discarded. `withStep` buffers with discard-on-success, prints one summary
line on success (emitted **outside** the buffered region, or it would be
discarded with the transcript it replaces) and a failure header ahead of
the spilled transcript — a plain `Console` line, deliberately not a
second `::error::` beside the one `Action.run` renders. Buffering is
skipped when the runner has step debugging on, and the summary line
survives that too. Step debugging also reaches the log level: under
`RUNNER_DEBUG=1`, `Action.run` lowers `References.MinimumLogLevel` from
core's `Info` default to `Debug` (never raising a lower one) so
`Effect.logDebug` renders as `::debug::`; `{ stepDebugLogLevel: false }`
opts out. Log annotations use a readable property
vocabulary set through a combinator, never a spelled-out wire key.

### Outputs and state

Reporting a failure emits the annotation but does not set the exit code —
that belongs to `Action.run`, so a recovered failure is not doomed by a
side effect it cannot undo. Runner-file delimiters are derived, never
random, so a value containing the delimiter cannot terminate its block
early. `ActionOutputError` and `DetachedProcessError` are per-reason
tagged unions (see [errors](../modules/github-actions.md#errors)). State
round-trips through the real runner file in tests, in a temp directory.

`ActionState.save` proves the round trip at save time: the encoded form
must survive `JSON.stringify`/`parse` and re-decode, and a value that
does not fails typed as `notPlainJson`, naming the key, instead of
leaving a `malformed` mystery for a later phase to hit. In practice that
means a schema's encoded side is plain JSON — `Schema.OptionFromNullOr`,
never `Schema.Option`.

### Secrets: the declassification seam

`Redacted` cannot survive serialization by design, so declassification is
made explicit, auditable and hard to do quietly: one module,
`Secret.ts`, is the only place `Redacted.value` appears in `src/` — a
structural test asserts it, see
[the invariant](../invariants/redacted-value-only-in-secret.md) — and it
masks through the runner's own secret command before returning
plaintext. A new reason to hold plaintext is a new `Secret` member, never
an exception to the scan. State persistence gets the same
treatment: the save-a-secret path masks then persists, because the
runner's state file is plaintext by GitHub's protocol. A detached worker
inverts the ordering rather than the invariant: it composes
`ActionOutputs.layerDetached` (the mask a documented no-op, since a
detached worker's stdout is a log file no runner parses) and the parent
masks **before** the spawn via `Secret.forChildEnv`.

### The App-token bridge

Five phase-oriented statics over [`github`](../modules/github.md)'s App
service: provision a token in `pre`, build a client layer from the
persisted token in `main`, read it, project a bot identity, dispose in
`post`. Failed provisioning revokes (an `acquireUseRelease` whose release
arm revokes on any failure), so a retried failing `pre` does not leave
unreferenced write tokens behind. The token is masked before it is
persisted, through the seam, so the ordering is structural. Reading an
expired token fails typed, naming the expiry, rather than silently
starting to answer 401 — the App's private key never reaches the
persisted state, because that would trade a one-hour token for a
permanent one. A phase that can outlive the hour calls `provision`
itself. `dispose` skips revoking an already-expired token: GitHub has
stopped accepting it, so the request could only turn a successful run
into a failed one on the way out. The member-usage table in the module's
TSDoc is executable — one test supplies exactly the documented members
of the App service and passes, another supplies one fewer and dies.

### Detached processes and the bare-pid guard

`DetachedProcess.reap` takes a plain `number` and guards it: signalling
pid `0` hits the entire process group and `-1` hits every process the
user owns, so a pid round-tripped through the runner's plaintext state
file that decodes to `0` would, unguarded, kill the runner. Reaping
refuses any non-positive pid as a typed failure on the way in **and** the
way out of state. The fd-level detached spawn and `process.kill` are both
sanctioned `node:` imports here because core cannot route a detached
child's stdio to a file descriptor. The pid guard is deliberately a
runtime check on a plain `number` rather than a brand: the value arrives
as text from another process, so the type system stopped applying the
moment it crossed that boundary. `ProcessId`, the schema that refuses the
bad value on the way out of `ActionState`, decodes to **core's** brand —
the subprocess vocabulary is core's, and this package only supplies the
validating constructor `Brand.nominal` is not.

`ChildEnv` is the pure value-builder for core's spawn options — zero
imports, an exact-empty-edge-set assertion in the reachability suite —
and its `base` and `platform` are **required** arguments, so it reads
nothing ambient. `prependPath(dirs, { base, platform })` answers
`{ env, extendEnv: true }` as **one value**, because a bare `env` silently
replaces the child's whole environment. It writes through the inherited
`PATH` key's own casing (Windows spells it `Path`, and emitting `PATH`
beside it leaves the winner to a Node-internal case-insensitive dedupe),
uses the platform's delimiter, and adds no empty trailing entry for an
absent inherited value. `needsShell(platform)` is the win32 rule for
`.cmd` shims since CVE-2024-27980. Two compositions: a spawner call
spreads the whole pair; `DetachedProcess.spawn` merges over the parent
itself and takes `.env` alone.

## Stability

This is the runner-shaped half every action always pays for, so it stays
light: the cache, artifact, blob, reporting and attestation surfaces are
opt-in layers a consumer composes on top (see
[actions-storage](actions-storage.md), [actions-reporting](actions-reporting.md)
and [actions-attestation](actions-attestation.md)). `ActionInput`,
`ActionOutputs`, `ActionState`, `ActionEnvironment`, `ActionLogger`,
`WorkflowCommand`, `Secret`, `DetachedProcess`, `ChildEnv` and `GitHubToken`
are the stable surface; `internal/` is not part of the contract.


---
<!-- okf/interfaces/actions-storage.md -->
---
type: Interface
title: actions-storage
description: The Actions cache and artifact protocols, the blob store envelope, cache-key derivation and the tool/package-manager installers.
status: stable
kind: api
resource: ../../packages/github-actions/src
tags:
  - architecture
  - bundle
generated:
  by: "okfit/claude-code"
  at: 2026-09-27T06:20:52Z
  body_sha256: 43898d8b704e948e8231b1e412fa2c0dcb417f4261d599b3c830bb19eda50baf
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:32.522Z
---

# actions-storage

## Contract

Storage and provisioning owns the **protocol**, never the transport: the
RPC sequence, conflict handling, version derivation, retry policy and
envelope framing all sit on this side of a pre-signed URL, and the upload
itself is taken as an argument. None of it is in the layer `Action.run`
composes (see [actions-runtime](actions-runtime.md)) — a consumer that
wants a cache passes it in and writes one explicit layer line. This is
also where the package's heavy edges concentrate: everything Azure-touching
lives in three modules (`ActionCache.ts`, `Artifact.ts`,
`BlobStore.githubCache.ts`), and `@effected/npm` is reachable only from
`PackageManagerInstaller.ts` — see
[bundle reachability](../modules/github-actions.md#bundle-reachability).

### `BlobEnvelope` — the metadata channel

A pure, schema-versioned module owning the wire format for a raw get/put/has
byte-array store, with no IO and no service. A magic prefix identifies the
envelope **family**; a separate byte identifies the **revision**, so a
legacy blob decodes as a typed "not an envelope" instead of garbage
metadata, and a raw payload gives a migrating consumer a clean miss rather
than a corrupt read. The version lives in the blob, not in the key, so
keys stay stable across format revisions and old entries age out
naturally. Metadata is the caller's own schema — the package owns framing,
the consumer owns meaning — and the primitives are `Result`-returning,
because framing is pure computation. There is no list and no delete:
eviction belongs to the backend.

The stored value's type is `StoredBlob<A>`, never `Blob<A>` — that name
collides with the DOM global and the published docs model disambiguates it
to `Blob_2`, a name no consumer can search for. `BlobEnvelopeError` is a
per-reason tagged union (see
[errors](../modules/github-actions.md#errors)): "not an envelope" and
"unsupported version" are ordinary cache misses on a migrating consumer,
while a truncated frame or a metadata decode failure is a corrupt entry
worth reporting.

Two backends, both requiring core's HTTP client in their layer: the
Actions cache protocol, and an S3-compatible backend with request signing
(`node:crypto` HMAC), path-style addressing and a custom endpoint. The
GitHub-cache backend's layer static lives on its own module's class, never
on the shared service class, so the Azure client stays unreachable from
every other module that reads a blob.

### The transport seam

The three Azure-touching modules take their transport as an argument (a
file transport for the cache and artifacts, a buffer transport for the
blob store), with a parameterized layer beside each real one — which is
what lets the cache suite archive real files, delete them and restore
them as a claim about the filesystem no in-memory double could make. Each
of the three carries its own small Azure adapter deliberately: hoisting
them into a shared internal helper is exactly the move the confinement
rule forbids.

### Protocol details

The RPC client decides retryability structurally: one module owns the
call, the conflict sentinel and the retry policy, and applies the retry
itself so no protocol can ship without it. Both camelCase and snake_case
field spellings are read from the backend, because the two halves of the
internal protocol disagree, and a non-retryable failure never sleeps. The
results backend is reachable only from a `uses:` step — its environment
variables are injected into action execution contexts, not shell steps —
and all three services report that as a misconfiguration naming the
absent variable. The runtime token from that backend is never
declassified: it is wrapped immediately at the read and leaves only
through the HTTP client's bearer-token helper, which accepts a `Redacted`
directly (see
[the declassification invariant](../invariants/redacted-value-only-in-secret.md)).
Artifact backend ids come from that token's own `scp` claim, decoded
from the plaintext before it is wrapped.

Artifact facts worth not re-deriving: the create call's protocol version
is unrelated to the marketplace action's version; finalization hashes the
stored archive streamed, not read, because an artifact has no upper bound
on size; entries are stored relative to the root directory; and a
conflict on create is a failure, unlike the cache, because a run may hold
one artifact per name. The cross-run artifact lookup is deliberately not
implemented — see
[no cross-run artifact lookup](../limitations/actions-storage-no-cross-run-artifact-lookup.md).

### Cache keys and file hashing

The key ladder is its own concept module: every rung ends in the
separator (GitHub matches restore keys as bare prefixes, so a rung
without one also matches an unrelated cache), a one-segment key gets no
rung at all (an empty prefix matches every cache in the repository), and
branch-aware derivation orders segments so the first fallback stays on the
branch. `CacheKey.withNamespace` puts its segment **first** and drops the
ladder entirely: restore keys are prefix matches, so folding a bust token
in later would leave an ordinary run's rung prefix-matching busted
entries. A caller who wants an in-namespace ladder follows with
`withRestoreDepths`. `CacheKeyError` is a per-reason union whose members
each carry their own required field.

The restore policy is a three-point space carried on the typed key, and
`ActionCache.restore` picks it up through that key alone. Absence means
the default every-prefix ladder. `withRestoreDepths([4, 3])` carries an
explicit ladder — each depth is the number of leading segments a rung
keeps, emitted in the order given — because the default ladder drops
digest segments a five-segment key must never lose; a depth outside
`1..segments.length - 1` is refused at construction. `withoutRestoreKeys()`
is the same field carrying **zero** rungs: an exact-match-only restore
sends an empty `restore_keys` and never falls back. `CacheKey.digest(input,
length = 8)` is the segment-safe short digest for **non-file** segments (a
version list, a branch name): sha256, lowercase hex, truncated to satisfy
the segment grammar so it drops into `CacheKey.of` unchecked; a length
outside `1..64` is wiring, not data, and throws a `RangeError`. File
content stays with `hashFiles`.

`ActionCache.save` resolves its `paths` as glob **patterns** before `tar`
sees them, with `actions/cache` parity: a matched directory archives
recursively, a pattern matching nothing (including an absent literal)
drops silently, and a list resolving to nothing fails typed rather than
reserving an entry no archive backs. The entry **version** is a digest of
the *literal* pattern list on both sides — resolution feeds `tar`, never
the version — so `restore`, which resolves nothing, derives the same
version for free and `paths` must be the same literal list the save used.
One knowing divergence: matches stay **absolute** and archive under
`tar -P`, so a restore puts every file back where it came from regardless
of the restoring step's working directory. The engine is
[`glob`](../modules/glob.md), never `@actions/glob`.

File hashing is byte-compatible with the official glob action: sorted,
de-duplicated, each file's digest fed into the accumulator as binary, not
hex. Discovery and matching are two deliberate halves — `glob` is a
matcher, not a walker — and `CacheKey.matchingFiles` walks through
[`walker`](../modules/walker.md)'s `descend` (files only, one root per
include, `prune: []` so nothing is skipped implicitly, because the
runner's own `hashFiles()` prunes nothing either). Symlinked directories
are followed (`followSymlinks: true`) for parity with `@actions/glob`'s
default, `descend`'s real-path cycle guard keeping link loops finite;
note the walk is therefore **not** workspace-bounded under links — a
symlinked directory targeting outside the workspace is descended and its
files enter the key, as `@actions/glob` does. `ActionCache`'s own path
resolution stays hand-rolled, because cache paths are usually directories,
which `descend` never matches.

### Tool and package-manager installation

`ToolInstallerError.subject` is required, not optional. Downloads go
through core's HTTP client and stream to disk; extraction requires core's
subprocess contract in `R`. Installs stage then swap: extract into a temp
directory under the cache root and rename into place, so a failed install
leaves nothing at the cache path (a lookup reports an empty directory as a
hit) and a re-install replaces rather than merges. The staging directory
lives under the cache root because a rename across filesystems is not
atomic. Tool installation takes no edge to [`runtimes`](../modules/runtimes.md):
that package resolves versions and answers with a download URL, this one
takes a URL and installs files.

`ToolInstaller.provisionFile` packages the one composition with no
per-tool variation — a single bare binary (biome, and every Rust or Go
tool shipped as one executable): `find` → `download` → chmod `0o755`
(skipped on Windows, and done **before** caching, so the cache never
holds a non-executable tool) → `cacheFile`, answering `{ directory,
binDir }` where `binDir` *is* the cached directory. A hit **missing the
named binary** is a foreign or partial entry and is reinstalled over, not
answered. `ToolInstaller.cachePath(tool, version)` is the location
contract — the same closure `cacheDir` lands at — so a caller that must
write the final path *into* a staged tree before the swap (a shim naming
its target) asks the installer rather than re-deriving root and arch.

`PackageManagerInstaller` provisions the majors
[the support policy](../conventions/package-manager-support-policy.md)
names, answering a union discriminated on `source`
(`AmbientPackageManager` | `CachedPackageManager`), every tool-cache
answer carrying an `addPath`-able `binDir`. Shims for the npm-registry
managers are written into the **staged** entry, never as a post-swap
mutation, naming their target through `cachePath`; bun's own directory is
its `binDir`, and the bun path deliberately does not route through
`provisionFile` because integrity verification and zip extraction sit
between its download and chmod. The installer decides how to provision by
**artifact layout**, never by major. pnpm 12's
registry package is a wrapper whose `pnpm` bin is a shebang-less
placeholder that pnpm's own install script would overwrite with a native
binary shipped as an `@pnpm/exe.<os>-<arch>[-musl]` optional dependency;
since the installer runs no lifecycle scripts, it performs that overlay
itself when the wrapper manifest's `optionalDependencies` names an
`@pnpm/exe.*` package. The host's `@pnpm/exe.<target>` tarball comes from
the same registry as the wrapper and is verified **fail-closed** — it is a
second artifact the pin never named, so there is no integrity-less posture
to honor — and its executable is copied over the placeholder in the
**staged** entry, where the wrapper's `dist/` sits beside it as the binary
expects. The manifest's `@pnpm/exe.*` version must equal the pin's;
anything else is `layoutUnexpected`.

The native tarball's expected integrity has two sources, settled before the
tarball is fetched. When the caller passes `nativeIntegrity`, a record of
SRI strings keyed by bare package name (`"@pnpm/exe.linux-x64"`), usually
[lockfiles](../modules/lockfiles.md#the-env-preamble-the-pinned-package-manager)'
`PackageManagerLock.nativeIntegrity`, the host's entry is the authority and
the packument is never requested, so a tarball-only mirror suffices.
Otherwise the registry packument's `dist.integrity` for the exact version
is. Either way the strongest listed algorithm is used, and the map is read
with own-property semantics. The supplied map fails closed at every step:

- No entry for the host's package is `integrityMissing`, `subject` naming
  the package. A lockfile records every platform, so a gap means the map is
  inconsistent.
- An entry with no usable SRI is `integrityMismatch`, `subject` naming the
  package.
- A tarball hashing to anything else is `integrityMismatch`, `subject`
  naming the tarball url.

Pins with no native overlay ignore the option.

The manager's own artifact takes its expected integrity from the pin's
`+<integrity>` tail or from the `integrity` option, an
`IntegrityHashBrand` in corepack `<algo>.<hex>` form (convert a lockfile or
registry SRI with `CorepackIntegrityHash.fromSri`). The option counts
exactly as a pin integrity does: it verifies the same artifact (the
registry tarball for npm, pnpm and yarn 1.x, `yarn.js` for yarn 2+, the
platform zip for bun), silences the unverified-download warning, satisfies
`requireIntegrity`, and lets a tool-cache hit answer without re-verifying.
When both are present and differ, the install fails with
`integrityMismatch` before any cache lookup or download — `expected` is the
option, `subject` names the pin's value, and neither is chosen silently. It
governs the wrapper only; the native binary is `nativeIntegrity`'s.

Shims follow their target, not their manager: a `.js`/`.mjs`/`.cjs` target
runs under `node`, anything else is exec'd directly. For pnpm 12 that
makes `bins.pnpm` the native executable and `pn`/`pnpx`/`pnx` its
`#!/bin/sh` aliases. A cache hit whose entry still holds the placeholder —
written by a kit at or below 0.13.1, or by a foreign writer that ran no
lifecycle scripts — is not trusted: it is reinstalled over through the
same remove-then-rename swap, because a stale `exec node` shim beside it
would otherwise survive. The error union is unchanged at seven reasons;
`unsupportedPlatform` now also names a host pnpm publishes no `@pnpm/exe.*`
build for. Corepack's `bin/pnpm.mjs` route is deliberately not used: it
downloads the binary on first invocation, mutating the cached entry after
the swap. See
[the placeholder gotcha](../gotchas/pnpm-12-placeholder-bin-runs-under-node.md)
for what the un-overlaid layout looks like from a runner.

## Stability

The protocol surfaces (`ActionCache`, `Artifact`, `BlobStore` and its
backends, `BlobEnvelope`, `CacheKey`, `ToolInstaller`,
`PackageManagerInstaller`) are the contract; `internal/` (the request
signer, the Twirp client, the results-backend reader) is not.


---
<!-- okf/interfaces/actions-reporting.md -->
---
type: Interface
title: actions-reporting
description: CheckState, ManagedDocument, GitHubMarkdown and CheckDocument — the living-document surfaces an action reports progress into.
status: stable
kind: api
resource: ../../packages/github-actions/src
tags:
  - architecture
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: ccef981ebe664a6beecefcbbfc4a6a6ce7e37a38f62e3dd6dab98dba7187c2c6
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:29.767Z
---

# actions-reporting

## Contract

Four modules answer one consumer shape: an action that reports progress
into a **living document** — a pull-request comment or check summary
rewritten as checks resolve. None of the four talks to GitHub; the
reconciler writes through a narrow sink the caller supplies, so the same
registry drives a pull-request comment, a check summary or a file, and the
API calls that carry any of it belong to [`github`](../modules/github.md)
and to the action composing them. `GitHubMarkdown.ts` is the only module
in this package permitted to import [`markdown`](../modules/markdown.md) —
see [bundle reachability](../modules/github-actions.md#bundle-reachability).

### `CheckState` — pure vocabulary

The states a run reports (running, pass, fail, warn,
user-interaction-required, skipped, timeout) plus the projection onto
GitHub's check-run status-and-conclusion wire. The conclusion literals are
mirrored **structurally** rather than imported, so the module never
reaches `github` — a check state is a reporting concept an action can hold
without linking an API client. A test pins the mirror against the real
union so the duplication cannot drift silently. Never "fix" this into an
import.

### `ManagedDocument`

A marker-delimited document: a sentinel comment identifies this action's
document among many, and named regions inside it are replaced from
current state while every byte the human wrote around them survives.
Create-or-update is one parse, not a find-then-branch. It is a thin
domain fixing of `templates`' section document (HTML comment style, a
fixed marker phrase, namespaced wire keys), not a second engine — the
region grammar, the line-ending invariant and the idempotence proof stay
in [`templates`](../modules/templates.md), under test there.

A region may carry `name="value"` metadata on its marker: `withRegions`
takes an optional triple alongside the existing two-tuple, and `meta` is
always present on the `regions` getter — never optional, so a reader never
branches on absence — but not addressable: `entry(key)` looks a region up
by key exactly as `region` does. `ManagedDocumentError`'s `invalidAttribute`
kind reports the consumer's region key, not the namespaced wire key.

### `GitHubMarkdown` — the writer

A fluent writer for GitHub's surfaces (tables, headings, links, code,
lists, collapsible sections, raw passthrough). Every member takes
pre-rendered markdown and returns a string, so compositions read as plain
string assembly — the writer owns the structure. This deletes the defect
where joining strings corrupts a table when a cell contains a pipe: a
cell's pipes are escaped, a fence inside a code block widens the fence,
and a URL with spaces is bracketed. The serializer's only failure is a
nesting-depth guard that is unreachable from this writer, because every
member wraps pre-rendered markdown in exactly one passthrough node, so a
composition nests strings, not trees — pinned by tests that nest the
writer's own output a thousand deep. `tableFor` requires a `format`
option for any non-string-encoded field rather than defaulting to
stringification; the serializer's impossible arm is a defect, not a
fallback.

### `CheckDocument` — the reconciler

An in-process registry of check reports, last-write-wins per check and
resolution non-terminal, projected onto a managed document by a scoped
background fiber and written through a narrow sink (a function from
rendered text to an effect, optionally paired with a read-back). Push, not
pull — nothing here polls GitHub. Trailing debounce with a max-wait
coalesces a burst into one write carrying its final state. A
byte-identical render issues no write at all. The finalizer is registered
before the daemon is forked, so it runs after the fork's own interruption
finalizer and the two cannot race for the sink; a background pass that
fails logs a structured warning and leaves the registry intact, and only
an explicit `flush` surfaces the typed error.

**The staleness guard** answers two workflow runs in flight against one
document. Without it, each pass reconciles against the last text *this
process* wrote, a process-local shadow, so a run never sees another run's
writes and happily rewrites over them. Two independent, opt-in mechanisms
close it: a sink `read` makes every pass reconcile against the live text
instead of the shadow; a per-run `stamp` (`{ at, runId }`) drops any pass
whose stamp is strictly older than the most recent stamp already on the
document, via `CheckDocumentStamp.isAtLeastAsRecent` — total and
reflexive, comparing `at` as epoch milliseconds when both sides parse as
dates and `runId` numerically when both sides are non-blank and finite,
falling back to lexical comparison otherwise. The blank guard on `runId`
is load-bearing: `Number("")` is a finite `0`, so a blank runId (the
ordinary case when `GITHUB_RUN_ID` is unset) would otherwise compare equal
to `"0"` and outrank `"-1"`. The stamp is a per-run constant, minted once
at startup, never per pass, which is what preserves the
byte-identical-render suppression; the accepted corner is that a
content-identical pass does not refresh the document's stamp, which is
sound because only a *strictly* older stamp drops. Unstamped regions are
ignored — evidence of a run that never opted in, not of a newer one.
`flush` answers `written | unchanged | stale`, and a drop announces
itself once, at the transition (INFO, then debug on repeats): the stamp
is constant, so a stale run stays stale, and a per-report line would bury
the one fact in the log a person reads when the report looks wrong.

The sink `read` carries the **same timeout bound as the write**, for the
same non-defensive reason: the pass holds the single permit and the
finalizer's last flush waits on it, so an unbounded read stalls scope
teardown. A failed read is `kind: "read"` — "GitHub would not tell us
the current comment" is a different problem from "the state could not be
rendered" (`render`) or "the write failed" (`sink`).

The guard narrows the window; it does not make the write atomic. A
read-then-write still races inside one pass, and nothing on GitHub's
comment API offers a conditional write to build a compare-and-swap on.
Never restate it as the stronger claim.

## Stability

`CheckState`, `ManagedDocument`, `GitHubMarkdown` and `CheckDocument` are
the contract surface. The sink function shape (`write`, optional `read`)
and the `stamp` option are part of the contract; the process-local shadow
used when neither is supplied is an implementation detail a consumer must
not rely on for multi-run correctness.


---
<!-- okf/interfaces/actions-attestation.md -->
---
type: Interface
title: actions-attestation
description: OidcTokenIssuer, ActionsIdentityToken and ActionsProvenance — the runner-shaped adapters that close sbom's inverted contracts.
status: stable
kind: api
resource: ../../packages/github-actions/src
tags:
  - architecture
  - security
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: e9e837ea5565f6677bab7e7e5b5262123491bac4cb51006f53c69119457ad6bf
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:24.796Z
---

# actions-attestation

## Contract

Three modules: the runner's OIDC token issuer, and two adapters —
`ActionsIdentityToken` and `ActionsProvenance` — that close
[`sbom`](../modules/sbom.md)'s inverted contracts. What lives here is the
runner-shaped half only: reading the token-request variables a workflow
grants itself with `id-token: write`, and handing the resulting identity
and workflow facts to a package that must not know it is running inside an
Action. What an attestation *is* — the statement, the predicate, the
envelope and the signing — stays in `sbom`.

The dependency edge points `github-actions → sbom`, never back: `sbom`
must not depend on the Actions runtime, so the adapters that close its
contracts live here. Taking the edge the other way would drag a required
`@effect/platform-node` peer into every SBOM consumer.

### `OidcTokenIssuer`

Lives here because it reads the runner's token-request variables, which
exist only when a workflow declares `id-token: write`. Its surface is the
token and the token's decoded claims — a typed value, not a nullable
hand-parse at the call site, which is what keeps the provenance path
testable with a synthetic decodable double.

The decode deliberately does **not** verify the JWT signature: the token
comes from the runner's own token-service endpoint over TLS, so the
transport is the trust boundary; the claims populate a provenance
predicate rather than a trust decision; and verifying would require a
key-set fetch, turning a pure decode into a network call. A consumer
needing a *verified* token needs a different operation with a different
name and a different error channel, not an option on this one.

### `ActionsIdentityToken`

The layer closing `sbom`'s identity contract over the issuer, so an action
wanting a signed attestation does not write the adapter itself. `sbom`'s
own static-token layer remains the path for a consumer that already holds
a token.

### `ActionsProvenance`

The projection from the runner's OIDC claims to `sbom`'s SLSA provenance
predicate. The predicate constructor is total and takes camelCase fields;
the only input a workflow holds is the runner's snake_case claims, and the
rename is eleven all-string fields, so transposing the repository id and
the repository-owner id compiles, typechecks and produces a validly
signed attestation asserting the wrong provenance — owning that rename
once is the module's whole point.

The server URL is read as an optional variable with a `github.com`
default, not through the strict context projection, because a missing
server URL has a correct answer (enterprise runners set it;
github.com consumers should never think about it) — the upstream toolkit
reads the same variable with no default and writes the literal string
`undefined` into every URL it builds. The OIDC error passes through
untouched — not caught, not defaulted, not wrapped — because whether
attestation is mandatory or best-effort is the consumer's own policy. The
construct ends at the predicate: statement assembly, signing and upload
stay consumer glue over `sbom`'s signer and `github`'s attestation
surface.

## Stability

`OidcTokenIssuer`, `ActionsIdentityToken` and `ActionsProvenance` are the
contract surface. The claims shape decoded by `OidcTokenIssuer` mirrors
GitHub's own OIDC token, which this package does not own and cannot pin
against a schema of its own.


---
<!-- okf/decisions/azure-blob-confined-to-three-modules.md -->
---
type: Decision
title: Azure is confined to three modules, not two
description: The Azure blob client may only be imported by ActionCache, Artifact and BlobStore.githubCache — not by any shared internal helper.
status: draft
tags:
  - bundle
  - architecture
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: e04e7165d8d74c4ef00c3ae09daafe8e957930422e18a3c06f506e6cea983bc2
---

# Azure is confined to three modules, not two

## Context

`@effected/github-actions` requires: a consumer that imports only an
outputs accessor must be unable to link `@azure/storage-blob`, the
package's heaviest external dependency
(`packages/github-actions/src/ActionCache.ts`,
`packages/github-actions/src/Artifact.ts`,
`packages/github-actions/src/BlobStore.githubCache.ts`). An outside
reading of the subsystem — "there's a cache and there's a blob store" —
suggests two modules need it. The Actions cache's own protocol hands back
an Azure blob URL for the payload, so the cache module needs the client
too, which makes three.

## Decision

Azure is imported by exactly these three protocol modules and nowhere
else. No shared helper under `packages/github-actions/src/internal/` may
import it, because an internal helper is exactly how a heavy import leaks
into a light module's graph. The three are separate named exports in
`index.ts`, never gathered into a namespace object — see
[no barrel re-exports](../conventions/no-barrel-re-exports.md) — since a
convenience object would make every one of them reachable from any of
them. `@effected/markdown` (confined to `GitHubMarkdown.ts`) and
`@effected/npm` (confined to `PackageManagerInstaller.ts`) are held to the
same rule for the same reason.

The confinement is checked, not promised, by
[the bundle-reachability suite](../conventions/bundle-reachability-suite.md)
(`packages/github-actions/__test__/reachability.test.ts`), which walks the
runtime import graph of `src` statically and asserts both that no module
outside the permitted set reaches Azure and that the permitted modules do
reach it. The second assertion exists because an earlier walker stripped
block comments before line comments and reported a module importing Azure
as importing nothing at all — a confinement test that can only pass, never
fail, is worthless, and this one failed silently in the safe direction,
which for a confinement test is the worst direction there is.

## Alternatives rejected

**Two modules (cache, artifact), with the blob store's GitHub-cache
backend routed through the artifact module's transport.** Rejected
because it would force a real dependency edge between two independently
useful protocols merely to keep the "two Azure modules" mental model
intact; the honest edge set is three, and pretending otherwise would make
the reachability suite assert a claim narrower than reality.

**A shared internal Azure adapter used by all three modules.** Rejected
because hoisting the client into `internal/` is exactly the move that
would make the confinement unenforceable — an internal helper importing
Azure gives every module that imports the helper an indirect edge to
Azure, and the reachability suite would have to widen its permitted set to
include the helper's importers, defeating the point.

## Consequences

Every heavy edge here — Azure, `markdown`, `npm`, and through `sbom` the
Sigstore stack — remains a **declared dependency** of the package
regardless of the confinement, so it is installed for every consumer and
a bundler's resolver still walks it. Import-graph confinement is not
resolver-graph absence; only a consumer that actually bundles and
tree-shakes (resting on `"sideEffects": false`, which the suite also
asserts, plus module-per-file build output) sees the module dropped. The
composed runtime layer in `Action.run` excludes the cache, artifact and
blob services for the same reason: folding them in would put Azure in the
bundle of every action that merely sets an output.


---
<!-- okf/decisions/platform-node-peer-in-one-package.md -->
---
type: Decision
title: "@effect/platform-node is a required peer in exactly one package"
description: github-actions is the only kit package with a required @effect/platform-node peer, because a GitHub Action always compiles into one Node process on a GitHub-provided runner; the licence is scoped to that overlay and does not generalize to any other package.
status: draft
tags:
  - architecture
  - bundle
sources:
  - id: github-actions-package
    resource: ../../packages/github-actions/package.json
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 4025479c90c2fda340c0d5300931adae4e0ca6297a0d5bd33014d595dc00f08d
---

# @effect/platform-node is a required peer in exactly one package

## Context

Most kit packages stay platform-neutral: they declare their IO through
core Effect contracts (`FileSystem`, `ChildProcessSpawner`, `HttpClient`)
and let the consumer supply a platform layer. `@effected/github-actions`
is different — it is the runtime for a GitHub Action, and a GitHub Action
always runs as a Node process on a GitHub-hosted or self-hosted runner.
The question was whether that one package should still carry the
platform abstraction the rest of the kit holds, or take the concrete
dependency directly.

## Decision

`@effect/platform-node` is a required peer dependency in exactly one
package: `@effected/github-actions`.[^github-actions-package] No other
package in the workspace lists it as a peer. The reasoning is that a
GitHub Action has exactly one platform — there is no second runtime an
action could plausibly target — so abstracting over a platform choice
that never varies would tax every consumer of this one package for a
choice nobody makes. The licence that follows is scoped narrowly to that
one overlay: only `github-actions` may import `node:` directly and
compose `NodeServices.layer`, and that licence does not generalize to the
next Node-shaped package the kit might add. A future package facing the
same "always exactly one platform" argument earns its own explicit
decision; it does not inherit this one by resemblance.

## Alternatives rejected

- **Keep `github-actions` platform-neutral, like every other package**,
  and let its consumer supply `@effect/platform-node`. Rejected because
  every real consumer of the package is, by definition, a GitHub Action
  running on Node — there is no consumer for which the platform is
  actually a variable, so the abstraction would be pure overhead with no
  corresponding flexibility.
- **Generalize the peer licence to any package with a similarly narrow
  runtime target.** Rejected — the licence is granted per package on its
  own argument, not as a standing exemption category. Widening it
  defensively would erode the platform-neutral posture that lets every
  other package stay usable from Node, Bun or Deno alike.

## Consequences

`@effected/github-actions` is the one package licensed to import `node:`
directly and to compose `NodeServices.layer` in its default runtime; every
other package's consumer supplies its own platform layer. Any new
package that wants the same licence needs its own decision record making
the same "exactly one platform, always" argument — this decision is not
precedent by default.

[^github-actions-package]: `packages/github-actions/package.json:52-55` —
    `"peerDependencies": { "@effect/platform-node": "catalog:effect:peers",
    "effect": "catalog:effect:peers" }`, the only `peerDependencies` block
    in the workspace naming `@effect/platform-node`.


---
<!-- okf/conventions/bundle-reachability-suite.md -->
---
type: Convention
title: Pin heavy-dependency confinement with a reachability suite that has a positive control
description: A structural test walks a package's runtime import graph to prove which modules may reach a heavy dependency, and must also prove it can fail.
status: stable
stale_after: "2027-03-13T00:00:00Z"
tags:
  - bundle
  - testing
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 70812bcecfba9d7e681b52adecbe16a6e42a0fa56ecba66c53c81aefea8395a9
---

# Pin heavy-dependency confinement with a reachability suite that has a positive control

Never assert a heavy-dependency confinement claim by inspection or by
convention alone — pin it with a `__test__/reachability.test.ts` that
walks the **runtime import graph of `src`** statically (type-only imports
skipped, since they are erased at build time) and asserts two things
together: that no module outside the declared permitted set imports the
heavy dependency, **and** that the permitted modules do import it. A test
that only asserts the first half can pass for the wrong reason — a walker
bug that under-reports imports produces a suite that is always green,
which is a confinement test that can never fail. This pattern is used by
[`github-actions`](../modules/github-actions.md) (Azure, `markdown`,
`npm` — see
[Azure is confined to three modules](../decisions/azure-blob-confined-to-three-modules.md)),
`github`, [`sbom`](../modules/sbom.md) (`@sigstore/*`) and `schema-org`.

Get the comment-stripping order right before trusting the walker at all.
Stripping block comments before line comments is the wrong order: a `/*`
token appearing inside prose in a **line** comment (for example the
backtick-quoted `` `@sigstore/*` `` in a doc comment) opens what the
walker treats as a block comment, deleting everything up to the next
`*/`-terminated doc comment — imports included. `packages/sbom/src` hit
this exactly: a module importing `effect` was reported as importing
nothing at all, because prose describing the confinement itself broke the
walker meant to check it. Strip line comments first. This failure mode is
silent and lands in the **safe** direction (nothing looks like it imports
the heavy dependency), which for a confinement test is the worst
direction there is, since a green suite gives no signal that anything is
wrong.

Be precise in the concept's prose about which graph the suite constrains.
It constrains the **import** graph of `src`, never the **resolver**
graph: a heavy dependency confined to N modules is still a declared
dependency of the whole package, so every consumer installs it and a
bundler's resolver walks it regardless of which module names it. Whether
an unreferenced module is then dropped from a consumer's bundle is the
bundler's decision, resting on the package declaring `"sideEffects":
false` (which the suite should also assert) plus module-per-file build
output. State the confinement claim as "no import edge exists, so a
tree-shaking bundler can drop the module" — never as "the dependency is
absent from the consumer's tree", which the suite does not prove and
resolver-graph reality contradicts whenever a sibling module inside the
same package takes the heavy edge for an unrelated reason (as
`github-actions` does through its `sbom` edge into the Sigstore stack).

Revisit this convention when a package's build moves off per-module
output or when a reachability suite is added without the positive-control
assertion, since either change reopens the failure mode this convention
exists to close.


---
<!-- okf/decisions/github-actions-per-reason-tagged-errors.md -->
---
type: Decision
title: github-actions errors are per-reason tagged unions, not one class with a reason field
description: ActionOutputError, BlobEnvelopeError, CacheKeyError and DetachedProcessError split into a union of classes rather than carrying a shared reason literal.
status: draft
tags:
  - architecture
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: d43c9a5b235b78c95e56b636cbf88bb2f33ad747d48028aee52dac1de7159cf4
---

# github-actions errors are per-reason tagged unions, not one class with a reason field

## Context

`@effected/github-actions` originally modelled a module's failure modes
as one error class carrying a `reason` string literal plus the one or two
fields whichever reason needed. `ActionOutputs`, `BlobEnvelope`,
`CacheKey` and `DetachedProcess` moved off that shape in favour of a
per-reason tagged union, while other modules in the same package remain
on the collapsed shape today.

## Decision

Split an error into a union of classes — one per reason — when the
reasons carry different fields, or when a caller plausibly recovers from
one reason alone. `ActionOutputError`, `BlobEnvelopeError`,
`CacheKeyError` and `DetachedProcessError` are all per-reason unions under
this test. Every exported *name* survives the split as a union type
alias (for example `CacheKeyError` is the union of its members), so no
signature changes and no consumer import breaks — a consumer that never
matched on `reason` never notices the split happened.

Under the split shape, every member carries exactly the fields its own
message needs, **non-optional**. Under the collapsed shape those fields
are all `optionalKey`, because different reasons need different fields on
one class, so a value constructed short a field is not a compile error —
it is a message that renders `"undefined"` at the exact moment someone is
reading logs to find out what broke. `ToolInstallerError.subject` being
required rather than optional is the same fix applied to a single field
rather than a full split.

`Effect.catchTag` can recover from one reason without catching the
others under the split shape; under the collapsed shape a caller
recovering from one reason has to write a `catchTag` plus an inner
`reason` check plus a re-fail, and the re-fail is the part that gets
forgotten.

An error whose reasons are a closed set over one shared field set stays
one class — there the discriminant *is* the whole information, and
splitting buys nothing but names.

## Alternatives rejected

**Split every error in the package uniformly, in one pass.** Rejected as
premature: the modules still on the collapsed shape are split candidates
by the same test as their own consumers grow, not before. `TarballError`
in `@effected/npm` is recorded as the same situation one package over —
the divergence is sequencing, not a second convention.

**Keep the collapsed shape and rely on documentation to warn about
optional fields.** Rejected because the failure mode is silent by
construction: a value constructed short a field is not a compile error,
so documentation cannot prevent the class of bug that a type-level split
prevents structurally.

## Consequences

A reader encountering a new error class in this package checks whether
its reasons share a field set before reaching for the collapsed shape by
default; a closed set over one shared field set stays one class, and a
set with per-reason fields or plausible partial recovery gets split from
the start rather than migrated later. The package carries both shapes
simultaneously by design during the transition, and a reviewer should not
read the collapsed modules as an oversight — they are split candidates
whose consumers have not yet demanded the split.


---
<!-- okf/invariants/ambient-process-state-read-once.md -->
---
type: Invariant
title: ActionEnvironment is the only reader of ambient process state
description: "In @effected/github-actions, process.env, process.arch and process.platform are read once, at ActionEnvironment's layer construction; every other read site is a caller-overridable default on a closed allowlist that __test__/ambientReads.test.ts scans src for and names on any new site."
status: stable
resource: ../../packages/github-actions/__test__/ambientReads.test.ts
tags:
  - testing
  - architecture
sources:
  - id: ambient-reads-test
    resource: ../../packages/github-actions/__test__/ambientReads.test.ts
  - id: action-environment
    resource: ../../packages/github-actions/src/ActionEnvironment.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: 22862c66bc5d9d71bea9c9e522aa8dd56b53dc8f57b3b98148d8f830822aad56
---

# ActionEnvironment is the only reader of ambient process state

## The property

`ActionEnvironment` reads `process.env` **once**, at layer construction,
into an immutable map held in a `Context.Reference`, and nothing in
[`github-actions`](../modules/github-actions.md) mutates it
afterwards.[^action-environment] Every other `process.env`,
`process.arch` or `process.platform` read in `src/` is a **defaulted
parameter a caller overrides**, never a read behind the caller's back:
`ActionInput.provider`'s ambient provider, `DetachedProcess.spawn`'s
`base` environment, the runner-arch and host-libc fallbacks in
`ToolInstaller`, `PackageManagerInstaller` and `internal/pnpmExe.ts`,
and `ToolInstaller.makeTest`. `ChildEnv` reads nothing ambient at all —
its `base` and `platform` are required arguments — and its class doc
states the rule.

Two consequences follow. `ActionEnvironment.withEnv` is fiber-local and
parallel-safe, because an override seeds a scoped copy of the map rather
than touching the process. And a variable exported mid-run (by
`exportVariable`, or by a child process) is **not** observed by an
already-seeded reader — the correct trade, since GitHub's own model
targets *subsequent* steps with an exported variable.

## Why it must hold

A second reader of `process.env` is a second source of truth. The
incident that motivated the rule found duplicate `GITHUB_SHA` reads with
divergent fallbacks, so which fallback won depended on which code path
ran first — see
[the env-shadowing gotcha](../gotchas/action-r-channel-erasure-and-env-shadowing.md).
A hand-rolled set/restore around `process.env`, which the package this
one replaced used for overrides, is not parallel-safe and admitted as
much in a comment.

## The mechanism

`__test__/ambientReads.test.ts` walks every `.ts` file under `src/`,
tokenizes it (string literals and comments are skipped, so prose
mentioning `process.env` never matches), and collects every
`process.env` / `process.arch` / `process.platform` token triple. Each
site must appear on an allowlist keyed on **file and line text** — not
line number, so an edit above a sanctioned site does not move it off the
list — and every allowlist entry carries a stated reason. An unlisted
site fails the suite naming the file and line; a listed site that no
longer exists fails too, so the list cannot grow stale in either
direction.[^ambient-reads-test]

## What would break it

Adding a `process.env` read anywhere in `src/` without adding it to the
allowlist with its reason, or widening the allowlist to admit a read that
is not a caller-overridable default. A new sanctioned default belongs on
the list; a new *reader* of the environment belongs in
`ActionEnvironment`.

[^ambient-reads-test]: `packages/github-actions/__test__/ambientReads.test.ts`
    — the tokenizing scanner, the `(file, line text)`-keyed allowlist with
    a reason per entry, and the two assertions (no unsanctioned site; every
    sanctioned site still present).
[^action-environment]: `packages/github-actions/src/ActionEnvironment.ts`
    — the layer that snapshots `process.env` into a `Context.Reference` at
    construction, and `withEnv`'s scoped override over that map.


---
<!-- okf/invariants/redacted-value-only-in-secret.md -->
---
type: Invariant
title: Secret.ts is the only place a Redacted becomes a string
description: "In @effected/github-actions, Redacted.value appears in exactly one source module, Secret.ts, whose every declassifying member masks through the runner's log filter before returning plaintext; a structural test scans src with comments stripped and asserts the set of unwrapping files is exactly that one."
status: stable
resource: ../../packages/github-actions/__test__/Secret.test.ts
tags:
  - security
  - testing
sources:
  - id: secret-module
    resource: ../../packages/github-actions/src/Secret.ts
  - id: secret-test
    resource: ../../packages/github-actions/__test__/Secret.test.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: aa362b8282d96bfe2306d475c50d8fd1596260d1118d4cb4ac9ff5af05663cdc
---

# Secret.ts is the only place a Redacted becomes a string

## The property

`Redacted.value` is called in exactly one file under
`packages/github-actions/src/`: `Secret.ts`. Every member of `Secret` that
returns plaintext — `forRunnerFile`, `forProcessEnv`, `forSigning`,
`forChildEnv` — registers the value with the runner's log filter
(`setSecret`) **before** any plaintext is returned, and `Secret.mask`
registers and stops there, so plaintext cannot be obtained in this
package without the runner's filter already knowing about
it.[^secret-module] Masking is the floor; declassification implies it.

The members are audit names over one mechanism, not four behaviours:
`forSigning` and `forProcessEnv` are `forRunnerFile` under a name that
says why the plaintext is needed. A **new** reason to hold plaintext is a
new member of `Secret`, never a `Redacted.value` call elsewhere —
`forSigning` exists because SigV4 needs raw bytes for an HMAC, and adding
it took one line.

The invariant is about where declassification happens, not about its
ordering. A detached worker inverts the ordering rather than the rule:
its stdout is a log file no runner parses, so a mask emitted inside it is
inert *and* writes the plaintext verbatim into the log. The parent masks
before the spawn via `Secret.forChildEnv` under the real layer, and the
worker composes `ActionOutputs.layerDetached`, under which `setSecret` is
a documented no-op — see
[the declassification seam](../interfaces/actions-runtime.md#secrets-the-declassification-seam).

## Why it must hold

`Redacted` cannot survive serialization by design, so every runner file,
child environment and signing call eventually needs a string. Making that
step explicit and confined is what makes it auditable: a grep for
`Redacted.value` answers the question "where can a secret leak?" with one
file. The structural test has caught two real leaks in the package's
lifetime.

## The mechanism

`__test__/Secret.test.ts` walks `src/`, **strips comments first** (line
comments, then block comments — the same order
[the reachability suite](../conventions/bundle-reachability-suite.md)
needs, and for the same reason: prose in a line comment containing `/*`
would otherwise open a phantom block that eats real code), and asserts the
set of files containing `Redacted.value` is exactly `{ "Secret.ts" }`. A
companion test asserts the guard is non-vacuous — the set is non-empty —
and two more pin the stripper itself, so a walker bug cannot turn the
assertion green by reporting nothing.[^secret-test]

Two neighbouring seams keep the invariant cheap to hold. The results
backend's runtime token is wrapped in `Redacted` at the read and leaves
only through `HttpClientRequest.bearerToken`, which accepts a `Redacted`
directly, so the Twirp path never touches the seam. And a plaintext
handoff on the far side re-enters through `Secret.adopt`, a
`Config.Redacted`, so a missing variable is a `ConfigError` naming it
rather than an empty secret that fails later as a 401.

## What would break it

A `Redacted.value` call in any other `src/` module, or an exception added
to the test's expected set. Either is the wrong fix: the right one is a
new `Secret` member with an audit name that says why the plaintext is
needed.

[^secret-module]: `packages/github-actions/src/Secret.ts` — the four
    declassifying statics, `mask`, and `adopt`, each with the TSDoc
    explaining the parent-masks-before-spawn rule for detached workers.
[^secret-test]: `packages/github-actions/__test__/Secret.test.ts` — "only
    Secret.ts unwraps a Redacted", "the guard can fail — it is asserting
    on a non-empty set", and the two comment-stripper tests.


---
<!-- okf/gotchas/action-input-default-swallows-validation-failure.md -->
---
type: Gotcha
title: A validation failure on an absent input silently resolves to the default
description: "Config.withDefault built over a missing-data classification swallows a validation error the same way it swallows a genuinely absent input — dry-run: yes silently becomes false."
status: stable
resource: ../../packages/github-actions/src/ActionInput.ts
stale_after: "2027-01-13T00:00:00Z"
tags:
  - security
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: e15d4a54dcdeaeb21328a53dc99f3cf76260dff1bdc53a5f3c56b205aaa6ba7a
---

# A validation failure on an absent input silently resolves to the default

## What a reader sees

A workflow author writes `dry-run: yes` intending to opt into a
boolean-flag input — the wrong literal for a boolean `Config` schema,
which expects `true`/`false`. The action runs to completion with no
error, no warning, and every mutation the workflow author meant to
rehearse actually happens, exactly as if `dry-run` had been left unset.

## What they will wrongly conclude

That the input was read correctly and defaulted safely — the same "empty
and unset are both missing" rule `@effected/github-actions` uses
everywhere else in `ActionInput`, behaving exactly as documented. Nothing
in the output distinguishes "the workflow never set this input" from "the
workflow set this input to a value that failed to parse."

## What is actually true

`Config`'s `withDefault` combinator is built on Effect v4's classification
of a failure as *missing data*, and an issue constructed with an absent
**actual** value — which is what a validation failure on a value that
never parsed produces — is classified the same way as a config key that
was never set at all. Nothing about the default combinator's signature
suggests the fallback depends on *how* the underlying failure was
constructed, so a value that failed to parse and a value that was never
present both fall through to the default. `dry-run: yes` therefore
resolves to `false`, silently, and the action performs every mutation the
"rehearsal" run was meant to skip. This is a v4 `Config` semantics trap,
not a typo in this package's code, and the issue built for the failure
does carry the offending value, which is what makes the failure
diagnosable once a reader knows to look for it.

## The check

Read the issue that a failed `Config.string`/`Config.boolean` decode
constructs before assuming a default-wrapped read degrades safely: an
issue with a present `actual` field distinguishes "this value failed to
parse" from "this key was never set," but `Config.withDefault` does not
make that distinction on the caller's behalf. `Action.run` installs an
input-aware `ConfigProvider` precisely so a bare accessor degrades to the
*correct* answer rather than to whatever default the schema declares, but
that provider does not change this classification — a value that parses
to the wrong type still resolves to the default rather than to a typed
failure. A workflow author's typo in a boolean or enum-shaped input value
is therefore only caught if the accessor's own tests specifically
construct a present-but-invalid value and assert a typed failure rather
than a defaulted success.


---
<!-- okf/gotchas/action-r-channel-erasure-and-env-shadowing.md -->
---
type: Gotcha
title: An `as never` cast and a second process.env read both compile clean and fail at runtime
description: Casting an unclosed R channel to never, and reading process.env outside ActionEnvironment, both typecheck and pass review — the failure surfaces only at run time, and only when the omitted layer or the shadowed variable actually matters.
status: stable
resource: ../../packages/github-actions/src/ActionEnvironment.ts
stale_after: "2027-03-13T00:00:00Z"
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 889d84e7905c0f6ca832645d868e62128b57bf64d785de48bea2977da0710982
---

# An `as never` cast and a second process.env read both compile clean and fail at runtime

## What a reader sees

A production entry point's `R` channel is coerced with `as never` to
satisfy `Effect.runPromise`'s zero-argument requirement, or a step reads
`process.env.GITHUB_SHA` directly instead of through
`ActionEnvironment`, sitting next to another read of the same variable
elsewhere in the codebase with a different fallback.

## What they would wrongly conclude

That both are harmless local shortcuts, since the build is clean, the
suite is green, and the cast or the direct read type-checks without
complaint.

## What is actually true

An `as never` cast on the `R` channel silences the compiler's proof that
every dependency the program needs is actually provided — a dropped
layer becomes a runtime failure at the first call site that needed it,
exactly where the type system exists to catch it at compile time instead.
Reading `process.env` outside the one designated environment authority
similarly compiles fine while creating a second source of truth: one real
incident found duplicate `GITHUB_SHA` reads with divergent fallback
values, so which fallback wins depended on which code path ran first, not
on anything visible in either read site.

## The check

Never cast the `R` channel to `never` — a production entry point should be
zero-arg by construction because every dependency is genuinely closed,
not because the type system was told to stop checking. Route every
runner-environment read through `ActionEnvironment` rather than a direct
`process.env` access, so there is exactly one place a variable's name and
fallback are decided, and grep for direct `process.env` reads outside it
as part of any review.


---
<!-- okf/gotchas/pnpm-12-placeholder-bin-runs-under-node.md -->
---
type: Gotcha
title: pnpm 12's placeholder bin dies as a SyntaxError when shimmed under node
description: A provisioned pnpm 12 that fails at first use with "SyntaxError - Invalid or unexpected token" at the toolcache's pnpm bin, line 1, is not a corrupt download or a Node fault — the pnpm bin is a shebang-less sh placeholder that only pnpm's install script replaces with the native binary, and a provisioner that skipped lifecycle scripts handed it to node.
status: stable
resource: ../../packages/github-actions/src/PackageManagerInstaller.ts
stale_after: 2027-01-17T00:00:00Z
tags:
  - ci
  - compat
sources:
  - id: installer
    resource: ../../packages/github-actions/src/PackageManagerInstaller.ts
  - id: pnpm-exe
    resource: ../../packages/github-actions/src/internal/pnpmExe.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-17T21:24:06Z
  body_sha256: 435d7e4d837104e76479195c43a4fa261d75d1ba4f56f9ce187787818cfd22f3
---

# pnpm 12's placeholder bin dies as a SyntaxError when shimmed under node

## What a reader sees

The first `pnpm` invocation after provisioning pnpm 12 on a runner dies
with

```text
<toolcache>/pnpm/12.x/<arch>/pnpm:1
# pnpm's native binary replaces this file during installation (see
SyntaxError: Invalid or unexpected token
```

— Node quoting the first line of the file it was asked to run, which is a
`#`-led comment. The install step itself reported success, and the same
pin works on a machine that installed pnpm through pnpm, corepack or
`npm install -g`.

## What they wrongly conclude

That the download was corrupt or truncated, or that the runner's Node is
broken, and that re-running the job or clearing the tool cache will fix
it. It will not: every fresh install produces the identical file, and a
runner that cached the entry keeps replaying it.

## What is actually true

From pnpm 12 the `pnpm` registry package is a thin wrapper. Its `pnpm`
bin is a shebang-less `sh` placeholder that the package's own `install`
lifecycle script overwrites with the host's native executable, fetched as
an `@pnpm/exe.<os>-<arch>[-musl]` optional dependency.[^pnpm-exe] Any
provisioner that extracts the tarball without running lifecycle scripts —
which is what every tool-cache installer does by design — ends up with the
placeholder in place, and any shim that treats "a pnpm bin" as a Node
script (`exec node <target>`) hands the shell placeholder to Node. The
comment line is the invalid token.

`@effected/github-actions` at 0.13.1 and below did exactly that; from
0.13.2 `PackageManagerInstaller` detects the layout from the manifest's
`@pnpm/exe.*` optional dependency, overlays the native binary itself, and
writes a shim by the target's kind rather than the manager's — and a
runner whose cache still holds the placeholder entry is healed on the next
install, because a cache hit is checked for the placeholder and reinstalled
over rather than trusted.[^installer] A runner provisioned by something
else that skips lifecycle scripts still hits the trap; the tell is always
the quoted comment line at `:1`.

See [`actions-storage`](../interfaces/actions-storage.md) for the
provisioning contract and
[the support policy](../conventions/package-manager-support-policy.md) for
which layouts the installer is expected to know.

[^pnpm-exe]: `internal/pnpmExe.ts` — the module comment describing the
    wrapper, the placeholder and the `@pnpm/exe.*` overlay.
[^installer]: `PackageManagerInstaller.ts` — `overlayNativeBinary`, the
    shim body `posixShim` chooses by `isNodeScript`, and the `isPlaceholder`
    cache-hit check that reinstalls over a stale entry.


---
<!-- okf/conventions/package-manager-support-policy.md -->
---
type: Convention
title: Support the current major and one back of every package manager
description: The kit provisions and models the current major and one major back of every package manager — pnpm 11 + 12 and npm 11 + 12, both pairs verified as of 2026-09-18 — detecting an artifact layout by what the manifest declares, never by major; older majors get no code paths, tests, fixtures or docs.
status: stable
stale_after: 2027-03-17T00:00:00Z
tags:
  - compat
  - deps
sources:
  - id: owner
    resource: conversation with the repository owner
    author: human:spencer
    last_modified: 2026-09-17T00:00:00Z
  - id: installer
    resource: ../../packages/github-actions/src/PackageManagerInstaller.ts
  - id: pnpm-exe
    resource: ../../packages/github-actions/src/internal/pnpmExe.ts
  - id: npm-12
    resource: npm:npm@12.0.2
  - id: npm-pack-json
    resource: ../gotchas/npm-12-pack-json-is-keyed-by-name.md
  - id: publish
    resource: ../../packages/npm/src/PackagePublish.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-19T02:46:28Z
  body_sha256: b9c198fd6cdf454ec365f654401600105568e75edac67bb338dbef4cfe331015
---

# Support the current major and one back of every package manager

Support **the current major and one major back** of every package manager
the kit provisions or models, and nothing older.[^owner] As of 2026-09-17
that window is pnpm 11 and 12 and npm 11 and 12; yarn and bun follow the
same rule. An older major is not a compatibility target: do not add a code
path, a test, a fixture or a paragraph of documentation for it, and remove
one that only an older major exercises when the window moves past it.

## The three surfaces the policy governs

- **`PackageManagerInstaller`** in
  [`github-actions`](../modules/github-actions.md) — the artifact layouts
  it can provision, documented from the consumer's side in
  [`actions-storage`](../interfaces/actions-storage.md). For pnpm the two
  in-window layouts are: pnpm 11, a Node entry at `bin/pnpm.mjs`; and
  pnpm 12, a shebang-less placeholder `pnpm` bin plus an
  `@pnpm/exe.<os>-<arch>[-musl]` native binary overlaid from the same
  registry.[^installer]
- **[`npm`](../modules/npm.md)** and
  **[`package-json`](../modules/package-json.md)** — they model the
  **latest `package.json` shape as npm 11 and 12 define it**. Previous
  shapes and deprecated fields are out of scope; do not model a field
  only an out-of-window npm reads.

## Detect a layout by artifact, never by major

The major is a hint; the layout is the contract. Decide which provisioning
path applies from what the extracted manifest declares — pnpm's
native-binary layout is recognised by an `@pnpm/exe.*` entry in the
wrapper's `optionalDependencies`, not by `version >= 12` — so a layout that
moves inside a major, or a major that keeps its layout, is handled without
a version table to keep current.[^pnpm-exe] A version-keyed branch is
exactly the code this rule forbids adding.

## What the window has cost so far

Moving the window to a new major is never "verification only" by default;
each of the two moves so far found one real break, and each in a different
surface. pnpm 12 changed the *artifact*: the `pnpm` bin became a placeholder
for a native binary, and provisioning it needed the overlay step. npm 12
changed a *program output* the kit decodes: `npm pack --json` went from an
array to an object keyed by package name, and `PackagePublish` (which
shells `pack --json` for `pack` and `dryRun`) rejected every npm 12 answer
as unreadable until it accepted both shapes.[^npm-pack-json][^publish] The
installer itself needed no change for npm 12 — `npm@12.0.2`'s `bin` is
unchanged (`bin/npm-cli.js`, `bin/npx-cli.js`) — and the verification is a
runtime probe: both `npm@12.0.2` and `npm@11.19.1` provisioned into a tool
cache and answering `npm --version` through their shims, with the
same-major near miss (ambient `12.0.1` for a `12.0.2` pin) going to the
tool cache rather than being accepted as close enough.[^npm-12]

The third surface, the manifest fields, was swept for npm 12 and found
nothing to model. npm 12 adds three root-only fields — `allowScripts`,
`packageExtensions` and `patchedDependencies` — and each is project policy
with no kit behaviour attached, so each rides through `PackageManifest`'s
`rest` untyped, exactly as `overrides` and `workspaces` do; no typed field
was deprecated (`man` is retained), and `npm-shrinkwrap.json`, which 12 no
longer honours, is referenced nowhere in the kit. The rule that decided
it: a root-only field the kit never reads stays in `rest`; a field is
typed when a kit surface consumes it.

The installer does not read an artifact's `engines.node` against the
runner's node. `npm@12.0.2` declares `^22.22.2 || ^24.15.0 || >=26.0.0`;
pinned under a node outside that set (24.9.0, say) it installs, runs, and
prints `npm warn cli npm v12.0.2 does not support Node.js v24.9.0` on
every invocation. Keeping the node pin and the manager pin coherent is the
consumer's job, made where it pins node; the kit surfaces nothing beyond
npm's own warning.

When the window moves next, sweep three things: the artifact layout the
installer extracts, every `--json` output the kit decodes from the manager,
and the manifest fields the manager reads or writes. Read the release
notes' breaking-change list against those three, then prove each with a
probe rather than trusting "bin shape unchanged" as the whole story.

[^owner]: The window, the three governed surfaces and the npm 12 status
    were stated by the repository owner on 2026-09-17.
[^installer]: `PackageManagerInstaller.ts` — the pnpm layout notes on
    `readPackageManifest` and the `overlayNativeBinary` step.
[^pnpm-exe]: `internal/pnpmExe.ts` — the module comment: detection is by
    layout, never by major version.
[^npm-12]: The `npm@12.0.2` packument: `dist-tags.latest`, `engines.node`
    and `bin`. Runtime probe 2026-09-18 on macOS arm64 against the real
    registry: `npm@12.0.2` and `npm@11.19.1` provisioned to a tool cache
    with integrity, shims answering `12.0.2` / `11.19.1`; under node
    24.9.0 the 12.0.2 cli ran and printed npm's own unsupported-node
    warning, under 22.23.2 and 26.9.0 it did not.
[^npm-pack-json]: The gotcha recording the `pack --json` shape change and
    the tell in `PublishError`.
[^publish]: `PackagePublish.ts` — the `PackJson` codec accepting both the
    array and the name-keyed shape.


---
<!-- okf/glossary/github-split.md -->
---
type: Glossary
title: The github-split (program name)
description: "\"The github-split\" names the joint program that carved five packages — commands, templates, github, github-actions and sbom — out of @savvy-web/github-action-effects and the mechanism half of @savvy-web/silk-effects, replacing both wholesale across six consumer repos."
status: stable
tags:
  - architecture
sources:
  - id: github-actions-package
    resource: ../../packages/github-actions/package.json
  - id: commands-package
    resource: ../../packages/commands/package.json
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 72a725d0fc21d10c17726402b079e87647f731b4c6b9ad3a95d84119d8c559f7
---

# The github-split (program name)

"The github-split" is this repository's name for the joint program that
introduced five packages together, as one unit rather than five
independent ports: `@effected/commands`, `@effected/templates`,
`@effected/github`, `@effected/github-actions` and
`@effected/sbom`.[^github-actions-package] The name refers to the
program, not to any one package — a reader who hears "the github-split
five" should understand all five packages, and a reader who hears "the
github-split program" should understand the whole migration effort, not
a single extraction.

## The three structural facts

Three structural facts about the program's design recur across the five
packages' own decisions:

- **`github-actions` is the one package with a required
  `@effect/platform-node` peer**, and the only one licensed to import
  `node:` directly — see [the platform-node peer decision](../decisions/platform-node-peer-in-one-package.md).
  `@azure/storage-blob` is confined to three of its modules, so a
  consumer importing `ActionOutputs` alone cannot link it.
- **`commands` stays boundary tier only because the workspaces edge
  inverts** — a direct `commands` → `workspaces` dependency edge would
  have made four packages integrated, a pure one (`lockfiles`) among
  them, under the dependency policy's tier-propagation rule. See
  [contract inversion is the default](../decisions/contract-inversion-default.md).
- **`sbom` declines `@cyclonedx/cyclonedx-library` and owns its own
  CycloneDX emitter** — the library weighs 6.6 MB with seven optional
  peers, and its `spdx-expression-parse` peer is the exact engine
  `@effected/spdx` exists to replace.

## The five extended packages

The program also extended five already-published packages rather than
adding new ones: `@effected/npm` (retiered to boundary, guardrailed),
`@effected/workspaces` (release and tracking tags, a versioning strategy,
the `LocalExec` layer, the publishability seam), `@effected/config-file`,
`@effected/package-json` and `@effected/markdown`.

## The three in-kit edges dogfood added

After the initial split, consumer dogfooding added three in-kit
dependency edges onto `@effected/github-actions`: `@effected/templates`,
`@effected/markdown` and `@effected/sbom`.[^commands-package] None of the
three changes `github-actions`' own tier — it was already integrated and
nothing depends on it — and each edge stays confined to the modules that
actually need it, pinned by the same bundle-reachability test suite that
confines `@azure/storage-blob`. One of the three closes the inverted
contract described above: `sbom` declares the `IdentityToken` contract
and `github-actions` ships the layer implementing it. Read this as the
general shape consumer dogfood takes against an already-shipped
program: the requests were projections between packages the kit already
had, not requests for new capability, so every edge it produced points
from the integrated overlay downward to packages it already depended on
transitively.

[^github-actions-package]: `packages/github-actions/package.json:36-41`
    — `@effected/github`, `@effected/glob`, `@effected/markdown`,
    `@effected/npm`, `@effected/sbom` and `@effected/templates` under
    `dependencies`, the five-plus-one shape the split program produced.
[^commands-package]: `packages/commands/package.json` — the sibling
    package in the same program, whose own dependency surface stays
    narrow under the contract-inversion pattern described above.


---
<!-- okf/modules/github.md -->
---
type: Module
title: "@effected/github"
description: The kit's typed GitHub REST and GraphQL API layer, owning the octokit runtime.
status: stable
kind: package
resource: ../../packages/github
tags: [bundle, architecture]
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: acf1afc161d550b734b64ea4682399759e0b4fb9282f314d05725a19294c03b6
---

# @effected/github

`@effected/github` is the kit's typed GitHub API layer: one client over
GitHub's REST and GraphQL endpoints, plus the resource services that turn raw
endpoints into domain operations. It owns the octokit runtime so that
[`@effected/github-actions`](github-actions.md) and the consumer repositories
never take an octokit edge themselves.

Three properties define the package:

1. **Nothing is `unknown`.** octokit ships a complete, generated, types-only
   description of every GitHub endpoint. `client.request("GET
   /repos/{owner}/{repo}", { owner, repo })` types both the parameters and the
   returned data from the route literal alone — see
   [the REST client interface](../interfaces/github-rest-client.md).
2. **A light consumer cannot reach a heavy engine.** The client, the repo
   coordinate and most resource services import only octokit core and its
   paginator; the JWT signer and the sealed-box crypto pair are each confined
   to one module. See [Bundle reachability](#bundle-reachability).
3. **Errors are sized to what consumers read**: a reason string, a status, an
   operation name and a structural `kind` — see
   [errors and retry](../interfaces/github-errors-and-retry.md).

Scope is closed by the consumer repositories, not by GitHub's API. An endpoint
earns a resource method when a consumer needs it typed; everything else is
reachable through the typed request surface without a cast, so "not modelled"
never means "not usable".

The contract lives in five child interfaces:

- [The typed REST surface](../interfaces/github-rest-client.md) — the
  route-is-the-key mechanism, the client shape, the escape hatch for routes
  outside the generated map, and the pagination model.
- [Errors and resilience](../interfaces/github-errors-and-retry.md) — one
  classification step, the structural `kind`, and the single retry policy
  driven by GitHub's own headers.
- [App authentication](../interfaces/github-app-auth.md) — the JWT engine,
  the token lifecycle, and the seam `@effected/github-actions` builds its
  bridge on.
- [The resource services](../interfaces/github-resources.md) — what each
  resource owns: upserts, say-once semantics, projections, the
  configuration-write half, the check-run bracket, byte budgeting, the
  permission comparator, and attestation metadata.
- [GraphQL](../interfaces/github-graphql.md) — typed documents and which of
  them this package owns.

See also [why `github` owns the octokit runtime](../decisions/github-owns-octokit-runtime.md).

## Tier and dependencies

**Integrated tier**, per [the tier taxonomy](../glossary/library-tier.md) —
it owns the octokit runtime, which is the whole reason the package exists:
interpreting GitHub's API is a concern that should exist once, typed, in a
package named for it.

| Dependency | Why |
| --- | --- |
| `@octokit/core` | the `Octokit` class: a route-keyed, fully typed `request`, plus `graphql` |
| `@octokit/plugin-paginate-rest` | the composable paginator over a bare core instance, plus the type that statically rejects paginating a non-paginating route |
| `@octokit/types` | the generated endpoint map; ships no JavaScript — types only |
| `universal-github-app-jwt` | signs the App JWT; zero dependencies |
| `tweetnacl` + `blakejs` | the libsodium sealed box GitHub's secrets API requires, reachable only from `RepositorySecret` |
| `@effected/semver` (`workspace:^`) | semver-aware tag selection; pure tier, so the edge is free |
| `@effected/github-references` (`workspace:^`) | the compat re-export of six issue-reference names — see [`github-references`](github-references.md) |

**The crypto pair is not a free-hand choice, and `node:crypto` is not an
alternative.** A sealed box is `crypto_box` under an ephemeral keypair with a
nonce derived as `blake2b(ephemeral_pk ‖ recipient_pk, 24)`
(`packages/github/src/internal/crypto.ts`); Node ships neither X25519
`crypto_box` nor blake2b, so the choice was these two leaves or a full
libsodium build. Treat a third non-octokit dependency added here as a fresh
decision, not a free ride on this one. `blakejs`'s `blake2b` must be imported
as a default import: Node's `cjs-module-lexer` detects `blake2b` as a named
export and not its nine siblings, so a named import works for one function
and throws for its neighbour at runtime after a clean build
(`packages/github/src/internal/crypto.ts:5-13`).

`@octokit/rest` and `@octokit/auth-app` are deliberately absent and must not
be reintroduced. `@octokit/rest` bundles a request-log plugin this package
would immediately silence, plus megabytes of generated types duplicating
`@octokit/types`. `@octokit/auth-app` re-exports an OAuth user-auth factory,
making hundreds of kilobytes of OAuth app, user and device-flow machinery
reachable from a package that only ever mints installation tokens; what is
actually needed — an RS256-signed App JWT plus one typed token-endpoint
route — comes from `universal-github-app-jwt` directly, the same
zero-dependency leaf `@octokit/auth-app` itself depends on.

## Bundle reachability

The tree-shakability invariant is measured:

| A consumer that imports… | links | does **not** link |
| --- | --- | --- |
| the client, the repo coordinate, the route vocabulary, any resource service but `RepositorySecret` | octokit core and the paginator | the JWT signer, the crypto pair |
| the App service or its client layer | the above plus the JWT signer | the crypto pair |
| `RepositorySecret` | the above plus `tweetnacl` and `blakejs` | the JWT signer |
| the pure classes | nothing but `effect` | all octokit |

Three mechanisms carry it:

1. **Module-per-layer-variant.** The token and config client layers live in
   `GitHubClient.ts`, which imports only octokit core and the paginator; the
   App-authenticated client layer lives in `GitHubApp.ts`, the only module
   importing the JWT signer.
2. **No namespace object, anywhere** — see
   [no barrel re-exports](../conventions/no-barrel-re-exports.md). The entry
   point re-exports by name only, so referencing one member never retains
   every member's whole module graph.
3. **The pure surface is genuinely pure.** The permission comparator, bot
   identity, the repo reference, the comment marker, the check-run output
   budgeter and the retry policy are schema classes in modules importing
   nothing but `effect`. The closing-reference grammar is the case that
   moved out entirely — see [`github-references`](github-references.md) —
   because hosting a pure vendor rule "in the kit" turned out not to mean
   "in this package": keeping it here cost nothing to `github`'s own
   consumers and cost the octokit-free ones the whole client tree. `github`
   keeps a six-name compat re-export and nothing else.

This invariant gets a test rather than a promise:
`packages/github/__test__/reachability.test.ts` walks the runtime import
graph of `src` statically (type-only imports skipped, since they are erased),
asserting the token-only client does not reach the JWT signer and that the
App module does, and that `RepositorySecret` reaches the crypto pair while no
other resource service does. It constrains the import graph, not the
resolver graph: the claim is "no edge exists, so a tree-shaking bundler can
drop it," not "it is absent from any particular consumer's bundle."

## Module topology

Module-per-concept, no barrels, `src/index.ts` re-exports only. `src/` holds
the route vocabulary and the client, the App module, the repo coordinate,
resilience, GraphQL, one module per resource service, and the pure permission
comparator; `src/internal/` holds the octokit factory, the pagination
engine, the crypto leaf, the id funnel and header parsing.

Repository settings live on `GitHubRepository`, not in a service of their
own, because the endpoint a settings service would want is one
`GitHubRepository` already owns — module-per-*concept* deciding it, not a
size judgement. A candidate settings module once collided with the
`RepositorySettings` type alias the entry point already exported, silently,
because `tsc`, the bundler and API Extractor all accept a name collision when
a valid export by that name already exists.
`packages/github/__test__/reachability.test.ts` now asserts every module in
`src/` is re-exported from the entry point, which is the only check that
could have caught it, since nearly every per-module test file imports its
module path directly rather than through the entry point.

## The repo coordinate

Every resource method takes `Repo` in its `R` and no method takes owner and
repo arguments (`packages/github/src/Repo.ts`), which is what makes a
resource call a single expression and what makes a scoped override work:

```ts
yield* Effect.forEach(targets, (target) => syncOneRepo.pipe(Repo.provide(target)), { concurrency: 4 });
```

**Resolving `Repo` per call rather than once at layer construction is
load-bearing.** If a resource resolved both the client and the repository at
construction, a scoped override would silently do nothing, because the
resource would already hold the repository it was built with. The client
stays resolved at construction; the coordinate is read per call. The general
rule this refines: resolve a dependency once when it is stable, per call
when varying it is the point.

**The scope of a method follows the API, never the consumer's call
pattern.** An org-scoped route still sources its org from `Repo.owner` when
the org *is* the repository's owner; only a method needing an org that is
not the repository's owner takes an explicit argument. `Repo` is also a
deliberate exception to "no non-effectful members on a service shape": its
entire shape is one immutable value class, `Layer.succeed` is the correct
double for it, and the exception holds only while the shape is entirely one
value with no methods.

## Actions decoupling

Three places where GitHub-Actions-runtime knowledge could leak into this
layer, and what keeps it out instead:

| Leak avoided | Replacement |
| --- | --- |
| rerouting octokit's request log into a workflow command | octokit's log is silenced, and the client logs its own retries with `Effect.logDebug`; `@effected/github-actions` maps Effect logs onto workflow commands through a `Logger` |
| reading the repository slug from the environment | [the repo coordinate](#the-repo-coordinate), with the env-driven layer variant named for what it does |
| reading the token from the environment | the config-provider client layer, over a redacted config |

There is no token masking here (that is an Actions output command), no state
persistence (an installation token is merely encodable so
`@effected/github-actions` can persist it), and no workflow-command import of
any kind. This package reads no environment variable except through a
`Config` in a layer variant named for being env-driven, and is otherwise
runnable anywhere.

## Shared vocabulary

- **One canonical semver model.** `@effected/semver` is pure tier, so the
  edge is free, and returning a real semver value is what lets a consumer
  compare tags without re-parsing.
- **The repo reference, pull-request info, installation tokens, check-run
  output and release data are canonical here**, and
  `@effected/github-actions` consumes rather than duplicates them.
- **A digest is a small deliberate duplication.** An attestation subject
  digest and a lockfile integrity hash are different concepts wearing
  similar clothes, and taking a dependency edge across a seam to share a
  branded string is not worth it; this package declares its own.
- **The release-tag format authority stays in `@effected/workspaces`.** This
  package's tag-name-to-version extraction is a parsing convention, not the
  tag-format authority.

## Testing

`@effect/vitest`, `it.effect`, `assert.*` — never `expect`; tests in
`__test__/`. There is no `./testing` subpath.

- Every service ships `makeTest(overrides?)` and `layerTest(overrides?)`,
  with unstubbed members dying loudly and naming themselves.
- Tests drive the real client through octokit's documented `fetch` option
  (`packages/github/__test__/fixtures.ts`), not a double of this package's
  own service, so classification, header capture, retry and
  link-following pagination are all genuinely exercised. A hand-built
  response has an empty URL, and octokit's paginator constructs a URL from
  it for any payload carrying a total count, so the harness must define
  that property or the failure gets classified as a transport fault
  instead. octokit percent-encodes path parameters, so assertions run
  against the recorded decoded path rather than the URL.
- One recorded-fixture client double (`GitHubClient.layerFixture`) exists
  and reimplements nothing: it pages recorded arrays through the same
  pagination engine the live layer uses and records the page requests it
  issued (`RecordedCall`, carrying `kind` and params), which is what makes
  truncation testable and what makes normalising writes testable.
- An unstubbed fixture route dies naming the route (`unstubbed: "die"`, the
  default); a recorded `GitHubError` value is how a suite stubs a 404, a 422
  or a rate limit deliberately. A missing fixture is test wiring, not a
  domain outcome, and a typed failure is only loud in code that does not
  catch — a consumer catching `GitHubError` per resource turns a missing
  stub into a different execution path whose failures name no fixture.
  `"fail"` restores the typed not-found and `"empty"` serves an empty value
  for a suite whose subject is decisions rather than endpoints; `graphql`
  ignores the setting and always dies, since no empty payload decodes
  against a document's schema. `fixtures.requested` records every call as a
  `RecordedCall` — `kind`, `route` (the document name for `graphql`), the
  params it was made with, and `perPage` for a paginated read — so a suite
  can assert what a method *sent*, which is the question a normalising
  write turns on.
- Repairing fixtures after a route moves is where a false green gets
  manufactured — see
  [repaired fixtures go green on an impossible state](../gotchas/repaired-fixtures-go-green-on-impossible-state.md).
- Pure classes get pure tests, with no layer at all; the byte budgeter gets
  a property test over multi-byte and four-byte code points.
- A pagination-forwarding test exists per paginating method.
- The App suite generates a real RSA key and signs for real.
- Mutating the edges — the page bound, the byte budget, the already-exists
  classification, the retry predicate — is expected to turn the suite red.

Run subset suites root-relative with coverage disabled.

## Observability and build

Named spans on every public fallible boundary, with stable identifiers only
in annotations — the route, the coordinate, the resulting status, the page
count, the failure kind — and never a token, a private key, a request or
response body, or GraphQL variables (which routinely carry node ids and
comment bodies). Retries log at debug, one line per retry, and that is the
only logging in the package. There are no metrics: the spans are there for a
consumer to derive counters from, at whatever cardinality the consumer
chooses.

Build through `pnpm build --filter @effected/github`. Naming third-party
generic types on a public signature is fine — API Extractor resolves a
declared dependency's types as externals — so the only suppressed build
entries are the synthesized schema-class bases. A `static readonly layer`
must wrap its factory in an arrow or it throws an access-before-initialization
error at import time while typechecking clean
(`packages/github/src/GitHubClient.ts`).

## See also

- [`github-references`](github-references.md) — the extracted issue-reference
  grammar and the compat re-export back into this package.
- [why `github` owns the octokit runtime](../decisions/github-owns-octokit-runtime.md)
- [the GraphQL schema is not owned here](../limitations/github-graphql-schema-not-owned.md)
- [branch reset closes an open pull request](../gotchas/branch-reset-closes-pull-request.md)
- [repaired fixtures go green on an impossible state](../gotchas/repaired-fixtures-go-green-on-impossible-state.md)
- [the compat re-export is droppable](../decisions/github-compat-re-export-droppable.md)
- [the github-split program](../glossary/github-split.md)
- [the tier taxonomy](../glossary/library-tier.md)
