# Intake handoff: the research library routes the November intake can use

Audience: `goals/research-intake-2026-11`. Every command runs from the repo root as
`bun run beep research library <command> --library <root>`. `--library` falls back
to `BEEP_RESEARCH_LIBRARY`, then the XDG data home.

## Order of operations

```sh
bun run beep research library inventory --input <hop-0 dir> [--input <dir> ...]
bun run beep research library qualify --adapter firecrawl --max-probes 1
bun run beep research library acquire --concurrency 2           # hop 1, every route
bun run beep research library inventory --input <same dirs>     # records hop-2 identities
bun run beep research library hops --limit 50                   # gate preview, no fetch
bun run beep research library acquire --concurrency 2           # admitted hop 2 only
bun run beep research library status                            # per-hop denominators
bun run beep research library verify
```

## Routes

| Source | Route | Command |
| --- | --- | --- |
| web, docs, registry URLs | `firecrawl` (native, `@beep/firecrawl`) | `acquire`; qualify with `qualify --adapter firecrawl` |
| arXiv and other papers | `paper` (unchanged) | `acquire` |
| GitHub | `github` (cited object only) | `acquire` |
| YouTube | `youtube-captions` (yt-dlp, primary) | `acquire` |
| VidBee bundle | import method `vidbee` | `import-result <manifest>` with `kind: "vidbee"` |
| alphaXiv paper | import method `alphaxiv` | `import-result <manifest>` with `kind: "alphaxiv"` |
| Box folder or files | `box` (`@beep/box`) | `acquire --route box --box-folder <id> [--box-file <id>] [--box-public] [--retry-failed]` |
| X posts | `grok-x-import` (unchanged, honest `incomplete`) | `import-result` |

Firecrawl key: `op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY`, read through
the PATH `op` shim on the first scrape. `FIRECRAWL_API_KEY` may hold a resolved key or
another `op://` reference.

Box credentials: the `DMS_BOX_*` client credentials from `BEEP_SECRETS`. For
user-owned files set `DMS_BOX_USER_ID=<box user id>`; the enterprise service account
cannot see them (observed in the live probe). An explicit `DMS_BOX_USER_ID` or
`DMS_BOX_ENTERPRISE_ID` wins over a `CLOUD_BOX_TOKEN` loaded from a worktree `.env`;
the token is used only when neither subject is set. Box sources
are private by default and stay out of `render` unless `--include-private`.

## Import manifests

VidBee (paths are relative to the manifest; the media file is hashed, never copied):

```json
{
  "kind": "vidbee",
  "sourceId": "<inventoried youtube source id>",
  "canonicalUrl": "https://www.youtube.com/watch?v=<id>",
  "media": { "path": "0.mkv", "sha256": "<64 hex>", "bytes": 0, "mediaType": "video/x-matroska" },
  "transcript": { "path": "0.en.vtt", "sha256": "<64 hex>", "bytes": 0, "mediaType": "text/vtt" },
  "faq": { "path": "generate-faq.md", "sha256": "<64 hex>", "bytes": 0, "mediaType": "text/markdown" }
}
```

The FAQ frontmatter must name the same `media:` file and, when present, the same
`source_url`. `model` (or `model(effort)`) becomes the `ModelRun`; a missing effort is
recorded as `unrecorded`.

alphaXiv:

```json
{
  "kind": "alphaxiv",
  "sourceId": "<inventoried arxiv:<id> source id>",
  "canonicalUrl": "https://arxiv.org/abs/<id>",
  "arxivId": "2610.00609",
  "version": "v2",
  "fullText": { "path": "paper.txt", "sha256": "<64 hex>", "bytes": 0, "mediaType": "text/plain" },
  "references": [{ "arxivId": "2501.00001" }, { "url": "https://example.org/page" }]
}
```

Full text needs at least 1,000 characters. A mismatched arXiv id or cited version
fails with an identity error. References become hop-2 sources with no capture.

## Hops

- `inventory` writes a hop-1 `Derivation` for every citation in a hop-0 document and a
  hop-2 `Source` plus `Derivation` (`hopDepth = 2`) for every URL in the readable text
  of a hop-1 capture. Re-running is idempotent.
- Hop-2 gate (applied by `acquire`; typed `LibraryHopPolicy`): a hop-1 parent needs a
  `Finding` whose `topicIds` name a live goal (`active`, `paused`) or a live exploration
  (not `parked`, `killed`, `graduated`); GitHub is refused as child or parent; arXiv is
  catalogued only unless `--source <id>` names it; other domains admit 25 per intake
  (`--hop2-domain-cap <n>` on `acquire` and `hops`).
- Gate reasons: `routed-parent`, `arxiv-on-demand`, `unrouted-parent`,
  `github-not-transitive`, `arxiv-catalogue-only`, `domain-cap`.

`status` ends with:

```text
hop 0: documents=<n> citations=<n>
hop 1: identities=<n> readable=<n>
hop 2: identities=<n> readable=<n> cataloguedOnly=<n> gateAdmitted=<n> gateRefused=<n> (<reason>=<n> ...)
```

`verify` reports catalogued-only hop-2 identities as `cataloguedHop2=<n>` instead of
missing coverage.

## Live probes recorded on 2026-11-06

- `qualify --adapter firecrawl` scraped a cited Effect docs page: `verified`, capture
  `readable` with `raw-response`, `raw-full-text` and `extracted-full-text`. A second
  `inventory` catalogued 155 hop-2 identities from that capture; the gate refused all
  of them (no routed findings yet; 3 GitHub).
- `acquire --route box --box-file <id>` with `DMS_BOX_USER_ID` downloaded a 10 KB
  nightly report: qualification `verified`, capture `readable`, SHA-1 matched, captured
  revision `<fileId>:<versionId>`. A rerun downloaded nothing.
