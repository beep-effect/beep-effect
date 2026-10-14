# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-10-14

Origin: Notion board item "Explore claude mods for law-practice use-case"
(Development Todo's, status Parking Lot), project name links the
[mods overview](https://code.claude.com/docs/en/plugins/mods/overview).
Its triage brief (grounded on `main` @ `1a4aa495`, 2026-10-06) said:

- Evaluate Claude Code **mods** (plugin system) for a law-practice use case.
- Repo `.claude/settings.json` has an `enabledPlugins` block and one extra
  marketplace (`EveryInc/compound-engineering-plugin`); no mods config or
  directory exists — greenfield.
- `.claude/agents/`, `.claude/skills/`, `.claude/hooks/`, `.claude/helpers/`
  are where law-practice content would land if repo-committed; cloud lanes
  only get repo-committed `.claude/` content.
- `Edit(**/.claude/settings.json)` is deny-listed for agents — config changes
  are operator territory.
- Law-practice surface a mod could feed: goals court-reporter-vocabulary,
  gov-legal-mcp, legal-position-relator-runtime, legal-document-intake,
  effect-native-legal-eval, uspto-mcp, uspto-prosecution-read; explorations
  legal-patent-kg-deepening, legal-ontology-landscape, ip-attorney-time-tracking,
  solo-firm-docketing, practice-office-provisioning,
  gov-legal-data-driver-codegen.
- Live board neighbours: Law Time Capture Spine, Court Reporter Vocabulary,
  Secure Document Delivery (Active); Gov Legal MCP / USPTO MCP
  (completed-retained).
- Proposed done = a written recommendation (an explorations/ packet), not a
  shipped config. Out of scope: editing settings.json, shipping plugins,
  building new legal agents.
- Open questions from the brief:
  - What does "law-practice use case" target: dad's setup, the beep legal
    stack, or a client-facing workflow?
  - Do mods require marketplace access (account/plan) we lack?
  - Does `claude-for-legal` influence mod selection?

Nearest neighbour board item: "Add claude-for-legal to dads claude setup"
(Parking Lot) — body is a single X post link about a "claude-for-legal"
package; its own triage could not resolve what "dads claude setup" means and
suggested it folds into this exploration.

2026-10-14 operator: "Run the exploration" (chose the execution prompt over
grilling the open questions first).
