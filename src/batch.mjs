import {preview,apply} from './adapter.mjs';
import {batchEligible,sourceFor} from './sources.mjs';

export function defaultSelection(report,{replace=false}={}){
  if(!report.candidates.some(c=>c.source)||report.origin!=='json'&&report.origin!=='biography-sections')return [];
  return report.candidates.flatMap((c,i)=>{
    if(c.blocked||c.status==='ambiguous'||c.reviewRequired)return [];
    if(c.status==='missing')return [i];
    return replace&&c.status==='existing'&&c.differences?.length?[i]:[];
  });
}
export async function prepareBatch(game,sources,{onProgress=()=>{},resolve=globalThis.fromUuid}={}){
  if(!game.user.isGM)throw Error('Apenas a Mestra pode auditar o lote.');
  const actors=Array.from(game.actors).filter(a=>batchEligible(a,sources));
  const rows=[];
  for(const [i,actor] of actors.entries()){
    try{const report=await preview(game,actor,sourceFor(actor,sources),resolve);rows.push({actorId:actor.id,name:actor.name,report});}
    catch(error){rows.push({actorId:actor.id,name:actor.name,error:error.message});}
    onProgress(i+1,actors.length);
  }
  return rows;
}
let running=false;
export async function applyBatch(game,sources,rows,selections,{onProgress=()=>{}}={}){
  if(!game.user.isGM)throw Error('Apenas a Mestra pode corrigir o lote.');
  if(running)throw Error('Já existe um lote em andamento.');
  const selected=rows.filter(r=>selections[r.actorId]?.length),result=[];
  running=true;
  try{
    for(const [i,row] of selected.entries()){
      const actor=game.actors.get(row.actorId);
      try{
        if(!actor||!batchEligible(actor,sources))throw Error('Ficha ausente ou fora do escopo de importados.');
        if(!row.report)throw Error('Esta ficha não tem uma prévia válida.');
        const count=await apply(game,actor,row.report,selections[row.actorId]);
        result.push({actorId:row.actorId,name:row.name,status:'applied',count});
      }catch(error){result.push({actorId:row.actorId,name:row.name,status:'failed',error:error.message});}
      onProgress(i+1,selected.length);
    }
  }finally{running=false;}
  return result;
}
