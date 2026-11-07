# PR 3c cache dependency review

Reviewer: GPT-6.1 Sol, medium, implementation self-review.

This lane merged origin/main, including the #2881 global-input baseline repair.
It adds the existing workspace mcp-kit dependency to documents-server and runs
tsconfig-sync for its three reference lists and the Fallow boundaries.
The server build/check/test/deprecated-api graph edges now include mcp-kit.
No task script, root Turbo input, output, environment or cache qualification
setting changed in this lane.

Only the documents-server subject is reviewed here. The current branch also
inherits unrecorded alchemy-postgres and documents-use-cases dependency drift
from the PR 2b/3b stack. Their previous packet review requests belong to the
orchestrator; this request does not silently re-review those subjects.
No cache qualification is granted.
