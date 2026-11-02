# Opportunities

## 2026-11-02 — Cloud lane could not commit the PartyKey foundation

- Work: first commit of the `@beep/party-domain` PartyKey v1 foundation from a
  Claude cloud session.
- Evidence:
  - `create-package` printed `Next steps: 1. Run "bun install"`. A plain
    `bun install` ran root lifecycle scripts and installed lefthook hooks. The
    cloud bootstrap (`scripts/cloud/bootstrap.sh`) uses `--ignore-scripts`, so
    hooks are normally absent in the VM.
  - `git commit` then failed in pre-commit with `gitleaks: not found`
    (exit 127) and `typos: not found` (exit 127).
  - The permission classifier denied excluding those hook steps and denied
    fetching a `gitleaks` release binary.
  - Publication was held. The staged diff was exported as a recovery patch and
    scanned with Gitleaks outside the cloud lane (no leaks).
- Prevention: provision `gitleaks` and `typos` at CI's pins in the cloud
  bootstrap, or have `create-package` print `bun install --ignore-scripts`
  under a cloud marker.
- Disposition: cloud tool provisioning is owned by PR #2582; its qualification and review remain separate.
  Publication stays with the orchestrator; no hook was bypassed.

## 2026-11-02 — First-pass foundation needed a schema-first correction wave

- Work: review of the staged PartyKey v1 foundation.
- Evidence: the first pass had several schema-first and boundary gaps.
  - It used a native `switch`, an `as Readonly<Record<...>>` assertion, direct
    `_tag` checks and `kind: S.Literal(...)`.
  - Bases and identifier cases were plain `S.Struct` data. Value fields were
    plain `NonEmptyString`, so forged non-canonical values decoded.
  - `canonicalJson` had no decode boundary.
  - The last-`@` mailbox split accepted `a@@example.test` and text after a
    `>` wrapper.

  All passed lint, typecheck, docgen and 21 tests, so the gates did not flag
  these.
- Prevention:
  - check new domain code against the schema-first and effect-first fast rules
    before the first validation run;
  - add forged-value and malformed-mailbox regressions with every normalizer;
  - consider a lint for `as` assertions and `S.Struct` data in `*/domain/src`.
- Disposition: fixed in the same staged change (see
  `history/2026-11-02-party-domain-key-foundation.md`, "Correction wave").


## 2026-11-02 — Successful package wrapper with skipped audit


- **Step:** default `beep quality package-verify @beep/party-domain` in the
  cloud worker.
- **Evidence:** the worker reported that the wrapper exited successfully but
  printed `skip audit`; it ran no lint or unit tests in that invocation.
  The worker then ran separate focused lint, typecheck and test commands.
- **Impact:** an exit code alone could overstate the work verified. No time
  estimate is available.
- **Attribution:** the skipped audit is observed; its underlying cause has not
  been established here.
- **Workaround:** retain the skip and individual command results separately;
  do not label the audit as passing or infer repository-wide acceptance.
- **Prevention:** make skipped package stages and their reasons explicit in
  command summaries and task handoffs. Check the current command owner before
  admitting a repair; this receipt does not authorize a second implementation.
- **Owner/status:** cloud-readiness parent retains the evidence. The parent independently replayed the recovered package: default verification
  exited 0 with docgen passing and audit explicitly skipped. Separate lint,
  typecheck and 24 initial tests passed; after the review correction, 28 tests
  and separate lint/typecheck passed. These are scoped results, not an audit
  pass or a complete repository receipt.
