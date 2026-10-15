# Evidence — onboarding proof, run 1 (2026-10-14)

Clean VM (`snapshot.sh revert clean`), `practice-setup.exe` from lane head
`b03748a8ce` (gateway windows-x64 bundle embedded), run by the operator in
the VM's interactive session. Screenshots every 15 s under
`~/VMs/practice-gateway/shots/onboarding-proof-20261014-1915/` (not in repo).

## What worked

- Claude Desktop per-user silent install (`Claude-Setup-2.9939.4.exe`,
  pinned hash) completed and Claude opened, with no admin prompt.
- Opening the `.mcpb` after sign-in showed Claude's own install dialog for
  "Beep Practice Gateway"; after Install it is listed **Enabled** with
  Configure available. Claude records it in
  `%APPDATA%\Claude\extensions-installations.json` under
  `local.mcpb.beep-effect-contributors.beep-practice-gateway` (version, hash).

## Findings

1. **Console closes on success (bug).** `runSetup` holds the console only on
   failure; on success the process exits right after the hand-off, so the
   lawyer never reads the last instruction. `last-run.json` shows all four
   steps `done`, `complete: true`.
2. **Not durable (flow gap).** Sign-in and extension install are confirmed
   by the lawyer pressing Enter, and a rerun ignores `last-run.json`, so the
   operator had to repeat every step. Durable signals exist: the extension
   registry above, and `lastKnownAccountUuid` in `%APPDATA%\Claude\config.json`
   once signed in (key names inspected only). Both are undocumented Claude
   internals: probe them read-only, fall back to asking when absent.
3. **Prefilled chat did not land.** The `claude://claude.ai/new?q=…` hand-off
   opened Claude but no prefilled onboarding message was visible in the
   following frames. Needs a direct test of the link format; fallback is to
   put the message on the clipboard and tell the lawyer to paste and Send.
4. **Trust warning.** Claude's dialog says installing "will grant this
   extension access to everything on your computer… not verified by
   Anthropic". The console should tell the lawyer to expect it; signing the
   extension is the longer-term fix.
5. **Sign-in on a fresh machine needs the lawyer's own auth.** The operator's
   passkeys live in 1Password on the host; they installed 1Password in the
   VM and signed in by QR + TOTP. Email magic links require reading the email
   on the same machine. The onboarding guide should say so up front.
6. **Claude Desktop opened on the Code tab** (an existing account with Code
   history). The hand-off must make sure the lawyer is in Chat.
