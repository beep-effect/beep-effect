# @beep/practice-setup

Windows bootstrapper: installs Claude Desktop and the practice gateway, then opens Claude to start onboarding.

`practice-setup.exe` is unsigned until `practice-gateway-signed-release` (D11), so
SmartScreen warns on first run. It stays dumb: install, open, wait, hand off.

| Step | What it does | Lawyer does |
| --- | --- | --- |
| `claude-desktop` | Skips when Claude Desktop is installed (per-user or MSIX); otherwise downloads the pinned per-user installer, checks its SHA-256, runs it with `--silent`, and waits for the install. | nothing |
| `claude-sign-in` | Skips when Claude's `config.json` has a `lastKnownAccountUuid`; otherwise opens `claude://claude.ai/new` and re-checks every 3 s for up to 10 min. | signs in (Enter overrides the watch) |
| `gateway-extension` | Skips when Claude's `extensions-installations.json` lists the gateway at the embedded bundle's version; otherwise warns about Claude's trust prompt, copies the bundle to `%LOCALAPPDATA%\beep\practice-setup`, opens it, and re-checks the same way. | clicks Install or Update (Enter overrides) |
| `onboarding-handoff` | Copies the onboarding message to the clipboard and opens a new chat with it prefilled. | uses the Chat tab, pastes if the box is empty, presses Send, then Enter to close the console |

Claude's two state files are undocumented internals: when either cannot be read or
decoded, the step asks the lawyer to press Enter instead. Reruns rely on these probes,
not on the last report.

Each run writes `%LOCALAPPDATA%\beep\practice-setup\last-run.json` (a `SetupReport`).
The pinned installer comes from the `Anthropic.Claude` winget manifest; the sources are
in `goals/practice-gateway/research/onboarding-distribution.md`.

## Build

```bash
bun run --cwd apps/practice-gateway package:mcpb:windows
bun run --cwd apps/practice-setup package:windows --bundle ../practice-gateway/dist/mcpb/practice-gateway-windows-x64.mcpb
```

The second command reads the bundle's `manifest.json` version (needs `unzip`) and writes
`apps/practice-setup/dist/practice-setup.exe` with the bundle and its version embedded. Without an embedded bundle, the executable looks for `practice-gateway.mcpb`
beside itself.

## Development

```bash
bun run check
bun run test
bun run lint
```

This workspace is a runtime app, not a public TypeScript package. Keep app internals behind `@/*`; promote reusable contracts and domain code to slice or shared packages.

## License

MIT
