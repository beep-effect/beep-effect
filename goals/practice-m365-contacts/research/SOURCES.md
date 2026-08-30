# Practice M365 Contacts — Sources & Provenance

- **Source exploration:** `explorations/practice-office-provisioning` —
  primary ledger:
  [`explorations/practice-office-provisioning/research/SOURCES.md`](../../../explorations/practice-office-provisioning/research/SOURCES.md)
  (per-lane URL registry in
  [`SOURCES-lane-citations.md`](../../../explorations/practice-office-provisioning/research/SOURCES-lane-citations.md)).
  This file reproduces the implementation-relevant slice; the exploration's
  ledger stays canonical.
- **Provenance:** R3/R4 Sol xhigh lanes + the r7 Sol Pro gap report + live
  tenant probes, all 2026-08-30.

## 1. Mined source corpus

No upstream code is mined or ported.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `@azure/msal-node` (installed dependency) | MIT | use as a dependency | `ConfidentialClientApplication` + `acquireTokenByClientCredential` behind the driver's injected token-provider contract |

## 3. External research sources

Carried by the exploration lane reports (each with its own Sources section on
disk):

- [`r3-graph-write-surface.md`](../../../explorations/practice-office-provisioning/research/r3-graph-write-surface.md)
  — contact create permissions/routes, throttling + `Retry-After`,
  app-registration and admin-consent flow.
- [`r4-provisioning-code-shape.md`](../../../explorations/practice-office-provisioning/research/r4-provisioning-code-shape.md)
  — M365 attachment-point table with `file:line` evidence, auth-lane steps
  (with the 2026-08-30 certificate-first correction), write-safe HTTP and
  error-taxonomy design, test strategy, Graph/MSAL primary URLs.
- [`r7-sol-pro-gap-report.md`](../../../explorations/practice-office-provisioning/research/r7-sol-pro-gap-report.md)
  — RBAC for Applications supersedes `ApplicationAccessPolicy`.

## 4. In-repo capability references

| Brick | Path | Mark |
|-------|------|------|
| Injected token-provider contract (`M365AuthShape`, static test layer) | `packages/drivers/m365/src/M365.auth.ts` | extend (add the confidential-client constructor + lane discriminator) |
| Injectable service layer seam | `packages/drivers/m365/src/M365.service.ts` | extend (write verbs on `M365Shape`/`makeService`; write-safe executor) |
| Config schemas + write-scope blacklist | `packages/drivers/m365/src/M365.config.ts` | replace (per-lane decoded configs) |
| Sanitized error taxonomy | `packages/drivers/m365/src/M365.errors.ts` | extend (ambiguous-write, permission-denied, conflict reasons) |
| Graph response schemas | `packages/drivers/m365/src/M365.schemas.ts` | extend (contact models) |
| Fake-HTTP fixture/capture test pattern + credential-gated live smoke | `packages/drivers/m365/test/` | reuse |
| Schema-first substrate (`LiteralKit`, tagged unions, `S.Redacted`) | `packages/foundation/modeling/schema` (`@beep/schema`) | reuse |
| Seeding job home | confirmed at P0 (application/script boundary, not driver code) | NET-NEW |

## 5. Cross-links & provenance

- Exploration: [`explorations/practice-office-provisioning`](../../../explorations/practice-office-provisioning/README.md)
  — `DECISIONS.md` (binding: auth lanes, document lane dropped, contacts
  import shape), `BRIEF.md` (sketch point 2), `MAP.md`.
- Sibling goals: [`goals/practice-box-provisioning`](../../practice-box-provisioning/README.md)
  (the reconciler whose tagging convention the seeding job shares),
  [`goals/practice-mail-backfill`](../../practice-mail-backfill/README.md)
  (the only approved historical-mail lane).
- Related packet: `goals/m365-driver` (the original read-only surface this
  goal extends).
