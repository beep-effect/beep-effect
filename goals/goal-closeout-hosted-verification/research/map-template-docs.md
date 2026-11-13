# Map: where the goal done-condition and the two-PR closeout are stated, and the launcher rewrite

Read-only research for P0. Worktree `closeout-hosted-verify`, branch
`feat/goal-closeout-hosted-verification`, base `7a462a27d4f`. Every claim cites
`file:line` in this worktree. Character counts are code points (Python `len`),
which equal JS `Str.length` for every file measured (no astral characters).

Rulings this map implements (all `decisions/2026-11-13-*.md:8`):

| Id | Ruling | Launcher/doc consequence |
| --- | --- | --- |
| D-done | `done-means-closeout-adopted-on-main-in-the-template-and-every-active-packet.md:8` | Launcher done condition becomes the AGENTS.md one (`origin/main` manifest `closeout.status == initiative.status`), rewritten into every active or paused GOAL.md; completed packets untouched. |
| D-exit | `goal-md-gains-an-operator-ruling-exit.md:8` | A third exit: an operator ruling under `decisions/` with the same jq true on `origin/main`. Its reversal names `Goals/Bootstrap.ts` (`:5`). |
| D-onepr | `closeout-is-one-pr-and-goals-doctor-blocks-on-an-unverified-closeout.md:8` | The final PR writes `closeout` and names itself; no packet-state adoption PR; doctor blocks on an unverified closeout. Every "packet-state PR / adopt / proposedCloseout" sentence below is stale under it. |
| D-hosted | `completion-evidence-is-hosted-facts-only.md:8` | Text that makes the `yeet-verdict` gating is stale; finals older than one month need the operator-ruling exit. |
| D-red | `a-final-merged-over-a-red-required-check-verifies-with-attributed-reds.md:8` | A red required check needs a decision file naming it. Documentation only (AGENTS.md, goals/README.md); too long for the launcher. |
| D-mig | `batch-migration-then-proposedcloseout-leaves-the-schema.md:8` | `proposedCloseout` leaves the schema, so a launcher telling agents to write it would make them write an undecodable manifest. |

---

## 1. The launcher template

### 1.1 `Goals/Bootstrap.ts` (the generator)

File: `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.ts`. The generator
reads no template file: every payload is an inline template literal.

| Lines | What it states | Status under the rulings |
| --- | --- | --- |
| `:274-339` | `goalMdPayload`, the whole GOAL.md launcher | |
| `:306-308` | Workflow step 6: write the closeout reflection via `/reflect` at the Close phase | Still correct |
| `:319-323` | Verification block: `test "$(wc -m < goals/<slug>/GOAL.md)" -le 4000`, `jq .`, `git diff --check` | Still correct |
| `:325-331` | "Decide changes … record each as a decision file … Escalate only what AGENTS.md "Autonomy" lists." | Still correct |
| **`:333-338`** | **The done paragraph** (quoted in 4.1 as T2703): ship `proposedCloseout` in the final PR, `completion refresh`, then `set-status` "in a packet-state PR. Done only once it merges and this passes, or an operator blocker is reported with evidence:" plus the jq line | **Rewrite** (D-done, D-exit, D-onepr, D-mig) |
| `:426-437` | `planPayload` "Closeout Checklist" step 3: set "a typed `proposedCloseout` with status `completed-retained` and finalPullRequest. Keep `initiative.status` operative until completion evidence verifies" | **Rewrite** (D-onepr, D-mig): the final PR writes `closeout` and the matching `initiative.status` |
| `:76-80` | `CLOSE_PHASE`: "Write the closeout reflection and flip packet state." / exit "Packet status and evidence are updated; a closeout reflection exists." | Still correct (one PR flips packet state) |
| `:53-54` | `COMPLETION_GATE_STATEMENT` (manifest `completionGate.statement`): "Not achieved until this goal's work ships as a PR driven to mergeable via /yeet (… publish --pr -> monitor)." | Not a done paragraph. It still names `publish --pr` (Yeet now opens the draft from `publish`, `AGENTS.md:245-249`). Optional touch-up. |
| `:199-205` | Manifest `agentLaunchers[0]`: `targetChars: 3500`, `maxChars: 4000` | Budget declaration (2.1) |
| `:211`, `:320`, `:380`, `:451` | The `wc -m … -le 4000` check in the manifest, GOAL.md, SPEC.md and PLAN.md payloads | Budget check (2.1) |
| `:522-528` | `BOOTSTRAP_VALIDATIONS` includes `"goal-md-within-budget"` | Budget check (2.1) |

History of the done paragraph (`git log -L333,338`): `ac8acbab3b4` (#762,
2026-08-17) → `788dda66b52` (#1448, 2026-10-05) → `426d494b343` (#1928,
2026-10-20) → `7f538fcd512` (#2703, 2026-11-05). Each generation is still live in
some active packet; section 4 names them T762, T1448, T1928 and T2703.

### 1.2 `goals/_template/` (the second template)

`goals/README.md:263-269` still tells authors to `cp -R goals/_template goals/<slug>`,
so the scaffold is a second launcher source, and it is two generations behind.

| File:line | Text | Action |
| --- | --- | --- |
| `goals/_template/GOAL.md:61-63` | The T1448 paragraph: "Done only when the goal reaches `completed-retained` (… closeout and reflection landed), or when a blocker that needs the operator is reported…" | Rewrite to the new paragraph with `<slug>` |
| `goals/_template/GOAL.md:55` | "record each in SPEC.md's Decision Log" (older than the decision-file law, `AGENTS.md:168-175`) | Out of scope for D-done; flag it |
| `goals/_template/PLAN.md:34-48` | "P4 Closeout Checklist": step 3 updates "phase statuses + `initiative.status`" and has no `closeout` record | Align with the Bootstrap PLAN checklist |
| `goals/_template/ops/manifest.json` | `initiative.status` is `active`, so a naive `jq` scan counts `_template` as an active packet | `Inventory.ts:62`/`:183` exclude it from the inventory. Count it separately. |

`Adopt.ts:189-202` hashes the `_template` tree into `templateSnapshotHash`. The
test recomputes that hash live (`goals-bootstrap-plan.test.ts:216`, `:283`), so
editing `_template/GOAL.md` pins nothing.

## 2. The 4000-char GOAL.md budget

### 2.1 Where it is enforced

| File:line | Mechanism | Measure |
| --- | --- | --- |
| `Goals/Doctor.ts:110` | `export const GOAL_MD_MAX_CHARS = 4000` | |
| `Goals/Doctor.ts:1053-1062` | `goal-md-oversize`, **blocking**: "GOAL.md is N chars (hard maximum 4000)." | `record.goalMdChars` |
| `Goals/Inventory.ts:160` | `goalMdChars: O.map(goalMdText, Str.length)` | UTF-16 code units |
| `Knowledge/KnowledgeDoctor.domain.ts:210` | Same field, from git tree bytes | `Str.length` |
| `Goals/Materialize.ts:50`, `:104-105` | Refuses to publish a staged GOAL.md over 4000 (`Str.length`) | `Str.length` |
| `Goals/Bootstrap.schemas.ts:233`, `:759` | `goal-md-within-budget` validation; maps `goal-md-oversize` to it | |
| `Goals/Adopt.ts:269` | Adopt validation list includes `goal-md-within-budget` | |
| Launcher Verification block (`Bootstrap.ts:320`), manifest `verificationCommands` (`:211`), `goals/README.md:273-277` | `test "$(wc -m < …/GOAL.md)" -le 4000` | **Locale-dependent** |
| `Codex/Findings.packet.ts:528-529`, `test/codex-findings-packet.test.ts:142`, `:288` | The codex-findings GOAL.md generator keeps its launcher under `GOAL_MD_MAX_CHARS` | |

**Locale gotcha.** `wc -m` counts bytes under `LC_ALL=C`. The headless
`env -i … TERM=dumb` launch recipe sets no `LANG`. `goals/semantica-storage-inversion/GOAL.md`
is 3991 code points (doctor passes) but 4008 bytes, so its own Verification
command fails in a C-locale shell. Treat doctor's `Str.length` as the authority
for the rewrite gate. Bytes are reported only as a warning.

### 2.2 Current numbers (97 active/paused packets plus `_template`)

- **Max today: 3991 chars, `goals/semantica-storage-inversion`, headroom 9.**
  The runner-up is `goals/ontology-sidecar-stateless-identity` at 3990 (headroom 10).
- 12 packets are over 3800 chars. The mean is 3063.
- No packet is over 4000 today, so doctor's `goal-md-oversize` is clean.

## 3. Prose that states the done condition or the two-PR closeout

### 3.1 `AGENTS.md` (`CLAUDE.md` is a symlink to it)

| Lines | Text | Action |
| --- | --- | --- |
| **`:389-396`** (Docs & Knowledge) | "Goal closeout is two PRs: the final PR lands the work, the reflection and `proposedCloseout` (status stays active or paused); after it merges, `goals completion refresh --slug <slug>` verifies it and `goals set-status <slug> <status>` adopts it in a packet-state PR that also rewrites the packet's status prose (README, `statusNote`). A goal is done only once that PR merges and `origin/main`'s manifest has `closeout.status == initiative.status`; `goals doctor` reports a verified, unadopted proposal as `closeout-adoption-pending`." | **Rewrite** (5.3) |
| `:180-182` (Autonomy) | "A started goal runs to `completed-retained`: finish a phase and start the next, through closeout and the reflection." | Consistent. Optionally add "and its verification". |
| `:183-188` (Autonomy) | Agents and the orchestrator merge at the gate | Consistent with D-hand (`operator-hand-merges-goal-finals-no-merger-guard.md:8`): no change |
| `:189-197` (Autonomy) | Issues only for work "blocked on the operator, on elapsed time or on money" | Consistent. The operator-ruling exit is a blocked-on-operator case. |

AGENTS.md is in the always-loaded prompt prefix (`AGENTS.md:436-438`), so make
this edit in the same commit as the other AGENTS.md edits.

### 3.2 Skills (`.agents/skills` is a symlink to `../.claude/skills`, so the mirrors are the same files)

| File:line | Text | Action |
| --- | --- | --- |
| `.claude/skills/closeout/SKILL.md:77-79` | "`Adopt the <slug> closeout (Recommended)` — after a goal's final PR merges: `goals completion refresh`, then `goals set-status` in a packet-state PR. A goal is not done, and `/goal` must not stop, until that PR merges." | **Rewrite** to "Verify the <slug> closeout" (5.4) |
| `.claude/skills/closeout/SKILL.md:80-85` | "`Archive the <slug> packet` — after the adoption PR merges: … land the tombstone in a packet-state PR" | Change "adoption PR merges" to "closeout verifies". The archive tombstone PR stays: it is a different packet-state PR. |
| `.claude/skills/reflect/SKILL.md:24-30` | Write the reflection "before preparing a typed `proposedCloseout` or adopting a committed closeout as `completed-retained`" | **Rewrite**: before writing the `closeout` record in the final PR |
| `.claude/skills/yeet/references/sweep-retire.md:70-78` | A packet still `active` after merge: "that packet's lifecycle flip belonged in the merged PR, so open the closeout PR"; doctor `active-after-merge` (`Doctor.ts:137`, `:1235`) | Consistent with one PR. Optionally say the follow-up becomes the new final and names itself. |
| `.claude/skills/yeet/**`, `.claude/skills/orchestrate/**`, `.claude/skills/operator-handoff/**` | `rg` for `completion refresh`, `proposedCloseout`, `packet-state`, `set-status`, `closeout.status`, `Done only` finds no hits | No change |
| `.codex/config.toml:46-48` | Only enables the `closeout` skill; `.codex/` and `.agents/agents/` carry no closeout prose | No change |

### 3.3 `goals/README.md` (outside the requested globs, but authoritative and stale)

| Lines | Text | Action |
| --- | --- | --- |
| `:174` | Archive "is the default closeout step once the adoption PR merges" | "once the closeout verifies" |
| `:203-207` | "A goal is **achieved** only after exact-head hosted readiness and merge evidence verify its final delivery PR." | Keep; restate as hosted facts (D-hosted) |
| `:209-229` | Keep `initiative.status` operative; declare `proposedCloseout` (JSON example); "`completionGate.acceptanceEvidence` must include a gating `yeet-verdict`"; missing review/window/readiness proof blocks promotion | **Rewrite** (D-onepr, D-hosted, D-mig) |
| `:231-240` | "After merge, `goals completion refresh` … The proposal remains in the merged manifest; no second PR is required to rewrite it as achieved." … "Launchers must resume the outstanding gate work when a proposal is present." | **Rewrite**. It already contradicts `AGENTS.md:389-396`. Becomes: closeout written in the final PR, refresh verifies, red attribution (D-red), any-time re-derivation (D-after), operator-ruling exit, one-month rule-suite limit. |
| `:273-277` | `wc -m` budget check in the New Packet Checklist | Add the locale note (2.1) |

### 3.4 `docs/**` and `standards/**`

`rg` for `completion refresh`, `proposedCloseout`, `closeout-adoption-pending`,
`Done only`, `packet-state`, `set-status`, `closeout.status`, `two PRs` and
`launcher` finds **no current statement** of the goal done-condition. The
remaining hits are unrelated:

- `docs/reports/repository-recovery-2026-10-20.md:217`: historical issue row (#1582).
- `standards/effect-first-development.md:589-596`: "EF-20: Completion gate is strict", about `check/lint/test/docgen`.
- `docs/runbooks/codex-security.md:81`, `docs/runbooks/codex-security-cloud.md:72-76`: Codex packet completion, not goal closeout.
- `standards/cache-qualification-baseline.json:2405`: `goals/*/GOAL.md` is a Turbo input of `goals:doctor`. That is a cache key, not a content pin.

### 3.5 Other GOAL.md generators (not Bootstrap)

| File:line | Done paragraph? | Note |
| --- | --- | --- |
| `Codex/Findings.packet.ts:518-578` (`goalDocument`) | None. Ends with a "Stop if…" sentence (`:573-575`). | PLAN P9 (`:605`): "Packet set to `completed-retained` in the same closeout PR state", which is already one PR. Its size is pinned by `codex-findings-packet.test.ts:142`, `:288`. |
| `Codex/Security.packet.ts:86-99` | None | SPEC line `:109` states completion |

D-done names only "the launcher" and the active packets. Whether these
generators gain the paragraph is open question 4.

### 3.6 Code and tests that print or pin the old flow (for the code lane, not this rewrite)

| File:line | Pins |
| --- | --- |
| `Goals/Completion.ts:1212-1214` | Prints "next: bun run beep goals set-status … then merge that packet-state PR" |
| `Goals/Completion.ts:1243`, `:1248` | Prints `[goals:completion] <slug> #<n>: <outcome>`, which is what "prints verified" in 5.1 refers to |
| `Goals/Doctor.ts:142`, `:1505-1543` (message `:1539`) | `closeout-adoption-pending` advisory and its set-status hint |
| `Goals/Bootstrap.schemas.ts:768` | `"closeout-adoption-pending": []` validation mapping |
| `Goals/SetStatus.ts:440-448`, `:469-479` | Refusal and adoption messages built around `proposedCloseout` |
| `Goals/Goals.schemas.ts:1471-1472` | Renders "(verified via #N, adoption pending)" / "(proposed via #N, unverified)" |
| `test/goals-doctor.test.ts:529` | `expect(output).toContain("pending [closeout-adoption-pending]")` |

### 3.7 Lints and tests that pin **launcher text**

Only the bootstrap golden fixtures pin it. No lint reads GOAL.md content; doctor
reads only its length (`Inventory.ts:151`, `:160`).

| File:line | Pinned |
| --- | --- |
| `test/fixtures/goals-plan/bootstrap-minimal.json:25-26` | GOAL.md payload + `payloadDigest` |
| `…/bootstrap-minimal.json:41-42` | PLAN.md payload (closeout checklist) + digest |
| `…/bootstrap-minimal.json:86` | `planId`, which covers every digest |
| `bootstrap-full.json`, `bootstrap-report-first.json` | Same layout (GOAL payload at line 25 in each) |
| `test/goals-bootstrap-plan.test.ts:58-60`, `:94-105`, `:109-141` | `expectGolden` compares byte for byte; `REGEN_GOLDENS=1` rewrites (env declared at `turbo.json:22`) |

Regenerate with `REGEN_GOLDENS=1` on `goals-bootstrap-plan.test.ts` only, then
review the three diffs. Neither `goals-materialize.test.ts:71` (validation
names only) nor any doctor or reflection test asserts launcher prose.

## 4. Active and paused packets: done-paragraph variants

Population: **97 packets** (83 `active`, 14 `paused`, by `initiative.status`),
all with a GOAL.md, **plus `goals/_template`**. Excluded by D-done: 194
`completed-retained`, 4 `reference`, 3 `superseded`. The count includes this
goal's own untracked packet, so `main` has 96.

### 4.1 Variants, exact text (slug written `<slug>`)

**T2703**: current template, `Bootstrap.ts:333-338`. **29 packets**, all exact
byte matches and all the final paragraph. Example:
`goals/beep-cli-composition/GOAL.md:64-69`.

```text
Ship proposedCloseout and the reflection in the final PR (status stays active or
paused). After that merge, verify with `bun run beep goals completion refresh --slug <slug>`,
then adopt with `bun run beep goals set-status <slug> <status>` in a
packet-state PR. Done only once it merges and this passes, or an operator
blocker is reported with evidence:
`git show origin/main:goals/<slug>/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
```

**T1928** (`426d494b343`). **1 packet**, exact:
`goals/goal-packet-conflict-free-appends/GOAL.md:60-64`.

```text
Ship proposedCloseout and the reflection in the final implementation PR while
initiative.status stays active or paused. A proposal never reports achievement.
Done only when exact-head hosted readiness and merge evidence verify the proposal
through `bun run beep goals completion refresh --slug <slug>`, or when a blocker
that needs the operator is reported with file/command evidence.
```

**T1448** (`788dda66b52`). **7 packets plus `_template`**, exact. Example:
`goals/merge-queue-lab/GOAL.md:77-79`.

```text
Done only when the goal reaches `completed-retained` (acceptance passes,
verification is complete, closeout and reflection landed), or when a blocker
that needs the operator is reported with file/command evidence.
```

**T762** (`ac8acbab3b4`). **14 packets**: 9 exact (example
`goals/agent-pool-doctrine/GOAL.md:67-68`) and 5 with one identical rewrap,
"…, or when a\nblocker is reported…" (example
`goals/agentic-governance-laws/GOAL.md:77-78`).

```text
Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
```

**Bespoke**: **32 packets**, each with its own wording. A closeout-relevant
paragraph exists, but it matches no template.

**None**: **14 packets** with no done or closeout sentence. Most end on a
"Stop …" paragraph or a list of stop conditions. Example:
`goals/semantica-storage-inversion/GOAL.md:73-75`.

Counts: 29 + 1 + 7 + 14 + 32 + 14 = 97, plus `_template`.

### 4.2 Bespoke and none, by rewrite policy

- **R: replace the whole range.** The paragraph only restates SPEC acceptance
  and Yeet mergeability, or is a near-template two-PR paragraph. 11 bespoke
  packets:
  - `ontology-sidecar-stateless-identity:82-83` ("Done when…", a T762 paraphrase)
  - `agentic-professional-runtime:70-71` (T762 paraphrase)
  - `thread-virtualization:32-33`, `projection-dispatch-core:71-72`, `secure-document-delivery:71-72`
  - `law-time-capture-spine:66-68`, `law-docketing-reliability:67-69`
  - `uspto-prosecution-read:71-73`, `uspto-ptmnfee2-ingest:73-75`
  - `text-knowledge-stack-rebuild:73-77` (T2703 compressed, plus the gating `yeet-verdict`, no blocker exit)
  - `agent-memory-store:71-76` (T2703 plus "the gating `yeet-verdict`", which D-hosted makes stale)
- **S: edit one sentence in place, then append the new paragraph.** 8 packets:
  - `hybrid-retrieval-fusion-core:68-69`: drop "Done only when the PR is mergeable through Yeet or a blocker is reported with file/command evidence."
  - `configurable-full-document-editor:67-69`: drop "Done only after acceptance, exact-head hosted checks, zero unresolved threads, and `merge-ready: yes`."
  - `knowledge-freshness-audit:55-56`: drop "Final work carries reflection and proposed closeout; a separate packet-state PR adopts verified completion under AGENTS.md."
  - `turborepo-cache-trust-observability:25-27` and `turborepo-quality-cache-adoption:25-27` (identical text): drop "Future completion requires … then completion refresh and a separate merged packet-state adoption PR." Keep "Do not mark completed-retained now."
  - `nightly-research-routine:51` ("Same-PR packet-state flips on close."), `oa-evidence-consumer-conformance:24` ("same-PR lifecycle/reflection") and `citation-extraction-engine:35-37` ("Finish reflection, lifecycle and verified retention on main…"): already one-PR in spirit, so append only.
- **M: manual merge.** The packet has its own exit or gate that must survive. 8 packets:
  - `goal-portfolio-driver:61-63` (portfolio queue condition)
  - `agent-rating-critique-fixes:59-64` (rating ≥ 8.5 or named follow-ups; also cites `proposedCloseout`)
  - `effect-v4-workflow-engine-spike:70-72` (alternate exit: a documented engine failure)
  - `voice-composer-slice:74-75` (alternate exit: a recorded reshape or stop)
  - `law-docketing-patent-spine:65-67` (cross-packet gate on the reliability sibling)
  - `claim-check-performance:3-6` (stays active until the gates are demonstrated)
  - `ci-fleet-endgame:32-35` (P6-only remaining work)
  - `time-to-certainty:40-48` (resume paragraph carrying "the status flip and closeout reflection")

  Recommended form: turn "Done only when X" into "The final PR needs X" and
  append the new paragraph.
- **A: append only.** 6 bespoke packets whose marker hits are phase-list
  mentions ("flips packet state only when the completion gate is met",
  "close with a reflection"):
  - `semantica-atlas-sync`, `lejeune-knowledge-desk-lab`, `lejeune-demo-corpus-and-ontology`
  - `patent-drafting-episode-ledger`, `effect-native-legal-eval`, `folio-lynx-taxonomy-browse`

  Plus the 13 "none" packets other than `time-to-certainty`.

### 4.3 Per-packet table

"After Q" is the post-rewrite length with the proposed paragraph (5.1). Policy
R replaces the listed range. S, M and A are measured as a worst case: the
paragraph is appended at EOF with a blank line (+2), and no sentence is
removed. For A and M rows, "Lines" is the matched or last paragraph, not the
insertion point.

| Packet | Status | Variant | Policy | Lines | Chars now | After Q | Q headroom |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| `goals/heavy-pool-diet` | active | T2703 | R | 77-82 | 3954 | 3868 | 132 |
| `goals/route-soundness-repair` | active | T2703 | R | 76-81 | 3943 | 3850 | 150 |
| `goals/certainty-scorecard` | active | T2703 | R | 75-80 | 3838 | 3748 | 252 |
| `goals/local-proof-under-ten` | active | T2703 | R | 74-79 | 3804 | 3712 | 288 |
| `goals/yeet-monitor-app-identity` | active | T2703 | R | 72-77 | 3774 | 3678 | 322 |
| `goals/main-verdict-every-commit` | active | T2703 | R | 72-77 | 3746 | 3650 | 350 |
| `goals/hosted-setup-tax` | active | T2703 | R | 73-78 | 3722 | 3635 | 365 |
| `goals/github-budget-ledger` | active | T2703 | R | 73-78 | 3707 | 3616 | 384 |
| `goals/github-state-worker` | active | T2703 | R | 71-76 | 3583 | 3493 | 507 |
| `goals/infra-alchemy-rebuild` | active | T2703 | R | 60-65 | 3565 | 3473 | 527 |
| `goals/packet-archive-mechanics` | active | T2703 | R | 62-67 | 3523 | 3428 | 572 |
| `goals/oracle-loop-poc` | active | T2703 | R | 61-66 | 3465 | 3379 | 621 |
| `goals/outbox-draft-basis` | active | T2703 | R | 70-75 | 3452 | 3363 | 637 |
| `goals/harvested-alpha-triage` | active | T2703 | R | 62-67 | 3393 | 3300 | 700 |
| `goals/research-intake-2026-11` | active | T2703 | R | 60-65 | 3382 | 3288 | 712 |
| `goals/doc-hub-spokes-inversion` | active | T2703 | R | 60-65 | 3365 | 3270 | 730 |
| `goals/execution-authority-slice` | active | T2703 | R | 67-72 | 3362 | 3266 | 734 |
| `goals/skill-effect-probe` | active | T2703 | R | 69-74 | 3356 | 3267 | 733 |
| `goals/compute-profile-gate-routing` | active | T2703 | R | 60-65 | 3354 | 3255 | 745 |
| `goals/declaration-only-builds` | active | T2703 | R | 67-72 | 3320 | 3226 | 774 |
| `goals/canonical-digest-owner` | active | T2703 | R | 67-72 | 3292 | 3199 | 801 |
| `goals/lane-cockpit-spike` | active | T2703 | R | 68-73 | 3289 | 3200 | 800 |
| `goals/scripts-to-beep-cli` | active | T2703 | R | 60-65 | 3248 | 3158 | 842 |
| `goals/python-free-repo` | active | T2703 | R | 60-65 | 3210 | 3123 | 877 |
| `goals/yeet-async-merge-and-stacks` | active | T2703 | R | 63-68 | 3186 | 3088 | 912 |
| `goals/repo-cli-gh-git-consolidation` | active | T2703 | R | 61-66 | 3153 | 3053 | 947 |
| `goals/hold-ledger` | active | T2703 | R | 60-65 | 3118 | 3036 | 964 |
| `goals/beep-cli-composition` | active | T2703 | R | 64-69 | 3091 | 3000 | 1000 |
| `goals/goal-closeout-hosted-verification` | active | T2703 | R | 60-65 | 3036 | 2932 | 1068 |
| `goals/goal-packet-conflict-free-appends` | active | T1928 | R | 60-64 | 2882 | 2930 | 1070 |
| `goals/merge-queue-lab` | active | T1448 | R | 77-79 | 3466 | 3649 | 351 |
| `goals/design-figure-review-loop` | active | T1448 | R | 68-70 | 3167 | 3370 | 630 |
| `goals/skill-contract-gate-certificates` | active | T1448 | R | 65-67 | 2985 | 3202 | 798 |
| `goals/practice-gateway` | active | T1448 | R | 67-69 | 2954 | 3139 | 861 |
| `goals/webapp-and-ci-telemetry` | active | T1448 | R | 60-62 | 2865 | 3064 | 936 |
| `goals/harness-emitters-all-providers` | active | T1448 | R | 60-62 | 2834 | 3047 | 953 |
| `goals/fleet-telemetry-tailnet` | active | T1448 | R | 60-62 | 2822 | 3021 | 979 |
| `goals/_template` | (scaffold) | T1448 | R | 61-63 | 2443 | 2614 | 1386 |
| `goals/canonical-proof-reconciliation` | active | T762 | R | 82-83 | 3953 | 4259 **over** | -259 |
| `goals/slice-topology-audit` | active | T762 | R | 80-81 | 3746 | 4032 **over** | -32 |
| `goals/practice-mail-backfill` | active | T762 | R | 79-80 | 3739 | 4029 **over** | -29 |
| `goals/agentic-governance-laws` | active | T762 | R | 77-78 | 3679 | 3971 | 29 |
| `goals/openclaw-workstation-agent` | active | T762 | R | 76-77 | 3614 | 3912 | 88 |
| `goals/coding-agent-effectiveness-evidence-loop` | active | T762 | R | 75-76 | 3515 | 3841 | 159 |
| `goals/legal-document-intake` | active | T762 | R | 70-71 | 3269 | 3557 | 443 |
| `goals/agent-pool-doctrine` | active | T762 | R | 67-68 | 2984 | 3268 | 732 |
| `goals/m365-agent-outbox` | active | T762 | R | 68-69 | 2758 | 3038 | 962 |
| `goals/lane-bootstrap` | active | T762 | R | 57-58 | 2467 | 2741 | 1259 |
| `goals/legacy-drain` | active | T762 | R | 57-58 | 2420 | 2690 | 1310 |
| `goals/ops-seat-timers` | active | T762 | R | 57-58 | 2384 | 2660 | 1340 |
| `goals/ai-metrics-raw-retention` | active | T762 | R | 57-58 | 2364 | 2658 | 1342 |
| `goals/agent-pool-picker` | paused | T762 | R | 55-56 | 2177 | 2457 | 1543 |
| `goals/ontology-sidecar-stateless-identity` | active | bespoke | R | 82-83 | 3990 | 4316 **over** | -316 |
| `goals/text-knowledge-stack-rebuild` | active | bespoke | R | 73-77 | 3962 | 3946 | 54 |
| `goals/agent-memory-store` | active | bespoke | R | 71-76 | 3769 | 3653 | 347 |
| `goals/projection-dispatch-core` | active | bespoke | R | 71-72 | 3499 | 3764 | 236 |
| `goals/uspto-ptmnfee2-ingest` | active | bespoke | R | 73-75 | 3497 | 3704 | 296 |
| `goals/uspto-prosecution-read` | active | bespoke | R | 71-73 | 3449 | 3661 | 339 |
| `goals/secure-document-delivery` | active | bespoke | R | 71-72 | 3436 | 3724 | 276 |
| `goals/agentic-professional-runtime` | active | bespoke | R | 70-71 | 3429 | 3742 | 258 |
| `goals/law-time-capture-spine` | active | bespoke | R | 66-68 | 3011 | 3250 | 750 |
| `goals/law-docketing-reliability` | active | bespoke | R | 67-69 | 2963 | 3198 | 802 |
| `goals/thread-virtualization` | active | bespoke | R | 32-33 | 1422 | 1708 | 2292 |
| `goals/configurable-full-document-editor` | paused | bespoke | S | 65-69 | 3494 | 3928 | 72 |
| `goals/hybrid-retrieval-fusion-core` | active | bespoke | S | 67-69 | 3319 | 3743 | 257 |
| `goals/knowledge-freshness-audit` | active | bespoke | S | 53-56 | 2975 | 3393 | 607 |
| `goals/nightly-research-routine` | active | bespoke | S | 49-52 | 2721 | 3137 | 863 |
| `goals/citation-extraction-engine` | active | bespoke | S | 32-37 | 2289 | 2709 | 1291 |
| `goals/oa-evidence-consumer-conformance` | paused | bespoke | S | 22-25 | 1631 | 2063 | 1937 |
| `goals/turborepo-cache-trust-observability` | paused | bespoke | S | 25-29 | 1578 | 2016 | 1984 |
| `goals/turborepo-quality-cache-adoption` | paused | bespoke | S | 25-29 | 1535 | 1967 | 2033 |
| `goals/goal-portfolio-driver` | paused | bespoke | M | 61-63 | 3975 | 4385 **over** | -385 |
| `goals/effect-v4-workflow-engine-spike` | active | bespoke | M | 70-72 | 3481 | 3911 | 89 |
| `goals/voice-composer-slice` | active | bespoke | M | 74-75 | 3455 | 3863 | 137 |
| `goals/law-docketing-patent-spine` | active | bespoke | M | 65-67 | 2947 | 3367 | 633 |
| `goals/agent-rating-critique-fixes` | active | bespoke | M | 59-64 | 2705 | 3127 | 873 |
| `goals/claim-check-performance` | active | bespoke | M | 3-6 | 2514 | 2928 | 1072 |
| `goals/ci-fleet-endgame` | active | bespoke | M | 32-35 | 2367 | 2767 | 1233 |
| `goals/semantica-atlas-sync` | active | bespoke | A | 41-57 | 3858 | 4266 **over** | -266 |
| `goals/lejeune-knowledge-desk-lab` | paused | bespoke | A | 32-43 | 3146 | 3566 | 434 |
| `goals/lejeune-demo-corpus-and-ontology` | active | bespoke | A | 30-39 | 3038 | 3470 | 530 |
| `goals/patent-drafting-episode-ledger` | paused | bespoke | A | 20-22 | 1073 | 1501 | 2499 |
| `goals/effect-native-legal-eval` | paused | bespoke | A | 20-21 | 1010 | 1426 | 2574 |
| `goals/folio-lynx-taxonomy-browse` | active | bespoke | A | 13-14 | 602 | 1022 | 2978 |
| `goals/time-to-certainty` | paused | none | M | 40-48 | 3562 | 3964 | 36 |
| `goals/semantica-storage-inversion` | active | none | A | 73-75 | 3991 | 4413 **over** | -413 |
| `goals/semantica-reasoning-spike` | active | none | A | 72-75 | 3933 | 4351 **over** | -351 |
| `goals/cloud-agent-readiness` | active | none | A | 57-62 | 3912 | 4322 **over** | -322 |
| `goals/agentic-cad-patent-tooling` | active | none | A | 72-77 | 3656 | 4076 **over** | -76 |
| `goals/oppold-corpus-salvage-restoration` | active | none | A | 70-71 | 3484 | 3918 | 82 |
| `goals/ci-step-watchdog` | paused | none | A | 66-70 | 3441 | 3841 | 159 |
| `goals/ci-lane-economics` | active | none | A | 54-58 | 3266 | 3668 | 332 |
| `goals/professional-desktop-adversarial-qa` | active | none | A | 38-41 | 2118 | 2556 | 1444 |
| `goals/agent-outcome-experiments` | paused | none | A | 17-17 | 2051 | 2469 | 1531 |
| `goals/harness-telemetry-enrollment` | active | none | A | 17-17 | 2020 | 2444 | 1556 |
| `goals/model-arrangement-admission-core` | paused | none | A | 38-40 | 1945 | 2377 | 1623 |
| `goals/belief-view-engine` | paused | none | A | 38-40 | 1905 | 2309 | 1691 |
| `goals/tracked-changes-ingest-wedge` | active | none | A | 20-22 | 1063 | 1487 | 2513 |

## 5. Proposed text

### 5.1 The launcher done paragraph ("Q"), template and every active/paused packet

Rendered (slug written `<slug>`):

```text
The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug <slug>` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/<slug>/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
```

As the replacement for `Bootstrap.ts:333-338` (template literal; backticks escaped):

```ts
The final PR carries the reflection and writes \`closeout\` naming itself. Done
only when this passes and \`goals completion refresh --slug ${input.slug}\` prints
verified, when this passes under an operator ruling in \`decisions/\`, or when an
operator blocker is reported with evidence:
\`git show origin/main:goals/${input.slug}/ops/manifest.json | jq -e '.closeout.status == .initiative.status'\`
`;
```

How it maps to the rulings:

- **Exit 1 (D-done plus D-onepr):** the jq is true on `origin/main` and refresh
  prints `verified`. Under one-PR closeout the jq is already true when the final
  merges, so jq alone cannot tell a verified final from an unverified one. The
  refresh clause carries that. Refresh prints
  `[goals:completion] <slug> #<n>: <outcome>` (`Completion.ts:1248`).
- **Exit 2 (D-exit):** an operator ruling recorded under `decisions/` and the
  same jq true on `origin/main`. That is one file plus one jq line, as the
  ruling asks.
- **Exit 3:** the operator-blocker report, kept from today's template.
- `proposedCloseout`, `packet-state PR` and `set-status <status>` are gone
  (D-onepr, D-mig). The `bun run beep` prefix is dropped to save 13 chars per
  mention; AGENTS.md already uses the bare `goals …` form (`:391-392`).

Size: **366 fixed chars plus 2 × slug.** T2703 is 437 + 3 × slug, so all 29
T2703 packets shrink by 71 + slug. A fresh bootstrap goes from 2527 to 2456
fixed chars and 9 slug mentions. With a 64-char slug (`Bootstrap.schemas.ts:62-63`)
that leaves 968 chars for title plus mission.

Alternatives measured:

- **P**, with full `bun run beep` commands plus the `set-status … completed-retained`
  command: 446 fixed + 3 slugs, **17 packets over**.
- **QMIN**, Q with "and the closeout verifies" in place of the refresh command:
  337 fixed + 1 slug, **8 over**. It drops the runnable verification step.

### 5.2 Budget outcome with Q

- After the rewrite: max **4413** (`semantica-storage-inversion`). **10 packets
  exceed 4000** and need prose trimmed outside the done paragraph. The other 87
  and `_template` fit.
- T762 packets carry the 181-char "Repo root: the current working directory —
  …" preamble. Shrinking it to "Repo root: the current `beep-effect` checkout;
  all paths below are repo-relative." (about 80 chars) saves about 100, which
  fixes these three:

  | Packet | Over by |
  | --- | ---: |
  | `slice-topology-audit` | 32 |
  | `practice-mail-backfill` | 29 |
  | `agentic-cad-patent-tooling` | 76 |

- `canonical-proof-reconciliation` (over by 259): the preamble cut plus its
  T762-era "Stop and report before changing public API … unless `SPEC.md`
  explicitly requires it" paragraph (203 chars). That paragraph contradicts the
  Autonomy charter (`AGENTS.md:164-179`), so removing or replacing it is a
  defensible fix.
- Dense hand-authored launchers need manual trims. None carries template
  boilerplate (`ontology-sidecar` has only the 181-char Acceptance block):

  | Packet | Over by |
  | --- | ---: |
  | `semantica-storage-inversion` | 413 |
  | `goal-portfolio-driver` | 385, or less if its done paragraph merges |
  | `semantica-reasoning-spike` | 351 |
  | `cloud-agent-readiness` | 322 |
  | `ontology-sidecar-stateless-identity` | 316 |
  | `semantica-atlas-sync` | 266 |

- Tight but passing (headroom under 100): `agentic-governance-laws` 29,
  `time-to-certainty` 36, `text-knowledge-stack-rebuild` 54,
  `configurable-full-document-editor` 72, `oppold-corpus-salvage-restoration` 82,
  `openclaw-workstation-agent` 88, `effect-v4-workflow-engine-spike` 89.

### 5.3 AGENTS.md `:389-396` replacement (Docs & Knowledge)

```text
- Goal closeout is one PR: the final PR lands the work, the reflection and the
  `closeout` record naming itself, with `initiative.status` to match. After it
  merges, `goals completion refresh --slug <slug>` verifies it from hosted facts
  alone (merged; every required check green at the merged head, or each red
  named with its attribution and fix PR in a `decisions/` file; no outstanding
  review thread), at any later time, and `goals doctor` blocks on an unverified
  closeout. A goal is done only once `origin/main`'s manifest has
  `closeout.status == initiative.status` and the closeout verifies, or an
  operator ruling under `goals/<slug>/decisions/` closes it (needed when GitHub
  no longer lists the final's rule suite, after one month).
```

Autonomy `:180-182` needs no change. Optional: "…through closeout, its
verification and the reflection."

### 5.4 Companion edits

- `.claude/skills/closeout/SKILL.md:77-79`: change the option to:
  "`Verify the <slug> closeout (Recommended)` — after a goal's final PR merges:
  `goals completion refresh --slug <slug>`. Unknown or unverified means attribute
  reds in a decision file, re-final, or record the operator ruling. A goal is not
  done, and `/goal` must not stop, until it verifies or an operator ruling closes
  it."
- `.claude/skills/closeout/SKILL.md:80`: "after the adoption PR merges" becomes
  "after the closeout verifies".
- `.claude/skills/reflect/SKILL.md:24-26`: "…writes one before writing the
  `closeout` record in the final PR (`completed-retained`)…".
- `Bootstrap.ts:434-437` (PLAN checklist step 3): "…phase statuses, and the
  `closeout` record (`completed-retained`, this PR as `finalPullRequest`) with
  `initiative.status` to match, in the final PR."
- `goals/_template/GOAL.md:61-63`: replace with Q, keeping `<slug>`.
  `goals/_template/PLAN.md:47-48` gets the same step 3.
- `goals/README.md:174` and `:203-240`: rewrite per 3.3.

## 6. Rewrite script contract

1. Select packets by `jq -r .initiative.status goals/*/ops/manifest.json` ∈
   {`active`, `paused`}, then add `goals/_template` explicitly (it uses `<slug>`).
2. For T2703, T1928, T1448 and T762 (exact and rewrap), the old text is known (4.1).
   Substitute the slug and require **exactly one** occurrence, as the **final
   paragraph**; it is final in all 52 template-family files (51 packets plus
   `_template`). Replace it with Q. Fail on 0 or more than 1 match.
3. For bespoke R, replace the listed line range only after re-verifying the
   paragraph's first words, since line numbers drift with any intervening edit.
4. For S, remove the quoted sentence exactly (4.2), then append Q after one
   blank line.
5. For M, hand-edit (4.2), then append Q.
6. For A, append `\n` + Q + `\n` at EOF. All 97 packet launchers and `_template` already end in `\n`.
7. Gate: the doctor measure (`Str.length`) ≤ 4000 for every touched file. Report
   `LC_ALL=C wc -m` alongside as a warning. Stop on the 10 overflow packets
   until they are trimmed by hand (5.2).
8. Afterwards: `REGEN_GOLDENS=1` for `goals-bootstrap-plan.test.ts`, then
   `bun run beep goals doctor` (no `goal-md-oversize`) and `git diff --check -- goals`.

The batch touches 97 packet launchers that other lanes may be editing. Land it
in one push and tell open lanes to merge `main` (`AGENTS.md:205-212`).

## 7. Open questions

1. **Does done require verification, or only the jq?** D-done names only the
   jq, but under D-onepr the jq is true the moment the final merges. Q requires
   both. If the operator meant jq alone, QMIN-style wording saves about 30 chars
   per packet but lets `/goal` stop on an unverified final.
2. **How is an operator-ruling decision recognized mechanically?** The two
   precedents differ:
   - `goals/alchemy-vault-sync-slice/decisions/2026-11-12-operator-ruling-close-in-one-packet-state-pr.md:2` puts "Operator ruling:" in the title.
   - The nine decisions in this packet put "Operator ruling 2026-11-12." in the body (`:8`).

   A frontmatter marker (`ruling: operator`, or a third `GoalDecisionKind`
   beside `decision`/`checkpoint`, `Decisions.schemas.ts:55`) would let doctor
   suppress its blocking unverified-closeout finding (D-onepr). Without it, the
   ruling exit leaves a permanent blocking doctor row.
3. **What command writes `closeout` in the final PR?** `goals set-status
   <slug> completed-retained` refuses today without a verified view
   (`SetStatus.ts:437-448`). The final's PR number exists only after `yeet
   publish` opens it, so the flow becomes: publish, then set-status with the
   PR number, then push. Q avoids naming the command. AGENTS.md (5.3) should
   name it once the code lane settles it.
4. **Do the codex packet generators gain the paragraph?** `Findings.packet.ts:518-578`
   and `Security.packet.ts:86-99` emit launchers with no done paragraph, and
   `codex-findings-packet.test.ts:142`, `:288` pin their size.
5. **Is trimming unrelated launcher prose in the 10 overflow packets in scope**
   for the D-done PR, or does each overflow packet get its own small edit in
   that PR? Removing the stale "Stop and report before changing…" paragraph in
   T762 packets is a policy edit beyond D-done.
6. **Do `goals/_template/` and `goals/README.md` join the same PR?** D-done
   names only "the template" and the active packets, but both still teach the
   old flow (1.2, 3.3).
