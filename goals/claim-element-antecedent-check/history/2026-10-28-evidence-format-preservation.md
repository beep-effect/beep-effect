# Evidence byte preservation

A read-only formatter check of the positive fixture tree reported 207 formatting differences after new extraction and critic receipts were added. No files were rewritten. The six attorney sample expected files already passed formatting, but other sources and retained round receipts carry exact-byte SHA-256 bindings that formatting would invalidate.

Extended the existing root Biome override for byte-bound qualification evidence to the positive JSON fixture tree and the retained label-conformance/source-exclusion JSON histories. Only formatting is disabled for those narrow paths. JSON syntax parsing, lint and the independent schema/source-span checks remain enabled. The existing qualification-evidence policy uses the same mechanism.

Verification: the formatter/lint check passed 506 files without rewriting them. A temporary malformed JSON file under the affected path was rejected with an explicit parse error, then removed in a finally block. This confirms syntax validation still runs. The attorney packet SHA-256 was rechecked unchanged. This configuration does not accept semantic references or alter source selections, predictions, production code or human verdicts.

The subsequent domain package audit found 16 formatting-only errors in unused replacement-candidate JSON files, outside the byte-bound paths. Before formatting, all parsed values were retained privately and their raw SHA-256 values were checked against the packet/fixture JSON evidence with no references found. Formatting those 16 files preserved parsed content exactly. The domain package verification then passed audit and docgen. Bound positive sources, historical receipts and the attorney packet were not rewritten.
