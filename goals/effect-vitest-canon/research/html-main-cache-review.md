# html runner dependency merge review

Preserve the cache projection from main at `7980e5aaa1e1b4480df85a20092242a6bf4b9a4c`.
Apply only the existing wave runner dependency additions listed below, preserving
all dependency multiplicities, commands, configuration and unrelated nodes.
This does not widen cache eligibility or qualify unassessed tuples.

- `@beep/html#audit`
- `@beep/html#build`
- `@beep/html#check`
- `@beep/html#coverage`
- `@beep/html#doctest`
- `@beep/html#lint:deprecated-apis`
- `@beep/html#package-test-typecheck`
- `@beep/html#test`
- `@beep/html#test:integration`
- `@beep/html#test:property`
