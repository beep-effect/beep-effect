# Claim inspection cache baseline review basis

This proposal records the actual input changes at integrated head `7f433b5b8b6c330bd7e8256eb4b886d184d77ae7`. It does not grant cache qualification, change scope/profile/epoch, or add exception/debt rows. The existing audit reports ten blocking cached-task dependency changes and three nonblocking configuration-source changes. The full projection comparison additionally includes uncached task changes; all 23 changed computations are named below.

The claim server manifest adds the existing `@beep/wink` workspace dependency and ClaimInspection export. The use-cases manifest adds the existing `@beep/nlp-processing` workspace dependency. Their script commands and task cache settings are unchanged. Dependency edges must be recorded so prior tuples cannot masquerade as the new runtime.

The accepted-main root Turbo changes disable caching for five policy tasks and add the toolchain-digest environment-key declaration. The accepted-main identity input change excludes `.repos`; the types input change removes duplicate/excluding patterns and includes compiler/gitignore inputs. These three Turbo files are byte-identical to accepted main. No environment values are recorded.

| Computation | Changed input or dependency |
| --- | --- |
| `//#lint:entity-kit-freeze` | Accepted-main root Turbo: cache true → false; add `BEEP_CACHE_TOOLCHAIN_DIGEST` key to env. |
| `//#lint:markdown-fences` | Accepted-main root Turbo: cache true → false; add `BEEP_CACHE_TOOLCHAIN_DIGEST` key to env. |
| `//#lint:opaque-roundtrips` | Accepted-main root Turbo: cache true → false; add `BEEP_CACHE_TOOLCHAIN_DIGEST` key to env. |
| `//#lint:retired-effect-paths` | Accepted-main root Turbo: cache true → false; add `BEEP_CACHE_TOOLCHAIN_DIGEST` key to env. |
| `//#lint:retired-iri-authorities` | Accepted-main root Turbo: cache true → false; add `BEEP_CACHE_TOOLCHAIN_DIGEST` key to env. |
| `@beep/identity#lint` | Accepted-main identity Turbo: add `!../../../../.repos/**` input exclusion. |
| `@beep/law-practice-server#build` | Add `@beep/wink#build`; removed none |
| `@beep/law-practice-server#check` | Add `@beep/wink#build`; removed none |
| `@beep/law-practice-server#coverage` | Add `@beep/wink#build`; removed none |
| `@beep/law-practice-server#doctest` | Add `@beep/wink#transit`; removed none |
| `@beep/law-practice-server#lint:deprecated-apis` | Add `@beep/wink#transit`; removed none |
| `@beep/law-practice-server#package-test-typecheck` | Add `@beep/wink#transit`; removed none |
| `@beep/law-practice-server#test` | Add `@beep/wink#transit`; removed none |
| `@beep/law-practice-server#test:integration` | Add `@beep/wink#build`; removed none |
| `@beep/law-practice-server#test:integration:parallel` | Add `@beep/wink#build`; removed none |
| `@beep/law-practice-use-cases#build` | Add `@beep/nlp-processing#build`; removed none |
| `@beep/law-practice-use-cases#check` | Add `@beep/nlp-processing#build`; removed none |
| `@beep/law-practice-use-cases#coverage` | Add `@beep/nlp-processing#build`; removed none |
| `@beep/law-practice-use-cases#lint:deprecated-apis` | Add `@beep/nlp-processing#transit`; removed none |
| `@beep/law-practice-use-cases#package-test-typecheck` | Add `@beep/nlp-processing#transit`; removed none |
| `@beep/law-practice-use-cases#test` | Add `@beep/nlp-processing#transit`; removed none |
| `@beep/law-practice-use-cases#test:property` | Add `@beep/nlp-processing#transit`; removed none |
| `@beep/types#lint` | Accepted-main types Turbo: include compiler and gitignore inputs; remove duplicate/excluding patterns. |

Reviewed subjects: `//`, `@beep/identity`, `@beep/law-practice-server`, `@beep/law-practice-use-cases`, `@beep/types`. Global cache configuration and all 23 task commands are unchanged. All other projected nodes are unchanged.

Exact changed-input bindings:

- `packages/law-practice/server/package.json`: SHA-256 `01310fc5f85d38441704114c868e8bff79bcbb014f82ed205cc9705a2dc3db2b`; accepted-main exact: false.
- `packages/law-practice/use-cases/package.json`: SHA-256 `f4851f6580270cd5bbe229ac46e99bb204e8d70c32e9855a418602cbf59b818a`; accepted-main exact: false.
- `packages/foundation/modeling/identity/turbo.json`: SHA-256 `91fae88ab5bd2b458852a0bde1d2cee7fc81e2045ad0256c63bf2b10d66cfed3`; accepted-main exact: true.
- `packages/foundation/primitive/types/turbo.json`: SHA-256 `06e627058b8867187be271aa6ca71ce0d487ba42d2260feb0864212dd6a486c6`; accepted-main exact: true.
- `turbo.json`: SHA-256 `be1227e514ca4e6fb17ce0d334b2380f8cb14fdabd42799185f8dea3e702de84`; accepted-main exact: true.

The baseline request must bind the exact current baseline text hash and this basis text hash, and copy scope/profile/epoch unchanged. Review is required before submission. Original evaluation references, fixtures, scorers and results remain unchanged.
