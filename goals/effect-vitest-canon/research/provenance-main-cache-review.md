# provenance runner dependency merge review

Preserve the cache projection from main at `7980e5aaa1e1b4480df85a20092242a6bf4b9a4c`.
Apply only the existing wave runner dependency additions listed below, preserving
all dependency multiplicities, commands, configuration and unrelated nodes.
This does not widen cache eligibility or qualify unassessed tuples.

- `@beep/provenance#audit`
- `@beep/provenance#build`
- `@beep/provenance#check`
- `@beep/provenance#coverage`
- `@beep/provenance#doctest`
- `@beep/provenance#lint:deprecated-apis`
- `@beep/provenance#package-test-typecheck`
- `@beep/provenance#test`
- `@beep/provenance#test:property`
