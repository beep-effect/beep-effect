# GOAL: Prove and ship tracked-changes ingest

Outcome: U4 determines whether OOXML insertions/deletions survive the
Pandoc-to-canonical Md seam, and the smallest evidence-backed semantic
representation or explicit structural fallback ships.

Read this packet, the Harvey exploration, the live Pandoc/Md/file-processing
seams, and the sibling eval goal first.

P0 is a hard kill-gate. Freeze a `w:ins`/`w:del` fixture and trace identity,
content, context, and order at OOXML, Pandoc, and canonical Md boundaries. If
semantic preservation fails hard, stop semantic implementation and record/use
the explicit structural representation; do not press ahead without a new
operator decision.

Test synthetic C&H first through `effect-native-legal-eval`. Any later real
OIP data room stays out of the repo, out of telemetry, and out of shared C&H
mounts. Provider choice is configuration, not a constraint.

Do not add a generator, DMS taxonomy, broad DOCX redesign, or duplicate eval
framework. Publish the proven minimal rung through Yeet and close with a
reflection.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug tracked-changes-ingest-wedge` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/tracked-changes-ingest-wedge/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
