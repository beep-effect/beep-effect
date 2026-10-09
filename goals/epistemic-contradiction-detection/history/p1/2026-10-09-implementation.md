# P1 implementation — 2026-10-09

P0 commit: `685602ef61`; merged base: `36027982f2`.
Concept name: ContradictionDetection. Architecture dry-run used as reference;
no apply. Hand-authored concept index, model, behavior and domain test. Friction
receipt: research/OPPORTUNITIES.md. No package-level metadata created.

Domain schema written first, then service/error contract, then pure Layer.
No dependencies added. Service exposed through server namespace and flat exports.

`bun run config-sync`: two files changed, add 1 alias per file; no inherited hunk.
`bun run config-sync:check`: pass.
`bun run lint:tsgo-rules`: pass, 118 configured error rules, 2 declared off.

`rg -n "DateTime\.now|Clock|Random|process\.env|fetch\(|new Map|new Set" packages/epistemic/domain/src/values/ContradictionDetection packages/epistemic/use-cases/src/ContradictionDetection`
Result: empty (exit 1).
`git diff --stat origin/main -- packages/epistemic/domain/src/values/Contradiction packages/epistemic/domain/src/entities/Contradiction`
Result: empty.

Heavy wrapper initially lacked user-session bus variables. Supplied the canonical
user runtime/bus to the wrapper; limits remain 32G, TURBO_CONCURRENCY=2. Checks
queue through machine-wide heavy admission, with at most two owned jobs.

The initial structural decode used S.toType(Class) on plain records; that expects
class instances. Corrected construction to encode/decode the shipped wire schemas,
with epoch-millis intervals. No shipped schema changed.

Alias command diff follows:
 tsconfig.json                 | 3 +++
 vitest.aliases.generated.json | 3 +++
 2 files changed, 6 insertions(+)
diff --git a/tsconfig.json b/tsconfig.json
index e67ef2ef2f..b557b00bd8 100644
--- a/tsconfig.json
+++ b/tsconfig.json
@@ -2071,6 +2071,9 @@
       ],
       "@beep/law-practice-use-cases/DocumentIdentification": [
         "./packages/law-practice/use-cases/src/DocumentIdentification/index.ts"
+      ],
+      "@beep/epistemic-domain/values/ContradictionDetection": [
+        "./packages/epistemic/domain/src/values/ContradictionDetection/index.ts"
       ]
     }
   }
diff --git a/vitest.aliases.generated.json b/vitest.aliases.generated.json
index d93a7aaa82..4d081fbfd0 100644
--- a/vitest.aliases.generated.json
+++ b/vitest.aliases.generated.json
@@ -1897,5 +1897,8 @@
   ],
   "@beep/law-practice-use-cases/DocumentIdentification": [
     "./packages/law-practice/use-cases/src/DocumentIdentification/index.ts"
+  ],
+  "@beep/epistemic-domain/values/ContradictionDetection": [
+    "./packages/epistemic/domain/src/values/ContradictionDetection/index.ts"
   ]
 }
