# Raw source component to verified extraction input

The server use-case subpath now owns one raw source component and named
extraction options. The existing private builtin-name and source-role domains
move there, and named container kinds share the same owner. All private
consumers migrate without compatibility aliases. The raw entry reuses the
option fields directly, preserving None versus an empty cleaner list, list/
tuple/generator behavior and exact source text. These are server-only request
components, not a completed dual-source/retained-Document engine API.

## Reused source contract and trust boundary

The private adapter reuses the existing public foundation contracts:

- @beep/file-processing/SourceText, package 0.0.0: SourceTextResolver.resolve,
  ResolveSourceTextRequest.identity, ResolvedSourceText.identity/text and
  SourceTextResolverError;
- @beep/provenance, package 0.0.0: SourceTextIdentity and the public
  VerifySourceTextIdentityInput/verifySourceTextIdentity capability producer;
- Effect 4.1.2 for decoding, snapshots, captured services, timing and iteration.

No new source resolver, durable source identity, proof issuer or hash algorithm
is implemented. The trusted resolver supplies canonical text; the prerequisite
verifier independently checks expected/resolved identities and the text digest.
Caller text must exactly equal that verified text. Decoding a request component
alone grants no capability. The compatibility of the existing anchor/vocabulary
contracts is unchanged; these public source-resolution symbols supplement the
recorded prerequisite integration rather than replace it.

The adapter captures resolver, digest service, decoded policy and Clock.
Identity metadata and named options are snapshotted before resolver work;
source strings remain unchanged. Effective size checks occur before resolution
for caller text and before hashing for resolver output. The original plain
"eyecite" shortcut leaves option getters unread. Named cleaner callbacks and
custom tokenizers remain server services, never request fields.

The returned preparation method has R=never and a captured stage deadline.
The eventual engine still must share one admission/overall deadline across
preparation and extraction. Resolver/proof failures become source-free
prerequisite failures; caller mismatch becomes input failure; resource/time
exhaustion remains safety failure. Debug events carry only closed stage labels.

## Verification

Five source-boundary tests initially pass in 4.12 seconds. They cover caller
mutation during resolution, genuine proof issuance, ignored shortcut getters,
caller/resolver size limits, text/identity mismatch, source-error/cause redaction
and a clock-controlled stalled resolver. Final focused replay passes five tests
in 2.10 seconds after separating resolution and request preparation.

Connected replay now supplies raw source components to the production adapter,
with an explicit fixture SourceTextResolver standing in for the upstream
resolver. The adapter issues the actual input capability before the existing
verified extraction produces output lineage and anchors. Eight source/document/
verified tests initially pass in 33.17 seconds. The final source/verified replay
passes seven tests in 47.96 seconds on Bun and Node, comparing complete original
plain/Unicode/HTML models, source lineage and primary/full-span evidence.

Six use-case contract/safety/failure tests pass in 1.98 seconds, including raw
Unicode preservation, None/list distinction, callback rejection and root/client
export isolation. Both packages' checks/declaration builds, blocking laws and
codec lint pass. Scoped scans show no new cognitive/clone findings for the
adapter/components; existing estimated-coverage findings in unchanged cleaner
logic are not hosted coverage proof.

## Hosted documentation repair

Head 630db79252's JSDoc Ratchet (job 128081285747) reports eight missing export
since tags and one additional package needing remediation. Heavy Docgen (job
128082678037) identifies the same public failure/operation declarations. Their
category and since tags were on one line, so the parser did not recognize since.
The tags are separated, including new source components. Package JSDoc lint
passes and actual docgen succeeds, typechecking all 568 examples. No baseline
or threshold changes. Global hosted ratchet confirmation remains pending.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep quality package-verify @beep/law-practice-use-cases --quick
bun run beep lint laws --package packages/law-practice/use-cases
bun run beep lint laws --package packages/law-practice/server
bun run beep lint jsdoc --package packages/law-practice/use-cases
cd packages/law-practice/use-cases
bun run beep:docgen
bunx --bun vitest run test/CitationEngineInput.test.ts \
  test/CitationEngineFailure.test.ts test/CitationSafetyFailure.test.ts
cd ../server
bun run beep:build
bunx --bun vitest run test/CitationSourceRequest.test.ts \
  test/CitationVerifiedExtraction.test.ts
```

Complete multi-source/retained-input dispatch, reports, cleaner/tokenizer ports,
CitationEngine service/Layer, remaining native translators, deployment binding,
final document integration, transforms, exhaustive accounting and whole-engine
safety/scaling remain required. All eleven representation laws, four fidelity
questions and fifteen unfinished proof rows stay open without a waiver. The
base-pinned scanner still requires independent PR #2786 to land on main.
