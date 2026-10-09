# Vendored yaml-test-suite

Plain-file vendored copy of the official YAML test suite, committed directly
(no git submodule, no nested `.git`) so the compliance harness is
deterministic, offline, and Turbo-cacheable.

- Upstream: <https://github.com/yaml/yaml-test-suite>
- Pinned ref: `6e6c296ae9c9d2d5c4134b4b64d01b29ac19ff6f` (tag `data-2022-01-17`)
- Files: 1,887 (the `data-*` branch layout: one directory per test case)

To update: check out a newer `data-*` tag from upstream, replace this
directory's contents (excluding any `.git`), and update the pinned ref above.
