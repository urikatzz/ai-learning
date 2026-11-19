(()=>{'use strict';
// Small scalar reverse-mode autodiff engine and decoder-only Transformer.
class Value {
  constructor(data, parents=[], backward=()=>{}) { this.data=data; this.grad=0; this.parents=parents; this._backward=backward; }
  add(other){other=asValue(other);const a=this,b=other,out=new Value(a.data+b.data,[a,b]);out._backward=()=>{a.grad+=out.grad;b.grad+=out.grad};return out}
  mul(other){other=asValue(other);const a=this,b=other,out=new Value(a.data*b.data,[a,b]);out._backward=()=>{a.grad+=b.data*out.grad;b.grad+=a.data*out.grad};return out}
  div(other){other=asValue(other);return this.mul(other.pow(-1))}
  pow(n){const a=this,out=new Value(a.data**n,[a]);out._backward=()=>{a.grad+=n*(a.data**(n-1))*out.grad};return out}
  exp(){const a=this,y=Math.exp(a.data),out=new Value(y,[a]);out._backward=()=>{a.grad+=y*out.grad};return out}
  log(){const a=this,out=new Value(Math.log(Math.max(a.data,1e-12)),[a]);out._backward=()=>{a.grad+=out.grad/Math.max(a.data,1e-12)};return out}
  tanh(){const a=this,y=Math.tanh(a.data),out=new Value(y,[a]);out._backward=()=>{a.grad+=(1-y*y)*out.grad};return out}
  backward(){const topo=[],seen=new Set();const visit=v=>{if(!seen.has(v)){seen.add(v);for(const p of v.parents)visit(p);topo.push(v)}};visit(this);this.grad=1;for(let i=topo.length-1;i>=0;i--)topo[i]._backward()}
}
const asValue=x=>x instanceof Value?x:new Value(x), sum=xs=>xs.reduce((a,b)=>a.add(b),asValue(0)), dot=(a,b)=>sum(a.map((x,i)=>x.mul(b[i]))), softmax=xs=>{const m=Math.max(...xs.map(x=>x.data)),ex=xs.map(x=>x.add(-m).exp()),total=sum(ex);return ex.map(x=>x.div(total))}, gelu=x=>x.mul(.5).mul(asValue(1).add(x.add(x.pow(3).mul(.044715)).mul(.7978845608).tanh()));
class RNG{constructor(seed=42){this.s=seed>>>0}next(){this.s=(1664525*this.s+1013904223)>>>0;return (this.s+1)/4294967297}normal(){const a=Math.max(this.next(),1e-9),b=this.next();return Math.sqrt(-2*Math.log(a))*Math.cos(2*Math.PI*b)}}
class TinyDecoder {
 constructor(tokens,{layers=2,width=8,seed=42}={}){this.tokens=tokens;this.V=tokens.length;this.D=width;this.L=layers;this.rng=new RNG(seed);this.params=[];this.init();}
 parameter(n){const p=Array.from({length:n},()=>new Value(this.rng.normal()*0.12));this.params.push(...p);return p}
 matrix(r,c){return Array.from({length:r},()=>this.parameter(c))}
 init(){const D=this.D;this.emb=this.matrix(this.V,D);this.pos=this.matrix(32,D);this.blocks=Array.from({length:this.L},()=>({ln1:{g:this.parameter(D).map(x=>{x.data=1;return x}),b:this.parameter(D)},wq:this.matrix(D,D),wk:this.matrix(D,D),wv:this.matrix(D,D),wo:this.matrix(D,D),ln2:{g:this.parameter(D).map(x=>{x.data=1;return x}),b:this.parameter(D)},w1:this.matrix(2*D,D),b1:this.parameter(2*D),w2:this.matrix(D,2*D),b2:this.parameter(D)}));this.final={g:this.parameter(D).map(x=>{x.data=1;return x}),b:this.parameter(D)};this.out=this.matrix(this.V,D);this.bo=this.parameter(this.V);}
 norm(x,p){const mean=sum(x).div(x.length),variance=sum(x.map(v=>v.add(mean.mul(-1)).pow(2))).div(x.length);return x.map((v,i)=>v.add(mean.mul(-1)).div(variance.add(1e-5).pow(.5)).mul(p.g[i]).add(p.b[i]))}
 forward(ids,{snapshot=false}={}) {
  const cache={tokens:ids.map(i=>this.tokens[i]),layers:[]};
  let x=ids.map((id,i)=>this.emb[id].map((v,j)=>v.add(this.pos[i][j])));
  for(let li=0;li<this.L;li++) {
   const p=this.blocks[li],xn=x.map(r=>this.norm(r,p.ln1));
   const q=xn.map(r=>p.wq.map(col=>dot(r,col))),k=xn.map(r=>p.wk.map(col=>dot(r,col))),v=xn.map(r=>p.wv.map(col=>dot(r,col)));
   const att=ids.map((_,i)=>softmax(ids.map((__,j)=>j<=i?dot(q[i],k[j]).div(Math.sqrt(this.D)):asValue(-1e9))));
   const ctx=ids.map((_,i)=>Array.from({length:this.D},(_,d)=>sum(att[i].map((a,j)=>a.mul(v[j][d])))));
   const proj=ctx.map(r=>p.wo.map(col=>dot(r,col))),res=x.map((r,i)=>r.map((z,d)=>z.add(proj[i][d])));
   const n2=res.map(r=>this.norm(r,p.ln2));
   const hidden=n2.map(r=>p.w1.map((col,j)=>gelu(dot(r,col).add(p.b1[j]))));
   const ff=hidden.map(row=>p.w2.map((col,j)=>dot(row,col).add(p.b2[j])));
   x=res.map((r,i)=>r.map((z,d)=>z.add(ff[i][d])));
   if(snapshot&&li===this.L-1)cache.layers.push({q:q.map(r=>r.map(a=>a.data)),k:k.map(r=>r.map(a=>a.data)),v:v.map(r=>r.map(a=>a.data)),attention:att.map(r=>r.map(a=>a.data))});
  }
  const nf=x.map(r=>this.norm(r,this.final));
  cache.logits=nf.map(r=>this.out.map((row,j)=>dot(r,row).add(this.bo[j])));
  return cache;
 }
 loss(ids){const {logits}=this.forward(ids),losses=[];for(let t=0;t<ids.length-1;t++){const probs=softmax(logits[t]);losses.push(probs[ids[t+1]].log().mul(-1))}return sum(losses).div(losses.length)}
 predict(ids,temperature=1){const last=this.forward(ids),log=last.logits.at(-1).map(v=>asValue(v.data/temperature));return softmax(log).map(x=>x.data)}
 predictDetail(ids,temperature=1){const logits=this.forward(ids).logits.at(-1).map(v=>v.data),scaled=logits.map(v=>asValue(v/temperature));return {logits,probs:softmax(scaled).map(x=>x.data)}}
 inspect(ids){return this.forward(ids,{snapshot:true})}
 tensors(){const result=[],add=(id,label,group,rows)=>result.push({id,label,group,shape:rows.shape,values:rows.values.flat()});const matrix=(id,label,group,rows)=>add(id,label,group,{shape:[rows.length,rows[0]?.length||0],values:rows});const vector=(id,label,group,values)=>add(id,label,group,{shape:[values.length],values:[values]});
  matrix('token-embeddings','Token embeddings','Embeddings',this.emb);matrix('position-embeddings','Position embeddings','Embeddings',this.pos);
  this.blocks.forEach((p,i)=>{const group=`Layer ${i+1}`;vector(`layer-${i}-ln1-gamma`,'LayerNorm 1 scale',group,p.ln1.g);vector(`layer-${i}-ln1-beta`,'LayerNorm 1 bias',group,p.ln1.b);matrix(`layer-${i}-wq`,'WQ · Query projection',group,p.wq);matrix(`layer-${i}-wk`,'WK · Key projection',group,p.wk);matrix(`layer-${i}-wv`,'WV · Value projection',group,p.wv);matrix(`layer-${i}-wo`,'WO · Attention output',group,p.wo);vector(`layer-${i}-ln2-gamma`,'LayerNorm 2 scale',group,p.ln2.g);vector(`layer-${i}-ln2-beta`,'LayerNorm 2 bias',group,p.ln2.b);matrix(`layer-${i}-w1`,'W1 · Feed-forward input',group,p.w1);vector(`layer-${i}-b1`,'b1 · Feed-forward input bias',group,p.b1);matrix(`layer-${i}-w2`,'W2 · Feed-forward output',group,p.w2);vector(`layer-${i}-b2`,'b2 · Feed-forward output bias',group,p.b2)});
  vector('final-ln-gamma','Final LayerNorm scale','Output',this.final.g);vector('final-ln-beta','Final LayerNorm bias','Output',this.final.b);matrix('output-weight','Output projection','Output',this.out);vector('output-bias','Output bias','Output',this.bo);return result}
}
class Adam{constructor(params,lr=.03){this.params=params;this.lr=lr;this.m=params.map(()=>0);this.v=params.map(()=>0);this.t=0;this.frozen=new Set()}step(){this.t++;for(let i=0;i<this.params.length;i++){const p=this.params[i],g=p.grad;if(this.frozen.has(i)){p.grad=0;continue}this.m[i]=.9*this.m[i]+.1*g;this.v[i]=.999*this.v[i]+.001*g*g;const m=this.m[i]/(1-Math.pow(.9,this.t)),v=this.v[i]/(1-Math.pow(.999,this.t));p.data-=this.lr*m/(Math.sqrt(v)+1e-8);p.grad=0}}setRate(lr){this.lr=lr}setFrozen(index,frozen){if(frozen)this.frozen.add(index);else this.frozen.delete(index)}}
window.TinyDecoder=TinyDecoder;window.TinyAdam=Adam;window.LabValue=Value;})();
