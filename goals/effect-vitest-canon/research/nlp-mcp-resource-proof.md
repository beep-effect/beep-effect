# NLP MCP resource review

The existing streaming outer layers already use native Effect/Vitest layer
registration. The integration fixture helper additionally owns a shorter
acquire/use/release boundary: create a real temporary directory, write the named
fixture, provide that directory as the only allowed root to the complete use
Effect, then recursively remove the directory with cleanup failure propagation.
The data-last streaming test owns the same lifecycle inline for its two fixtures.

Retain these inner boundaries. Replacing them with the outer suite layer would
extend their lifetimes and change allowed-root context. Native filesystem/path
services exercise actual path resolution; a memory copy of expected outputs would
not preserve that subject. Local file cases do not prove HTTP transport behavior.
The wrapper candidates will be dispositioned with this evidence during final
owned-inventory reconciliation, after the remaining phases are complete.

Four paired controls exercise both release sites. Each performs the real recursive
removal before injecting a cleanup failure. The current `orDie` release makes its
selected registration fail with that error. An otherwise identical `ignore`
release incorrectly passes. All source bytes are restored after the controls.

Full package verification on the restored source passes: audit 8.9 s and docgen
3.5 s. Unchanged-source Node and Bun baselines each pass 37 registrations with no
skips. Stable source hashes and load/pressure context accompany their 4.5212 s and
2.5679 s whole-command observations; these are not causal performance measurements.

The saved SSRF and line-sampling oracle findings remain open. The handler layer
captures the HTTP client at construction, so a recording client must be provided
while constructing that layer to prove zero outbound execution. A call-local
replacement around an already constructed handler would not test that boundary.
No production source change or newly discovered production vulnerability is claimed.
