# Current 4.0.1 cohort qualification, 2026-10-06

Source base: `2208622aa8d0a5765769e3950c44ec9e81be9ceb`. Installed Effect and Effect Vitest are 4.0.1; Vitest is 5.0.3 and Bun 1.4.2. The immutable adapter tag resolves to `460272d30457f4697d8b8c52cad41caccbcace08`. Earlier cohort receipts remain unchanged.

## API provenance

The installed adapter index, utils, internal runner and README equal the corresponding immutable-tag files byte for byte. Supplementary Effect files contain documentation/formatting differences. Complete TypeScript parse and normalized AST printing with comments removed produces identical output for Arbitrary, Effect, Layer, Logger and TestClock at the tag and installed source, with no parse diagnostics. TestClock also matches byte for byte. This comparison establishes the inspected module declarations and implementation structure; it is not runtime proof or a blanket equality claim about the entire Effect distribution.

| Module | Normalized immutable/installed SHA-256 |
| --- | --- |
| Arbitrary.ts | `ee3a3fd6dd2b1251641b80402113696dfa5738408dbe4827d519ceefefaf0478` |
| Effect.ts | `14056e418d0e01db7303c788310af2f0fb93590bd1e0f450dd57c44ef912de32` |
| Layer.ts | `4ca8abb751dea3ef826c8a7501efafab79fb2b3e7e6784e56d914688e7e06131` |
| Logger.ts | `31499b0bb88366925c456bba2ec58a6ca98f45a934de80edb9c24b850d6e1357` |
| testing/TestClock.ts | `bd95394c588de133c483a3eb67882f69d2d1c9a5d1dd160b67b0241bdc3aa219` |

An earlier plain-scanner comparison mis-tokenized a template-expression context in Arbitrary and included later comment text. That probe is retained privately and is not accepted as a semantic difference. The parser-based comparison above supersedes it. Moving reference-checkout line positions were never used to regenerate immutable anchors.

## Focused runtime evidence

| Command scope | Runtime | Result |
| --- | --- | --- |
| Node filesystem conformance, Memory conformance, test-utils Vitest/runtime suites | Node 22.22.3 and Node 24.20.0, separately | 89 passed on each; zero failures, skips or TODOs |
| Bun filesystem conformance, Memory conformance, test-utils Vitest/runtime suites | Bun 1.4.2 | 89 passed; zero failures, skips or TODOs |
| Complete extracted test-runner package suite | Node 22.22.3 and Bun 1.4.2, separately | 46 passed on each; three existing skipped and four existing TODO cases retained; zero failures |
| Effect Vitest contract and primitive graph suites | Node 22.22.3 and Bun 1.4.2, separately | 46 passed on each; zero failures, skips or TODOs |

Commands used the package configuration, explicit filenames for the focused bundles, actual Node executables with root `node_modules/vitest/vitest.mjs`, and the generated package test script for Bun. CI=true was set; no test/property floor or timeout changed. Node and Bun raw JSON reports are retained in the continuation evidence cache. The runner skipped/TODO cases are not passed proof.

The inherited unmodified-base detector check passes with 1,241 files, 1,937 findings, zero introduced and zero resolved. Scanner duration is 7,848.6 ms; complete-command timing and final empty-baseline acceptance remain separate.

These focused results do not replace the new remediation wave package verification, final inventory and lens reconciliation, independent review, following-week timing, exact-head hosted checks, or final goal acceptance.
