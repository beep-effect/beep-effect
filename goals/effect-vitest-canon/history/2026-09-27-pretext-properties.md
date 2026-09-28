# Pretext provenance oracle phase

The existing fixture provenance case now compares the returned sentence, capture
timestamp, engine, platform, engine profile, oracle and DOM line-count data with
the independently decoded canned fixture. Its original sentence-presence check
remains. Every original test-body byte outside these added assertions remains
unchanged. The fixed DOM oracle and independent layout parity checks are retained;
this package has no manual randomized property engine to migrate.

A temporary controlled mutation changed only the returned capturedAt value. The
new provenance oracle failed on that value while the unchanged sentence-presence
check remained satisfied. The source was restored byte-for-byte after the probe.

Node and Bun each pass 24 cases and retain the existing single browser-only skip.
Whole-command observations are 3.620831 and 1.466307 seconds, with stable source
hashes. Full package audit and docgen pass. No schema domain, test floor, skip
condition or production implementation changes in this phase.
