# @beep/github-actions

The GitHub Actions runtime for [Effect](https://effect.website) v4: the services an action needs to talk to the runner it is executing inside. `Action.run` composes the runtime, runs your program through `NodeRuntime.runMain`, renders a failure as an `::error::` annotation and leaves the exit code to the runtime's teardown; `Action.main` is the same run as an Effect, for tests and custom runners. `ActionInput` reads workflow inputs as typed `Config` values — string, boolean, integer, redacted secret, multiline list, `key=value` pairs, or a schema-decoded JSON blob — with one absence rule shared by every accessor: unset and `""` are both missing data. `ActionOutputs`, `ActionState`, `ActionLogger` and a fiber-local `ActionEnvironment` round out the runner surface, alongside `ActionCache`, `Artifact`, a metadata-carrying `BlobStore` (S3-compatible or the runner's own cache), `OidcTokenIssuer` and `ToolInstaller` for the heavier protocols. The reporting suite that renders what a run did onto a pull request comment, a check run or the job summary now ships as `@beep/github-reporting`. No `@actions/*` dependency anywhere — the cache, artifact and tool-cache protocols are implemented directly against their HTTP APIs.

## Why @beep/github-actions

`@actions/core` and its siblings (`@actions/cache`, `@actions/artifact`, `@actions/tool-cache`) are the standard way to write an action, and each one owns its own ad hoc contract: inputs are read with `getInput`, which returns `""` for both "unset" and "set to empty" with no way to tell them apart at the type level; outputs, masking and workflow commands are separate globals; and the cache and artifact clients bring their own HTTP stacks. This package answers the same questions as one coherent set of Effect services instead, with the absence rule stated once (`Config.withDefault` is the idiom for every optional input) and every mutation running through the same `R`-typed services a test can swap out.

It is also the **one place in the kit** where `@effect/platform-node` is a required peer, deliberately: a GitHub Action always compiles into a Node process on a GitHub-provided runner, so there is no second platform to abstract over. Everything that *can* go through a core contract still does — `ToolInstaller` downloads over `HttpClient` and extracts over `ChildProcessSpawner`, `CacheKey` reads over `FileSystem` — and the four sanctioned `node:` imports (`node:crypto` for digests, `process.kill` for reaping a bare pid, `node:child_process` for a detached spawn, and `node:zlib`/`node:stream` in the cache and artifact codecs) cover exactly what core cannot do yet.

The line against `@beep/github` is exact: that package talks to the GitHub API, this one talks to the runner. They meet at two seams — the token bridge (`GitHubToken`) and the `Logger` that maps `Effect.log*` onto workflow commands — and nothing here reads `process.env.GITHUB_REPOSITORY` on `github`'s behalf.

Requires Node.js >=24.11.0. `effect` v4 and `@effect/platform-node` are both dependencies. The package is ESM-only: import it from an ES module.

## Usage

### Quick start

```ts
import { Action, ActionInput, ActionOutputs } from "@beep/github-actions";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const name = yield* ActionInput.string("name").pipe(Config.withDefault("world"));
  const outputs = yield* ActionOutputs;
  yield* outputs.set("greeting", `Hello, ${name}!`);
});

// The action's entry script: runMain sets the exit code, 0 on success and 1 after
// a failure renders as an ::error:: annotation.
Action.run(program);
```

`Action.run` provides `ActionServices` (environment, logger, outputs, state, the Node platform and an `HttpClient`) by default. A capability with a heavier dependency — the cache, artifacts, the blob store — is one extra line: `Action.run(program, { layer: ActionCache.layer })`.

Nothing in the package writes `process.exitCode`. `Action.main(program, options?)` returns an `Effect<void, ActionFailedError>`: it renders a failed program's cause as `::debug::` and `::error::` lines, then fails with an `ActionFailedError` marked with `Runtime.errorExitCode` `1` and `Runtime.errorReported` `false`. `Action.run` hands that effect to `NodeRuntime.runMain` with error reporting off, so the teardown exits `1` after a failure, `130` after a cancelled job's signal, and lets a success exit `0`. Pass `{ teardown }` to replace the teardown, for example to read the verdict in a test without exiting the process.

Step debugging works without wiring: when the runner sets `RUNNER_DEBUG=1`, `Action.run` lowers Effect's minimum log level to `Debug`, so `Effect.logDebug` calls show up as `::debug::` lines. It only ever lowers the level; pass `{ stepDebugLogLevel: false }` to keep it as it is.

### Reading inputs

Every accessor shares one absence rule: the runner writes `""` for an input the workflow omitted, and this package reads that the same as unset — **missing data**, not an empty value. An optional input needs `Config.withDefault` (or `Config.option`) at the call site:

```ts
import { ActionInput } from "@beep/github-actions";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));
  const paths = yield* ActionInput.list("paths").pipe(Config.withDefault([]));
  return { dryRun, paths };
});
// dryRun: boolean; paths: readonly string[] — [] when the input was omitted
console.log(Effect.isEffect(program)) // true
```

`list` accepts a JSON array, a bullet list, or comma- and newline-separated values, with full-line `#` comments dropped — whichever shape a workflow author reaches for first. A **present but malformed** value (`dry-run: yes` instead of a YAML 1.2 boolean) is a different class from an absent one: it fails carrying its `actual` and is never silently swallowed by a default.

### The token bridge

`GitHubToken` shapes GitHub App authentication like the three-phase workflow it runs inside: mint in `pre`, use in `main`, revoke in `post`. Nothing survives between phases except what `GITHUB_STATE` carries, so an installation token — which lives about an hour — is persisted rather than held in a `Scope`:

```ts
import { GitHubToken } from "@beep/github-actions";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Layer from "effect/Layer";

// pre:
const pre = GitHubToken.provision({
  appId: "123456",
  privateKey: Redacted.make("example PEM private key"),
  owner: "acme",
  required: { contents: "write", pull_requests: "write" },
});

// main: bind once — layers memoize by reference
const ClientLayer = GitHubToken.clientLayer();

// post:
const post = GitHubToken.dispose();
console.log(Effect.isEffect(pre) && Layer.isLayer(ClientLayer) && Effect.isEffect(post)) // true
```

`GitHubToken.read` fails typed with `reason: "expired"` rather than handing back a token GitHub will answer with a bare 401 — the credential that could re-mint one is the app's private key, and persisting that through a plaintext `GITHUB_STATE` file would trade a one-hour token for a permanent one.

### Secrets

`Secret` is the only place in this package a `Redacted` value becomes a plain string, and masking and declassification are the same call — every member registers the value with the runner's `::add-mask::` filter *before* returning plaintext:

```ts
import { Secret } from "@beep/github-actions";
import * as Redacted from "effect/Redacted";
import * as Effect from "effect/Effect";

const token = Redacted.make("example-token");

const program = Effect.gen(function* () {
  const env = yield* Secret.forChildEnv({ MY_TOKEN: token });
  // every value in `env` is already masked in the runner log
  return env;
});
console.log(Effect.isEffect(program)) // true
```

### The runner's cache, artifacts and OIDC

`ActionCache` and `Artifact` speak the Actions Twirp v2 protocol directly — no `@actions/cache` or `@actions/artifact` dependency, and both are excluded from `ActionRuntime.layer` on purpose, so a consumer that only sets an output never links `@azure/storage-blob`:

```ts
import { Action, ActionCache, CacheKey } from "@beep/github-actions";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

const program = Effect.gen(function* () {
  const cache = yield* ActionCache;
  const key = CacheKey.of("Linux", "pnpm-store", "abc123");
  const hit = yield* cache.restore(["~/.pnpm-store"], key);
  if (O.isNone(hit)) {
    yield* cache.save(["~/.pnpm-store"], key);
  }
});

const run = () => Action.run(program, { layer: ActionCache.layer });
console.log(Effect.isEffect(program) && typeof run === "function") // true
```

`CacheKey.withNamespace(segment)` is the cache-bust case — a run that must match nothing an unbusted run wrote, and whose own entries must be invisible to unbusted runs:

```ts
import { CacheKey } from "@beep/github-actions";

const key = CacheKey.of("Linux", "pnpm-store", "abc123").withNamespace("bust7");
console.log(key.key, key.restoreKeys);
// bust7-Linux-pnpm-store-abc123 []
```

Two decisions make that safe for any segment value, with no prefix reasoning at the call site. The segment goes **first**, so the namespaced key shares no prefix with an unnamespaced one — a restore key is a prefix match, and folding a bust token in later leaves an ordinary run's rung prefix-matching busted entries. And the ladder is **dropped**, so no rung reaches outside the namespace even when the segment happens to equal an ordinary leading segment. It is a safe default rather than a prohibition: follow with `withRestoreDepths` for a deliberate in-namespace ladder.

`CacheKey.hashFiles` is byte-compatible with `@actions/glob`'s `hashFiles`, and `OidcTokenIssuer.claims` decodes the runner's OIDC token for a SLSA provenance predicate without verifying its signature — the token arrived over TLS from the runner's own token service, so the transport is the trust boundary and nothing here branches on the claims for authorization.

`ActionsProvenance.capture` turns those claims into a `@beep/sbom` `SlsaProvenance` predicate, and `ActionsIdentityToken.layer` serves that package's narrow `IdentityToken` contract from the same issuer — the inversion that keeps the Actions runtime out of every consumer that only wants to emit an SBOM. A signer (the deferred `@beep/sigstore`) takes `IdentityLayer` as its identity:

```ts
import { ActionsIdentityToken, ActionsProvenance, OidcTokenIssuer } from "@beep/github-actions";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

const program = Effect.gen(function* () {
  const provenance = yield* ActionsProvenance.capture();
  return provenance.runDetails.builder.id;
});
// the builder id, derived from the workflow ref in the runner's own claims

const IdentityLayer = ActionsIdentityToken.layer.pipe(Layer.provide(OidcTokenIssuer.layer));
console.log(Effect.isEffect(program) && Layer.isLayer(IdentityLayer)) // true
```

An `OidcTokenError` passes through `capture` untouched: whether an unattested publish is allowed is the action's policy, not this package's. `reason: "unavailable"` almost always means the workflow is missing `permissions: id-token: write`.

### Reporting on GitHub surfaces

The reporting suite (`GitHubMarkdown`, `ManagedDocument`, `CheckState` and `CheckDocument`) ships as `@beep/github-reporting` since wave 3-1 of `goals/effected-promotion`. Its usage, features and port notes are in `packages/foundation/modeling/github-reporting/README.md`. Import the root (`CheckState`, `ManagedDocument`, `CheckDocument`) from `@beep/github-reporting` and the writer from `@beep/github-reporting/GitHubMarkdown`.

### Typed failures

Four failure types in this package are **tagged unions of one error class per reason** rather than a single class carrying a `reason` field: `ActionOutputError`, `BlobEnvelopeError`, `CacheKeyError` and `DetachedProcessError`. Every one of those names still exists and still means the same set of outcomes, so no signature changed — each is now a type alias over its members:

| Union | Members |
| ----- | ------- |
| `ActionOutputError` | `RunnerFileUnavailableError`, `RunnerFileWriteError`, `InvalidOutputNameError`, `OutputEncodeError`, `DetachedOutputError` |
| `BlobEnvelopeError` | `NotABlobEnvelopeError`, `TruncatedBlobEnvelopeError`, `UnsupportedBlobEnvelopeVersionError`, `BlobMetadataDecodeError`, `BlobMetadataEncodeError` |
| `CacheKeyError` | `CacheKeyReadError`, `CacheKeyBadPatternError` |
| `DetachedProcessError` | `DetachedLogUnavailableError`, `DetachedSpawnFailedError`, `InvalidPidError`, `DetachedSignalFailedError`, `DetachedNotReadyError` |

**Breaking, and how to migrate.** Code that branched on `error.reason` matches on `_tag` instead, which is what buys the split: one failure can be handled on its own with `Effect.catchTag`, and the rest stay in the error channel rather than being caught by a handler that only meant to answer one of them.

```ts
import { CacheKey } from "@beep/github-actions";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

const digest = CacheKey.hashMatching({ workspace: ".", patterns: ["**/pnpm-lock.yaml"] }).pipe(
  Effect.catchTag("CacheKeyBadPatternError", () => Effect.succeed(O.none<string>())),
);
// Effect<Option<string>, CacheKeyReadError, FileSystem | Path>
// a bad pattern becomes "no digest"; a read failure stays in the error channel
console.log(Effect.isEffect(digest)) // true
```

### Testing

Every service ships `makeTest(overrides?)` and `layerTest(overrides?)`, with unstubbed members dying loudly and naming themselves — three recorded exceptions state why they default instead: `ActionEnvironment.makeTest` seeds the twelve `GITHUB_*`/`RUNNER_*` variables, `ActionLogger.makeTest` defaults to silent, and `DryRun.makeTest` defaults to rehearsing, the safe direction. `ActionEnvironment.makeTest`/`layerTest` also take the webhook event payload as an optional second argument, serving it directly instead of routing it through a `GITHUB_EVENT_PATH` filesystem read the stubbed filesystem could never satisfy:

```ts
import { ActionEnvironment } from "@beep/github-actions";
import * as Layer from "effect/Layer";

const layer = ActionEnvironment.layerTest(
  { GITHUB_EVENT_NAME: "pull_request" },
  { pull_request: { number: 42 } },
);
console.log(Layer.isLayer(layer)) // true
```

```ts
import { ActionOutputs } from "@beep/github-actions";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";

const TestOutputs = ActionOutputs.layerTest({
  set: dual(2, (_name: string, _value: string) => Effect.void),
});
console.log(Layer.isLayer(TestOutputs)) // true
```

`OidcTokenIssuer.layerFor(claims)` returns a real decodable unsigned JWT built from the same claims `claims()` reports, and `BlobStore.layerMemory` runs the real envelope framing — both exist because a synthetic double previously made the provenance path structurally untestable.

## Features

- `Action.run` / `Action.main` / `ActionRuntime.layer` — the entry point (process boundary and Effect form) and default runtime: environment, logger, outputs, state, the Node platform and an `HttpClient`.
- `ActionInput` — typed input accessors (`string`, `boolean`, `integer`, `redacted`, `lines`, `list`, `pairs`, `schema`) sharing one absence rule, plus the `INPUT_`-aware `ConfigProvider` `Action.run` installs by default. `pairs` always rejects an empty key (`=value`, whose damage lands far from the typo) and takes `requireValue` to reject an empty value too.
- `ActionOutputs` — step outputs, JSON outputs, the job summary, exported variables, `PATH` additions, failure annotations and log masking.
- `ActionState` / `ActionEnvironment` — persisted `pre`/`main`/`post` state, and the fiber-local `GITHUB_*`/`RUNNER_*` context read once from `process.env`.
- `ActionLogger` — collapsible groups, buffered step transcripts (`withBuffer({ onSuccess: "discard" })` drops a green step's transcript entirely, while a failure, defect or interruption still flushes it), `withStep(name, effect, options?)` for the same buffering plus one summary line on success and a `❌ <name>` header above the transcript on failure, `::notice::` annotations, and the `Logger` that renders every `Effect.log*` as a workflow command.
- `DryRun` — the rehearsal guard every mutation goes through, driven by the `dry-run` input by default.
- `Secret` — the one declassification seam between a `Redacted` value and a plain string, masking before it returns plaintext.
- `GitHubToken` — the App-token lifecycle shaped like the `pre`/`main`/`post` workflow: mint, verify scopes, persist, read, revoke.
- `ActionCache` / `Artifact` — the runner's cache and artifact protocols over Twirp v2, excluded from the default runtime so a consumer that skips them never links Azure.
- `CacheKey` — cache keys and their restore-key ladder, `withNamespace(segment)` for a bust token or a shared-runner prefix, plus `hashFiles`/`matchingFiles`/`hashMatching` byte-compatible with `@actions/glob`.
- `OidcTokenIssuer` — the runner's OIDC token service, with unverified claim decoding for provenance predicates.
- `ActionsIdentityToken` / `ActionsProvenance` — the `@beep/sbom` seam: `layer` serves that package's `IdentityToken` contract from the runner's issuer, and `capture` builds a `SlsaProvenance` predicate out of the runner's OIDC claims.
- `ToolInstaller` — download, extract and cache a toolchain in the runner's tool cache, with no `@actions/tool-cache` dependency; `ToolInstallerError` always names its `subject`.
- `BlobStore` — durable `get`/`put`/`has` over `StoredBlob<A>` values (bytes plus caller-schema metadata; the type was named `Blob<A>` before, which collided with the global), backed by `layerS3` (SigV4-signed, no `@aws-sdk/*` dependency) or `GitHubCacheBlobStore.layer` (the runner's own cache); `layerMemory` runs the real envelope framing for tests.

## Named importers

- `@beep/repo-cli` — the `ci` commands publish their runner files through `ActionOutputs`
  (`commands/Ci/CiRunnerOutputs.ts` seeds `ActionEnvironment` from the current `ConfigProvider`): `ci job-env`
  exports `GITHUB_ENV` entries, `ci admission` publishes its four step outputs, and `ci append-turbo-summary`,
  `ci rerun-runner-loss` and `ci runner-resources` append to the job summary.

## Development

```sh
# from the repository root
bun run beep quality package-verify @beep/github-actions

# from packages/drivers/github-actions
bun run check
bun run test            # Bun (the package test runner)
bunx vitest run         # Node
```

The real-process suites (`ActionCache`, `Artifact`, `ToolInstaller`, `PackageManagerInstaller`,
`DetachedProcess`) need `tar`, `unzip` and `zip` on `PATH`; they reach the host through
`test/support/host.ts` and never import a builtin.

## Provenance

Promoted from the effected lab (`scratchpad/effected/github-actions` and `scratchpad/test/github-actions`, last held at
`0129fc7312803f833b3319d30fcc9646302c66f6`) in wave 5 of `goals/effected-promotion`. The lab suite was 957/957 under
Node and Bun before the move (#2223); the package suite is
971/971 under Node and Bun after it (the `unstubbed` test moved with its module to `@beep/utils/TestDouble` and the
`IeeeNumber` tests to `@beep/schema`, and the property, schema and coverage tests below were added). The
port reviews and the canon exceptions are archived under `goals/effected-promotion/history/`. The
`github-actions` row of the lab `PORT_LEDGER.json` (deleted when the packet closed; read it with
`git show bb2134fcb952e07580c4cebf2586c901f090ef5b:scratchpad/effected/PORT_LEDGER.json`) keeps the lab-era evidence
under the pre-promotion `scratchpad/test/github-actions/` paths; the lab-era deviations below cite them as recorded
there. They resolve at `0129fc7312803f833b3319d30fcc9646302c66f6`, except the four reporting suites (`CheckDocument`,
`CheckState`, `GitHubMarkdown`, `ManagedDocument`), which left in wave 3-1 and resolve at
`6964eeb85b28da7cf38913b041242d0467e94abf`.

## Port notes

### Attribution

- Upstream package: `@effected/github-actions` 0.20.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (beep-effect notice plus the verbatim upstream MIT notice)
- Vendored-engine notices: none. The `licence` hits in `src/internal/cacheService.ts`, `src/internal/digest.ts` and
  `src/internal/sigv4.ts` are prose about which modules may import a `node:` builtin, not licence headers.

### Added exports

| Export | Facets | Why |
| --- | --- | --- |
| `InvalidActionStateNameError` | value, type | Added by review round 1; see the deviations below. |
| `InvalidDigestLengthError` | value, type | Added by review round 1; see the deviations below. |
| `MissingProcessIdError` | value, type | Added by review round 1; see the deviations below. |

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row (see Provenance).

Wave 5 (the promotion itself), each pinned by tests in this package:

- **schema-first** — Every exported option bag and result record is a branded `S.Opaque` with an `Encoded` companion
  (`ReadinessOptions`, `ToolDownloadOptions`, `ClientLayerOptions` and the message `Frame` were interfaces; the lab
  structs were bare `S.Struct`s; `RunnerContext`, `RecordedOutput`, `OidcClaims` and both package-manager variants were
  `S.Class`). Inputs take `X.Encoded`, or `X.Admitted` where a field is already a branded value
  (`PackageManagerInstallOptions`, `ClientLayerOptions`); results are admitted once with `X.make`, which copies nested
  values, so instance checks are `S.is` checks. (test/*.test.ts codec property per schema-heavy suite;
  test/internal/durationInput.test.ts)
- **exact-optional-keys** — Optional fields are `S.optionalKey` (EF-40), so an explicit `undefined` is rejected where
  upstream accepted it; the explicit-undefined tests were inverted to pin the rejection in the lab (#2223, W4-j) and
  move with the suite. (test/ActionInput.test.ts; test/Artifact.test.ts;
  test/PackageManagerInstaller.test.ts)
- **numeric-domains** — A `Duration.Input` option accepts finite counts only; an unbounded budget is spelled
  `Duration.infinity` or `"Infinity"`. (test/internal/durationInput.test.ts)
- **upstream-bug** — `DetachedProcess.reap` classifies the `ESRCH` of an already-exited child from the wrapped cause,
  so a dead pid reaps as `false` instead of failing (fixed in the lab by #2223, carried here). (test/DetachedProcess.test.ts
  "reports a real exited child as false")
- **reachability** — The suites read `src` through a raw-glob walker over `@beep/test-utils/ImportGraph`, so the
  reachability, ambient-read and declassification suites touch no filesystem and run under Bun; the one Azure
  boundary is `src/internal/azureBlob.ts`. (test/reachability.test.ts)

Lab era:

- **native-runtime** — Effect hash collections, ordered check snapshots, scoped Logger.layer and Clock/DateTime replace native structures and wall-clock paths; zone-less stamps read as UTC. (scratchpad/test/github-actions/CheckDocument.test.ts:222,365; scratchpad/test/github-actions/BlobStore.test.ts:230; scratchpad/test/github-actions/Artifact.test.ts:392; scratchpad/test/github-actions/ActionLogger.test.ts)
- **identity-keys** — IdentityComposer keys replace upstream service/reference identities and change CacheKey/ManagedDocument JSON Schema definition paths. (scratchpad/test/github-actions/CacheKey.test.ts:583; scratchpad/test/github-actions/ManagedDocument.test.ts:305)
- **tagged-errors** — Schema tagged errors with retained messages replace native Error/RangeError values, and the five public replacements are exported (`UnhandledCheckStateError` and `RejectedRegionDialectError` moved to `@beep/github-reporting` in wave 3-1). (scratchpad/test/github-actions/CacheKey.test.ts:245; scratchpad/test/github-actions/ActionState.test.ts:58; scratchpad/test/github-actions/Exports.test.ts:16)
- **schema-first** — Runtime schemas, LiteralKit domains and schema JSON codecs replace interfaces, asserted guards and native JSON paths, changing malformed-JSON cause/diagnostic identity. (scratchpad/test/github-actions/ActionInput.test.ts; scratchpad/test/github-actions/ActionEnvironment.test.ts:239; scratchpad/test/github-actions/ActionState.test.ts:156; scratchpad/test/github-actions/CheckState.test.ts:9; scratchpad/test/github-actions/DetachedProcess.test.ts:110)
- **numeric-domains** — Finite schemas narrow numeric domains while integer filters and the non-finite InvalidPidError payload contract remain explicit. (scratchpad/test/github-actions/CacheKey.test.ts; scratchpad/test/github-actions/DetachedProcess.test.ts:160; scratchpad/test/github-actions/Artifact.test.ts:193; scratchpad/test/github-actions/ActionEnvironment.test.ts:150)
- **type-safety** — Typed narrowing and the authorized wrong-input helper replace assertions; null installer JSON now takes typed failure paths. (scratchpad/test/github-actions/deliberatelyInvalid.ts; scratchpad/test/github-actions/GitHubMarkdown.test.ts:173; scratchpad/test/github-actions/ActionsIdentityToken.test.ts; scratchpad/test/github-actions/CheckDocument.test.ts:21)
- **tsgo-diagnostics** — Diagnostic-driven lazy Effects, dual overloads, heredoc options, typed sink errors, scoped provision and builtin/Config loading replace upstream API shapes. (scratchpad/test/github-actions/Artifact.test.ts:165; scratchpad/test/github-actions/ActionOutputs.test.ts:71; scratchpad/test/github-actions/CheckDocument.test.ts:21; scratchpad/test/github-actions/ambientReads.test.ts:143; scratchpad/test/github-actions/reachability.test.ts:32)
- **effect-first** — Effect functions, helpers, Console and explicit scoped service composition replace generator/native helper paths and add lawful trace frames. (module suite scratchpad/test/github-actions/**)
- **effect-imports** — Per-module Effect imports replace the effect root barrel in source, tests and carried examples. (module suite scratchpad/test/github-actions/**)
- **identity-annotations** — File-local IdentityComposer identities and annotations replace literal or incomplete schema/service metadata. (module suite scratchpad/test/github-actions/**)
- **test-environment** — Lab source paths, the installed TypeScript 7 alias and a module-local manifest replace upstream workspace test assumptions. (scratchpad/test/github-actions/ambientReads.test.ts:6,26; scratchpad/test/github-actions/reachability.test.ts:518,530)
- **reachability** — Exact lab dependency sets and runtime-builtin scanning replace the upstream static/package graph while retaining dependency confinement. (scratchpad/test/github-actions/reachability.test.ts:32,176,293,307,363,530)
- **upstream-bug** — Buffer envelope decoding makes an independent body copy instead of sharing the input frame storage. (scratchpad/test/github-actions/BlobEnvelope.test.ts:68)
- **upstream-bug** — Accepted __proto__ input pairs survive as own properties instead of disappearing through the prototype setter. (scratchpad/test/github-actions/ActionInput.test.ts:287)
- **upstream-bug** — Environment lookups use own properties so prototype values cannot appear present or shadow configured strings. (scratchpad/test/github-actions/ActionEnvironment.test.ts:73,88)
- **upstream-bug** — Artifact listings reject malformed non-finite numeric rows instead of successfully returning unusable ids/sizes. (scratchpad/test/github-actions/Artifact.test.ts:193)
- **upstream-bug** — S3 URLs encode raw key segments consistently with signing instead of treating reserved key characters as URL syntax. (scratchpad/test/github-actions/BlobStore.test.ts:175; scratchpad/test/github-actions/sigv4.test.ts:15,38)
- **upstream-bug** — S3 joins and signing preserve empty path segments so repeated/trailing-slash keys remain distinct. (scratchpad/test/github-actions/BlobStore.test.ts:199; scratchpad/test/github-actions/sigv4.test.ts:15,31,48)
- **upstream-bug** — Literal two-dot filenames contribute to matching and hashing instead of being rejected as parent paths. (scratchpad/test/github-actions/CacheKey.test.ts:448)
- **upstream-bug** — Installer shim validation rejects escaping bin names before writes instead of accepting out-of-package destinations. (scratchpad/test/github-actions/PackageManagerInstaller.test.ts:1645)
- **upstream-bug** — Finalize/delete results decode finite IDs and reject invalid supplied IDs through malformed ArtifactError with a SchemaError cause; missing IDs retain upload 0 and delete found.id defaults. (scratchpad/test/github-actions/Artifact.test.ts:130)
- **upstream-bug** — Resolved paths containing LF or CR fail with archiveFailed and an offending-path diagnostic before manifest creation, tar or backend operations. (scratchpad/test/github-actions/ActionCache.test.ts:843)
- **upstream-bug** — An ancestor-prefix pass removes recursively covered paths while retaining surviving order, symlink boundaries and original literal-pattern version hashing. (scratchpad/test/github-actions/ActionCache.test.ts:890)
- **upstream-bug** — GET, PUT and HEAD reject complete . or .. segments as misconfigured BlobStoreError before signing or HTTP execution; other raw segments and encoding remain intact. (scratchpad/test/github-actions/BlobStore.test.ts:168,210)
- **upstream-bug** — Both node and direct-executable shims single-quote the complete target with embedded-quote escaping, preserving literal paths and argument forwarding. (scratchpad/test/github-actions/PackageManagerInstaller.test.ts:642)
- **upstream-bug** — Windows rejects quotes, percent/exclamation expansion markers and control bytes anywhere in a complete target with layoutUnexpected before any shim write; separators and ordinary quoted metacharacters remain accepted. (scratchpad/test/github-actions/PackageManagerInstaller.test.ts:1918,1934)
- **upstream-bug** — Windows-only validation rejects reserved device stems, including case/extension and superscript-digit variants, through layoutUnexpected before writes; POSIX acceptance remains unchanged. (scratchpad/test/github-actions/PackageManagerInstaller.test.ts:1882)
- **upstream-bug** — R.assignProperty retains __proto__ as an own bin property, publishing its path and shim alongside normal bins. (scratchpad/test/github-actions/PackageManagerInstaller.test.ts:656)
- **upstream-bug** — R.assignProperty preserves the enumerable own __proto__ plaintext property in the plain record while retaining masking order. (scratchpad/test/github-actions/Secret.test.ts:61)
- **upstream-bug** — POSIX zip argv inserts -- before filenames, treating leading-dash paths literally; the Windows command remains unchanged. (scratchpad/test/github-actions/archiveCommands.test.ts:34)
- **identity-annotations** — These newly annotated checks carry identity-derived identifiers, titles and descriptions; CacheKey constraints and NamePart gain named JSON Schema definitions/references while preserving validation bounds, grammar and messages. (scratchpad/test/github-actions/CacheKey.test.ts:608,656; scratchpad/test/github-actions/ManagedDocument.test.ts:328,338)
- **schema-first** — BlobStore.ts exports an identity-annotated S3Config Struct and its same-name derived type, preserving plain-object construction, string/redacted fields and absent or explicit-undefined optional fields. (scratchpad/test/github-actions/BlobStore.property.test.ts:27,29)
- **upstream-bug** — Live and recording addPath reject CR or LF with InvalidOutputNameError before append or journal mutation. (scratchpad/test/github-actions/ActionOutputs.test.ts:86,523)
- **upstream-bug** — Retention and expiration are validated before scratch, archive, RPC or transfer; invalid values fail with invalidOptions, and valid expiration is anchored at preflight. (scratchpad/test/github-actions/Artifact.test.ts:170)
- **upstream-bug** — Encoding checks the serialized metadata through the caller codec and returns BlobMetadataEncodeError for unreadable frames; supported bytes remain identical. (scratchpad/test/github-actions/BlobEnvelope.test.ts:141)
- **upstream-bug** — Encoded state must pass S.Json before serialization or append; rejection is notPlainJson and the subsequent caller-codec decode check remains. (scratchpad/test/github-actions/ActionState.test.ts:191)
- **upstream-bug** — Direct lookup uses own-property R.get, retaining own-entry precedence, aliases and empty-string handling. (scratchpad/test/github-actions/ActionInput.test.ts:76,85)
- **upstream-bug** — Explicit NaN fails with invalidOptions before archiving; direct uploads retain finite and positive/negative infinity clamping. (scratchpad/test/github-actions/Artifact.test.ts:175,198)
- **upstream-bug** — Only Windows paths normalize separators; POSIX resolved backslash paths fail archiveFailed before manifest, tar or upload. (scratchpad/test/github-actions/ActionCache.test.ts:106)
- **upstream-bug** — Requests validate HTTP endpoints through misconfigured errors, refuse search/hash, and sign the complete transmitted encoded prefix plus object path; SigV4Request gains optional encodedPathPrefix. (scratchpad/test/github-actions/BlobStore.test.ts:158,215; scratchpad/test/github-actions/sigv4.test.ts:113)
- **upstream-bug** — Non-Windows prepending selects exact PATH; Windows retains case-insensitive own-key selection and pathKeyOf remains case-insensitive. (scratchpad/test/github-actions/ChildEnv.test.ts:98,104)
- **upstream-bug** — The selected key is read through own-property R.get, excluding prototype values while preserving Windows own-key casing. (scratchpad/test/github-actions/ChildEnv.test.ts:110,118)
- **upstream-bug** — Audience requests parse the base, append an encoded query parameter using ? or &, retain fragments, and fail requestFailed for invalid URLs before HTTP. (scratchpad/test/github-actions/OidcTokenIssuer.test.ts:72,166)
- **upstream-bug** — Package roots cannot be symlinks; bin, overlay and shim paths must stay within the real package root before access or mutation, while internal symlinks remain accepted. (scratchpad/test/github-actions/PackageManagerInstaller.test.ts:344)
- **upstream-bug** — POSIX and Windows Node-script shims place -- before the literal target, preserving direct-executable shims and argument forwarding. (scratchpad/test/github-actions/PackageManagerInstaller.test.ts:419)
- **upstream-bug** — POSIX unzip orders -oq and -d destination before -- and the source; Windows extraction and tar command shapes are preserved. (scratchpad/test/github-actions/archiveCommands.test.ts:219,226)
- **upstream-bug** — Binary destinations must remain strictly inside normalized and resolved cache roots; escapes fail cacheFailed before copying or cache-hit probing. (scratchpad/test/github-actions/ToolInstaller.test.ts:256)
- **upstream-bug** — Caller headers normalize into one record; ordinary collisions combine in input order, generated headers replace caller values, and signed/returned headers agree. (scratchpad/test/github-actions/sigv4.test.ts:62,94)
- **upstream-bug** — Every retargeted native bin must exist before shim creation, reuse or return; missing .exe targets fail layoutUnexpected. (scratchpad/test/github-actions/PackageManagerInstaller.test.ts:399)
- **upstream-bug** — heredocBlock accepts optional lineEnding; ActionOutputs and ActionState choose CRLF on Windows and LF otherwise, preserving payload bytes. (scratchpad/test/github-actions/runnerFile.test.ts:33,40; scratchpad/test/github-actions/ActionOutputs.test.ts:66; scratchpad/test/github-actions/ActionState.test.ts:40)
- **upstream-bug** — Publication invalidates a stale marker first and creates an empty marker only after successful rename; invalidation, publication and marker errors fail cacheFailed. (scratchpad/test/github-actions/ToolInstaller.test.ts:287,333)
- **schema-first** — 32 owning-file schema values and same-name derived types now model these contracts, including PairsOptions, CheckRunProjection, SigV4Request and TwirpFailure; plain-object construction and operation-owned defaults remain, and root type re-exports stay type-only. (scratchpad/test/github-actions/ActionInput.test.ts:35; scratchpad/test/github-actions/internal/twirp.coverage.test.ts:24)
- **numeric-domains** — New UploadOptions, ZipCommandOptions, ProvisionOptions, SpawnOnceResult and TwirpFailure schemas use S.Finite for these numeric fields; schema decoding rejects NaN/infinities while direct upload and zip builders retain infinity clamping and existing collectors remain unchanged. (scratchpad/test/github-actions/Artifact.test.ts:122; scratchpad/test/github-actions/archiveCommands.test.ts:19; scratchpad/test/github-actions/GitHubToken.test.ts:32; scratchpad/test/github-actions/internal/twirp.coverage.test.ts:24)

### Dependency backlog

None.

## License

[MIT](LICENSE)
