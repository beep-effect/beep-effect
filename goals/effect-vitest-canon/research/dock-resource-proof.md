# Dock registry lifetime proof

The two reactive geometry cases and the derived-recency case now have separate
native `it.layer(Layer.fresh(AtomRegistry.layer))` registrations. Each reads the
public registry service. The upstream layer disposes its registry when its scope
closes. Existing graph-owned lifetimes and Minima mount/release scopes remain
unchanged in this resource phase.

All 54 original assertions and 25 registrations in Geometry and Recency are
preserved. Full `@beep/dock` package verification passes audit (7.2 s) and
docgen (3.3 s).

A temporary lifecycle probe captures each registry and checks after suite
teardown that accessing an atom throws because the registry is disposed. The
scoped version passes both files and all 25 tests. Replacing only the service
reads with unclosed `AtomRegistry.make()` instances leaves all 25 original tests
passing but fails both teardown probes: accessing the registry does not throw.
This distinguishes actual disposal from merely choosing a layer-shaped API.
All probe and control edits were restored. No native UI resource-leak claim is
made, and no timeout was widened.
