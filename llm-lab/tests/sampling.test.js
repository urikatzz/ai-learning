'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {filterDistribution,pickIndex}=require('../sampling.js');
const probs=[.5,.3,.15,.05];
const sum=xs=>xs.reduce((a,b)=>a+b,0);

test('top-k keeps k most likely tokens and renormalises',()=>{
  const {probs:out,kept}=filterDistribution(probs,{mode:'topk',k:2});
  assert.deepEqual(kept,[true,true,false,false]);
  assert.ok(Math.abs(sum(out)-1)<1e-12);
  assert.ok(Math.abs(out[0]-.5/.8)<1e-12);
});
test('top-p keeps the smallest set reaching p',()=>{
  assert.deepEqual(filterDistribution(probs,{mode:'topp',p:.8}).kept,[true,true,false,false]);
  assert.deepEqual(filterDistribution(probs,{mode:'topp',p:.81}).kept,[true,true,true,false]);
  assert.deepEqual(filterDistribution(probs,{mode:'topp',p:.01}).kept,[true,false,false,false]);
});
test('off keeps everything; eligibility excludes tokens',()=>{
  assert.deepEqual(filterDistribution(probs).kept,[true,true,true,true]);
  const {kept}=filterDistribution(probs,{mode:'off'},[false,true,true,true]);
  assert.deepEqual(kept,[false,true,true,true]);
});
test('unknown mode throws; pickIndex follows the distribution',()=>{
  assert.throws(()=>filterDistribution(probs,{mode:'bogus'}));
  assert.equal(pickIndex([0,.2,.8],()=>0),1);
  assert.equal(pickIndex([0,.2,.8],()=>.5),2);
});
