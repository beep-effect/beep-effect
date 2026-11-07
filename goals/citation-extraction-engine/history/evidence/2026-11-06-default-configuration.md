# Production default extraction assembly

The default configuration constructor now composes the production parser,
helper and semantic-vocabulary assets into the existing complete semantic
extraction configuration. It returns the existing frozen-edition owner for
installation in the caller's Context. It does not introduce a queue, worker,
serializer, hashing algorithm or parallel configuration model.

Trusted server input is an annotated branded schema containing explicit asset
paths and the existing diff runtime. Invalid input fails through a closed error
without retaining path/runtime values or schema causes. Parsing retains all
6,805 extractors and 2,533 edition bindings. The same binding sequence feeds
construction and semantic projection. The helper installer captures the
calendar once. Executable services and paths do not enter raw requests.

## Vocabulary loading and identity scope

The reviewed semantic-editions.json asset is 386,455 bytes, with SHA-256
9e3e5f9539e13f0cfce17489ece472686e11c9ccc446ba7d71319d8680c0dba8.
It now uses the shared bounded asset reader. Exact byte length and digest are
checked before UTF-8 decoding. The existing semantic-vocabulary owner then
validates the original schema, complete edition table, current vocabulary
artifact and every case reporter's public membership.

Text authentication is shared by JSON and vocabulary loading; JSON decoding
still uses the caller's existing Effect Schema codec. Changed, truncated,
appended and absent vocabulary files refuse. Filesystem errors retain no path
or nested cause in the returned vocabulary failure.

Individual authenticated data identities are returned in their own schema.
They are explicitly not a complete engine artifact identity. Native kernels,
implementation version, runtime/hash profile and injected ports still need the
final artifact contract. The fixture's synthetic engine identity continues to
stand in for that unfinished production owner; no data hash is promoted into
an engine identity or claimed to authenticate code.

## Connected verification

An independent assembled configuration compares through the entire existing
semantic configuration schema. Its expected path uses the prior document
composition and separately reads the original vocabulary. Both retain all
2,533 editions. Installation confirms zero native children, and invalid
trusted configuration refuses.

The initial default/helper/catalog/verified regression passes eight tests in
48.78 seconds. Both semantic and verified extraction replays now use a shared
fixture installer around the production constructor and install the returned
frozen-edition owner. The complete original models, publication metadata,
Unicode/HTML behavior and verified anchors remain the comparison oracle.
Final shared-setup regression passes ten tests across five files in
87.70 seconds, including all eight built-in semantic families on Bun and Node.

Package lint/type checks, declaration generation, blocking package laws and
codec lint pass. Scoped complexity and duplication checks show no new findings
for the changed production code or fixture setup. Existing full-document
integration remains registered for hosted execution; focused replay does not
prove exhaustive behavior or whole-engine safety.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationDefaultConfiguration.test.ts \
  test/CitationHelperConfigurations.test.ts test/CitationParserCatalog.test.ts \
  test/CitationSemanticExtraction.test.ts test/CitationVerifiedExtraction.test.ts
```

Hosted confirmation of this wave is pending. PR #2786 remains the separate
review path for the exact public-source digest scanner exceptions; #2737 must
merge main once that policy lands. Secret Scanning passes on the policy
head e106068b57 (Check run 42265368128, job 128055785930).
Base-pinned scanner policy stays intact.
Complete engine artifact production, captured default ports, public request/
error/service/Layer, final document integration, transforms, broad observable
host behavior, exhaustive canonical/donor accounting and whole-engine
safety/scaling remain open. All eleven representation laws, four fidelity
questions and fifteen unfinished proof rows remain open without a waiver.
