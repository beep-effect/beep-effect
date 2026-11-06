#!/usr/bin/env python3
"""Derive the runtime edition identities solely from reviewed vocabulary evidence."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    repo = ops.parents[2]
    source = repo/'packages/law-practice/use-cases/test/fixtures/eyecite/vocabulary-mapping.json'
    raw = source.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert digest == 'b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5'
    original = json.loads(raw)
    assert original['publicArtifactVersion'] == 'crv1:f353e51400a5:fad63b383b92'
    rows = []
    for row in original['editions']:
        family = {'case-reporter':'case', 'law-publication':'law', 'journal-publication':'journal'}[row['kind']]
        projected = {'family':family, 'edition':row['artifactSha256']}
        if family == 'case': projected['reporterId'] = row['reporterId']
        rows.append(projected)
    assert len(rows) == len({row['edition'] for row in rows}) == 2533
    output = {'schemaVersion':'citation-semantic-editions/v1', 'mappingSha256':digest,
              'vocabularyVersion':original['publicArtifactVersion'],
              'producerSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'editions':rows}
    fixture = repo/'packages/law-practice/server/assets/citation/semantic-editions.json'
    formatted = subprocess.run(['bunx','--no-install','biome','format','--stdin-file-path='+str(fixture)],
        input=json.dumps(output,sort_keys=True,indent=2)+'\n',cwd=repo,text=True,capture_output=True,check=True).stdout
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(formatted)
    print(json.dumps({'editions':len(rows),'case':sum(row['family']=='case' for row in rows),
                     'sha256':hashlib.sha256(formatted.encode()).hexdigest()}))


if __name__ == '__main__':
    main()
