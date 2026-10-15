# Brief — gateway units A (2026-10-14)

Lane `feat/practice-gateway`, draft PR #1771. Contract: `SPEC.md`,
`history/p1/gateway-tools.md`. All in `apps/practice-gateway` unless noted.

## A1 Lazy practice-kg provider
The gateway loads DuckDB at startup even when the profile does not select
practice-kg (`history/p1/2026-10-14-gateway-selfcheck-vm.md`). Load the
practice-kg provider (and its DuckDB/PGlite resources) only when the saved
profile selects `knowledge-graph`/`practice-kg`, so a missing or broken
sidecar disables only that provider; setup tools and other providers keep
working. Test: gateway starts and `setup_status` works with the DuckDB
module unavailable.

## A2 Box Drive file tools
Provider tools over the local Box Drive folder (`%USERPROFILE%\Box`, from
`WindowsHost.folders`): `box_list { path? }` and `box_read { path }`,
read-only, confined to the Box root (reject `..`, absolute paths, symlink
escapes), size-capped text extraction for common types (txt, md; for PDF/DOCX
reuse existing repo drivers if one exists — search `packages/drivers` for
pdf/doc text — else return metadata only). Mounted only when the profile
selects documents=box-drive. Schemas first; tests with the fake host.

## A3 Microsoft 365 sign-in
- Implement the host `M365InteractiveAuthorizer`
  (`packages/drivers/m365/src/M365.auth.ts:410-434`) in the gateway: a
  loopback HTTP listener on `127.0.0.1:<ephemeral>` (Effect HTTP server, never
  `node:http`), open the system browser to the authorization URL, capture the
  code, PKCE as the driver already does.
- MSAL token cache persisted as a DPAPI-protected file at
  `<dataDir>/m365/token-cache.dpapi` (the path the existing probes check) via
  `@beep/windows-secrets` `protect`/`unprotect`; memory/plain fallback only
  in tests.
- Requirement `m365-consented` gets an automatic remediation "Open the
  Microsoft sign-in page" that runs the authorizer after approval (the
  lawyer then consents in the browser).
- Client id: read from gateway config (`M365_CLIENT_ID` env / `user_config`
  field `m365_client_id` in the manifest), tenant `organizations`. No app
  registration exists yet (operator's entity registers a multi-tenant public
  client later); make the requirement report a plain "not configured" result
  when the client id is absent rather than failing.
- Mount `M365McpRegistrationsLive` read tools when consented.

## Done when
Each unit has tests on Linux; `package-verify @beep/practice-gateway` and any
touched package pass; `bun run beep quality github-checks cheap-gates
--collect-all` passes; linux `.mcpb` builds and `--self-check` runs. Commit per
unit. Do not push.
