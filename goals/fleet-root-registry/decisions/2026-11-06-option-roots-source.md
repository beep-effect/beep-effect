---
title: "Caller-supplied roots are their own source, and fleetRoot stays a derived single root"
date: 2026-11-06
lane: "feat/fleet-root-registry"
reversal: "Drop option from FleetRootsSource and label FleetScanOptions.roots as env."
---

FleetScanOptions gains roots (non-empty FleetRootEntry list) with precedence roots, fleetRoot, BEEP_FLEET_ROOTS, roots.json, derived. FleetRootsSource gains option for the first so --join can say where the list came from. The existing fleetRoot option keeps its one-unfiltered-root meaning and the derived discovery rules, so existing tests and callers are unchanged.
