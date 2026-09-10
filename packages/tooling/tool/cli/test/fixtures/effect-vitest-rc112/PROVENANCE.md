# Effect Vitest rc.112 portable coverage fixture

This fixture copies source from `@effect/vitest@4.0.0-rc.112` at commit
`2600f62f4532026928454dcea8d1c48557b3f942`. The copied work is licensed under
the adjacent upstream `LICENSE`.

The complete `packages/vitest/src/index.ts` and `packages/vitest/src/utils.ts`
snapshots are retained byte-for-byte as `index.ts.txt` and `utils.ts.txt`, so
package lint treats them as data while coverage tests parse them using their
original upstream paths. The complete `packages/vitest/README.md` is also
retained for the independently derived README-heading inventory. The `charter/*.txt` files
retain only the exact declarations used by the four review charters, annotated
with their original source ranges and complete upstream-file SHA-256 values.

| File | SHA-256 |
| --- | --- |
| `packages/vitest/src/index.ts` (stored as `index.ts.txt`) | `17cdaedfc5a7399d5e2a31aafc96c17c691e5943744b0e8785ca9008a7e1c1a3` |
| `packages/vitest/src/utils.ts` (stored as `utils.ts.txt`) | `8f06a466264a64a6ccb3e8e37aab8ade003d627e21c9589d2b622d2a3a43f6c3` |
| `packages/vitest/README.md` | `6a6293bd3d6b46d6882ea80816f3df360b47fea571324fef19325e723f68c531` |
| `LICENSE` | `774c3bc5924ad8ae6c5a75f1c53db13feb238ade15989625c513d07b60dedf30` |

The fixture deliberately does not depend on a workstation cache path or a live
Effect checkout, so the same coverage proof runs in CI.
