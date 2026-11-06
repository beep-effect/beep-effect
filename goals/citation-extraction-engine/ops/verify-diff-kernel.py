#!/usr/bin/env python3
"""Portable exact-step replay of the pinned private DMP kernel, not worker proof."""
import hashlib
import argparse
import json
from pathlib import Path
import subprocess
import tarfile

NODE = r'''
const fs = require('node:fs');
const assert = require('node:assert/strict');
const moduleCompiled = new WebAssembly.Module(fs.readFileSync(process.argv[1]));
const imports = WebAssembly.Module.imports(moduleCompiled);
assert.deepEqual(imports.map(x => [x.module, x.name, x.kind]),
  ['environ_get','environ_sizes_get','clock_time_get','fd_close','fd_seek','fd_write','proc_exit']
    .map(name => ['wasi_snapshot_preview1',name,'function']));
let memory;
const deny = () => 8;
const instance = new WebAssembly.Instance(moduleCompiled, {wasi_snapshot_preview1: {
  proc_exit: () => {throw Error('native exit');}, fd_close: deny, fd_seek: deny, fd_write: deny,
  environ_get: () => 0,
  environ_sizes_get: (count,size) => {
    const view = new DataView(memory.buffer);
    view.setUint32(count,0,true); view.setUint32(size,0,true); return 0;
  },
  clock_time_get: (_clock,_precision,address) => {
    new DataView(memory.buffer).setBigUint64(address,0n,true); return 0;
  }
}});
const abi = instance.exports; memory = abi.memory; abi._initialize();
assert.equal(abi.citation_diff_version(),20001);
const native = value => {
  const bytes = Buffer.from(value.bytes,'hex'), length = bytes.length/value.width;
  assert.ok([1,2,4].includes(value.width) && Number.isInteger(length));
  const address = abi.malloc(Math.max(4,length*4));
  const view = new DataView(memory.buffer);
  for(let i=0;i<length;i++) view.setUint32(address+i*4,bytes.readUIntLE(i*value.width,value.width),true);
  return {address,length};
};
const output = () => {
  const pointer = abi.citation_diff_output(), count = abi.citation_diff_steps();
  const view = new DataView(memory.buffer), steps = [];
  for(let i=0;i<count;i++) steps.push({operation:['-','+','='][view.getUint32(pointer+i*8,true)],
    amount:view.getUint32(pointer+i*8+4,true)});
  return steps;
};
let maps = 0, steps = 0;
for(const file of process.argv.slice(2)) {
  const corpus = JSON.parse(fs.readFileSync(file));
  for(const row of corpus.maps.filter(x => x.engine === 'dmp')) {
    const before = native(row.before), after = native(row.after);
    assert.equal(abi.citation_diff_run(before.address,before.length,after.address,after.length,2000000),0);
    assert.deepEqual(output(),row.steps,'exact map '+row.id+' from '+file);
    assert.equal(abi.citation_diff_required_steps(),row.steps.length);
    maps++; steps += row.steps.length;
    // Refusal must clear an earlier successful result and expose no prefix.
    if(row.steps.length) {
      assert.equal(abi.citation_diff_run(before.address,before.length,after.address,after.length,row.steps.length-1),1);
      assert.equal(abi.citation_diff_steps(),0);
      assert.equal(abi.citation_diff_required_steps(),row.steps.length);
    }
    abi.free(before.address); abi.free(after.address); abi.citation_diff_release();
  }
}
assert.equal(abi.citation_diff_run(0,4000001,0,0,2000000),2);
assert.equal(abi.citation_diff_run(0,0,0,0,2000001),2);
assert.equal(abi.citation_diff_steps(),0);
console.log(JSON.stringify({maps,steps,exactSteps:true,stepRefusal:true,absoluteBounds:true}));
'''


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', choices=['node', 'bun'], default='node')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[3]
    assets = root / 'packages/law-practice/server/assets/citation-diff'
    fixtures = root / 'packages/law-practice/use-cases/test/fixtures/eyecite'
    receipt = json.loads((assets / 'build-receipt.json').read_text())
    expected_wasm = 'eede49e6c281c6d4735ce8dea2a0d218fd39364008cf3c811e12efda491df2bf'
    assert sha(assets / 'kernel.wasm') == receipt['wasmSha256'] == expected_wasm
    assert sha(assets / 'kernel.cpp') == receipt['kernelSourceSha256']
    assert sha(Path(__file__).with_name('build-diff-kernel.py')) == receipt['producerSha256']
    archive = assets / 'sources/fast_diff_match_patch-2.0.1.tar.gz'
    assert sha(archive) == receipt['sourceArchiveSha256'] == 'ec335bbd9780d2182c351b5c486e5c80d8975ea91772eaf02014dfe9e9907a5d'
    with tarfile.open(archive) as source:
        header = source.extractfile('fast_diff_match_patch-2.0.1/diff-match-patch-cpp-stl/diff_match_patch.h').read()
        assert hashlib.sha256(header).hexdigest() == receipt['headerSha256']
    notices = json.loads((assets / 'notices.json').read_text())
    for notice in notices['additionalRuntimeNotices']:
        assert sha(assets / notice['file']) == notice['sha256']
    expected = {'diff-kernel': '24470daeb7bbc4b8166867e8071d3a2a85b9a35b4e595c0a0b7c3429a67b0dda',
                'span-offsets': 'd1f8800ef9c6b3730348c0f634d92d9e6c473a822ab72b8c933d57a67f030fd5'}
    for name, digest in expected.items():
        assert sha(fixtures / (name + '.json')) == digest
    corpus = json.loads((fixtures / 'diff-kernel.json').read_text())
    assert corpus['producerSha256'] == sha(Path(__file__).with_name('probe-diff-kernel.py'))
    assert len(corpus['maps']) == 1005
    subprocess.run([args.runtime, '-e', NODE, str(assets / 'kernel.wasm'),
                    *[str(fixtures / (name + '.json')) for name in expected]], check=True, timeout=60)


if __name__ == '__main__':
    main()
