# Dock React scoped graph ownership proof

The saved Dock React inventory is the next dependency-ready batch: 14 findings
across four test files plus the DOM setup fixture. Its four resource proposals
identify graphs disposed only after successful assertions. No global human
remainder census was taken. Before-edit Node and Bun runs each pass all 30 tests
with zero skips, stable source hashes and recorded load/pressure context.

Five existing graph-construction sites now use `Effect.acquireRelease`, so
cleanup is registered before render, resize or awaited DOM work. Native Effect
test scopes own the returned graph. Two sequential scenarios retain their
intermediate disposal points through short inner scopes: the missing-renderer
graph closes before the watermark graph, and the left-edge graph closes before
cleanup and the bottom-edge graph. React cleanup and StrictMode nonownership
assertions remain in their original positions. Three now-unused result bindings
were removed without removing their graph acquisition.

AST conservation preserves all 224 nested assertion-expression nodes and all
30 named test registrations. Temporary probes observe all 32 graphs and their
registries disposed exactly once, and earlier graphs already disposed before a
second construction in the same test. A forced setup failure immediately after
acquisition in Floating closes the revised graph and registry; the old setup
leaves both undisposed. The intentional failure remains a failure in both
variants. All probe mutations were restored.

Full package verification passes audit (8.2 s) and docgen (3.3 s). This is scoped
resource evidence in the configured jsdom adapter environment. It does not prove
native browser pointer capture, visual behavior or overall package completion.
Assertions, the below-minimum resize witness, runner integration, final timing
and ledger reconciliation remain.
