# Todox Marketing Site Spec

Graduated 2026-08-27 from
[`explorations/todox-wealth-management-site`](../../explorations/todox-wealth-management-site/README.md).
This spec back-links the exploration's artifacts instead of copying them; when
a linked artifact and this file disagree, fix the disagreement rather than
silently preferring either.

## Objective

`apps/todox` serves one responsive public marketing homepage for Todox (site
todox.ai) in the human-locked **Terminal of Record** direction: amber-phosphor
terminal passages replaying the deterministic synthetic session, alternating
with fanfold-printout prose passages, ending in a private-walkthrough email
CTA. Copy is claim-gated, demonstrations are visibly synthetic, and the build
carries Impeccable's direction contract, finish review, and DESIGN.md.

## Non-Goals

Seeded from the exploration brief's no-gos
([`BRIEF.md`](../../explorations/todox-wealth-management-site/BRIEF.md)):

- No new `apps/todox.ai`; the existing `apps/todox` workspace is the target.
- No claim that Todox is deployed, generally available, pilot-ready, or used
  by a named wealth firm; no live-integration, certification, retention,
  security-guarantee, time-saving, ROI, or customer-outcome claims.
- No named firms, individuals, testimonials, AUM figures, rankings, customer
  logos, or implied endorsement.
- No autonomous financial advice, tax conclusions, trades, money movement,
  unsupervised client communication, or silent system-of-record writes shown
  or implied.
- No absolute language: "nothing leaves the device," "no hallucinations,"
  "every fact is true," "fully explainable."
- No uniqueness claims ("only," "first") for citations, MCP, human review,
  local deployment, privacy, or audit logs.
- No generic dark-neon AI, glowing graphs, AI brains, orbit imagery, glass
  command centers, dominant chat UI, or wealth-management lifestyle clichés;
  no Mariner, AdvicePeriod, or other reference trade dress.
- No backend, connectors, authentication, CRM/custodian work, form
  infrastructure beyond the mailto CTA, or additional routes in this slice.
- No edits to the exploration packet beyond cross-links and evidence updates.

## Source Hierarchy

1. User objective: build the site the exploration decomposed.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (impeccable,
   browser-qa-loop, yeet, effect-first/schema-first where code warrants).
3. Governing standards: `standards/ARCHITECTURE.md`, `apps/todox/CLAUDE.md`,
   [`apps/todox/PRODUCT.md`](../../apps/todox/PRODUCT.md).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, exploration artifacts, `history/`.

## Design Inputs (binding)

- [`SHAPE-BRIEF.md`](../../explorations/todox-wealth-management-site/research/SHAPE-BRIEF.md)
  — confirmed direction, seven-passage sequence, focal moment, binding
  raises. The build's Impeccable direction contract is written from it.
- [`PUBLIC-COPY.md`](../../explorations/todox-wealth-management-site/research/PUBLIC-COPY.md)
  — the copy, reconciled to
  [`CLAIMS.jsonl`](../../explorations/todox-wealth-management-site/research/CLAIMS.jsonl).
  Any wording change re-runs that reconciliation before it ships.
- [`DEMO-SCRIPT.md`](../../explorations/todox-wealth-management-site/research/DEMO-SCRIPT.md)
  — the exact deterministic session (records, states, clock, interaction,
  fallbacks). The page renders this session, not an improvisation.
- [`ASSET-PLAN.md`](../../explorations/todox-wealth-management-site/research/ASSET-PLAN.md)
  — typeface candidates and license rules; authored-original graphics only.

## Target Surfaces

- `apps/todox/src/**`, app-local assets and config the page needs.
- `apps/todox/DESIGN.md` (written at finish by the Impeccable documenter) and
  `apps/todox/.impeccable/**` working artifacts.
- This packet's own files (plan, evidence, history).

## Constraints

Seeded from the brief's rabbit holes plus the locked direction:

- One high-fidelity synthetic proof sequence; no dashboard suite, no fake
  live integrations, no graph spectacle.
- Policy and review appear as behavior; no unearned badge, certification,
  award, analyst, or logo bands. No feature-parity or competitor tables.
- No pricing or ROI content of any kind.
- Reference-corpus material (fonts, screenshots, palettes, compositions) is
  observation only; production assets are original or license-verified per
  ASSET-PLAN, with raster provenance embedded.
- The five binding raises are requirements: numbered record addressing; one
  typographic voice per actor; superseded intent ghosts with its date, never
  deleted; on-screen hierarchy by phosphor density in one ink; a measured
  grid with instrument state words and no chart-readable traces.
- Every screen passage renders under the synthetic-demonstration label; the
  receipt names the deterministic fixture producer ("no live model ran").
- The CTA ships against the `[walkthrough-email]` placeholder until Benjamin
  supplies the address; never invent one.
- Accessibility: WCAG AA contrast on shipped amber/near-black pairs,
  keyboard-driven record inspector, visible focus, reduced-motion collapse to
  settled states, session readable without JS, responsive from 360px.
- Dev servers only through the portless script (`bun run dev` →
  `http://todox.beep.localhost:1355`); never raw `next dev`.
- Impeccable discipline: direction contract in the root layout before build,
  detector once at finish, shipped finish reviewer and documenter, DESIGN.md
  from the built world.
- Gesture-bearing milestones (record inspector, passage transitions) carry
  recorded browser-QA evidence (`bun run beep qa`).

## Decision Log

Full entries live in the exploration's
[`DECISIONS.md`](../../explorations/todox-wealth-management-site/DECISIONS.md).

| Date | Decision |
| --- | --- |
| 2026-08-27 | Vision-only concept; no availability or adoption claims. |
| 2026-08-27 | Public category site; researched accounts and individuals never named or implied. |
| 2026-08-27 | Flagship story: client index → meeting-preparation packet. |
| 2026-08-27 | "Local-first" rendered as firm-controlled authority + bounded approved model calls; no offline absolutes. |
| 2026-08-27 | One narrative in `apps/todox`; primary action "Request a private walkthrough." |
| 2026-08-27 | Fable owns design via Impeccable; human locks direction. |
| 2026-08-27 | `apps/todox/PRODUCT.md` confirmed; Todox at todox.ai; email-contact CTA. |
| 2026-08-27 | Direction locked: **Terminal of Record** (seed `9ce5e740`); alternates on record. |
| 2026-08-27 | Shape brief confirmed without corrections. |
| 2026-08-27 | CTA address deferred to build as `[walkthrough-email]`. |
| 2026-08-27 | Graduated; PR publication deferred — repo contention; wait for Benjamin's explicit go. |

## Acceptance Criteria

- [ ] The homepage renders the seven-passage sequence from SHAPE-BRIEF with
      the exact DEMO-SCRIPT session and PUBLIC-COPY prose.
- [ ] Every factual public assertion resolves through the PUBLIC-COPY
      reconciliation (claim record, framing, or concept tense); copy edits
      re-ran the reconciliation.
- [ ] The five binding raises are implemented and visible in the page.
- [ ] Synthetic labeling: no screen state could be mistaken for client data,
      a live system, or a measured result.
- [ ] Direction contract present in the root layout and it survives the
      production build; DESIGN.md written at finish from the built world;
      finish review closed on the reviewer's disposition.
- [ ] Accessibility and fallback constraints verified (AA contrast, keyboard,
      reduced-motion, no-JS, 360px+), with real-browser QA evidence for the
      record inspector.
- [ ] Typeface licenses verified and recorded; every shipped raster carries
      provenance; no reference-corpus asset in production.
- [ ] `bun run --cwd apps/todox audit` green (build, check, test, lint).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| App audit | `bun run --cwd apps/todox audit` | Passes |
| Packet launcher size | `test "$(wc -m < goals/todox-marketing-site/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/todox-marketing-site/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/todox-marketing-site` | Passes |
| Design detector | `node .claude/skills/impeccable/scripts/detect.mjs --json <changed targets>` (once, at finish) | Findings fixed or handed to reviewer |
| Browser QA | `bun run beep qa` record → extract → judge | Zero required findings |
| Reflection lint | `bun run beep lint reflection-artifacts` | Passes at P4 |

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope (new routes, backend, extra
  packages).
- A claim cannot be carried by the ledger and concept tense; stop and revise
  copy through the reconciliation rather than shipping it.
- **Do not run `yeet publish` or open a PR until Benjamin explicitly
  green-lights publication** (2026-08-27: deferred, repo contention). Local
  proof may proceed; P3 waits.
- Verification requires unnamed credentials, cost, destructive side effects,
  or policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| `[walkthrough-email]` placeholder in shipped copy | CTA mailto target | Benjamin | Mailbox not provisioned; address is a build-time value | Benjamin supplies the address; swap and re-run copy reconciliation |
