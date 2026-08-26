# Raw corpus pointer

The committed ledgers contain 390 page rows, 148 PDF rows, and 12 attachment rows. The payloads
mined on 2026-08-25 live **machine-local** at `~/data-home/lejeune-bolt-corpus/` and are never
committed. This repo is public, and the pages are a third party's content. Only the
[`site` ledger](./site/INDEX.md), [`PDF` ledger](./site/pdf/INDEX.md), and
[`attachment` ledger](./site/attachments/INDEX.md) are kept here. Their payload rows use
plain-text paths under `~/data-home/lejeune-bolt-corpus/site/` instead of broken repository
links. Regenerate with [`mine-site.ts`](../../ops/mine-site.ts), with rationale in
[`08-demo-options.md`](../08-demo-options.md) and the refusal lesson in
[`OPPORTUNITIES.md`](../OPPORTUNITIES.md).
