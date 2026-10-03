# Yeet inbox hook adapter test migration

Source: `318551c4690c7c06c05beb499bc0628ec39b4355`.

The nine native shell-hook scenarios now register through `it.layer(NodeServices.layer)` and `it.effect`. The temporary roots are acquired with `FileSystem.makeTempDirectoryScoped` before fallible seeding. Completed hook answers are asserted directly; the prior retry loop could conceal a wrong first response. The real Node layer remains necessary to exercise child processes, Git, native paths, symlinks, modes, and exclusive creation. No in-memory filesystem qualification is claimed.

Focused proof at the source commit: Node 9/9 and Bun 9/9. Required `bun run beep quality package-verify @beep/repo-cli` passed, with audit 747.3 seconds and docgen 21.0 seconds. The named root `bun run beep quality test-tsgo` gate passed. Full `bun run beep lint effect-vitest` scanned 1,231 files and found 1,995 findings with zero introduced and zero resolved after baseline reconciliation.

Inventory reconciliation preserves historical detector EV001 and EV003 as fixed, EV010 as a reasoned native-platform exception, resource L-RES-02 and flake L-FLAKE-06 as fixed, and the prior EV011 fix. The property and observability `NONE` rows remain open coverage judgments. Two obsolete EV002 baseline occurrences in cache census and cache dispatch were removed after confirming their current detector absence; their original IDs and evidence were retained as fixed historical detector ledger rows. This proof covers this file and those two stale baseline entries, not the remaining goal inventory or hosted PR gates.
