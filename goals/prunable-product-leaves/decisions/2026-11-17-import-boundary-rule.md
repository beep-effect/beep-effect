---
title: "Kept packages may not depend on product leaves; the rule ships with seam 2 and an allowlist"
date: 2026-11-17
lane: "feat/prunable-product-leaves"
reversal: "Delete the rule and its allowlist; the seams stay merged."
---

Operator decision, 2026-11-17. Tooling (packages/tooling/**), foundation (packages/foundation/**) and the generic slices agents, epistemic, party, execution-authority and shared may not depend on a product leaf: packages/law-practice/*, packages/documents/*, packages/workspace/*, packages/architecture-lab/* and the drivers eyecite, govinfo, ecfr, gov-legal-mcp, pacer, uspto, uspto-mcp, hubspot, freshbooks, box, box-provisioning, m365 and m365-mcp. The rule covers manifest edges (dependencies, devDependencies, peerDependencies) and source and test imports, so a test-only edge cannot hide behind a devDependency. Agent call on the ratchet: the rule ships with seam 2, the first seam that removes import edges, so no new edge lands while seams 3 and 4 are open. It carries an explicit allowlist of the remaining edges (party-server to m365 for seam 3; agents-use-cases to workspace-domain and workspace-use-cases, agents-client to workspace-use-cases for seam 4), each row naming its seam. Seams 3 and 4 delete their rows; seam 4 leaves it empty. packages/_internal/db-admin is outside the guarded set: it aggregates product tables by doctrine.
