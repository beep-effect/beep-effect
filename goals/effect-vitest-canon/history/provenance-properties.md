# Provenance property registration phase

Three native Arbitrary.checkEffect/Effect.runSync loops now use public it.prop
registration. All original arbitrary arrays and callback bodies are preserved
verbatim modulo formatting; the run counts remain 50, 50, and 25. The two
TextAnchor properties retain their wire-shape, internal-consistency, equivalence,
and ordered/reversed offset assertions. SourceTextIdentity retains its schema
equivalence round trip.

Full package verification and the 22-test Bun run passed. The final flake,
runner, inventory, timing, and hosted proof phases remain outstanding.
