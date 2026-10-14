# Brief

## Problem

The operator's own stack gives Claude real leverage over legal work: a
practice knowledge graph, Box, Microsoft 365, docketing, secrets, reusable
skills. Getting there took a dozen-plus MCP servers, a model proxy, a secret
manager with service accounts, language toolchains and dozens of permission
rules. A lawyer cannot rebuild that, even with tutorials, and every machine
adds its own hiccups (firm IT, Defender, proxies, reboots). Today the only way
a lawyer gets the capability is a person who knows the game setting it up by
hand, as happened for the first attorney (`practice-office-provisioning`).

Claude Code is already the right engine (D2). What is missing is the layer
that makes it safe and effortless for a lawyer: wrap its developer surfaces,
own its extension points, and make setup itself something agents do.

## Appetite

The first goal: about two weeks, ending in a recorded from-zero onboarding on
a clean Windows VM (D8) that installs Claude, the gateway and the attorney's
current providers (practice-kg, Box, Microsoft 365) with the doctor green.
Provider breadth (Clio, OneDrive, Dropbox, ...) comes after, one adapter per
goal, ordered by adoption (D5). If the two weeks run short, cut provider
coverage, never the doctor or the evidence.

## Solution Sketch

Three pieces, all inside Anthropic's own clients (D6):

```text
 bootstrapper.exe (signed later, D11)
   └─ installs Claude Desktop / Code + practice-gateway.mcpb
        └─ hands off to the onboarding agent inside Claude

 practice-gateway.mcpb  (one server, D10)
   ├─ providers      practice-kg · Box · M365 · secret store · (Clio, OneDrive, …)
   ├─ setup doctor   SetupRequirement graph · probes · remediations
   ├─ auth           OAuth per provider · tokens in Windows Credential Manager (D4)
   └─ policy         matter scoping · candidate review · audit · Box call ledger

 practice-claude-mod plugin  (sibling goal: plain-language rows, matter band)
   + onboarding skill: interview → practice profile → provision → verify
```

1. **Practice profile (schema first).** The onboarding interview produces a
   `PracticeProfile`: capabilities wanted (documents, mail/calendar, secrets,
   practice/billing, knowledge graph), the provider chosen per capability,
   IT limits (admin rights, proxy), and providers named that have no adapter
   (gaps, recorded as demand, D5/D9).
2. **Setup doctor.** The profile selects a graph of `SetupRequirement`s:

   ```text
   SetupRequirement
     id            "claude-installed" | "box-authorized" | "bitlocker-on" | ...
     capability    PracticeProfile capability it serves
     provider      adapter it belongs to
     dependsOn     SetupRequirement.id[]
     probe         Effect<Satisfied | Missing | Broken(reason)>
     remediation   Automatic | NeedsHuman(Consent | Password | AdminPrompt | Reboot | AccountCreation)
     explain       plain-language text for the lawyer
   ```

   Loop: probe all, order by dependencies, fix the automatic ones (approval
   before any mutation, per the stack-installer lessons), batch the human
   steps (D3) into as few interruptions as possible, re-probe. State persists
   so a reboot resumes setup. After onboarding the same doctor runs on demand
   and on failure ("Box needs you to sign in again").
3. **Gateway providers.** Each provider is a module that contributes tools,
   setup requirements and an auth flow. The gateway discloses only the tools
   relevant to the current task. practice-kg is the first provider, composed
   in process; Box and Microsoft 365 reuse the existing drivers.
4. **Harness the harness.** The gateway and plugin own the extension points
   the lawyer must never touch (settings, hooks, permissions, MCP config).
   The agent may propose changes to skills and preferences; it may never edit
   policy. The self-improvement loop from the Notion source is a later goal on
   top of this foundation.
5. **Evidence.** Every onboarding run emits a sanitized structured result,
   transcript, checksums and screencast per the stack-installer evidence
   contract. The VM run is the acceptance proof.

## Rabbit Holes

- **Claude Desktop vs Claude Code.** `.mcpb` installs in Claude Desktop;
  Claude Code takes MCP config and plugins differently. Pick the onboarding
  agent's host for the first slice and prove the gateway in both before
  calling it done.
- **Bootstrapping Claude itself.** The bootstrapper installs Claude before
  any agent exists. Keep it dumb: install, verify, open Claude with the
  onboarding prompt. All intelligence lives after the handoff.
- **Login inside onboarding.** The lawyer signs in to Claude; the agent cannot
  do it (D3). Make that the first human step and verify it before anything
  else.
- **No extension sandbox.** A `.mcpb` runs with full user privileges; policy
  is enforced in gateway code paths, not by the host.
- **Windows Credential Manager from a compiled binary.** No adapter exists
  (NOT FOUND); prove DPAPI/Credential Manager access from the bun-compiled
  gateway early.
- **OAuth on firm networks.** Loopback redirects can be blocked by proxies or
  policy; probe and fall back to device-code flows where providers offer them.
- **Box budget.** The gateway keeps its own call ledger (about 50K/month,
  no visible counter).
- **Unsigned in the VM.** SmartScreen warnings are expected there (D11) and
  must not be mistaken for onboarding failures in the evidence.
- **Duplicating the sibling.** Plain-language rows and the matter band belong
  to `practice-claude-mod`; this packet adds the onboarding skill and the
  gateway, not a second UI layer.

## No-Gos

- No own desktop UI or SDK-driven wrapper (D6) unless Q1 is reopened.
- No agent-created accounts or agent-typed credentials (D3).
- No developer dependencies on the lawyer's machine: no Node/Python/Rust
  toolchains, no CLIProxyAPI, no WSL or BIOS virtualization.
- No required password manager; Windows Credential Manager is the default
  (D4).
- No hosted infrastructure of ours in the onboarding path.
- No spend before the first real-machine install (D9, D11).
- No changes to the attorney's working machine until the VM proof passes
  (D8).
