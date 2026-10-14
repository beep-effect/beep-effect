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
- Prove Windows Credential Manager access from the bun-compiled binary early.
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

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
