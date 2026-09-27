# Lint-rules final boundary review

Final detector review found an EV005 candidate introduced by the new malformed
report tests. Replaced the Result failure branch with Effect.flip: unexpected
success now fails the effect directly, while the error type, original small
stdout, and cause-presence assertions remain. No expected Cause was fabricated.

The existing observability charter also explicitly requires bounded diagnostic
streams. Error stdout and stderr fields now retain at most 4096 characters;
normal report decoding still consumes the complete stdout. The typed decoding
cause remains available. Two new cases assert the bounds with 5000-character
inputs, preserving the full existing 78-case suite. Full package audit
(12.4 seconds) and docgen (2.1 seconds) pass.
