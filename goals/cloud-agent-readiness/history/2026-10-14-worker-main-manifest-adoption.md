# Worker main manifest adoption — 2026-10-14

The operator selected deployment of the main-owned model manifest after the
[post-main audit](2026-10-14-post-main-headless-parity.md). On beep-worker's
readiness checkout at `6e664812d5eae8fde57076f0f55e1d2ec19b6414`, ran the
canonical `bun run beep models init --adopt`, followed by the ordinary
`bun run beep models check --report-dir` with a finite 90-second timeout.
The SSH workload explicitly removed `SSH_AUTH_SOCK`.

Adoption succeeds and the ordinary check exits **zero**, reporting **zero
findings across 360 catalog models**. The router-for-me, Codex cache, Grok
cache, Cursor Agent and proxy-v1-models overlays answer. This closes the
installed-manifest schema compatibility gap: the current main seed spells
the opt-in role `muse.opt-in`.

Verified the installed manifest is byte-identical to the isolated main seed
used in the preceding audit. Its SHA-256 is
`cb1b05476db9cc4ff280d40d57bd2041899b24c01791d995ed265b4ff3f9a16b`.
The CLI preserves the old manifest at
`~/.config/beep/models.yaml.bak-20261014T151048922Z-155d30`; its SHA-256 is
`2ad15578833e8d60a93f897879c4374e64334a5881a4be9cc7977ac90492bf63`,
matching the pre-adoption audit hash. The older backup remains present.

The catalog diff reports zero additions, zero removals and one changed effort
ladder. That observation is distinct from the zero routing-policy findings.
Older routable Codex models are emitted only as candidates; none was adopted
or used as a substitute. The effort-ladder change was not investigated in this
bounded deployment step.

Private reports remain under
`~/.cache/beep/readiness/post-main/adopted-model-check/`, with command output
at `adopted-model-check.txt` in the parent directory. No raw credentials were
read or emitted. No repository model seeds, generated policy tables, runtime
pins, service configuration or authentication state were edited. Existing
processes were not restarted; this does not prove their launch-time defaults
have changed. The older root main CLI was not requalified.

Fresh other-provider inference, the unauthenticated Box MCP startup connection,
reboot recovery, heavy/full proof and fleet acceptance remain open. This step
does not rerun the previously green serial cheap-gate tier.
