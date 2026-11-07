# Lane C: local quality gate repair

Status: source repairs verified locally; combined proof and commit are blocked by
this session's filesystem permissions. No push, waiver, suppression, quality
baseline change, or cache baseline refresh was performed.

Starting branch: `feat/research-library-ontology-core`.
Starting HEAD: `94b1bc4d39092cc55732aafc30d7fab50bae99d9` (clean).

## Schema-first

Cause: 19 catalog/option models, two view rows, and the projection's Packet and
LibraryTopic used plain-data `S.Class`, contrary to D1 and the packet decision.

Fix: branded `S.Opaque` over annotated `S.Struct`, preserving field checks,
constructor and decoding defaults, `$I.key` metadata, and ontology class names.
Tests use schema-derived guards instead of JavaScript `instanceof`. Two focused
schema-generated property tests cover JSON preservation of captures and migration
receipts, addressing the schema-first arbitrary-coverage advisories.

Proof: `bun run lint:schema-first` exits 0 with zero current findings and zero
introduced findings. Final log: `/tmp/library-schema4.log` (local scratch).

## Fold preservation

A disposable Bun script called `assembleLibraryOntology`, `toTurtle`,
`libraryShapes`, and `libraryShapesTurtle` with `N3TurtleCodecLive` before any
source edit, immediately after the conversion, and after the SHACL refactor.
Both `cmp` comparisons exit 0. The script was removed.

| Artifact | Fresh HEAD SHA-256 | Final SHA-256 |
| --- | --- | --- |
| research-library.ttl | `521755de7a5665d3a2543efe4d9a4c10022c3db35bd1332eae3f24656348f874` | `521755de7a5665d3a2543efe4d9a4c10022c3db35bd1332eae3f24656348f874` |
| research-library.shacl.ttl | `267e1e0dcae049151dd4ecf751c24a358f5968bb2a33c318f4911789641bc832` | `267e1e0dcae049151dd4ecf751c24a358f5968bb2a33c318f4911789641bc832` |

## tsconfig-sync

Cause: the new workspace dependencies were missing from project references and
boundary projections.

Fix: `bun run beep tsconfig-sync` produced four retained changes: CLI
`tsconfig.json`, `tsconfig.check.json`, `test/tsconfig.json`, and
`standards/fallow.boundaries.generated.jsonc`.

Proof: `bun run beep tsconfig-sync --check` exits 0: no drift detected.

## Cache policy

`bun run beep quality cache-policy` still exits 1 with six configuration-drift
findings: `@beep/repo-cli` build, check, doctest, lint:deprecated-apis, test,
and test:property. These are reviewed task dependency-graph changes from the
new workspace dependencies, rather than a missing-input diagnostic.

`Cache.governance.policy.ts`'s `auditLegacyNode` compares command, command digest,
dependencies, and effective configuration against the reviewed cache baseline.
The documented workflow is a reviewed cache baseline refresh; changing input globs
cannot make a changed dependency graph equal the old graph. The user forbids
baseline bumps. Clarification was requested while independent repairs continued;
no permission to refresh has been received. Cache metadata was left unchanged.

## Oxlint

Cause: inline schema construction at encode/decode boundaries recreated ASTs.

Fix: hoist the concrete JSON/array schemas in projection, views, migration and
model/ontology/replay tests. Dynamic generic schema helpers retain their dynamic
inputs.

Proof: `bun run lint:oxlint` exits 0. No suppressions were added.

## Fallow audit and health

Cause: nested projection/reference branches, SHACL property/list construction,
view evidence/disposition handling, and artifact migration exceeded complexity
limits. Audit also found duplicated topic defaults and output ancestry checks.

Fix: named helpers for record identity, references, evidence, per-predicate
projection, shape class/datatype selection, SHACL membership and property quads,
view evidence/disposition/metadata, and artifact migration. Match handles scalar
and identity selection. Shared topic defaults and output ancestry resolution
remove duplication without changing emitted data or containment checks.

Proof:

- `bun run beep quality fallow audit --check --base origin/main`: exits 0,
  zero introduced findings, two nonblocking inherited-adjacent advisories.
- `bun run beep quality fallow health --check --base origin/main`: exits 0,
  zero findings.

No threshold, inventory baseline, or rule configuration changed.

## Behavior and type proof

- All seven research-library test files: 167 tests passed, including both golden
  replay dates, SHACL validation, migration preservation and new properties.
- Package `bun run beep:check`: exits 0 (source, scripts and test TypeScript).
- `git diff --check`: exits 0.

## Combined Yeet proof and commit blockers

`bun run beep yeet verify --tier cheap-gates` exits 255 before gates:
`cannot open .../FETCH_HEAD: Read-only file system`.
A diagnostic `git fetch --no-write-fetch-head` also fails with
`Bad owner or permissions on /etc/ssh/ssh_config.d/20-systemd-ssh-proxy.conf`.
No SSH configuration or authentication policy was changed.

Using the supported `--base` option with the locally available origin/main SHA
(`6a00ca54f8cfca9073d8124f1d4238f4d587e24c` at that invocation) gets past fetch,
but admission fails: `Failed to stage admission state` under
`~/.beep/runtime/beep-admit-uid-<uid>/queue/`. That directory is outside this
session's writable roots. The scheduler uses one canonical per-user root;
no isolated override or scheduler bypass was used. A sibling subsequently
advanced origin/main to `11a8421f04b952b7457dceaf0e7cbe05db096f9a`; no base merge
was performed in this repair lane.

Explicit-path `git add -- .../Library.schemas.ts` fails creating the worktree's
`index.lock`: `Read-only file system`. The live sandbox makes that Git metadata
read-only despite the enclosing common-dir writable root. No commit exists for
these repairs. Therefore no `--fix-sha` inbox acknowledgment was fabricated.

The subsequent explicit stop-hook request required acknowledgment of
`local-shard-8ebce1141a5d`. It was acknowledged with `--wontfix`, recording
the denied Git/scheduler writes, unresolved cache-policy drift, and uncommitted
repairs. This is a blocked disposition, not passing cheap-gates proof.
`bun run beep yeet inbox list` confirms zero unacknowledged rows.
After full package verification passed, the package verifier automatically
acknowledged `local-shard-25875682285a` (audit) and `local-shard-ef996b6b4f7b`
(docgen) with the existing starting HEAD `94b1bc4d39092cc55732aafc30d7fab50bae99d9`.
Those automatic acknowledgments do not establish a commit containing these dirty
repairs; no manual fix-SHA acknowledgment was issued.

Friction receipt: a writable checkout paired with read-only per-worktree Git
metadata prevents the authorized commit and fetch; canonical admission state is
also outside writable roots. Launching this task with the intended Git metadata
and scheduler write access would have prevented those failures. Preserve the
dirty repair tree when resuming.

## Full package verification

`bun run beep quality package-verify @beep/repo-cli` exits 0: audit passes
(178.0 seconds), docgen passes (49.2 seconds). No inherited-failure exception
is needed and no unrelated package was repaired. Local scratch receipt:
`/tmp/library-package2.log`.

After the last view-metadata consolidation, the replay and views suites were
rerun: 90 tests pass across two files (`/tmp/library-tests-final.log`).
