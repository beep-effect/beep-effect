# Friction receipts

## Source family audit: parent traversal is insufficient

The first continuity collector followed reported parents but did not query
reported US child identifiers. Independent source-only review found 55 of 96
candidates had at least one unqueried application identifier, including 19
with unqueried US nodes. The nominal locally closed subset was 41, rather
than 50. Legacy-side unresolved branches can also bridge apparently separate
candidate components. Earlier receipts remain unchanged; no source family or
annotation was qualified. A new bounded bidirectional collection follows
reported US parents and children and retains every unavailable record.

Prevent recurrence by treating every observed unqueried application node as
an explicit unresolved edge, auditing candidate and legacy sides, and never
using a drained parent-only queue as evidence of family disjointness.

## Source acquisition: official redirects need scoped credentials

The first pilot download attempt recorded two HTTP 302 responses and then an
HTTP 429; no archive was acquired. The corrected acquisition follows the
existing USPTO driver's official document-host policy and creates a fresh
credential-free request on the document host. The earlier failure receipt is
retained. HTTP rate limits stop that acquisition; they are not evidence that
1Password access is broken and do not justify asking for new credentials.
