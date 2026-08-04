# Upstream issue draft — @effect/tsgo effectFnOpportunity coverage gaps

Status: DRAFT for operator filing (external-repo write is needs-operator).
Target repo: the @effect/tsgo issue tracker (bundled language-service
diagnostics). File under the operator's GitHub auth; paste body below.
Origin: speed-loop probe harvest #38 (2026-08-04, 8-agent adversarially
verified shape matrix); grill #4 decision 22.

---

**Title:** `effectFnOpportunity` never fires on method declarations or
callback-position generator functions

**Body:**

The `effectFnOpportunity` diagnostic (suggest `Effect.fn`/`Effect.fnUntraced`
for functions returning `Effect.gen(...)`) currently skips two shapes that
account for a large share of real-world occurrences in Effect-heavy
codebases:

1. **MethodDeclaration owners.** A class or object-literal *method* whose
   body returns `Effect.gen(function* () { ... })` produces no diagnostic;
   the equivalent function declaration or arrow-function property does.

   ```ts
   class UserService {
     // no effectFnOpportunity reported here
     findById(id: UserId) {
       return Effect.gen(function* () {
         const repo = yield* UserRepo
         return yield* repo.findById(id)
       })
     }
   }
   ```

2. **Callback-position function expressions.** A function expression passed
   as an argument (e.g. into a combinator, router handler, or test helper)
   whose body returns `Effect.gen(...)` is not reported:

   ```ts
   route.handle("get", function (req) {
     // no effectFnOpportunity reported here
     return Effect.gen(function* () {
       return yield* handleGet(req)
     })
   })
   ```

Both shapes are rewritable to `Effect.fn`/`Effect.fnUntraced` exactly like
the covered declaration forms. We maintain a custom repo lint solely to
cover these two cases (its test suite documents them as intentional
coverage beyond the plugin); extending `effectFnOpportunity` to
MethodDeclaration owners and callback-position function expressions would
let downstream repos retire such custom lints entirely.

For contrast, the directly-returned `Effect.gen(...).pipe(...)` shape IS
handled by the plugin (with `pipeTransformations` configured) — the two
shapes above appear to be the only remaining structural gaps.

Happy to provide a reproduction workspace if useful.

---

Post-filing follow-ups (tracked in GRILL-DECISIONS.md #22): once an
upstream release covers both shapes, re-run the effect-fn prune analysis
and retire the repo law (~5.3s per battery).
