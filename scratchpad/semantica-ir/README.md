# Semantica symbol IR

This directory contains the D5 extraction stage for the Semantica atlas sync. It scans Python
source under `semantica/**` and writes one JSON object per symbol to a deterministic JSONL file.
The generated IR is the input for later atlas rendering and diffing; those steps are outside this
tool.

## Run it

The extractor uses only the Python standard library and supports Python 3.9 or newer.

```sh
python3 scratchpad/semantica-ir/extract.py \
  ~/YeeBois/workstation-apps/semantica
```

The default output is `scratchpad/semantica-ir/out/symbols.jsonl`. Pass a second argument to
write elsewhere:

```sh
python3 scratchpad/semantica-ir/extract.py /path/to/semantica /tmp/symbols.jsonl
```

With no arguments, the script reads `~/YeeBois/workstation-apps/semantica`. The explicit first
argument still selects another repository. The script prints a JSON summary containing the record
count, validation count, and parse notes. Any parse failure (unreadable, undecodable, or
unparsable source) or schema violation stops the write and exits nonzero, so a published IR is
always a complete inventory. Function and method records carry `is_async`, async signatures are
prefixed `async `, and `registry_names` includes registrations made in decorator lists.

## IR contract

Each line describes one class, function, method, dataclass, Pydantic model, protocol, or
module/class constant. Records include the dotted module and architectural layer, qualified name,
bases and decorators, rendered signature and parameters, return annotation, raised exception
expressions, parsed docstring, source span, visibility, and best-effort registry names.

`docstring.raw` retains the cleaned docstring text. `docstring.summary` is its first paragraph.
`docstring.sections` recognizes Google headings and NumPy underlined headings for `Args`,
`Returns`, `Raises`, `Examples`, `Attributes`, and `Notes`; NumPy `Parameters` maps to `Args`.

The full per-record contract is [ir-schema.json](./ir-schema.json), a JSON Schema draft 2020-12
document. The extractor also performs an in-process structural check without `jsonschema`.
Records sort by repository-relative file, line, and qualified name. The generated `out/` directory
is intentionally gitignored.
