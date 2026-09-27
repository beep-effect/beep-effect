# Property helper dependency cache review

The new workspace development dependency adds exactly one fc-runs dependency
edge to each listed computation, following its existing upstream task rule.
Commands, effective configuration, dependency multiplicities and every unrelated
node remain unchanged. Existing source-digest review notices are not silently
rebaselined. No qualification scope, profile, epoch, lifecycle state or cache
eligibility is changed.

- `@beep/dock#audit`: `@beep/fc-runs#audit`
- `@beep/dock#build`: `@beep/fc-runs#build`
- `@beep/dock#check`: `@beep/fc-runs#build`
- `@beep/dock#coverage`: `@beep/fc-runs#build`
- `@beep/dock#doctest`: `@beep/fc-runs#transit`
- `@beep/dock#lint:deprecated-apis`: `@beep/fc-runs#transit`
- `@beep/dock#package-test-typecheck`: `@beep/fc-runs#transit`
- `@beep/dock#test`: `@beep/fc-runs#transit`
- `@beep/dock#test:integration`: `@beep/fc-runs#build`
