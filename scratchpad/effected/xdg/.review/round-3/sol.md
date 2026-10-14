### sol-3-1

- file: scratchpad/effected/xdg/Xdg.ts:100
- class: docs   severity: backlog
- standard: `.patterns/jsdoc-documentation.md` → Purpose (documentation teaches callers the API); D11; D9 preserves the existing error behavior.   evidence: Read-only `bun --no-cache -e` probes against both the port and the pinned oracle supplied a `ConfigProvider.make` provider that successfully returned `HOME` and failed subsequent lookups with `ConfigProvider.SourceError`. Both returned `{"tag":"XdgEnvError","variable":"XDG_CONFIG_HOME","message":"The XDG_CONFIG_HOME environment variable is not set","causeTag":"ConfigError"}`. The implementation explicitly preserves optional-variable provider failures at lines 263–280. Docgen compilation and coverage do not check the accuracy of these prose claims.
- failure: The `XdgEnvError` documentation says it is “Raised only for `HOME`,” and the `Xdg` documentation repeats that an unset `HOME` is “the only failure” at line 213. Callers using a filesystem-backed or custom provider can encounter this typed error while reading any optional variable even when `HOME` is valid. This is an inherited documentation inaccuracy; the runtime behavior matches the oracle.
- fix: Qualify both statements: missing or empty `HOME` fails, absent optional variables resolve normally, and provider failures for any variable propagate as `XdgEnvError`. Update the `variable` field description at line 118 to identify the variable whose lookup failed. Preserve the existing error channel and message behavior.

REQUIRED: 0
BACKLOG: 1