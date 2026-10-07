# Source Ledger

## Intake roots

- Repo-owned nightly `research/` packets and ledger, frozen at an intake commit.
- Machine-local `Downloads/Research-10-6-26` reports, immutable byte snapshots.
- External library: `~/YeeBois/research/beep-effect/`; per-document and per-source
  manifests provide exact on-disk evidence and occurrence links.

## Precedents and existing capabilities

- `explorations/academia-corpus-mining`: external originals/extraction/provenance.
- `explorations/_gold-intake`: exhaustive finding routing against live work.
- `explorations/atlas-synthesis`: cross-domain synthesis; old gap maps need refresh.
- `packages/tooling/tool/cli/src/commands/Research`: existing research operations.
- `packages/drivers/firecrawl`: reusable technical acquisition boundary.

## Tool documentation

- https://docs.x.ai/build/modes-and-commands#workflows
- https://docs.x.ai/developers/tools/collections-search#combining-collections-search-with-web-searchx-search
- https://docs.firecrawl.dev/features/scrape
- https://github.com/yt-dlp/yt-dlp#subtitle-options
- https://github.com/jdepoix/youtube-transcript-api
- https://github.com/ggml-org/whisper.cpp

## Licensing and reuse

Record each acquired upstream license at its captured revision. Until verified,
source is reference-only. Permissive code requires attribution; copyleft patterns
follow repository clean-room policy. Captured full texts remain outside this
public repository. No new upstream implementation has been vendored here.

## Completed reading ledger

- [Final coverage and source categories](COVERAGE.md).
- [One row per source, with reader records and finding backlinks](source-ledger.jsonl).
- [Final finding dispositions](ROUTING.md) and [machine-readable routing](routing.jsonl).
- [Reader 1 synthesis](readings/reading-1/SYNTHESIS.md),
  [reader 2 synthesis](readings/reading-2/SYNTHESIS.md),
  [reader 3 synthesis](readings/reading-3/SYNTHESIS.md), and
  [parent reconciliation](readings/parent/SYNTHESIS.md).
- [Gap-bound investigations](INVESTIGATIONS.md), including the actual second Grok
  deep-research run, its partial report limitation, and independently retained
  Microsoft documentation.

Open `index.html` or `index.md` in the external library. Each catalog source ID
maps to `sources/<source-id>/SOURCE.md` and `index.html`; source cards link to
all citing reports and retained artifacts. Snapshot paths and artifact hashes in
reader records resolve beneath the same library root. Full texts and originals
remain external; these public ledgers contain derived dispositions and identifiers.
