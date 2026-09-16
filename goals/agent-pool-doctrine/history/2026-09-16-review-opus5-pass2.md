# Re-review pass — claude-opus-5-thinking-high (D18), 2026-09-16

Read-only `--mode=ask` lane after the fixes, 343 s, 0 git commands. Verbatim output follows (the
model emitted its report twice; both copies kept). Remaining items — `--cd` uncited, AGENTS.md wrap,
law-pulse event name, paste-safe redirect — were applied by Fable the same day.

---

I'll read the prior review, then the decision log and revised artifacts.Now let me verify the revised claims against the shipped configs and source briefs.Shell is blocked in ask mode; I'll check line widths with Grep instead.Read the prior review, `DECISIONS.md` (D1–D21), both revised artifacts, and cross-checked against `.cursor/hooks.json`, `.cursor/hooks/hook-pulse.sh`, `hook-pulse.ts`, `SPEC.md`, `PLAN.md`, `RESEARCH.md`, and the L1 brief.

**Headline: all four blockers are fixed and 13 of the 14 lower findings are closed. One finding is partial, and the fixes introduced one new defect — a 100-column wrap violation in `AGENTS.md` — plus two cosmetic slips. Nothing contradicts D1–D21.**

## Blockers

**1. Wrong family reserved — RESOLVED.** `docs/runbooks/agent-pools.md:20-22` now reads "`grok-4.6` proxy lanes (CLIProxyAPI, xAI) stay reserved for research-class work (D7) — not to be confused with `cursor-grok-4.6-xhigh`, the Cursor volume fallback seat (D16)." Matches `AGENTS.md:18-19` and the seat map at `:86`.

**2. Meter row cancelled the Cursor pool — RESOLVED.** `:46` now reads "at or below the floor when `usedPercent` ≥ 95 → fall through to the Cursor pool (step 2); hold only when Cursor is also below floor (D7)." Boundary is now airtight against `AGENTS.md:11-14`: >5% remaining is pool 1, exactly 5% (usedPercent 95) is pool 2.

**3. Reopened Fable seat — RESOLVED.** `:90-91` states the never-list unqualified, "on any Cursor lane, volume or review"; `:102-104` keeps the retention fact, says "Fable seats are excluded from lanes (D16, D18)", and the eligibility sentence is gone. Consistent with D16 (`DECISIONS.md:212`) and D18 (`:242`).

**4. `sessionStart` mapping — RESOLVED.** `:228-229` moves it to the unwired list with "(no `HookPulseEvent` literal; deliberately unwired, D14/SPEC)". Verified: `hook-pulse.ts:258-268` has nine literals and no `SessionStart`, and the adapter map at `.cursor/hooks/hook-pulse.sh:20-27` has no `sessionStart` key.

## Should

**5. Hooks section documented intent as shipped — RESOLVED.** `:217-226` "Registered in `.cursor/hooks.json`" lists exactly the six events in `.cursor/hooks.json:4-9`, with `stop` and `beforeSubmitPrompt` marked "registered; GAP — did not fire headless" per `SPEC.md:48`. `:228-231` is the observed-not-wired list, and `:231-232` marks law-pulse and the yeet-inbox deny as follow-on work citing `PLAN.md`, which does carry them at `PLAN.md:18-19`. (One wording slip inside this rewrite — see N2.)

**6. Permission footgun backwards — RESOLVED.** `:244-247` now says every permission-event hook "must print a decision — an empty stdout is malformed JSON and **blocks the tool**", with `allow` as lowest priority. Matches the adapter's own header at `.cursor/hooks/hook-pulse.sh:7-9` and `SPEC.md:49`.

**7. Codex block — PARTIAL.** Runnability is fixed: `:277-278` now carries a prompt argument and `</dev/null`, and `-s workspace-write` is gone. But `--cd <workdir>` is still uncited — grep across `explorations/cursor-agent-pool/` finds no `--cd` in `RESEARCH.md` or any brief; the packet's only Codex invocations are `RESEARCH.md:67-72` and `research/2026-09-16-L4-field-reports.md:227`. `:281` hedges sandbox and `--add-dir` to "the operator's Codex rules" but leaves `--cd` in the copy-paste block. Either cite it or move it into that hedge.

**8. Missing auth — RESOLVED.** `:110-112` adds one-time `cursor-agent login` or `export CURSOR_API_KEY=…` for CI plus the argv/`ps`-leakage warning, sourced to the authentication page (also in Sources at `:312`). Matches `research/2026-09-16-L1-brief.md:14,41` (CONFIRMED).

**9. Cursor floor number — RESOLVED on both surfaces.** `:68-70` "Hold Cursor lanes when the target bucket shows less than 5% remaining (human dashboard check, D7/D17)" and `AGENTS.md:15-16` "hold Cursor lanes when the target bucket shows less than 5% remaining (dashboard check, D7, D17)". Satisfies `SPEC.md:45-46`.

**10. `--sandbox disabled` prohibition — RESOLVED.** `:264-265` adds the never-disable law to the sandbox notes as a SPEC stop condition (`SPEC.md:82`), and the `unshare EPERM` row at `:302` now ends "stop and report the blocked path — never `--sandbox disabled`".

## Nits — all eight RESOLVED

Placeholder unified on `<lane>.ndjson` / `<lane>.stderr` (`:108`, `:125-126`, `:205`), with the jq cookbook explicitly scoped to `run.ndjson` at `:148`. Prompt is positional, no `--` (`:123`). `grep -c` wrapped in `{ … || true; }` with the reason stated (`:205-208`). Forum 160039 is a full URL (`:302`, `:320`). Sources gained `run-modes` (`:311`, cited at `:267`) and dropped the uncited Artificial Analysis entry. `AGENTS.md:44-45` restores `timeout` and `/dev/null` and points at the runbook. `AGENTS.md:14` says "at or below the floor". Both hedges kept — `:62-63` "user-reported wording, unpublished — match loosely, never as an exact literal" and `:30` "on this workstation the reply arrived in under 40 s".

## New findings from the edits

**N1 — `AGENTS.md:45` breaks the 100-column law (new, should-fix).** That line is 147 columns of prose and is the only prose line in the reviewed section over 100. `SPEC.md:52` requires both surfaces to wrap at 100, and the docs-shape row (`SPEC.md:75`) verifies "wrap ≤ 100 cols". Introduced by the fix for nit 6 — the deny list was appended to the sentence instead of starting a new line. The runbook is clean: every over-100 line there is a table row, a URL, or inside a code block. Section length is fine at 42 lines (`AGENTS.md:8-49`) against the 45-line budget.

**N2 — `:229-231` names two different events for law-pulse (nit).** Line 229 calls `afterFileEdit` the law-pulse candidate; line 231 says "law-pulse on `postToolUse`". `PLAN.md:18` says `postToolUse`; D14 (`DECISIONS.md:184`) and `RESEARCH.md:118` say `afterFileEdit`. Not a doctrine break — the work is unshipped and the runbook defers to PLAN — but pick one event name.

**N3 — the Cursor recipe cannot be pasted verbatim (nit).** `:126` `> <lane>.ndjson 2> <lane>.stderr` is a bash syntax error as written, because `<lane>` parses as an input redirection after the `>` operator. D12's promise is copy-paste blocks; a `LANE=…` line plus `> "$LANE.ndjson" 2> "$LANE.stderr"` keeps one placeholder and stays runnable.

No new blocker: no contradiction with D1–D21, no unsourced number (prices, `$400`, smoke counts 3/2/1/1 against `RESEARCH.md:82`, the 95 threshold, and the 40 s hold all still trace), and the two copy-paste blocks that matter (Codex probe at `:33-38` versus `RESEARCH.md:67-72`, and the jq cookbook) are unchanged and runnable.

SHIP WITH FIXESAll four prior blockers are fixed and every nit closed; one should is still partial, and the fix for a nit introduced a wrap violation in `AGENTS.md`.

## Blockers

**1 — RESOLVED.** `docs/runbooks/agent-pools.md:20-22` now reads "`grok-4.6` proxy lanes (CLIProxyAPI, xAI) stay reserved for research-class work (D7) — not to be confused with `cursor-grok-4.6-xhigh`, the Cursor volume fallback seat (D16)". Matches `AGENTS.md:19` and no longer collides with the seat map at `:86`.

**2 — RESOLVED.** `:46` now reads "Codex is at or below the floor when `usedPercent` ≥ 95 → fall through to the Cursor pool (step 2); hold only when Cursor is also below floor (D7)". Boundary is coherent with `AGENTS.md:14` ("at or below the floor") — exactly 5% remaining now lands in step 2, not in a gap.

**3 — RESOLVED.** The never-list at `:90-91` is unqualified ("on any Cursor lane, volume or review"), and the ZDR note at `:102-104` says "Fable seats are excluded from lanes (D16, D18)" and keeps only the retention fact plus the corpus rule. The D11 eligibility sentence is gone.

**4 — RESOLVED.** `sessionStart` moved out of the mapping table into "Observed in the smoke test, not wired" at `:228-229` with the reason ("no `HookPulseEvent` literal; deliberately unwired, D14/SPEC"). Verified against the nine literals in `packages/tooling/library/ai-metrics/src/hook-pulse.ts:258-268` (no `SessionStart`) and the adapter header at `.cursor/hooks/hook-pulse.sh:10-11`.

## Shoulds

**5 — RESOLVED.** `:216-232` is split as asked. The registered table (`:221-226`) lists exactly the six events in `.cursor/hooks.json:4-9`, with `stop` and `beforeSubmitPrompt` marked "registered; GAP — did not fire headless"; law-pulse and the yeet-inbox P0 deny are now labelled Goal A follow-on work at `:231-232`. Smoke counts still match `RESEARCH.md:82`.

**6 — RESOLVED.** `:245-247`: "must print a decision — an empty stdout is malformed JSON and **blocks the tool**", plus the `allow`-is-lowest-priority note and `exit 2` denies. Matches the adapter's own comment at `.cursor/hooks/hook-pulse.sh:7-9`.

**7 — PARTIAL.** The block is runnable now — `:277-278` carries a prompt argument and `</dev/null`, and `-s workspace-write` is gone. `--cd <workdir>` is still uncited: nothing in the packet shows it (`research/2026-09-16-L4-brief.md:85` and `-L4-field-reports.md:227` only ever show `codex exec --model gpt-6-astra …`), and the hedge at `:280-281` covers sandbox and `--add-dir`, not `--cd`.

**8 — RESOLVED.** `:110-112` adds the auth paragraph with the one-time `cursor-agent login` / `CURSOR_API_KEY` split and the argv/`ps` warning, cited to the authentication page, which is now in Sources at `:312`. Traces to `research/2026-09-16-L1-brief.md:14,41` (CONFIRMED).

**9 — RESOLVED.** Both surfaces state the number: `:68-70` ("less than 5% remaining (human dashboard check, D7/D17)") and `AGENTS.md:16`.

**10 — RESOLVED.** `:264-265` adds "Never `--sandbox disabled`" as a SPEC stop condition, and the `unshare EPERM` row at `:302` now ends "stop and report the blocked path — never `--sandbox disabled`" with the forum URL.

## Nits — all eight resolved

One placeholder throughout (`:108`, `:125-126`, `:205`, with the cookbook explicitly scoped to `run.ndjson` at `:147`); prompt passed positionally at `:123`; `{ grep -cE … || true; }` with the reason spelled out at `:205-208`; forum 160039 as a URL at `:302`/`:320`; `run-modes` added to Sources at `:311` and the uncited Artificial Analysis entry removed; `AGENTS.md:44-45` now names the host `timeout` and `/dev/null`; `AGENTS.md:14` says "at or below the floor"; both hedges kept (`:30` "on this workstation the reply arrived in under 40 s", `:62` "user-reported wording, unpublished — match loosely, never as an exact literal").

## New findings

**No new blocker.** No contradiction with D1–D21, no new unsourced number, no broken block. Three things to fix while you're in the files:

1. **`AGENTS.md:45` breaks the 100-column wrap** (147 columns of prose), which `SPEC.md:52` makes a constraint and the Verification Matrix at `SPEC.md:75` checks. Introduced by the fix for the lane-one-liner nit. Every over-100 line in the runbook is still a table row, URL, or code line, and the section is 42 lines (8–49) against the 45-line budget, so this is the only wrap violation in the reviewed surface.
2. **`:231` names `postToolUse` for law-pulse two lines after `:229-230` calls `afterFileEdit` the "law-pulse candidate."** Not a doctrine contradiction — `PLAN.md:18` does put law-pulse on Cursor `postToolUse` while D14 says `afterFileEdit` — but a reader wiring the follow-on gets two answers. Name the chosen event and cite which record backs it.
3. **The recipe block is not paste-safe as written:** `> <lane>.ndjson 2> <lane>.stderr` (`:125-126`) is a bash syntax error unless the reader substitutes, because `<lane>` parses as an input redirection. D12 sells these as copy-paste blocks; a leading `LANE=/abs/path/run` and `> "$LANE.ndjson" 2> "$LANE.stderr"` keeps the one-placeholder win and runs.

SHIP WITH FIXES
