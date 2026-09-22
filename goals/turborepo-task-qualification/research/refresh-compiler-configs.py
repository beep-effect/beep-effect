"""Inventory declared compiler configuration; do not emulate compiler resolution."""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('census', type=Path)
parser.add_argument('boundaries', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
census = json.loads(args.census.read_text())
boundaries = json.loads(args.boundaries.read_text())
workspaces = {row['name']: row['directory'] for row in census['workspaces']}
sites = []
for row in boundaries['commands']:
    if row['family'] != 'compiler': continue
    tokens = row['command'].split()
    selectors = [(token, tokens[index + 1]) for index, token in enumerate(tokens[:-1]) if token in ['-p', '-b']]
    assert len(selectors) == 1, row['command']
    selector, relative = selectors[0]
    for site in row['sites']:
        owner = site['definition'].split('#')[0]
        path = Path(workspaces[owner]) / relative
        assert path.is_file(), path
        sites.append({'site': site, 'command': row['command'], 'workspace': owner, 'config': str(path),
                      'buildMode': selector == '-b', 'explicitNoEmit': '--noEmit' in tokens})
paths = sorted({site['config'] for site in sites})
# Use the installed JSONC parser; invalid documents are rejected, not repaired.
program = '''import { parse } from "jsonc-parser";
const paths = JSON.parse(await Bun.stdin.text());
const result = [];
for (const path of paths) {
 const errors = [];
 const value = parse(await Bun.file(path).text(), errors, { allowTrailingComma: true });
 if (errors.length || !value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid config: ${path}`);
 result.push({ path, declared: value });
}
console.log(JSON.stringify(result));'''
run = subprocess.run(['bun', '-e', program], input=json.dumps(paths), text=True, capture_output=True, timeout=30, check=True)
configs = json.loads(run.stdout)
assert [row['path'] for row in configs] == paths
for row in configs:
    row['sha256'] = hashlib.sha256(Path(row['path']).read_bytes()).hexdigest()
report = {
    'schemaVersion': 'cache-compiler-config-inventory/v1',
    'authority': 'Direct declarations and literal command selectors, not merged compiler options, file discovery or runtime proof.',
    'censusSha256': hashlib.sha256(args.census.read_bytes()).hexdigest(),
    'boundariesSha256': hashlib.sha256(args.boundaries.read_bytes()).hexdigest(),
    'recipeSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'parserManifestSha256': hashlib.sha256(Path('node_modules/jsonc-parser/package.json').read_bytes()).hexdigest(),
    'siteCount': len(sites), 'configCount': len(configs),
    'explicitNoEmitSites': sum(site['explicitNoEmit'] for site in sites),
    'buildModeSites': sum(site['buildMode'] for site in sites),
    'sites': sites, 'configs': configs,
    'limits': ['Extends, references, include and exclude remain declarations; no compiler-specific resolution is simulated.',
               'An absent local compiler option is not its effective value.',
               'No compiler, generator or test command was executed.'],
}
args.output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({key: report[key] for key in ['siteCount', 'configCount', 'explicitNoEmitSites', 'buildModeSites']}))
