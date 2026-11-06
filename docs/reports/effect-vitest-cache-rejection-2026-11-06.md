# Effect-Vitest per-file cache qualification

The third Fable audit identified a costly full test-source scan, but its proposed
persistent per-file findings cache was not accepted. No such cache is shipped.

The existing detector resolves imports through the project's module-resolution
host. Recording the contents of successfully resolved local files alone does
not identify every input: an import that currently fails to resolve can begin
resolving when a file is added.

An independent in-memory control called the actual detector twice with identical
test source. The test imports a layer from a missing module. With that module
absent, the detector reports EV014, `resource-layer-without-hook-timeout`, as a
judgment. Adding a module that exports a proven pure `Layer.succeed` removes
that finding without editing the test. There were no provider calls or writes
to the repository inventory. The fixture supplied the detector's required
cryptographic digest service; this was a behavior control, not a timing study.

A key containing only test contents and previously resolved source contents
would miss that change. Any future persistent cache needs a demonstrated model
for failed resolutions, search/configuration inputs and other analysis context,
as well as ordinary dependency-file changes. It must retain the live census,
primitive graph, exceptions and regression comparison.

The observed scan cost remains a useful lead. It does not prove that a safe
per-file cache will improve total time, and no warm-run speedup or memory saving
is claimed. This rejection applies to the proposed persistent key; it does not
rule out separately measured improvements within a single scan.
