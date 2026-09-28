# Desktop filesystem dependency review

UsageRecordSink and chat-persist use in-process PGlite and the embedded migration
bundle. Their test bodies perform database operations, not filesystem work.
Removing the unused BunFileSystem and BunPath adapters preserves all assertions,
including the legacy activity migration and finalized chat/usage persistence.
No mock database or alternate migration path was introduced.

The contradiction QA seed cases use Effect FileSystem operations to create and
preserve fixture files. Their platform composition now supplies the existing
MemoryFileSystem layer in each independent one-test fixture. PGlite remains the
same real in-process SQL engine with btree_gist and the original migrations;
only the seed's filesystem service changes. Crypto and Path remain provided.

Node and Bun each passed all six cases in these three suites. AST comparison
preserved six titles and all 83 assertion call expressions, including nested
expressions. A temporary probe confirmed four distinct filesystem objects, that
each fixture root existed in its virtual filesystem but not on the host, and
that every virtual root was removed after suite finalization. The probe was
removed afterward.

This supersedes the earlier seed-fixture receipt's decision to retain its real
filesystem. The test exercises service-level file creation and conflict rules;
it does not require host filesystem behavior. Real PGlite data-directory and
compiled-sidecar tests remain separate judgments, as do the repository-source
checks and the live-provider suite.

Full Desktop package verification passed audit and docgen. Schema-first and
strict packet validation passed. The final ratchet reported zero introduced
findings, 230 resolved against the retained baseline, and 4,772 live findings.
Three filesystem candidates are removed by this batch. The remaining six and
the local PgliteDataDirCompatibility lifetime wrappers are not claimed closed.
