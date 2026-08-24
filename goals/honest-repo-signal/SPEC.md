# Honest Repo Signal Spec

## Objective

After one Yeet-driven PR, the first-party tree no longer claims drivers it
does not have, coverage no longer awards 100% to a `VERSION` constant, git
author graphs are documented as subtree-poisoned, the public clone has the
cheap human files, and `AGENTS.md` gains a short Touch → Skill/Command table
without growing into an encyclopedia.

## Non-Goals

- Recreating Federal Register, DOL, or CourtListener drivers.
- Touching `@beep/protobuf` (another clone is removing it).
- Implementing `beep goals bootstrap` (KSA Workstream E).
- Rewriting git history / filter-repo.
- UI coverage campaigns, CI fleet calm, Effect RC risk, bus factor.
- Relitigating `goals/knowledge-surface-automation` P2 decisions.
- Adding a CODE_OF_CONDUCT.md (community theater for a single-operator lab).

## Source Hierarchy

1. This session's locked grill decisions (below).
2. `AGENTS.md` / `CLAUDE.md`.
3. `standards/ARCHITECTURE.md` and
   `standards/architecture/DECISIONS.md` (especially
   2026-06-21 Remove Placeholder Shared-Kernel Packages).
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.
6. `research/FOLLOW-UPS.md`, `research/SOURCES.md`.

## Target Surfaces

- `packages/drivers/{courtlistener,dol,federal-register}` and their
  workspace / tsconfig / coverage / knip / catalog registrations.
- Root `CONTRIBUTING.md`, `SECURITY.md`, `.github/CODEOWNERS`,
  `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`.
- `README.md` (subtree / first-party honesty; publication-not-community).
- `AGENTS.md` (Touch → Skill/Command table only; no other growth).
- `goals/gov-legal-data-driver-delivery/README.md` — one paragraph that the
  empty-scaffold keep is superseded; follow-ups live here.
- `goals/honest-repo-signal/**`.

## Cut / keep

### Keep

- Family/kind grammar, architecture-lab proof, `beep architecture` /
  `create-package` generators.
- Ratchets (coverage, knip, schema-first, JSDoc, fallow) as the real
  back-pressure. Correctness is not in the prompt.
- `.repos/effect` as a **squash-pinned** Effect v4 source pin. Do not add
  more subtrees.
- Real drivers and product slices. `oip-web` as the shipped site.
- Packet system. KSA owns knowledge gates. `ci-fleet-endgame` owns CI calm.
- Delivery-packet **research and specs** for FedReg / DOL / CourtListener.

### Cut tonight

- VERSION-only workspace packages: `@beep/courtlistener`, `@beep/dol`,
  `@beep/federal-register`.
- The delivery packet's "retain empty scaffolds" closeout sentence
  (superseded; names move to `research/FOLLOW-UPS.md`).
- Naive trust in `git log` author counts (document, do not rewrite).

### Do not cut

- `@beep/protobuf` (other clone).
- `@beep/ecfr` / `@beep/govinfo` (real surfaces).
- Historical git objects. Policy going forward only.

## Locked decisions

| ID | Decision | Rationale | Rejected |
| --- | --- | --- | --- |
| D1 | One execution packet, one-night scope, easy lifts across the rating metrics. | User asked for a single night, not a portfolio. | Mega-audit; exploration-first delay. |
| D2 | Delete VERSION-only drivers; record owning goals in `research/FOLLOW-UPS.md`. | Doctrine 2026-06-21 already removed placeholder shared-kernel packages. Empty drivers make coverage and topology lie. Delivery packet kept stubs as name claims; user overrode that. | Keep stubs; exclude-from-coverage only. |
| D3 | Do not touch `@beep/protobuf`. | User: another clone is removing it. | Bundling protobuf into this PR. |
| D4 | Public files tonight: `CONTRIBUTING.md`, `SECURITY.md`, `CODEOWNERS`, PR template, issue-template config. No `CODE_OF_CONDUCT.md`. | User named CONTRIBUTING/SECURITY as easy wins. CoC is community theater for a lab. | Full OSS-community kit. |
| D5 | Instruction-surface tonight = a short always-on Touch → Skill/Command table in `AGENTS.md`. No hooks. No more laws. | Progressive disclosure is voluntary; hooks fire late or expand the tool surface. The missing piece is a mandatory load map, not more prose. Ratchets stay the fail-closed back-pressure. | Hooks-first; more AGENTS.md encyclopedia; folding into KSA. |
| D6 | Subtree policy in README only. No filter-repo. | Current `.repos/effect` pin is the right shape. History rewrite is not a night. | Import more research clones; rewrite history. |
| D7 | `beep goals bootstrap` is a KSA follow-up, not this packet. Scaffolded from `goals/_template`. | Live CLI (2026-08-13): `goals` has `doctor`, `index`, `set-status` only. Bootstrap is specified in KSA Workstream E and not implemented. | Pretend bootstrap exists; implement bootstrap here. |
| D8 | Yeet this honesty PR as-is, then stop. | Grill 2026-08-13. P1 is already in the tree. Do not pile MUI or schema-wall work onto this branch. | Keep the branch open and stack the next win. |
| D9 | MUI cut waits until housekeeping PR1 is on `main` and desktop UX #675 settles. | 07 already homes UI in `foundation/ui-system`. MUI is a second theme engine, not a lie. Parallel workbenches make it a packet, not a night. | Start MUI immediately after yeet; leave MUI forever. |
| D10 | No special coordination protocol with the sibling beep-effect2 clone. If both land, resolve the conflict. | Operator: first-lander wins, the rest rebases. Do not start EntitySchema/Model/VariantSchema deletion in this packet. | Wait-for-their-PR1; parallel TaggedError/EntitySchema cut here. |

## Constraints

- Recreate a deleted driver only with a real surface in the same PR.
- Preserve delivery-packet research paths; do not move specs.
- `AGENTS.md` byte count must not grow by more than the table (net-neutral
  preferred: drop one redundant sentence if needed).
- `GOAL.md` ≤ 4000 characters.
- Public repo: no secrets, no home paths, no client matter text.

## Acceptance Criteria

- [x] The three named driver packages are gone from the workspace, tsconfig
      aliases, and coverage baseline.
- [x] `research/FOLLOW-UPS.md` lists each deletion, owning goal, resume
      trigger, and restart artifact.
- [x] Delivery README no longer says the empty scaffolds must be retained.
- [x] `CONTRIBUTING.md` and `SECURITY.md` exist and tell the truth (this is
      a publication; report vulns; no plaintext secrets).
- [x] `.github/CODEOWNERS`, PR template, and issue-template config exist.
- [x] README documents first-party vs `.repos/effect` and forbids new
      full-history subtree imports.
- [x] `AGENTS.md` has a Touch → Skill/Command table; no new always-on laws.
- [x] `@beep/protobuf` is untouched.
- [x] No unrelated refactors.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/honest-repo-signal/GOAL.md)" -le 4000` | Passes |
| Manifest | `jq . goals/honest-repo-signal/ops/manifest.json` | Passes |
| Index | `bun run beep goals index --check` | Passes |
| Doctor | `bun run beep goals doctor` | No new blocking findings |
| Stubs gone | `test -z "$(git ls-files packages/drivers/courtlistener packages/drivers/dol packages/drivers/federal-register)"` | Passes (tracked state — gitignored build residue falsifies `test ! -d`) |
| Protobuf left | Retired 2026-08-13 — the sibling clone removed `@beep/protobuf` in PR #690; this packet did not perform that deletion | Guard expired; no longer checked |
| Follow-ups | `rg -n "federal-register|dol|courtlistener" goals/honest-repo-signal/research/FOLLOW-UPS.md` | Each stub named |
| Whitespace | `git diff --check -- goals/honest-repo-signal` | Passes |

## Stop Conditions

- A listed stub has a first-party product import (not alias/coverage).
- Protobuf collision with the other clone.
- Scope grows past the one-night cut list.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Delivery packet said keep empty scaffolds | `goals/gov-legal-data-driver-delivery` | this packet | User overrode name-claim stubs; research remains | Follow-ups recreated as real drivers |
| Closeout landed in a separate PR (#777), not the same PR as final work (#680) | this packet P4 | this packet | D8 locked "yeet then stop", scoping the reflection and status flip out of the shipping PR; discovered 2026-08-24 and recorded here as an approved exception to the same-PR flip law rather than leaving a finished packet open | None — historical record; the reflection's HIGH lesson codifies the prevention |
