# leaves-checkpoint runner dependency merge review

Preserve the cache projection from main at `7980e5aaa1e1b4480df85a20092242a6bf4b9a4c`.
Apply only the existing wave runner dependency additions listed below, preserving
all dependency multiplicities, commands, configuration and unrelated nodes.
This does not widen cache eligibility or qualify unassessed tuples.

- `@beep/brand#audit`
- `@beep/brand#build`
- `@beep/brand#check`
- `@beep/brand#coverage`
- `@beep/brand#lint:deprecated-apis`
- `@beep/brand#package-test-typecheck`
- `@beep/brand#test`
- `@beep/brand#test:integration`
- `@beep/chalk#audit`
- `@beep/chalk#build`
- `@beep/chalk#check`
- `@beep/chalk#coverage`
- `@beep/chalk#doctest`
- `@beep/chalk#lint:deprecated-apis`
- `@beep/chalk#package-test-typecheck`
- `@beep/chalk#test`
- `@beep/chalk#test:property`
- `@beep/ciops#audit`
- `@beep/ciops#build`
- `@beep/ciops#check`
- `@beep/ciops#dev`
- `@beep/ciops#lint:deprecated-apis`
- `@beep/ciops#package-test-typecheck`
- `@beep/ciops#test`
- `@beep/discord#audit`
- `@beep/discord#build`
- `@beep/discord#check`
- `@beep/discord#coverage`
- `@beep/discord#lint:deprecated-apis`
- `@beep/discord#package-test-typecheck`
- `@beep/discord#test`
- `@beep/discord#test:integration`
- `@beep/discord#test:property`
