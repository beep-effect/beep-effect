# Observability runner dependency cache review

The new workspace development dependency adds exactly one test-runner dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/ffmpeg#audit`: `@beep/test-runner#audit`
- `@beep/ffmpeg#build`: `@beep/test-runner#build`
- `@beep/ffmpeg#check`: `@beep/test-runner#build`
- `@beep/ffmpeg#coverage`: `@beep/test-runner#build`
- `@beep/ffmpeg#lint:deprecated-apis`: `@beep/test-runner#transit`
- `@beep/ffmpeg#package-test-typecheck`: `@beep/test-runner#transit`
- `@beep/ffmpeg#test`: `@beep/test-runner#transit`
- `@beep/ffmpeg#test:integration`: `@beep/test-runner#build`
- `@beep/ffmpeg#test:integration:parallel`: `@beep/test-runner#build`
- `@beep/ffmpeg#test:property`: `@beep/test-runner#transit`
