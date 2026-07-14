# Bubble shrinkwrap proof

This module proves chat-bubble geometry can be computed from schema values.

The checked-in `@beep/pretext` fixture supplies per-word font advances.
`lineStats` turns those advances into greedy line count and widest-line data.
`bubbleBox` adds schema-validated width constraints and padding.

Short messages shrinkwrap to their measured content width.
Long messages clamp to the configured content width and grow vertically.
Unknown words return `Option.none` instead of guessed geometry.
Padding defaults live in the schema rather than helper logic.
Author roles are a `LiteralKit` domain and round-trip through Schema.

Run: `bun test scratchpad/bubbles`

See [`explorations/computable-workspace-geometry`](../../explorations/computable-workspace-geometry/README.md).
