#!/usr/bin/env python3
"""Check the pinned HTML asset, source corpus, notices and bounded WASM ABI."""
import argparse
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import tarfile

REPO = Path(__file__).resolve().parents[3]
ASSETS = REPO / 'packages/law-practice/server/assets/citation-html'
FIXTURES = REPO / 'packages/law-practice/use-cases/test/fixtures/eyecite'
BINARY_SHA = '99e76b7cdfe01e574886d7b93b685174cbe7cb5944f8ba964c97019d8f53156a'
IMPORTS = ['environ_get', 'environ_sizes_get', 'clock_time_get', 'fd_close', 'fd_fdstat_get', 'fd_fdstat_set_flags', 'fd_prestat_get', 'fd_prestat_dir_name', 'fd_read', 'fd_seek', 'fd_write', 'path_filestat_get', 'path_open', 'proc_exit']


def sha_bytes(raw):
    return hashlib.sha256(raw).hexdigest()


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def uleb(raw, index):
    value = 0
    for shift in range(0, 35, 7):
        part = raw[index]; index += 1
        value |= (part & 127) << shift
        if part < 128:
            return value, index
    raise AssertionError('oversized uint32')


def name(raw, index):
    size, index = uleb(raw, index)
    return raw[index:index + size].decode('utf-8'), index + size


def abi(raw):
    assert raw[:8] == b'\0asm\x01\0\0\0'
    sections = {}; index = 8
    while index < len(raw):
        tag = raw[index]; size, index = uleb(raw, index + 1)
        assert index + size <= len(raw)
        if tag:
            assert tag not in sections
            sections[tag] = raw[index:index + size]
        index += size
    assert index == len(raw) and 8 not in sections, 'no automatic start section'
    section = sections[2]; count, index = uleb(section, 0); imports = []
    for _ in range(count):
        module, index = name(section, index); field, index = name(section, index)
        assert module == 'wasi_snapshot_preview1' and section[index] == 0
        _, index = uleb(section, index + 1); imports.append(field)
    assert index == len(section) and imports == IMPORTS
    section = sections[5]; count, index = uleb(section, 0)
    assert count == 1 and section[index] == 1, 'one unshared memory with maximum'
    initial, index = uleb(section, index + 1); maximum, index = uleb(section, index)
    assert index == len(section) and 0 < initial <= maximum == 8192
    section = sections[7]; count, index = uleb(section, 0); exports = {}
    for _ in range(count):
        field, index = name(section, index); kind = section[index]
        _, index = uleb(section, index + 1)
        assert field not in exports; exports[field] = kind
    assert index == len(section)
    expected = ['html_clean', 'html_output', 'html_output_length', 'html_output_units', 'html_release', 'html_version', 'html_iconv_version', 'html_iconv_inventory', 'html_iconv_inventory_length', 'malloc', 'free', '_initialize']
    assert exports == {**{key: 0 for key in expected}, 'memory': 2}
    return initial, maximum


def canonical(data):
    return hashlib.sha256(json.dumps(data, ensure_ascii=True, sort_keys=True, separators=(',', ':')).encode('ascii')).hexdigest()


def check_asset(raw, receipt, notices, converter_source, relink):
    assert canonical(receipt) == 'b651a197b4e33c5deb9eff46ba80250d2467b9115c91ae5737da3e465c2bab3e'
    assert canonical(notices) == '2f114a1070248da013fa45642723c15d102635848fa4d24dce46176e2ed899c9'
    assert hashlib.sha256(raw).hexdigest() == BINARY_SHA and len(raw) == 1753104
    abi(raw)
    assert b'/home/' not in raw
    assert receipt['schemaVersion'] == 'citation-html-kernel-build/v1'
    assert receipt['wasmSha256'] == BINARY_SHA and receipt['wasmBytes'] == len(raw)
    assert receipt['memoryMaximumBytes'] == 536870912 and receipt['target'] == 'wasm32-wasip1'
    assert receipt['canonicalBuildPrefix'] == '/citation-build'
    assert receipt['kernelSourceSha256'] == sha(ASSETS / 'kernel.c')
    assert receipt['producerSha256'] == sha(Path(__file__).with_name('build-html-kernel.py'))
    assert receipt['sourceArchive']['sha256'] == '8c8f1092340a89ff32bc44ad5c9693aff9bc8a7a3e161bb239666e5d15ac9aaa'
    assert receipt['sdkArchive']['sha256'] == 'b761e3a0721dbae9c09a0059e5fdb2bf917d1b4a8a7b430fb3b5aafb0984b2c4'
    assert receipt['features']['ICONV'] and not receipt['features']['HTTP'] and not receipt['features']['FTP']
    assert not receipt['features']['CATALOG'] and not receipt['features']['MODULES']
    assert notices['schemaVersion'] == 'citation-html-kernel-notices/v1'
    assert notices['upstreamRefs'] == {'WebAssembly/wasi-libc': '2e6fb9d8ee0cdf9e431fbcabe8af3115de000a13', 'llvm/llvm-project': '895aa2c896ada719451be2e3673c83da8ddf1141'}
    files = {row['notice'] for row in notices['notices']}
    assert len(files) == len(notices['notices']) == 16
    assert files == {p.name for p in (ASSETS / 'licenses').iterdir() if p.is_file()}
    for row in notices['notices']:
        assert row['noticeSha256'] == sha(ASSETS / 'licenses' / row['notice'])
    assert 'dlmalloc.c.obj' in notices['runtimeObjects']
    assert 'iconv.c.obj' not in notices['runtimeObjects']
    assert notices['converterObjects'] == ['iconv.o']
    assert not any('emmalloc' in value or 'fts' in value for value in notices['runtimeObjects'])
    assert sha_bytes(converter_source) == receipt['iconvArchive']['sha256'] == '8f74213b56238c85a50a5329f77e06198771e70dd9a739779f4c02f65d971313'
    assert receipt['relinkArchiveSha256'] == sha_bytes(relink)
    assert receipt['relinkedWasmSha256'] == BINARY_SHA
    with tarfile.open(fileobj=io.BytesIO(converter_source), mode='r:gz') as source:
        assert source.extractfile('libiconv-1.17/COPYING.LIB').read() == (ASSETS / 'licenses/gnu-libiconv-COPYING.LIB').read_bytes()
        assert source.getmember('libiconv-1.17/lib/iconv.c').isfile()
    with tarfile.open(fileobj=io.BytesIO(relink), mode='r:xz') as bundle:
        members = {member.name: member for member in bundle.getmembers()}
        expected = {'kernel.o', 'libxml2.a', 'libiconv.a', 'libc.a', 'libclang_rt.builtins.a', 'crt1-reactor.o', 'README.txt', 'link.sh'} | {'licenses/' + name for name in files}
        assert set(members) == expected and all(member.isfile() for member in members.values())
        assert all(member.mtime == member.uid == member.gid == 0 for member in members.values())
        for name in files:
            assert bundle.extractfile('licenses/' + name).read() == (ASSETS / 'licenses' / name).read_bytes()



def check_cases(data):
    assert data['schemaVersion'] == 'citation-html-kernel-cases/v1'
    assert data['scope'] == 'source cleaner outcomes; target worker qualification remains separate'
    assert data['oracleCommit'] == '04d82c032ad5fd0f9ab72a61c87110c46ee8f52e'
    assert data['oracleTree'] == 'a35a58fac03400f71a93a93485b77f1d56f2b02f'
    assert data['python'] == '3.11.15' and data['pythonHashSeed'] == '0'
    assert data['producerSha256'] == sha(Path(__file__).with_name('probe-html-kernel.py'))
    assert data['inputCorpusSha256'] == sha(FIXTURES / 'html-input.json')
    assert data['cleanSourceSha256'] == 'b2a1f8484c84f3d704d2e7fe5e0a1fdb36a8bb07d2e56880701a831d5e1a12db'
    assert data['licenseSha256'] == 'db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772'
    assert data['lockSha256'] == '864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a'
    assert data['versions'] == {'eyecite': '2.7.6', 'reporters-db': '3.2.53', 'courts-db': '0.10.22', 'lxml': '5.1.0'}
    assert data['libxmlRuntime'] == data['libxmlCompiled'] == [2, 12, 3]
    values = {row['sha256']: row['value'] for row in data['artifacts']}
    assert len(values) == len(data['artifacts']) == 1224 and list(values) == sorted(values)
    for digest, value in values.items():
        assert hashlib.sha256(json.dumps(value, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest() == digest
    rows = {row['name']: row for row in data['cases']}
    assert len(rows) == len(data['cases']) == 1097
    inputs = json.loads((FIXTURES / 'html-input.json').read_bytes())
    for row in inputs['cases']:
        assert rows[row['name']]['text'] == row['text']
    audit = json.loads((FIXTURES / 'html-cleaner-audit.json').read_bytes())
    for row in audit['cases']:
        current = rows['audit:' + row['name']]
        assert current['outcome'] == row['outcome'] and current['text'] == row['text']
        assert [{key: event[key] for key in ['domain', 'type', 'level', 'depthLimit']} for event in current['diagnostics']] == row['diagnostics']
    used = {row['text'] for row in rows.values()}; counts = {'success': 0, 'value': 0, 'parse': 0}
    for row in rows.values():
        if row['outcome']['kind'] == 'success':
            used.add(row['outcome']['value']); counts['success'] += 1
        else:
            assert row['outcome']['kind'] == 'error'
            if row['outcome']['type'] == 'builtins.ValueError': counts['value'] += 1
            else:
                assert row['outcome']['type'] == 'lxml.etree.ParserError'; counts['parse'] += 1
    assert used == set(values) and counts == {'success': 843, 'value': 238, 'parse': 16}
    assert [row['name'] for row in rows.values() if any(d['resourceLimit'] for d in row['diagnostics'])] == ['audit:depth-256', 'audit:depth-257', 'audit:depth-300']


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--oracle-root', type=Path)
    args = parser.parse_args()
    raw = (ASSETS / 'kernel.wasm').read_bytes()
    converter_source = (ASSETS / 'sources/libiconv-1.17.tar.gz').read_bytes()
    relink = (ASSETS / 'kernel-relink.tar.xz').read_bytes()
    receipt = json.loads((ASSETS / 'build-receipt.json').read_bytes())
    notices = json.loads((ASSETS / 'notices.json').read_bytes())
    data = json.loads((FIXTURES / 'html-kernel-cases.json').read_bytes())
    check_asset(raw, receipt, notices, converter_source, relink); check_cases(data)
    mutations = [lambda d: d['cases'].pop(), lambda d: d['cases'].append(copy.deepcopy(d['cases'][0])), lambda d: d.update(oracleCommit='a' * 40), lambda d: d['artifacts'][0].update(value='corrupt'), lambda d: d['cases'][0].update(text='a' * 64), lambda d: d['cases'][0].update(outcome={'kind': 'success', 'value': 'a' * 64}), lambda d: d.update(scope='worker qualified'), lambda d: d.update(libxmlRuntime=[2, 15, 4])]
    for mutate in mutations:
        broken = copy.deepcopy(data); mutate(broken)
        try: check_cases(broken)
        except AssertionError: continue
        raise AssertionError('corrupt source evidence accepted')
    broken = bytearray(raw); broken[0] = 1
    try: check_asset(broken, receipt, notices, converter_source, relink)
    except AssertionError: pass
    else: raise AssertionError('corrupt binary accepted')
    for key, value in [('memoryMaximumBytes', 1073741824), ('kernelSourceSha256', 'a' * 64), ('producerSha256', 'a' * 64)]:
        broken = copy.deepcopy(receipt); broken[key] = value
        try: check_asset(raw, broken, notices, converter_source, relink)
        except AssertionError: continue
        raise AssertionError('corrupt build receipt accepted')
    altered = copy.deepcopy(notices); altered['notices'][0]['sha256'] = 'a' * 64
    try: check_asset(raw, receipt, altered, converter_source, relink)
    except AssertionError: pass
    else: raise AssertionError('changed upstream notice identity accepted')
    altered = copy.deepcopy(receipt); altered['features']['DEBUG'] = not altered['features']['DEBUG']
    try: check_asset(raw, altered, notices, converter_source, relink)
    except AssertionError: pass
    else: raise AssertionError('changed build feature receipt accepted')
    for source_value, relink_value in [(b'corrupt', relink), (converter_source, b'corrupt')]:
        try: check_asset(raw, receipt, notices, source_value, relink_value)
        except AssertionError: continue
        raise AssertionError('corrupt source/relink material accepted')
    if args.oracle_root:
        with tempfile.TemporaryDirectory(prefix='citation-html-kernel-') as folder:
            output = Path(folder) / 'cases.json'
            subprocess.run([sys.executable, str(Path(__file__).with_name('probe-html-kernel.py')), '--oracle-root', str(args.oracle_root), '--output', str(output)], env={**os.environ, 'PYTHONHASHSEED': '0'}, check=True)
            assert json.loads(output.read_bytes()) == data
    print('PASS 1097 source outcomes / 16 retained notices / closed 14-import ABI / 512 MiB unshared memory maximum / 16 corruption controls; worker qualification is separate')


if __name__ == '__main__':
    main()
