# ACP runner dependency review

Accept only the 11 existing ACP task dependency lists gaining their declared
@beep/test-runner edges. Computation identities, commands, digests, effective
configuration, profile, epoch, scope and source records remain unchanged.
Every other package and existing duplicate edge remains unchanged. This grants
no qualification or additional reuse. Prior main review remains covered by
html-main-cache-review.md.

- `@beep/acp#audit`: add `@beep/test-runner#audit`
- `@beep/acp#build`: add `@beep/test-runner#build`
- `@beep/acp#check`: add `@beep/test-runner#build`
- `@beep/acp#codegen`: add `@beep/test-runner#codegen`
- `@beep/acp#coverage`: add `@beep/test-runner#build`
- `@beep/acp#lint:deprecated-apis`: add `@beep/test-runner#transit`
- `@beep/acp#package-test-typecheck`: add `@beep/test-runner#transit`
- `@beep/acp#test`: add `@beep/test-runner#transit`
- `@beep/acp#test:integration`: add `@beep/test-runner#build`
- `@beep/acp#test:integration:parallel`: add `@beep/test-runner#build`
- `@beep/acp#test:property`: add `@beep/test-runner#transit`
