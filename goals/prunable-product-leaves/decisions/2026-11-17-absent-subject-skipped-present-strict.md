---
title: "An absent subject is skipped and reported; a present subject stays strict"
date: 2026-11-17
lane: "feat/prunable-product-leaves"
reversal: "Remove the presence check from each tolerant surface; every row, exemption and fixture is asserted unconditionally again."
---

Operator decision, 2026-11-17. A census row, law exemption or test fixture whose subject the checkout pruned is skipped and reported as skipped, not failed. Pruned means declared prunable (the product leaves and their packets, @beep/repo-cli-kit/ProductLeaves) and its directory gone; an absent subject nobody declared still fails, so a typo or a rename never reads as pruning (review of #3379). A subject is the packet (goals/<slug> or explorations/<slug>) a path lives in, or a workspace named by its package name, which the surface declares (a census row's consumers, the package that owns a fixture); any other path belongs to the repository, which is always present. Identity never comes from the files the checkout holds: a packet is present when its directory exists, a workspace when workspace discovery finds a member with that name. Keying on the owning packet or package name, not on the path itself, keeps the full checkout exactly as strict as today: a renamed evidence file, a deleted fixture inside a present packet or workspace, or the old path of a package that moved still fails, because its subject exists. Each tolerant surface carries a test that simulates an absent subject and one that proves a stale row on a present subject still fails. One shared presence helper serves every surface.
