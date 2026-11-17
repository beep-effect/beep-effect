---
title: "Carry the regex engine on each v3 job; startup keeps limits only"
date: 2026-11-14
lane: "feat/citation-regex-session"
reversal: "Return the engine to startup only if every evaluator in an invocation is proved to use one dialect."
---

Owner ruling on the second B2 stop. One invocation uses two dialects: the tokenizer installs `python-re` and the context matcher `python-regex-v0`. Design section 2.4 put the engine in the startup argv, which fits one process per evaluation and not one process per invocation. The engine becomes a required, parent-selected field of `CitationRegexWorkerJob`, beside the descriptor it already carries, and leaves `CitationRegexWorkerStartup`. It follows the earlier decision that each job carries its parent-selected descriptor: the worker never chooses or infers a dialect. Required with it: the engine is inside the exact size preflight and the finite property ceiling; the worker compiles each job under that job's engine and keeps no compiled program, cache or other state from one job to the next; a job whose engine fails its schema is a protocol deviation and kills; a real-process regression runs a `python-re` job then a `python-regex-v0` job (pattern `a(?i)b`, accepted by the second and refused by the first) in one process on both child runtimes. Rejected: restarting the process on an engine change (breaks one process per invocation and the never-respawn rule) and a common dialect (changes extraction output).
