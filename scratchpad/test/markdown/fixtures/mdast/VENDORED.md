# Vendored: mdast-util-from-markdown interop fixture corpus

- **Upstream:** [syntax-tree/mdast-util-from-markdown](https://github.com/syntax-tree/mdast-util-from-markdown)
- **Tag:** `2.0.3`
- **Commit:** `f9ef1b3` (the `.repos/mdast-util-from-markdown` pin)
- **License:** MIT
- **Vendored via:** `.repos/mdast-util-from-markdown` (git submodule, sparse checkout including `test/fixtures/`)

## What this is

The 27 position-complete `.md`/`.json` fixture pairs from upstream's
`test/fixtures/` directory, copied verbatim (54 files). Each `.json` is the
mdast tree `mdast-util-from-markdown@2.0.3` produces for its `.md` sibling,
with full unist positions (`line`/`column`/`offset`) on every node — the
reference emission the remark ecosystem consumes.

`__test__/e2e/mdast-interop.e2e.test.ts` parses each `.md` with this
package's parser, projects the tree through `Mdast.toMdast`, and asserts
deep equality against the `.json` sibling, positions included — AST-plus-
position interop evidence, strictly stronger than render equivalence.

The fixtures exercise CommonMark shapes only (upstream's core has no GFM
extensions loaded), so the harness parses them under `dialect: "commonmark"`
with frontmatter capture off — matching the configuration upstream used to
generate the `.json` files.

## Attribution posture

Test-only vendoring. The fixtures are consumed exclusively by `__test__/`,
never shipped in the published package artifact. The MIT license on the
upstream repository is satisfied by this attribution file and the upstream
link above; refresh the copies from the pinned submodule if the
`.repos/mdast-util-from-markdown` ref ever changes — never hand-edit them.
