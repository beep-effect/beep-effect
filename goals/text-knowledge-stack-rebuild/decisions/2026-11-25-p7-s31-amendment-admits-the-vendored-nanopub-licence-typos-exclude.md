---
title: "S31 amendment: the typos exclude for the vendored nanopublication licence is admitted"
date: 2026-11-25
lane: "p7"
reversal: "Drop the LICENSE line and the vendored-attribution type from _typos.toml together with the vendored nanopub-nschema directory, if the operator withdraws the 2026-11-23 vendoring ruling"
---

P4 commit 81f51e566b4 added one `_typos.toml` exclude, `packages/foundation/modeling/rdf/data/vocab/nanopub-nschema/LICENSE`, and a `vendored-attribution` file type that allows two upstream author surnames in `VENDORED.md`. Against the P0 base f9982f3b5e6 that is one new inventory entry, which SPEC Constraints S31 forbids without an admitting decision. The operator ruled on 2026-11-23 that the nschema.html notice covers the TTL, so the schema is vendored byte-for-byte with its CC BY-SA 3.0 legal code (decision `2026-11-23-p4-nanopub-vendored-under-cc-by-sa`). The licence must stay byte-faithful to upstream, so its spelling cannot be corrected and the file cannot be renamed to escape the scan without breaking the attribution `VENDORED.md` records. This decision admits the exclude, and the surname allowlist with it, as an explicit S31 amendment, scoped to that one vendored file and that one attribution file type. Nothing else in the vendored tree is excluded.
