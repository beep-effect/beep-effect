# rsc-c-scripts handoff — 2026-10-09

Status: wave 1 implemented; verification queued/running; no PR yet. Not final.
This file is the lane's coordination channel and is updated as evidence settles.

## Implemented wave

Refs provisioning, Cache remote-read configuration, Knowledge exact-count rewrite,
Worktree merge-driver setup and Accounts secret-layout administration now belong
to existing Effect command families. Dead/superseded root entry points are removed
and operational callers retargeted. ONNX dispatch uses the existing seven-case
face-detection installer suite before OSV. Retained apt/compiler adapters have
synthetic fixtures. Graft old patches retire and its two Node tests relocate.
Systemd sources adopt the current installed budget without installing/reloading.

Root `knowledge:refs-rewrite` was retargeted directly; no matching `//#` task
existed. Root cache review is content-addressed by
`history/receipts/rsc-c-root-script-review-2026-10-09.md`; owner regeneration kept
151 previous reviews, qualification scope, profile and epoch. Cache audit changed
from zero blocking findings to 27 configuration-drift findings after the edit,
then back to zero after baseline regeneration (1325 unassessed nodes remain).
No qualification was granted. No lockfile or compiler patch changed.

## Orchestrator coordination needed

- R24: supply the live owner of `cloud-agent-readiness`, or the fleet-role owner
  of record after the required session/lease audit. C has only marked the retired
  bootstrap checks historical; lifecycle is preserved. The owner-name Decision
  Log row must precede final. Do not infer ownership from an old ledger row.
- R23: E reviews the two `check.yml` hunks (ONNX and merge-driver install).
  A owns ONNX fail-unpatched/pass-patched evidence and the Retained patches row.
- R27: C proposes a thin pre-runtime change-profile shim; preserve existing eval
  output and avoid admission-job latency on independent checks. Install before
  typed job-env export, restore Turbo after export. Secrets remain explicit
  trusted-caller workflow expressions. E must agree/review the Ci-group PR.
  The three Ci operational scripts, workflows and Fallow exemptions remain intact;
  this group is deliberately not partially migrated.
- S6: serialize the shared root command, cache baseline, AGENTS and workflow edits
  with the fleet's other waves at the merge gate. This worker does not merge.
- Knowledge census: separately owned
  `explorations/build-pipeline-simplification/RESEARCH.md` invocation of the
  external heavy wrapper is an inherited blocking finding. Route to that owner;
  C preserves its ownership boundary. C reworded the packet's workstation-home
  example, the other inherited finding, without weakening the privacy policy.

## Evidence

- Required initial fetch/merge of origin/main completed; packet missing on main
  required and received the fallback packet-branch merge. A later merge took
  origin/main at `42720cfb66`; latest fetch/merge reported already up to date.
- Original and new Knowledge rewrite dry-run: exit 0, 3 applied,
  225 already-applied. Rules 0–2 remain pending skill rewrites. Rule 34's ignored
  target is present here; a missing target remains a failure in other checkouts.
- Refs provisioning: 2 tests passed, including all eleven manifest entries,
  idempotence, dirty existing `.git` directory/file preservation, HOME expansion,
  stale links and directory ownership refusal.
- Retained adapter + Quality dispatch: 11 tests passed (2 files). Compiler
  originals remain; numbered rotations and patched copies are pruned; no-op and
  warning paths covered. Apt fixture preserves Ubuntu, symlink targets, nested
  entries and unrelated files; only direct third-party source entries are removed.
- Worktree setup and Refs refresh: 23 tests passed in the broader initial run.
  Cache/Knowledge failures in that run were introduced use of an unavailable
  Effect helper, since fixed. The new follow-up tests must settle before a pass
  is claimed: Cache 7, Knowledge 4, Accounts 2 cases.
- Owning ONNX suite: 7 tests passed. No edits to the face-detection package were
  needed because its existing suite is the superset; A still owns patch reversal.
- `bash -n` retained cloud/apt/merge/Graft adapters and `node --check` compiler /
  changelog adapters passed. `systemd-analyze --user verify` source passed with
  the inherited obsolete CPUAccounting warning. No live unit was installed.
- Each removed operational path has zero live caller matches using the sweep's
  hidden-file exclusions; packet/history matches retain provenance. Exact local
  census is `.beep/rsc-c-removed-callers.txt`.
- `beep lint package-scripts --write`: 152 manifests, 0 drifting, 0 written.
  `beep cache profile --write` completed through the owner with no new profile diff.
- Full CLI package verify, test-tsgo, bounded docgen, jsdoc-ratchet, Fallow audit /
  health and Graft relocated Node tests are queued through the 3-slot heavy
  wrapper. Lint policy is running. Terminal results and commit parity remain open.
- Knowledge refs check at imported HEAD: 2 inherited blockers (see attribution
  above). `CI=true` committed-head rerun remains required.

## Coverage floors read

Values below are existing baseline percentages, in lines / statements / branches /
functions order. They are not new coverage results. No floor was lowered.

| Touched source | Baseline floor |
| --- | --- |
| Cache.schemas | 100 / 100 / 100 / 100 |
| Cache.service | 45.81 / 42.72 / 19.1 / 41.66 |
| Cache.command | 80.76 / 79.91 / 72.52 / 70.32 |
| Knowledge.command | 78.88 / 76.59 / 70 / 76.31 |
| Knowledge.service | 90.27 / 90.78 / 84.84 / 88.63 |
| Knowledge.schemas | 100 / 100 / 50 / 100 |
| Refs.service | 95.87 / 93.36 / 79.38 / 90.74 |
| Refs.command | 16.21 / 15.78 / 0 / 0 |
| Worktree.service | 92.97 / 92.95 / 90.9 / 84.25 |
| Worktree.command | 66.66 / 65.3 / 64.2 / 50.73 |
| Lint.errors | 62.06 / 61.29 / 100 / 40 |
| Lint/internal/EffectSchemaInventorySource | 100 / 100 / 100 / 100 |
| Quality.command | 57.65 / 57.34 / 54.41 / 54.64 |
| Accounts.command | 96.36 / 92.06 / 100 / 84.37 |

New Accounts layout sources have no old baseline floor. Scoped read is the
brief's requested acceptance evidence; eventual package/hosted coverage still
must not regress. Root-input accounting for all 21 routing entries plus Graft:
`history/receipts/stage-5-acceptance.md#script-ports`.

## surviving-capabilities rows

A is the sole register writer; transcribe these rows with this handoff citation.

| Capability | Why retained | Current proof | Follow-up / removal condition |
| --- | --- | --- | --- |
| Compiler-backup pruning install adapter | Prepare cannot require an installed CLI; compiler `.original` is intentional patch provenance. | Synthetic fixtures pass: original retained, numbered/patch rotations pruned, repeat and missing-root no-op, malformed manifest warns; Node syntax passes. | A can run compiler provenance now. Retire only when the compiler owner's install contract no longer needs pruning. |
| Pre-runtime apt-source adapter | Ubuntu acquisition happens before a repository runtime exists. | Synthetic seam tests pass, preserving ubuntu.sources, unrelated files, nested entries and symlink targets; shell syntax passes; no live apt deletion. | Typed delegation may be added after runtime, but preserve the minimal pre-runtime boundary. |
| Git regeneration merge adapter | Git may invoke it in an incomplete merge tree with no usable CLI. | Repeated local setup and fail-closed fixture passes; shell syntax passes; adapter path unchanged. | Worktree new/prepare owns installation; clone beep-effect16's absolute setter remains valid. Read-only linked-worktree config.worktree census found no additional regenerate setters. |
| Graft workstation patch kit | Installed external tool needs its sanctioned dist-patch/bootstrap adapter. | Current 0.21.1 retained; 0.16/0.18/0.19 retired; two Node suites relocated to CLI fixtures with fake transports, terminal rerun pending. | Retire old patches only; no fresh install, deep build or model endpoint call. |
| Declarative agent-runs systemd sources | Source of record for the existing heavy-work budget. | Adopted effective 48G MemoryHigh, 60G MemoryMax, 8G MemorySwapMax and 50% pressure limit from unowned heavy-budget drift; source verify passes with inherited CPUAccounting warning. | Operator re-sync/installation is a separate follow-up. This lane makes no host unit change. |

## Recovery

Revert the wave's PR to restore removed implementations and callers. Root cache
baseline must be regenerated against the restored root scripts. Cache owned-field
writes make a private backup first; restore it to reverse a real invocation.
No workstation state changed by this implementation or its synthetic fixtures.
Keep the Git adapter path stable for existing absolute configurations.

## Report

lane: rsc-c-scripts · head: b52ef56a08183b4d97e38e0789e620e407337390 (implementation dirty)
· PR: none (wave 1 not published)
· package-verify: @beep/repo-cli pending (heavy admission)
· hosted-parity: test-tsgo pending; docgen local pending; jsdoc-ratchet pending;
knowledge refs --check fail (inherited findings; committed recheck pending);
fallow audit+health pending; coverage read complete (existing floors only)
· handoff: history/handoffs/rsc-c-scripts-2026-10-09.md
· open: final Ci group / E ordering and workflow review; R24 cloud owner audit/name;
terminal heavy proofs; introduced-helper fixture rerun; pinned independent review;
committed-head parity; publication and orchestrator merge gate.
