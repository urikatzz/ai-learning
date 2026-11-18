'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(new URL('../engine.js',`file://${__filename}`),'utf8');
const scope={window:{}};vm.createContext(scope);vm.runInContext(source,scope);
const {TinyDecoder,TinyAdam}=scope.window;
const tokens=['<BOS>','<EOS>','<UNK>','.','bird','cat','dog','drinks','eats','fish','meat','milk','seeds','the','water'];
const ids=Object.fromEntries(tokens.map((token,i)=>[token,i]));
const corpus=[
 ['<BOS>','the','cat','drinks','milk','.','<EOS>'],
 ['<BOS>','the','dog','drinks','water','.','<EOS>'],
 ['<BOS>','the','cat','eats','fish','.','<EOS>'],
 ['<BOS>','the','dog','eats','meat','.','<EOS>'],
 ['<BOS>','the','bird','eats','seeds','.','<EOS>'],
].map(sentence=>sentence.map(token=>ids[token]));
function makeModel(){return new TinyDecoder(tokens,{layers:2,width:8,seed:42})}
function meanLoss(model){return corpus.reduce((total,sequence)=>total+model.loss(sequence).data,0)/corpus.length}

test('causal attention normalizes rows and blocks future tokens',()=>{
 const model=makeModel(),sequence=corpus[0],snapshot=model.inspect(sequence),attention=snapshot.layers.at(-1).attention;
 for(let row=0;row<attention.length;row++){
  assert.ok(Math.abs(attention[row].reduce((a,b)=>a+b,0)-1)<1e-10);
  for(let col=row+1;col<attention.length;col++)assert.equal(attention[row][col],0);
 }
 const prefix=model.forward(sequence.slice(0,4)).logits[2].map(x=>x.data);
 const withFuture=model.forward([...sequence.slice(0,4),ids.fish]).logits[2].map(x=>x.data);
 prefix.forEach((value,i)=>assert.ok(Math.abs(value-withFuture[i])<1e-12));
});

test('reverse-mode gradients match finite differences for Q and FFN weights',()=>{
 const model=makeModel(),sequence=corpus[0];
 for(const parameter of [model.blocks[0].wq[0][0],model.blocks[1].w1[0][0]]){
  const original=parameter.data,epsilon=1e-5,loss=model.loss(sequence);loss.backward();const analytical=parameter.grad;
  parameter.data=original+epsilon;const plus=model.loss(sequence).data;
  parameter.data=original-epsilon;const minus=model.loss(sequence).data;parameter.data=original;
  const numerical=(plus-minus)/(2*epsilon);
  assert.ok(Math.abs(analytical-numerical)<1e-6,`gradient mismatch: ${analytical} vs ${numerical}`);
  for(const p of model.params)p.grad=0;
 }
});

test('seeded Adam training lowers the real corpus next-token loss',()=>{
 const model=makeModel(),optimizer=new TinyAdam(model.params,.03),before=meanLoss(model);
 for(let step=0;step<300;step++){const loss=model.loss(corpus[step%corpus.length]);loss.backward();optimizer.step()}
 const after=meanLoss(model);
 assert.ok(after<before*.5,`expected loss to fall substantially; got ${before} -> ${after}`);
});

test('model parameter count comes from trainable tensors',()=>{
 const model=makeModel();
 assert.equal(model.params.length,1663);
 assert.equal(model.inspect(corpus[0]).layers.at(-1).q[0].length,8);
 assert.deepEqual(Array.from(model.blocks[0].w1, row=>row.length),Array(16).fill(8));
 assert.deepEqual(Array.from(model.blocks[0].w2, row=>row.length),Array(8).fill(16));
});

test('manually edited weights affect predictions and frozen scalars survive Adam updates',()=>{
 const model=makeModel(),optimizer=new TinyAdam(model.params,.03),sequence=corpus[0];
 const outputBias=model.tensors().find(tensor=>tensor.id==='output-bias').values[ids.milk];
 const before=model.predict(sequence.slice(0,-1));
 outputBias.data+=3;
 const after=model.predict(sequence.slice(0,-1));
 assert.notDeepEqual(after,before,'edited output bias should change the live model prediction');

 const frozenIndex=model.params.indexOf(outputBias),trainableIndex=model.params.findIndex(parameter=>parameter!==outputBias);
 optimizer.setFrozen(frozenIndex,true);
 const frozenValue=outputBias.data,trainableValue=model.params[trainableIndex].data;
 const loss=model.loss(sequence);loss.backward();optimizer.step();
 assert.equal(outputBias.data,frozenValue,'frozen parameter must not move');
 assert.notEqual(model.params[trainableIndex].data,trainableValue,'other parameters should still train');
});
