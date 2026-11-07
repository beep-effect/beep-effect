#!/usr/bin/env python3
"""Seal conditional donor layout observations; optionally replay the exact pin."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

CORPUS_SHA = "7f44910000ef91905c5e1acbf9bdfdba456dadf21ebc1968c363fa7a7978dd68"
PROBE_SHA = "5663f951676120d87cc6baa8b8555335dbef98a0ac751e1aa20ca2c6ca0a33ea"
sha = lambda data: hashlib.sha256(data).hexdigest()


def validate(data, probe):
    assert sha(data) == CORPUS_SHA and sha(probe) == PROBE_SHA, "layout evidence seal"
    report = json.loads(data)
    assert report['schemaVersion'] == 'bluebook-layout-reference/v1'
    assert report['source']['commit'] == '34133d03143ea65861f48a5ed0eb32c931581666'
    assert report['source']['tree'] == 'f1243d0723cea1e53a5263ef67c9e066230729fc'
    assert report['source']['path'] == 'src/utils/bluebook.ts'
    assert report['source']['license'] == 'MIT' and report['probeSha256'] == PROBE_SHA
    assert report['identity']['mappingSha256'] == 'b5aca44dc69f05b82c41decf327863a52c151eeb231bdb4df96e5cf7e85351c5'
    assert len(report['cases']) == 3
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--donor-root', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    ops = Path(__file__).resolve().parent
    fixture = ops.parents[2] / 'packages/law-practice/domain/test/fixtures/bluebook-layout.json'
    probe = ops / 'probe-bluebook-layout.mjs'
    data, script = fixture.read_bytes(), probe.read_bytes()
    report = validate(data, script)
    controls = 0
    if args.self_test:
        mutations = [data + b' ']
        for key in ['probeSha256']:
            changed = json.loads(data)
            changed[key] = '0' * 64
            mutations.append(json.dumps(changed).encode())
        for key in ['commit', 'licenseSha256']:
            changed = json.loads(data)
            changed['source'][key] = 'changed'
            mutations.append(json.dumps(changed).encode())
        changed = json.loads(data)
        changed['cases'][0]['expectedText'] = 'changed'
        mutations.append(json.dumps(changed).encode())
        changed = json.loads(data)
        changed['identity']['reporterId'] = 'changed'
        mutations.append(json.dumps(changed).encode())
        for altered in mutations:
            try:
                validate(altered, script)
            except AssertionError:
                controls += 1
                continue
            raise AssertionError('changed layout evidence accepted')
        try:
            validate(data, script + b' ')
        except AssertionError:
            controls += 1
        else:
            raise AssertionError('changed layout probe accepted')
    if args.donor_root:
        with tempfile.TemporaryDirectory(prefix='bluebook-layout-') as tmp:
            output = Path(tmp) / 'replayed.json'
            subprocess.run(['bun', str(probe), '--donor-root', str(args.donor_root), '--output', str(output)], check=True)
            assert output.read_bytes() == data, 'source layout replay changed'
    print(json.dumps({'sourceEvidenceOnly': True, 'cases': len(report['cases']), 'controls': controls, 'donorReplayed': args.donor_root is not None}))


if __name__ == '__main__':
    main()
