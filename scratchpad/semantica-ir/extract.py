#!/usr/bin/env python3
"""Extract a deterministic, schema-shaped symbol IR from semantica Python sources."""

import ast
import json
from pathlib import Path
import sys
import textwrap


DEFAULT_REPOSITORY = Path("~/YeeBois/workstation-apps/semantica").expanduser()
DEFAULT_OUTPUT = Path(__file__).resolve().parent / "out" / "symbols.jsonl"

LAYERS = {
    "ingest": "input",
    "parse": "input",
    "split": "input",
    "normalize": "input",
    "semantic_extract": "core",
    "kg": "core",
    "ontology": "core",
    "reasoning": "core",
    "embeddings": "storage",
    "vector_store": "storage",
    "graph_store": "storage",
    "triplet_store": "storage",
    "deduplication": "qa",
    "conflicts": "qa",
    "context": "context_memory",
    "provenance": "context_memory",
    "change_management": "context_memory",
    "export": "output",
    "visualization": "output",
    "pipeline": "output",
    "explorer": "output",
    "llms": "utilities",
    "mcp_server": "utilities",
    "seed": "utilities",
    "evals": "utilities",
    "core": "utilities",
    "utils": "utilities",
}
SECTION_ALIASES = {
    "args": "Args",
    "arguments": "Args",
    "parameters": "Args",
    "returns": "Returns",
    "return": "Returns",
    "raises": "Raises",
    "examples": "Examples",
    "example": "Examples",
    "attributes": "Attributes",
    "attribute": "Attributes",
    "notes": "Notes",
    "note": "Notes",
}


def render(node):
    if node is None:
        return None
    try:
        return ast.unparse(node)
    except (TypeError, ValueError):
        return "<unrenderable>"


def parse_docstring(node):
    value = ast.get_docstring(node, clean=False)
    if value is None:
        return {"raw": "", "summary": "", "sections": {}}

    raw = textwrap.dedent(value).strip()
    lines = raw.splitlines()
    sections = {}
    preamble = []
    current = None
    current_lines = []

    def save_section():
        if current is not None:
            sections[current] = "\n".join(current_lines).strip()

    index = 0
    while index < len(lines):
        stripped = lines[index].strip()
        key = None
        colon_name = stripped[:-1].strip().lower() if stripped.endswith(":") else ""
        if colon_name in SECTION_ALIASES:
            key = SECTION_ALIASES[colon_name]
        elif index + 1 < len(lines):
            underline = lines[index + 1].strip()
            if stripped.lower() in SECTION_ALIASES and underline and set(underline) == {"-"}:
                key = SECTION_ALIASES[stripped.lower()]

        if key is not None:
            save_section()
            current = key
            current_lines = []
            if not stripped.endswith(":"):
                index += 1
        elif current is None:
            preamble.append(lines[index])
        else:
            current_lines.append(lines[index])
        index += 1
    save_section()

    summary_lines = []
    for line in preamble:
        if not line.strip() and summary_lines:
            break
        if line.strip():
            summary_lines.append(line.strip())
    return {
        "raw": raw,
        "summary": " ".join(summary_lines),
        "sections": sections,
    }


def expression_name(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        left = expression_name(node.value)
        return f"{left}.{node.attr}" if left else node.attr
    if isinstance(node, ast.Subscript):
        return expression_name(node.value)
    if isinstance(node, ast.Call):
        return expression_name(node.func)
    return render(node) or ""


def scoped_nodes(statements):
    """Yield nodes without crossing into a nested symbol's body."""
    pending = list(reversed(statements))
    while pending:
        node = pending.pop()
        yield node
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda)):
            continue
        pending.extend(reversed(list(ast.iter_child_nodes(node))))


def raised_names(statements):
    names = set()
    for node in scoped_nodes(statements):
        if not isinstance(node, ast.Raise):
            continue
        if node.exc is None:
            names.add("re-raise")
        else:
            names.add(expression_name(node.exc) or "<unknown>")
    return sorted(names)


def literal_strings(node):
    values = []
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        values.append(node.value)
    elif isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        for item in node.elts:
            values.extend(literal_strings(item))
    elif isinstance(node, ast.Dict):
        for item in [*node.keys, *node.values]:
            if item is not None:
                values.extend(literal_strings(item))
    return values


def registry_names(statements):
    names = set()
    for node in scoped_nodes(statements):
        if not isinstance(node, ast.Call):
            continue
        called = expression_name(node.func).lower()
        if "register" not in called and "registry" not in called:
            continue
        for argument in [*node.args, *(keyword.value for keyword in node.keywords)]:
            names.update(literal_strings(argument))
    return sorted(names)


def parameters(arguments):
    result = []
    positional = [*arguments.posonlyargs, *arguments.args]
    first_default = len(positional) - len(arguments.defaults)
    for index, argument in enumerate(positional):
        default = arguments.defaults[index - first_default] if index >= first_default else None
        result.append(
            {
                "name": argument.arg,
                "annotation": render(argument.annotation),
                "default": render(default),
            }
        )
    if arguments.vararg is not None:
        result.append(
            {
                "name": arguments.vararg.arg,
                "annotation": render(arguments.vararg.annotation),
                "default": None,
            }
        )
    for argument, default in zip(arguments.kwonlyargs, arguments.kw_defaults):
        result.append(
            {
                "name": argument.arg,
                "annotation": render(argument.annotation),
                "default": render(default),
            }
        )
    if arguments.kwarg is not None:
        result.append(
            {
                "name": arguments.kwarg.arg,
                "annotation": render(arguments.kwarg.annotation),
                "default": None,
            }
        )
    return result


def function_signature(node):
    arguments = node.args
    positional = [*arguments.posonlyargs, *arguments.args]
    first_default = len(positional) - len(arguments.defaults)
    pieces = []
    for index, argument in enumerate(positional):
        piece = argument.arg
        if argument.annotation is not None:
            piece += f": {render(argument.annotation)}"
        if index >= first_default:
            piece += f" = {render(arguments.defaults[index - first_default])}"
        pieces.append(piece)
        if arguments.posonlyargs and index + 1 == len(arguments.posonlyargs):
            pieces.append("/")
    if arguments.vararg is not None:
        piece = f"*{arguments.vararg.arg}"
        if arguments.vararg.annotation is not None:
            piece += f": {render(arguments.vararg.annotation)}"
        pieces.append(piece)
    elif arguments.kwonlyargs:
        pieces.append("*")
    for argument, default in zip(arguments.kwonlyargs, arguments.kw_defaults):
        piece = argument.arg
        if argument.annotation is not None:
            piece += f": {render(argument.annotation)}"
        if default is not None:
            piece += f" = {render(default)}"
        pieces.append(piece)
    if arguments.kwarg is not None:
        piece = f"**{arguments.kwarg.arg}"
        if arguments.kwarg.annotation is not None:
            piece += f": {render(arguments.kwarg.annotation)}"
        pieces.append(piece)
    returns = render(node.returns)
    return f"({', '.join(pieces)})" + (f" -> {returns}" if returns else "")


def is_public(qualname):
    return all(not part.startswith("_") for part in qualname.split("."))


def class_kind(node):
    decorators = [expression_name(item) for item in node.decorator_list]
    bases = [expression_name(item) for item in node.bases]
    if any(name.split(".")[-1] == "dataclass" for name in decorators):
        return "dataclass"
    if any(name.split(".")[-1] == "BaseModel" for name in bases):
        return "pydantic_model"
    if any(name.split(".")[-1] == "Protocol" for name in bases):
        return "protocol"
    return "class"


class SymbolVisitor(ast.NodeVisitor):
    def __init__(self, module, layer, file_name):
        self.module = module
        self.layer = layer
        self.file_name = file_name
        self.parents = []
        self.records = []

    def qualname(self, name):
        return ".".join([*(entry[1] for entry in self.parents), name])

    def base_record(self, node, qualname, kind, signature):
        return {
            "module": self.module,
            "layer": self.layer,
            "qualname": qualname,
            "kind": kind,
            "bases": [],
            "decorators": [],
            "signature": signature,
            "params": [],
            "returns": None,
            "raises": [],
            "docstring": {"raw": "", "summary": "", "sections": {}},
            "file": self.file_name,
            "lineno": node.lineno,
            "end_lineno": node.end_lineno or node.lineno,
            "is_public": is_public(qualname),
            "is_async": False,
            "registry_names": [],
        }

    def visit_ClassDef(self, node):
        qualname = self.qualname(node.name)
        bases = [render(base) for base in node.bases]
        signature = f"class {node.name}" + (f"({', '.join(bases)})" if bases else "")
        record = self.base_record(node, qualname, class_kind(node), signature)
        record.update(
            {
                "bases": bases,
                "decorators": [render(item) for item in node.decorator_list],
                "docstring": parse_docstring(node),
                "raises": raised_names(node.body),
                "registry_names": registry_names([*node.decorator_list, *node.body]),
            }
        )
        self.records.append(record)
        self.parents.append(("class", node.name))
        for item in node.body:
            self.visit(item)
        self.parents.pop()

    def visit_FunctionDef(self, node):
        self.visit_function(node)

    def visit_AsyncFunctionDef(self, node):
        self.visit_function(node)

    def visit_function(self, node):
        qualname = self.qualname(node.name)
        kind = "method" if self.parents and self.parents[-1][0] == "class" else "function"
        is_async = isinstance(node, ast.AsyncFunctionDef)
        signature = ("async " if is_async else "") + function_signature(node)
        record = self.base_record(node, qualname, kind, signature)
        record.update(
            {
                "decorators": [render(item) for item in node.decorator_list],
                "params": parameters(node.args),
                "returns": render(node.returns),
                "raises": raised_names(node.body),
                "docstring": parse_docstring(node),
                "is_async": is_async,
                "registry_names": registry_names([*node.decorator_list, *node.body]),
            }
        )
        self.records.append(record)
        self.parents.append(("function", node.name))
        for item in node.body:
            self.visit(item)
        self.parents.pop()

    def visit_Assign(self, node):
        if not self.parents or self.parents[-1][0] == "class":
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id.isupper():
                    self.add_constant(node, target.id, None, node.value)
        self.generic_visit(node)

    def visit_AnnAssign(self, node):
        if (
            (not self.parents or self.parents[-1][0] == "class")
            and isinstance(node.target, ast.Name)
            and (node.target.id.isupper() or "Final" in (render(node.annotation) or ""))
        ):
            self.add_constant(node, node.target.id, node.annotation, node.value)
        self.generic_visit(node)

    def add_constant(self, node, name, annotation, value):
        qualname = self.qualname(name)
        signature = name
        if annotation is not None:
            signature += f": {render(annotation)}"
        if value is not None:
            signature += f" = {render(value)}"
        record = self.base_record(node, qualname, "constant", signature)
        record["returns"] = render(annotation)
        self.records.append(record)


def validate(record, schema):
    violations = []
    required_keys = set(schema["required"])
    missing = sorted(required_keys - record.keys())
    if missing:
        violations.append(f"missing required keys: {', '.join(missing)}")
    unexpected = sorted(record.keys() - required_keys)
    if unexpected and schema.get("additionalProperties") is False:
        violations.append(f"unexpected keys: {', '.join(unexpected)}")
    if record.get("layer") not in schema["properties"]["layer"]["enum"]:
        violations.append(f"invalid layer: {record.get('layer')!r}")
    if record.get("kind") not in schema["properties"]["kind"]["enum"]:
        violations.append(f"invalid kind: {record.get('kind')!r}")
    for key in ("module", "qualname", "signature", "file"):
        if not isinstance(record.get(key), str):
            violations.append(f"{key} must be a string")
        elif not record[key]:
            violations.append(f"{key} must not be empty")
    if isinstance(record.get("file"), str) and not (
        record["file"].startswith("semantica/") and record["file"].endswith(".py")
    ):
        violations.append("file must be a repository-relative semantica Python path")
    for key in ("bases", "decorators", "raises", "registry_names"):
        if not isinstance(record.get(key), list) or not all(
            isinstance(item, str) for item in record.get(key, [])
        ):
            violations.append(f"{key} must be an array of strings")
        elif len(record[key]) != len(set(record[key])):
            violations.append(f"{key} must contain unique strings")
    if not isinstance(record.get("params"), list):
        violations.append("params must be an array")
    else:
        for index, parameter in enumerate(record["params"]):
            if not isinstance(parameter, dict) or set(parameter) != {"name", "annotation", "default"}:
                violations.append(f"params[{index}] has an invalid shape")
                continue
            if not isinstance(parameter["name"], str):
                violations.append(f"params[{index}].name must be a string")
            elif not parameter["name"]:
                violations.append(f"params[{index}].name must not be empty")
            for key in ("annotation", "default"):
                if parameter[key] is not None and not isinstance(parameter[key], str):
                    violations.append(f"params[{index}].{key} must be a string or null")
    if record.get("returns") is not None and not isinstance(record.get("returns"), str):
        violations.append("returns must be a string or null")
    docstring = record.get("docstring")
    if not isinstance(docstring, dict) or set(docstring) != {"raw", "summary", "sections"}:
        violations.append("docstring has an invalid shape")
    else:
        if not isinstance(docstring["raw"], str) or not isinstance(docstring["summary"], str):
            violations.append("docstring raw and summary must be strings")
        if not isinstance(docstring["sections"], dict) or not all(
            key in set(SECTION_ALIASES.values()) and isinstance(value, str)
            for key, value in docstring["sections"].items()
        ):
            violations.append("docstring sections contain an invalid key or value")
    for key in ("lineno", "end_lineno"):
        if not isinstance(record.get(key), int) or record.get(key, 0) < 1:
            violations.append(f"{key} must be a positive integer")
    if isinstance(record.get("lineno"), int) and isinstance(record.get("end_lineno"), int):
        if record["end_lineno"] < record["lineno"]:
            violations.append("end_lineno must not precede lineno")
    if not isinstance(record.get("is_public"), bool):
        violations.append("is_public must be a boolean")
    if not isinstance(record.get("is_async"), bool):
        violations.append("is_async must be a boolean")
    return violations


def module_name(relative_file):
    parts = list(relative_file.with_suffix("").parts)
    if parts[-1] == "__init__":
        parts.pop()
    return ".".join(parts)


def source_layer(relative_file):
    parts = relative_file.parts
    top_level = parts[1] if len(parts) > 2 else ""
    return LAYERS.get(top_level, "utilities")


def extract(repository):
    source_root = repository / "semantica"
    if repository.name == "semantica" and not source_root.is_dir():
        source_root = repository
        repository = repository.parent
    if not source_root.is_dir():
        raise ValueError(f"semantica source directory not found under {repository}")

    records = []
    failures = []
    notes = []
    for path in sorted(source_root.rglob("*.py")):
        relative = path.relative_to(repository)
        if "tests" in relative.parts or "__pycache__" in relative.parts:
            continue
        try:
            raw = path.read_bytes()
            if raw.startswith(b"\xef\xbb\xbf"):
                notes.append({"file": relative.as_posix(), "reason": "stripped UTF-8 BOM"})
            source = raw.decode("utf-8-sig")
            tree = ast.parse(source, filename=relative.as_posix(), type_comments=True)
        except (OSError, SyntaxError, UnicodeError) as error:
            failures.append(
                {
                    "file": relative.as_posix(),
                    "reason": f"{type(error).__name__}: {error}",
                }
            )
            continue
        visitor = SymbolVisitor(
            module_name(relative),
            source_layer(relative),
            relative.as_posix(),
        )
        visitor.visit(tree)
        records.extend(visitor.records)
    records.sort(key=lambda record: (record["file"], record["lineno"], record["qualname"]))
    return records, failures, notes


def main():
    repository = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv) > 1 else DEFAULT_REPOSITORY
    output = Path(sys.argv[2]).expanduser().resolve() if len(sys.argv) > 2 else DEFAULT_OUTPUT
    if len(sys.argv) > 3:
        raise ValueError("usage: python3 extract.py [SEMANTICA_REPOSITORY] [OUTPUT_JSONL]")

    schema_path = Path(__file__).resolve().parent / "ir-schema.json"
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    records, failures, notes = extract(repository)
    if failures:
        for failure in failures:
            print(f"parse failure {failure['file']}: {failure['reason']}")
        raise ValueError(
            f"refusing to write IR after {len(failures)} parse failure(s); "
            "the symbol inventory would be silently incomplete"
        )
    violation_count = 0
    for record in records:
        violations = validate(record, schema)
        if violations:
            violation_count += len(violations)
            print(
                f"validation error {record.get('file')}:{record.get('lineno')}: "
                + "; ".join(violations)
            )
    if violation_count:
        raise ValueError(f"refusing to write {violation_count} schema violations")

    output.parent.mkdir(parents=True, exist_ok=True)
    payload = "".join(
        json.dumps(record, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
        for record in records
    )
    output.write_text(payload, encoding="utf-8")
    print(
        json.dumps(
            {
                "output": str(output),
                "records": len(records),
                "validation_violations": violation_count,
                "parse_failures": failures,
                "parse_notes": notes,
            },
            ensure_ascii=False,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
