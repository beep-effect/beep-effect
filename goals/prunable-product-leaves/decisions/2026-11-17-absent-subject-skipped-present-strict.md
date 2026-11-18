---
title: "An absent subject is skipped and reported; a present subject stays strict"
date: 2026-11-17
lane: "feat/prunable-product-leaves"
reversal: "Remove the presence check from each tolerant surface; every row, exemption and fixture is asserted unconditionally again."
---

Operator decision, 2026-11-17. A census row, law exemption or test fixture whose subject is absent from the checkout is skipped and reported as skipped, not failed. A subject is the packet (goals/<slug> or explorations/<slug>) or the workspace (nearest ancestor with a tracked package.json) a path belongs to; any other path belongs to the repository, which is always present. Keying on the owning packet or workspace, not on the path itself, keeps the full checkout exactly as strict as today: a renamed evidence file or a deleted fixture inside a present packet or workspace still fails, because its subject exists. Each tolerant surface carries a test that simulates an absent subject and one that proves a stale row on a present subject still fails. One shared presence helper serves every surface.
