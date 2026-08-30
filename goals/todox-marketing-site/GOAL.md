# GOAL: Build the Todox Terminal of Record homepage

Repo root: the current working directory — the `beep-effect` checkout you are
running in. All paths below are repo-relative.

Outcome: `apps/todox` serves one responsive public marketing homepage in the
human-locked Terminal of Record direction — claim-gated copy, the exact
deterministic synthetic session, visible synthetic labeling, an Impeccable
direction contract, finish review, and DESIGN.md — proven locally and left
unpublished until Benjamin's explicit go.

This is a compact `/goal` launcher. The packet files are the contract:

- `goals/todox-marketing-site/SPEC.md` (normative)
- `goals/todox-marketing-site/PLAN.md`
- `goals/todox-marketing-site/ops/manifest.json`

Binding design inputs (read before building):

- `explorations/todox-wealth-management-site/research/SHAPE-BRIEF.md`
- `explorations/todox-wealth-management-site/research/PUBLIC-COPY.md`
- `explorations/todox-wealth-management-site/research/DEMO-SCRIPT.md`
- `explorations/todox-wealth-management-site/research/ASSET-PLAN.md`
- `apps/todox/PRODUCT.md`

Then `AGENTS.md`, `CLAUDE.md`, `apps/todox/CLAUDE.md`. Repo standards outrank
packet prose.

Scope:

- In: `apps/todox/**` (src, assets, app config the page needs), app-local
  Impeccable artifacts, the finish-time design-system document, and this
  packet's plan/evidence files.
- Out: other packages or apps; backend, connectors, auth, forms beyond the
  mailto CTA; additional routes; competitor or pricing content; exploration
  edits beyond cross-links; **any yeet publish or PR** (deferred; see
  SPEC.md stop conditions).

Workflow:

1. Load the `impeccable` skill. Write the direction contract into the root
   layout from SHAPE-BRIEF; build code-led with full commitment.
2. Render the exact DEMO-SCRIPT session (records, states, fixed clock) and
   PUBLIC-COPY prose verbatim; any wording change re-runs that file's claim
   reconciliation against `CLAIMS.jsonl` before it ships.
3. Honor the five binding raises and the synthetic-demonstration label on
   every screen passage; the receipt names the deterministic fixture
   producer.
4. Assets per ASSET-PLAN: original SVG/CSS, license-verified faces, raster
   provenance embedded. Nothing from the reference corpus.
5. Dev via `bun run dev` in `apps/todox` (portless). Verify per SPEC:
   detector once at finish, shipped finish reviewer + documenter, recorded
   browser QA (`bun run beep qa`) for the record inspector, WCAG AA,
   reduced-motion, no-JS, 360px+.
6. Keep packet evidence current; at P4 Close write a reflection via
   `/reflect` (lint must pass).

Acceptance:

- [ ] `SPEC.md` acceptance criteria satisfied.
- [ ] `bun run --cwd apps/todox audit` green; QA evidence has zero required
      findings.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
bun run --cwd apps/todox audit
test "$(wc -m < goals/todox-marketing-site/GOAL.md)" -le 4000
jq . goals/todox-marketing-site/ops/manifest.json
git diff --check -- goals/todox-marketing-site
```

Stop and report before adding dependencies, routes, backend, generated files,
or destructive state, and before any publish: P3 waits for Benjamin's
explicit green light.

Done when acceptance passes locally and the packet records the evidence, or
when a blocker is reported with file/command evidence.
