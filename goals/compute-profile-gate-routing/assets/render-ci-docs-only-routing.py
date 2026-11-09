"""Regenerate the acceptance diagram with Graphviz and the repository SVG checks."""

from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

assets = Path(__file__).resolve().parent
source = assets / "ci-docs-only-routing.dot"
output = assets / "ci-docs-only-routing.svg"
root = ET.fromstring(subprocess.check_output(["dot", "-Tsvg_inline", str(source)]))
root.set("xmlns", "http://www.w3.org/2000/svg")
root.set("role", "img")
root.set("aria-labelledby", "docs-routing-title")
title = ET.Element("title", id="docs-routing-title")
title.text = "Documentation routing skips product checks and retains security and repository checks"
root.insert(0, title)
ET.indent(root, space="  ")
output.write_text(ET.tostring(root, encoding="unicode") + "\n", encoding="utf-8")
subprocess.run(
    ["bunx", "biome", "check", "--write", str(output)],
    cwd=Path(__file__).resolve().parents[3],
    check=True,
)
