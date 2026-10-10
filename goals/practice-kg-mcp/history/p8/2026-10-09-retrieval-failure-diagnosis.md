# Retrieval failure diagnosis (DF-2)

## What the transcripts establish

Both exported transcript sets were read. Tool-use blocks were joined to their
result blocks by tool-use ID and duplicate exported calls were counted once.
The ledger below includes every failed `corpus_get_document`,
`corpus_search_text` and `kg_provenance` call in that pull, and every successful
call to those tools after 2026-10-10T01:00Z. Timestamps belong to tool-use
blocks, not the later result. A bundle ID appears only when the result names it.
No session IDs, transcript filenames, input references or document text are
published here.

There are 14 failing calls and 12 succeeding calls in this ledger. Failure
results report `store-query-failed` or the bundle-store refusal. The extension
name fails as well as `practice-kg`. The extension name later succeeds on
bundle `2026-10-07-04`. A graph-provenance lookup succeeds at 01:06:03.433Z,
then another provenance lookup fails 0.699 seconds later. This distinction
matters because document provenance uses DuckDB while node provenance uses
the graph store.

## Per-call ledger

All timestamps below are UTC on 2026-10-10. Server names are exactly the
namespace in the tool-use block; they do not prove the executable path or
environment of a running process.

| Timestamp | Server namespace | Tool | Result | Bundle ID in result |
| --- | --- | --- | --- | --- |
| 2026-10-10T00:08:48.265Z | Beep_Practice_Knowledge_Graph | corpus_get_document | failure | not in result |
| 2026-10-10T00:08:49.616Z | Beep_Practice_Knowledge_Graph | corpus_get_document | failure | not in result |
| 2026-10-10T00:08:50.519Z | Beep_Practice_Knowledge_Graph | corpus_get_document | failure | not in result |
| 2026-10-10T00:08:52.594Z | Beep_Practice_Knowledge_Graph | corpus_search_text | failure | not in result |
| 2026-10-10T00:08:55.370Z | practice-kg | corpus_get_document | failure | not in result |
| 2026-10-10T00:08:56.283Z | practice-kg | corpus_get_document | failure | not in result |
| 2026-10-10T01:05:55.905Z | Beep_Practice_Knowledge_Graph | corpus_search_text | failure | not in result |
| 2026-10-10T01:05:56.084Z | Beep_Practice_Knowledge_Graph | corpus_search_text | failure | not in result |
| 2026-10-10T01:05:58.863Z | Beep_Practice_Knowledge_Graph | corpus_get_document | failure | not in result |
| 2026-10-10T01:05:59.450Z | Beep_Practice_Knowledge_Graph | corpus_get_document | failure | not in result |
| 2026-10-10T01:06:03.433Z | Beep_Practice_Knowledge_Graph | kg_provenance | success | 2026-10-07-04 |
| 2026-10-10T01:06:04.132Z | Beep_Practice_Knowledge_Graph | kg_provenance | failure | not in result |
| 2026-10-10T01:06:04.625Z | practice-kg | corpus_get_document | failure | not in result |
| 2026-10-10T01:06:07.441Z | Beep_Practice_Knowledge_Graph | corpus_get_document | failure | not in result |
| 2026-10-10T01:09:07.021Z | Beep_Practice_Knowledge_Graph | corpus_get_document | failure | not in result |
| 2026-10-10T01:23:24.905Z | Beep_Practice_Knowledge_Graph | corpus_search_text | success | 2026-10-07-04 |
| 2026-10-10T01:23:27.860Z | Beep_Practice_Knowledge_Graph | corpus_search_text | success | 2026-10-07-04 |
| 2026-10-10T01:23:28.312Z | Beep_Practice_Knowledge_Graph | corpus_get_document | success | 2026-10-07-04 |
| 2026-10-10T01:23:31.339Z | Beep_Practice_Knowledge_Graph | corpus_get_document | success | 2026-10-07-04 |
| 2026-10-10T01:23:32.638Z | Beep_Practice_Knowledge_Graph | corpus_get_document | success | 2026-10-07-04 |
| 2026-10-10T01:23:33.943Z | Beep_Practice_Knowledge_Graph | corpus_get_document | success | 2026-10-07-04 |
| 2026-10-10T01:31:58.132Z | Beep_Practice_Knowledge_Graph | corpus_search_text | success | 2026-10-07-04 |
| 2026-10-10T01:32:06.454Z | Beep_Practice_Knowledge_Graph | corpus_search_text | success | 2026-10-07-04 |
| 2026-10-10T01:34:25.289Z | Beep_Practice_Knowledge_Graph | corpus_search_text | success | 2026-10-07-04 |
| 2026-10-10T01:34:30.047Z | Beep_Practice_Knowledge_Graph | corpus_search_text | success | 2026-10-07-04 |
| 2026-10-10T01:34:33.881Z | Beep_Practice_Knowledge_Graph | corpus_get_document | success | 2026-10-07-04 |

The two successful searches at 01:23:24.905Z and 01:23:27.860Z are 2.955
seconds apart; both are successes. The earlier failures precede them by minutes.
The supplied findings summary's "3 s apart" phrase must not be read as a
failure immediately followed by success. Four document reads also succeed
between 01:23:28Z and 01:23:34Z.

## Hypothesis assessment

| Hypothesis | Evidence | Decision |
| --- | --- | --- |
| Legacy Desktop entry launches `server-2026-10-06-01`. | The private PC findings identify a legacy `mcpServers.practice-kg` entry with a 0.0.0 manifest and no configured runtime bundle directory. Three failing document reads use the `practice-kg` namespace. | Remove the duplicate entry. It can explain this namespace's failures, but cannot by itself explain extension-name failures. Namespace alone does not prove which process handled it. |
| Claude Code launches the extension executable without `BUNDLE_DIR`. | The private findings identify this omitted environment value. Current `bin.ts` refuses missing bundle configuration before serving. | Add the explicit bundle environment to Claude Code. Historical executable behavior and process environment are not captured per call, so this remains a configuration defect rather than a proved sole cause. |
| Bundle `2026-10-07-04` has a real document-store defect. | Extension-name document tools fail while graph provenance can work; later extension-name get/search results explicitly name this bundle and succeed. The old self-check omitted document and FTS queries. | The evidence supports a document-query compatibility/runtime failure, but does not prove permanent bundle corruption. Request-dependent failure, changed process/store state, or a missing query dependency remain possible. Preserve the bundle; rerun identical failing inputs after the configuration repair. |

The deciding observation is that both namespaces fail and the extension later
reads the same reported bundle successfully. Correct both configuration defects
and add an actual document-query preflight. Do not label DF-2 resolved until
an identical-input replay proves the failing calls pass. The transcript pull
has no per-call executable hash, environment or store-file hash that could
settle the remaining process-state alternatives.

The copied legacy manifest does declare `user_config.bundle_dir` and a
`BUNDLE_DIR` template. That declaration is not evidence that the manually
configured legacy process received a resolved environment value. The PC
configuration omissions come from the orchestrator's findings; the supplied
logs do not include a config snapshot. Both lifecycle logs were read, and the
extension log has no bundle-query refusal string. Its last launch is at
00:51:22.846Z, before the 01:23Z successful queries, so it cannot attribute
those later calls to a process instance.

## Exact recommended PC configuration edits

The orchestrator applies these edits over SSH after backing up both config
files. This lane changes neither the PC nor the live sitting folder. Preserve
all other server entries and extension settings.

In `claude_desktop_config.json`, remove the legacy entry with this JSON Patch:

```json
[
  { "op": "remove", "path": "/mcpServers/practice-kg" }
]
```

In Claude Code's `~/.claude.json`, retain the extension executable in the
existing `mcpServers.practice-kg.command`. Add or replace
`mcpServers.practice-kg.env.BUNDLE_DIR` with the verified installed bundle
path. If `env` already exists, merge the following property into it:

```json
{
  "BUNDLE_DIR": "C:\\PracticeKG\\bundle-2026-10-07-04"
}
```

The path above follows the supplied Windows install layout; verify it exists
before writing. If the current bundle was installed elsewhere, use that exact
verified directory. When `env` does not exist, add the object above at
`/mcpServers/practice-kg/env`. When it exists, the patch is:

```json
[
  {
    "op": "add",
    "path": "/mcpServers/practice-kg/env/BUNDLE_DIR",
    "value": "C:\\PracticeKG\\bundle-2026-10-07-04"
  }
]
```

Check for `PRACTICE_KG_BUNDLE_DIR` in the same process environment: current
`bin.ts` resolves it before `BUNDLE_DIR`, so any stale value must be removed
or aligned. Close clients that hold PGlite, run the installed executable's
`--self-check` with this environment, restart the clients, and replay the
previously failing requests. Restore the backed-up config to reverse the edits.
No repair or successful PC replay is claimed by this PR.

## Server change in this PR

`apps/practice-kg-mcp/src/runtime/SelfCheck.ts` now runs the same
`PracticeKgQueries.getDocument` and `PracticeKgQueries.searchText` SQL as the
MCP handlers. It probes document text and the FTS view even when the test
reference matches no document. `src/bin.ts` runs that check before launching
the MCP transport. A store mismatch produces one clear refusal on stderr and
exits nonzero; it does not first advertise working tools. Existing manifest
version and missing-store checks remain in force. Successful startup validation
closes its scoped stores before the long-lived host opens them.

`test/Host.test.ts` removes the document-text table and FTS view separately
from synthetic current-format bundles. Each case must fail self-check and a
real stdio entrypoint startup before any MCP response. These probes detect
missing query dependencies; they do not prove every request, row decode, or
source-text pointer is valid. This change stays below 200 changed lines in
`@beep/practice-kg-mcp` and requires its full package verification.
