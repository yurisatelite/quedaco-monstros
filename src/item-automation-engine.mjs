import {automationFor,DAMAGE_TYPES,ITEM_SCOPE} from './item-automation-catalog.mjs';
export const effectMeta=effect=>effect?.getFlag?.(ITEM_SCOPE,'itemEffect')??effect?.flags?.[ITEM_SCOPE]?.itemEffect;
export const shieldSigil=item=>Array.from(item?.actor?.items??[]).find(i=>i.type==='sigil'&&i.system.item===item.uuid&&i.getFlag?.('quedaco-monstros','itemAutomationSupport')==='illuminator');
const get=(doc,key)=>doc?.getFlag?.(ITEM_SCOPE,key);
const change=(key,value,mode=5)=>({key,value:String(value),mode,priority:50});
export function potionEffect(spec,{walk=0,damageType,sceneId,itemUuid,seconds,worldTime=0}={}){
  const changes=[],statuses=[];
  if(spec.id==='climb')changes.push(change('system.movement.climb',walk));
  if(spec.id==='strength')changes.push(change('system.abilities.str.value',5));
  if(spec.id==='resistance'){
    if(!DAMAGE_TYPES[damageType])throw Error('Escolha um tipo de resistência válido.');
    changes.push(change(`system.modifiers.damage.taken.${damageType}`,'resistance'));
  }
  if(spec.id==='invisible')statuses.push('invisible');
  if(spec.id==='antitoxin'){
    // Skyfall's Protegido is not immunity or resistance to poison damage.
    changes.push(change('system.modifiers.condition.protected','poisoned',2),change('system.modifiers.descriptor.protected','poison',2));
  }
  return {name:`${spec.name} — V2`,type:'base',img:spec.id==='invisible'?'icons/svg/invisible.svg':'icons/svg/aura.svg',
    disabled:false,transfer:false,changes,statuses,
    description:spec.rule,system:{transfer:'actor',specialDuration:spec.id==='antitoxin'||seconds?'':'scene'},
    flags:{['quedaco-monstros']:{itemEffect:{kind:spec.id,itemUuid,sceneId,until:spec.id==='antitoxin'?'rest':seconds?'time':'scene',
      activatedAt:Date.now(),...(seconds?{expires:worldTime+seconds}:{})}}}};
}
export function createItemAutomationEngine({game,resolve,roll,damage,attack,post=async()=>{},clone=structuredClone,homebrew=()=>({range:12,seconds:3600})}){
  let chain=Promise.resolve();const completed=new Set();
  const serial=fn=>{const result=chain.then(fn);chain=result.catch(()=>{});return result;};
  const leader=()=>game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id===game.user.id;
  const allTokens=()=>Array.from(game.scenes).flatMap(s=>Array.from(s.tokens));
  const allActors=()=>[...new Map([...game.actors,...allTokens().map(t=>t.actor).filter(Boolean)].map(a=>[a.uuid,a])).values()];
  const managed=(actor,kind)=>Array.from(actor.effects??[]).find(e=>!e.disabled&&effectMeta(e)?.kind===kind);
  function sameScene(source,target){if(source.parent?.id!==target.parent?.id)throw Error('Os tokens precisam estar na mesma cena.');}
  function inRange(source,target,meters){
    sameScene(source,target);
    const scene=source.parent;const scale=Number(scene.grid?.distance)/Number(scene.grid?.size);
    if(!(scale>0))throw Error('Configure a escala da cena antes de usar o item.');
    const unit=String(scene.grid?.units??'').toLowerCase();
    const conversion=/^(ft|feet|p[eé]s)$/.test(unit)?3.280839895:1;
    const center=t=>({x:t.x+t.width*scene.grid.size/2,y:t.y+t.height*scene.grid.size/2});
    const a=center(source),b=center(target);
    // Normal tokens measure centre to centre; large footprints retain one adjacent square.
    const dx=Math.max(0,Math.abs(a.x-b.x)-Math.max(0,(source.width+target.width)/2-1)*scene.grid.size);
    const dy=Math.max(0,Math.abs(a.y-b.y)-Math.max(0,(source.height+target.height)/2-1)*scene.grid.size);
    if(Math.hypot(dx,dy)*scale>meters*conversion+0.001)throw Error('Alvo fora do alcance do item.');
  }
  async function removeEffect(actor,effect){
    const meta=effectMeta(effect);
    if(meta?.kind==='see-invisible'){
      const token=await resolve(meta.tokenUuid);
      if(token){
        const modes=clone(token.detectionModes??[]).filter(m=>m.id!=='seeInvisibility');
        if(meta.previousMode)modes.push(clone(meta.previousMode));
        await token.update({detectionModes:modes});
      }
    }
    await effect.delete();
  }
  async function expire(where){
    for(const actor of allActors())for(const effect of Array.from(actor.effects??[])){
      const meta=effectMeta(effect);if(!meta)continue;
      if(where(meta,actor))await removeEffect(actor,effect);
    }
    for(const token of allTokens()){
      const state=get(token,'shieldLight');
      if(state&&where({until:'scene',sceneId:state.sceneId},token.actor)){
        if(state.lit)await token.update({light:state.previousLight});
        await token.setFlag(ITEM_SCOPE,'shieldLight',null);
      }
    }
    for(const actor of allActors())for(const item of actor.items??[]){
      const coating=get(item,'poisonCoating');
      if(coating&&where({until:'scene',sceneId:coating.sceneId},actor))await item.setFlag(ITEM_SCOPE,'poisonCoating',null);
    }
  }
  async function execute(item,req,userId){
    if(!leader())return;
    const actor=item?.actor??item?.parent,user=game.users.get(userId);
    if(!actor||actor.documentName!=='Actor'||!user||!actor.testUserPermission(user,'OWNER'))throw Error('Você não possui este personagem.');
    if(!req?.id||typeof req.id!=='string'||req.id.length>100)throw Error('Solicitação inválida.');
    const key=`${item.uuid}:${req.id}`;
    if(completed.has(key)||(get(item,'itemUseReceipts')??[]).includes(req.id))return;
    const spec=automationFor(item);
    const source=await resolve(req.tokenUuid);
    if(source?.documentName!=='Token'||source.actor?.uuid!==actor.uuid)throw Error('Selecione o token portador do item.');
    const target=req.targetUuid?await resolve(req.targetUuid):source;
    if(target?.documentName!=='Token'||!target.actor)throw Error('Alvo inválido.');
    sameScene(source,target);
    if(req.action==='bonus'){
      const effect=managed(actor,'speed');if(!effect)throw Error('Poção de Velocidade não está ativa.');
      if(Array.from(actor.allApplicableEffects?.()??actor.effects).some(e=>!e.disabled&&/velocidade de enoch/i.test(e.name)))throw Error('Não acumula com Velocidade de Enoch.');
      if(!game.combat?.started||game.combat.combatant?.actor?.uuid!==actor.uuid)throw Error('Use a ação bônus extra durante o turno deste personagem.');
      const turn=`${game.combat.id}:${game.combat.round}:${game.combat.turn}`;
      if(effectMeta(effect).spentTurn===turn)throw Error('A ação bônus extra já foi usada neste turno.');
      await effect.update({'flags.quedaco-monstros.itemEffect.spentTurn':turn});
      await post(actor,'Ação bônus adicional da Poção de Velocidade utilizada.');
    }else if(req.action==='poison-hit'){
      const coating=get(item,'poisonCoating');if(!coating)throw Error('Esta arma/munição não está envenenada.');
      if(!user.isGM)throw Error('A Mestra confirma o acerto que aplica o veneno.');
      const result=await roll(`${coating.formula}[poison]`,actor,{descriptors:['poison'],type:'damage'});
      await damage(target.actor,result,1,false);
      await item.setFlag(ITEM_SCOPE,'poisonCoating',coating.remaining>1?{...coating,remaining:coating.remaining-1}:null);
      await post(actor,'Veneno aplicado após confirmação de acerto; remova a dose correspondente da munição usada.');
    }else if(req.action==='release'){
      inRange(source,target,1.5);
      const effect=Array.from(target.actor.effects??[]).find(e=>effectMeta(e)?.kind==='trapped');
      if(!effect)throw Error('O alvo não está preso em uma armadilha V2.');
      const result=await roll('1d20 + @str',actor,{type:'ability'});
      if(result.total>=13)await effect.delete();
      else await damage(target.actor,await roll('1d4[piercing]',actor,{descriptors:['piercing'],type:'damage'}),1,true);
    }else{
      if(!spec)throw Error('Este Item não é uma versão V2 automatizada.');
      if(spec.id==='resistance'&&(!user.isGM||req.damageType==='random')){
        const result=await roll('1d10',actor,{type:'check'});
        req={...req,damageType:Object.keys(DAMAGE_TYPES)[result.total-1]};
      }
      const hp=target.actor.system.resources?.hp;
      let charge=null,refund=null;const undo=[];
      // Validate all choices before touching inventory. Requests cannot supply arbitrary formulas or effects.
      if(spec.id==='healer'){
        inRange(source,target,1.5);
        if(!hp||hp.value>0||hp.value<=-hp.max||target.actor.statuses?.has('dead')||target.actor.system.death?.failure>=3||target.actor.system.death?.success>=3)throw Error('Escolha uma criatura viva, ainda não estabilizada, a 0 PV ou menos.');
      }else if(spec.id==='acid'||spec.id==='kishi')inRange(source,target,6);
      else if(target.uuid!==source.uuid)throw Error('Este item é usado pelo portador.');
      if(spec.formula&&spec.id.startsWith('heal')&&(!hp||hp.value<=-hp.max||target.actor.statuses?.has('dead')||target.actor.system.death?.failure>=3))throw Error('Poção de cura não ressuscita uma criatura morta.');
      if(spec.id==='resistance'&&!DAMAGE_TYPES[req.damageType])throw Error('Tipo de dano inválido.');
      if(spec.id==='speed'&&Array.from(actor.allApplicableEffects?.()??actor.effects).some(e=>!e.disabled&&/velocidade de enoch/i.test(e.name)))throw Error('Não acumula com Velocidade de Enoch.');
      if(['climb','strength','invisible','see-invisible','resistance','antitoxin','speed'].includes(spec.id)&&managed(actor,spec.id))throw Error('Esse benefício já está ativo; encerre-o antes de consumir outra dose.');
      if(spec.id==='healer'){
        const uses=Number(item.system.uses?.value),quantity=Number(item.system.quantity);if(!(uses>0&&quantity>0))throw Error('O kit não possui aplicações.');
        charge=()=>item.update({'system.uses.value':uses===1&&quantity>1?10:uses-1,...(uses===1?{'system.quantity':quantity-1}:{})});
        refund=()=>item.update({'system.uses.value':uses,'system.quantity':quantity});
      }else if(spec.id==='shield'){
        const current=get(source,'shieldLight');
        if(current&&current.itemUuid!==item.uuid)throw Error('Outro escudo está iluminando este token.');
        if(get(source,'torchLight'))throw Error('Apague a tocha antes de ativar o escudo.');
        if(!current){
          const sigil=shieldSigil(item),charges=Number(sigil?.system.charges.value??get(item,'shieldCharges')??3);
          if(!(charges>0))throw Error('O sigilo não possui cargas.');
          charge=()=>sigil?sigil.update({'system.charges.value':charges-1}):item.setFlag(ITEM_SCOPE,'shieldCharges',charges-1);
          refund=()=>sigil?sigil.update({'system.charges.value':charges}):item.setFlag(ITEM_SCOPE,'shieldCharges',charges);
        }
      }else if(spec.id==='trap'){
        // Preparing is reusable. Trigger and release have their own actions, not a consumable charge.
      }else{
        const quantity=Number(item.system.quantity),count=spec.id==='rations'?Number(req.count??1):1;
        if(!Number.isInteger(count)||count<1||count>999||!(quantity>=count))throw Error('Quantidade insuficiente ou inválida.');
        charge=()=>item.update({'system.quantity':quantity-count});refund=()=>item.update({'system.quantity':quantity});
      }
      if(spec.id.startsWith('poison')){
        const weapon=actor.items.get(req.weaponId);
        if(!weapon||!['weapon','consumable'].includes(weapon.type))throw Error('Selecione uma arma ou pilha de munição da ficha.');
        if(weapon.type==='consumable'&&(weapon.system.type!=='ammo'||weapon.system.quantity<3))throw Error('Escolha uma pilha com pelo menos três munições.');
        if(get(weapon,'poisonCoating'))throw Error('Este item já está envenenado.');
      }
      try{
        if(charge){await charge();undo.push(refund);}
        if(spec.formula&&spec.id.startsWith('heal')){
          if(!hp)throw Error('Ficha sem pontos de vida.');
          const result=await roll(`${spec.formula}[heal]`,actor,{descriptors:['heal','magical'],type:'damage'});
          const before=clone(hp);undo.push(()=>target.actor.update({'system.resources.hp.value':before.value,'system.resources.hp.temp':before.temp}));
          await damage(target.actor,result,-1,false);
        }else if(spec.id==='healer'){
          const before=target.actor.system.death?.success??0;
          await target.actor.update({'system.death.success':3});undo.push(()=>target.actor.update({'system.death.success':before}));
          // Permanent death failures are deliberately preserved (Skyfall p.33).
          await post(actor,`Kit aplicado: ${target.actor.name} estabilizado, sem recuperar PV ou remover falhas de morte.`);
        }else if(spec.id==='shield'){
          const current=get(source,'shieldLight');
          const state=current??{itemUuid:item.uuid,sceneId:source.parent.id,previousLight:clone(source.toObject().light),lit:false};
          const lit=!state.lit;
          await source.update({light:lit?{...clone(state.previousLight),bright:6,dim:12,color:'#d4aa00',alpha:0.5,angle:360,negative:false,animation:{type:'torch',speed:5,intensity:5,reverse:false}}:clone(state.previousLight),
            'flags.quedaco-monstros.shieldLight':{...state,lit}});
        }else if(spec.id.startsWith('poison')){
          const weapon=actor.items.get(req.weaponId);
          await weapon.setFlag(ITEM_SCOPE,'poisonCoating',{formula:spec.formula,sourceUuid:item.uuid,remaining:weapon.type==='weapon'?1:3,sceneId:source.parent.id});
          undo.push(()=>weapon.setFlag(ITEM_SCOPE,'poisonCoating',null));
          await post(actor,`${weapon.name}: envenenado, ataque Potente (FOR contra CON), +${spec.formula} Venenoso no acerto. A Mestra confirma o acerto pelo botão do item; a ficha nativa não resolve esse descritor automaticamente.`);
        }else if(spec.id==='acid'||spec.id==='kishi'){
          const outcome=await attack({actor,target:target.actor,spec,advantage:req.advantage??0});
          if(outcome?.cancelled)throw Error('Ataque cancelado.');
          if(outcome.hit){
            const formula=outcome.critical?spec.formula.replace(/(\d+)d/g,(_match,n)=>`${Number(n)*2}d`):spec.formula;
            const result=await roll(`${formula}[${spec.damageType}]`,actor,{descriptors:[spec.damageType,'ranged'],type:'damage'});
            const oldHp=clone(target.actor.system.resources.hp);
            undo.push(()=>target.actor.update({'system.resources.hp.value':oldHp.value,'system.resources.hp.temp':oldHp.temp}));
            await damage(target.actor,result,1,true);
            if(spec.id==='kishi'){
              const wasBurning=target.actor.statuses.has('burning');
              await target.actor.toggleStatusEffect('burning',{active:true});
              if(!wasBurning)undo.push(()=>target.actor.toggleStatusEffect('burning',{active:false}));
            }
          }
        }else if(spec.id==='trap'){
          const prepared=get(item,'preparedTrap');
          if(req.action==='prepare'){
            if(prepared)throw Error('Armadilha já preparada.');
            await item.setFlag(ITEM_SCOPE,'preparedTrap',{sceneId:source.parent.id,x:source.x,y:source.y,width:source.width,height:source.height});
            await post(actor,'Armadilha preparada no espaço do token; a Mestra usa Acionar quando uma criatura pisar nela.');
          }else if(req.action==='trigger'){
            if(!user.isGM)throw Error('A Mestra aciona a armadilha ao confirmar que o alvo pisou nela.');
            if(!prepared||prepared.sceneId!==source.parent.id)throw Error('Prepare a armadilha nesta cena primeiro.');
            const victim=await resolve(req.victimUuid);
            if(victim?.documentName!=='Token'||!victim.actor)throw Error('Escolha o token que pisou na armadilha.');
            sameScene(source,victim);
            const origin={...prepared,parent:source.parent};inRange(origin,victim,0.1);
            const outcome=await attack({actor,target:victim.actor,spec:{...spec,fixedBonus:3},advantage:0});
            if(outcome?.cancelled)throw Error('Ataque cancelado.');
            if(outcome.hit){
              const result=await roll('1d4[piercing]',actor,{descriptors:['piercing'],type:'damage'});
              const oldHp=clone(victim.actor.system.resources.hp);
              undo.push(()=>victim.actor.update({'system.resources.hp.value':oldHp.value,'system.resources.hp.temp':oldHp.temp}));
              await damage(victim.actor,result,1,true);
              const [effect]=await victim.actor.createEmbeddedDocuments('ActiveEffect',[{...potionEffect(spec,{sceneId:source.parent.id,itemUuid:item.uuid}),name:'Armadilha — corrente de 3 m',changes:[],flags:{['quedaco-monstros']:{itemEffect:{kind:'trapped',itemUuid:item.uuid,until:'release',anchor:prepared,tokenUuid:victim.uuid}}}}]);
              undo.push(()=>effect.delete());
            }
            await item.setFlag(ITEM_SCOPE,'preparedTrap',null);
          }else throw Error('Ação de armadilha inválida.');
        }else if(spec.id==='rations'){
          await post(actor,`${req.count??1} ração(ões) consumida(s). Sem bônus automático de combate.`);
        }else{
          const config=spec.id==='see-invisible'?homebrew():{};
          if(spec.id==='see-invisible'&&(!(config.range>0)||!(config.seconds>0)))throw Error('Configure alcance e duração da poção caseira.');
          const data=potionEffect(spec,{walk:actor.system.movement.walk,damageType:req.damageType,sceneId:source.parent.id,itemUuid:item.uuid,worldTime:game.time.worldTime,seconds:config.seconds});
          if(spec.id==='resistance'&&actor.system.modifiers.damage.taken[req.damageType]==='imunity')throw Error('O personagem já é imune a esse dano.');
          if(spec.id==='see-invisible'){
            const modes=clone(source.detectionModes??[]),previous=modes.find(m=>m.id==='seeInvisibility');
            data.flags['quedaco-monstros'].itemEffect={...data.flags['quedaco-monstros'].itemEffect,tokenUuid:source.uuid,previousMode:previous??null};
            const next=modes.filter(m=>m.id!=='seeInvisibility');
            next.push({id:'seeInvisibility',enabled:true,range:Math.max(config.range,previous?.enabled?(previous.range<0?Infinity:previous.range):0)});
            if(!Number.isFinite(next.at(-1).range))next.at(-1).range=-1;
            await source.update({detectionModes:next});undo.push(()=>source.update({detectionModes:modes}));
          }
          const [effect]=await actor.createEmbeddedDocuments('ActiveEffect',[data]);undo.push(()=>effect.delete());
        }
      }catch(error){for(const revert of undo.reverse())try{await revert();}catch(rollback){console.error('QUEDAÇO | Reverter item',rollback);}throw error;}
    }
    completed.add(key);
    await item.setFlag(ITEM_SCOPE,'itemUseReceipts',[...(get(item,'itemUseReceipts')??[]),req.id].slice(-100));
    return {ok:true};
  }
  return {leader,handle:(...args)=>serial(()=>execute(...args)),
    endScene:()=>serial(async()=>{if(leader())await expire(meta=>meta.until==='scene');}),
    rest:actor=>serial(async()=>{if(leader())await expire((meta,owner)=>meta.until==='rest'&&owner.uuid===actor.uuid);}),
    expire:()=>serial(async()=>{if(leader())await expire(meta=>meta.until==='time'&&meta.expires<=game.time.worldTime);}),
    breakInvisible:actor=>serial(async()=>{if(!leader())return;const effect=managed(actor,'invisible');if(effect)await removeEffect(actor,effect);}),
    cleanup:removeEffect,
    release:({helper,target,effect,result})=>serial(async()=>{
      if(!leader()||effectMeta(effect)?.kind!=='trapped')throw Error('Armadilha inválida.');
      if(result>=13)await effect.delete();
      else await damage(target,await roll('1d4[piercing]',helper,{descriptors:['piercing'],type:'damage'}),1,true);
    })};
}
