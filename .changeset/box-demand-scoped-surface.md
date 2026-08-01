---
"@beep/box": patch
---

Scope the generated Box SDK surface to declared demand instead of the full 85-manager `BoxClient`. A new manifest at `scripts/box.surface.ts` lists the 9 wrapped managers, and the generator now emits only those operations plus the model schemas transitively reachable from them and from the driver's own hand-written sources.

Generating the whole SDK cost ~4.8M TypeScript type instantiations in `Box.models.gen.ts` alone (~7.5M package-wide) for a repo that calls 9 managers — mass that kept exposing the no-location TS2589 native-compiler flake in full proofs. The package now costs ~2.5M instantiations (-66.5%), and the generated file drops from 88,709 to 9,822 lines with its own contribution down 89%.

A manager outside the manifest has no generated operations, so calling it is a compile error rather than a runtime failure; adding one is a manifest edit plus `bun run generate`. The generator also no longer assumes `node_modules` sits in the repo root, so it works from a git worktree.
