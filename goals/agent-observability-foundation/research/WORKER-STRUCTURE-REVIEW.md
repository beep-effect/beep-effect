# Worker startup and routing review

Independent Astra source review compared the change with commit
`ae89646bded05f2a249a2a91896e27ad8c0c9a2e` and found no actionable regression.
The reviewed worker SHA256 is
`f99d612951187247f79a498adacd49172b2bbc52db06ba6e3547c820828737de`.

Credential resolution and journal/stale-socket preparation are lazy named
phases. Configuration, qualification, credentials, worker configuration,
storage inspection and SQLite opening retain their order. Present invalid
credential directories never fall back to environment values; the private
0400-compatible credential predicate, bounded read and safe errors remain.

Socket cleanup reuses the same device/inode identity predicate. Ownership
capture remains after bind, with cleanup registered before server acquisition.
Exact method/URL matches preserve health, metrics and control routes; the
URL-only maintenance delegation and final worker fallback retain their own
method handling. The outer safe 503 mapping remains.

CLI lint and type checks passed. Current installed qualification is recorded
separately; this source review alone does not establish runtime or hosted proof.
The recovery hold and historical archives remain unchanged.
