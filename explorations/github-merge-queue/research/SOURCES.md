# GitHub Merge Queue — Sources & Provenance

<!--
The provenance ledger for this packet. Pre-seeded at capture with the on-disk
sources the capture cites; research extends it.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** time-to-certainty B9, promised by the B8 heavy-check
  admission brief (PR C) and ruling 56 (B8-7).
- **Provenance:** `goals/time-to-certainty/research/b8-brief.md`,
  `goals/time-to-certainty/research/decisions.md` (rulings 56–57),
  `goals/ship-velocity/research/merge-queue-evaluation.md` (E8, 2026-08-27).

## 3. External research sources

- GitHub Docs, "Managing a merge queue" and "Events that trigger workflows"
  (`merge_group`, `checks_requested`), read 2026-09-16; the facts are
  summarized in `CAPTURE.md` under "GitHub facts". No URL is reproduced on
  disk yet; research records the exact pages when it opens.

## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| `HeavyAdmissionSource` (`"merge-group"` reserved), `HeavyAdmissionEventName` (`merge_group`), `decideHeavyAdmission` | `packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts` (`@beep/repo-cli`, on `main` via #1155) | reuse |
| `check.yml` `pull_request`/`push` triggers and per-ref `concurrency` group (main); the `Heavy Admission` job calling `heavy.yml@main` with `admitted` (on `main` via #1155; hosted pass-without-work lanes via #1165) | `.github/workflows/check.yml`, `.github/workflows/heavy.yml` | extend (add `merge_group`) |
| `yeet monitor --until-ready` and the B7 settle loop (on `main` via #1149 and #1155) | `packages/tooling/tool/cli/src/commands/Yeet/internal/Settle.ts`, `.../Yeet/internal/MonitorPolicy.ts`, `.claude/skills/yeet/SKILL.md` | extend (merge-group tail) |
| A5 attempt-journal fingerprints, M4 false-red proxies | `goals/time-to-certainty/research/baseline.md` | reuse (flake budget input) |
| E8 flip-condition measurement query | `goals/ship-velocity/research/merge-queue-evaluation.md` | reuse (re-run) |

## 5. Cross-links & provenance

- Goal packet: `goals/time-to-certainty/` (GOAL.md rule "no merge queue
  before the recorded flip condition"; SPEC.md "Explicitly rejected").
- Sibling exploration: `explorations/pr-event-awareness/` (queue ejection is
  another PR event an orchestrating agent must learn about).
- This packet: `CAPTURE.md` (2026-09-16).
