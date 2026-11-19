(()=>{'use strict';
// Pure next-token sampling helpers (no DOM, no model): filter a probability
// distribution with top-k or top-p (nucleus), then draw from it.
const MODES=['off','topk','topp'];

// Returns {probs, kept}: probs renormalised over kept tokens (0 elsewhere),
// kept[i] true when token i survives. Eligible limits the candidates (e.g. hides <BOS>).
function filterDistribution(probs,{mode='off',k=5,p=1}={},eligible=probs.map(()=>true)){
  if(!MODES.includes(mode))throw new Error(`Unknown sampling mode: ${mode}`);
  const order=probs.map((_,i)=>i).filter(i=>eligible[i]&&probs[i]>0).sort((a,b)=>probs[b]-probs[a]);
  let keepCount=order.length;
  if(mode==='topk')keepCount=Math.min(order.length,Math.max(1,Math.floor(k)));
  if(mode==='topp'){
    // Smallest prefix whose cumulative mass reaches p; always keep at least one token.
    let mass=0;keepCount=0;
    for(const i of order){mass+=probs[i];keepCount++;if(mass>=p-1e-12)break}
  }
  const kept=probs.map(()=>false);
  order.slice(0,keepCount).forEach(i=>{kept[i]=true});
  const total=order.slice(0,keepCount).reduce((s,i)=>s+probs[i],0)||1;
  return {probs:probs.map((v,i)=>kept[i]?v/total:0),kept};
}

// Draws an index from a distribution; random is injectable for tests.
function pickIndex(probs,random=Math.random){
  let r=random()*probs.reduce((a,b)=>a+b,0);
  const index=probs.findIndex(v=>v>0&&(r-=v)<0);
  return index>=0?index:probs.indexOf(Math.max(...probs));
}

const api={filterDistribution,pickIndex};
if(typeof window!=='undefined')window.Sampling=api;
if(typeof module!=='undefined')module.exports=api;
})();
