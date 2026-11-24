---
title: The deleted Python oracle producers stay pinned by digest, not ported or re-hashed
date: 2026-11-23
reversal: Port each producer to TypeScript under goals/citation-extraction-engine/ops/, hash the port in the suite that reads its corpus, and delete this file.
governs:
  - test/CitationDump.fixtures.ts#CitationDumpCorpus
  - test/CitationHtmlBytes.test.ts#load
  - test/CitationPythonRepr.test.ts#Corpus
  - test/CitationRegexCharacters.test.ts#Facts
  - test/CitationTokenEquality.fixtures.ts#readCitationTokenEquality
enforcedBy: []
---

The Python programs that produced these oracle corpora were deleted with the repository's Python (goal python-free-repo). Each corpus keeps the producer digest as `producerSha256` (and `sourceReaderSha256` where a source reader ran), and the suites replay the corpus without reading or re-hashing the producer.

Recover a producer with `git show 05ed8bc6b6cc50f2a284ed02caaab16f216bb9c3:goals/citation-extraction-engine/ops/<file>`: probe-dump.py (CitationDump), probe-html-bytes.py (CitationHtmlBytes), probe-python-repr.py (CitationPythonRepr), probe-regex-characters.py, probe-regex-program.py and probe-regex-compatibility.py (CitationRegexCharacters), probe-token-equality.py (CitationTokenEquality).

Reason: tracked Python is no longer admitted, and the recovery commit's bytes match every pinned digest (goals/citation-extraction-engine/history/2026-11-13-python-removed.md).

Rejected: keeping the Python producers in the tree, and regenerating the corpora from a TypeScript port before the suites may run.
