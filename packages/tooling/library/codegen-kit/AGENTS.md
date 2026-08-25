# @beep/codegen-kit

This package owns the shared code-generation pipeline:

```text
fetch -> patch -> generate(onEnter) -> postProcess -> format -> write | drift
```

## Laws

- URL sources require a committed cache and a release pin. Normal runs and `--check` stay offline; only `--refresh` may download.
- Normalize refreshed JSON to two-space indentation and run the pinned Biome binary before writing it.
- Drift checks compare generated outputs only. They never compare upstream cache byte layout.
- Keep transforms pure and registered by `NamedTransform`.
- Preserve schema identity annotations, codec statics, and docgen-valid Example blocks in generated schema modules.
- Use `ChildProcessSpawner` with `node_modules/.bin/biome`; do not add runtime formatter downloads.
- Root `AGENTS.md` and `standards/ARCHITECTURE.md` govern all other package behavior.
