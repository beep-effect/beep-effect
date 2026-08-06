---
{}
---

No release: add `bun run beep codex findings ingest`, which turns the signed-in
Codex Cloud **Export findings as CSV** download into a doctor-clean goal packet
sitting at the P1 capture → P2 validate boundary.

Five security batches were transcribed by hand before this existed. The command
replaces steps 3-9 of that loop: sanitize, normalize, assign identifiers, render
the manifest, triage ledger, per-finding records, index, and launcher templates,
then promote the whole packet with one atomic rename.

The CLI never authenticates. It reads a file the operator already downloaded, so
no cookie, token, or authorization header is read, stored, logged, or placed on
a process command line. `author_email`, `assignee_name`, and `assignee_email`
are dropped at the parse boundary, and the reject-scan independently refuses
email addresses, secret-shaped values, private paths, bidi controls, and
spreadsheet-formula sigils — rejecting rather than redacting, because missed
redaction in a public repository is irreversible.

Identifiers are sticky: re-ingesting preserves each `codexId -> CSF-NNN` binding
and never reuses a number, so hand-written triage prose and the post-merge close
allowlist keep meaning what they meant.
