# P4 named heading domain repair, 2026-11-06

Source: `3f3b06289764853e3b6f5982e4b80247ac5aabf7`.
Original finding: T11 C2. Full original report and parent review remain private.

The original claim combines two questions. The opaque brands have already been
repaired; repeating that source change would be wrong. The remaining named,
exported `HeadingLevel` still uses `S.Literals`, while current root and schema-first
guidance and the crispen example prescribe `LiteralKit` for a named literal domain.
The source already imports LiteralKit and uses it for other domains.

The repair changes this one schema expression to LiteralKit. It preserves the
six numeric literals and the annotation. No parallel helper or handwritten guard
is added. The new regression checks keyed values, keyed guards and exhaustive
matching, plus successful decoding of 1–6 and rejection of out-of-range,
fractional, string and null inputs. Before the source change, the keyed-helper
test fails on the missing Enum while the existing 24 conformance tests pass.
After the change, all 25 conformance tests pass.

Package and PR proof remain distinct from that focused result. This private
workspace does not accumulate changesets under the repository release policy.
No rendering defect, upstream behavior guarantee or deployed/runtime readiness
is inferred. The normative example is not treated as a verbatim source transcript.

P4 remains in progress. PM's missing original, ADHD provenance, other owners'
repairs and earlier delivery-proof gaps remain separate. No cloud or paid work.

The publication replay exposed a new Effect/Vitest assertion-style finding in the invalid-input loop. Use the existing assertTrue helper in its pipeable form, preserving the Boolean failure check rather than inventing an expected SchemaError payload. The first direct Bun test invocation did not initialize Vitest and failed before any test; the package Vitest command then passed all25 focused tests. Quick package lint and type checking pass after the pipeable assertion change. No baseline allowance was added; previous failed receipts remain private.
