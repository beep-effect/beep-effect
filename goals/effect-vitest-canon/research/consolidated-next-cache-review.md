# Consolidated next batch dependency review

Accept only test-runner development-dependency edges for OnePassword CLI,
Shared Tables and M365 MCP. All command/configuration fields match the census;
no dependency is removed, and existing multiplicity is preserved. Unrelated
nodes, sources, profile, epoch, scope and qualification state are unchanged.

- `@beep/m365-mcp#audit`: `@beep/test-runner#audit`
- `@beep/m365-mcp#build`: `@beep/test-runner#build`
- `@beep/m365-mcp#check`: `@beep/test-runner#build`
- `@beep/m365-mcp#coverage`: `@beep/test-runner#build`
- `@beep/m365-mcp#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/m365-mcp#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/m365-mcp#test`: `@beep/test-runner#transit`
- `@beep/m365-mcp#test:integration`: `@beep/test-runner#build`
- `@beep/m365-mcp#test:property`: `@beep/test-runner#transit`
- `@beep/onepassword-cli#audit`: `@beep/test-runner#audit`
- `@beep/onepassword-cli#build`: `@beep/test-runner#build`
- `@beep/onepassword-cli#check`: `@beep/test-runner#build`
- `@beep/onepassword-cli#coverage`: `@beep/test-runner#build`
- `@beep/onepassword-cli#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/onepassword-cli#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/onepassword-cli#test`: `@beep/test-runner#transit`
- `@beep/onepassword-cli#test:integration`: `@beep/test-runner#build`
- `@beep/onepassword-cli#test:property`: `@beep/test-runner#transit`
- `@beep/shared-tables#audit`: `@beep/test-runner#audit`
- `@beep/shared-tables#build`: `@beep/test-runner#build`
- `@beep/shared-tables#check`: `@beep/test-runner#build`
- `@beep/shared-tables#coverage`: `@beep/test-runner#build`
- `@beep/shared-tables#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/shared-tables#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/shared-tables#test`: `@beep/test-runner#transit`
