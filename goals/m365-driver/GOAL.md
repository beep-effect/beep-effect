# GOAL: ship the `@beep/m365` Microsoft Graph driver

Repo: `beep-effect` (this checkout).

Outcome: a native `@beep/m365` driver at `packages/drivers/m365` that
authenticates to Microsoft Graph `v1.0` with delegated auth-code+PKCE (MSAL) and
exposes typed, read-only, Schema-decoded verbs for OneDrive/SharePoint files and
Outlook mail/calendar — write-ready in shape, read-only in scope.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/m365-driver/README.md`
- `goals/m365-driver/SPEC.md`
- `goals/m365-driver/PLAN.md`
- `goals/m365-driver/ops/manifest.json`

Read those first, plus the graduated exploration
`explorations/microsoft-365-integration/{BRIEF.md,DECISIONS.md,MAP.md,RESEARCH.md}`,
then `AGENTS.md`, `CLAUDE.md`, and the standards `SPEC.md` names. Higher-priority
repo standards outrank packet prose when they conflict.

Scope:

- In: `packages/drivers/m365/**`; root `package.json` `catalog` (add
  `@azure/msal-node`, `@microsoft/microsoft-graph-types`,
  `@azure/msal-node-extensions`); a `M365` `@beep/identity` composer key.
- Out: write verbs/scopes; MCP exposure (`goals/m365-mcp`); Teams/Excel-content;
  Search API; ingest wiring/matter mapping/persistence; any other slice.

Reuse (do not reinvent): `@beep/hubspot` (raw HTTP via `effect/unstable/http`
`FetchHttpClient` + `HttpClientRequest` bearer + `effect/Schema` decode +
`LiteralKit` errors), `@beep/box` (config/service/errors split + `S.Redacted`),
`@beep/identity` composer keys.

Workflow:

1. Scaffold `@beep/m365` (`bun run create-package`); register catalog deps.
2. Implement config (MSAL tenantId/clientId/scopes/redirect; `S.Redacted`),
   `M365Error` tagged errors, and a `Context.Service` + Layer.
3. Add auth-code+PKCE acquisition + silent refresh; encrypt the token cache
   (`@azure/msal-node-extensions`).
4. Implement read verbs, each Schema-decoded: list drives/sites, delta, download
   `driveItem` content, read `listItem.fields` + `/versions`, list/get mail,
   list/get events. Request only `offline_access User.Read Files.Read.All
   Sites.Read.All Mail.Read Calendars.Read`.
5. Honor `Retry-After`; pin `v1.0`; detect+flag+skip encrypted items; spans log
   counts/sizes never content.
6. Tests: Schema decoders over recorded fixtures + a credential-gated live smoke
   test. At P3 Close, write `history/reflections/<date>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification passes, or unrelated failures are reproduced and
      recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/m365-driver/GOAL.md)" -le 4000
jq . goals/m365-driver/ops/manifest.json
git diff --check -- goals/m365-driver
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive state
beyond the In-scope list unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
