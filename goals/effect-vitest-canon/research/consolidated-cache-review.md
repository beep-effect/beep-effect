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

## Incoming a97ca9c183b2cf7cdacb4a5c78bfcb5b949bbaae

- `@beep/shared-domain#audit`
- `@beep/shared-domain#build`
- `@beep/shared-domain#check`
- `@beep/shared-domain#coverage`
- `@beep/shared-domain#lint:deprecated-apis`
- `@beep/shared-domain#package-test-typecheck`
- `@beep/shared-domain#test`
- `@beep/shared-domain#test:property`
