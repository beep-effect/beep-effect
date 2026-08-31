# P0 preflight: identity, commercial posture, package home, and SDK provenance

Date: 2026-08-30

This receipt contains only sanitized operational facts. It intentionally omits
tenant ids, app ids, client ids, developer emails, billing contacts, payment
details, and credentials.

## CCG platform-app approval verdict

**Pass.** A read-only inspection of the live Business tenant's Admin Console
showed one Client Credentials Grant Platform App. The app is both **Authorized**
and **Enabled**. Its detail view reports all-user access and the scopes required
for the current provisioning design, including read/write file and folder
access, webhook management, enterprise administration, user administration,
and user access-token generation.

This proves that the Business tenant can authorize a CCG service identity and
that the ratified service-owned tree topology does not need a plan-based
workaround. No app setting, authorization, enablement, or credential changed
during the inspection.

Box's current setup guide independently documents the same approval flow: CCG
is a Platform App authentication type and an Admin or Co-Admin must authorize
the app before use.

- <https://developer.box.com/guides/authentication/client-credentials/client-credentials-setup>
- <https://developer.box.com/guides/authorization>

## Decision-ready Box quote table

The live tenant's Account & Billing and self-service upgrade pages were used
for tenant-specific prices. No order was placed. Recurring totals use Box's
three-seat minimum and annual billing.

| Posture | Price per user/month | Minimum recurring cost | External collaborators | Governance / metadata consequence |
| --- | ---: | ---: | --- | --- |
| Current Business | $15 | $45/month; $540/year | Each external collaborator requires a paid seat | No custom metadata. The live checkout rejects Governance on Business. |
| Business Plus | $25 | $75/month; $900/year | Unlimited external collaborators | Custom metadata is available; Governance remains a paid add-on. |
| Business Plus + Governance | $35 | $105/month; $1,260/year | Unlimited external collaborators | Includes the $10/user/month Governance add-on for retention and legal holds. |
| Enterprise | $35 | $105/month; $1,260/year | Unlimited external collaborators | Governance remains a paid add-on. |
| Enterprise Plus | $50 | $150/month; $1,800/year | Unlimited external collaborators | Box documents Governance as included. |
| Box Shield | Sales quote required | UNKNOWN | N/A | Not exposed as a self-service add-on for the current posture. |

The live Governance checkout is decisive for this tenant: it states that
Governance is compatible only with Business Plus and Enterprise and would
replace the current Business subscription with Business Plus. Its itemization
was $25/user/month for Business Plus plus $10/user/month for Governance. The
public plan matrix also states that Business external collaborators require
paid accounts while Business Plus and above include unlimited external
collaborators.

- <https://www.box.com/pricing/business>
- <https://support.box.com/hc/en-us/articles/360043695374-I-Have-More-Users-Than-Seats-Error>
- <https://support.box.com/hc/en-us/articles/360043694374-About-Retention-and-Retention-Policies>

Decision consequence: remain on Business as ratified. Metadata and retention
must stay visible as `BlockedByEntitlement` plan actions. A collaborator is a
billing-impacting action on Business, so every plan reports the count before
apply. Business Plus becomes economically favorable over buying Business seats
for external collaborators once the required paid-seat delta reaches the plan
upgrade delta; the plan artifact reports facts and does not make that purchase
decision.

## Reconciler package home

Selected home: `packages/drivers/box-provisioning`, publishing
`@beep/box-provisioning`.

Evidence:

1. `bun run beep architecture plan --slice law-practice --concept
   BoxProvisioning --domain-kind aggregates --stage full` showed that a
   product-language implementation belongs across the `law-practice`
   domain/use-cases/server roles, not in a single ad-hoc slice package.
2. This reconciler can remain a single package only by staying a
   product-neutral Box technical boundary: generic folder, collaboration,
   webhook, Sign, metadata, retention, observation, plan, and receipt
   contracts. Practice names and principals are runtime intent data and never
   package vocabulary or checked-in fixtures.
3. The architecture standard explicitly allows an acyclic driver-to-driver
   dependency when the boundary remains product-neutral. The package will
   depend on `@beep/box` and must not import a product slice.
4. `bun run beep create-package box-provisioning --family drivers
   --description "Schema-first desired-state reconciliation for Box tenant
   resources" --dry-run` resolved the canonical package name and directory
   without writing files.

The real scaffold must use the same `bun run beep create-package` path. If
practice-specific behavior becomes necessary, it belongs in the
`law-practice` slice's use-case/server roles rather than being added to this
driver.

## Box SDK provenance

The authoritative installed and locked SDK is `box-node-sdk@10.14.0`:

- the root catalog requests `^10.14.0`;
- `bun.lock` resolves `10.14.0`;
- the installed package manifest reports `10.14.0`.

The trace constant and its unit assertions were updated from `10.11.1` to
`10.14.0`. The canonical generator must run against this locked install before
the demand manifest grows; the resulting generated diff and type-budget
measurements are recorded with the driver expansion evidence.

## Credential-path note

The 1Password MCP server was unavailable in this session. A sanitized
`op whoami` check showed that the CLI was not signed in, so no vault inspection
or secret injection was attempted and no authentication loop was repeated.
Live API work remains gated on 1Password-backed environment injection; raw
credentials must not be copied out of Box or stored in the repository.
