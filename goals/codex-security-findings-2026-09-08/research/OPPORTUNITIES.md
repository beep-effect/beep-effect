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
- Overlapping local proof commands terminated with exit codes 143, 137, and 130
  while host memory was constrained. The CLI build and typecheck passed before
  its test process stopped. The terminating actor was not established. Run the
  required proofs serially and retain their logs across task continuation;
  interrupted runs never count as acceptance evidence.
