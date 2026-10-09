# Stage 5 acceptance — C script ownership

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
