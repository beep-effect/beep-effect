# OpenClaw canonical assertions

Replace seventeen Option/Result predicate matchers with native assertion helpers.
None checks retain the exact input to assertNone. Some and Result predicates
retain their original operands through pipe and assertTrue, without inventing a
payload or removing any separate payload, typed-error, or diagnostic assertion.
The full package audit and documentation check pass after the change.
