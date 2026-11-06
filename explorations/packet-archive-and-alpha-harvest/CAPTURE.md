# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-06

Operator, verbatim intent: months ago we did a goal / exploration packet
consolidation and clean-up. The packets have grown enough that it is time to
run it again. Essentially all `completed-retained` goals should be off `main`,
yet there is a lot of alpha in them: reflections, OPPORTUNITY ledgers, the
project's history. At the same time they bloat the directories, make them hard
to navigate, and could blow up agent context windows. We do not want to
"delete" the goals and abandon them to git history; we want to preserve the
alpha while cleaning up `main`.

Ideas on the table:

- Walk every goal and exploration packet with several providers and agents
  (Opus 5.5 high, Grok 4.7 xhigh, GPT-6.1 Sol medium), extracting the alpha,
  opportunities and reflections; collect everything undone, actionable, or
  repo-improving into one new exploration packet that graduates into concrete
  goals. (Definitely doing this.)
- An archive branch, like the v3 main archive, preserving the packets at a
  point in time.
- A canonical backup location on the workstation and one remote Linux box.

Census at capture (main `a512dac1fb`):

- goals: 270 packets, 16,632 tracked files. 182 completed-retained (10,929
  files, 207 MB), 70 active, 13 paused, 4 reference (2,866 files, 87 MB),
  2 superseded.
- explorations: 100 packets, 12,316 tracked files, 204 MB. 73 graduated,
  18 parked, 8 active, 1 killed.
- Inside completed goals: reflections 291 files / 1.5 MB; OPPORTUNITIES
  ledgers 86 files / 1.9 MB; README/SPEC/PLAN/GOAL 711 files / 5.5 MB;
  `research/` 2,672 files / 66 MB; `history/` 3,603 files / 77 MB.
- 476 links from docs, standards, skills, packages point into
  completed-retained packets (459 into active ones).
- `goals catalog`: completed-retained packets are capability providers that
  active packets require (`observability/attribute-registry` feeds four,
  `box/driver` two, `goals/packet-core` one).
- `goals/README.md` already says removal is an archive operation, not a
  status, and names physical archive moves as a follow-up packet.
- 90 unchecked PLAN.md checkboxes remain across completed goals.
- Prior consolidation: `goals/packet-convention-migration` (2026-08-30
  reflection: exercise every mutation command through the public CLI before
  declaring it reusable; guard same-PR closeout drift).

Operator addendum, same day: friction receipts (the OPPORTUNITIES.md ledger
entries written at the moment of friction) must be harvested; confirm they
are covered.
