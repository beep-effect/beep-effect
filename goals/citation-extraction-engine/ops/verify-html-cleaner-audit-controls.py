#!/usr/bin/env python3
"""Keep the HTML audit source-bound; approval belongs to a separate decision."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def check(data):
    assert data['schemaVersion'] == 'citation-html-cleaner-audit/v1'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['producerSha256'] == hashlib.sha256(Path(__file__).with_name('probe-html-cleaner-audit.py').read_bytes()).hexdigest()
    assert data['targetProof'] is None and data['divergenceApproval'] is None
    assert data['versions'] == {'eyecite': '2.7.6', 'reporters-db': '3.2.53', 'courts-db': '0.10.22', 'lxml': '5.1.0'}
    assert data['python'] == '3.11.15' and data['pythonHashSeed'] == '0' and data['unicodeVersion'] == '14.0.0'
    assert data['byteorder'] == 'little' and data['pointerBits'] == 64
    assert data['libxmlRuntime'] == data['libxmlCompiled'] == [2, 12, 3]
    assert data['licenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert data['lockSha256'] == '864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a'
    assert data['sources'] == {'clean.py': 'b2a1f8484c84f3d704d2e7fe5e0a1fdb36a8bb07d2e56880701a831d5e1a12db', 'lxml/html/__init__.py': '34e708f580638899be495891e5d4ee6dbd391e2af737bef53bc991eb10971748', 'lxml/parser.pxi': 'f51dab773ab57fc2ce68a480cc09c5821077ac0b29cb8bdc31307aabcbb44520', 'lxml/apihelpers.pxi': 'ce2a4251e717cf2e483628ffa9d104a99a0ba7d2d8077089414cc8cc5547d4ec'}  # Public source-file SHA-256 values. gitleaks:allow
    artifacts = {row['sha256']: row['value'] for row in data['artifacts']}
    assert len(artifacts) == len(data['artifacts']) == 115
    assert list(artifacts) == sorted(artifacts)
    for digest, value in artifacts.items():
        assert hashlib.sha256(json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest() == digest
    rows = {row['name']: row for row in data['cases']}
    assert len(rows) == len(data['cases']) == 69
    used = set()
    for row in rows.values():
        used.add(row['text'])
        assert row['sourceUtf16'] == len(artifacts[row['text']].encode('utf-16-le', 'surrogatepass')) // 2
        assert row['selected'] == sorted(set(row['selected']))
        for node in row['nodes']: used.add(node['value'])
        if row['outcome']['kind'] == 'success':
            used.add(row['outcome']['value'])
            assert ' '.join(artifacts[row['nodes'][i]['value']] for i in row['selected']) == artifacts[row['outcome']['value']]
            expected = [i for i, node in enumerate(row['nodes']) if artifacts[node['value']].strip(' \t\r\n') and node['parentTag'] not in {'style', 'link', 'head', 'page-number', 'script'} and node['parentClass'] != 'star-pagination']
            assert row['selected'] == expected
        else:
            assert row['outcome']['kind'] == 'error' and not row['nodes'] and not row['selected']
    assert used == set(artifacts)
    assert artifacts[rows['depth-255']['outcome']['value']] == 'VISIBLE' and not rows['depth-255']['diagnostics']
    assert rows['depth-255']['sourceUtf16'] == 2812
    assert rows['depth-256']['sourceUtf16'] == 2823
    for depth in [256, 257, 300]:
        row = rows[f'depth-{depth}']
        assert row['outcome']['kind'] == 'success' and artifacts[row['outcome']['value']] == ''
        assert any(event['depthLimit'] and event['level'] == 'FATAL' for event in row['diagnostics'])
    for name, value in [('head-title', 'TITLE BODY'), ('nested-star', 'CHILD'), ('star-multi-class', 'VISIBLE'), ('text-node-nbsp', '\u00a0 END')]:
        assert artifacts[rows[name]['outcome']['value']] == value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/html-cleaner-audit.json').read_bytes())
    check(data)
    def depth(d): return next(row for row in d['cases'] if row['name'] == 'depth-256')
    changes = [lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])), lambda d: d.update(oracleCommit='a' * 40), lambda d: d['artifacts'][0].update(value='corrupt'), lambda d: depth(d).update(diagnostics=[]), lambda d: depth(d).update(sourceUtf16=1), lambda d: d.update(targetProof={'result':'passed'}), lambda d: d.update(divergenceApproval={'approved':True})]
    for mutate in changes:
        broken = copy.deepcopy(data); mutate(broken)
        try: check(broken)
        except AssertionError: continue
        raise AssertionError('corruption accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-html-audit-') as folder:
            output = Path(folder) / 'report.json'
            subprocess.run([sys.executable, str(Path(__file__).with_name('probe-html-cleaner-audit.py')), '--oracle-root', str(args.oracle_root), '--output', str(output)], env={**os.environ,'PYTHONHASHSEED':'0'}, check=True)
            assert json.loads(output.read_bytes()) == data
    print('PASS 69 HTML observations / 115 immutable strings / 8 corruption controls; successful native-depth truncation conflicts with the safety contract; no target proof or approval embedded in source audit')


if __name__ == '__main__': main()
