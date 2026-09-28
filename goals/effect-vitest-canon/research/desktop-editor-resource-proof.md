# Editor hardening resource ownership

The four directly created atom registries now register disposal at acquisition.
The React view backed by a manual registry has an additional scope-owned unmount,
ordered before registry disposal. Direct Lexical root attachments register a
detach finalizer, including the same-editor remount path. The standalone mention
notice test now uses the public Effect tester and owns both appended DOM nodes.

All explicit early unmounts, root detaches, registry disposals and mount releases
remain where they were. Their exact URL-revocation, no-post-disposal-access and
same-editor remount assertions remain intact. Structural comparison preserves 375
assertion call expressions and 34 literal registration titles in order; the
parameterized cases still give 35 executed tests.

Syntax-tree-inserted failure controls targeted the standalone DOM fixture and a
registry acquisition. Before the repair, two appended DOM nodes remained and the
registry disposal callback was not invoked. After the repair, both controls pass.
The actual disposal method is called with its receiver retained. Probes were
removed and all 35 ordinary Node tests pass.

The feature-property options and other saved property findings are not changed
by this resource batch and remain part of the continuing inventory work.

The full Desktop package audit, including Bun unit tests, and Docgen pass (13.6
and 11.9 seconds respectively). The Effect/Vitest ratchet reports zero introduced
findings without any baseline reanchoring. Strict inventory/census validation and
diff checks pass.
