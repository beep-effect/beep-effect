---
{}
---

No release: stop the coverage ratchet failing on deleted covered code, and stop
a filtered baseline write from deleting the baseline.

The gate compared percentages only, and a percentage falls for two opposite
reasons. Adding untested code lowers it, which is a regression. Removing tested
code lowers it too, and that is not one — no test lost its subject, the subject
was deleted. So the gate fired on code removal and taxed every migration that
shrinks a package. The counts that tell those apart were already parsed and
discarded, so the baseline now records the uncovered count per metric and a
metric fails only when its percentage dropped **and** its uncovered count rose.

`uncovered` is optional, so existing baselines still decode and fall back to the
percentage-only rule, which is the stricter of the two. Counts fill in as
packages are rebaselined rather than needing one repo-wide rewrite.

Separately, `coverage:baseline:write --filter=X` used to write a baseline
containing only `X` and silently delete every other entry, because the document
was rebuilt from the current snapshot with no merge. Writes are now scoped-aware:
a scoped run merges over the committed document, an unscoped run still replaces
so deleted packages are pruned, and an unscoped run that measured fewer packages
than it is replacing is refused instead of written.
