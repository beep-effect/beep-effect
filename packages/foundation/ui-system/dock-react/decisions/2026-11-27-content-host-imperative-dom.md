---
title: ContentHost re-parents panel portal targets imperatively
date: 2026-11-27
reversal: Render each group's panel targets as a keyed child collection owned by Atom once Atom provides one, and delete the imperative appendChild/remove pass in ContentHost.
governs:
  - src/internal/PanelHost.tsx#ContentHost
enforcedBy: []
---

ContentHost's ref callback appends each panel's cached portal target (`targetFor`, one `div` per panel in `AdapterState.targets`) to the group's host element, and removes the targets it no longer shows. The DOM ownership stays explicit at this lifecycle boundary.
Reason: PanelPortal renders panel content into that stable target with `createPortal`, so moving the target between group hosts keeps the panel's React subtree and its state mounted.
Rejected: rendering the targets as a keyed React or Atom child collection under each group. React cannot move a keyed child to a different parent without remounting it, so a panel dragged to another group would lose its state, and Atom does not yet own a keyed child collection that could hold the targets across groups.
