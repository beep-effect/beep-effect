# Opportunities

## Model cooldown turned the nightly refs refresh into a 10-hour no-op

- **Work:** The 2026-09-27 nightly `beep-refs-refresh.service` run, owned by
  the `~/YeeBois/projects/beep-effect0` clone.
- **Friction:** The receipt reported
  `{"name":"effect","outcome":"build-failed"}` and
  `{"name":"effect-tsgo","outcome":"build-failed"}` after 10 h of wall clock
  and 50 s of CPU, with no reason attached. CLIProxyAPI answered every
  `/v1/chat/completions` for `claude-opus-5` with HTTP 429 and
  `"code":"model_cooldown"`. Graft's bundled `openai` SDK honours `Retry-After`
  without a cap, so every in-flight request slept for 15.4 h. The Refs deep
  step timeout of 5 h killed each deep member with zero progress. The step's
  timeout message was dropped, because `MemberRefreshReport` had no field to
  carry it. The same cooldown also broke `beep-graft-deep-refresh.service`
  that night.
- **Evidence:** The unit was `beep-refs-refresh.service`. The proxy answered
  `HTTP 429 {"error":{"code":"model_cooldown",...}}` with
  `Retry-After: 55516`. The receipt had two `build-failed` members and no
  detail.
- **Proposal:** Shipped on `feat/refs-cooldown-preflight`. Member receipts
  now carry a bounded `detail`. A one-token probe runs before each deep build
  and reports 429 as `skipped-cooldown` with a structural build only. The
  graft deep refresh timer still needs the same preflight.

## Operator follow-up: read back the first clean scheduled refs night

- **Work:** Closing P4 of this packet on 2026-09-28.
- **Friction:** P4 asked for the next-morning deep tier to be confirmed, but the first two
  scheduled nights both failed for reasons outside the packet. On 2026-09-26 the run ended with
  exit 130 when the user manager restarted. On 2026-09-27 the model cooled down (the entry above).
  The packet closed without a clean scheduled night to read back.
- **Evidence:** The receipt is `~/.local/state/beep/refs/last-refresh.json`, and
  `docs/runbooks/graft-local-recovery.md` describes how to read it. A clean night shows `pulled`
  or `unchanged` for both members, with coverage and no `detail`.
- **Proposal:** Once the timer has a clean night after PR #1311 lands, the operator adds its date
  and both members' coverage here. Status: open.
