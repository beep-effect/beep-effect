# P2 pre-apply hardening and operator gate

Date: 2026-09-02

This receipt contains only sanitized operational facts. No tenant id, client
or matter name, principal, credential, or plan digest appears here. No Box
mutation occurred; no live dry-run ran.

## Branch state

PR #928 squash-merged on 2026-08-31 at exactly this branch's head, so all P0
and P1 work was already on `main`. The branch was re-synced by a merge commit
whose tree is byte-identical to `origin/main` (the pre-commit biome hook's
unrelated reformat of another packet's manifest was reverted before the
merge commit was finalized).

Post-sync verification attribution: `package-verify @beep/box` first failed
because this checkout's `@beep/schema` declarations predated the codec-statics
refactor that landed on `main` after PR #928; rebuilding that dependency
removed every `never` collapse. The next attempt hit the known locationless
native TS2589 flake and passed on an unchanged rerun, which auto-acknowledged
the armed P0 inbox row. Details in `research/OPPORTUNITIES.md` item 5.

## Operator gate (unchanged live state)

- The 1Password CLI could not reach the desktop app
  (`connecting to desktop app: connection reset`), so the private `op://`
  references could not be resolved and nothing live ran. The integration must
  be enabled and unlocked by the operator before the attended session.
- The private intent still carries its three placeholders (client folder
  name, matter folder name, attorney Box login). Enterprise and service
  subject ids were bootstrapped on 2026-08-31 and remain valid.

## Pre-apply review lanes

Per the routing doctrine, the token-heavy work was delegated:

- Codex (GPT-5.6 Sol, xhigh) ran a static adversarial review of the
  reconciler, driver errors, and private runner before the first apply.
  Verdict: **NOT SAFE** as merged, with one P0, seven P1, and three P2
  findings (`research/2026-09-02-preapply-review-codex.md`).
- Grok 4.6 (xhigh) verified the Box REST semantics the apply depends on
  against 26 official pages (`research/2026-09-02-box-api-semantics-grok.md`).
  Decisive facts: sibling folder names are unique case-insensitively; trailing
  spaces, slashes, and dot segments are rejected with `item_name_invalid`;
  a pending collaboration for an unregistered login still lists `login`
  and `invite_email`; a duplicate collaboration is HTTP 400
  `user_already_collaborator`; a folder-metadata 403 on root folder `0` is a
  root restriction, not a Governance signal; retention and template list
  endpoints document no 403, so entitlement blockers must come from declared
  entitlements.

## Hardening landed (two Codex Sol xhigh implementation lanes)

`@beep/box-provisioning`:

1. Explicit adoption allowlist (`adoptions` in the desired state): a live
   folder matching a desired sibling is `BlockedByPolicy` unless exactly one
   entry binds its logical key to that provider id and parent id. An empty or
   missing allowlist blocks every collision; the key defaults to empty on
   decode so the bootstrapped private intent still loads.
2. One Box-equivalent folder-name rule (case-insensitive after trailing
   whitespace trim) shared by intent validation, planner matching, and the
   applier's pre-create absence check; `BoxFolderName` rejects names Box
   rejects, with the Box references cited in JSDoc.
3. Blocker contract: apply refuses any plan whose blockers are not exactly
   the declared metadata and retention `BlockedByEntitlement` rows; the
   post-apply verdict requires that same multiset plus `Noop` elsewhere and
   is returned to the runner instead of recomputed loosely.
4. Sanitized apply journal (`BoxProvisioningApplyJournal` sink; `Started`,
   `Applied`, `Failed` entries with digests and provider ids only) so a
   mid-apply failure leaves a durable partial record.
5. Closed artifact domains: bounded opaque `sourceRevision`, a `LiteralKit`
   plan-name domain, bounded provider ids and revisions; schema-level
   sentinel tests prove plan and receipt codecs cannot carry a folder name,
   login, callback URL, or bearer-like token.
6. `declaredExternalCollaboratorCount` plus
   `declaredExternalCollaboratorCreateCount`, documented as intent-declared
   and not provider-verified.
7. Dependency revalidation: each dependent write re-reads its parent folder
   and compares the redacted identity digest before the POST.
8. `applyReviewedPlan` is the only root-barrel write entry point; the raw
   applier stays reachable to package tests through the subpath export.
9. Inventory honesty: no folder-metadata request on root `0`; list-surface
   403s classify as permission, never entitlement; entitlement blockers come
   from declared unavailability, and a contradicting nonempty live result
   stays a policy blocker.

`@beep/box`: `BoxError` retains only a closed conflict projection (count,
type, numeric id), a literal cause classification, and schema error class
identifiers; `toJSON` returns a schema-backed diagnostic. Negative tests
inject sentinels and assert they are absent from the encoded error,
`String(error)`, `JSON.stringify`, and a rendered cause.

Private runner (untracked): atomic umask-independent 0600 writes, exit code 2
on an unknown mode, apply journal path, and the strict verdict from item 3.

Deliberately not implemented: plan expiry timestamps (review P2-2). Placing a
timestamp inside the plan would break the SPEC's repeat-run identity
criterion; fresh re-inventory plus digest comparison already fails closed on
drift. A lane-authored test that spawned the untracked private runner was
removed because the file does not exist in CI; the lane's single-thread
vitest override, a sandbox workaround, was reverted.

## PR #947 review round

Codex Cloud review on the pushed head opened four threads (two P1, two P2);
Greptile scored the PR 5/5 with no threads, and all 31 hosted checks passed.
All four were fixed in a follow-up commit by a Codex Sol xhigh lane:

1. Dependency revalidation no longer compares the parent's etag (Box does not
   document whether child membership changes it), only provider id, parent id,
   and canonical name; an etag-only change between a parent's action and a
   dependent write no longer aborts the apply.
2. Ownership of folders created by the apply is returned as `adoptions` on the
   reviewed apply result and persisted by the private runner into the intent;
   a `recover-adoptions` runner mode rebuilds the allowlist from the journal
   after a mid-apply failure so the next dry-run plans `Noop`, not
   `BlockedByPolicy`.
3. Journal entries carry the reviewed plan digest and a per-attempt id;
   recovery uses the latest attempt for a plan.
4. `expectedEnterpriseId`, `expectedSubjectId`, and `rootFolderId` decode as
   `BoxProviderId`, so a malformed pinned id is a schema error at the public
   boundary rather than a later defect. The private intent still decodes.

## Verification

```text
bun run beep quality package-verify @beep/box
ok audit 11.6s; ok docgen 4.5s

bun run beep quality package-verify @beep/box-provisioning
ok audit 11.6s; ok docgen 3.8s

packages/drivers/box-provisioning: bun run lint && bun run check && bun run test
7 files passed, 44 tests passed (default fork pool)

packages/drivers/box: bun run lint && bun run check && bun run test
2 files passed, 27 tests passed
```

A private decode check of the operator's intent under the new schema printed
only `decode: ok (adoptions=0, folders=32)`.

## Attended session checklist (remaining P2)

1. Enable "Integrate with 1Password CLI" and unlock the desktop app; confirm
   with a foreground `op whoami`.
2. Replace the three placeholders in the private intent; run the private
   runner's `validate` mode.
3. Run `dry-run` under `op run` with the private env file. The runner
   inventories twice, refuses to write on any difference, and prints only
   counts, digests, and blocker kinds. Expect Create rows for the tree,
   one declared-external collaboration Create, two `BlockedByEntitlement`
   rows, and the 2026-07 staging drop reported foreign.
4. Review the private plan; record the sanitized summary and the repeat-run
   identity in `history/`.
5. Run `apply` with the opt-in flag and the reviewed digest. The runner
   re-inventories, journals every action, writes the receipt, and fails
   unless the post-apply verdict is all-`Noop` plus the two entitlement
   blockers. Record the sanitized receipt in `history/`.
