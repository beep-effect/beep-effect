# Public tokenizer port and shared operation contracts

The existing default tokenizer now returns and consumes CitationTokenizer from
@beep/law-practice-use-cases/server, package 0.0.0 with Effect 4.1.2. Its tokenize
method has R=never and declares only CitationTokenizerFailure and
CitationSafetyLimitExceeded. The factory retains private snapshot/reap controls;
there is no legacy run alias. TokenizedExtraction constructs the adapter inside
its current admitted operation Scope and text budget and invokes port.tokenize.
No global adapter captures a prior operation's budget.

The same server-only public owner now defines CitationTokenizerResult,
CitationTokenSeed and CitationAssemblyResult. Their existing native token-plan
fields, signed code-point positions, missing/null group distinctions and frozen
edition ordinals are preserved. CitationPythonUnicodeStorage moves from the
private hash helper and retains one/two/four-byte storage, distinguishing literal
adjacent surrogate code points from a supplementary scalar. Hash validation
reuses the public byte field rather than defining a second byte schema.
CitationTextBudget moves its captured service contract here; the actual ledger,
capacity admission and object issuance remain private server implementation.
Every existing source/test consumer migrates directly; no compatibility aliases
remain at the old owners. None of the seven symbols is exported by root/public.

The tokenize input remains unknown at this schema-decoding boundary, preserving
existing malformed-source refusal behavior. Successful decoding grants neither
source provenance nor permission to spend allocation authority. Closed admission
is translated to the declared port stage-failed refusal before native work. Port
failure remains separate from the five engine-boundary errors; final engine
translation is still required.

## Verification

- Initial combined server regression: 25 tests passed, one new lifecycle test
  failed across seven files in 61.45 seconds. The fixture's real admission service
  overrode the intended substitute. The corrected test installs the closed owner
  into the provided Context; all eight tokenizer tests then pass in 6.71 seconds.
  The refusal asserts zero native spawns and zero confirmed worker exits.
- The other passing regressions cover Python hash vectors, cumulative text
  budgets, token models, assembly, verified extraction on Bun/Node and completed
  extraction reporting. No source fixture expectations were changed.
- The public contract test proves closed invocation, separation from engine
  failures and exclusion of all seven exports from root/client surfaces.
- Both packages' quick lint/type checks and the server declaration build pass.
  Blocking laws pass; existing unrelated terse-effect findings remain advisory.
  Actual use-case docgen typechecks all 586 examples.
- Local Fallow audit passes with zero introduced dead code or complexity and
  nine inherited nonblocking clone groups. No threshold, baseline or suppression
  changes. Hosted checks on the preceding cleaner head 7a49d5acb2 pass Fallow,
  Secret Scanning and JSDoc Ratchet; new-head hosted confirmation is pending.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep quality package-verify @beep/law-practice-use-cases --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
bun run beep lint laws --package packages/law-practice/use-cases
bunx fallow audit --config .fallowrc.jsonc --format json --quiet \
  --base origin/main --gate new-only
cd packages/law-practice/server
bunx --bun vitest run test/CitationPythonHash.test.ts \
  test/CitationTextBudget.test.ts test/CitationTokenObjects.test.ts \
  test/CitationTokenAssembly.test.ts test/CitationTokenizer.test.ts \
  test/CitationVerifiedExtraction.test.ts test/CitationExtractionReport.test.ts
cd ../use-cases
bunx --bun vitest run test/CitationTokenizerPort.test.ts
bun run beep:docgen
```

## Remaining duties

This publishes the existing native-plan profile, not an assertion that arbitrary
Python custom-tokenizer subclasses, mutable aliases or model protocols have been
qualified. Full CitationEngine request/service/Layer, deployment binding, port
failure translation, failure reports, transforms, complete resolution/annotation
integration and exhaustive canonical/donor/safety/scaling proof remain open.
All eleven representation laws, four fidelity questions and fifteen unfinished
proof rows remain open; no semantic waiver or accounting promotion is made.
