# mcp-kit runner dependency merge review

Preserve the cache projection from main at `7980e5aaa1e1b4480df85a20092242a6bf4b9a4c`.
Apply only the existing wave runner dependency additions listed below, preserving
all dependency multiplicities, commands, configuration and unrelated nodes.
This does not widen cache eligibility or qualify unassessed tuples.

- `@beep/mcp-kit#audit`
- `@beep/mcp-kit#build`
- `@beep/mcp-kit#check`
- `@beep/mcp-kit#coverage`
- `@beep/mcp-kit#doctest`
- `@beep/mcp-kit#lint:deprecated-apis`
- `@beep/mcp-kit#package-test-typecheck`
- `@beep/mcp-kit#test`
- `@beep/mcp-kit#test:integration`
- `@beep/mcp-kit#test:property`
