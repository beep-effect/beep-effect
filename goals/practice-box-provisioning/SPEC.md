# Practice Box Provisioning Spec

## Objective

Provision the practice's Box tenant as the document system of record, from
versioned code: expand `@beep/box` with the provisioning managers the
stay-on-Business posture needs, then ship an Effect-native desired-state
reconciler that decodes a versioned intent document, inventories the live
tenant, emits a schema-validated plan artifact (dry-run is the default mode),
and applies that exact plan idempotently — with the canonical client/matter
tree owned by a dedicated Box service identity and the attorney collaborated
at client-folder level.

## Non-Goals

- No SharePoint document store; Box is the sole document record (exploration
  no-go).
- No metadata-template or retention **mutations** on the current Business
  plan: those resource families surface as `BlockedByEntitlement` plan
  entries until a plan upgrade is ratified with real quote prices. Folder
  conventions carry the taxonomy until then.
- No Pulumi for the practice estate (ratified: Effect-native reconciler).
- No pruning or deleting of live tenant resources: v1 adopts only an
  explicit allowlist of existing resources and never deletes.
- No Box Sign requests as desired-state resources — Sign is an operational
  transaction owned by the gated `practice-sign-invoice-flow` candidate;
  this goal only lands the `signRequests`/`signTemplates` driver surface.
- No historical population: structure ships live-first; corpus-derived
  content lands after the salvage-restoration chain delivers.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (schema-first-development,
   effect-first-development).
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/box` — demand-manifest additions, regeneration, tests.
- A NET-NEW home for the reconciler program and its schemas — confirm the
  package topology with `bun run beep architecture` at P0 and scaffold via
  `bun run beep create-package` (never `mkdir`).
- The live Box tenant (operator-attended apply only).

## Constraints

- **Design order**: schema → `Context.Service` contract → implementation.
  Intent, observed-state, plan, and receipt documents are versioned schemas
  first (see r4 §Option A for the ratified shape: `Noop`/`Create`/`Update`/
  `Replace`/`Delete`/`Blocked` tagged actions with stable logical keys,
  preconditions, and destructive classification).
- **Driver expansion order** (r4): repair the Box SDK version provenance
  drift first; add discovery **reads** for every target family
  (collaborations, webhooks, sign requests/templates, plus metadata and
  retention reads for honest inventory) before any mutation path; regenerate
  through the canonical generator and remeasure against the package's
  type-instantiation budget (750K marginal per generated file, 3M absolute).
- **Dry-run is real**: it performs every read, decode, comparison, and
  artifact write, and no provider mutation. Apply consumes a previously
  emitted plan, rechecks preconditions (ids, etags, roles), and fails closed
  on drift.
- **Identity topology** (ratified): the service identity owns the canonical
  tree; the attorney collaborates at client-folder level; Benjamin retains
  admin. The CCG platform-app approval flow on the Business plan is a P0
  verification item — the service-identity design must not harden before it.
- **Entitlement honesty**: metadata/retention plan entries on Business are
  `BlockedByEntitlement`, never silent skips. The plan artifact reports the
  external-collaborator billing-impact count before apply (Business charges
  for external collaborators).
- **Confidentiality**: plan artifacts, receipts, fixtures, and logs never
  carry client/matter names into the tracked repo, and never carry tokens,
  webhook signing keys, or upload URLs anywhere. The repo is public.
- Live smoke tests are credential-gated with an explicit mutation opt-in and
  deterministic cleanup; nothing sends external invitations without the
  opt-in.

## Decision Log

Binding decisions live in the source exploration —
[`explorations/practice-office-provisioning/DECISIONS.md`](../../explorations/practice-office-provisioning/DECISIONS.md):
document system of record, Box plan posture, matter-tree ownership topology,
provisioning-as-code shape, reconciler shape ratified. This spec restates
none of them; it binds to them.

## Acceptance Criteria

- [ ] `@beep/box` exposes the target manager surfaces within the
      type-instantiation budget, with the SDK version provenance repaired
      and unit tests per the driver's existing pattern.
- [ ] The reconciler produces a schema-validated dry-run plan artifact
      against the live tenant from a starter-taxonomy intent document:
      foreign resources under the anchor root are reported, resources under
      other users' roots (the 2026-07 staging drop under the admin root) are
      out of the reconciler's scope and are reported from a read-only listing
      in the evidence, `BlockedByEntitlement` rows cover metadata/retention,
      zero mutations execute, and a second dry-run over an unchanged tenant
      yields an identical plan.
- [ ] An operator-attended apply provisions the starter tree under the
      service identity with attorney collaborations, and an immediate
      re-plan is all-`Noop`; the receipt is recorded in `history/`.
- [ ] `bun run beep quality package-verify @beep/box` (and the reconciler
      package's verify) pass.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-box-provisioning/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-box-provisioning/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-box-provisioning` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/box` | Passes |
| Dry-run proof | plan artifact + repeat-run identity recorded in `history/` | Recorded |

## Stop Conditions

- CCG platform-app approval is unavailable on the Business plan (report with
  evidence; the identity topology decision must be revisited, not worked
  around).
- The type-instantiation budget cannot absorb a required manager family
  (record which; fall back to narrow hand-written operations per r4).
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Closeout on a follow-up PR | `PLAN.md` P4 for this packet | operator | The final fix (#959) was merged before the closeout was written; the operator chose a follow-up PR (#960) over reverting. | One-time; no removal (packet closed). |
| Foreign report via admin-root listing | `SPEC.md` acceptance criterion 2 | operator | The tree is anchored at the service identity's root (ratified topology), so the staging drop under the admin root cannot appear in the plan; it is reported from a read-only admin-root listing in `history/2026-09-03-p2-live-apply.md`. | One-time; criterion amended on 2026-09-03. |
