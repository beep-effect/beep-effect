### sol-2-1
- file: scratchpad/test/xdg/AppDirs.test.ts:266
- class: test   severity: backlog
- standard: D11 — optional test strengthening is backlog when no implementation bug or cited law violation is established.   evidence: At the reviewed commit, the test titled “4. the fallback dir beats the dot-dir” supplies `namespace: "myapp"` and `fallbackDir: ".myapp"` and expects `/home/ada/.myapp` for all four directory kinds. In `AppDirs.ts:340–341`, the configured fallback and the default floor therefore produce identical paths. Removing the `options.fallbackDir` branch would leave these assertions, and the other resolution cases using that same fallback, satisfied. The distinct `".fallback"` input at test line 131 is only decoded as options; it is never resolved. This blind spot is inherited from the pinned oracle and is not detected by branch coverage or the schema round-trip properties.
- failure: The suite cannot detect a regression that ignores `fallbackDir`, despite claiming to verify that it wins over the default dot-directory.
- fix: Retain the upstream cases and add one resolution case with `namespace: "myapp"`, `fallbackDir: ".other"`, and no higher-precedence inputs. Assert that config, data, cache, and state all resolve to `/home/ada/.other`.

REQUIRED: 0
BACKLOG: 1