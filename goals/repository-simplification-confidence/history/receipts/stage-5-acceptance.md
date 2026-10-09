# Stage 5 acceptance evidence — partial V contribution

This records V's local evidence only. It does not close the program or qualify
publication, hosted readiness, other lanes, or the repaired non-CLI preview.
The orchestrator owns the aggregate acceptance record.

## Package gates

| Lane | Package | Qualified source / artifact | Full package result | Evidence |
| --- | --- | --- | --- | --- |
| V | `@beep/repo-cli` | `4be0599a181c86fdf282da880dacf49bb20fb1bf` | PASS 781.746 s (audit 750.5 s, docgen 29.6 s) | `rsc-v-local-proof-results.json`, V handoff |
| V, prepared R105 patch | `@beep/rdf` | Original patch `b0f087e9b4addbd08cebc4c8cb4750e879a6367d8f344c6a55b278f5f77a4a92` | PASS 12.064 s | Prepared-patch evidence only; repair preview needs its own proof |
| V, prepared R105 patch | `@beep/pacer` | Same original patch | PASS 10.024 s | Prepared-patch evidence only; no second PR exists |

## Scope

V changes 78 files relative to merged main, including this partial receipt.
Only repo-cli package source/tests are edited; RDF/Pacer are preserved patches,
not package edits in the integration branch. The D13 roughly 150-file cap and
CLI-only first PR boundary remain intact. Thirty-five reviewed files match
terminal-zero source `a0b0df4147`. Main's changeset-remedy assertion and V's
new canonical plan property have separate terminal-zero Run 4 review. The
earlier 757.718-second package result belongs only to the table's recorded
`5a79cbc49a` source, including incoming Accounts code. The new full package
collector at `4be0599a18` completed with all nine source/parity stages green.
The later main merge `7ef36e8020` imports only seven exploration documents;
all package/root gate inputs and 37 source digests remain unchanged. No source worktree or branch was retired.

Final inventory: 1,853 / 716 open / 1,137 exceptions. Historical IDs remain
immutable; the dated linkage record describes re-anchors and candidate churn.
PR #1575 is published and ready; direct capped publication passed cheap gates
and frozen-install preflight. The private repo-cli release note was archived
after D policy landed. Knowledge refs passes with zero live gated observations
after the main SPEC wording repair. Hosted readiness, R105 follow-up, R102 remediation and completed-retained
gates remain open. The integration local package proof is complete.

## C script-port acceptance contribution

### Stage 5 acceptance — C script ownership

This is C's partial receipt, dated 2026-10-09. It does not close the program's
acceptance rows. The Ci group and final package/hosted parity remain open.
Other lanes add their own evidence under their owned headings.

## Script ports

Root inputs are outside the ordinary package-verification selection contract.
Each row below records its additional proof; package success alone does not
establish root-script parity. Removed implementations remain reversible through
git history and the eventual PR revert.

| Routing input | Result / owner | Additional root-input proof and remaining gap |
| --- | --- | --- |
| `scripts/changeset-changelog.cjs` | Retained required CJS callback | `node --check` passed; dormant publication contract retained; actual publication belongs to D. |
| `scripts/ci-change-profile.sh` | Ci group deferred | Existing pre-runtime caller stays intact; C/E ordering agreement and synthetic parity remain required. |
| `scripts/ci-job-env.mjs` | Ci group deferred | Existing event/credential policy stays intact; typed port, synthetic event matrix, install/export/restore ordering remain required. |
| `scripts/ci-prune-apt-sources.sh` | Retained pre-runtime adapter | Synthetic apt directory proves only third-party direct children are deleted, Ubuntu and unrelated files survive, symlinks are not followed, rerun is idempotent, missing directory fails. Default privileged system directory remains unchanged. No host apt operation ran. |
| `scripts/ci-runner-resources.sh` | Ci group deferred | Existing command/signal/exit contract remains; typed port and signal/failure fixtures remain required. |
| `scripts/cloud-session-setup.sh` | Deleted superseded implementation | Operational caller census has no matches. Current `scripts/cloud/bootstrap.sh` retained; packet commands marked historical, lifecycle preserved. R24 owner audit/name still required. |
| `scripts/cloud/bootstrap.sh` | Retained pre-toolchain bootstrap | `bash -n` passed. No real cloud acquisition or host install ran; existing bootstrap remains the runtime acquisition boundary. |
| `scripts/enable-turbo-remote-reads.sh` | Cache `remote-reads` | Original five cases moved; new owned-field/whitespace/symlink/invalid-input cases added. Follow-up run queued; earlier run exposed an introduced helper bug, subsequently fixed. Does not resolve references. |
| `scripts/knowledge-refs-rewrite.rules.json` | Retained reviewed data | Original and new dry runs both exit 0: 3 applied, 225 already-applied. Rules 0–2 remain pending skill rewrites; rule 34's ignored target exists in this lane. Elsewhere a missing target remains a reported failure. |
| `scripts/knowledge-refs-rewrite.ts` | Knowledge `refs rewrite` | Exact-count, ordered same-file rewrite, dry-run, idempotence, drift refusal, independent-file progress, missing-file, version/path/symlink fixtures added. Rerun queued after helper fix. Root command retargeted; owner-regenerated cache baseline audit has zero blocking findings. No matching Turbo `//#knowledge:refs-rewrite` task existed. |
| `scripts/onepassword/beep-secrets-layout.jq` | Accounts typed transform | Synthetic prefix/mapping/notes/unmapped/hash fixtures added. All field attributes except section participate in identity; unknown metadata preserved. Follow-up run queued. |
| `scripts/onepassword/beep-secrets-layout.sh` | Accounts `secrets-layout` | Fake PATH binaries prove dry-run has no edit, agent apply is refused before get, synthetic operator apply uses stdin, no synthetic secret values appear in logs. Follow-up run queued. No real vault read/edit ran. |
| `scripts/prune-tsgo-backups.mjs` | Retained install-safe adapter | Fixtures passed: `.original` retained, numbered rotations and `.patched` removed, repeat no-op, missing root no-op, malformed manifest warns without failing install. `node --check` passed. |
| `scripts/references.json` | Retained Refs manifest | Both provisioning fixtures passed for all 11 entries, missing clone arguments, HOME expansion, existing directory/file `.git` preservation, stale-link repair and directory refusal. No actual reference checkout was cloned by fixtures. |
| `scripts/regenerate-merge-driver.sh` | Retained fail-closed Git adapter | Owning fixture passed for repeated local setup and incomplete-tree fail-closed paths; `bash -n` passed. Stable adapter path preserves existing absolute-path users. |
| `scripts/setup-effect-ref.sh` | Refs `provision` | Both original fixture cases passed; docs/remedies repointed; no live caller matches. |
| `scripts/setup-regenerate-merge-driver.sh` | Worktree `prepare` and `new` | Repeated setup fixture passed; doctor prints remediation; codegen caller updated; no live caller matches. |
| `scripts/systemd/agent-runs.slice` | Retained source of record | Adopted existing effective 48G high / 60G max / 8G swap budget. Source verify passed with inherited CPUAccounting obsolete-setting warning. No installed-unit change. |
| `scripts/systemd/agent-runs.slice.d/50-oomd.conf` | Retained declarative drop-in | Adopts existing effective 50% pressure threshold; operator installation/re-sync is a separate follow-up. |
| `scripts/test-onnxruntime-installer-patch.mjs` | Existing face-detection installer suite | Seven-case owning suite passed. Workflow and Quality dispatch point to it before OSV; dispatch fixtures passed. A owns fail-unpatched/pass-patched receipt, E reviews workflow hunk. |
| `scripts/yeet-inbox-grok-tail.sh` | Deleted dead adapter | Caller census has no matches; active `.claude/hooks/yeet-inbox.sh` grok branch remains authoritative. |
| `scripts/graft/` | Retained workstation bootstrap/patch adapter | Old patch versions 0.16/0.18/0.19 removed, current 0.21.1 retained. Two Node suites relocated under CLI test fixtures and run explicitly, with fake transports; queued. No model call or fresh installation ran. |

Caller census: each removed operational path has zero matches outside historical
packets, ignored caches, references, dependency directories and changesets, using
the sweep's targeted hidden-file ripgrep exclusions. Cloud packet matches are
explicitly historical. Root callback/rule/manifest/unit inputs remain deliberate
retained exceptions, rather than package-only proof claims.

## Sensitive scripts

The Cache port validates the complete input and all duplicate assignments before
mutation, preserves unrelated/quoted values, takes a private backup before edit,
and writes through the existing contained no-follow writer. Tests use unresolved
synthetic `op://` references and synthetic resolved tokens; no values are logged.

The Accounts port preserves the exact `OP_BIN=op-human --apply` operator boundary,
resolves the default `op` from PATH, uses redacted value schemas and synthetic item
fixtures, and sends edited JSON through stdin. Failures invoke `op-doctor` once
and stop the secret path; error rendering contains no item JSON. The synthetic
fixture suite remains queued, so this row is not accepted yet.

The retained apt/systemd/cloud/Graft adapters received syntax or synthetic checks
only. No live apt directory, vault, systemd unit, reference checkout, bootstrap
installation or model endpoint was mutated for proof.

## Package gates

Changed versioned package: `@beep/repo-cli`, with a patch changeset.
`beep quality package-verify @beep/repo-cli` is admitted through `beep-heavy` and
queued. Hosted-parity test-tsgo, bounded docgen, jsdoc-ratchet, Fallow audit and
health are queued; no terminal pass is claimed. `beep lint policy --base
origin/main` is running. Generated package scripts: 152 manifests, zero drift,
zero writes. Cache profile owner regeneration completed.

Knowledge reference census at imported HEAD failed on two inherited findings:
the packet's workstation-home policy example (reworded in C's changes), and
`explorations/build-pipeline-simplification/RESEARCH.md` invoking the external
heavy wrapper (separately owned; routed through the handoff). Committed-head
`CI=true` recheck remains required.

Scoped coverage baseline was read for touched files. This is a floor inventory,
not a fresh coverage result; no baseline was lowered. New Accounts layout files
have no pre-existing baseline floor. Exact affected floors are in the handoff.

## Scope

C owns its command-family ports, fixture tests, caller rewiring and historical
cloud packet annotations. Shared root command/cache baseline/AGENTS/workflow
hunks require serialized orchestration. No lockfile or compiler patch changed.
The face-detection source/test already held the seven-case superset, so C changed
its callers and removed the duplicate root suite without editing that package.
A remains the sole surviving-capabilities register writer. E must review the
ONNX workflow hunk and co-sign the final Ci ordering decision. R24's cloud packet
owner audit remains open; C preserves that packet's lifecycle.


## C recovery verification update — Run 2

The recovery handoff records the exact source and merge commits. New Accounts,
Cache, Knowledge and retained-adapter fixtures pass 16 tests. The broader package
run passed docgen (26.7 seconds) and 5,778 tests, with two introduced integration
assertions failing; their subsequent 66-case focused rerun passes after the
fixture repair. Test-tsgo passes all 334 selected test files. Fallow audit and
health exit 0, with the root ONNX development declaration retained as a reported
unused warning for shared dependency-owner reconciliation. Recovered JSDoc
ratchet and the 17 relocated Graft cases have terminal passes. Scoped coverage
floors remain unchanged. Full package audit and hosted proof are still pending;
these partial passes do not close Script ports or Sensitive scripts acceptance.


## C recovery verification update — Run 3

R24 owner audit is resolved: the program orchestrator (fleet role) is owner of
record, with no live owner at 2026-10-09T17:24:18Z. Cloud packet lifecycle is
preserved. E will review ONNX/merge-driver workflow hunks on C's draft PR and
co-sign the proposed Ci ordering; the original Ci group remains intact.
Root ONNX declarations, owning dependency, override and patch remain unchanged
under the orchestrator's H1 ownership ruling. Existing terminal proof is retained;
full package verification and scoped docgen are rerunning only because their
last attempts failed or lacked a terminal result. No acceptance row is closed.

### Run 3 settled local evidence

Independent review is terminal zero actionable findings at `c43d86e953`, after
repairing the relative-checkout Cache defect. The repaired Cache suite passes
8 cases, including intended-file editing, original-content backup and duplicate
refusal. Test-tsgo passes all 334 selected files. Explicit package-scoped docgen
passes (27.2 seconds); the subsequent default package docgen result remains open.
Owner regeneration reports 152 manifests with zero drift and zero writes; cache
profile regeneration adds no tracked changes. CI=true knowledge refs at imported
head exits 0 with zero live gated observations. The refreshed census records
zero live callers for all nine removed script paths.

Full package qualification and draft publication are active or queued through
the authorized heavy wrapper; terminal verdicts and E workflow review remain
required. None of these partial results closes the coordinated Ci group or
claims hosted readiness.

Run 3 full package verification now passes: audit 777.6 seconds and docgen 25.2
seconds, including the Cache relative-root repair and new fixture. Publication,
local changed-scope policy proof and E review remain queued/open; the Ci group
remains coordinated follow-up scope. Hosted parity is not inferred from this pass.


## C Run 4 current boundary

The Ci group is implemented together with its composite-action callers. The
Effect service owns change-profile, job-env and runner-resources. Shared goals/
docs pattern data belongs to Ci schemas; the minimal pre-runtime profile adapter
reads the generated JSON projection before Bun/dependencies exist.
`beep ci patterns --write` owns the projection; the freshness fixture checks it
against the schema-owned instance without changing managed compiler policy. Setup installs dependencies before typed
environment export, then restores Turbo using exported credentials. Secret inputs
remain explicit trusted-caller expressions. The resource adapter retains stable
caller and shutdown behavior, including heavy.yml's older-checkout fallback.

Root-input gap accounting additions: CI runner-security fixtures explicitly
execute the profile and resource adapters, compare typed/shim profiles, exercise
the synthetic event/credential matrix and multiline heredocs, assert no secret
values in logs, verify synthetic procfs counters, and cover TERM/INT/KILL,
stdin, output-storage failure and recovered periodic-sample failure. These tests
are outside the assumption that package source selection proves root adapters.
Independent source review has zero actionable findings at `dec7e854a0`; current
runtime/full-package proof is pending. This row does not claim hosted acceptance.

R24 is resolved by the orchestrator-of-record audit. Resume ruling 3 treats locked
historical routing and packet history/research as archival provenance. C's exact
lossless wire and platform-test candidates are listed in its handoff for B's
admission after V; C edits no inventory or allowlist. Initial introduced runtime-
invocation, type, docgen and complexity findings are repaired and awaiting their
necessary reruns. The unused root ONNX declaration remains under H1 ownership
as explicitly ruled. No real vault, apt directory, installed unit or model endpoint
was changed. E's workflow co-sign, publication and hosted evidence remain open.

### C Run 4 terminal local evidence and publication blocker

Full `beep quality package-verify @beep/repo-cli` exits 0: audit 811.4s and
docgen 28.8s. Terminal local parity: test-tsgo=0 (334 files), 25 CI
runner-security fixtures pass under the package's Bun runtime, owner pattern
freshness=0, JSDoc ratchet=0 and merged-main knowledge census=0. Ordinary
Fallow audit/health exit 0; audit retains H1's root ONNX declaration and unchanged
Ci summary complexity, while health has zero findings. Scoped coverage read is
recorded in the handoff; floors are unchanged. Runtime source is independently
reviewed with zero actionable findings at `e51f6ff5c3`; D's main integration
introduces no C runtime edit.

Publication at `bc176b61fa` collects five cheap-gate reds and exits before push:
B-owned schema/fixture judgment rows, and Knip/Fallow's H1-owned root ONNX row.
The exact candidate identities, attribution and terminal logs are in the handoff.
No PR, E co-sign, hosted proof or accepted program row is claimed from these
local results. Both C-owned heavy commands have ended.

### C Run 6 publication recovery

Resume ruling 4 transfers the unused root ONNX devDependency removal to C.
Only the root `catalog:` devDependency and matching root lockfile row are
removed; catalog range, override, installer patch and face-detection consumer
remain. Install exits 0; reused installed ONNX 1.30.0 has all four patch markers.
Bun emits no fresh patch-applied line, so that output is not claimed.
Run 4's six-row terminal qualification remains the verification of record.
The requested Knip/Fallow policy reruns remain pending; the beep-heavy waiter was stopped before admission at the S5 blocked boundary; owner
regeneration has zero tracked diff. S5 requires lockfile notification confirmation
before push. E co-sign, hosted evidence and B/V judgment admission remain open.

### C Run 7 dependency-policy recovery

Resume ruling 5 clears S5 for the exact one-row root lockfile delta using
durable orchestrator notification. Required fetch/merge is already up to date.
The admitted reruns terminate with `quality:knip=0`, `fallow:audit=0` and
`fallow:dead-code=0` in `.beep/rsc-c-run7-result.txt`. Knip: current 41,
baseline 41, introduced 0. Fallow audit: one nonblocking inherited-adjacent
complexity observation, introduced 0. Fallow dead-code: findings 0. The unused
root ONNX regression is gone without any inventory or baseline edit. Run 4's
six qualification passes and Run 6's install/owner proofs are retained.
Publication uses the orchestrator-authorized push-only route; E review,
B/V occurrence-specific admission and hosted evidence remain separate gates.

C wave 1 is published as [PR #1583](https://github.com/beep-effect/beep-effect/pull/1583)
and ready for review through the authorized fallback. The initial live read
has no unresolved review threads or base conflict. Three Vercel deployment
rate-limit rows are acknowledged environment-only. The bounded monitor
terminates at its configured two-minute limit without a readiness verdict;
its terminal row is acknowledged observed. Hosted proof, E co-sign, B/V
admission, review-window completion and orchestrator merge remain open.
No C-owned command or unit remains running; no acceptance row is closed.

## C Run 8 integration proof

E's workflow co-sign on #1583 is received and its merged hosted policy is preserved
through the Ci ports. Local integration proof passes: test-tsgo (335 files), all
29 runner-security fixtures, repo-cli package-verify --quick, Fallow audit (zero
introduced) and Knip (41 current / 41 baseline / zero introduced). The resource
adapter's CLI-boot fallback is restored with private launch-receipt / exactly-once
fixtures; existing stdin, shutdown and measurement-failure proof survives. The
introduced fixture PATH-read policy red is repaired with Config and all affected
checks rerun successfully. E's Security job-token/governance guards, fork/caller
policy and Bun-cache retirement survive; install precedes typed export, then Turbo
restore. Full receipts and root-input accounting remain in the C handoff. Updated
hosted proof and B/V's named judgments remain open; this does not close program
Script ports or Sensitive scripts acceptance.

## C Run 9 V integration proof

Merge `d48b1ca740` integrates V main `4e82f6d942`, retaining both lanes'
decisions, friction rows and acceptance contributions. The merge-driver fixture
uses V's bounded scoped Effect harness and all four cleanup witnesses with C's
typed idempotent installation and fail-closed assertions. Its canonical Effect
process boundary passes five tests under both Node and Bun. Test-tsgo passes
335 files, CI runner-security passes all 29 cases, and repo-cli package-verify
--quick passes lint/check. Initial native-process and intermediate formatting
reds are repaired and their affected checks rerun; the lint inbox is acknowledged
with the repair SHA. No inventory, allowlist or coverage floor is edited by C.
Earlier full package/docgen and unaffected parity remain retained. Updated-head
hosted proof, B admission and the orchestrator gate remain open; program
acceptance is not closed by these local receipts.
