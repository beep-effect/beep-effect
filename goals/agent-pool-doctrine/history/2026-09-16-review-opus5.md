# Review pass — claude-opus-5-thinking-high (D18), 2026-09-16

Read-only `--mode=ask` lane over `docs/runbooks/agent-pools.md` and the `AGENTS.md` "Volume pools"
section, 382 s, 0 git commands. Verbatim output follows; fixes applied by Fable the same day
(see `2026-09-16-admission-proof.md`).

---

## Context read
`DECISIONS.md` (D1–D21), `BRIEF.md`, L1 brief, L3 brief, then both artifacts, plus `SPEC.md`, `RESEARCH.md`, the shipped `.cursor/hooks.json` / `hooks/hook-pulse.sh` / `cli.json`, and `HookPulseEvent` in `packages/tooling/library/ai-metrics/src/hook-pulse.ts`.

## Blockers

**1. `docs/runbooks/agent-pools.md:20-21` — wrong family reserved, contradicts the doc's own seat map.**
"`cursor-grok-4.6-*` proxy lanes stay reserved for research-class work, not volume overflow (D7)." D7 reserves the CLIProxyAPI xAI `grok-4.6` lanes; `cursor-grok-4.6-xhigh` is the volume *fallback* seat under D16, as this same file says at line 82. There is also no such thing as a Cursor proxy lane — CLIProxyAPI has no Cursor provider (D6, `RESEARCH.md:40-41`). As written, step 3 tells an orchestrator never to use the seat step 2 hands it.
Fix: adopt the `AGENTS.md:17` wording — "`grok-4.6` proxy lanes (CLIProxyAPI, xAI) stay reserved for research-class work (D7)" — and add "not to be confused with `cursor-grok-4.6-xhigh`, the Cursor volume fallback (D16)."

**2. `docs/runbooks/agent-pools.md:44` — meter table says hold where doctrine says use Cursor.**
"Floor is 5% remaining → hold when `usedPercent` ≥ 95." The threshold is right, the action is not: at ≥ 95 the Codex pool is below floor and the next step is pool 2 (D17 fail-open). Hold is step 3, reached only when Cursor is also below floor (D7). Read on its own, this row cancels the Cursor pool.
Fix: "Codex is below floor at `usedPercent` ≥ 95 → fall through to the Cursor pool (step 2); hold only when Cursor is also below floor (D7)."

**3. `docs/runbooks/agent-pools.md:86-88` and `:96-100` — reopens the Fable seat that D16/D18 and `AGENTS.md` close.**
Line 86 narrows the never-list to "on Cursor volume lanes"; line 98 then says "Fable seats stay eligible for review when Other Models is healthy," citing D11. D11 is Round 3 and was revised by D16 ("`claude-fable-5-1-*` and `kimi-k3-*` are excluded from lanes"), and D18 explicitly rejected Fable 5.1 xhigh for review. `AGENTS.md:41-42` states the never-list unqualified. The runbook is the copy-paste surface, so it licenses a seat the law forbids.
Fix: make the never-list unqualified ("never on any Cursor lane — D16, D18"), delete the eligibility sentence, and keep the ZDR paragraph to the retention fact plus the corpus rule.

**4. `docs/runbooks/agent-pools.md:213` — `sessionStart` → `SessionStart` mapping cannot decode.**
`HookPulseEvent` has nine literals and `SessionStart` is not among them (`hook-pulse.ts:258-268`); `SPEC.md:50` forbids wiring it, and the shipped adapter says so in its own header (`.cursor/hooks/hook-pulse.sh:10-11`). Anyone wiring from this table writes rows the ledger rejects.
Fix: change the Repo mapping cell to "— (no `HookPulseEvent` literal; deliberately unwired, D14/SPEC)".

## Should

**5. `docs/runbooks/agent-pools.md:203-234` — hooks section documents intent as shipped wiring.**
`.cursor/hooks.json` registers exactly `preToolUse`, `postToolUse`, `postToolUseFailure`, `beforeSubmitPrompt`, `stop`, `sessionEnd`, all on `hook-pulse.sh`. The runbook credits `preToolUse` with a yeet-inbox P0 deny (:214), `afterFileEdit` with law-pulse (:220), and `beforeShellExecution` with a PermissionRequest analogue (:219) — none of those are registered — while :222 never says that `stop` and `beforeSubmitPrompt` *are* registered despite not firing headless (`SPEC.md:48`).
Fix: split the section into "Registered in `.cursor/hooks.json`" (the six, with `stop`/`beforeSubmitPrompt` marked registered-but-headless-GAP) and "Observed in smoke, not yet wired" (`sessionStart`, `afterFileEdit`, `beforeShellExecution`, `afterShellExecution`), and mark law-pulse/yeet-inbox as follow-on work.

**6. `docs/runbooks/agent-pools.md:230-232` — the permission-hook footgun is stated backwards.**
"reply `{"permission":"allow"}` or exit 2 to block" reads as optional. `SPEC.md:49` and the adapter's own comment are explicit: empty stdout on a permission event is malformed JSON and *blocks the tool*.
Fix: "Every permission-event hook must print a decision — empty stdout blocks the tool. `allow` is lowest priority, so a deny from another hook (yeet-inbox P0) still wins."

**7. `docs/runbooks/agent-pools.md:259-261` — the Codex block is not runnable, and two flags are unsourced.**
`codex exec … -s workspace-write --cd <workdir>` carries no prompt, so a copy-paste run reads stdin instead of working — and D12's whole promise is copy-paste blocks. `-s workspace-write` and `--cd` appear in no brief and not in `RESEARCH.md`; the packet only ever shows `codex exec --model gpt-6-astra …`.
Fix: add a prompt argument and `</dev/null`, and either cite the sandbox/cd flags or drop them.

**8. `docs/runbooks/agent-pools.md:105-118` — Cursor recipe omits auth.**
Recipe v2 in the L1 brief opens with `export CURSOR_API_KEY=…` (or one-time `agent login`) and warns never to pass `--api-key` on argv because of ps leakage (L1 brief lines 14 and 41, CONFIRMED). The runbook has no auth line at all, so the block fails on a fresh host or in CI.
Fix: add the export line and the argv warning; if the key comes from 1Password, show the `op run` wrapper.

**9. `docs/runbooks/agent-pools.md:65-66` and `AGENTS.md:14-15` — the Cursor floor number is missing from both surfaces.**
D7 sets 5% per target bucket, and the align closeout keeps it as a human dashboard check under D17; `SPEC.md:45-46` and its acceptance criterion require `AGENTS.md` to state the floors. The runbook says only "check bucket bars"; `AGENTS.md` gives the Codex 5% but no Cursor number.
Fix: in both, "hold Cursor lanes when the target bucket shows less than 5% remaining (human dashboard check, D7/D17)."

**10. `docs/runbooks/agent-pools.md:236-253` and `:282` — the `--sandbox disabled` prohibition is absent.**
`SPEC.md:83` makes it a stop condition: never disable, report the blocked path. The L4 brief presents `--sandbox disabled` as *the* documented escape for precisely the `unshare EPERM` signature the runbook lists at :282 — and :282 gives a sysctl name with no instruction. A reader hitting that error will reach for the forbidden flag.
Fix: add the never-disable law to the sandbox notes, and make the remedy "host fix `sysctl kernel.apparmor_restrict_unprivileged_userns=0`; if the lane still cannot run, stop and report the blocked path — never `--sandbox disabled`."

## Nits

- `docs/runbooks/agent-pools.md:104` vs `:117-118`: the prose says capture to `<lane>.ndjson` / `<lane>.stderr` (and :197 checks `<lane>.ndjson`), but the block writes `/tmp/cursor-lane.*`. Use one placeholder.
- `docs/runbooks/agent-pools.md:115`: prompt-after-`--` is tagged INFERENCE in the L1 brief; the two proven runs (`RESEARCH.md:11-13`, the tsgo-045 smoke) pass the prompt positionally. Use the proven form or mark the inference.
- `docs/runbooks/agent-pools.md:197-200`: `grep -cE '\bgit\b'` exits 1 on a count of 0, so the passing case looks like a failed command under `set -e`. Append `|| true` or extract with `jq`.
- `docs/runbooks/agent-pools.md:282`: "(forum 160039)" is a bare topic id resolvable in `research/SOURCES.md:99` but in no Sources entry here. Use the URL.
- `docs/runbooks/agent-pools.md:285-298`: Sources omits `https://cursor.com/docs/agent/security/run-modes`, cited inline at :250, and lists the Artificial Analysis Astra article, which nothing in the body cites — no benchmark number appears in the runbook.
- `AGENTS.md:42-44`: the lane one-liner drops `timeout 15m` and `</dev/null`, the two anti-hang measures the runbook treats as load-bearing. Add a parenthetical pointing at the runbook.
- `AGENTS.md:14`: "below floor" against step 1's "more than 5% remaining" leaves exactly 5% in neither branch. Say "at or below the floor."
- `docs/runbooks/agent-pools.md:60-63` and `:28`: L3 flags `Total usage limit reached` as user-reported and unpublished, and `RESEARCH.md:55` observed the meter reply in under 40 s (the runbook says "up to 40 s"). Keep the hedges so nobody writes a matcher against an unverified literal.

## What checked out

Prices (`$0.50/$2.50`, `$2/$6`, `$5/$25`, `$4/$20`, `$0.20/$1.20`, `$400/mo`, `composer-2.5-fast` 6× input), the `$400` spill warning, all eight smoke event names and their counts, the D13 GAP list, the Codex probe (byte-identical to the proven block in `RESEARCH.md:67-72`), every jq recipe (identical to the L1 cookbook and runnable), and the deny list all trace to the briefs or `RESEARCH.md`. Seat ids match D16/D18 in both artifacts. Every runbook line over 100 columns is a table row, a URL, or inside a code block — no prose violation; `AGENTS.md`'s three long lines sit outside the reviewed section, and "Volume pools" is 41 lines against the SPEC's 45-line budget.

**Verdict: BLOCK** — four doctrine contradictions (findings 1–4) are text-only fixes; re-review after them and the six shoulds.
