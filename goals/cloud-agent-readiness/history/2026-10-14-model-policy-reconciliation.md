# Model-policy reconciliation — 2026-10-14

The October 14 operator policy replaces the older bundled seed. Codex remains
GPT-6.1-Sol medium, including its separate planning-effort setting. Claude
orchestrators use Fable 5.1 medium; children retain explicit Opus 5.5. Cursor
fallback uses its medium id. Research and JSDoc title migration use Grok 4.7;
lightweight proxy work uses GPT-6 Luna. Review panels are separate, explicitly
assigned sessions; Astra is no longer globally retired. Muse Wonder 1.0 is
opt-in. Junie default/volume roles are modeled outside fallback chains.

## Source and ownership

A concurrent model-routing refresh updated the shared home manifest while this
readiness task was running. Preserved that newer manifest. Reviewed and adopted
only its Models schema, seed and validation service into this branch, from
`beep-effect7-worktrees/model-routing-refresh` on
`chore/model-routing-refresh-10-14` (base eba3362efa). Its Accounts/Junie usage
poller and unrelated changes remain with their owner. This is a reviewed source
snapshot, not a claim that the concurrent branch has committed or merged.

Generated repo tables use Models.render against the live manifest; they are not
handwritten copies. Historical model probes and provenance remain unchanged.
Updated executable JSDoc defaults and forward-looking CLI examples separately.
The initial shared-manifest adoption has a private timestamped backup; subsequent
projection was repo-only to preserve the concurrent owner's home edits.

## Verification so far

- Local `beep models check`: zero findings across 359 catalog models.
- Five focused Models suites: 48 tests pass, including the current operator
  contract and task-assigned panel separation.
- `quality package-verify @beep/repo-cli --quick`: lint and type check pass.
  Quick mode covers this bounded schema/seed/service/config reconciliation;
  full audit/docgen and headless model inference are not claimed.
- Worker Codex top-level model, reasoning effort and planning effort now read
  GPT-6.1-Sol/medium/medium. Native Claude settings read Fable/medium; Grok and
  Muse proxy wrapper pins are corrected. Private file backups are retained.

The worker's root checkout remains main because desktop/agent processes are
active. A matching source-version qualification follows in an isolated checkout;
new roles cannot be decoded by the older root CLI. No service restart or model
inference is required merely to verify configuration.

## Worker source-version qualification

Code commit `0ae4401fc9` was transferred by a bounded Git bundle into
`~/YeeBois/projects/beep-effect-worktrees/linux-agent-readiness`, on
`feat/linux-agent-readiness`. The shallow worker clone initially lacked the
bundle prerequisite; fetched only that required base commit before retrying.
Installed this checkout's frozen lockfile dependencies independently. Both
worker checkouts are clean and the root checkout stays on main.

Adopted the current 27-binding/38-target seed on the worker with the CLI's
backup-producing `models init --adopt`. The older root CLI cannot decode the
new Muse/Junie role vocabulary; run model checks from the readiness worktree
until the root checkout receives the updated code. This source-version boundary
is recorded rather than hidden by weakening the schema or dropping bindings.

The first worker check returned zero findings but lacked the proxy overlay.
A direct authenticated, read-only `/v1/models` request independently confirmed
GPT-6.1-Sol, GPT-6 Luna, Grok 4.7, Fable 5.1, Opus 5.5 and Muse Wonder 1.0.
Installed the existing proxy client credential into the catalog reader's
expected mode-0600 client-token file; no new credential or raw value was exposed.
The initial direct request used `/models`, returned 404, and was corrected to
`/v1/models` before recording success.

The repeated worker check reports **zero findings across 360 models**, with
router-for-me, Codex cache, Grok cache, Cursor and proxy overlays all answering.
Explicit wrapper inspection additionally found an old lightweight default that
is outside the current manifest's shell-function locator coverage. Updated
`ANTHROPIC_DEFAULT_HAIKU_MODEL` in the worker proxy library to GPT-6 Luna,
retaining a private backup. Shell syntax checks pass. Add portable executable
wrapper locators to future parity coverage so a green model check also covers
these installed worker entrypoints.

Optional Junie configuration and the Graft deep environment file are absent on
the worker; optional-target skips do not prove those integrations are ready.
No model inference, Junie credits probe, deep Graft job or T3 restart was run.
Existing processes can retain launch-time defaults until their next session.
MCP qualification and detached Yeet proof remain separate readiness tasks.
