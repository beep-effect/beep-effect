# API docs runner dependency cache review

Replacing the now-unused test-utils dependency with test-runner changes only
the existing upstream dependency edges below. Commands, effective configuration,
all unrelated nodes and qualification scope/eligibility remain unchanged.

- `@beep/api-docs#audit`: `@beep/test-utils#audit` → `@beep/test-runner#audit`
- `@beep/api-docs#build`: `@beep/test-utils#build` → `@beep/test-runner#build`
- `@beep/api-docs#check`: `@beep/test-utils#build` → `@beep/test-runner#build`
- `@beep/api-docs#dev`: `@beep/test-utils#build` → `@beep/test-runner#build`
- `@beep/api-docs#lint:deprecated-apis`: `@beep/test-utils#transit` → `@beep/test-runner#transit`
- `@beep/api-docs#package-test-typecheck`: `@beep/test-utils#transit` → `@beep/test-runner#transit`
- `@beep/api-docs#test`: `@beep/test-utils#transit` → `@beep/test-runner#transit`
