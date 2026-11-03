# Node regex worker adapter

The private regex worker can now run under an explicitly injected Bun or Node
runtime. `CitationNativeProcessRuntime.kind` is a required closed schema value;
there is no ambient runtime detection or raw-request runtime selection. Existing
HTML and regex Bun fixtures supply `kind: "bun"` explicitly.

The Node entry uses upstream `NodeRuntime.runMain`, `NodeStdio.layer` and
`NodeCrypto.layerDigest`. Both entries execute the same `citationRegexWorkerProgram`;
the Bun entry also supplies only the required digest service. The shared command
uses Effect `ChildProcess.make` with Bun's disabling flags only for Bun. Both
runtime choices retain empty environment, explicit executable and working
directory, no shell, piped protocol, ignored stderr, SIGKILL and zero forced-kill
delay. Admission, captured clocks, typed RPC, exact byte limits and retirement
ownership are shared unchanged. No replacement process or RPC implementation is
introduced.

## Qualification

Local Node version is v24.22.1, matching the repository `.nvmrc`. Tests resolve the
installed Node executable through the fixed `node -p process.execPath` probe;
actual worker children receive an empty environment. A scoped test build bundles
the Node entry as an ES module using Bun's build API with target Node. The bundle
is disposable test setup, not a production runtime dependency or request feature.

The same independently generated, hash-pinned CPython 3.11.15 / Unicode 14 mode
fixture is replayed through both real worker entries: five inputs times three
modes (`finditer`, `search`, `match`), every capture and Python-point length
compared. Each runtime confirms all 15 worker PIDs have exited independently
before results are accepted. This includes scalar/literal-surrogate distinctions,
late prefix misses and no-match zero-quota results.

Both runtimes additionally run the native-busy lifecycle controls: captured
regex deadline despite a caller-supplied disabled clock; responsive parent;
interruption acknowledged only after physical retirement; both total and regex
capacity quarantined when exit acknowledgement is delayed; no replacement child;
late acknowledgement releases capacity once. These use a fixed WebAssembly busy
fixture, not an unproven pathological source regex. Functional mode tests use a
manually controlled execution clock and prove results, not cold-start latency.

Focused worker/ownership qualification: 25 tests across
`CitationRegexWorker.test.ts`, `CitationHtmlWorker.test.ts` and
`CitationNativeProcess.test.ts` pass. Test TypeScript check, scoped Oxlint, quick server package lint/check and Fallow
new-only audit pass (zero new findings). The affected full HTML/byte corpus
commands were stopped locally and are left to hosted CI; their incomplete logs
are not accepted as proof.
The first development run rejected an incorrect LiteralKit method name; the
correct schema-provided `match` is used and the final checks pass.

## Limits of this evidence

This proves the Node entry and shared supervision on the bounded mode controls.
It does not approve source families or scaling, prove all native regex behavior,
qualify a Node HTML entry, qualify the full source corpus on Node, or complete the
public engine integration. Full Node source-corpus replay and hosted exact-head
proof remain required. Effect upgrade work remains owned by PR #2637; this change
uses the currently installed patched Effect 4.1.1 and does not duplicate it.
