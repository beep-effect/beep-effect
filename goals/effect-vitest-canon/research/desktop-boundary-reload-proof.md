# Surface boundary manual reload must start a new attempt

The manual Reload test now requires the crashing child render count to increase
after the click. The original upper bound of eight renders per attempt and the
visible Reload button assertion remain intact, as do the self-heal, healthy-child,
and exact sanitized-log assertions in the other cases.

A control installed a temporary click listener that stopped propagation before
React's handler could run. The original test passed with this inert Reload button;
the strengthened test failed at the new positive render-count assertion. The
listener was removed before normal suite and package validation. Removing the
single new assertion reproduces the original file byte for byte. No production
code, retry allowance, clock behavior, or timeout changed.
