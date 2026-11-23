# Opportunities and friction receipts

## 2026-11-22: the delete-comment brief needs the strict T test up front

- Doing: wave 1 classification (semver, npm-spec, csv, spdx, managed-section; 1,199 rows), an Opus 5.5 child and a Codex Sol lane.
- Evidence: round 1 disagreed on 18-51% of the rows either side called T or G (31 H->T, 18 N->T, 14 T->N, 12 H->G); both vote sets were discarded. The causes were blank `//` paragraph lines voted G, and "why this test exists" sentences voted T.
- Prevention: put the round-2 rules in `.claude/skills/delete-comment/references/rubric.md` itself: blank paragraph lines take the paragraph's code, a T vote names what restates it, G only for labels. Round 2 then reached kappa 0.78.

## 2026-11-22: the strip yields about 10% of a package; the rest waits on absorption

- Doing: wave 1 apply.
- Evidence: 116 of 1,199 rows deleted (T 28, G 71, D 17); 1,000+ rows agreed H or N and stay under the pending list.
- Prevention: nothing to prevent; it sizes the work. The SPEC acceptance (pending list empty) needs absorption PRs, which change code and carry tests, far beyond the strip.

## 2026-11-22: `beep decisions check` ignores untracked decision files

- Doing: writing the first package decision file.
- Evidence: `decisions check` printed `decisions: 0` until the file was `git add`ed.
- Prevention: say in the delete-comment skill step 3 that the file must be staged before `decisions check` sees it.
