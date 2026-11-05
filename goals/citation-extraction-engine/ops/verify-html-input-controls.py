#!/usr/bin/env python3
"""Validate portable HTML input facts and reject corrupted preparation evidence."""
import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile


def check(data):
    assert data['schemaVersion'] == 'citation-html-input/v1'
    assert data['scope'] == 'Unicode preparation only; no target native parser or worker qualification'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['python'] == '3.11.15' and data['pythonHashSeed'] == '0'
    assert data['unicodeVersion'] == '14.0.0' and data['byteorder'] == 'little'
    assert data['producerSha256'] == hashlib.sha256(Path(__file__).with_name('probe-html-input.py').read_bytes()).hexdigest()
    assert data['auditSha256'] == '049bbadd90348588e2e7a1c62daf1f5dba0b6865df9f2001b9461b8b80f9cb71'
    assert data['sources'] == {'parser.pxi': 'f51dab773ab57fc2ce68a480cc09c5821077ac0b29cb8bdc31307aabcbb44520', 'apihelpers.pxi': 'ce2a4251e717cf2e483628ffa9d104a99a0ba7d2d8077089414cc8cc5547d4ec', 'html/__init__.py': '34e708f580638899be495891e5d4ee6dbd391e2af737bef53bc991eb10971748'}  # Public source-file SHA-256 values. gitleaks:allow
    assert data['notices'] == {'LICENSE.txt': '69edb445c1335a8312d4c09271847e9956d84f0d9f724d125340cc3fad767b2a', 'LICENSES.txt': '41d49dd406aa0e1548a6d5f21a30d6bf638b3cd96eb7289dd348d83ed2e40392'}
    assert data['versions'] == {'eyecite': '2.7.6', 'reporters-db': '3.2.53', 'courts-db': '0.10.22', 'lxml': '5.1.0'}
    assert data['licenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert data['lockSha256'] == '864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a'
    assert data['testedCodePoints'] == 0x110000
    assert data['whitespaceCodePoints'] == [9, 10, 11, 12, 13, 28, 29, 30, 31, 32, 133, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288]
    assert data['declarationExpression'] == r'''^(<\?xml[^>]+)\s+encoding\s*=\s*["\'][^"\']*["\'](\s*\?>|)'''
    artifacts = {row['sha256']: row['value'] for row in data['artifacts']}
    assert len(artifacts) == len(data['artifacts']) == 1071 and list(artifacts) == sorted(artifacts)
    for digest, text in artifacts.items():
        assert hashlib.sha256(json.dumps(text, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest() == digest
    rows = {row['name']: row for row in data['cases']}
    assert len(rows) == len(data['cases']) == 1075
    assert {row['text'] for row in rows.values()} == set(artifacts)
    rejected = 0
    for row in rows.values():
        text = artifacts[row['text']]
        assert row['sourceUtf16'] == len(text.encode('utf-16-le', 'surrogatepass')) // 2
        if re.match(data['declarationExpression'], text):
            assert row['outcome'] == {'kind': 'rejected', 'reason': 'unicode-encoding-declaration'}
            rejected += 1
        else:
            maximum = max(map(ord, text), default=0)
            encoding = 'UTF-8' if maximum <= 127 else 'ISO-8859-1' if maximum <= 255 else 'UTF-16LE' if maximum <= 65535 else 'UTF-32LE'
            raw = text.encode(encoding, 'surrogatepass')
            assert row['outcome'] == {'kind': 'prepared', 'encoding': encoding, 'byteLength': len(raw), 'bytesSha256': hashlib.sha256(raw).hexdigest(), 'fullHtml': re.match(r'^\s*<(?:html|!doctype)', text, re.I) is not None}
    assert rejected == 238
    assert rows['edge:0']['outcome']['kind'] == 'prepared'
    assert rows['edge:1']['outcome']['kind'] == 'rejected'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[3]
    data = json.loads((repo / 'packages/law-practice/use-cases/test/fixtures/eyecite/html-input.json').read_bytes())
    check(data)
    def prepared(d): return next(row['outcome'] for row in d['cases'] if row['outcome']['kind'] == 'prepared')
    changes = [lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])), lambda d: d.update(oracleCommit='a' * 40), lambda d: d['artifacts'][0].update(value='corrupt'), lambda d: d['whitespaceCodePoints'].append(0xfeff), lambda d: prepared(d).update(bytesSha256='a' * 64), lambda d: prepared(d).update(byteLength=999), lambda d: prepared(d).update(fullHtml=not prepared(d)['fullHtml']), lambda d: d['cases'][0].update(sourceUtf16=999), lambda d: d.update(byteorder='big'), lambda d: d.update(scope='native backend qualified'), lambda d: d['notices'].update({'LICENSE.txt': 'a' * 64})]
    for mutate in changes:
        broken = copy.deepcopy(data)
        mutate(broken)
        try:
            check(broken)
        except AssertionError:
            continue
        raise AssertionError('corrupt HTML preparation evidence accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-html-input-') as folder:
            output = Path(folder) / 'report.json'
            subprocess.run([sys.executable, str(Path(__file__).with_name('probe-html-input.py')), '--oracle-root', str(args.oracle_root), '--output', str(output)], env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert json.loads(output.read_bytes()) == data
    print('PASS 1075 preparation decisions / 1071 immutable strings / 12 corruption controls; native parser qualification remains open')


if __name__ == '__main__':
    main()
