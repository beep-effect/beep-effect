# Provenance assertion phase

Two TextAnchor Result boolean assertions now use public assertFailure with the
SchemaError tag and exact width-check message. Both original decode operands
are unchanged. Full package verification passed: audit 5.8 seconds and docgen
2.7 seconds. This phase preceded property registration changes.
