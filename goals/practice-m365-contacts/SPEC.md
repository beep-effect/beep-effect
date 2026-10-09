# Practice M365 Contacts Spec

## Objective

Extend `@beep/m365` with an explicit two-lane token provider (the existing
delegated PKCE lane plus a NET-NEW confidential-client lane,
certificate-first) and schema-first contacts write verbs — contact
create/list plus contact-folder create/list — behind per-lane decoded scope
configs, then seed a dedicated contact folder in the
attorney's mailbox from the salvaged contact-export CSVs — dedup by
normalized email (fallback name+company), never overwriting hand-edited
contacts, every seeded contact tagged for rollback.

## Non-Goals

- No `driveItem` upload and no `Sites.Selected` — Box is the sole document
  store (ratified: M365 document lane dropped).
- No Graph mail-write lane (no MIME drafts, no message creation, no send):
  historical mail arrives exclusively via the Purview import
  (`goals/practice-mail-backfill`); no decision approves Graph message
  creation.
- No GAL/org-contact provisioning (exploration no-go).
- No PST or historical mailbox import through Graph.
- No exposure of the new write verbs through `@beep/m365-mcp` in this goal.
- No tenant app-registration automation — the Entra app registration and
  the Exchange RBAC-for-Applications assignment are operator-attended P0
  steps, recorded as evidence. No application-role admin consent is
  performed in this goal: the scoped RBAC assignment is the exclusive
  app-only grant, and the delegated lane keeps its existing PKCE scopes.

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

- `packages/drivers/m365` — auth lanes, config split, write-safe HTTP
  executor, contact schemas/verbs, error-taxonomy extension, tests.
- The seeding job's home (an application/script boundary confirmed at P0 —
  it is not driver code).
- The live tenant: one Entra confidential-client app registration with
  RBAC-for-Applications scoping (operator-attended), and the attorney's
  mailbox contact folder.

## Constraints

- **Auth lanes** (r4 §auth, with the certificate correction): model the
  app-only credential schema-first as a tagged union with the
  certificate/assertion path primary and any client-secret variant an
  explicitly limited dev/test fallback. App-only requests exactly Graph
  `/.default`; it never accepts delegated scopes, redirect URIs, or user
  token caches. The delegated PKCE constructor stays compatible.
- **Scope configs**: replace the four-entry write-scope blacklist with
  separate decoded delegated and app-only lane configs — a blacklist cannot
  prove read-only behavior.
- **RBAC for Applications** (r7 correction; r3 §5): mailbox access is
  granted exclusively through the Exchange RBAC-for-Applications role
  assignment (`Application Contacts.ReadWrite` on the Exchange service
  principal, management scope limited to the attorney's mailbox), verified
  with `Test-ServicePrincipalAuthorization`. Never admin-consent the
  unscoped tenant-wide `Contacts.ReadWrite` Entra application role beside
  it — Entra and Application RBAC permissions are additive, so the unscoped
  grant would restore organization-wide access and defeat the mailbox
  scope. `ApplicationAccessPolicy` is legacy and must not appear in new
  code or runbooks.
- **Write-safe HTTP**: contact POSTs are non-idempotent and must never be
  blind-replayed; an ambiguous transport failure after a write fails as an
  ambiguous-write error forcing caller reconciliation. App-only calls can
  never use `/me` routes.
- **Dedicated-folder provisioning**: folder-targeted contact creates
  require an existing `contactFolders/{folderId}` (r3 §3.1), so the driver
  surface includes contact-folder create/list beside contact create/list,
  and the seeding job discovers-or-creates the dedicated folder by name
  idempotently — recording its id in the run evidence — before any contact
  write.
- **Seeding semantics** (ratified contacts-import decision): dedup key =
  normalized email, fallback name+company; existing hand-edited contacts are
  never overwritten; seeded contacts carry a tag/marker enabling clean
  rollback; source CSVs are the salvaged contact exports (2026-07 copies
  already staged in Box) — their machine-local paths and contents stay out
  of the tracked repo.
- **Fixtures**: no real mailbox addresses, contact data, tenant ids, or
  tokens in checked-in fixtures; follow the driver's existing fake-HTTP
  capture pattern; live smoke stays credential-gated with a separate
  mutation opt-in and deterministic cleanup of uniquely marked contacts.

## Decision Log

### Private package release-policy alignment (2026-10-09)

The pre-publication merge of PR #1566 introduces a changeset graph guard that
rejects notes naming live private workspaces. All three edited packages are
private. Preserve the proposed major driver migration, identity registration
patch and private application addition in the goal's
`history/2026-10-09-private-package-migration.md` receipt; remove the queued
private-package changeset. This follows the release policy now on main while
retaining the removed export's migration instructions. Reversal: restore the
note to the release queue only after the publication policy admits the packages
or the private-note guard is reverted.

Binding decisions live in the source exploration —
[`explorations/practice-office-provisioning/DECISIONS.md`](../../explorations/practice-office-provisioning/DECISIONS.md):
auth lanes for egress, M365 document lane dropped, contacts import shape.
This spec binds to them without restating.

### Lane decisions (2026-10-09)

- **(a) Consume #1456.** The app-only certificate/secret union, Graph `/.default`,
  injected auth seam and write-safe executor already landed. Reversal: none.
- **(b) Job home.** `apps/practice-m365-contacts`, package
  `@beep/practice-m365-contacts`, mirrors the existing practice jobs. Reversal:
  remove it with `bun run beep delete-package`.
- **(c) Delete contact.** Add `deleteContact` for the self-cleaning smoke and
  rollback. Reversal: remove the verb.
- **(d) Delegated fixtures.** Prove both lanes' request shapes with injected
  tokens; add no delegated write scope. Reversal: none.
- **(e) Grant route A (R2).** Reuse `beep-agent-outbox`'s certificate registration.
  After PR 1 merges, the orchestrator grants `Application Contacts.ReadWrite`
  through assignment `beep-practice-contacts-readwrite` on the new attorney-only
  scope `beep-practice-contacts-mailbox`. `requiredResourceAccess` stays empty;
  no Entra permission or consent is added. Nothing changes on another mailbox.
  This avoids a new registration and new vault fields. Route B, a dedicated
  registration requiring human vault writes, was rejected. The reused credential
  already has mail and calendar capabilities on the shared scope; this job calls
  contact verbs only and its smoke uses its own opt-in. Reversal, landed before
  the grant: runbook §4 removes the contacts assignment then its scope, preserving
  the three outbox assignments and `beep-docket-intake-mailbox`.
- **(f) Rollback marker (R3c).** Every create carries fixed category
  `beep-practice-contacts-seed` and extended property `beepSeedRun` with its run id.
  This permits full reversal without a journal. Reversal: `undo --by-category --yes`
  as documented in runbook §3; live reversal requires a later orchestrator ruling.
- **(g) CSV-only seeding (R4).** The binding contacts-import decision names CSVs.
  VCF is census-only and is rejected by apply and online dry-run. Reversal: none;
  a later packet can authorize VCF population.

- **Contacts smoke opt-in.** `M365_LIVE_CONTACTS_WRITE=1` gates contact-only
  create/delete, and the test-name filter excludes message reads. The older
  `M365_LIVE_WRITE` also writes calendar events. Reversal: fold the opt-ins
  together in a later authorized packet.
- **Normalizer identity.** Reuse `normaliseContacts` unchanged: it merges
  transitively by non-role email and name/company and has phone/postal fallbacks
  for nameless cards. The seed planner matches personal emails first, then
  name/company only when no personal email exists; nameless cards without
  personal email are unidentifiable. Shared role inboxes must not collapse
  unrelated people. Reversal: replace the planner identity rule after a new
  contacts-import decision; do not duplicate the shared normalizer.
- **Compatible injected doubles.** `M365.of` supplies explicit failing contact
  capabilities to older implementations that omit them. Live layers supply
  all verbs. This preserves excluded consumers' existing test doubles without
  editing those packages. Reversal: remove compatibility after consumers migrate.
- **Folder-aware deletes.** Include optional folder routing in `deleteContact`
  and add `deleteContactFolder` for empty journal-owned rollback folders, per the
  Graph contact deletion contract. Reversal: remove the folder-delete verb.

- The contact smoke's injected configuration sets `maxRetries` to zero.
  Reason: its authorized budget is exactly one contact POST and one DELETE,
  including on throttling or transport failure. Reversal: restore the default
  only in a future smoke with an explicitly broader request budget.
- Repeat planning also recognizes a seed receipt by source identity and contact id.
  Reason: a hand edit to name or email must not cause a duplicate seeded contact.
  Reversal: remove receipt matching if a future normalizer changes source identity.
- Child folder inventory records its traversal parent when Graph omits that field.
  Reason: rollback may delete a created folder only when it has no children.
  Reversal: remove the synthesized relationship only after Graph provides a stable
  equivalent relationship in every page response.

- **Rollback evidence.** Report missing original receipts or current change keys
  as `unverifiable`, separately from confirmed edits. Without a journal the
  job cannot prove whether a tagged contact changed. Per-run undo preserves
  unverifiable contacts; category undo remains the explicit full reversal.
  Reversal: remove the separate counter after a reliable independent baseline
  exists for every tagged contact.

- **Smoke clock.** Read wall-clock milliseconds with `TestClock.withLive` for
  the smoke marker. Test effects otherwise receive a virtual clock, so a marker
  could repeat between sessions. Reversal: remove the override only if the
  live test runner always supplies the wall clock.

## Acceptance Criteria

- [x] Either auth lane injects into the unchanged REST service boundary in
      tests, and no configuration shape can mix PKCE scopes with app-only
      credentials.
- [x] Contact and contact-folder create/list verbs are fixture-proven for
      both lanes (method, URL, content type, body, decoded response,
      non-retry behavior).
- [ ] The seeding job dry-runs against the CSVs (report: creates, dedup
      skips, conflicts) before any write; the executed run
      discovers-or-creates the dedicated folder and seeds it with tagged
      contacts and a recorded rollback path.
- [x] `bun run beep quality package-verify @beep/m365` passes.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-m365-contacts/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-m365-contacts/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-m365-contacts` | Passes |
| Package handoff | `bun run beep quality package-verify @beep/m365` | Passes |
| Seeding proof | dry-run report + seeded-run receipt in `history/` | Recorded |

## Stop Conditions

- RBAC-for-Applications scoping cannot be established for the app
  registration (report; do not fall back to tenant-wide application roles).
- Required source files are missing or materially contradictory.
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
