# Node source-corpus qualification and runtime-proof correction

## Correction to the initial Node adapter evidence

The first qualification on 212eaf6275 resolved `node -p process.execPath` inside
`bunx --bun vitest`. That runner can prepend a Node-named Bun shim to PATH.
Adding child-reported runtime identity exposed it: the proposed Node smoke
returned `runtime: "bun"` and the new assertion failed. The earlier mode and
lifecycle observations did not establish Node execution. The implementation
entry existed, but the initial evidence overstated its runtime coverage.

The shared test fixture now asks the system executable locator for all Node
candidates and uses Effect's `findFirstFilter`, process spawner, timeout and
Result/Schema helpers to accept the first fixed probe that reports a real Node
executable. Bun probes return an empty value and are rejected. Actual worker
launches still use explicit executable paths and empty environments. Both the
Node bundle helper and native-busy lifecycle fixture use this verified discovery.
No production runtime detection or request-controlled executable selection is
introduced. This Linux/hosted qualification requires the standard `which` tool
and an installed Node runtime; absence fails explicitly.

After the fix, all 12 regex worker tests pass, including the 15 independent mode
observations for each runtime and deadline/interruption/quarantine controls.
The integration smoke checks also pass under both real runtimes: three fixed
source witnesses, six matches and three empty-input no-match observations per
runtime, plus independent process-exit confirmation. Each reply identifies the
runtime and version, compared with `.bun-version` (1.4.4) or `.nvmrc` (24.22.1).
The failed shim observations remain incomplete receipts, not Node proof.

## Hosted full replay

`CitationRegexTranslator.test.ts` now requires separate full qualification for
both Bun and Node, alongside separately named bounded smoke checks. The same
source subject uses the shared upstream NodeCrypto digest layer under either
runtime; BunCrypto already re-exports the shared Node implementation. A Node
bundle receives the original trusted subject URL to resolve the same committed
fixtures and producer scripts. Fixture, producer, source-reader and ordered
vector hashes remain checked. No oracle fixture or expected count changes.

For each runtime, all original assertions remain required: 13,610 translated
extractors, 13,610 program instances, maximum translated UTF-16 size 3,183,
4,456,448 scalar checks, 4,456,448 alphabet checks, two alphabet capture matches,
26 controlled program captures, 28 controlled cases with 23 captures, all 13,610
positive witnesses / 27,216 matches, and 13,610 empty-input no-match results.
Each runtime must spawn and independently confirm the exit of 17 subjects
(one baseline plus 16 fixed shards). Each child has a 90-second deadline,
2,048-byte reply bound, empty environment, no shell, ignored stderr and upstream
Scope-owned forced termination. Concurrency remains two children, with runtime
tests sequential; full tests retain their 14-minute operation / 15-minute test
ceilings. Smoke selection cannot satisfy the separately registered full tests.

Full corpus runs were not launched locally. Exact-head hosted completion is
required before claiming full Node or latest Bun qualification. Neither the
smoke nor full witness replay establishes adversarial scaling, static family
approval, third-party regex semantics, or complete citation-engine parity.
