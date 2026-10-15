# @beep/practice-gateway

The practice gateway `.mcpb` (goals/practice-gateway): setup tools for a
lawyer's Windows workstation plus the providers the saved practice profile
selects, over one `effect/ai/McpServer` stdio server.

## Surface

- See `src/index.ts` barrel — do not hand-maintain inventory tables here.
- Tool contract: `goals/practice-gateway/history/p1/gateway-tools.md`.

## Laws

- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern this package; record only genuinely package-specific deltas here.
- No business logic beyond composition and probing: schemas live in
  `@beep/law-practice-domain`, the doctor in
  `@beep/law-practice-use-cases/PracticeSetup`, practice-kg resources in
  `@beep/law-practice-server/PracticeKgHost`.
- Every Windows fact goes through the `WindowsHost` service so probes stay
  testable on Linux with a fake host; never shell out from a probe directly.
- A requirement id needs a catalog entry (`Requirements.ts`) and a probe
  (`Probes.ts`); the mapped registry type makes a missing probe a compile error.
- Repairs run only through `SetupDoctor.repair` after `SetupApprovals`;
  approvals fail closed. No repair downloads installers until the installer
  route is decided.
- The saved profile and the data directory never hold secrets in clear.
- Providers (`PracticeKgProvider.ts`, `BoxDriveTools.ts`, `M365Provider.ts`)
  mount only when the saved profile selects them; a provider that cannot load
  logs why and mounts nothing, so the setup tools always answer. Import heavy
  or native provider code dynamically (practice-kg's DuckDB, `@beep/doc-text`).
- Microsoft 365 tokens live only in the DPAPI-protected MSAL cache
  (`<dataDir>/m365/token-cache.dpapi`); a browser sign-in starts only from the
  approved `m365-consented` repair, never from a tool call.
- Packaging: `bun run --cwd apps/practice-gateway package:mcpb:linux`
  (`:windows` downloads the pinned DuckDB win32 sidecar).
- Before handing back a change, run `bun run beep quality package-verify @beep/practice-gateway` from the repository root. Use `--quick` only for a justified lint+check subset; a failure arms the checkout's shared P0 inbox.
