# @beep/oip-web

Next.js 16 canary app for the OIP public law-firm site, wired to the shared
`@beep/ui` shadcn/Tailwind setup.

## Development

```bash
# Named portless URL
bun run --cwd apps/oip-web dev

# Diagnostic-only portless bypass (from this directory)
PORTLESS=0 bun run dev

# Turbopack production build
bun run build

# Webpack PWA build
bun run build:pwa
```

## Dev URL

`bun run --cwd apps/oip-web dev` serves the app at
`http://oip-web.beep.localhost:1355`.

## React Grab

React Grab loads during development. Start with
`bun run --cwd apps/oip-web dev`, hover an element, then press `Cmd+C` on macOS
or `Ctrl+C` on Linux/Windows to copy source context for refinement work. Use
`NEXT_PUBLIC_REACT_GRAB=0 bun run --cwd apps/oip-web dev` when you need the dev
overlay disabled for quiet browser QA.

## Launch Goal

The launch packet lives at `../../goals/oip-web-launch`.

V1 is a single-page, build-ready public site. Public claims, client marks,
selected matters, contact details, and disclaimers remain review-gated before
publishing.

## Infrastructure

`alchemy.run.ts` is the `OipWeb` Alchemy stack (goals/infra-alchemy-rebuild, P4). It
replaces the Pulumi project `opip-web` and owns the configuration around the site: the
Vercel project's settings, its environment variables and domains, the Cloudflare DNS
records that point the domains at Vercel, and an S3 assets bucket. Builds and
deployments stay with `.github/workflows/vercel-deploy.yml`. Operating notes, the deploy
path and the cutover procedure: [Alchemy infrastructure](../../docs/runbooks/alchemy-infra.md#oipweb-oiplaw).

### Design

Order: schema, then typed configuration, then resources.

1. **Schema** (`stack/OipWebConfig.ts`): literal domains for hostnames, zones, record
   types, redirect codes, live project names and reserved bucket names; `OipDomain` and
   `OipWebStackConfig` carry the cross-field rules (redirect pairs, apex `A` versus
   subdomain `CNAME`, a personal stage never naming a live object).
2. **Configuration**: `liveStageConfig.prod` and `liveStageConfig.staging` restate the
   Pulumi stacks and the live census; a personal stage gets a stage-named project and
   bucket, no domains and no secret. `configForStage` decodes either.
3. **Resources** (`stack/OipWebStack.ts`): `Vercel.Project`, three `Vercel.EnvVar`s,
   a `Vercel.Domain` plus a `Cloudflare.DNS.Record` per hostname, and an `AWS.S3.Bucket`.
   `stack/PlanGuard.ts` is the workflow's pre-deploy check.

### Greenfield or adopt, per object

| Object | Recommendation | Why |
| --- | --- | --- |
| Vercel project | adopt in place | see below |
| Environment variables | adopt with the project | they belong to the project id |
| Domains | adopt (D20) | a domain is on one project at a time; with the project adopted no move is needed |
| DNS records | adopt (D20) | records are name-unique and carry no owner marker; only the comment changes |
| Assets bucket | new bucket, `oip-law-web-assets-<stage>` | both Pulumi buckets hold no object and have no reader |

**The Vercel project.** Two honest options.

- *New project beside the live one, domains moved at cutover* (D12's default).
  Downtime risk: a domain move flips traffic to the new project's current production
  deployment, so a READY production build must exist there first, and a failed move
  leaves a hostname on neither project until it is retried. Preview URLs: new
  `*.vercel.app` hostnames. History: deployments, logs and analytics stay on the old
  project. Git: the new project needs its own GitHub link (created with the project).
  Deploy path: `vercel-deploy.yml` names project ids in its `VERCEL_APPS` env, so the
  cutover must edit that file (the two `projectId` values on the `oip-web` and
  `oip-web-staging` rows), and it runs pull-request jobs. Rollback: move the domains
  back. Cost: none on the Hobby team (projects are not billed).
- *Adopt the live project in place.* Downtime risk: none planned; adoption writes
  settings identical to what the project already has (the census matched every field).
  Preview URLs, deployment history and the git link stay as they are; the project is
  already linked to `beep-effect/beep-effect`, which `Vercel.Project` requires. Deploy
  path: project ids are unchanged, so `vercel-deploy.yml` is not edited. Rollback: forget
  the state rows; nothing to move back. Cost: it is a per-object exception to D12, and
  `RemovalPolicy.protect()` must hold, because destroying the adopted stage would delete
  the live project.

Recommendation: adopt in place. It is the only option that leaves `vercel-deploy.yml`
untouched and carries no traffic flip. The stack is built that way; the cutover waits for
the orchestrating session's ruling.

**The assets bucket.** Adoption needs no copy and no reader switch; a new bucket needs
neither either, because both buckets are empty (0 objects, 0 versions, 0 delete markers on
2026-11-14) and nothing in the repo reads or writes them. So the default from D12 applies
at no cost: new pinned names, S3 bills storage only, and the Pulumi buckets are deleted
empty after their resources are unprotected. Adoption stays a one-line change
(`assetsBucketName: "assets.oip.law"`; the S3 provider adopts silently by name).

### Stages and secrets

`prod` and `staging` map to the Pulumi stacks `production` and `staging`, deploy only
from CI and protect every project, domain, record and bucket. Names are pinned in the
configuration, never derived from a state-held instance id.

| Variable | Today | Under the stack |
| --- | --- | --- |
| `NEXT_DISABLE_PWA` | literal `0` in `infra/src/OipWeb.ts` | literal in `OipWebStack.ts` |
| `CRM_HUBSPOT_ACCOUNT_ID` | plain Pulumi config (`246203876`) | literal in `OipWebConfig.ts` |
| `CRM_HUBSPOT_SERVICE_KEY` | Pulumi `secure:` value (the 1Password passphrase no longer decrypts it) and Vercel `sensitive` | `valueFrom: { config: "CRM_HUBSPOT_SERVICE_KEY" }`: `op run` on a workstation, the `CRM_HUBSPOT_SERVICE_KEY_<STAGE>` environment secret in CI; state keeps the key name and a SHA-256 |

### Tests

`bun run test` includes `test/stack/`: the resource graph of both live stages and a
personal stage against in-memory Vercel, Cloudflare and AWS fakes seeded with the live
census, adoption of every live object, protection against replacement and destroy, no
secret in state, the CI guard, configuration decoding and rejection, and the plan
guard's accept and refuse cases.
