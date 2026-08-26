# Raw corpus pointer

The lejeunebolt.com corpus mined on 2026-08-25 (392 page dumps, 149 PDF
records, attachments) lives **machine-local** at
`~/data-home/lejeune-bolt-corpus/` and is never committed — this repo is
public and the pages are a third party's content. Only the
[`site` ledger](./site/INDEX.md), [`PDF` ledger](./site/pdf/INDEX.md), and
[`attachment` ledger](./site/attachments/INDEX.md) are kept here. Their payload
rows use plain-text paths under `~/data-home/lejeune-bolt-corpus/site/` instead
of broken repository links. Regenerate with the mining workflow in
[`08-demo-options.md`](../08-demo-options.md) (request-profile lesson in
[`../OPPORTUNITIES.md`](../OPPORTUNITIES.md)).
