# Practice M365 Contacts Spec

## Objective

Extend `@beep/m365` with an explicit two-lane token provider (the existing
delegated PKCE lane plus a NET-NEW confidential-client lane,
certificate-first) and schema-first contacts write verbs behind per-lane
decoded scope configs, then seed a dedicated contact folder in the
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
  admin consent are operator-attended P0 steps, recorded as evidence.

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
- **RBAC for Applications** (r7 correction): scope app-only
  `Contacts.ReadWrite` to the attorney's mailbox via RBAC for Applications;
  `ApplicationAccessPolicy` is legacy and must not appear in new code or
  runbooks.
- **Write-safe HTTP**: contact POSTs are non-idempotent and must never be
  blind-replayed; an ambiguous transport failure after a write fails as an
  ambiguous-write error forcing caller reconciliation. App-only calls can
  never use `/me` routes.
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

Binding decisions live in the source exploration —
[`explorations/practice-office-provisioning/DECISIONS.md`](../../explorations/practice-office-provisioning/DECISIONS.md):
auth lanes for egress, M365 document lane dropped, contacts import shape.
This spec binds to them without restating.

## Acceptance Criteria

- [ ] Either auth lane injects into the unchanged REST service boundary in
      tests, and no configuration shape can mix PKCE scopes with app-only
      credentials.
- [ ] Contact create/list verbs are fixture-proven for both lanes (method,
      URL, content type, body, decoded response, non-retry behavior).
- [ ] The seeding job dry-runs against the CSVs (report: creates, dedup
      skips, conflicts) before any write; the executed run seeds the
      dedicated folder with tagged contacts and a recorded rollback path.
- [ ] `bun run beep quality package-verify @beep/m365` passes.
- [ ] No unrelated refactors or formatting churn.

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
