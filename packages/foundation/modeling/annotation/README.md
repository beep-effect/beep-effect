# @beep/annotation

Standoff annotation documents over one text capture.

`@beep/annotation` owns the L2 layer of the knowledge stack: what was read in a text, kept apart from who read it.
A document names one capture (`@beep/text` `SourceTextIdentity`), keeps an anchors table of verified receipts keyed
by occurrence id, an annotations table keyed by content id, and attribution keyed by content id with one generation
per activity. Every arrow is pure or needs only core's `Digest.Digest`; the package defines no service.

## Consumers

- `@beep/langextract`: the extraction handoff emits an `ExtractionDocument` with its readings and residual.
- `@beep/law-practice-use-cases`: `IrToLaw` and the office-action review read the handoff's document.
- `apps/labs/semantica`: the hosted extractor grounds its claims on the handoff's document.

## Claims and their laws

Each claim below is a row of the law-test plan,
[`law-test-plan.md`](../../../../goals/text-knowledge-stack-rebuild/research/law-test-plan.md), and a test titled
with the row id under `test/`. Rows `L2-2` and `L2-3` cover the ids, kinds and checked codec; `L2-1`, `L2-4`
and `L2-5` cover merge, restriction and containment; `L2-6` lands with the OA codec subpath.

| Claim | Ledger row | Test |
| --- | --- | --- |
| An annotation id is the `annotation/v1` hash of its target set, kind IRI and encoded body, so it ignores target order and duplication. | `L2-2` | `test/AnnotationId.laws.test.ts` |
| Every annotation is attributed, each (content, activity) pair is one generation, and its run is the `generation/v1` hash of the pair. | `L2-3` | `test/Generation.laws.test.ts` |
| Merge over one capture is idempotent, commutative and associative, and unions attribution. | `L2-1` | `test/AnnotationDocument.merge.laws.test.ts` |
| Targets and body references resolve after merge and restriction; the checked decode refuses a forged key. | `L2-4` | `test/AnnotationDocument.integrity.laws.test.ts` |
| Containment is a strict order with a level tie-break on equal spans. | `L2-5` | `test/Containment.laws.test.ts` |
| The OA and NIF codec round-trips the declared profile and normalizes third-party input. | `L2-6` | `test/rdf/OaCodec.laws.test.ts` |

## Canonical imports

```ts
import { makeDocumentCodec } from "@beep/annotation/AnnotationDocument"
import { contains } from "@beep/annotation/Containment"
import { mintAnnotationId } from "@beep/annotation/Kind"
import { DocumentKinds, TextDocument } from "@beep/annotation/Kinds"
import { merge } from "@beep/annotation/Merge"
import { restrict, restrictToOa } from "@beep/annotation/Restrict"
```

`makeDocumentCodec({ schema, kinds })` is the only decode path for document JSON from the wire or storage: it refuses
a repeated key, checks the document, and verifies every key against the hash of its value. Its `encode` writes one
canonical JSON form per document, and its `assemble` mints every key from unkeyed parts.

`merge` unions two documents over one capture and refuses with the same value in either argument order;
`restrict` keeps a kind set closed under body references and refuses an open one; `contains` is the strict
containment order of the structure and segmentation kinds.

## Development

```bash
bun run --filter=@beep/annotation check
bun run --filter=@beep/annotation test
bun run --filter=@beep/annotation lint
```

Tests import package source through `@beep/annotation` or other `@beep/*` aliases. Use relative imports only for
local helpers, fixtures, and snapshots.

## License

MIT
