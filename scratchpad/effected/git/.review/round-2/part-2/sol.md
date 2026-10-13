### sol-2-1

- file: scratchpad/effected/git/internal/config.ts:313
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; git-config syntax.   evidence: A read-only probe supplied `[remote"origin"]\nurl=u\n` to `git config --file /dev/stdin --null --list` on Git 2.56.0; Git exited 128. Both `GitConfig.parseResult` in the port and the pinned oracle succeeded, producing section `remote`, subsection `origin`, and value `u`. `scanHeader` skips optional whitespace before accepting `"`, without requiring any separator.
- failure: The parser accepts malformed configuration that Git cannot read. `Gitmodules.parseResult` also accepts the equivalent malformed submodule header through this scanner.
- fix: Record the end of the section name and require at least one horizontal whitespace character before a quoted subsection. Add a public parsing regression for the missing separator, retain space/tab acceptance, and record the verified upstream-bug deviation under §14.

### sol-2-2

- file: scratchpad/effected/git/internal/config.ts:366
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; Git’s deprecated dotted subsection syntax.   evidence: For `[remote.]\nurl=u\n`, the read-only command `git config --file /dev/stdin --null --list` exited 0 and returned `remote..url\nu\0`. Both the port and pinned oracle returned `GitConfigParseError`, with `invalidSectionHeader` and `invalidLine` diagnostics. The new test at `scratchpad/test/git/internal/config.coverage.test.ts:71` explicitly expects this valid header to fail.
- failure: Valid configuration containing an empty dotted subsection cannot be parsed, although the equivalent quoted empty subsection is representable by the module.
- fix: Remove the `subsection === ""` rejection from the dotted-header check while retaining rejection of an empty section name. Replace the erroneous coverage expectation with successful parsing and empty-subsection lookup assertions; record the verified upstream-bug deviation under §14.

### sol-2-3

- file: scratchpad/effected/git/internal/config.ts:463
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; Git value parsing at EOF.   evidence: For `[core]\nx=first\` with the final backslash immediately followed by EOF, `git config --file /dev/stdin --get core.x` exited 0 and returned `first\n`. Both the port and pinned oracle rejected it with `invalid escape sequence \ in value of "x"`. The same divergence occurs after a closed quoted value, `[core]\nx="first"\`. The added coverage test at `scratchpad/test/git/internal/config.coverage.test.ts:35` pins the incorrect rejection.
- failure: Valid configuration without a final newline fails parsing when its value ends with a backslash; Git drops that final backslash.
- fix: Handle a backslash followed immediately by EOF by dropping it and ending value scanning. Keep the subsequent unterminated-quote check so an open quoted value still fails. Retarget the coverage assertion, add public parser regressions, and record the verified upstream-bug deviation under §14.

### sol-2-4

- file: scratchpad/effected/git/internal/config.ts:439
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; Git value semantics for a terminal carriage return.   evidence: For `[core]\nx=a\r`, `git config --file /dev/stdin --null --list` exited 0 and returned `core.x\na\0`. Both the port and pinned oracle decoded `x` as `"a\r"`. The value loop recognizes CRLF but treats a lone CR at EOF as significant value content. Round-1 `git-r15` and its regression tests cover line/header/bare-key boundaries; they do not assert decoded values at this boundary.
- failure: The effective value differs from Git’s value. For example, a `.gitmodules` URL on the final line acquires an extra carriage return when read through this parser.
- fix: Recognize a carriage return at EOF as a value line terminator, preserving the original source text and spans. Add decoded-value assertions for terminal CR alongside CRLF and embedded-CR preservation cases; record the verified upstream-bug deviation under §14.

### sol-2-5

- file: scratchpad/effected/git/internal/config.ts:421
- class: law   severity: required
- standard: `standards/effect-first-development.md` EF-3: never use `JSON.parse` / `JSON.stringify`; use schema JSON codecs. D5 and D11.   evidence: Source inspection finds production `JSON.stringify` calls here and at `scratchpad/effected/git/Gitmodules.ts:160`, both present in the reviewed commit despite the reported green gates. These synchronous diagnostic paths therefore remain a gate miss. Round-1 rejected record `git-x1` explicitly confirms that the narrower native-runtime checker does not override EF-3; the recorded deviations do not authorize retaining these calls.
- failure: Scanner diagnostics and `GitmodulesDecodeError.message` still perform native JSON encoding outside the required schema codec path.
- fix: Encode the diagnostic strings through a module-local `S.fromJsonString(S.String)` codec using the deliberately synchronous Result API. Preserve exact quoting, escaping, messages, and failure behavior at both production sites.

### sol-2-6

- file: scratchpad/effected/git/GitCommand.ts:54
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b; `standards/effect-laws-v1.md` laws 17 and 19; `standards/ARCHITECTURE.md` §5; D5 and D11.   evidence: `GitArg` is a named, reused pure-data domain comprising ordinary arguments and sensitive arguments. Its `"value" | "url"` redaction vocabulary is handwritten, constructed independently by `secretValue` and `secretUrl`, and consumed by the redaction branch at line 112. No runtime schema owns this domain. The reported green gates leave this declaration intact, as they did the named literal domains identified in round 1.
- failure: The argument model and redaction policies have only a compile-time contract, rather than the required schema-derived domain, vocabulary, and guards.
- fix: Define an identity-annotated, module-local redaction `LiteralKit` and a `GitArg` schema combining strings with the existing `{ redact, value }` shape; derive the type from that schema. Preserve raw argv, redacted argv, and the existing private carrier shape.

REQUIRED: 6
BACKLOG: 0