# Practice Gateway — Friction Receipts

## 2026-10-14 — `beep architecture add concept` cannot add a concept to an existing slice

- **Doing:** adding the `SetupRequirement` and `PracticeProfile` value
  concepts to `packages/law-practice/domain`, per the AGENTS.md Touch table
  ("New slice / concept / role file → `bun run beep architecture`").
- **Evidence:** `bun run beep architecture add concept law-practice
  SetupRequirement --domain-kind values --stage core` exits 1 with
  `Architecture operation would overwrite a differing file:
  packages/law-practice/domain/src/values/index.ts`. Before failing it wrote
  three files that do not belong to a real slice: `domain/AGENTS.md`
  ("Synthetic SetupRequirement aggregate domain models for the architecture
  proof corpus ... PROOF ORACLE"), `domain/LICENSE`, `domain/test/.gitkeep`.
  The `--dry-run` plan shows the concept files carry the proof corpus's
  `WorkPriority` template content and that `values/index.ts` and
  `package.json` exports are write-if-missing, so a successful run would
  still not register the concept.
- **Impact:** the mandated route is unusable outside the proof corpus; the
  partial write leaves misleading files to clean up by hand.
- **Would have prevented it:** plan all writes and fail before writing any;
  for an existing slice, append the concept to `values/index.ts` and the
  package exports instead of treating them as whole-file templates; emit an
  empty concept skeleton rather than proof-corpus content.
- **Workaround used:** removed the stray files and hand-authored the concept
  in the generator's layout (`values/<Concept>/{index.ts,<Concept>.model.ts}`
  plus barrel and export registration).

## 2026-10-14 — `beep create-package` writes an unformatted identity registry entry

- **Doing:** scaffolding `@beep/mcpb-kit` with `bun run beep create-package
  mcpb-kit --family tooling --kind library` during gate repair wave 1.
- **Evidence:** the generated `$I.compose(...)` list in
  `packages/foundation/modeling/identity/src/packages.ts` came out as
  `"practice-gateway", "mcpb-kit"` on one line, so
  `bun run beep quality package-verify @beep/identity` failed in
  `beep:lint:verbose` with "Formatter would have printed the following
  content".
- **Impact:** an extra package-verify round on a package the change never
  meant to touch.
- **Would have prevented it:** run Biome on the files `create-package`
  rewrites, or emit one composer name per line.
- **Workaround used:** `bunx biome check --write` on `packages.ts`.

## 2026-10-14 — effect-vitest flags a moved test as new findings

- **Doing:** gate repair wave 1; `packages/law-practice/server/test/PracticeKgHost.test.ts`
  carries cases moved from `apps/practice-kg-mcp/test/Host.test.ts`.
- **Evidence:** `bun run beep lint effect-vitest` counted the moved
  `EV005`/`EV010` rows as new because finding ids include the file path;
  `--write` would also have reset two unrelated `exception` rows in
  `AgentMessage.layer.test.ts` to `open`, dropping their reasons.
- **Impact:** a full `--write` cannot be used to record one reviewed row
  without hand-reverting unrelated drift.
- **Would have prevented it:** carry `status`/`reason` forward on `--write`
  when a row's occurrence digest is unchanged, and offer a per-file write.
- **Workaround used:** fixed the moved `EV005` rows in the test and
  hand-edited one `EV010` exception row mirroring the original
  `Host.test.ts` row.

## 2026-10-20 — saved Claude session expires inside the VM snapshot

- **Doing:** onboarding proof run 4 from the `claude-signed-in` snapshot.
- **Evidence:** Claude opened on "Get started" / a claude.ai Google sign-in
  page although `config.json` still held `lastKnownAccountUuid`; the operator
  had to sign in again, and `onboarding-proof.sh finish` then reverted to
  `clean`, discarding the fresh session.
- **Impact:** every later proof needs the operator's sign-in again, the
  step the snapshot was meant to remove.
- **Would have prevented it:** `onboarding-proof.sh finish --keep <name>`
  that re-saves the signed-in snapshot after a successful run before
  reverting, and a pre-flight that opens Claude and checks the session
  before handing the VM to the operator.

## 2026-11-12 — a stale Milkman lock blocks every proof on the VM

- **Doing:** a Windows proof of the gateway's knowledge-graph provider
  (`history/p1/2026-11-12-gateway-kg-provider-windows.md`).
- **Evidence:** `~/VMs/practice-gateway/milkman.lock` reads "held since
  2026-11-08T23:45:36-06:00 … (prepare milkman-signed-in)". The VM was shut
  off, no runner or recorder process was alive, and `snapshot.sh` and
  `onboarding-proof.sh` refuse to run while the file exists.
- **Impact:** the documented route (`snapshot.sh revert clean`, boot, prove)
  is closed for as long as an abandoned run keeps the file, and a blocked
  session builds a side VM by hand (18 GB).
- **Would have prevented it:** the lock carrying its holder's pid so a stale
  one can be told from a live one, and a `vm-clone.sh <snapshot> <name>` in
  `ops/vm/` that makes a disposable copy with its own port.
- **Workaround used:** `qemu-img convert -l snapshot.name=clean` into a new
  disk, a second libvirt domain with the snapshot's NVRAM and swtpm copies,
  and `VM_STATE`/`SSH_PORT` pointing `vm-run.sh` at it. The locked VM was
  only read.

## 2026-11-12 — the clean VM image has Smart App Control off

- **Doing:** the same proof.
- **Evidence:** `VerifiedAndReputablePolicyState = 0` on the `clean`
  snapshot; the attorney PC runs it at 1 (enforce).
- **Impact:** a VM proof cannot show what Smart App Control does with an
  unsigned file such as `duckdb.node`; that is still learned on the
  attorney PC.
- **Would have prevented it:** a snapshot installed with Smart App Control
  on, beside `clean`.
