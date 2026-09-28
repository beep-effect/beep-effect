# Practice KG MCP P2 proof

The same production manifest-loader cases now run against native Bun filesystem
services and MemoryFileSystem through public layers with explicit ten-second
hook budgets. Independent scoped temporary roots, path joining, optional corpus
roots, missing-file errors and malformed JSON remain. The native adapter was not
replaced. This suite covers loading before database startup, not MCP transport,
SQL engines or a compiled binary.

A new parseable `{}` case requires the exact typed invalid-manifest diagnostic.
A controlled regression that substitutes a valid manifest for `{}` passes the
original suite and fails the new cases on both adapters. Production source is
restored afterward; no production decoder repair was needed.

All three current test files use the instrumented runner, including the adjacent
smoke-module import test. Its import remains a module-load assertion and does not
claim compiled-host execution. AST preservation accounts for 13 original
assertions, seven original titles and ten selected fixture initializers, with
original deadlines intact. A temporary deliberate-failure probe proves default
trace silence and opt-in case/start/failure/duration output; the probe is removed.

The final package audit and Docgen pass. Node and Bun each pass all 12 tests with
stable source hashes. Baseline: seven passes, no skips; final: twelve passes, no
skips. Whole-command timings are Node 6.0236 to 5.1247 seconds and Bun 4.0706 to
2.4685 seconds. Receipts record process limits, host load, pressure, versions and
source hashes; different case populations and cache/host state prevent a causal
speedup claim.

Four current detector candidates have specific judgments: three immediately
asserted typed failure Results and the deliberately retained native adapter.
Runner dependency review changes seven owned dependency lists, preserving all
unrelated cache configuration and qualification. Saved-ledger reconciliation closes all ten saved action items and accounts for
12 historical detector records. The four current exceptions remain explicit.
The census now includes all three test files, including the smoke-module test
added on main, with a four-lens review. All 683 unrelated ledger hashes and
unrelated root/census objects are preserved. Strict root, ledger, census and
timing schemas pass; no owned action row remains open.

Four public timing/context artifacts retain Node/Bun outcomes and workstation
load receipts. Every recorded source hash was checked against baseline
`7f21ee48fd863f969bbf823d1cd0b916224a230c` and source repair
`3f47e60b0f5ea0f32163f2964b30baa4983e3a94`, following tracked symlink targets.
Hosted readiness remains a separate gate.
