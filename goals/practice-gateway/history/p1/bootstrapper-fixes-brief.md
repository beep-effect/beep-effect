# Brief — practice-setup fixes from onboarding proof run 1 (2026-10-14)

Evidence: `history/p1/2026-10-14-onboarding-proof-run1.md`. App:
`apps/practice-setup` (bun-compiled Windows bootstrapper). Keep it dumb
(install, verify, hand off) but durable and honest.

1. **Hold the console on success.** After the last step, tell the lawyer what
   happens next (Claude is open in Chat; paste or Send the onboarding
   message) and wait for Enter before exiting. Failure path unchanged.
2. **Durable, probe-first steps.** Each step first probes its real state and
   is `skipped` when already satisfied; ask the lawyer only when the probe
   cannot tell:
   - `claude-desktop`: existing install probe (EXE or MSIX).
   - `claude-sign-in`: satisfied when `%APPDATA%\Claude\config.json` has a
     non-empty `lastKnownAccountUuid` key (read the key's presence only, never
     log values). While unsatisfied after opening Claude, poll (bounded, e.g.
     every 3 s up to 10 min) instead of waiting for Enter; Enter still works
     as a manual override.
   - `gateway-extension`: satisfied when
     `%APPDATA%\Claude\extensions-installations.json` lists
     `local.mcpb.beep-effect-contributors.beep-practice-gateway` with the
     embedded bundle's version; a different version means open the bundle
     again (update). Poll after opening the `.mcpb`, same bounds.
   - Both files are undocumented Claude internals: model them with schemas
     that tolerate unknown fields, treat decode failure as "cannot tell"
     (fall back to asking), and record the dependency in SPEC Decision Log.
3. **Hand-off that works.** Verify the `claude://claude.ai/new?q=` format
   against the Claude help article cited in
   `research/onboarding-distribution.md`; in run 1 the chat opened without
   the message. Always also put the onboarding message on the Windows
   clipboard (`Set-Clipboard` via PowerShell, or the clip.exe route) and tell
   the lawyer: "If the message is not already in the box, paste it (Ctrl+V)
   and press Send." Tell them to use the **Chat** tab.
4. **Prepare the lawyer for Claude's trust warning** before opening the
   `.mcpb`: one plain sentence that Claude will warn the extension can access
   the computer and that this is expected for this firm tool.
5. `last-run.json` keeps recording outcomes; reruns rely on probes, not on it.

Tests on Linux with fakes for every probe path (satisfied, unsatisfied then
satisfied by polling, undecodable file, version mismatch). package-verify
for `@beep/practice-setup`, cheap gates green. Commit; do not push.
Report the Windows build command.
