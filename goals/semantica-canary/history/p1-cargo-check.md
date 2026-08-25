# P1 step 1 — the one local `cargo check`

Date: 2026-08-25. Branch: `feat/semantica-lab-mint`. Lab minted with
`bun run beep create-package semantica --type app --app-kind tauri --lab --description "Semantica port canary: headless Document→KG→eval chain over F1 + W1"`.

This is the only Rust proof the packet takes (PLAN P1 step 2; SPEC S4, A5).
Labs CI runs no Cargo. `src-tauri` is frozen from this point through C2: no
edits, no sidecar, no IPC. The generated `Cargo.lock` is committed as the
frozen resolution.

## Command

```sh
cd apps/labs/semantica/src-tauri && cargo check
```

## Result

| Field | Value |
| --- | --- |
| Exit code | 0 |
| Elapsed | 31.37 s (`Finished \`dev\` profile [unoptimized + debuginfo] target(s)`) |
| Crates checked | 268 (`Checking`/`Compiling` lines) |
| Warnings | 0 |
| Errors | 0 |
| cargo | 1.96.0 (30a34c682 2026-05-25) |
| rustc | 1.96.0 (ac68faa20 2026-05-25) |
| Crate | `semantica` 0.0.0, `tauri = "2"`, `tauri-build = "2"`, `serde`, `serde_json` |

Last lines of the log:

```text
    Checking muda v0.19.3
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 31.37s
```
