# Consolidated cache dependency review

Preserve the separately reviewed dependency changes from the constituent PRs.
Only disjoint or identical node changes are combined; all other projection
metadata and qualification fields must remain identical to the merge base.

## Incoming 166721d72c510a04092462f15fbdb5bd8c06e736

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
