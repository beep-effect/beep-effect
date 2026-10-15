# Brief — `apps/practice-gateway` (slice 1 skeleton)

Contract: `goals/practice-gateway/SPEC.md`, tool design
`history/p1/gateway-tools.md`. Bricks already on the branch:

- Schemas: `@beep/law-practice-domain` `PracticeProfile`, `SetupRequirement`,
  `SetupReport`, `ProbeResult`, `Remediation`.
- Doctor: `@beep/law-practice-use-cases/PracticeSetup` (`SetupDoctor.layer`,
  ports `SetupProbes`, `SetupApprovals`).
- practice-kg: `PracticeKgToolkitLayer` (`@beep/law-practice-server`) +
  `@beep/law-practice-server/PracticeKgHost` (`makePracticeKgHostResourcesLayer`,
  `loadPracticeKgBundleContext`, `runPracticeKgSelfCheck`).
- Secrets: `@beep/windows-secrets` (`WindowsSecretStore.layerWindows` /
  `layerMemory`).
- Packaging reference: `apps/practice-kg-mcp/src/package.ts` (copy the
  pattern: manifest, bun compile targets, DuckDB sidecars, archive check).

## Scope of this unit

1. Create the app with `bun run beep create-package` (match how
   `apps/practice-kg-mcp` was created: inspect its package.json / AGENTS.md
   for type and kind; never `mkdir`).
2. Setup tools on `effect/ai/McpServer` (`layerStdio`), composed with
   `@beep/mcp-kit`: `setup_profile_get`, `setup_profile_save`,
   `setup_status`, `setup_repair` exactly as in `gateway-tools.md`.
   - Profile persisted as JSON via schema codecs under the gateway data dir
     (`%LOCALAPPDATA%\beep\practice-gateway\` on Windows, an XDG equivalent
     elsewhere), never containing secrets.
   - `SetupApprovals` implemented with `McpServer.elicit` (yes/no schema;
     declined, cancelled or unsupported client → `declined`).
3. Requirement catalog as data: a pure function `requirementsFor(profile)`
   returning the slice 1 `SetupRequirement`s from `gateway-tools.md`.
4. `SetupProbes` registry: one probe (and repair where automatic) per
   requirement id behind a platform service:
   - Windows probes as small, testable Effect functions over an injectable
     `WindowsHost` service (file existence under `%ProgramFiles%` /
     `%USERPROFILE%`, registry reads via `reg.exe query`, BitLocker via
     `manage-bde -status C:` or `Get-BitLockerVolume`, process checks), so
     tests run on Linux with a fake host. Use `effect/process`
     or the repo's process abstraction — check what the repo uses; never
     raw `child_process` if an Effect wrapper exists.
   - `box-drive-installed` automatic repair: download-free placeholder that
     returns `SetupRepairFailed` with a plain reason until the installer
     route is decided (record this in the PR notes); do not fetch installers.
   - practice-kg probes call `runPracticeKgSelfCheck`.
   - M365 requirements probe for a cached token file only; the interactive
     authorizer is a later unit.
5. Mount practice-kg tools in process when the profile selects the
   `knowledge-graph` capability and a bundle dir is configured
   (`user_config` in the manifest, like practice-kg-mcp).
6. `.mcpb` packaging script producing win32-x64 and linux-x64 bundles, with
   `--self-check` that prints the doctor report as JSON.

## Out of scope for this unit

M365 interactive authorizer, Box Drive file tools, bootstrapper, onboarding
skill, signing. Leave clear TODO-free seams (service interfaces), not stubs
that pretend to work.

## Rules

AGENTS.md laws; Effect v4 only (validate against node_modules/effect/dist
d.ts); schema-first; `Context.Service` contracts before implementation;
`Effect.fn`/`Effect.fnUntraced`; HashMap/HashSet not Map/Set; JSDoc rubric;
`@beep/*` aliases in tests; heavy commands via `beep-heavy`.

## Done when

`bun run beep quality package-verify` passes for the new app (if it is a
workspace package with that gate) and its tests pass on Linux with fake host
and memory secret store; the linux-x64 `.mcpb` builds and its `--self-check`
prints a report. Report the windows-x64 build command for the orchestrator to
run in the proof VM.
