# Synthetic-demo script — Terminal of Record session

Decompose deliverable, 2026-08-27. The exact screenplay for the homepage's
screen passages, so the build reproduces one deterministic session instead of
improvising records. Grounded in the canonical fixture at
`goals/agentic-professional-runtime/fixtures/runtime-data-loop/wealth-cash-request`
(claim-proof-is-deterministic-synthetic). Records marked **[fixture]** come
from that fixture's expected outputs; records marked **[authored]** are new
synthetic content written at production fidelity for the demonstration, per
the labeling rule in `PRODUCT-TRUTH.md`. Every screen passage renders under
the persistent status-row label `Synthetic demonstration — no client data.`

## Cast and provenance

| Display | Underlying id | Provenance |
| --- | --- | --- |
| Park household | `household-park-family` | [fixture] |
| Mira Park (client) | `client-mira-park` | [fixture] |
| Tia Rowan (advisor, reviewer) | `principal-user-wealth-tia-rowan` | [fixture] |
| FIXTURE RUNTIME (producer) | `principal-agent-runtime-fixture` | [fixture] |
| Taxable account ····4421 | `account-park-taxable-4421` | [fixture] |

The producer renders as `FIXTURE RUNTIME (DETERMINISTIC · NO LIVE MODEL)` in
every receipt. That honesty line is content, not chrome; do not soften it.

## Display record numbering

Stable visible record numbers (binding raise: numbered record addressing).
Fixture ids stay in the record detail view for traceability.

| Display no. | Underlying id | Kind |
| --- | --- | --- |
| SRC 0001 | `wealth-cash-email-001` | source artifact (email) |
| SRC 0001·S1…S6 | `wealth-email-001-s1…s6` | source spans |
| SRC 0000 | `wealth-call-note-000` | source artifact (call note) [authored] |
| CLM 0099 | `claim-wealth-fund-from-taxable-000` | prior intent [authored] |
| CLM 0101 | `claim-wealth-cash-need-001` | client cash need [fixture] |
| CLM 0102 | `claim-wealth-taxable-account-source-001` | client assumption [fixture] |
| CLM 0103 | `claim-wealth-tax-sensitivity-001` | client preference [fixture] |
| CLM 0104 | `claim-wealth-misread-sale-intent-004` | wrong model output [authored] |
| TSK 0201 | `task-wealth-review-liquidity-001` | task [fixture] |
| TSK 0202 | `task-wealth-schedule-friday-call-001` | task [fixture] |
| TSK 0203 | `task-wealth-confirm-no-movement-001` | task [fixture] |
| DRF 0301 | client acknowledgement draft | draft [fixture] |
| GTE 0401 | `approval-wealth-cash-request-001` | approval gate [fixture] |
| PKT 0501 | context packet | bounded context packet [fixture] |

## Session clock

Authored deterministic clock: session date **Tue 2026-04-14**, first event
09:41. The email's own facts (about $150,000 by June 3, 2026; a Friday call)
are fixture-canonical; the Friday call resolves to 2026-04-17. All timestamps
are fixed so the page replays identically on every visit.

## Beat 1 — hero: a source lands (screen)

1. Status row on: `TODOX · TERMINAL OF RECORD · Synthetic demonstration — no client data. · 2026-04-14 09:41`
2. `SRC 0001` posts: `EMAIL · Mira Park → Tia Rowan · "Cash for the renovation deposit"`.
3. Span `S2` highlights in the source pane, verbatim from the fixture body:
   "We need to have about $150,000 available by June 3, 2026 for the
   renovation deposit we mentioned during our last planning call."
4. `CLM 0101` posts in the record pane: statement "The Park household needs
   about $150,000 available by June 3, 2026." · state `CANDIDATE` ·
   evidence `SRC 0001·S2` · confidence `HIGH` · producer `FIXTURE RUNTIME`.
5. `TSK 0201` posts: "Review liquidity options for the Park cash need" ·
   state `CANDIDATE` · evidence `SRC 0001·S2,S3`.
6. Cursor rests on `CLM 0101`. The translation line and CTA function keys
   render per PUBLIC-COPY Passage 1.

Reduced motion: all five records render settled, no typing or sweep effects;
the highlight is static.

## Beat 2 — printout: the problem (no records)

PUBLIC-COPY Passage 2 on fanfold. No synthetic records appear, so no label
is needed beyond the page's standing footer; the passage's last line hands
back to the screen.

## Beat 3 — supersession (screen) [authored extension]

Premise consistent with claim-supersession-preserves-changed-intent (model
intent). Authored records:

1. Context strip shows the prior record: `CLM 0099` · "Fund the renovation
   deposit from taxable ····4421." · source `SRC 0000` (planning-call note,
   2026-03-06) · state `ACCEPTED (SCOPED)`.
2. Span `S3` of `SRC 0001` highlights: "I was assuming it could come from
   the taxable account ending in 4421, but I want to avoid creating a messy
   tax situation if there is a better way to source it."
3. `CLM 0102` (assumption) and `CLM 0103` (tax-sensitivity preference) post
   as `CANDIDATE`, evidence `SRC 0001·S3`.
4. `CLM 0099` transitions to `SUPERSEDED · 2026-04-14 · by CLM 0103`. It
   ghosts (reduced phosphor density), stays in place, keeps its date, source,
   and prior state. The chain line renders: `CLM 0099 ⟶ CLM 0103`.

Binding raise honored: superseded intent ghosts with its date, never
deletes.

## Beat 4 — review at the gate (screen)

1. `GTE 0401` opens: reviewer `Tia Rowan` · state `PENDING` · policy basis,
   fixture-verbatim: "Advisor approval is required before accepting
   client-intent claims, creating authoritative tasks, or sending a
   client-facing draft."
2. Requested actions listed from the fixture gate: accept or edit candidate
   claims, accept or edit candidate tasks, approve or revise the client
   email draft.
3. Dispositions (authored review pass, consistent with the fixture's pending
   gate; the page presents them as the reviewed continuation of the same
   synthetic session):
   - `CLM 0101` → `ACCEPTED (SCOPED)` · reviewer Tia Rowan · 10:02.
   - `CLM 0103` → `ACCEPTED (SCOPED)` · 10:02.
   - `CLM 0104` (wrong model output, authored): "Mira intends to sell the
     ····4421 position." → `REJECTED` · note "Not supported by span S3." ·
     record retained on screen in rejected state.
   - `TSK 0202` → title edited by reviewer to "Confirm Friday 2026-04-17
     call with Mira" · `ACCEPTED (SCOPED)`.
   - `DRF 0301` (client acknowledgement draft) → stays `PENDING` at the
     gate. It is never shown as sent. This is the action boundary.
4. PUBLIC-COPY Passage 4 lines render beside the gate.

Beat honors claim-wealth-review-required, claim-acceptance-is-not-truth,
claim-rejected-work-preserved-by-policy (design intent), and the FABLE-SEED
requirement that a wrong output stays a candidate or rejected record rather
than silently entering the record.

## Beat 5 — printout: objections (no records)

PUBLIC-COPY Passage 5 on fanfold.

## Beat 6 — the packet and the receipt (screen)

1. `PKT 0501` assembles for the 2026-04-17 call, sections in order: WHAT
   CHANGED (CLM 0101, supersession chain) · CURRENT GOALS AND CONSTRAINTS
   (CLM 0103) · OPEN DECISIONS (funding source under review, TSK 0201) · IN
   YOUR COURT (TSK 0201, TSK 0202, TSK 0203) · SOURCE-BACKED QUESTIONS
   (each question cites its span) · EXCLUDED, fixture-verbatim exclusions:
   portfolio or custodian state; external money-movement instructions; an
   accepted financial recommendation.
2. Record inspector (focal moment): cursor on the WHAT CHANGED assertion
   opens a split pane: left, `SRC 0001·S2` verbatim with highlight; right,
   the receipt for `CLM 0101`:
   `REQUESTED ACTION: accept_or_edit_candidate_claims` ·
   `REVIEWER: Tia Rowan` · `CANDIDATE REF: CLM 0101` ·
   `EVIDENCE: SRC 0001·S2` · `POLICY BASIS: advisor approval required` ·
   `STATE: ACCEPTED (SCOPED)` · `TIME: 2026-04-14 10:02` ·
   `PRODUCER: FIXTURE RUNTIME (DETERMINISTIC · NO LIVE MODEL)`.
3. PUBLIC-COPY Passage 6 lines render beneath.

Receipt fields follow claim-approval-gate-fields; exclusions follow
claim-fixture-context-excludes-actions-and-recommendation.

## Beat 7 — printout: sign-off (no records)

PUBLIC-COPY Passage 7 on fanfold: where-this-stands block, printed sign-off
form, `[ F9 ]` CTA, qualification footer.

## Global interaction and accessibility notes

- Keyboard: arrow keys move the record cursor within a screen passage; Enter
  opens the record inspector; Escape closes it. Pointer clicks mirror this.
  Focus is the terminal cursor, visible at WCAG contrast.
- Every state word on screen comes from the instrument vocabulary:
  `CANDIDATE`, `NEEDS REVIEW`, `ACCEPTED (SCOPED)`, `REJECTED`,
  `SUPERSEDED`, `SOURCE UNAVAILABLE`, `CONFLICTING EVIDENCE`, `PENDING`.
- No waveform, sparkline, or chart-like trace appears anywhere in the
  session (binding raise; also avoids implied market performance).
- Reduced motion: beats render as settled states; transitions become cuts.
- No JS: the session renders as static, fully readable records in final
  state, in beat order.

## What this script does not authorize

No live model call, no real client data, no connector, no send action, no
recommendation, and no reuse of these records as customer proof. Any change
to record content re-runs the PUBLIC-COPY claim reconciliation.
