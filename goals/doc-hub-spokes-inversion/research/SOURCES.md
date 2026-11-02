# Doc Hub and Spokes Inversion — Sources & Provenance

- **Source exploration:** `explorations/doc-hub-spokes` — primary ledger:
  [`explorations/doc-hub-spokes/research/SOURCES.md`](../../../explorations/doc-hub-spokes/research/SOURCES.md).

## 1. Mined source corpus

None. This goal moves and re-points repo-owned code.

## 2. Upstream repositories & licenses

None new. `effect` (MIT) is already a dependency.

## 3. External research sources

| Source | Why it matters here |
|--------|---------------------|
| Lens theory (Boomerang; quotient and symmetric lenses), cited in `explorations/doc-hub-spokes/research/notes/positioned_codecs.md` | the formal shape of the fold with a loss ledger; the lens laws are the property tests for the `Doc.Document -> Root` projection |
| Pandoc as a hub-and-spokes precedent (same note) | the pattern this goal completes; losses typed here, not logged |
| FHIR validation locations (model path over XPath), `notes/document_rule_oracles.md` | the hub's source-map contract must serve path-addressed findings (D-08) |

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| `@beep/md` model, behaviors, `SafeDocument`, URL policy | `packages/foundation/modeling/md` | rename to `@beep/doc`; keep |
| `Md.render` string writer | `packages/foundation/modeling/md/src/Md.render.ts` | delete after parity |
| `Md.syntax`, `Md.parse`, `internal/syntax/` | `packages/foundation/modeling/md/src` | move to `@beep/markdown` |
| `Md.html` | `packages/foundation/modeling/md/src/Md.html.ts` | move to `@beep/html` |
| `Markdown.stringify`, fidelity fields, bridge corpus, writer differential | `packages/foundation/modeling/markdown`, `goals/effected-promotion/research/writer-differential-w2d3.md` | reuse; parity oracle |
| Import-boundary test | `packages/foundation/modeling/md/test/Md.import-boundary.test.ts` | invert |
| Lexical and Pandoc projections | `packages/foundation/modeling/lexical`, `packages/foundation/modeling/pandoc-ast` | import rewrite only |
| `SafeDocument` callers | `apps/professional-desktop/src/chat/ui/ComposerPolicy.ts`, `packages/agents/client/src/Chat.atoms.ts` | re-point |
| effected-promotion D-02, D-50 | `goals/effected-promotion/SPEC.md` | amend |
| Package bootstrap and retirement | `bun run beep create-package`, `standards/changesets.retired-packages.json` | reuse |

## 5. Cross-links & provenance

- Exploration: `explorations/doc-hub-spokes` (`DECISIONS.md` D-04, D-08, D-10; `BRIEF.md`
  section C).
- Sibling goal: `goals/oracle-loop-poc` (rewires its imports when the rename lands).
- Parent packet: `goals/effected-promotion` (D-02 layered design, D-38..D-52 bridge and
  writer evidence, D-50 coupling remedy).
