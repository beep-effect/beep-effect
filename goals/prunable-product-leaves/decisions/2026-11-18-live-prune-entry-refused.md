---
title: "A prune entry that names a live path makes the checkout inventory read fail"
date: 2026-11-18
lane: "feat/prunable-seam-1b"
reversal: "Record the findings on the inventory and report them from one dedicated check instead of failing the read."
---

The checkout prune declaration decision makes a prune entry that matches a live path outside every keep entry a finding. Agent call on where it surfaces: loadCheckoutInventory refuses such a declaration with CheckoutPruneFindingsError, naming each entry and the first live path it matches, so no tolerant surface consults a declaration that claims what the checkout still holds. Live paths are the working-tree files a prune entry matches (each entry expanded with the git glob rules, files only, without following symbolic links or descending into node_modules or .git), the roots of present packets and the directories of discovered workspaces; a prune entry whose packageName workspace discovery finds is a finding too. The knowledge doctor resolves the same rule over the tracked files and directories of the tree it checks. Because of the refusal, a repository path a prune entry matches is gone whenever an inventory exists, which is what lets RepositoryPathSubject be judged without reading the file again. Owned and keep entries match live paths by design and are never findings. A present file at the declaration path that does not decode, an unknown key included, fails the read the same way (CheckoutPruneDeclarationError).
