# GOAL: Ship the FreshBooks driver

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: `@beep/freshbooks` exists on the `@beep/hubspot` pattern — an
auth-code token helper with single-refresh-owner rotation, schema-decoded
clients/invoices/payments read verbs, and an invoice-PDF retrieval verb
whose existence was decided by a P0 endpoint-validation spike against the
existing dev app (fallback verdict recorded if unsupported).

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/freshbooks-driver/README.md`
- `goals/freshbooks-driver/SPEC.md`
- `goals/freshbooks-driver/PLAN.md`
- `goals/freshbooks-driver/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, the schema-first and
effect-first skills, and the source exploration's decision log
(`explorations/practice-office-provisioning/DECISIONS.md` — binding,
especially the FreshBooks driver goal entry). The pattern exemplar is
`packages/drivers/hubspot`.

Scope:

- In: a NET-NEW driver package scaffolded via `bun run beep create-package`;
  this packet's docs/evidence.
- Out: webhooks; write verbs; invoice delivery into Box (gated sibling
  candidate); billing-platform changes; production app registration.

Workflow:

1. P0 spike first: validate the invoice-PDF endpoint against the dev app;
   record live request limits and the webhook retry/disable schedule in
   `history/`. This decides whether the retrieval verb exists.
2. Schema → service contract → implementation. Model `account_id` and
   `business_id` as distinct namespaces.
3. The token helper serializes refresh: one refresh owner behind a lock,
   atomic persistence of the rotated token before release; prove it with a
   concurrent-refresh test.
4. Credentials come from the recorded 1Password references at runtime —
   `op://` refs stay references; raw values never appear in code, fixtures,
   or docs.
5. Fixtures carry no real client/invoice/payment data; live smoke is
   credential-gated and read-only.
6. Run `bun run beep quality package-verify` for the new package before
   handing back; expect the new-package first-CI governance gates
   (changeset, docgen, knip/fallow).
7. At P4 Close, write the reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (spike report; package
      surface with rotation proof; PDF verb fixture-proven or fallback
      recorded).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/freshbooks-driver/GOAL.md)" -le 4000
jq . goals/freshbooks-driver/ops/manifest.json
git diff --check -- goals/freshbooks-driver
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
