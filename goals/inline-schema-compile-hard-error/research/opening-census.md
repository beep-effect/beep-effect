# Opening Census

## Result

The predecessor baseline is reproducible at its evidence commit, and current
`HEAD` has explained positive drift:

| Tree | Findings | Apps | Infra | Packages | Scratchpad |
| --- | ---: | ---: | ---: | ---: | ---: |
| `01d400f0323cfa25cddacdbef4f602e114ff6a17` | 2,931 | 238 | 14 | 2,367 | 312 |
| `39aa4149b7ab794dfa9431441593dec419307541` | 3,087 | 258 | 14 | 2,503 | 312 |
| Drift | +156 | +20 | 0 | +136 | 0 |

The current inventory contains 3,087 line-addressed findings across 566 files
and 105 workspace ownership families. The checked-in JSON records every
finding's compiler, source line, workspace owner, generated/authored status,
and migration shape. Its `byOwnerFamily` object is the P1 no-growth ratchet;
every family must monotonically decrease from those values to zero.

Two consecutive runs on the opening tree produced the same artifact digest:
`a9eba2c851c2c757d67593f12bbdf3f74f9c8d468b832bbb0e844e754cd4a49d`.

## Drift attribution

Comparing per-file rule counts between the reproduced predecessor tree and
current `HEAD` accounts for 160 additions and four removals across 49 files,
for the exact net increase of 156:

| Latest owning commit | Files | Net findings |
| --- | ---: | ---: |
| `09ad07d1fc` `feat(document): enforce semantic conformance (#926)` | 18 | +97 |
| `88fa371cb0` `fix(box): harden provisioning before first apply (#947)` | 10 | +33 |
| `527766b7f6` `feat(semantica): add C2 reasoning canary (#938)` | 4 | +7 |
| `64f2425d2d` `feat(semantica): prove C1 projections (#934)` | 5 | +7 |
| `3babc4cdfd` `feat(repo-cli): add high-quality local person matching (#931)` | 3 | +6 |
| `80380b8da4` `feat(semantica): add evidence quote relation candidate (#923)` | 4 | +6 |
| `1cdce452ae` `fix(ciops): land the six PR-936 review amendments (#940)` | 2 | +4 |
| `7340393945` `feat(semantica): harden artifact and replay models (#913)` | 3 | -4 |

## Migration families

| Shape | Count | Required migration |
| --- | ---: | --- |
| Static schema compiler | 2,978 | Hoist the native compiler result after its module-scope schema dependencies and reuse it at each call site. |
| Nested schema compiler | 106 | Hoist the composed schema and compiler expression together so neither the schema literal nor compiler is rebuilt. |
| Assertion adapter | 3 | Build a module-scope assertion from `SchemaParser.decodeUnknownExit(S.toType(schema))` and preserve `Schema.asserts`' two exact error branches with `Cause` and `SchemaIssue`. |

The compiler distribution is recorded in `opening-census.json`; all 19
observed compiler names are accounted for.

## Migration reconciliation

The zero residual is reconciled against all 3,087 opening findings:

| Disposition | Findings |
| --- | ---: |
| Generator-first HTML repair | 1 |
| Focused codemod proving slices | 62 |
| Bounded safe corpus migration | 2,937 |
| Follow-up hoists after named local schemas moved to module scope | 18 |
| Direct named-schema and compiled-assertion migrations | 54 |
| Dynamic-schema false positives removed with focused rule fixtures | 15 |
| **Total** | **3,087** |

`research/residual-census.json` records zero findings after the rule was
promoted to error. `research/mechanical-migration.json` and
`research/manual-followup-migration.json` retain the codemod accounting; the
manual migrations include the three assertions now compiled through the shared
`@beep/utils/Schema` adapter.

## Generated ownership

Exactly one finding is generated:

| Generated output | Owner | Compiler |
| --- | --- | --- |
| `packages/foundation/modeling/html/src/Html.meta.ts` | `packages/foundation/modeling/html/scripts/generate.ts` | `decodeResult` |

There are zero unresolved generated owners. P1 updated the generator template
before regenerating `Html.meta.ts`. Oxlint ignores conventional
`generated/`, `*.gen.*`, and `scripts/` paths, so the header census is retained
to catch generated outputs such as `Html.meta.ts` that intentionally live on a
governed source path.

The final `bun run generate` proof produced identical hashes before and after
regeneration:

| Generated output | SHA-256 |
| --- | --- |
| `src/Html.model.ts` | `5428e2ac37c33acb85fb917fb7fefefe8b57c640eec97a122c47d2405f40f4bc` |
| `src/Html.meta.ts` | `d5b6c9bc9230bcf22679e517d70f707d98709f1e40c5c6c8a507b6ac9cfe2b1c` |
| `src/internal/Html.language-tag-registry.generated.ts` | `b715b2a88a9a7caade7c729222e8b0c428cdf8169ee6477a8b977de5df3e4d8f` |

## Reproduction

From a checkout at the tree being measured:

```sh
bun goals/inline-schema-compile-hard-error/research/scripts/census.ts \
  goals/inline-schema-compile-hard-error/research/opening-census.json
jq '.summary, .byScope, .byCompiler, .byOwnerFamily, .byMigrationShape' \
  goals/inline-schema-compile-hard-error/research/opening-census.json
```

The predecessor proof used the same installed Oxlint binary and the historical
checkout at `01d400f0323cfa25cddacdbef4f602e114ff6a17`; it returned 2,931 with
the exact 238/14/2,367/312 scope split stored by the predecessor packet.
