# #1879 target-filesystem atomic-exchange capability: record

Lane `residue-target-exchange`, branch `feat/residue-target-exchange` off `main`
`426d494b34`, 2026-10-20. Route: ruling S39/S41, a Claude-originated residue lane
worked by a `claude-opus-5-5` child (wave 8, first of #1879, #1880, #1881). Source
evidence: finding F3-F2 in the predecessor
[F-R3 fix wave](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/SPEC.md#f-r3-bounded-shell-links--panel-round-3-fix-wave-2026-10-15).

## Problem

Before this change `ModelsAtomicExchange` probed `mv --exchange` once per service, in
an OS temporary directory, and cached one boolean. That proved exchange support on
the temporary directory's filesystem, not on the filesystem that holds the native
target. The check also ran inside publication, after the backup and the journal had
been written.

## Design

Schema first, then the service contract, then the implementation.

1. **Schema** (`packages/tooling/tool/cli/src/commands/Models/Models.exchange.schemas.ts`):
   - `ModelsExchangeUnsupportedReason`, a `LiteralKit` of `exdev`, `einval`, `eperm`,
     `enosys` and `unknown`.
   - `ModelsExchangeFilesystemIdentity`: `device` (the `stat` dev of the target's
     parent directory, a bigint) and `filesystemType` (an `Option` of the type the
     host reports). `modelsExchangeIdentityKey` derives the cache key from both.
   - `ModelsExchangeCapability`, a `TaggedUnion` of `supported` and
     `unsupported { reason, detail }`.
   - `ModelsExchangeQualification`: `{ directory, identity, capability }`.
   - Errors (`Models.errors.ts`): `ModelsExchangeProbeError` (the probe could not
     run) and `ModelsExchangeFault` (one exchange was refused, with its reason).
     `ModelsLocatorError.reason` widens from `ineligible` to the `LiteralKit`
     `ModelsLocatorRefusal`, which adds `exchange-unsupported` and
     `exchange-probe-failed`.
2. **Contract** (`Models.apply.service.ts`):
   - `ModelsExchangeSystemShape { identify, exchange }` holds the host primitives.
     The live primitives are GNU `stat --file-system --format=%T` and
     `mv --exchange --no-copy` (renameat2 `RENAME_EXCHANGE`), both run with `LC_ALL=C`.
   - `ModelsAtomicExchangeShape { exchange, qualify }`. `qualify(target)` returns a
     `ModelsExchangeQualification` or fails with `ModelsExchangeProbeError`.
     `exchange` keeps its `ModelsLocatorError` channel and its retain-artifacts
     message, and now adds the reason and the host text.
   - `makeModelsAtomicExchange(system)` builds the cached capability from any
     primitives. `ModelsAtomicExchangeLive` is the same constructor over the live
     primitives.
3. **Implementation**:
   - `qualify` stats the target and its parent, then identifies the parent's
     filesystem. A target whose dev differs from its parent's (a bind-mounted file)
     is `unsupported`/`exdev` without probing.
   - Otherwise it looks up the identity key under a one-permit semaphore. On a miss it
     probes. The probe creates a scoped `.beep-models-exchange-probe-*` directory
     inside the target's parent and checks that the directory has the parent's dev.
     It writes two disposable files (`wx`, `0600`), exchanges them, and checks that
     the contents swapped. The scope removes the directory on every outcome. Native
     content is never opened for writing.
   - A `ModelsExchangeFault` from the probe becomes `unsupported` with that reason.
     If the files did not swap, the result is `unsupported`/`unknown`. Supported and
     unsupported verdicts are both cached. A probe failure is not cached and surfaces
     as a typed `ModelsExchangeProbeError`.

## Identity and invalidation rule

The cache key is `${device}:${filesystemType or ""}` of the target's parent
directory. Every `qualify` call identifies the filesystem again, and the identity
lookup is never cached. A target whose device or reported type has changed (a
remount, a moved directory, a newly reported type) therefore misses the cache and
gets a fresh probe. Returning to an earlier identity reuses that identity's entry.

## Errno mapping

`modelsExchangeErrnoFromStderr` reads the C-locale strerror text that `mv` prints:

| Text | Reason |
| --- | --- |
| `Invalid cross-device link` | `exdev` |
| `Invalid argument` | `einval` |
| `Operation not permitted` | `eperm` |
| `Function not implemented` | `enosys` |
| anything else, such as `unrecognized option '--exchange'` or an `mv` that cannot run | `unknown` |

A target that is a mount point separate from its parent is `exdev` without a probe.

## Refusal point

`ModelsApply.apply` calls `requireExchange(actual)` right after the dry-run and
ownership checks, before it stats the target, creates the backup directory, or
writes the backup, the journal or a staged file. `ModelsApply.restore` calls it after
the journal and backup checks and before `atomic` creates the `.preimage` link or the
`.tmp` stage. When the capability is unsupported, the refusal is a
`ModelsLocatorError` with `reason: "exchange-unsupported"` and the message
`Atomic exchange unsupported on the target filesystem (<reason>: <detail>); refusing native write before backup or publication.`.
A probe failure gives `reason: "exchange-probe-failed"`. The old in-publication
`supported` check is removed, because nothing reaches `atomic` without qualifying
first.

## Fixtures and tests

All fixtures are scoped temporary directories. No test writes outside them or reads
home or config files. New file
`packages/tooling/tool/cli/test/models-exchange-capability.test.ts` runs under
`@effect/vitest` `layer(ModelsAtomicExchangeLive …)` so EV010 can prove provenance:

- a supported target is probed once and then cached for a sibling, then applied and
  restored. Afterwards no probe directory remains;
- identity change: devices 1 → 1 → 2 → 1 give probes 1, 1, 2, 2;
- unsupported `exdev`, `einval` and `eperm`, simulated through the primitive layer:
  two apply attempts each fail with `exchange-unsupported` and no `Journal:`. The
  backup directory does not exist, the target bytes are unchanged, the parent holds
  only `config.toml`, and there is one probe;
- a restore on an unsupported filesystem refuses with a journal id. The target keeps
  its applied bytes, no `.preimage`/`.tmp` is left, and the backup is intact;
- an exchange that succeeds without swapping is `unsupported`/`unknown`, and its
  probe files are cleaned up;
- an identity failure is a typed `ModelsExchangeProbeError`. Apply refuses with
  `exchange-probe-failed` before backup and without probing, and an absent target
  also fails typed;
- the live primitives on a disposable target return a verdict with the parent's dev
  and leave only the fixture file. When the verdict is supported, a real exchange
  swaps the files, and an exchange of an absent path keeps the retain-artifacts
  message;
- the errno table above.

`test/helpers/models-atomic-exchange.ts` now builds `modelsTestExchangeLayer` through
`makeModelsAtomicExchange` over a deterministic three-rename primitive, and exports
`makeModelsTestExchangeSystem`. The two race wrappers in `test/models-apply.test.ts`
change one field, `supported: Effect.succeed(true)` to
`qualify: modelsTestExchange.qualify`. Their interference schedules and assertions
are unchanged. The old `fails closed and caches an unsupported exchange probe` test
is replaced by the unsupported-target tests above. It intercepted the old
`exitCode`-based `mv` call and asserted a refusal *after* the journal (`Journal:`),
which is the behavior this issue removes.

## Verification (lane head = `426d494b34` plus the uncommitted diff)

| Check | Result |
| --- | --- |
| `@beep/repo-cli` models tests (9 files), Bun `bunx --bun vitest run` | 130 passed |
| same, Node `bunx vitest run` | 130 passed |
| `tsc-rs -p tsconfig.check.json` and `-p test/tsconfig.json` | 0 errors |
| `bun run beep quality effect-diagnostics --filter repo-cli` | 0 errors / 0 warnings on the check, test and scripts overlays |
| `bun run beep lint effect-vitest` | `introduced=0` |
| `bun run beep lint schema-first` | `introduced=0` (parity ratchet ok) |
| oxlint on changed files | exit 0 |
| biome on changed files | clean; one pre-existing `useTemplate` info on an untouched line |
| `bun run beep quality fallow audit --base origin/main --check` | exit 0, 0 findings |
| jsdoc inventory + `jsdoc-ratchet` | `increased=0`, zero-legacy ok |
| `bun run beep observability catalog --write` | +2 conforming spans (`ModelsAtomicExchange.qualify`, `ModelsExchangeSystem.make`) |
| `bun run beep lint schema-catalog --write` | +7 repo-cli entries |
| `bun run beep laws retired-effect-paths` | findings=0 |
| `bun run beep quality package-verify @beep/repo-cli` | exit 0 (`ok audit`, `ok docgen`) |
| `bun run coverage --filter=@beep/repo-cli` | `coverage-ratchet ok`, 341 files / 6904 tests pass; `Models.exchange.schemas.ts` and `Models.errors.ts` at 100%, `Models.apply.service.ts` at 91.35% lines |
| `bun run beep goals doctor` | `blocking_new=0`, `blocking_inherited=0` |

`knowledge-doctor-evaluators.test.ts` compares each committed packet manifest with
the live file. It fails only while this packet's `ops/manifest.json` edit is
uncommitted, so it is environment-only. With the HEAD bytes put back for the run, the
test passes (14/14) and so does the whole suite. The package-verify and coverage rows
above were taken that way, and the lane edit was restored afterwards. The test passes
again once the manifest is committed.

On this workstation (GNU coreutils 9.12, tmpfs `/tmp`) the live probe is supported.
Hosts whose `mv` lacks `--exchange` refuse with `unknown`, as before, but now before
any backup.

No baseline, inventory or exception rows are added (S31). The package is private, so
no changeset is needed.

## Review round 1 (#1944, 2026-10-21)

Head `15096d32d3` (`dcabf8ef17` plus an empty re-request commit). Two P2 threads on
`Models.apply.service.ts`, both fixed in the same order: schema, then contract, then
implementation.

1. **Same-device bind mounts passed the mount-point check.** A bind mount of a file
   or directory from the same filesystem keeps the parent's `st_dev`. It was probed
   in the parent's mount, cached as supported, and passed `requireExchange`. Apply
   then wrote the backup and the journal before `atomic()` failed at `fs.link` with
   `EXDEV`.
   - Schema: `ModelsExchangeMount { id, point }`, and
     `ModelsExchangeFilesystemIdentity` gains `mount`, the parent directory's mount
     id. The cache key is now `${mount}:${device}:${filesystemType}`.
   - Contract: `ModelsExchangeSystemShape` gains `mount(path)`. The live primitive
     resolves the path with `realPath` and reads `/proc/self/mountinfo`.
     `modelsExchangeMountOf` picks the deepest mount point that contains the path, and
     the last line wins among stacked mounts, so a bind-mounted file resolves to its
     own mount. Mount points are octal-unescaped. Node and Bun expose no `statx` mount
     id. Without a mount table the probe fails closed (`exchange-probe-failed`), which
     costs nothing, because renameat2 `RENAME_EXCHANGE` is Linux-only anyway.
   - Implementation: `qualify` compares `mount(target).id` with `identity.mount`.
     A mismatch is `unsupported`/`exdev`, with the target's mount id and point in the
     detail. It is checked before any probe, cache lookup, backup or journal. The probe
     also checks that its scratch directory has the parent's mount id as well as its
     device id.
2. **A probe whose `mv` could not run was cached as unsupported.** Spawn and output
   collection failures became `ModelsExchangeFault`/`unknown`. The probe turned every
   fault into a verdict, and one transient failure made every later write refuse
   as `exchange-unsupported`.
   - Schema: a new `ModelsExchangeLaunchError` (no host verdict), distinct from
     `ModelsExchangeFault` (a host refusal).
   - Contract: the `exchange` primitive fails with
     `ModelsExchangeFault | ModelsExchangeLaunchError`. `modelsExchangeHostRefusal(code, stderr)`
     returns a reason only for an exit in 1..127 that printed error text, where
     unrecognised text is a genuine `unknown`. A signal exit (128 or above), a negative
     code, or an exit that printed nothing returns `None`. The live primitive reports
     those cases, and spawn or collection failures, as launch errors.
   - Implementation: the probe maps a launch error to `ModelsExchangeProbeError`
     ("could not run; no host verdict"), which apply reports as
     `exchange-probe-failed`. Only host verdicts reach the cache. During publication,
     a launch error keeps the retain-artifacts `ModelsLocatorError` and is labelled
     `launch`.

New tests in `test/models-exchange-capability.test.ts`:
- a same-dev target on mount 99 under parent mount 1 is refused as `exdev`, with no
  probe, backup, journal or file change;
- a launch failure is `exchange-probe-failed` with no backup and no probe residue.
  The next qualify probes again and is supported (2 launches, 1 probe), a write then
  succeeds, and a launch error during publication keeps the retain-artifacts
  message;
- the host-refusal classifier table (refusal, unknown text, blank text, signal,
  negative code);
- `modelsExchangeMountOf` over a fixture table: root, nested, a bind-mounted file, a
  sibling `.tmp` beside it, an escaped `\040` stacked mount, malformed lines, and an
  empty table.

Round-1 verification (final tree):

| Check | Result |
| --- | --- |
| models tests (9 files), Bun and Node | 134 passed each |
| `tsc-rs` check overlay and test overlay | 0 errors |
| effect-diagnostics `--filter repo-cli` | 0 errors / 0 warnings (check, test, scripts) |
| `beep lint effect-vitest` | `introduced=0` (5 EV006 rows fixed with `assertNone`/`assertSome`) |
| `beep lint schema-first` | `introduced=0` |
| oxlint / biome on changed files | exit 0 / clean |
| fallow audit `--base origin/main --check` | ok, 0 findings |
| jsdoc ratchet | `increased=0`, zero-legacy ok |
| schema catalog / observability catalog | regenerated (+2 schema entries; spans unchanged) |
| `beep quality package-verify @beep/repo-cli` | exit 0 (`ok audit`, `ok docgen`) |
| `bun run coverage --filter=@beep/repo-cli` | `coverage-ratchet ok`; 341 files / 6908 tests; apply service 91.54% lines, errors and exchange schemas 100% |

As in round 0, package-verify and coverage ran with this packet's `ops/manifest.json`
set to its committed bytes. That avoids the environment-only knowledge-doctor
comparison with the uncommitted manifest. A run without the swap failed only that
one test (6912 others passed). The lane edit was restored afterwards and checked
with `diff`.

## Reversal

Revert the PR. The journal schema, backup layout and on-disk artifacts are
unchanged, so journals written by either version restore under the other. The
widened `ModelsLocatorError.reason` only adds literals.
