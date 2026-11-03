# P2 source/input/output audit

Bound HEAD: `0be1f13d62fa00cb65e34ff69ec99043380f8d81`. Owner: r28-cli-internal-root-tmpfs-discovered-classified-skip. Private-only proposal; no source/canonical edits and no execution of janitor, tests, proofs or Yeet.

Graft first: DiscoveredCandidate exhaustive search found32 hits across its sole private source file; public report/runner search found87 hits across6 files. Total estimated savings96370 tokens. One unsupported --scope option failed read-only; corrected to --in. Exact source reads verified all constructors, consumers, barrel, codecs, defaults, diagnostic and safety ordering. Source-derived table remains312/13; no public contract narrowing. Quality anchor corrected3964-4037, index28-29, property1589-1607. Companion sealed tmpfs-stub proposal retains72/14; guard credits deliberately separate.

Immutable input snapshots:
- `input-inventory.jsonl`: `3d40765bc7eab25890f7a116fbb3ce9b77c7e704c4b0c09c660a767bbc1cc23f`
- `input-design.md`: `4e2c7578b22e5127266edaca776fa1f7c7535c496c117df39b485dc99e8f5c44`
- `input-decisions.md`: `e85016058ca6000aa1309eaa7a737566ba1ddef4141509df0b39c693ff4306d9`

Source bindings (whole-file hashes, source excerpts inspected as stated above):
- `packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.ts`: `11fde46ed957f8d4a1dd59020028e3d40da53a9009017bb4278c2ac709a5dfa8`
- `packages/tooling/tool/cli/src/internal/repo-run/TmpfsReap.schemas.ts`: `bad39e4279d1f1b9c0f6773a7645bd5b3fb31654209e312a4116066b7ea15b08`
- `packages/tooling/tool/cli/src/internal/repo-run/index.ts`: `ca4decfbea6ae8723de13b4c1b5a28ab49d7d4a4ddf3dbd860eb2e0f11664c0e`
- `packages/tooling/tool/cli/src/test/RepoRun.test-kit.ts`: `88affd301f15a26a60bc1aa7d9fc6bb6a43dab0fcfb35a437ab6d28a6e5f5f8f`
- `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts`: `0203b3c6df5a7848cb9547f867ad4c10fddd6bde66925820a04d0fe1509e87dd`
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts`: `88ec5658bf142fecb7c6c5f494ee3106a179f9f8459588c8a182e77ce0620d1a`
- `packages/tooling/tool/cli/test/tmpfs-reap.test.ts`: `7e213124310137c3861cd0638579d8e8f9ed6111e4ae22a93c3048c664ea39e3`
- `packages/tooling/tool/cli/test/quality-tmpfs-render.test.ts`: `670c08e3ea32a7b17651e72422a4bf6c8eed1b77dab64e3588e58a6a29b19219`
- `.repos/effect/packages/effect/src/Schema.ts`: `d72af65f80ee760c51b403fe2859ecf5a9c81b1697db99b71c9f52185bfa7325`
- `goals/boolean-creep/SPEC.md`: `9df7ebe63b9c7c1e253892ff1b36600baa8b22f7c6598617e7e8995575ad5087`

Output bindings:
- `proposed-design.md`: `b12f8348c2ed6fb17f159066057328204a925d18c62b4a76e2c26b5e6bc36bab`
- `proposed-row.json`: `4b5738fe36d4fe581852ca1215931763c14d6c49b8419c39343e73ab81ca6a02`
- `finite-projection.json`: `a32996fc9f0fb7562093ba5067452718aa983fefc09cc2df1b6dc5f6e5376f19`
