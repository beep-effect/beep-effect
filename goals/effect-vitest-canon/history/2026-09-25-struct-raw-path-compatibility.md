# Struct runtime compatibility coverage

The reviewed inventory identified lost runtime coverage after five casted mapper
calls were replaced by correctly typed options.path calls in the utils wave.
The production pathFromOptions fallback still accepts raw strings and tuples.

Five explicit compatibility tests now exercise raw string and tuple paths,
undefined lookup, a lazy numeric mapping and lookup after mutation. They use
Reflect.apply at the runtime boundary and assert that lazy results are callable
before invocation. The typed data-first/data-last tests remain unchanged.
No production API, fallback, property run count or timeout changed.

Full package verification passed: audit 8.4 seconds and docgen 4.3 seconds.
The first attempt caught missing TypeScript narrowing on an unknown thunk;
Effect Predicate narrowing repaired that issue before the successful run.

Node Vitest passed 189 tests before and 194 tests after. Whole-command time was
0.907 seconds before and 1.849 seconds after. Both captures retained stable
source hashes, runtime versions, CPU/memory/I/O pressure and process limits.
These are single-run observations with different test counts, not a causal
performance comparison. Raw reports and context remain in the private goal cache.

The source repair is ready for PR review. The new compatibility finding is not
marked complete until publication and review evidence is recorded. The original
two false-data-last findings retain their historical fixed dispositions.
Benjamin retains merge authority.
