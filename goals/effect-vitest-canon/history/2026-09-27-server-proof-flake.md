# Kernel scenario isolation

Serialize the named AnthropicTurnKernel layer suite because its module mock owns
one mutable scenario record read by stream and repair callbacks. Preserve the
module-function/execution-plan seam and all six original token/error/block cases.
No global Vitest setting, timeout or retry changes.

A temporary overlap guard passes all six cases with sequential registration.
Changing only that registration to concurrent makes five cases fail the guard.
All three temporary inverted property-oracle controls also fail as intended and
restore source bytes. The parity failure names its schema; native diagnostics
retain the fixed replay seed. These are test-side controls, not production edits.
