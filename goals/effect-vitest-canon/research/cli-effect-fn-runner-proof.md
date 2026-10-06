# Effect-fn native scratch-project runner migration — 2026-10-06

Source commit `458ef7defe` keeps the four law/CLI subjects and their assertions
while replacing `Effect.runPromise` and the custom scoped-layer builder with
runner-owned `it.effect` and fresh `it.layer` scopes. Each test builds a real
temporary cwd through `Layer.effectDiscard`; `makeTempDirectoryScoped` and a
finalizer restore the original cwd before removing the fixture. The former
`acquireUseRelease` wrapper is gone.

The laws use TSMorph against real scratch files. The CLI assertion launches a
real Bun subprocess in the temporary cwd. NodeServices therefore remains a
reviewed EV010 native-subject exception; MemoryFileSystem would not test that
behavior. Four focused tests pass on Node and Bun, direct CLI test-project
typechecking exits zero, and Biome checks the source. The detector has 1,919
current findings, six fewer than the previous accepted baseline, with none
introduced. The six historical EV001/EV003 IDs retain their original evidence
and now point to the source commit; the EV010 ID retains its identity and has
an explicit exception reason. Full package and hosted proof are pending.

If the scoped layer changes observable cwd or cleanup behavior, revert the
source, generated baseline, and seven ledger dispositions together. Rerun the
Node/Bun cases, test-project typecheck, detector, and full package proof; do
not replace or renumber historical IDs.
