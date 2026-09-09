# SCM device preflight

Observed 2026-09-09. This attributes a defect in the original exploratory
linked-worktree sandbox. It provides no fresh-task, replay, shadow or
portability credit.

The retained `preflight-stable-native` trace finds the system Git binary but
then records `open("/dev/null", O_RDONLY...) = -1 EACCES`. No Git execution
appears in the trace. The dry summaries differ as follows:

| Observation | Historical main checkout | Original linked-root sandbox |
| --- | --- | --- |
| Turbo version | 2.10.12 | 2.10.12 |
| SCM revision and branch | Populated | Both null |
| Identity input count | 40 | 43 |
| Types input count | 26 | 29 |
| Common input bytes/hashes | Equal | Equal |
| Extra input paths | None | Root `tsconfig.json`, `tsconfig.base.json`, `tsconfig.packages.json` |

Resolved task definitions, external-dependency hashes, environment-variable
maps and global cache inputs match. The root configuration adds those three
files through `global.inputs`; lint explicitly excludes the root
`tsconfig*.json` pattern. This identifies the exact input difference, not its
complete runtime cause.

The first probe used `bwrap --ro-bind / /` without a fresh device mount. A
controlled metadata-only check in the same owned worktree observes errno 13
when opening `/dev/null`. Adding only `--dev /dev` makes that read succeed,
allows Git to run and returns the expected checkout revision. Both checks
exit zero with empty stderr; the negative check catches and reports the
expected `OSError` rather than treating it as a successful null-device read.

The pinned source falls back to manual SCM when Git discovery fails; the
manual hashing path handles parent-directory inclusions and exclusions
separately. This supports investigating the SCM path, but does not establish
that it explains the three-file difference. Sources: [SCM selection](https://raw.githubusercontent.com/vercel/turborepo/v2.10.12/crates/turborepo-scm/src/lib.rs),
[hash fallback](https://raw.githubusercontent.com/vercel/turborepo/v2.10.12/crates/turborepo-scm/src/package_deps.rs),
[manual hashing](https://raw.githubusercontent.com/vercel/turborepo/v2.10.12/crates/turborepo-scm/src/manual.rs).

The trace also records delegation from the explicit client to the installed
native client. Both currently hash to
`cfca1bde77f1216d4dcc8964e567eed9d47be224c848e8001edc9a1a07839dde`.
The prepared paired dry probe uses `--skip-infer` to avoid delegation, the
exact stable client, disabled cache reads/writes, a clean explicit environment,
isolated network and a one-MiB bound per capture. It changes only the device
mount between runs, compares expanded inputs/SCM/configuration, and requires
the owned worktree to remain clean. It uses the existing one-token admission
route and has passed. The [controlled receipt](./scm-device-stable.json)
records zero process exits in both cases. With the original device mount,
SCM revision/branch remain null and input counts are 43/29. With `--dev /dev`,
Git metadata is populated and input counts become 40/26. The latter input
maps and task hashes exactly match the historical main-checkout probe.
Common input hashes, resolved definitions, dependency hashes, environment
maps and global cache inputs remain equal. The device-mount defect therefore
explains this observed mismatch. This comparison uses the original lint
script/configuration, before the later quiet-lint repair.

The operational synthetic runner and current quiet-lint probe already mount
`/dev` explicitly. No change to their running experiments is required for
this defect. The original trace and its conclusions retain their exploratory
authority. The successful paired dry run explains input selection only;
real task comparisons across supported roots remain required.

Private probe recipe: `.beep/qualification-local-preflight/probe-scm-device.py`.
Private admitted wrapper/log: `.beep/qualification-local-preflight/scm-device-runtime.{ts,log}`.
Captures stay in the owned pilot's ignored `.beep/qualification/` area with
seven-day retention. They contain no ambient credentials and are not published.
