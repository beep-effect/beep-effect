# Desktop sidecar filesystem boundaries

The smoke test now owns its configured RuntimeTest and temporary ontology
workspace through public `it.layer`. Its original CreateThread, SendMessage,
and GetTimeline program is unchanged. RuntimeTest internally provides
BunServices.layer, including the filesystem consumed by OntologyServerLive.
Replacing only the outer fixture filesystem with MemoryFileSystem would create
a virtual workspace that the runtime cannot see. The contradiction-sidecar
contract has the same boundary and already uses a public fixture layer.

The separately gated real-Anthropic fixture no longer supplies unused
BunFileSystem and BunPath adapters. Its real Anthropic kernel, in-process
PGlite, btree_gist, migrations, stores, and crypto remain intact. The original
opt-in and API-key gates remain. No live Anthropic request was made for this
batch, and a disabled suite is not credited as provider E2E proof.

## Validation

With BEEP_TEST_SIDECAR_SMOKE=1, Node and Bun each passed all eleven cases across
sidecar-smoke, contradiction-sidecar-contract, and PgliteDataDirCompatibility.
Full `bun run beep quality package-verify @beep/professional-desktop` passed
both audit and docgen. AST comparison preserved all three declared test titles
and 22 assertion call expressions across the two edited files, including
nested expressions and the live-provider guard case.

A temporary probe in the smoke fixture asserted that its host workspace existed
after acquisition and was absent after suite finalization. The enabled smoke
case and cleanup probe passed; the probe was removed afterward. The public
fixture retains the standard ten-second setup budget and five-minute
coverage/deep-sweep setup budget used by adjacent runtime fixtures.

## Five retained host filesystem judgments

- PgliteDataDirCompatibility exercises native database directories, legacy
  engine compatibility, close/reopen persistence, PG_VERSION, chmod-based
  unreadability, and extension-bundle cleanup. A virtual Effect filesystem
  would not become the native engine's filesystem. Its local provider wrappers
  still require a separate Resource-lens review; this judgment closes only
  the filesystem choice.
- The contradiction-sidecar contract supplies the actual ontology workspace to
  RuntimeTest's internally provided platform filesystem.
- The sidecar smoke fixture has the same runtime boundary, with explicit
  workspace cleanup evidence from this batch.
- The IPC suite passes host database and ontology paths to a compiled Bun
  subprocess. MemoryFileSystem cannot cross that process boundary. Its prior
  process, stderr-reader, and temporary-directory lifetime proof still applies;
  the compiled IPC suite was not rerun in this batch.
- The Tailwind guard reads the actual package manifest and application CSS.
  Replacing those files with expected fixture content would stop checking the
  repository configuration that is the subject of the test.

These five EV010 judgments are recorded in both the root inventory and the
Desktop detector ledger. Four original Desktop filesystem candidates have
been removed across this and the preceding batch. Final fixed-row reconciliation,
remaining lens judgments, package-wide timings, and hosted closeout remain open.

Schema-first, Biome on both edited tests, and strict packet validation passed.
The strict validator checked 5,002 root finding IDs and 15,250 unique ledger
rows, plus census and timing schemas; it does not establish Desktop completion.
The final syntax ratchet reported zero introduced findings, 231 resolved against
the retained baseline, and 4,771 live findings. No blanket baseline refresh was
performed.
