---
"@beep/discord": patch
---

Crispen `@beep/discord` for the P2 repo-crispening wave: move Discord base URL normalization into the config schema, colocate request and raw-response decoders on their schemas, reattach LiteralKit statics on `DiscordErrorReason`, model optional proof/error metadata as `Option` fields with constructor defaults, tighten snowflake and numeric HTTP status fields, remove heterogeneous `R.getSomes` compaction by passing schema-owned Options directly, and add package-local encoded-shape plus `S.toArbitrary` parity laws. Public encoded wire shapes remain unchanged.
