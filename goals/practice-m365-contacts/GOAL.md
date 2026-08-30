# GOAL: Two-lane M365 auth and contact seeding

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `@beep/m365` carries a confidential-client auth lane
(certificate-first) beside PKCE with per-lane decoded scope configs and
fixture-proven contact write verbs, and the attorney's mailbox holds a
dedicated contact folder seeded from the salvaged contact CSVs with
normalized-email dedup, rollback tags, and no overwritten hand edits.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/practice-m365-contacts/README.md`
- `goals/practice-m365-contacts/SPEC.md`
- `goals/practice-m365-contacts/PLAN.md`
- `goals/practice-m365-contacts/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, the schema-first and
effect-first skills, and the source exploration's decision log
(`explorations/practice-office-provisioning/DECISIONS.md` — binding). The
richest implementation reference is
`explorations/practice-office-provisioning/research/r4-provisioning-code-shape.md`
(M365 attachment-point table, auth-lane steps with the certificate-first
correction, HTTP/retry and error-taxonomy sections).

Scope:

- In: `packages/drivers/m365` (auth, config, HTTP executor, schemas, verbs,
  errors, tests); the seeding job at the home P0 confirms; this packet's
  docs/evidence; operator-attended Entra registration + RBAC-for-Applications
  scoping.
- Out: driveItem upload, `Sites.Selected`, any Graph mail write (drafts,
  MIME, send), GAL/org contacts, MCP exposure, app-registration automation.

Workflow:

1. P0: operator-attended app registration (certificate credential). Mailbox
   access comes exclusively through the Exchange RBAC-for-Applications
   assignment scoped to the attorney's mailbox — never admin-consent the
   unscoped tenant-wide `Contacts.ReadWrite` Entra application role beside
   it (Entra + Application RBAC grants are additive); prove the scope with
   `Test-ServicePrincipalAuthorization`. Census the CSV headers/counts only
   — contact content never enters the repo.
2. Schema → service contract → implementation. Config split first: no shape
   may mix PKCE scopes with app-only credentials; app-only uses exactly
   Graph `/.default` and never `/me` routes.
3. Replace the write-scope blacklist with per-lane decoded configs.
4. Contact POSTs are non-idempotent: never blind-replay; ambiguous transport
   failures surface as ambiguous-write errors.
5. Seeding job dry-runs first (creates / dedup skips / conflicts report),
   then discovers-or-creates the dedicated contact folder idempotently and
   seeds it with rollback tags.
6. Run `bun run beep quality package-verify @beep/m365` before handing back.
7. At P4 Close, write the reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (lane injection proof,
      fixture-proven verbs, dry-run + executed seeding with rollback path).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/practice-m365-contacts/GOAL.md)" -le 4000
jq . goals/practice-m365-contacts/ops/manifest.json
git diff --check -- goals/practice-m365-contacts
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Never write to
the mailbox outside the operator-authorized seeding run and the
self-cleaning live smoke.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
