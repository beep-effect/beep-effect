# Decisions

Grilling log for the align stage (`/grill-with-docs`), newest round last.
Each entry: Question / Answer / Rationale (rejected options included).

## 2026-10-14 — Round 1

### D1 Who the mod is for

- **Question:** Build for the attorney's Claude Code sessions, the operator's
  dev sessions, or both?
- **Answer (operator):** Both, and the **operator's dev sessions come first,
  for testing**. The product target is the attorney's Claude Code on his PC;
  every capability is dogfooded in the operator's Claude Code before it ships
  to that machine.
- **Rationale:** the attorney's PC already runs Claude Code ≥ 2.1.287 with
  practice-kg registered, and review links open Claude Code, so a mod reaches
  him without a new app. Testing on the operator's machine first keeps a
  broken mod off a production law-office seat. Rejected: attorney-only (no
  safe test bed); operator-only (misses the law-practice use case).
- **Consequence:** the operator's machine needs the same practice-kg MCP
  registration (bundle-backed) so the mod's tool-row, matter and verdict
  features have real calls to act on during testing.

### D2 Anthropic's `legal` plugin ("claude-for-legal")

- **Question:** Install it for the attorney, trial it, mine it, or drop it?
- **Answer (operator):** **Mine its skills into ours**: port the useful
  prompts (Apache-2.0, with attribution) into a firm skill that ships in the
  same plugin as the mod.
- **Rationale:** its personas target in-house counsel; a solo patent
  practice needs adapted prompts, not the stock plugin and its seven
  connector prompts. Rejected: install as-is (noise, mismatched playbook);
  drop entirely (loses reusable prompt structure).
- **Consequence:** the Notion item "Add claude-for-legal to dads claude
  setup" folds into this packet. Which skills to port is a later question
  (see manifest `openQuestions`).

### D3 First-slice capabilities

- **Question:** Which capabilities go in the first mod slice?
- **Answer (operator):** all four candidates: plain-language tool rows,
  Right/Wrong verdict capture, a current-matter band, and time capture per
  matter.
- **Rationale:** each answers a known gap: the 2026-10-09 plain-language
  ruling for attorney-facing text, the separate sitting app plus transcript
  pulls for practice-kg evals, the missing matter selector (inventory §4),
  and the not-yet-started time spine.
- **Challenge raised (resolved in round 2):** time capture conflicts with
  `goals/law-time-capture-spine` doctrine (visible explicit timers only, no
  invisible timers, no silent content capture, source duration = explicit
  timer duration).

### D4 How the current matter is chosen (agent-decided)

- **Question:** Does the band infer the matter from the working folder, or
  does the attorney choose it?
- **Answer (agent, per the autonomy charter):** the attorney chooses
  explicitly with `/matter <number or name>`. The mod resolves through
  `kg_matter_lookup` and shows a picker when the lookup is ambiguous. The
  working-folder name may **pre-fill a suggestion** but never sets the matter
  by itself.
- **Rationale:** the inventory (§5) records that practice-kg acts only on a
  unique resolution and labels inferred candidates as non-unique; a wrong
  silent matter would mis-attribute verdicts and time. Reverse by allowing
  folder inference once matter resolution proves unique on real folders.

## 2026-10-14 — Round 2

### D5 Time capture respects the spine's doctrine

- **Question:** Passive turn timing, a visible timer, or drop time capture?
- **Answer (operator):** a **visible explicit timer in the matter band**:
  `/time start` and `/time stop`, with a running clock on screen. The mod
  records explicit timer intervals only and hands them to the
  `law-time-capture-spine` schema once that goal's P0 freezes it.
- **Rationale:** keeps the 2026-07-14 spine decision intact (visible explicit
  timers, no invisible timers, no silent content capture, source duration =
  explicit timer duration). Rejected: passive turn timing (would amend
  ratified doctrine for a convenience); dropping it (the band is the natural
  timer surface).
- **Consequence:** the mod's time feature is gated on the spine's P0 entry
  schema; until then the timer is a surface plus raw interval rows, not
  candidate entries.

### D6 Code home: `apps/practice-claude-mod/**`

- **Question:** Where does the mod's source live, and in what form?
- **Answer (operator):** `apps/practice-claude-mod/**`, a practice app like
  `apps/practice-kg-mcp`: Effect-first TypeScript that uses the
  `@beep/law-practice-*` schemas, bundled into one ESM hooks module plus
  `plugin.json`, proven with `claude plugin validate` and `claude plugin test`.
- **Rationale:** the mod is a host adapter that ships law-practice behaviour
  to a deployment target, which is what `apps/practice-*` holds; it keeps the
  repo's schema/Effect laws and package gates. Rejected: hand-written JS under
  `.claude/` (outside the laws and gates, and `.claude/` is the repo's own
  harness, not a product); a separate private repo (vendored schemas drift).
- **Doctrine check:** `standards/architecture/07-non-slice-families.md` routes
  repo operations to `tooling`; this is product behaviour for the practice,
  so an app, not tooling. Create it with `bun run beep create-package`.

### D7 Delivery: directory marketplaces

- **Question:** How does the built mod reach each machine?
- **Answer (operator):** the operator's machine loads the build output with
  `CLAUDE_CODE_PLUGIN_DIRS` (hot reload while testing). The attorney's PC
  gets the build copied over SSH into a local **directory marketplace**,
  installed once at user scope; an update is a re-copy plus `/reload-plugins`.
- **Rationale:** a directory marketplace whose entry is a relative path is
  read in place, so no reinstall per update (RESEARCH "Distribution").
  Rejected: a GitHub marketplace on the public monorepo (clones the whole
  repo, couples releases to `main`); managed settings (admin-owned paths and
  Team/Enterprise controls that the firm does not need yet).

### D8 Verdicts: local schema-validated JSONL

- **Question:** Where do Right/Wrong verdicts go?
- **Answer (operator):** a schema-validated JSONL row per verdict (session,
  turn id, question, matter, verdict, note) in a local state file on the
  machine where the session ran, collected the way sitting evidence is today.
- **Rationale:** no network path and no client text leaving the PC unless it
  is collected; matches the existing evidence route. Rejected: live POST to
  the sitting app (a network dependency inside a hook); both (two writers).

### D9 Mod authority envelope (agent-decided)

- **Question:** Which mods API calls may the mod make?
- **Answer (agent):** `$.ui.*`, `$.command.*`, `$.state` / `$.store`,
  `$.clock`, `$.mcp.call` (practice-kg read tools only), and `$.fs` limited
  to the mod's own state directory (checked through `realPath`). No
  `$.process`, no `$.http.fetch`, no `$.env.*`, no `$.prompt.submit`, no
  `$.model.*` in slice 1. The release check fails when
  `claude plugin validate` reports a call outside this list.
- **Rationale:** mods are unsandboxed and run with the attorney's full
  permissions (RESEARCH "Trust and control"); the envelope makes the review
  mechanical. Reverse per capability with a logged decision (for example
  `$.model.complete` for timer narratives once the spine allows it).

### D10 Verdict schema home (agent-decided)

- **Question:** Does the verdict row schema live in `@beep/law-practice-*`
  or in the app?
- **Answer (agent):** app-local in `apps/practice-claude-mod/**` until a second
  consumer (the practice-kg eval harness) reads it; then promote it into the
  law-practice slice.
- **Rationale:** specific-home-first; one consumer does not justify slice
  vocabulary yet.

## 2026-10-14 — Round 3

### D11 Skills to port from the `legal` plugin

- **Question:** Which of the plugin's nine skills become firm skills?
- **Answer (operator):** `review-contract` (recast for IP agreements:
  assignments, licenses, inventor and joint-development agreements),
  `triage-nda`, `legal-risk-assessment` (recast for prosecution risk:
  deadlines, prior art, candor), and `brief` + `meeting-briefing` (rewired to
  practice-kg matter data instead of Gmail/Slack connectors).
- **Rationale:** these map to recurring solo-patent-practice work. Rejected:
  compliance-check, legal-response, signature-request, vendor-check
  (in-house-counsel workflows with no firm counterpart today).
- **Constraint:** Apache-2.0 port with attribution (NOTICE + per-skill
  source line); the playbook text is rewritten, not copied wholesale; the
  plugin's connector `.mcp.json` is not carried over.

### D12 Appetite

- **Question:** How big is slice 1?
- **Answer (operator):** **one goal packet, about one week.** Order: plain-
  language tool rows + verdict capture (first vertical slice), then the
  matter band and visible timer surface, then the ported skills. Each step
  ships through the directory marketplace, operator machine first.
- **Rationale:** one deployable plugin, one release path; the ordering puts
  the eval-loop value first. Rejected: two parallel goals (one plugin, one
  release path, so the split adds coordination); a separate spike goal (the
  bundle-load proof becomes the first task of the goal instead).
