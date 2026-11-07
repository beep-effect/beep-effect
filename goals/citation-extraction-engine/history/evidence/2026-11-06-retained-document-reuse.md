# Reuse initialized private Document state

The pinned `find.get_citations` constructs a fresh Document. It does not accept
a retained Document as its plain_text argument. Document.tokenize is a separate
model method that reads retained plain_text and replaces words/citation_tokens.
This checkpoint adds private initialized-Document reuse, not an invented public
get_citations input mode. Full mutable/custom-tokenizer Document behavior remains
required under C-009; no capability row is closed by this increment.

Verified source: read the original Git blob at
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, not the reference clone's current HEAD.
The models.py blob SHA-256 is
2297f2f3a036a5674346e952fd6b03c8d4906c1130ef43157b7e2d79d5bdf38a,
matching the committed source inventory. Relevant source methods are
Document.__post_init__ at line 900 and Document.tokenize at line 956. Existing
Free Law Project BSD-2-Clause attribution remains in the implementation/notice.

## Implementation

The existing Document extraction module shares its tokenization/extraction body
between initial input and retained private Documents. Initial extraction still
runs the original initialization first. The new retained constructor skips
initialization and cleaner iteration, but checks ownership of plain, markup,
source and step handles before native work. Both routes reuse existing metadata
admission, child Context, Scope, timing, native workers and cumulative budgets.
The retained result keeps the exact Document, handle and geometry identities.
Returned extract has R=never; no new registry/cache/worker abstraction is added.

A schema-derived from-self declaration validates an existing Document without
copying it; handle ownership is checked independently afterward. The first
regression caught ordinary structural decoding cloning the Document. The
from-self boundary fixes that failure rather than weakening the identity check.
This is not a verified-source capability issuer or a new public model codec.

## Hosted Fallow repair

At head 672dca229d, Check run 42280074280 job 128106626547 rejects one introduced
complexity finding: replayCitationPairedSource has cognitive complexity 12 against
the existing maximum 8. The hosted raw artifact 13535142347 identifies the exact
function; envelope validation itself succeeds. The test now separates resolver
installation and pair result/evidence assertions. All model, source, alias,
refusal, shortcut and admission assertions remain. Scoped Fallow now reports no
findings for this fixture; no suppression, threshold or baseline changes.
Exact-head hosted confirmation remains pending.

## Verification

Retained Document replay passes both tests in 38.61 seconds on Bun and Node.
Plain and HTML Documents run through tokenization/extraction again, comparing
complete original expected model state. Tests retain Document/handle/geometry
identity and install initialization hooks that die if invoked. A foreign-owner
plain handle refuses as unissued-value before additional native activity. All
spawned workers still require independent exit confirmation. The paired replay
passes both tests in 34.99 seconds after setup separation. Final combined replay
passes all four tests across two files in 41.62 seconds for the complete refactor.

Package lint/type checks, declaration build, blocking laws and scoped codec lint
pass. No thresholds or baselines change.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationDocumentExtraction.test.ts \
  test/CitationPairedSource.test.ts
```

Full Document model mutation/tokenizer aliases and the public request/report/
cleaner/tokenizer ports/service/Layer, remaining failure translation, transforms,
final document integration, exhaustive canonical/donor accounting and whole-engine
safety/scaling remain required. All eleven representation laws, four fidelity
questions and fifteen unfinished proof rows remain open without a waiver.
