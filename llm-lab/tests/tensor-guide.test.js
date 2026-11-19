'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const guide=require('../tensor-guide.js');
const scope={window:{}};vm.createContext(scope);vm.runInContext(fs.readFileSync(new URL('../engine.js',`file://${__filename}`),'utf8'),scope);

test('every tensor of the real model has a plain-language description',()=>{
  const model=new scope.window.TinyDecoder(['<BOS>','a','b','<EOS>','<UNK>'],{layers:2,width:8,seed:1});
  const tensors=model.tensors();
  assert.ok(tensors.length>0);
  tensors.forEach(t=>assert.notEqual(guide.describe(t).section,'other',`${t.id} is undocumented`));
  const layer=guide.groupBySection(tensors.filter(t=>t.group==='Layer 1'));
  assert.deepEqual(layer.map(s=>s.section),['attention','feed-forward','normalization']);
  assert.deepEqual(layer[0].items.map(i=>i.info.name),['WQ','WK','WV','WO']);
});
