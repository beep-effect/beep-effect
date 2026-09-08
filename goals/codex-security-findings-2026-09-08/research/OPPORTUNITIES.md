# Execution friction

- The provenance regression found that `writeContainedFileString` produced mode
  `0644` although its documented contract promised a private temporary file.
  Explicitly restricting the empty temporary file before writing its contents
  prevents metadata exposure. The regression checks new and replacement files.
- `economics.py --from-inputs` encountered inherited drift in the optional run2
  corpus. The pristine replay test also found an inherited stale reproduction
  script receipt. Preserve the ratified compact inputs, validate their replay in
  an isolated fixture, and update only the reproduction script receipt. A
  dedicated embedded-only replay mode would avoid the optional corpus coupling.
