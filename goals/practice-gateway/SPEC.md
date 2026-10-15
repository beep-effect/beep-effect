# Practice Gateway Spec

## Objective

Give a lawyer on a Windows workstation the practice capabilities of the
developer stack without any developer setup: one gateway `.mcpb` (providers,
setup doctor, auth, policy), an onboarding skill that interviews the practice
into a `PracticeProfile` and drives setup, and an unsigned bootstrapper that
installs Claude and the gateway. Proved by a recorded from-zero onboarding on
a clean Windows VM with practice-kg, Box and Microsoft 365.

Shaped in [`../../explorations/harness-the-harness/BRIEF.md`](../../explorations/harness-the-harness/BRIEF.md); decisions in
[`../../explorations/harness-the-harness/DECISIONS.md`](../../explorations/harness-the-harness/DECISIONS.md); decomposition in
[`../../explorations/harness-the-harness/MAP.md`](../../explorations/harness-the-harness/MAP.md).

## Non-Goals

- No own desktop UI or SDK-driven wrapper of Claude Code (D6).
- No agent-created accounts or agent-typed credentials (D3).
- No developer dependencies on the lawyer's machine: no Node/Python/Rust
  toolchains, no CLIProxyAPI, no WSL or BIOS virtualization.
- No required password manager; Windows Credential Manager is the default (D4).
- No hosted infrastructure of ours in the onboarding path.
- No spend: code signing waits for `practice-gateway-signed-release` (D11).
- No changes to the attorney's working machine until the VM proof passes (D8).
- No providers beyond practice-kg, Box and Microsoft 365 (later goal
  `practice-gateway-providers`); no self-improvement loop (later goal
  `practice-harness-improvement-loop`).
- No plain-language rows or matter band: those belong to `practice-claude-mod`.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- New gateway app (create with `bun run beep create-package`), its `.mcpb`
  packaging and Windows binary, following `apps/practice-kg-mcp`'s
  distribution.
- Provider modules composing `packages/law-practice/server` (practice-kg),
  `packages/drivers/box` and `packages/drivers/m365`.
- New schemas: `PracticeProfile`, `SetupRequirement`, probe and remediation
  results (schema-first, domain package placement per `bun run beep
  architecture`).
- An onboarding skill shipped in a Claude Code plugin (with or beside
  `practice-claude-mod`, without touching its surfaces).
- A minimal Windows bootstrapper (unsigned) and a clean-VM proof harness.
- This packet's docs and evidence under `history/`.

## Constraints

- Human steps only: Claude sign-in, provider consent, password/MFA, UAC,
  reboot, account creation where needed (D3). Claude sign-in is the first and
  is verified before anything else.
- Approval before any mutation; narrow, real repairs; evidence as an
  artifact contract (stack-installer lessons).
- No extension sandbox exists: policy is enforced in gateway code paths.
- Windows Credential Manager works only in the user's interactive logon
  session (proved 2026-10-14: an SSH key logon gets Win32 error 1312). The
  gateway runs under Claude Desktop in that session; VM proofs touching
  credentials use `ops/vm/vm-run.sh interactive`.
- OAuth loopback may be blocked on firm networks; device-code fallback where
  the provider offers it.
- The gateway keeps a Box call ledger (about 50K calls/month, no visible
  counter).
- Prove the gateway in both Claude Desktop and Claude Code.
- Keep the bootstrapper dumb: install, verify, open Claude; all intelligence
  after the handoff.
- Unsigned SmartScreen warnings in the VM are expected, not failures.
- Effect v4, schema first, `Context.Service` contracts before implementation.

## Acceptance Criteria

- [ ] `PracticeProfile` and `SetupRequirement` schemas exist with tests.
- [ ] The gateway `.mcpb` installs in Claude Desktop and registers in Claude
      Code on Windows, serving practice-kg, Box and Microsoft 365 tools.
- [ ] The doctor probes, orders, auto-repairs (with approval) and batches
      human steps; state survives a reboot.
- [ ] Tokens live in Windows Credential Manager; none in files or logs.
- [ ] On a clean Windows VM, bootstrapper → Claude sign-in → onboarding
      interview → doctor green, with consent screens and UAC as the only
      human steps; recorded evidence in `history/` (structured result,
      transcript, checksums, screencast).
- [ ] A second run from the same VM snapshot reaches green without new
      hiccups.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/practice-gateway/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/practice-gateway/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/practice-gateway` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Wrap Claude Code via extensions, no own UI (D6) | Reuses shipped `.mcpb` path; avoids SDK login terms | Reopen exploration Q1 with the wall recorded |
| 2026-10-14 | Signed bootstrapper, unsigned until a real install (D7, D11) | No spend before value | Signing goal opens earlier |
| 2026-10-14 | Prove on a clean Windows VM first (D8) | Repeatable; Windows never proved | Prove on the attorney's PC instead |
| 2026-10-14 | New gateway composing practice-kg as a provider (D10) | Keeps the evaluated KG surface decoupled | Fold provider modules into practice-kg-mcp |
| 2026-10-14 | Credential Manager default store; no agent credentials (D3, D4) | OAuth tokens fit the OS store; credential entry is brittle and unsafe | New decision in the exploration |
| 2026-10-14 | Box via Box Drive in slice 1; Box API user auth deferred (P0) | Box OAuth exchange needs a client secret; none may ship in a desktop binary | Add a Box OAuth provider once a secret-free path is proven |
| 2026-10-14 | Credential Manager for small secrets, DPAPI-protected files for blobs, via `bun:ffi` (P0) | Credential blobs cap at 2,560 bytes; the MSAL cache is larger | Adopt `@azure/msal-node-extensions` if it bundles cleanly |
| 2026-10-14 | Move practice-kg resource layers from the app into a package (P0) | Gateway and practice-kg-mcp must mount the same toolkit | Keep a copy in the gateway instead |
| 2026-10-14 | Setup requirements take `SetupCapability` (adds `workstation`) and `SetupProvider` (adds `claude`, `windows`); `HumanStep` adds `install` and `configure` | The slice 1 catalog has Claude, BitLocker and bundle-folder requirements the profile literals could not express | Drop the added literals once no requirement uses them |
| 2026-10-14 | `claude-signed-in` is satisfied while an MCP client calls the gateway | Claude stores no stable sign-in marker; a tool call proves a signed-in session | Probe a Claude-owned marker if one is found in the VM |
| 2026-10-14 | Box Drive install repair fails with a plain `SetupRepairFailed` until the installer route is decided | No installer download in slice 1 | Implement the repair once the route (bootstrapper, winget, MSI) is chosen |
| 2026-10-14 | The practice-kg provider and its self-check probe import `@beep/law-practice-server` dynamically (`loadPracticeKgModules`); a failed import is `ProviderUnavailable` and the probe reports `broken` | The gateway loaded DuckDB at startup even without practice-kg selected, so a missing sidecar killed the setup tools (VM self-check 2026-10-14) | Return to static imports in `PracticeKgProvider.ts` and `Probes.ts` |
| 2026-10-14 | Box Drive tools `box_list`/`box_read` read `%USERPROFILE%\Box` directly; paths are checked lexically (`BoxRelativePath`: no drive, leading separator or `..`) and again after symlinks (`resolvePathWithinRoot`); listings drop entries that resolve outside Box; reads cap at 20 MiB in and 60,000 characters out; PDF/DOCX text comes from `@beep/doc-text`, imported on first use, other formats return metadata only | Read-only access confined to the folder the lawyer chose; reuses the repo's JS-native extractor, which works inside the compiled binary | Narrow `BoxDriveTools.ts` to txt/md or swap the extractor; caps are constants there |
| 2026-10-14 | `m365-consented` gets an automatic remediation that only opens the Microsoft sign-in page (after approval); the lawyer still signs in and consents in the browser | Keeps consent a human step (D3) while the gateway owns the redirect capture | Return the catalog entry to `human("consent", ...)` and drop the repair in `Probes.ts` |
| 2026-10-14 | Loopback listener on `127.0.0.1:<ephemeral>` (Bun HTTP server via `effect/http`), redirect URI `http://127.0.0.1:<port>`; the app registration must list `http://127.0.0.1` (port ignored for loopback) | Microsoft recommends the IP literal over `localhost` for desktop loopback; avoids IPv6 `localhost` resolution misses | Build the redirect from `http://localhost` in `openLoopbackSignIn` |
| 2026-10-14 | `@beep/m365` takes a host-owned token cache (`M365DelegatedAuthOptions.tokenCache`, load/save of the serialized MSAL cache); the gateway stores it as a DPAPI-protected file at `<dataDir>/m365/token-cache.dpapi` | The MSAL cache exceeds Credential Manager's blob cap, and `@azure/msal-node-extensions` is not bundled | Pass `tokenCachePath` with the extensions package instead |
| 2026-10-14 | The sign-in repair waits 45 s, then answers that the sign-in page is still open; the attempt keeps listening (up to 10 min) in the gateway's scope and a second request rejoins it | MCP clients time tool calls out at about a minute; a lawyer may take longer to sign in | Wait for the attempt inside the tool call (`M365_SIGN_IN_WAIT`) |
| 2026-10-14 | Client id comes from `M365_CLIENT_ID` (`user_config.m365_client_id`), tenant `organizations`; without it `m365-consented` reports "not configured" | No app registration exists yet; the requirement must explain rather than fail | Hard-code a client id once the multi-tenant public client is registered |
| 2026-10-14 | Microsoft 365 tools mount only when the profile selects `microsoft-365` and a sign-in is saved; tool calls never open a browser (an expired sign-in fails and setup_status leads back to the repair) | Keeps every browser sign-in behind the lawyer's approval | Mount whenever configured and let tool calls start the loopback flow |
| 2026-10-14 | The gateway executable sets `Logger.LogToStderr` for both the stdio server and `--self-check` | A provider that logged why it did not mount wrote to stdout and corrupted the MCP stream (found by the stdio smoke of the linux bundle) | Remove the `StderrLogger` layer in `bin.ts` |
| 2026-10-14 | `setup_onboarding_guide` and the `onboard_practice` prompt serve the onboarding guide from an injectable `OnboardingGuide` service; until the onboarding skill merges, a built-in guide is served and the manifest's `prompts` carries it | The skill lands on a separate branch; the orchestrator wires its `SKILL.md` text import at merge time without touching tool code | Serve only the skill text and drop `BUILT_IN_ONBOARDING_GUIDE` |
| 2026-10-14 | `@beep/mcpb-kit` writes `prompts: [{ name, description, text }]` only when an app declares prompts | MCPB manifests allow a `prompts` array; other apps' manifests stay byte-identical | Remove `McpbManifestFields.prompts` |
| 2026-10-14 | `claude-desktop-installed` also accepts the MSIX package family `Claude_pzs8sxrjxfjjc` (`Get-AppxPackage -Name Claude` via `WindowsHost.appxPackageFamilies`) | Admin and MDM installs deploy the MSIX package, which the per-user executable and uninstall-key checks miss | Drop the Appx check in `Probes.ts` |
| 2026-10-14 | `SetupStatus.repairable` lists requirement ids that are probed, unsatisfied, automatically remediable and whose dependencies are satisfied; the summary's approvable repairs use the same rule | The onboarding skill needs a machine-readable list of what `setup_repair` can do now | Remove the field and inline the summary filter |
| 2026-10-14 | The onboarding skill is one `SKILL.md` in `apps/practice-gateway/plugin/` (a Claude Code plugin), and the gateway serves the same text through a read-only tool and an MCP prompt | Desktop chat sees only what the installed `.mcpb` provides: a plugin needs a separate upload and its local servers do not run in chat; tools are the one surface the model always sees ([research](research/onboarding-distribution.md) §1) | Drop the tool and prompt and require the plugin upload |
| 2026-10-14 | The skill names the gateway's setup tools but tells Claude never to name them to the lawyer; the interview is fixed to the five `PracticeCapability` areas plus two IT questions | Lawyer-facing voice ruling (10-09); the profile schema admits nothing else | Extend the table when `PracticeCapability` grows |
| 2026-10-14 | The bootstrapper is a bun-compiled Effect app (`apps/practice-setup`) embedding the gateway `.mcpb`, not a PowerShell script | A `.ps1` cannot be double-clicked under the default execution policy; one `.exe` is one download (D7) and its steps test against fakes | Ship a `.ps1` beside the `.mcpb` instead |
| 2026-10-14 | Claude Desktop installs from the per-user EXE pinned by URL and SHA-256 from the `Anthropic.Claude` winget manifest, run with `--silent` | Needs no admin prompt (the MSIX needs one for its Cowork service); the hash refuses a tampered download; Claude updates itself afterwards ([research](research/onboarding-distribution.md) §2) | Use `winget install Anthropic.Claude` or the documented MSIX redirect |
| 2026-10-14 | The `.mcpb` is installed by opening it with the shell after sign-in; the lawyer clicks Install in Claude's own dialog and confirms in the console | Every documented install path shows that dialog; writing Claude's internal extension state is undocumented and MSIX-virtualized (§3) | Adopt a silent install path if Anthropic documents one |
| 2026-10-14 | The hand-off opens `claude://claude.ai/new?q=` with a fixed first message the lawyer sends | Documented Desktop deep link; prefilled text is never auto-sent (§4) | Open Claude without a message and rely on the gateway's instructions |
| 2026-10-14 | Bootstrapper sign-in and gateway install are confirmed by the lawyer pressing Enter, not detected | No documented sign-in or installed-extension marker; the onboarding skill's first step re-checks the gateway tools | Detect both once markers are found in the VM |
| 2026-10-14 | Superseding the Enter-only row above: bootstrapper steps probe first and are skipped when satisfied. Sign-in reads only the presence of a non-empty `lastKnownAccountUuid` in Claude's `config.json`; the gateway step reads `extensions-installations.json` → `extensions["local.mcpb.beep-effect-contributors.beep-practice-gateway"].version`. Files are read from `%APPDATA%\Claude`, or the MSIX package's `LocalCache\Roaming\Claude`; a missing file means "not yet", an unreadable or undecodable one means "cannot tell" and the lawyer is asked | Run 1 showed both markers (history/p1/2026-10-14-onboarding-proof-run1.md), and reruns repeated every step. Both files are **undocumented Claude Desktop internals**: the schemas ignore unknown fields and never log values, so a format change degrades to asking, not to a wrong answer | Drop `ClaudeState` and return both steps to `Lawyer.waitFor` |
| 2026-10-14 | After opening Claude or the `.mcpb`, the bootstrapper re-probes every 3 s for up to 10 min (`ClaudeStatePollSchedule`) while Enter stays a manual override; a timed-out watch asks the lawyer | The lawyer should not have to come back to the console when Claude already shows the result; Enter covers probes that never turn green | Replace the watch with `Lawyer.waitFor` |
| 2026-10-14 | The build reads `version` from the bundle's `manifest.json` (`unzip -p`) and stamps it into the generated entry (`EmbeddedGateway`); a listed gateway at another version is `outdated` and the bundle is opened again as an update. A plain run without the stamp accepts any listed version | The bootstrapper cannot unzip on Windows without a dependency; mcpb-kit already needs `unzip`. The extension id is Claude's own derivation from author and name, recorded as observed | Pass the version as a build flag, or drop the version check |
| 2026-10-14 | `claude://claude.ai/new?q=` checked against support article 14729294 on 2026-10-14: format unchanged. Links now open through PowerShell `Start-Process` (ShellExecute, the article's `start "" "<link>"` route) instead of `explorer.exe`, the first message is always also put on the clipboard (`Set-Clipboard`, text passed by environment variable), and the console tells the lawyer to use the Chat tab and paste (Ctrl+V) if the box is empty | Run 1 opened Claude without the prefilled text and on the Code tab; the cause is unconfirmed, so the hand-off no longer depends on the prefill. The next VM run checks whether `Start-Process` lands it | Return `openLink` to `explorer.exe`; drop the clipboard copy |
| 2026-10-14 | The console tells the lawyer to expect Claude's "access to everything on your computer / not verified by Anthropic" warning before the `.mcpb` opens, and holds after a successful hand-off until Enter | Run 1: the warning was unannounced and the console closed before the last instruction could be read | Remove the line and the hold; signing the extension retires the warning |
| 2026-10-15 | Amending the dynamic-import row above: the lazy import now sits behind the `PracticeKgModuleLoader` service (`load: Effect<PracticeKgModules, ProviderUnavailable>`). `PracticeKgModuleLoader.layer` does the dynamic import; `fromImport` maps a rejected import to `ProviderUnavailable`. `GatewayServicesLayer` provides it to the self-check probe and the provider. `LazyPracticeKg.test.ts` provides a loader whose import rejects instead of `vi.mock("@beep/duckdb")` | Operator ruling S31: no new standards inventory rows. The `vi.mock` needed two effect-vitest exceptions (EV011, EV012); an injectable service removes both and keeps the proof that the gateway starts and `setup_status` reports the missing engine. The test no longer proves that the gateway's static import graph never evaluates DuckDB | Restore `loadPracticeKgModules` as a plain Effect and the `vi.mock` test, with its two inventory rows |
| 2026-10-15 | `PracticeKgHost.test.ts` runs bundle loading and the self-check refusals on the in-memory file system only | S31: the native Bun file-system arm needed an EV010 exception. `apps/practice-kg-mcp/test/Host.test.ts` already covers reading a real bundle from disk | Re-add the native arm with its inventory row |
| 2026-10-15 | Superseding the watch row above for the gateway step only: the step ends `done` only when Claude's registry lists the bundled version. Enter during the watch triggers an immediate re-check, and a check that still sees the old or missing gateway tells the lawyer and keeps watching. After the 10-minute watch times out, the step fails with the drag-onto-Settings → Extensions instruction and the file path, so the run stops before the hand-off. An unreadable registry (`unknown`) still asks the lawyer. Sign-in keeps Enter as an override | Proof run 3: with 0.1.0 installed, the 0.1.1 run reached the hand-off while `extensions-installations.json` still listed 0.1.0. In `installGateway`, `watchUntil` returned `false` both on Enter and after the timeout prompt, and `false` became `StepDone` ("the lawyer confirmed the install") without re-reading the registry | Return the gateway step to `watchUntil` with the lawyer-confirmed `StepDone` |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
