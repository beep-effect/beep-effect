# Grill agenda: Grok Bot automation for beep-effect

Date: 2026-09-03

Ask these questions in order. Record each answer before moving on; early answers remove whole runtime and authority branches from the later questions.

## 1. Is this a sibling initiative or a fourth beep-mode phase?

**Decision.** Choose the lifecycle owner for bot packs, runtime code, and production acceptance.

**Why this is a real fork.** Beep-mode already closed a three-PR graduation and explicitly left Benny's Cursor automation files out. Bot packs add a public root, schemas, timers, receipts, credentials, and a threat model. (codex-c2-botpack-design.md § B3. beep-mode decisions bot packs must respect; codex-c2-grill-agenda.md § 1)

**Options.** (A) sibling exploration, then goal; (B) beep-mode P4; (C) reopen P1–P3.

**Recommendation.** A. Reuse beep-mode's roles, eval vocabulary, and autonomy boundary without turning the completed mode into an automation product.

**Documents changed.** New sibling exploration/goal; cross-link only in `explorations/beep-mode/DECISIONS.md` under **vendor shape** and **graduation shape** if needed.

## 2. Where is desired state, and what is authoritative?

**Decision.** Fix the permanent pack path and the repo/UI source-of-truth relationship.

**Why this is a real fork.** Grok Bot has UI-managed profiles, skills, routines, and plugins but no documented Bot-as-code API or automatic GitHub/`AGENTS.md` loader. Duplicating the full prompt creates silent drift. (g1-grok-bot-facts.md § How bots are created and configured; codex-c2-botpack-design.md § A3. The hosted loader contract)

**Options.** (A) `bots/packs/<slug>/{manifest.json,BOT.md}` as desired state plus a generated UI loader; (B) `packages/tooling/tool/cli/resources/bots/` until a second pack; (C) hosted UI is authoritative; (D) duplicate full prompts.

**Recommendation.** A, with B as the conservative rejection of a new top-level root. In either case, every run records the resolved commit and file digests; UI reconciliation stays supervised.

**Documents changed.** `standards/architecture/DECISIONS.md`; `standards/ARCHITECTURE.md` under **Canonical Roots And Names** and **Non-Slice Family Grammar**; AGENTS.md **Context Economy**.

## 3. What write authority does v1 receive?

**Decision.** Set the maximum consequence of a scheduled run before choosing credentials.

**Why this is a real fork.** Grok Bot has no first-class PR channel, its GitHub plugin currently reports `needsAuth`, and public prior art converges on draft PR plus human review. The repo gives Yeet, not a new bot, merge-ready truth. (g1-grok-bot-facts.md § Q5. GitHub integration; g3-prior-art.md § Cross-cutting lesson 1; codex-c1-candidates.jsonl § rank 23)

**Options.** (A) report/issue/handoff only; (B) A plus pack-specific local Yeet draft PR after admission; (C) hosted connector may open PRs; (D) merge when green.

**Recommendation.** A for the first pack; design schemas for B and earn it after several clean, deduped runs. Reject C until hosted proof matches local gates. Reject D categorically.

**Documents changed.** AGENTS.md **Quality Operator** and **Docs & Knowledge**; `standards/architecture/DECISIONS.md`; `explorations/beep-mode/DECISIONS.md` **autonomy contract**.

## 4. Which first pack proves the convention, and what counts as proof?

**Decision.** Choose the first operational workload and its promotion gate.

**Why this is a real fork.** Staleness has the largest scored backlog, but Effect upstream watch has narrower sources and can prove hosted scheduling, handoff, local verification, dedupe, and receipts without repo write authority. (codex-c1-automation-audit.md § C. Broader candidate catalog; codex-c2-botpack-design.md § C5. First bot and staged rollout)

**Options.** (A) `effect-v4-upstream-watch`; (B) knowledge/staleness; (C) portfolio doctor; (D) issue reproduce-and-fix.

**Recommendation.** A. Require no-change and real-change fixtures, identical hosted/local idempotency keys, truncated-handoff rejection, explicit capability partials, and zero duplicates.

**Documents changed.** New bot-automation packet SPEC/PLAN; `standards/architecture/DECISIONS.md`; possibly `standards/ARCHITECTURE.md` for the new family. No production schedule in this decision PR.

## 5. What runtime rule applies to every pack?

**Decision.** Assign capabilities to hosted Bot, local timer, proxy lane, and GitHub Actions.

**Why this is a real fork.** Hosted Bot is always on and good at web/X judgment, but shares one VM and lacks canonical `.repos/effect`, `op`, Yeet, and `beep qa`. The local workstation catches up at boot rather than running overnight. (g1-grok-bot-facts.md § Q3. Runtime and tools; codex-c2-botpack-design.md § C1. Four runtime classes)

**Options.** (A) capability split and hybrids; (B) hosted-only; (C) local-only; (D) Actions-only.

**Recommendation.** A. Hosted discovers/judges; Actions senses deterministic GitHub state; local or proxy verifies checkout-dependent facts and alone publishes through Yeet.

**Documents changed.** `standards/architecture/DECISIONS.md`; `standards/ARCHITECTURE.md` automation area; AGENTS.md **Quality Operator**, **Browser QA**, **Tool Routing**, and **Context Economy**.

## 6. What durable hosted-to-local handoff is allowed?

**Decision.** Choose the transport and completeness proof between separate auth/runtime domains.

**Why this is a real fork.** The current publisher saw gzip EOF after inline base64 transport. Bot conversation history retains only a bounded UI view and is not repo authority. (codex-c1-automation-audit.md § D. Nightly research routine; g1-grok-bot-facts.md § Observability)

**Options.** (A) public-safe GitHub issue mailbox with small envelope, numbered hashed JSONL parts, and completion marker; private content-addressed store for private records; (B) one compressed prompt; (C) hosted branch push; (D) manual copy from chat.

**Recommendation.** A if Benjamin accepts an issue as a mailbox. Receiver verifies schema, part count, record/byte counts, SHA-256, completion, and redaction before model or publisher use.

**Documents changed.** `standards/architecture/DECISIONS.md`; new pack/handoff schemas; `goals/nightly-research-routine/SPEC.md` **Pipeline architecture** and **Scanner gates**.

## 7. Is the nightly routine amended to the hosted reality, and what is "complete"?

**Decision.** Choose whether to amend, hybridize, or rebuild the working research bot.

**Why this is a real fork.** Five hosted partial runs produced 106 claims and 101 suggestions, while the SPEC describes a local `claudeg` search, Sol/Luna verification, Fable writer, and a CLI surface that does not exist. X and verification were absent in all five. (codex-c1-automation-audit.md
§ D. Nightly research routine; codex-c1-summary.md § Research routine)

**Options.** (A) amend to hosted search/writer plus local blinded verifier/publisher; (B) rebuild the original local pipeline now; (C) bless the hosted Bot alone as complete; (D) retire it.

**Recommendation.** A. Keep the productive front half; require typed per-source capability status, blinded verification for completion, and a deterministic publisher. Partial remains a valid result.

**Documents changed.** `goals/nightly-research-routine/SPEC.md` sections **Product**, **Pipeline architecture**, **Ownership & CLI surface**, **Scheduler**, **Model & quota routing**, and **Telemetry**; update PLAN and README consistently.

## 8. What must Benjamin prove in the logged-in X and GitHub UIs before scheduling?

**Decision.** Define capability preflights and the permitted degraded mode.

**Why this is a real fork.** `client-not-enrolled` belongs to X's MCP/app enrollment path, not xAI `x_search`; intro credits are unquantified. GitHub `needsAuth` means remote-plugin OAuth is absent, and its exact Bot tool list is unknown. (g1-grok-bot-facts.md § Q4. X search from a bot and from the API; g1-grok-bot-facts.md § Q5. GitHub integration)

**Options.** (A) require both plugins and fail the run; (B) typed source partials, with local/proxy X fallback and local `gh` publisher; (C) browser scrape and hosted `git`/`gh`; (D) silently omit failed sources.

**Recommendation.** B. First check X Project + Pay-per-use + Production and the first-party connector; inspect GitHub tools/OAuth. Never silently call a packet complete or repeat auth loops.

**Documents changed.** `goals/nightly-research-routine/SPEC.md` capability/status schema; AGENTS.md **1Password MCP** and **Docs & Knowledge**; per-pack deployment examples.

## 9. What trigger, dedupe, and scheduler-backpressure contract is mandatory?

**Decision.** Prevent a delayed hosted run and morning local catch-up from both delivering.

**Why this is a real fork.** Staff observed 10–37 minute routine delays and silent success; scheduled grok-4.6 prior art produced nearly duplicate CI-red PRs. A live repo scheduler holder is already defined as backpressure. (g1-grok-bot-facts.md § Observed schedule semantics; g3-prior-art.md § C6.4 Devin; codex-c2-grill-agenda.md § 9)

**Options.** (A) immutable trigger coordinates + deterministic key + single-flight + prior-delivery gate + grace-window arbitration; (B) prose-only duplicate check; (C) let both run and reconcile.

**Recommendation.** A. The key must be identical across runtimes. No delivery if a plausible issue, PR, commit, receipt, or live owner already covers it; heavy local work also needs scheduler admission.

**Documents changed.** `standards/architecture/DECISIONS.md`; AGENTS.md **Quality Operator**; bot manifest, trigger, gate, and receipt schemas.

## 10. What numeric budgets and failure states pause a bot?

**Decision.** Turn unpublished quota and beta reliability into an explicit kill switch.

**Why this is a real fork.** Heavy's numeric Bot pool is unpublished, on-demand can spill without a Bot-specific cap, P0 5-minute loops burn tokens, and routine history retains only 20 runs. (g1-grok-bot-facts.md § SuperGrok Heavy inclusion, bot counts, usage; g2-use-cases-and-practices.md § Runaway-cost controls)

**Options.** (A) explicit wall/tool/token-or-step/byte ceilings, one retry/key, partial receipt, and pause after 3 failed/partial runs; (B) retry until success; (C) silently drop sources/evidence; (D) disable after one failure.

**Recommendation.** A as the initial default, with per-pack overrides only after measured runs. Keep on-demand off until Benjamin reads the meter. Always persist a no-op/partial/failure receipt.

**Documents changed.** `standards/architecture/DECISIONS.md`; AGENTS.md **Quality Operator**; bot budget/receipt schemas; nightly SPEC **Model & quota routing** and **Telemetry**.

## 11. What security, provenance, and eval gate earns promotion?

**Decision.** Define what a safe test run must prove before a routine or write adapter is enabled.

**Why this is a real fork.** All Bots share one VM; external text is untrusted; xAI says review controls reduce but do not eliminate prompt injection. Wrong instruction files can hurt agents more than missing ones, and reviewer noise can cause immediate abandonment. (g1-grok-bot-facts.md § Approvals / Auto Review; g3-prior-art.md § C10.6 Macke & Doyle; g3-prior-art.md § C3.6)

**Options.** (A) Rule-of-Two threat model, read-only hosted credentials, git+content-digest receipts, safe fixtures, and with/without eval for instruction changes; (B) trust Auto Review; (C) separate Bot names as isolation; (D) grant broad tools, then audit failures.

**Recommendation.** A. Keep local `op`/publisher authority outside the Bot VM, require approval on state-changing tools, record pack/deployment/runtime digests, and promote only measured behavior.

**Documents changed.** `standards/architecture/DECISIONS.md`; `standards/ARCHITECTURE.md` security and runtime boundaries; AGENTS.md **1Password MCP**, **Shared Memory Protocol**, **Context Economy**; `explorations/beep-mode/DECISIONS.md` **eval before promotion**.

## Expected outputs of the grill

- Open a sibling `grok-bot-automation` exploration at capture/align. Do not add beep-mode P4.
- Amend `goals/nightly-research-routine/SPEC.md` and PLAN to state the hosted front half, typed partials, blinded local verification, bounded handoff, and deterministic local publisher.
- Add one architecture decision covering the canonical pack root, source of truth, runtime split, proposal-only authority, handoff, dedupe, budgets, security boundary, and receipts.
- First PR: the decision and packet plus the read-only convention proof for `effect-v4-upstream-watch`: schema-first manifest/receipt/handoff models, one `BOT.md`, sanitized no-change and real-change fixtures, and `beep bots list|validate|render-prompt|dry-run` with tests. It contains no production timer, hosted credential, issue writer, PR writer, merge path, or deployment side effect.
- A later supervised acceptance run may enable one report-only hosted routine. Local verification and fallback come next; pack-specific local Yeet PR authority is earned last.
