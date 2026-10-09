# Vendored: CommonMark spec conformance corpus

- **Upstream:** [commonmark/commonmark-spec](https://github.com/commonmark/commonmark-spec)
- **Tag:** `0.31.2`
- **Commit:** `9103e341a973013013bb1a80e13567007c5cef6f`
- **License:** CC-BY-SA 4.0 (spec text and embedded examples)
- **Vendored via:** `.repos/commonmark-spec` (git submodule, sparse checkout of `spec.txt`, `test/`, `LICENSE`)

## What this is

`spec.json` is the 652-example conformance corpus embedded in the CommonMark
0.31.2 spec (`spec.txt`), extracted verbatim with the upstream tooling:

```sh
python3 .repos/commonmark-spec/test/spec_tests.py \
  --spec .repos/commonmark-spec/spec.txt \
  --dump-tests > packages/markdown/__test__/fixtures/commonmark/spec.json
```

Each entry is `{ markdown, html, example, start_line, end_line, section }` —
the exact shape `spec_tests.py --dump-tests` produces; `corpus.ts` narrows it
to the package's `SpecExample` shape.

## Attribution posture

Test-only vendoring. `spec.json` is generated data consumed exclusively by
`__test__/e2e/`, never shipped in the published package artifact. The
CC-BY-SA 4.0 license on the spec text is satisfied by this attribution file
and the upstream link above; regenerate `spec.json` with the command above if
the pinned `commonmark-spec` submodule ref ever changes — never hand-edit it.
