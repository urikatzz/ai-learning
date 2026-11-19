(()=>{'use strict';
// Plain-language catalogue of the model's tensors, grouped by the stage they belong to.
// Pure data + helpers (no DOM) so the picker UI and tests can share them.
const SECTIONS=[
  {id:'attention',title:'Attention',intro:'Tokens look at each other. Every token asks a question, offers an answer, and passes on information.'},
  {id:'feed-forward',title:'Feed-forward',intro:'A small network that thinks about each token on its own: it expands the vector, then squeezes it back.'},
  {id:'normalization',title:'Normalization',intro:'Keeps the numbers in a stable range so training does not blow up. A scale multiplies, a bias shifts.'},
  {id:'embeddings',title:'Embeddings',intro:'The starting point: each word and each position gets its own learned vector.'},
  {id:'output',title:'Output',intro:'Turns the final vector into one score (logit) per vocabulary word.'}
];

// Keyed by tensor id with the "layer-N-" prefix removed.
const TENSORS={
  'ln1-gamma':{section:'normalization',name:'LN1 scale',short:'Rescales before attention',long:'LayerNorm scale (before attention). Multiplies each normalized number; starts at 1.'},
  'ln1-beta':{section:'normalization',name:'LN1 bias',short:'Shifts before attention',long:'LayerNorm bias (before attention). Added to each normalized number; starts at 0.'},
  'wq':{section:'attention',name:'WQ',short:'What each token looks for',long:'Query projection. Turns a token into its “question” (Q) about which other tokens matter.'},
  'wk':{section:'attention',name:'WK',short:'What each token offers',long:'Key projection. Turns a token into its “label” (K) that queries are matched against.'},
  'wv':{section:'attention',name:'WV',short:'What each token passes on',long:'Value projection. Turns a token into the information (V) it hands over when attended to.'},
  'wo':{section:'attention',name:'WO',short:'Mixes the results back',long:'Attention output projection. Combines the information gathered by attention into the token’s vector.'},
  'ln2-gamma':{section:'normalization',name:'LN2 scale',short:'Rescales before feed-forward',long:'LayerNorm scale (before the feed-forward block). Starts at 1.'},
  'ln2-beta':{section:'normalization',name:'LN2 bias',short:'Shifts before feed-forward',long:'LayerNorm bias (before the feed-forward block). Starts at 0.'},
  'w1':{section:'feed-forward',name:'W1',short:'Expands the vector',long:'First feed-forward weights. Expand each token’s vector to twice its width, then GELU adds non-linearity.'},
  'b1':{section:'feed-forward',name:'b1',short:'Constant shift after W1',long:'Bias for W1: a constant added to each expanded value.'},
  'w2':{section:'feed-forward',name:'W2',short:'Squeezes it back',long:'Second feed-forward weights. Compress the expanded vector back to the model width.'},
  'b2':{section:'feed-forward',name:'b2',short:'Constant shift after W2',long:'Bias for W2: a constant added to each output value.'},
  'token-embeddings':{section:'embeddings',name:'Token embeddings',short:'One vector per word',long:'Each vocabulary word’s learned starting vector. Row = word ID.'},
  'position-embeddings':{section:'embeddings',name:'Position embeddings',short:'One vector per position',long:'Learned vector added so the model knows where in the sentence a token sits. Row = position.'},
  'final-ln-gamma':{section:'normalization',name:'Final LN scale',short:'Rescales before output',long:'Final LayerNorm scale, applied just before the output projection.'},
  'final-ln-beta':{section:'normalization',name:'Final LN bias',short:'Shifts before output',long:'Final LayerNorm bias, applied just before the output projection.'},
  'output-weight':{section:'output',name:'Output projection',short:'Vector → word scores',long:'Maps the final vector to one logit per vocabulary word; softmax turns those into probabilities.'},
  'output-bias':{section:'output',name:'Output bias',short:'Per-word baseline score',long:'A baseline score added to each word’s logit, before softmax.'}
};

const keyOf=id=>id.replace(/^layer-\d+-/,'');
const shapeLabel=shape=>shape.length===2?`${shape[0]}×${shape[1]}`:`${shape[0]}`;

// Description for one tensor; unknown ids fall back to their own label.
function describe(tensor){
  const info=TENSORS[keyOf(tensor.id)];
  return info?{...info,shape:shapeLabel(tensor.shape)}:{section:'other',name:tensor.label,short:'',long:tensor.label,shape:shapeLabel(tensor.shape)};
}

// Returns [{section,title,intro,items:[{tensor,info}]}] in teaching order, skipping empty sections.
function groupBySection(tensors){
  const buckets=new Map(SECTIONS.map(s=>[s.id,{section:s.id,title:s.title,intro:s.intro,items:[]}]));
  buckets.set('other',{section:'other',title:'Other',intro:'',items:[]});
  tensors.forEach(tensor=>{const info=describe(tensor);buckets.get(info.section).items.push({tensor,info})});
  return [...buckets.values()].filter(b=>b.items.length);
}

const api={describe,groupBySection,SECTIONS};
if(typeof window!=='undefined')window.TensorGuide=api;
if(typeof module!=='undefined')module.exports=api;
})();
