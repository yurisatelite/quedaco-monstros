import {ID,audit,key,snapshot} from './conversion.mjs';

export function assertAccess(game,actor){
  if(game.system?.id!=='skyfall')throw Error('Este módulo requer Skyfall.');
  if(!game.user?.isGM||!actor?.isOwner)throw Error('Apenas a Mestra com permissão de edição pode corrigir.');
  if(actor.type!=='npc'||actor.hasPlayerOwner)throw Error('Selecione uma ameaça NPC sem dono jogador.');
}

export async function preview(game,actor,raw,resolve=globalThis.fromUuid){
  assertAccess(game,actor);
  const report=audit(actor,raw);
  const identifiers=[['hierarchy',report.boss?'boss':actor.system.hierarchy],...Array.from(actor.system.archetype??[]).map(id=>['archetype',id])];
  const pack=game.packs?.get?.('skyfall-core.npc-creation');
  for(const [type,identifier] of identifiers){
    if(!identifier)continue;
    if(!pack){report.warnings.push(`Compêndio de criação de ameaças ausente: confira ${identifier} e seus benefícios.`);continue;}
    try{
      const index=Array.from(await pack.getIndex({fields:['type','system.identifier']}));
      const entry=index.find(i=>i.type===type&&i.system?.identifier===identifier);
      if(!entry){report.warnings.push(`Item nativo ${identifier} ausente do compêndio.`);continue;}
      const document=await pack.getDocument(entry._id),role=document.toObject();delete role._id;
      const existing=Array.from(actor.items).filter(i=>i.type===type);
      const matching=existing.find(i=>i.system.identifier===identifier);
      if(!matching){
        report.candidates.push({item:role,status:type==='hierarchy'&&existing.length?'review':'missing',notes:['Item nativo do compêndio.'],blocked:false,existingId:type==='hierarchy'?existing[0]?.id:undefined});
      }
      for(const benefit of role.system.benefits??[]){
        if(benefit.type!=='ability'||!benefit.uuid){report.warnings.push(`Benefício ${benefit.type??'desconhecido'} de ${identifier} exige escolha ou revisão no compêndio.`);continue;}
        const doc=await resolve(benefit.uuid);
        if(!doc){report.warnings.push(`Benefício de ${identifier} não resolvido.`);continue;}
        const item=doc.toObject();delete item._id;
        if(Array.from(actor.items).some(i=>i.type===item.type&&key(i.name)===key(item.name))||report.candidates.some(c=>c.item.type===item.type&&key(c.item.name)===key(item.name)))continue;
        report.candidates.push({item,status:'missing',blocked:false,notes:['Benefício nativo: efeitos e dados preservados.']});
      }
    }catch(error){report.warnings.push(`Não foi possível ler ${identifier}: ${error.message}`);}
  }
  return {...report,baseline:snapshot(actor)};
}

const busy=new Set();
async function createItems(actor,data){
  const Dialog=globalThis.skyfall?.applications?.BenefitsDialog;
  const original=Dialog?.prompt;
  try{
    // These exact role benefits are already included in the reviewed plan.
    if(Dialog&&typeof original==='function')Dialog.prompt=function(options,...rest){
      if(options?.item?.actor?.id===actor.id&&['hierarchy','archetype'].includes(options.item.type)&&data.some(d=>d.type===options.item.type&&d.system.identifier===options.item.system.identifier))return null;
      return original.call(this,options,...rest);
    };
    return await actor.createEmbeddedDocuments('Item',data);
  }finally{if(Dialog&&typeof original==='function')Dialog.prompt=original;}
}
export async function apply(game,actor,report,indices){
  assertAccess(game,actor);
  if(busy.has(actor.id))throw Error('Já existe uma correção em andamento nesta ficha.');
  if(report.actorId!==actor.id||report.baseline!==snapshot(actor))throw Error('A ficha mudou. Gere outra prévia.');
  const chosen=[...new Set(indices)].map(i=>report.candidates[i]);
  if(!chosen.length)throw Error('Selecione pelo menos uma correção.');
  if(chosen.some(c=>!c||c.blocked||c.status==='ambiguous'))throw Error('Seleção contém conteúdo que exige revisão manual.');
  const before=chosen.filter(c=>c.existingId).map(c=>actor.items.get(c.existingId)?.toObject());
  if(before.some(i=>!i))throw Error('Um Item selecionado não existe mais.');
  const backup={date:new Date().toISOString(),before,created:[],baseline:report.baseline};
  busy.add(actor.id);
  try{
    // Persist recovery data BEFORE changing Items, then record every created ID.
    await actor.setFlag(ID,'backup',backup);
    for(const candidate of chosen){
      const data=structuredClone(candidate.item);delete data._id;
      if(candidate.existingId){
        await actor.updateEmbeddedDocuments('Item',[{_id:candidate.existingId,system:data.system,name:data.name}],{diff:false,recursive:false});
      }else{
        const docs=await createItems(actor,[data]);
        if(!docs.length)throw Error('O sistema não criou o Item selecionado.');
        backup.created.push(...docs.map(d=>d.id));
        await actor.setFlag(ID,'backup',backup);
      }
    }
    backup.after=snapshot(actor);
    await actor.setFlag(ID,'backup',backup);
    return chosen.length;
  }catch(error){
    try{
      if(backup.created.length)await actor.deleteEmbeddedDocuments('Item',backup.created);
      if(before.length)await actor.updateEmbeddedDocuments('Item',before,{diff:false,recursive:false});
      await actor.setFlag(ID,'backup',{...backup,failed:true,error:error.message});
    }catch(recovery){throw Error(`Correção falhou: ${error.message}. Recuperação incompleta: ${recovery.message}. Backup salvo na ficha.`);}
    throw error;
  }finally{busy.delete(actor.id);}
}

export async function undo(game,actor){
  assertAccess(game,actor);
  const backup=actor.flags?.[ID]?.backup;
  if(!backup?.after||backup.undone)throw Error('Nenhuma correção disponível para desfazer.');
  if(busy.has(actor.id)||snapshot(actor)!==backup.after)throw Error('A ficha mudou depois da correção. Revise o backup antes de restaurar.');
  busy.add(actor.id);
  try{
    if(backup.created.length)await actor.deleteEmbeddedDocuments('Item',backup.created);
    if(backup.before.length)await actor.updateEmbeddedDocuments('Item',backup.before,{diff:false,recursive:false});
    await actor.setFlag(ID,'backup',{...backup,undone:true});
  }finally{busy.delete(actor.id);}
}
