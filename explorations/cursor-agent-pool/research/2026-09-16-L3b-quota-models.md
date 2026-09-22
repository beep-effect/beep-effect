# L3 — Ultra quota mechanics and model/seat selection

**Lane:** L3 (quota / metering / models / ZDR / programmatic usage)
**Repo context:** beep-effect agent-config parity; Cursor Ultra as a fourth volume pool
**Date:** 2026-09-16
**Status:** complete for beep-effect routing — remaining gaps listed under Recommendations

## Executive summary

Ultra is **$200/mo**, advertised **"20x Pro limits on Agent"** ([account/pricing](https://cursor.com/docs/account/pricing)). Metering is **API-list-price dollars from tokens**, not requests ([models-and-pricing](https://cursor.com/docs/models-and-pricing); [usage-limits](https://cursor.com/help/models-and-usage/usage-limits)).

1. **Three dashboard bars, two of which matter for `cursor-agent`.** Monthly **Cursor Models** (Composer 2.5, Cursor Grok 4.6/4.5, Auto) and monthly **Other Models** (Claude/GPT/Kimi/GLM/Gemini/…). **Grok Bot weekly** is a third meter on the Cursor account ([Grok Bot plans](https://cursor.com/help/grok-bot/plans)); it does **not** drain Agent pools and is irrelevant to the headless lane.
2. **Dollar sizes.** Live pricing pages still print no pool dollars. Staff **mohitjain 2026-06-15**: Ultra Other/API = **$400** (`20×` of Pro's **$20**, not `$200×20`); Auto/Composer is a **separate unpublished** grant ([163309](https://forum.cursor.com/t/how-much-usage-is-available-on-the-200-subscription/163309)). Staff **deanrie 2026-07-19**: **2× Included Usage is permanent** for first-party Auto / Composer 2.5 / Cursor Grok 4.5; it does **not** turn `$400` into `$800`; third-party is not doubled ([166007/4](https://forum.cursor.com/t/now-available-2x-included-usage-your-plan-now-includes-2x-usage-for-all-cursor-models-composer-2-5-and-cursor-grok-4-5/166007/4)). Grok 4.6 launched 2026-08-12; **INFERENCE** it sits in that doubled first-party pool as a Cursor Model.
3. **Pools are not independent.** Staff **deanrie 2026-08-23**: third-party drains **only** Other Models; Cursor models drain Cursor Models **first**, then **spill into Other Models** and can zero both bars ([169032/5](https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032/5)).
4. **100% + on-demand off = hard stop**, never a quality downgrade ([overages](https://cursor.com/help/account-and-billing/overages); models-and-pricing). User-reported CLI/UI string: **`Total usage limit reached`** ([170709](https://forum.cursor.com/t/included-usage-exhausted-why-did-composer-2-5-fast-stop-being-available-for-free/170709)). Reset monthly with billing cycle (operator **Oct 11**); unused does not roll over.
5. **Programmatic individual usage: official NOT FOUND.** Team Admin API `https://api.cursor.com` `/teams/spend` etc. only ([admin-api](https://cursor.com/docs/account/teams/admin-api); staff Mohit 2026-05-19 [160967](https://forum.cursor.com/t/usage-api-cli-command/160967)). Unofficial `DashboardService/GetCurrentPeriodUsage` exists ([cursor-pulse](https://github.com/cnwinds/cursor-pulse/blob/master/docs/cursor-usage-api.md)); **do not scrape in-repo**.
6. **Astra is absent from the Cursor catalog.** Closest Other-Models quality: Fable 5.1 (AA Index **53** tie Astra, **NO ZDR**, $10/$50) or Sol xhigh ($4/$20 promo through 2026-11-21, Index −6). Volume should stay on **Cursor Models**: Composer 2.5 ($0.50/$2.50; CursorBench 4.0 **27.7% / $0.68/task**) and Grok 4.6 xhigh ($2/$6; AA AutomationBench **67** vs Astra **69**). **Fast is a 2–6× latency SKU, not a quality upgrade**; Composer Fast is the **product default** — always pin `--model composer-2.5`. Kimi-is-good does **not** transfer: Cursor-served Kimi K3 burned **~$20 in ~5 minutes** looping ([168699](https://forum.cursor.com/t/kimi-k3-disoriented-and-expensive-in-cursor/168699); staff Colin: not intentional).
7. **ZDR.** Most models under Cursor ZDR. **Fable 5 / 5.1 = NO ZDR**: Anthropic stores I/O ~30 days for harm prevention regardless of Privacy Mode ([claude-fable-5-1](https://cursor.com/docs/models/claude-fable-5-1); [data-use](https://cursor.com/data-use)). Enable Privacy Mode so Cursor itself does not train. Public beep-effect still leaves the box.

**Router:** Codex weekly remaining >5% → native Astra. Else Cursor volume on `composer-2.5` / `cursor-grok-4.6-xhigh`. Stop Cursor-bucket work before Cursor Models 100% if Other must stay reserved for review. Never Fast / Auto / Kimi-on-Cursor / Fable-on-Cursor for volume.

## 1. How Ultra usage is metered

### 1.1 The two dashboard buckets

Official usage-limits page: Cursor splits included usage into two monthly pools:

- **Cursor Models:** Cursor Grok 4.6, Cursor Grok 4.5, and Composer 2.5.
- **Other Models:** third-party models, billed at the providers’ API prices.

Pro, Pro Plus, and Ultra include **both** pools. Start includes Cursor Models only.

**Spill rule (staff, not on the usage-limits page):** the two monthly pools are **not fully independent**. Staff **deanrie 2026-08-23** on [169032/5](https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032/5):

> Named third-party models (DeepSeek, GPT, etc.) only pull from the Other Models pool. Cursor models (Auto, Composer, Cursor Grok) use the Cursor Models pool first, and when it’s used up they automatically continue from the remaining Other Models pool.

Heavy Grok 4.6 can drain Cursor Models, then **finish Other Models**, disabling third-party seats. Other Models **never** drain Cursor Models. Beep-effect must treat Composer/Grok Fast and unbounded Cursor-bucket volume as a way to **starve** the $400 Other pool.

### 1.2 Metering unit (API-list-price dollars vs tokens vs requests)

**API-list-price dollars, computed from tokens.** Listed rates are per million tokens (input / cache write / cache read / output). "Since different models have different API costs, your model selection affects how quickly your included usage is consumed." Auto bills at the list price of the routed model. Legacy request-based Max Mode (+20%) is **not** on current usage-based plans.

Teams/Enterprise add a **$0.25 / 1M tokens Cursor Token Rate** on third-party (including included, on-demand, BYOK). Does **not** apply to first-party Cursor models (Grok, Composer). Individual Ultra: overages page says on-demand is API rates **without markup**.

### 1.3 Ultra included allowance per bucket

- Public pricing page: Ultra = **"$200 / mo"** and **"20x Pro limits on Agent"**. Pro+ = **"3x Pro limits on Agent"**.
- models-and-pricing: daily Agent users typically **$60–$100/month** total usage; power users / automation **$200+/month**. No Ultra-specific dollar pool sizes published on the pages fetched today.
- Live `cursor.com/docs/account/pricing` still does **not** print $400 or "bonus usage". A WebSearch snippet that claimed it did is **not** on the live page. The **$400 Other/API** figure is **staff-stated on the forum** (mohitjain 2026-06-15), not a current pricing-page number — see the second §1.3 below.

### 1.4 What happens at 100% with on-demand disabled

From overages help: on-demand must be enabled **manually**. If on-demand is disabled and included usage hits 100%, **further requests stop** until the next billing cycle or a plan upgrade. Spend-limit enforcement may lag (limited overage credited, billed only up to the limit).

models-and-pricing: "Requests are never downgraded in quality or speed." So: **hard stop, not degraded Auto.**

Operator context: this Ultra seat has **on-demand spending disabled**, so at 100% of a pool the headless `cursor-agent` lane should fail closed.

### 1.5 Reset cadence

"Usage resets monthly with your billing cycle." "Unused usage does not roll over." Reset date is in the Spending tab. Operator dashboard: buckets at 1% used, **resetting Oct 11** (consistent with a monthly cycle anchored to signup/upgrade date, not calendar-month-1).

### 1.6 Grok Bot weekly usage — third bucket? CONFIRMED as separate weekly meter

`cursor.com/help/grok-bot/plans` (fetched 2026-09-16):

- "Grok Bot usage is metered on your Cursor account, not on Grok or X."
- Two Grok-Bot-only pools: **Weekly included usage** (resets weekly) and **On-demand usage** (monthly cap, Cursor "Spending" / "Monthly Limit").
- "Included weekly usage is not the monthly limit."
- Ultra: "highest weekly usage" among Pro / Pro+ / Ultra. **No dollar figure published.**
- Cursor plan + SuperGrok/X Premium+ **do not stack**; only the Cursor-tier grant applies.
- If on-demand is **off**: "Grok Bot stops when weekly usage runs out."
- Page does **not** mention Cursor Models / Other Models. Combined with the usage-limits page (which does not mention Grok Bot) and the operator dashboard showing a **third bar**, treat Grok Bot as a **third, weekly bucket** that does **not** drain the two monthly Agent pools. (Forum claim that launching a Cursor cloud agent from Grok Bot *does* drain Agent pools: **not on this page** — still unconfirmed.)
- Headless `cursor-agent` Agent runs drain Cursor Models / Other Models, **not** this weekly Grok Bot bar. Grok Bot weekly % is **irrelevant** to the beep-effect volume-lane check.

### 1.3 Ultra included allowance per bucket

**Marketing/docs pages (2026-09-16) still print no dollar pool sizes.** `cursor.com/pricing` Individual card shows **$20/mo** only; Ultra is a FAQ recommendation ("Ultra for agent power users"), not a priced row. `cursor.com/docs/models-and-pricing` lists Ultra **$200/month**, both pools "Included". Usage-limits: Cursor Models get "significantly more included usage" than Other Models. Run-1 account/pricing: Ultra **"20x Pro limits on Agent"** vs Pro+ **"3x"**.

**Staff-stated Other-Models / API pool (forum, 2026-06-15):** Cursor staff **mohitjain (Mohit)** in [How much usage is available on the $200 subscription?](https://forum.cursor.com/t/how-much-usage-is-available-on-the-200-subscription/163309):

- Pro $20/mo includes **$20** of API agent usage.
- Pro+ $60/mo includes **$70**.
- Ultra $200/mo includes **$400**.
- **"20x" = $20 × 20 = $400**, not $200 × 20.
- The $400 is **API agent usage with frontier models**.
- **Auto and Composer** usage is "generous and **separate** from that amount." (no official Cursor-Models dollar figure in that reply.)

Treat **$400 Other-Models** as **staff-stated Jun 2026**, not as a number currently printed on pricing pages. Community user Tom_Coustols (2026-06-21) reported personal bars of **$759 Auto/Composer** used (77%) and **$511 API** — implying an Auto/Composer pool on the order of **~$986** for that Ultra cycle. That is **user-reported, not staff**.

**2× Cursor Models — staff-confirmed permanent (2026-07-19).** User **zhedream, 2026-07-17** saw the in-product popup “Now Available 2x Included Usage — Your plan now includes 2x usage for all Cursor models: Composer 2.5 and Cursor Grok 4.5,” distinct from **Grok 4.5 50% off through July 21, 2026** (expired) ([165990](https://forum.cursor.com/t/clarification-needed-is-the-2x-included-usage-temporary-and-how-does-it-relate-to-the-50-discount/165990)). Staff **deanrie 2026-07-19** on [166007/4](https://forum.cursor.com/t/now-available-2x-included-usage-your-plan-now-includes-2x-usage-for-all-cursor-models-composer-2-5-and-cursor-grok-4-5/166007/4):

> 2x Included Usage is permanent. This doubles the included limit for Cursor first-party models Auto, Composer 2.5, and Cursor Grok 4.5. There’s no end date, and it’s not tied to July 21. […] only the first-party part of the pool is doubled. It does not mean your whole included allowance goes from 400 to 800 for every model. Third-party models like Claude, GPT, and Gemini are not doubled.

Applies to self-serve Pro / Pro+ / Ultra / Teams on token-based pricing; Enterprise and old request-based plans excluded. Grok 4.6 was not named (it launched **2026-08-12**); **INFERENCE:** as a Cursor Model it consumes the doubled first-party pool. Live pricing pages still do not print the 2×.

**Historical 100% behavior (superseded by current docs):** [Cursor no longer allow to go above 100% usage](https://forum.cursor.com/t/cursor-no-longer-allow-to-go-above-100-usage/156209) — **Oskar_Puchalski, 2026-03-30** reported that hitting 100% **auto-switched to Composer 2**. That is **old, user-reported, and contradicts** the 2026-09-16 overages + models-and-pricing pages (hard stop; "Requests are never downgraded in quality or speed."). Encode **current docs (hard stop)**, not the March auto-Composer fallback.

Encode for beep-effect: **Other Models ≈ $400/mo API-list-price (staff Jun 2026, not on live pricing page); Cursor Models = unpublished and permanently 2× first-party (staff Jul 2026) — one pre-2× user report ~$986 Auto/Composer; Grok Bot = separate weekly grant (unpublished dollars).**

### 1.4 Hard stop — also true of Grok Bot weekly

Same fail-closed semantics: on-demand disabled → stop at pool exhaustion. Independent of Agent pools.

## 2. Per-model cost multipliers and bucket membership

### 2.1 Bucket membership (Cursor Models vs Other Models)

Official models-and-pricing page (fetched 2026-09-16) is explicit:

**Cursor Models (first-party pool)** — "Grok 4.6, Grok 4.5, and Composer 2.5, including Fast variants." Maps to CLI ids `cursor-grok-4.6-{low..xhigh}(-fast)`, `cursor-grok-4.5`, `composer-2.5(-fast)`. These **do not** pay the Cursor Token Rate.

**Other Models (third-party pool)** — everything else in the pricing table, billed at provider API rates. Confirmed Other-bucket seats in the operator catalog:

- Anthropic: `claude-fable-5-1-{low..max}` / `-thinking-*`, `claude-fable-5-*`, `claude-opus-5-*`, `claude-sonnet-5-*`
- OpenAI: `gpt-5.6-sol-{high,xhigh}(-fast)`, `gpt-5.6-luna-high`, `gpt-5.3-codex-*`, `gpt-5.2`
- Moonshot: `kimi-k3-{low,high,max}`, `kimi-k2.7-code`
- Z.ai: `glm-5.2-{high,max}`
- Google: `gemini-3.7-flash-high`
- `auto` — bills at the **routed** model's list price and may drain **either** pool.

Start includes Cursor Models only. Pro / Pro+ / Ultra include both. "Cursor Models receive significantly more included usage than the third-party pool."

### 2.2 Multipliers: 1M-context, fast, Max mode, thinking/effort, Auto

All prices USD per million tokens from `cursor.com/docs/models-and-pricing` (2026-09-16).

**Fast variants (explicit first-party table):**

| Seat | Input | Cache read | Output | vs non-fast |
|---|---:|---:|---:|---|
| Composer 2.5 | $0.50 | $0.20 | $2.50 | 1× |
| Composer 2.5 Fast | $3.00 | $0.50 | $15.00 | **6× in / 2.5× cache / 6× out** |
| Grok 4.6 | $2 | $0.50 | $6 | 1× |
| Grok 4.6 Fast | $4 | $1 | $12 | **2× all columns** |
| Grok 4.5 | $2 | $0.50 | $6 | 1× |
| Grok 4.5 Fast | $4 | $1 | $18 | **2× in/cache, 3× out** |

**Other Fast / 1M rules (third-party notes):**

- GPT-5.6 Luna / Sol / Terra Fast = **2×**. Long context up to 1M = **2× input**. Long-context Fast above 272K tokens = **2× Fast-input**.
- GPT-5.4 Fast = **2×** and "15% faster". 1M long context = **2× input**. 90% cached-input discount.
- Claude 4 Sonnet 1M = 2× the 200K rates ($6/$7.5/$0.6/$22.5 vs $3/$3.75/$0.3/$15); input above 200K is 2×.
- Kimi K3: up to 1M **without** long-context surcharge; no separate cache-write fee.
- Auto: "All Auto modes bill at the list price of the model each request is routed to." Modes: Cost / Balance / Intelligence.
- **Max Mode is gone on current usage-based plans.** Legacy request-based only: API rate **+20%**. Do not encode a Max-mode multiplier for Ultra.
- Effort/thinking levels (`low..max`, `-thinking-*`): **no published per-effort dollar multiplier**. They change token volume (more thinking tokens → more output billed), not a listed rate. Start cannot select effort (Grok locked to medium, no Fast).
- Teams/Enterprise Cursor Token Rate: **+$0.25 / 1M tokens** on third-party (included + on-demand + BYOK). Individual Ultra on-demand: API rates **with no markup** (overages page).
- Regional data residency: **+10%** on eligible models.

**Fable 5.1 list price (Other Models):** $10 in / $12.50 cache write / $0.25 cache read / $50 out. ~20× Composer 2.5 input, ~20× Composer 2.5 output. This is the cost of "as close to native Fable as Cursor sells."

**GPT-5.6 Sol:** $4 in / $5 cache write / $0.40 cache read / $20 out. Promotional pricing through **2026-11-21**. Fast = 2×. 1M = 2× input.

**GPT-5.6 Luna:** $0.20 in / $0.25 cache write / $0.02 cache read / $1.20 out. Cheapest capable OpenAI seat; cache write is 1.25× uncached input.

**GPT-5.3 Codex:** $1.75 in / $0.175 cache read / $14 out.

**Kimi K3:** $3 in / $0.30 cache read / $15 out.

**GLM 5.2:** $1.40 in / $0.26 cache read / $4.40 out.

**Gemini 3.7 Flash:** $0.75 in / $0.075 cache read / $3.50 out.

### 2.3 Cheapest seats per unit of capability

INFERENCE from list prices only (quality in §4):

1. **Volume implementation, Cursor bucket:** Composer 2.5 non-fast (`composer-2.5`, $0.50/$2.50) is the cheapest first-party agent seat. **Fast is the product default** on the Composer 2.5 model page ([cursor-composer-2-5](https://cursor.com/docs/models/cursor-composer-2-5)) at **6×** — always pin `--model composer-2.5`. Cursor Grok 4.6 non-fast (`cursor-grok-4.6-xhigh`, $2/$6) is 4× Composer input.
2. **Volume implementation, Other bucket:** Luna ($0.20/$1.20) then GLM 5.2 ($1.40/$4.40) then GPT-5.3 Codex ($1.75/$14) then Kimi K3 ($3/$15). Sol ($4/$20) is in Fable-adjacent cost territory.
3. **Fable-class Other:** Fable 5.1 ($10/$50) is the most expensive common seat; Opus 5 is $5/$25 (half of Fable).
4. **Do not use Fast as a quality upgrade** — it is a latency SKU at 2–6×.

See §1.3 for staff $400 Other-Models / unpublished Cursor-Models pool. Grok Bot is a third weekly bucket (§1.6), not a cost-per-token Agent seat.

### 1.4 What happens at 100% with on-demand disabled — CONFIRMED

Overages page (fetched 2026-09-16): on-demand "must be explicitly enabled." Disabling it **"stop[s] requests once your included usage runs out."** Additional on-demand requests, when enabled, are "billed at API rates with no markup." Spend-limit enforcement **lags**; brief overage is issued as a temporary spend-limit credit, billed only up to the current limit. Models-and-pricing: "Requests are never downgraded in quality or speed."

**Hard stop, not degraded Auto.** Operator Ultra has on-demand disabled → `cursor-agent` must fail closed at 100% of the drained pool.

Direction of independence (staff [169032/5](https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032/5) + overages):

- Exhausting **Other Models** stops third-party seats. Composer/Grok **continue** on remaining Cursor Models.
- Exhausting **Cursor Models** does **not** stop Composer/Grok — they **spill into Other Models** and can zero that bar too, which then disables Fable/Sol/Kimi/GLM.
- User-reported error after included exhaustion + on-demand off (from 2026-09-06): **`Total usage limit reached`** ([170709](https://forum.cursor.com/t/included-usage-exhausted-why-did-composer-2-5-fast-stop-being-available-for-free/170709)). Do not rely on a hidden `Free` Composer Fast leftover.

## 3. Programmatic usage read

### 3.1 Official Admin API / dashboard JSON / CLI

Official Admin API lives at `https://api.cursor.com` and is documented as **team data and administration** (members, audit logs, usage, spend, blocklists, directory/billing groups, model access, Grok Bot). There is **no documented individual-account usage endpoint**.

Relevant spend/usage routes (all team-scoped):

| Method | Path | What it returns | Rate limit |
|---|---|---|---|
| `POST` | `/teams/spend` | Per-member `spendCents` (on-demand, current cycle, **excluding** included usage) and `overallSpendCents` (total current-cycle cost **including** included usage); `subscriptionCycleStart`; `fastPremiumRequests`; per-user limits | not stated on this page |
| `POST` | `/teams/daily-usage-data` | Hourly-aggregated per-user request counters (`agentRequests`, `composerRequests`, `subscriptionIncludedReqs`, `usageBasedReqs`, …). **Not** billable dollars. Max 30-day window; poll ≤ once/hour | 20 rpm/team |
| `POST` | `/teams/filtered-usage-events` | Per-event `model`, `kind`, `isTokenBasedCall`, `isHeadless`, `tokenUsage.{input,output,cacheWrite,cacheRead,totalCents}`, `chargedCents`, `cursorTokenFee`. Sum `chargedCents` for cost reconciliation | 60 rpm/team |

`spendCents` vs `overallSpendCents` is the only official split of included vs on-demand dollars. Extra precision on the cent fields landed **2026-06-04**. `cursorTokenFee` is the $0.25/1M Cursor Token Rate on third-party (incl. Auto-routed third-party); it does **not** apply to first-party Cursor models.

The page does **not** document:

- `GET /api/usage` or any dashboard JSON scrape path.
- A `cursor-agent about` / `cursor-agent status` usage field.
- Any CLI equivalent besides `curl -u YOUR_API_KEY:`.

Staff confirmation: forum [Usage API / CLI command](https://forum.cursor.com/t/usage-api-cli-command/160967) (Derek Neighbors 2026-05-19; **Mohit 2026-05-19**) — **no public API or CLI** for individual-plan usage. Official alternatives: `https://cursor.com/settings` Usage tab (detail + **CSV export**) and editor Settings → Usage.

### 3.2 Auth requirements and individual Ultra accounts

**Official Admin API:** HTTP Basic, API key as username, blank password (`-u YOUR_API_KEY:`). JSON bodies need `Content-Type: application/json`. Team-scoped. Several writes are Enterprise-only. The page never claims individual Ultra can call `/teams/*`.

**Unofficial individual path (reverse-engineered, NOT supported):** [cnwinds/cursor-pulse cursor-usage-api.md](https://raw.githubusercontent.com/cnwinds/cursor-pulse/master/docs/cursor-usage-api.md) (fetched 2026-09-16):

| Host | Auth | Official? | Who |
|---|---|---|---|
| `https://api.cursor.com` | Basic `crsr_…` Admin Key | **Yes** | Teams/Enterprise admins |
| `https://api2.cursor.sh` | Bearer `accessToken` (from `POST /auth/exchange_user_api_key` with User API Key, or Linux `~/.config/cursor/auth.json`) | **No** — "non-public, reverse-engineered; may break" | Individual Agent/CLI |
| `https://cursor.com/api/*` | Cookie `WorkosCursorSessionToken` | **No** — dashboard scrape | Browser session |

Individual current-cycle read:

```
POST https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage
Authorization: Bearer <accessToken>
Connect-Protocol-Version: 1
{}
```

Keys: `billingCycleStart/End` (unix ms), `planUsage.totalSpend|includedSpend|remaining|limit` (**cents**), `planUsage.autoPercentUsed`, `planUsage.apiPercentUsed`, `planUsage.totalPercentUsed`, `spendLimitUsage`, `autoBucketModels`. **No JSON keys named `cursorModels` / `otherModels`.** Closest split is `autoPercentUsed` vs `apiPercentUsed`. Do not treat as 1:1 with dashboard bars without a live probe. `GetPlanInfo.planInfo.includedAmountCents` (e.g. 7000 = $70). `GetHardLimit.noUsageBasedAllowed: true` = on-demand disabled. Cookie twin: `GET https://cursor.com/api/usage-summary`. `accessToken` ~1h; re-exchange on 401.

**Do not scrape this in-repo without an explicit decision.** Unofficial, credential-bearing. Record as **NOT FOUND officially**; unofficial probe exists.

### 3.3 Headless "Cursor usage available?" rule

**Official: NOT FOUND** for individual Ultra. Do not call `/teams/spend`.

**Recommended fail-closed rule (no unofficial scrape):**

1. Prefer Codex Astra while Codex pool >5% (operator policy).
2. If routing to Cursor, run `cursor-agent -p --trust --force --sandbox enabled --model <id> --output-format stream-json "…" </dev/null`.
3. Treat the lane as **unavailable** when the stream/JSON contains **`Total usage limit reached`** (user-reported error string from [Composer 2.5 Fast after included exhaustion](https://forum.cursor.com/t/included-usage-exhausted-why-did-composer-2-5-fast-stop-being-available-for-free/170709), **mmochi 2026-09-05/06**, on-demand OFF). Also match quota-exhausted / included-usage / on-demand-disabled wording. Until a live `cursor-agent` JSON probe, also treat **non-zero exit + no assistant message** as unavailable.

   That same thread: Composer 2.5 Fast had been continuing as a `Free` usage-history row **after** included exhaustion with on-demand OFF (through 2026-09-05), then started hard-stopping on 2026-09-06. **Do not rely on a hidden Free Composer overflow.** Current docs + this Sep 6 break = fail closed. Fast is **not** a free leftover SKU.
4. On-demand disabled → **hard stop**, no silent Auto fallback (overages page).
5. Check the **drained bucket**: Composer/Grok 4.6 drain **Cursor Models first**, then **spill into Other Models** ([169032/5](https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032/5)). Fable/Sol/Kimi/GLM/GPT-5.3 drain **only Other Models**. Exhausting Other does **not** stop Composer until Cursor Models is also gone (and then spill has nowhere to go). If Other must stay reserved for review, **stop Cursor-bucket volume before Cursor Models 100%**.
6. Ignore Grok Bot weekly % for `cursor-agent` lanes.
7. Ops path: Usage CSV from `cursor.com/settings` (staff-endorsed). Do not commit cookies or `auth.json`.

**If an unofficial probe is later authorized:** `GetCurrentPeriodUsage` and require `apiPercentUsed < 95` (named/Other) and/or `autoPercentUsed < 95` (Auto/Composer) depending on seat, AND `GetHardLimit.noUsageBasedAllowed === true`. Mark **INFERENCE** until a live JSON dump maps those keys onto the two dashboard bars.

## 4. Model quality for agentic coding (Sep 2026)

### 4.1 Catalog seats vs native Astra / Fable

**GPT-6 Astra is absent from the Cursor catalog** (operator `cursor-agent --list-models`, 227 lines, 2026-09-16). Closest Cursor Other-Models seats: GPT-5.6 Sol (xhigh, 1M), GPT-5.3 Codex, Claude Fable 5.1 (thinking/xhigh), Claude Opus 5, Cursor Grok 4.6 xhigh, Composer 2.5. Native Fable 5.1 in Claude Code is the same Anthropic model family as Cursor's Fable 5.1 seat but billed on Anthropic quota, not Cursor Other Models, and native Claude Code does not add Cursor's "NO ZDR" Anthropic-retention hop as a Cursor product policy (the Anthropic side still has its own Fable retention — confirm on Anthropic docs, out of scope here).

### 4.2 Vendor claims fetched this pass (numeric benches still incomplete)

**Composer 2.5** ([changelog 2026-05-18](https://cursor.com/changelog/composer-2-5); [model page](https://cursor.com/docs/models/cursor-composer-2-5); [composer marketing](https://cursor.com/composer)):

- Model page: Cursor Models pool with Grok 4.6/4.5; context **200k**; **default variant is Fast**; standard is “further optimized for cost per token”; $0.50/$0.20/$2.50 vs Fast $3/$0.50/$15. Changelog benches remain **images** (no HTML numbers).
- Marketing CursorBench 4.0 (Composer 2.5): **27.7%**, **$0.68/task**, **17,347 tokens**, **41 steps** — “competitive scores at a fraction of the cost.” Same page also reports Composer 2.5 **Terminal-Bench 2.0 69.3%**, **SWE-Bench Multilingual 79.8%**, **CursorBench v3.1 (harder) 63.2%** vs Opus 4.7 64.8% / GPT-5.5 64.3% / Composer 2 52.2%. **Do not compare TB 2.0 to AA Terminal-Bench v4.0.** An earlier extraction mixed Composer 2 vs 2.5; encode CB4.0 27.7%/$0.68 as the headline and treat the other marketing numbers as **same-page, query-extracted**.

**Cursor Grok 4.6** (`cursor.com/blog/grok-4-6`, **2026-08-12**, jointly with SpaceXAI): long-running agents, codebase-wide engineering, self-testing. **Matches GPT-5.6 Sol on the Artificial Analysis Intelligence Index** (composite of nine benchmarks). $2 in / $6 out; Fast = 2×. First-week 2× promo (expired). Effort levels not spelled on the blog (CLI has `cursor-grok-4.6-{low..xhigh}(-fast)`). No Composer / Claude / Astra comparison on that post.

**Artificial Analysis "Benchmarking GPT-6 Astra"** (2026-09-09) — independent numbers for the native Codex default vs Cursor-available peers:

| Metric | GPT-6 Astra | GPT-5.6 Sol | Claude Fable 5.1 | other |
|---|---:|---:|---:|---|
| Intelligence Index (max) | **53** (tie 1st) | ~47 (Astra is +6) | **53** | — |
| Cost/task (max, AA) | **$3.26** (~40% of Fable; ~60% more than Sol) | — | **$7.63** | Astra low effort $0.82 |
| Output tokens/task | **27k** | — | **78k** | Astra ~⅓ of Fable at same score |
| Hallucination rate (max) | **51%** | **92%** | — | Astra ~half of Sol; +4 accuracy |
| Coding Agent Index | **62** (tie Fable) | **55** | **62** | Opus 5 **60**; Muse Spark 1.3 **54** |
| Terminal-Bench v4.0 (II context) | **59%** | **40%** | **52%** | Astra +7 Fable, +19 Sol |
| Terminal-Bench v4.0 (Coding Agent) | **56%** | **37%** | — | +19 vs Sol |
| SWE-Atlas-QnA | **62%** | **54%** | — | +8 vs Sol |
| DeepSWE | **68%** | **72%** | — | Astra **trails** Sol by 4 |
| AutomationBench-AA | **69%** | **60%** | — | Grok 4.6 **67%**; GLM-5.3 **62%** |
| API list (AA) | $10 in / $50 out | $4 in / $20 out | — | Astra = 2.5× Sol; 90% cache-read discount, 25% cache-write premium |

Sol Index 47 is **INFERENCE** from "Astra is 6 points ahead of Sol" + Astra 53; AA did not print Sol's absolute Index. AA does **not** report SWE-bench Verified/Pro, Composer, Kimi K3, GLM-5.2, GPT-5.3 Codex, or Gemini. GLM cited is **5.3**, not Cursor's **GLM 5.2**.

**Quality implication for Cursor seats (INFERENCE from AA + Cursor vendor posts):**

- Native Astra (Codex) ≈ Fable 5.1 on Intelligence/Coding Agent Index, cheaper per AA-task, far fewer tokens. **Not sellable in Cursor.**
- Closest Cursor "Astra-class" Other-Models seats: **Fable 5.1** (same Index, ~2.5× Astra API $ via Cursor $10/$50, NO ZDR, drains the ~$400 Other pool fast) or **GPT-5.6 Sol xhigh** (Index −6, Coding Agent −7, Terminal-Bench −19; Cursor list $4/$20, promo through 2026-11-21).
- **Cursor Grok 4.6** vendor: matches Sol on AA Intelligence Index; AA AutomationBench 67 vs Astra 69. First-party **Cursor Models** pool at $2/$6 — best in-catalog volume-vs-capability if that Index claim holds.
- **Composer 2.5** at $0.50/$2.50 is the cheap Cursor-bucket workhorse (CursorBench 4.0 **27.7% / $0.68/task**). Fast is 6× and the **product default** — pin `composer-2.5`. Not an Astra/Fable substitute for architecture/review.
- Opus 5 Coding Agent Index 60 (near Fable/Astra) at $5/$25 — cheaper ZDR Other-Models Fable-alternative.

OpenAI `openai.com/index/gpt-6-astra/` and `.../introducing-gpt-5-3-codex/` returned **HTTP 403** this pass; do not cite them.

**Kimi K3 on Cursor — rumor does not transfer.** Josh_Barnett 2026-08-18 ([168699](https://forum.cursor.com/t/kimi-k3-disoriented-and-expensive-in-cursor/168699)): Cursor-served Kimi K3 burned **~$20 of on-demand in ~5 minutes** looping sequential ~40-LOC reads. Staff **Colin 2026-08-25**: repetitive loop evaded auto-protection; “Nothing here is intentional.” Other Models at $3/$15 — a loop hits the scarce $400 bucket. **Do not default volume to `kimi-k3-*`.** Native-lab Kimi quality ≠ Cursor serving path. GLM 5.2 numeric SWE/Terminal still thin this pass (AA cited **GLM-5.3**, not 5.2). GPT-5.3 Codex: price only.

## 5. ZDR / privacy

### 5.1 What "NO ZDR" on Fable seats means

Official model page `cursor.com/docs/models/claude-fable-5-1` and enterprise privacy page (fetched 2026-09-16):

- **Most Cursor models run under Cursor's ZDR agreements:** "providers don't store inputs or outputs or train on your data."
- **Claude Fable 5.1 and Fable 5 are outside those agreements.** Anthropic **stores inputs and outputs** for automatic and human harm-prevention reviews, **regardless of Cursor Privacy Mode**.
- Retention is **not** for training or product improvement. Data is "normally deleted automatically and permanently after 30 days" except safety investigation / legal hold.
- CLI catalog marking **"NO ZDR"** on `claude-fable-5-1-{low..max}` and `-thinking-*` matches this page: the seat is **not** zero-data-retention at the provider.
- With Privacy Mode on (teams / Enterprise / individuals who enabled it): an **administrator must approve** Anthropic's Data Retention Policy in the Cursor Dashboard before Fable works. Without approval, Fable requests **fail**. Individual customers **without** Privacy Mode: Fable is **enabled by default**.
- Guardrail hits auto-route to Claude Opus (ZDR) rather than erroring.

### 5.2 Privacy Mode vs public beep-effect repo

- Privacy Mode: "your code is never used for training by Cursor or other AI model providers." Default **on** for Enterprise teams; **not stated as default-on for individuals**.
- Privacy Mode does **not** keep prompts/code on-box. Ordinary Agent requests still send prompts and code context to OpenAI / Anthropic / Google / Cursor inference. Cloud Agents additionally store encrypted repo copies in isolated VMs for the run duration.
- The pages **do not** treat public-repo code differently from private-repo code.

**Beep-effect implication:** beep-effect is a **public** TypeScript monorepo. Sending it through Cursor Fable still ships prompt+code to Anthropic for **up to 30 days of safety retention**. That is **not** a training leak and **not** a secret-corpus issue (oip-confidentiality does not apply to this public repo). It **is** a ZDR-policy mismatch if a future private/client packet is routed through the same seat. **Do not use Fable 5.1 (Cursor) for any lane that must stay ZDR.** Composer 2.5 / Cursor Grok 4.6 / GPT / Opus / Kimi / GLM are the ZDR-default path ("most models"). Confirm Kimi/GLM ZDR with a model page if those become the volume seat — not yet fetched.

### 5.3 `cursor.com/data-use` (fetched 2026-09-16)

Quotes:

- "Customer Data will not be used for training by Cursor."
- "Cursor maintains zero data retention (ZDR) agreements with **all providers**, and AI model providers will not store or train on your data."
- Exception: "Non-ZDR models will be designated as such or require an admin to opt-in to enable the model for your workspace." Matches CLI **"NO ZDR"** on Fable 5.1.
- Abuse classifiers: "if your prompts or conversations trigger abuse detectors your data may be stored for investigation and deleted in accordance with their retention policies."
- Privacy Mode **off**: "we may use and store codebase data, prompts, editor actions, code snippets, and other code data and actions to improve our AI features and train our models."
- Inference providers "may temporarily access and store model inputs and outputs to improve our inference performance; this data is deleted after use."
- BYOK still "go[es] through our backend" for prompt building. File-cache is encrypted, temporary, "never used as training data when privacy mode is enabled."

**Public-repo implication unchanged:** beep-effect Agent traffic still leaves the box. Enable Privacy Mode on the Ultra seat so Cursor itself does not train. Avoid Fable 5.1 when ZDR is required. ZDR "all providers" on this marketing page is **qualified** by the Non-ZDR-model exception and by the Fable model doc (Anthropic 30-day safety store).

## Deliverable (a) Cost-vs-capability table

Prices USD / 1M tokens from [models-and-pricing](https://cursor.com/docs/models-and-pricing) (2026-09-16). Quality vs native Astra/Fable from [AA 2026-09-09](https://artificialanalysis.ai/articles/benchmarking-gpt-6-astra) unless noted. Fast = latency SKU, not a quality multiplier.

| Seat | CLI id | Bucket | In / cache read / out | vs native Astra | vs native Fable 5.1 | ZDR | Notes |
|---|---|---|---|---|---|---|---|
| **GPT-6 Astra** | *not in catalog* | Codex pool | AA API $10 / $50 | — | Index **53** tie; Coding Agent **62** tie; TB v4 **59%** vs **52%**; AA cost/task **$3.26** vs **$7.63** | OpenAI-side | **Absent from Cursor.** Prefer while Codex weekly >5%. |
| Composer 2.5 | `composer-2.5` | **Cursor Models** | $0.50 / $0.20 / $2.50 | Much cheaper; worker not planner; CB4.0 **27.7% / $0.68/task** ([composer](https://cursor.com/composer)) | ~20× cheaper input than Fable-on-Cursor | most-models ZDR | **Volume primary.** Context 200k. Pin this id. |
| Composer 2.5 Fast | `composer-2.5-fast` | Cursor Models | $3 / $0.50 / $15 (**6×**) | Latency SKU | — | most-models ZDR | **Product default** ([model page](https://cursor.com/docs/models/cursor-composer-2-5)). Do not use as default. |
| Cursor Grok 4.6 | `cursor-grok-4.6-xhigh` | **Cursor Models** | $2 / $0.50 / $6 | Vendor: matches Sol on AA Intelligence Index; AutomationBench **67** vs Astra **69** | Cheaper than Fable-on-Cursor | most-models ZDR | **Volume escalate / in-bucket review.** |
| Cursor Grok 4.6 Fast | `cursor-grok-4.6-*-fast` | Cursor Models | $4 / $1 / $12 (**2×**) | Latency SKU | — | most-models ZDR | Avoid. |
| Cursor Grok 4.5 | `cursor-grok-4.5` | Cursor Models | $2 / $0.50 / $6 | Superseded by 4.6 | — | most-models ZDR | 50% off expired 2026-07-21. |
| Claude Fable 5.1 | `claude-fable-5-1-{low..max}` / `-thinking-*` | **Other Models** | $10 / $0.25 / $50 | Index **53** tie; CA **62** tie; TB v4 **52%** (−7) | Same family as Claude Code Fable | **NO ZDR** (Anthropic 30-day safety store) | Closest Cursor quality. Burns ~$400 Other fast. Not for volume. |
| Claude Opus 5 | `claude-opus-5-*` | Other Models | $5 / $0.50 / $25 | CA Index **60** (near 62) | Half Fable list price | most-models ZDR | **Cursor-Other review primary.** |
| GPT-5.6 Sol | `gpt-5.6-sol-{high,xhigh}` | Other Models | $4 / $0.40 / $20 | Index **−6**; CA **55** vs **62**; TB v4 **40%** vs **59%** | Cheaper | most-models ZDR | Promo through **2026-11-21**. Fast = 2×; 1M = 2× input. |
| GPT-5.6 Luna | `gpt-5.6-luna-high` | Other Models | $0.20 / $0.02 / $1.20 | Cheap lightweight | — | most-models ZDR | **Lightweight Other.** |
| GPT-5.3 Codex | `gpt-5.3-codex-*` | Other Models | $1.75 / $0.175 / $14 | No AA/SWE this pass | — | most-models ZDR | Not default. |
| Kimi K3 | `kimi-k3-{low,high,max}` | Other Models | $3 / $0.30 / $15 | Lab rumor ≠ Cursor path | — | most-models ZDR (model page not fetched) | **Do not default.** ~$20/5 min loop ([168699](https://forum.cursor.com/t/kimi-k3-disoriented-and-expensive-in-cursor/168699)). 1M, no long-context surcharge. |
| GLM 5.2 | `glm-5.2-{high,max}` | Other Models | $1.40 / $0.26 / $4.40 | AA cited **GLM-5.3** not 5.2 | — | most-models ZDR (model page not fetched) | Cheapest named third-party. Optional Other volume, not default. |
| Gemini 3.7 Flash | `gemini-3.7-flash-high` | Other Models | $0.75 / $0.075 / $3.50 | Thin this pass | — | most-models ZDR | Lightweight Other. |
| Auto | `auto` | **either** | routed model list price | Unpredictable | — | depends | Do not use for budgeted lanes. |

Max Mode: **gone** on usage-based plans (legacy +20% only). Effort/thinking: no published rate multiplier (more tokens). Teams CTR +$0.25/1M third-party — **not** individual Ultra. Regional residency +10%. Individual on-demand (if enabled): API rates, no markup.

## Deliverable (b) Recommended 3-tier seat map for beep-effect

Operator policy: **if Codex weekly remaining >5%, use native Astra**; else Cursor, as close to Astra/Fable as the Ultra pools allow without eating Other Models in days. Headless already decided (tsgo-045 D13):

```bash
cursor-agent -p --trust --force --sandbox enabled \
  --model <id> --output-format stream-json \
  "<prompt>" </dev/null
```

Always pass `--model` (Composer Fast is the product default). Always `</dev/null`. No git in the prompt.

### Tier 1 — volume implementation (Cursor Models)

| Role | CLI id | Bucket | Fallback |
|---|---|---|---|
| **Primary** | `composer-2.5` | Cursor Models | `cursor-grok-4.6-xhigh` |
| **Escalate** (long-horizon / self-test / Composer lost the plot) | `cursor-grok-4.6-xhigh` | Cursor Models | native Astra if Codex recovered; else stop |
| **Do not use** | `composer-2.5-fast`, `cursor-grok-4.6-*-fast`, `auto`, `kimi-k3-*`, `claude-fable-5-1-*`, `gpt-5.6-sol-*` | Fast burns 2–6×; Kimi/Fable/Sol sit on Other and/or loop | — |

**INFERENCE:** keep volume on the doubled first-party pool. Stop Cursor-bucket jobs **before Cursor Models 100%** so spill does not zero Other Models (needed if any Cursor-Other review is planned). If Cursor Models is already gone, **do not** keep running Composer/Grok — that is how third-party dies.

### Tier 2 — review / architecture / adversarial

Closest to Astra/Fable is **not sold as a cheap Cursor seat**.

| Role | CLI id | Bucket | Fallback |
|---|---|---|---|
| **Primary** | native Claude Code `claude-fable-5-1` (Anthropic pool) or native Astra if Codex >5% | not Cursor | — |
| **Cursor Other primary** | `claude-opus-5-*` (prefer high/xhigh) | Other Models ($5/$25, CA Index 60, ZDR) | `gpt-5.6-sol-xhigh` |
| **Cursor Other alt** | `gpt-5.6-sol-xhigh` | Other Models ($4/$20 promo → 2026-11-21) | Opus 5 |
| **Cursor Fable (exception)** | `claude-fable-5-1-xhigh` or `-thinking-*` | Other Models ($10/$50) | only if ZDR **not** required **and** Other remaining is healthy |
| **In-bucket review** | `cursor-grok-4.6-xhigh` | Cursor Models | Composer is a worker, not this tier |

Do **not** spend the $400 Other pool on volume Fable. One heavy Fable/Opus day can starve the rest of the cycle; spill from Grok/Composer can finish the job.

### Tier 3 — lightweight / triage / cheap children

| Role | CLI id | Bucket | Fallback |
|---|---|---|---|
| **Primary** | `composer-2.5` | Cursor Models | `gpt-5.6-luna-high` |
| **Other cheap** | `gpt-5.6-luna-high` | Other Models | `gemini-3.7-flash-high` then `glm-5.2-high` |

### Why not Kimi as the “good cheap” overflow

Assignment rumor: Kimi is good. **Lab Kimi ≠ Cursor `kimi-k3-*`.** Cursor-served Kimi K3: Other Models $3/$15, ~$20/5 min looping, staff says not intentional ([168699](https://forum.cursor.com/t/kimi-k3-disoriented-and-expensive-in-cursor/168699)). If a Kimi-class worker is wanted, that is **Composer 2.5** on the Cursor Models pool.

## Deliverable (c) Headless "Cursor usage available" rule

**Official individual Ultra usage API: NOT FOUND.** Do not call `POST https://api.cursor.com/teams/spend`. Team Admin API is team-scoped Basic `crsr_…:` ([admin-api](https://cursor.com/docs/account/teams/admin-api)). Staff Mohit 2026-05-19: no public individual usage API/CLI ([160967](https://forum.cursor.com/t/usage-api-cli-command/160967)). Ops: CSV from [cursor.com/settings](https://cursor.com/settings).

**Fail-closed rule (no unofficial scrape) — copy into the router:**

```
IF Codex weekly remaining > 5%:
    use native Astra; Cursor lane = not needed
ELSE:
    run:
      cursor-agent -p --trust --force --sandbox enabled \
        --model <tier-id> --output-format stream-json \
        "<prompt>" </dev/null
    Cursor usage UNAVAILABLE when any of:
      (1) stream/JSON/stderr contains "Total usage limit reached"
          (also match: quota exhausted, included usage, on-demand disabled)
      (2) non-zero exit AND no assistant/result message
      (3) INFERENCE if unofficial probe later authorized:
            GetCurrentPeriodUsage.planUsage.autoPercentUsed >= 95
              AND seat is Composer/Grok/Auto   → treat Cursor Models as gone
              (do not continue; spill would eat Other)
            GetCurrentPeriodUsage.planUsage.apiPercentUsed >= 95
              AND seat is third-party          → Other Models gone
            GetHardLimit.noUsageBasedAllowed === true (operator: on-demand off)
    Ignore Grok Bot weekly %.
    Do not retry on Auto. Do not retry on Fast. Do not retry on Kimi.
```

Keys `autoPercentUsed` / `apiPercentUsed` are **not** named `cursorModels` / `otherModels` ([cursor-pulse](https://github.com/cnwinds/cursor-pulse/blob/master/docs/cursor-usage-api.md)). Mapping onto dashboard bars is **INFERENCE** until a live JSON dump. **Do not scrape `api2.cursor.sh` or `cursor.com/api/usage-summary` in public beep-effect.**

## Sources

Fetched 2026-09-16 unless noted. One bullet per URL actually used.

### Official Cursor

- https://cursor.com/docs/models-and-pricing — two pools; list prices; Auto bills routed model; no quality downgrade; Ultra $200
- https://cursor.com/docs/models — catalog / pool membership / prices
- https://cursor.com/docs/account/pricing — Ultra $200; 20x Pro limits on Agent
- https://cursor.com/pricing — Individual card; Ultra as FAQ power-user rec
- https://cursor.com/help/models-and-usage/usage-limits — Cursor Models vs Other Models; no rollover; Pro/Pro+/Ultra get both
- https://cursor.com/help/account-and-billing/overages — on-demand must be enabled; hard stop; no markup on individual on-demand; spend-limit lag
- https://cursor.com/help/account-and-billing/pricing — pricing help twin
- https://cursor.com/help/grok-bot/plans — Grok Bot weekly included vs monthly on-demand; Ultra highest weekly; does not stack with SuperGrok
- https://cursor.com/docs/account/teams/admin-api — team `/teams/spend`, `/teams/daily-usage-data`, `/teams/filtered-usage-events`; Basic auth
- https://cursor.com/docs/models/cursor-composer-2-5 — Fast is default; 200k; Cursor Models pool; $0.50/$2.50 vs Fast $3/$15
- https://cursor.com/docs/models/claude-fable-5-1 — Fable 5.1 NO ZDR; Anthropic 30-day safety store; admin opt-in if Privacy Mode on
- https://cursor.com/docs/enterprise/privacy-and-data-governance — ZDR vs Non-ZDR; Privacy Mode
- https://cursor.com/data-use — ZDR with providers except designated Non-ZDR; Privacy Mode off may train
- https://cursor.com/changelog/composer-2-5 — 2026-05-18; Fast prices; benches are images
- https://cursor.com/composer — CursorBench 4.0 Composer 2.5 27.7% / $0.68/task / 17,347 tok / 41 steps
- https://cursor.com/blog/grok-4-6 — 2026-08-12; matches Sol on AA Intelligence Index; $2/$6; Fast 2×
- https://cursor.com/settings — staff-endorsed Usage tab + CSV (no JSON API)

### Independent benches

- https://artificialanalysis.ai/articles/benchmarking-gpt-6-astra — 2026-09-09; Astra vs Sol vs Fable vs Opus vs Grok 4.6 AutomationBench

### Staff / forum (quoted)

- https://forum.cursor.com/t/how-much-usage-is-available-on-the-200-subscription/163309 — mohitjain 2026-06-15: Pro $20 / Pro+ $70 / Ultra $400 API; Auto/Composer separate
- https://forum.cursor.com/t/now-available-2x-included-usage-your-plan-now-includes-2x-usage-for-all-cursor-models-composer-2-5-and-cursor-grok-4-5/166007/4 — deanrie 2026-07-19: 2× first-party **permanent**; not $400→$800
- https://forum.cursor.com/t/clarification-needed-is-the-2x-included-usage-temporary-and-how-does-it-relate-to-the-50-discount/165990 — zhedream popup; Grok 4.5 50% off ≠ 2× pool
- https://forum.cursor.com/t/will-2x-first-party-be-removed/166672 — linked 2× persistence thread
- https://forum.cursor.com/t/possible-bug-in-cursor-token-statistics-other-models-disabled-after-grok-quota-exhausted/169032/5 — deanrie 2026-08-23: Cursor models spill into Other Models; expected
- https://forum.cursor.com/t/included-usage-exhausted-why-did-composer-2-5-fast-stop-being-available-for-free/170709 — mmochi 2026-09-05/06: **`Total usage limit reached`**; Free Fast leftover ended
- https://forum.cursor.com/t/usage-api-cli-command/160967 — Mohit 2026-05-19: no public individual usage API/CLI
- https://forum.cursor.com/t/cursor-no-longer-allow-to-go-above-100-usage/156209 — 2026-03-30 auto-Composer at 100%; **superseded** by current hard-stop docs
- https://forum.cursor.com/t/kimi-k3-disoriented-and-expensive-in-cursor/168699 — Josh_Barnett ~$20/5 min; Colin: loop, not intentional

### Unofficial (do not ship)

- https://github.com/cnwinds/cursor-pulse/blob/master/docs/cursor-usage-api.md — `api2.cursor.sh` DashboardService; cents; autoPercentUsed vs apiPercentUsed
- https://raw.githubusercontent.com/cnwinds/cursor-pulse/master/docs/cursor-usage-api.md — same, fetched as raw

### Fetched, no citable body

- https://openai.com/index/gpt-6-astra/ — HTTP 403
- https://openai.com/index/introducing-gpt-5-3-codex/ — HTTP 403

## Recommendations for beep-effect

1. **Keep the existing Codex-first gate.** If ChatGPT/Codex weekly remaining >5%, run native `gpt-6-astra` xhigh. Cursor Ultra is the **fourth** volume pool, not a replacement.

2. **Volume on Cursor Models, pinned non-Fast Composer:**
   ```bash
   cursor-agent -p --trust --force --sandbox enabled \
     --model composer-2.5 --output-format stream-json \
     "<prompt>" </dev/null
   ```
   Escalate long-horizon / self-test to `--model cursor-grok-4.6-xhigh`. **Always pass `--model`** — Composer Fast is the product default at 6×.

3. **Never default** `composer-2.5-fast`, `*-fast`, `auto`, `kimi-k3-*`, or `claude-fable-5-1-*` on this Ultra seat for volume. Fast is latency. Auto can drain either pool. Kimi-on-Cursor looped ~$20/5 min. Fable-on-Cursor is NO ZDR and eats the $400 Other pool.

4. **Review stays off the Ultra Other pool when possible.** Prefer native Fable (Anthropic) or native Astra. If review must run on Cursor: `claude-opus-5-*` or `gpt-5.6-sol-xhigh`, not Fable 5.1, unless ZDR is explicitly waived and Other remaining is healthy.

5. **Fail closed on quota.** Parse stream-json/stderr for `Total usage limit reached` (and cousins). Treat non-zero exit + no assistant message as unavailable. Do **not** retry on `auto`. Do **not** rely on a Free Composer Fast leftover (gone as of 2026-09-06).

6. **Do not let Cursor Models hit 100% if Other must stay reserved.** Staff: Composer/Grok spill into Other Models after Cursor Models is gone. That can disable Sol/Opus/Kimi/GLM until reset (**Oct 11** this cycle).

7. **Official “usage available?” API for individual Ultra = NOT FOUND.** Do not call `/teams/spend`. Do not scrape `api2.cursor.sh` or cookie `usage-summary` inside public beep-effect. Optional later personal probe (DankStation only): `GetCurrentPeriodUsage` + `GetHardLimit`; treat as INFERENCE until keys are mapped to the two dashboard bars. Ops: CSV from `https://cursor.com/settings`.

8. **Ignore Grok Bot weekly %** when deciding if `cursor-agent` can run. Separate weekly grant; headless Agent does not drain it.

9. **Privacy Mode on** for this Ultra seat so Cursor does not train on prompts/code ([data-use](https://cursor.com/data-use)). Still not on-box inference. **Do not use Cursor Fable 5.1** for any lane that must stay ZDR (Anthropic 30-day safety store regardless of Privacy Mode).

10. **Leave on-demand disabled** (current operator setting). 100% = hard stop until billing-cycle reset; unused does not roll over.

11. **Lightweight children:** `composer-2.5` (Cursor Models) or `gpt-5.6-luna-high` (Other). GLM 5.2 is the cheapest named third-party if Other is to be used; it is not the overflow default.

12. **Auth:** existing `cursor-agent` login or `CURSOR_API_KEY` / `--api-key` for scripts. Do not commit `~/.config/cursor/auth.json`, cookies, or User API keys.

### Gaps left open (do not overfit)

- No live `cursor-agent` stream captured at 1% usage — quota error string is **forum**, not a JSON field dump.
- `autoPercentUsed` vs dashboard “Cursor Models” bar unmapped.
- Composer changelog benches are images; CB4.0 numbers are marketing-page text.
- Kimi/GLM/GPT-5.3 Codex SWE-bench Verified/Pro not in hand.
- Grok 4.6 inheriting the Jul 2026 2× first-party pool is **INFERENCE** (staff named 4.5 before 4.6 shipped).
- Cursor Models dollar size still unpublished (one Jun 2026 user report ~$986 Auto/Composer **before** the 2× announcement).
