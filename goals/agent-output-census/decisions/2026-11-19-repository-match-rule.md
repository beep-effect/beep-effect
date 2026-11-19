---
title: "A transcript belongs to the repository by its Claude project directory name or its Codex session working directory"
date: 2026-11-19
lane: "goals/agent-output-census-library"
reversal: "Match on a recorded working directory for both harnesses instead of the project directory name."
---

Claude: every directory under the Claude projects root whose name contains the repository name (beep-effect), walked three levels deep, skipping tool-results directories, taking every .jsonl file. A file is a subagent context when its path has a subagents directory or its name starts with agent-. Codex: every .jsonl file under the Codex sessions root whose first session_meta record has a working directory, or a runtime workspace root, containing the repository name; a file whose first records are not a match is abandoned after six records. Both rules are part of the rule version. The repository name is a flag with the reference value as its default, and roots default to the harnesses' own directories, printed with a tilde.
