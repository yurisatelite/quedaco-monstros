import {AUTOMATION_FLAG,REQUEST_FLAG,ITEM_AUTOMATIONS,DAMAGE_TYPES,automationFor,createV2Items} from './item-automation-catalog.mjs';
import {createItemAutomationEngine,effectMeta,shieldSigil} from './item-automation-engine.mjs';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let engine;
const report=error=>{console.error('QUEDAÇO | Itens V2',error);ui.notifications.error(error.message);};
const get=(doc,key)=>doc?.getFlag?.('quedaco-monstros',key);
const clone=value=>foundry.utils.deepClone(value);

async function dialog(title,content,actions=[['use','Usar']]){
  return foundry.applications.api.DialogV2.wait({window:{title},content,
    buttons:actions.map(([action,label])=>({action,label,callback:(_event,_button,app)=>({action,
      ...Object.fromEntries(Array.from(app.element.querySelectorAll('[name]')).map(input=>[input.name,input.value]))})})),
    close:()=>null,rejectClose:false});
}
async function post(actor,text){await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<p><strong>QUEDAÇO V2:</strong> ${escape(text)}</p>`});}
async function roll(formula,actor,options={}){
  const RollClass=globalThis.skyfall?.dice?.SkyfallRoll??foundry.dice.Roll;
  const result=await new RollClass(formula,actor.getRollData(),{...options,descriptors:options.descriptors??[]}).evaluate();
  await result.toMessage({speaker:ChatMessage.getSpeaker({actor}),flavor:'QUEDAÇO — Item V2'});
  return result;
}
async function attack({actor,target,spec,advantage}){
  if(![-1,0,1].includes(Number(advantage)))throw Error('Modificador de vantagem inválido.');
  const fixed=Number.isFinite(spec.fixedBonus);
  const options=await dialog(`${spec.name} — ataque`,
    `<p>Alvo: ${escape(target.name)}. ${fixed?'Ataque fixo +3':'Ataque à distância de DES + proficiência'} contra DES. Confira modificadores e Protegido antes de rolar.</p>
    <label>Vantagem <select name="keep"><option value="0">Normal</option><option value="1">Vantagem</option><option value="-1">Desvantagem</option></select></label>
    <label>Modificador adicional <input name="bonus" type="number" value="0" step="1"></label>`,[['roll','Rolar ataque']]);
  if(!options)return {cancelled:true};
  const bonus=Number(options.bonus),keep=Number(options.keep);
  if(!Number.isFinite(bonus)||Math.abs(bonus)>100||![-1,0,1].includes(keep))throw Error('Modificador inválido.');
  const dice=keep===1?'2d20kh':keep===-1?'2d20kl':'1d20';
  const result=await roll(`${dice}+${fixed?3:'@dex+@prof'}+${bonus}`,actor,{type:'attack',descriptors:['ranged',spec.damageType??'piercing']});
  const protection=Number(target.system.abilities.dex.protection);
  // The GM confirms after reactions/catharsis. Never apply damage just because a provisional total passed.
  const confirm=await dialog('Resolver ataque do Item V2',`<p>Total inicial: ${result.total}. Proteção DES: ${protection}. Confira catarse, crítico e reações antes de confirmar.</p>`,[['hit','Acertou — aplicar dano'],['critical','Crítico — dobrar dados'],['miss','Errou']]);
  return {hit:['hit','critical'].includes(confirm?.action),critical:confirm?.action==='critical',cancelled:!confirm};
}

export async function createItemsV2(){
  const result=await createV2Items(game);
  ui.notifications.info(`Itens V2: ${result.created.length} criados; ${result.existing.length} já existentes.`);
  if(result.missingSource.length)ui.notifications.warn(`Fontes oficiais não encontradas: ${result.missingSource.join(', ')}. Nenhum substituto foi inventado.`,{permanent:true});
  return result;
}

async function use(item,source,extra={}){
  if(!game.users.some(user=>user.active&&user.isGM))throw Error('Uma Mestra precisa estar conectada.');
  const spec=automationFor(item),coating=get(item,'poisonCoating');
  let target=source;const selected=Array.from(game.user.targets??[]);
  let content=spec?`<p>${escape(spec.rule)}</p>`:'<p>Confirme o acerto da arma envenenada antes de aplicar o dano adicional. O ataque Potente deve ser FOR contra CON.</p>';
  let actions=[['use',spec?.action??'Aplicar veneno no acerto']];
  if(coating&&!spec){
    if(!game.user.isGM)throw Error('A Mestra confirma o acerto pelo interruptor da arma envenenada.');
    if(selected.length!==1)throw Error('Marque exatamente um alvo para o acerto.');
    target=selected[0].document;actions=[['poison-hit','Confirmar acerto e aplicar veneno']];
  }else if(extra.action==='bonus')actions=[['bonus','Usar a ação bônus extra deste turno']];
  else if(extra.action==='release'){
    if(selected.length!==1)throw Error('Marque a criatura presa na armadilha.');
    target=selected[0].document;actions=[['release','Testar FOR 13 para libertar']];
  }else if(spec?.id==='healer'){
    if(selected.length!==1)throw Error('Marque o alvo que deseja estabilizar.');
    target=selected[0].document;
  }else if(spec?.id==='acid'||spec?.id==='kishi'){
    if(selected.length!==1)throw Error('Marque exatamente um alvo para o arremesso.');
    target=selected[0].document;
  }else if(spec?.id==='resistance'){
    content+=`<label>Tipo de dano <select name="damageType"><option value="random">Sortear d10</option>${Object.entries(DAMAGE_TYPES).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label>`;
    if(!game.user.isGM)content+='<p>O tipo é sorteado; a Mestra pode escolher outro antes do uso.</p>';
  }else if(spec?.id.startsWith('poison')){
    const weapons=Array.from(item.actor.items).filter(i=>i.type==='weapon'||i.type==='consumable'&&i.system.type==='ammo');
    content+=`<label>Aplicar em <select name="weaponId">${weapons.map(i=>`<option value="${i.id}">${escape(i.name)}</option>`).join('')}</select></label>`;
  }else if(spec?.id==='rations')content+='<label>Quantidade de rações <input name="count" type="number" min="1" max="999" value="1" step="1"></label>';
  else if(spec?.id==='trap'){
    actions=get(item,'preparedTrap')?[['trigger','Acionar contra alvo marcado']]:[['prepare','Preparar neste espaço']];
    if(get(item,'preparedTrap')&&!game.user.isGM)throw Error('A Mestra aciona a armadilha quando uma criatura pisar nela.');
  }
  const answer=await dialog(item.name,content,actions);if(!answer)return;
  if(spec?.id==='trap'&&answer.action==='trigger'&&selected.length!==1)throw Error('Marque quem pisou na armadilha.');
  const req={id:foundry.utils.randomID(),tokenUuid:source.uuid,targetUuid:target.uuid,
    action:answer.action,...(answer.weaponId?{weaponId:answer.weaponId}:{}),
    ...(answer.damageType?{damageType:answer.damageType}:{}),...(answer.count?{count:Number(answer.count)}:{}),
    ...(spec?.id==='trap'&&answer.action==='trigger'?{victimUuid:selected[0].document.uuid}:{})};
  if(req.damageType){
    if(!game.user.isGM)req.damageType='random';
  }
  if(game.user.isGM)await engine.handle(item,req,game.user.id);
  else await item.setFlag('quedaco-monstros',REQUEST_FLAG,req);
}

function addActorButtons(app,element){
  const actor=app.document??app.actor;if(actor?.documentName!=='Actor'||!actor.isOwner)return;
  const root=element instanceof HTMLElement?element:element?.[0]??app.element;if(!root?.querySelectorAll)return;
  root.querySelectorAll('[data-quedaco-item-use], [data-quedaco-effects-tools]').forEach(e=>e.remove());
  const add=(parent,label,handler,marker='quedacoItemUse')=>{
    const button=document.createElement('button');button.type='button';button.dataset[marker]='';button.title=label;
    button.setAttribute('aria-label',label);button.textContent=label;
    button.style.cssText='font-size:11px;min-height:20px;height:auto;width:auto;padding:1px 4px;';
    button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();Promise.resolve().then(handler).catch(report);});
    parent.append(button);return button;
  };
  const tokenFor=()=>{
    const candidates=canvas.tokens.placeables.filter(t=>t.actor?.uuid===actor.uuid);
    const token=candidates.find(t=>t.controlled)??(candidates.length===1?candidates[0]:null);
    if(!token)throw Error('Selecione o token portador na cena.');return token.document;
  };
  let example;
  for(const row of root.querySelectorAll('[data-entry-id]')){
    const item=actor.items.get(row.dataset.entryId),spec=automationFor(item),coating=get(item,'poisonCoating');
    const controls=row.querySelector('.item-controls');if(!controls||(!spec&&!coating))continue;
    example??=item;
    const label=coating?'Veneno: confirmar acerto':spec.id==='healer'?`Estabilizar (${item.system.uses?.value??0})`:spec.id==='shield'?`Luz (${shieldSigil(item)?.system.charges.value??get(item,'shieldCharges')??3} cargas)`:spec.action;
    const useButton=add(controls,label,()=>use(item,tokenFor()));
    useButton.innerHTML=`<i class="fa-solid ${spec?.id==='shield'?'fa-lightbulb':coating?'fa-skull-crossbones':'fa-bolt'}"></i>`;
    useButton.style.cssText='display:inline-flex;align-items:center;justify-content:center;flex:0 0 16px;width:16px;height:16px;min-height:0;border:0;background:none;padding:0;color:inherit;';
    if(spec?.id==='shield'&&game.user.isGM){const rechargeButton=add(controls,'Recarregar sigilo',async()=>{
      const answer=await dialog('Recarregar Iluminador','<p>Confirme que o sigilo foi recarregado pelas regras da mesa. Restaura até três cargas.</p>',[['recharge','Confirmar recarga']]);
      if(answer){const sigil=shieldSigil(item);if(sigil)await sigil.update({'system.charges.value':sigil.system.charges.max});else await item.setFlag('quedaco-monstros','shieldCharges',3);}
    });rechargeButton.innerHTML='<i class="fa-solid fa-rotate-right"></i>';rechargeButton.style.cssText=useButton.style.cssText;}
  }
  const effects=Array.from(actor.effects??[]);
  if(!example&&!effects.some(effectMeta))return;
  const panel=document.createElement('div');panel.dataset.quedacoEffectsTools='';
  panel.style.cssText='display:flex;gap:5px;flex-wrap:wrap;padding:5px;border-top:1px solid var(--color-border);';
  const destination=root.querySelector('.window-content')??root;destination.append(panel);
  if(example&&effects.some(e=>effectMeta(e)?.kind==='speed'&&!e.disabled))add(panel,'Usar ação bônus extra',()=>use(example,tokenFor(),{action:'bonus'}));
  if(example)add(panel,'Libertar alvo de armadilha',()=>use(example,tokenFor(),{action:'release'}));
  if(game.user.isGM){
    add(panel,'Encerrar efeitos da cena',async()=>{
      if(await dialog('Encerrar cena','<p>Encerra os efeitos V2 com duração de cena, incluindo venenos e Iluminador. Não encerra efeitos de descanso ou de tempo.</p>',[['end','Encerrar cena']]))await engine.endScene();
    });
    add(panel,'Concluir descanso deste personagem',async()=>{
      if(await dialog('Concluir descanso',`<p>Remover benefícios V2 até o próximo descanso de ${escape(actor.name)}?</p>`,[['rest','Concluir descanso']]))await engine.rest(actor);
    });
  }
}

function messageActor(message){
  const uuid=message.system?.origin?.actor;
  return uuid?fromUuidSync(uuid):game.actors.get(message.speaker?.actor);
}
function breaksInvisibility(message){
  let item=message.system?.item;
  if(typeof item==='string'){try{item=JSON.parse(item);}catch{item=null;}}
  return item?.type==='spell'||(message.rolls??[]).some(r=>r.options?.type==='attack')
    ||(message.system?.rolls??[]).some(r=>r.options?.type==='attack');
}

export function registerItemAutomations(){
  if(game.system.id!=='skyfall')return;
  engine=createItemAutomationEngine({game,resolve:uuid=>fromUuid(uuid),roll,attack,post,clone,
    damage:async(actor,result,multiplier,dr)=>{
      if(typeof actor.system._applyDamage!=='function')throw Error('Aplicação nativa de dano/cura indisponível.');
      await actor.system._applyDamage(result,multiplier,dr);
    },homebrew:()=>({range:game.settings.get('quedaco-monstros','seeInvisibleRange'),seconds:game.settings.get('quedaco-monstros','seeInvisibleSeconds')})});
  Hooks.on('renderApplicationV2',addActorButtons);
  Hooks.on('renderItemDirectory',(_app,element)=>{
    if(!game.user.isGM)return;const root=element instanceof HTMLElement?element:element?.[0];
    const header=root?.querySelector('.header-actions')??root?.querySelector('.directory-header');
    if(!header||header.querySelector('[data-quedaco-create-v2]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.quedacoCreateV2='';button.textContent='QUEDAÇO — Criar itens V2';
    button.addEventListener('click',async()=>{button.disabled=true;try{await createItemsV2();}catch(e){report(e);}finally{button.disabled=false;}});header.append(button);
  });
  Hooks.on('updateItem',(item,changed,_options,userId)=>{
    const value=foundry.utils.getProperty(changed,`flags.quedaco-monstros.${REQUEST_FLAG}`)??changed[`flags.quedaco-monstros.${REQUEST_FLAG}`];
    if(value&&engine.leader()){
      const request=clone(get(item,REQUEST_FLAG));
      void engine.handle(item,request,userId).then(()=>item.setFlag('quedaco-monstros','itemUseResult',{requestId:request.id,userId,ok:true}),
        error=>item.setFlag('quedaco-monstros','itemUseResult',{requestId:request.id,userId,error:error.message})).catch(report);
    }
    const result=foundry.utils.getProperty(changed,'flags.quedaco-monstros.itemUseResult')??changed['flags.quedaco-monstros.itemUseResult'];
    if(result){const latest=get(item,'itemUseResult');if(latest?.userId===game.user.id){if(latest.error)ui.notifications.error(latest.error);else ui.notifications.info('Item V2 utilizado.');}}
  });
  const expire=()=>{void engine.expire().catch(report);};
  Hooks.on('updateWorldTime',expire);Hooks.on('updateUser',expire);expire();
  let sceneStarted=Boolean(game.settings.get('skyfall','sceneConfig')?.started);
  Hooks.on('updateSetting',(setting,changed)=>{
    if(setting.key!=='skyfall.sceneConfig')return;
    let value=changed.value;try{if(typeof value==='string')value=JSON.parse(value);}catch{return;}
    if(typeof value?.started!=='boolean')return;
    if(sceneStarted&&value.started===false&&engine.leader())void engine.endScene().catch(report);
    sceneStarted=value.started;
  });
  const checkInvisibility=message=>{
    if(!engine.leader()||!breaksInvisibility(message))return;
    const actor=messageActor(message);
    const effect=Array.from(actor?.effects??[]).find(e=>effectMeta(e)?.kind==='invisible'&&!e.disabled);
    if(effect&&Number(message.timestamp)>=effectMeta(effect).activatedAt)void engine.breakInvisible(actor).catch(report);
  };
  Hooks.on('createChatMessage',checkInvisibility);
  Hooks.on('updateChatMessage',(message,changed)=>{
    if(changed.rolls||changed.system?.rolls||changed['system.rolls'])checkInvisibility(message);
  });
  Hooks.on('quedaco:restFinished',actor=>{void engine.rest(actor).catch(report);});
  // Keep token perception in sync when a GM removes the managed detection effect manually.
  Hooks.on('deleteActiveEffect',effect=>{
    const meta=effectMeta(effect);if(meta?.kind!=='see-invisible'||!engine.leader())return;
    void fromUuid(meta.tokenUuid).then(async token=>{
      if(!token)return;const modes=clone(token.detectionModes).filter(m=>m.id!=='seeInvisibility');
      if(meta.previousMode)modes.push(meta.previousMode);await token.update({detectionModes:modes});
    }).catch(report);
  });
  Hooks.on('preUpdateToken',(token,changed,options)=>{
    if(changed.x===undefined&&changed.y===undefined)return;
    if(options?.quedacoIgnoreTrap&&game.user.isGM)return;
    const trap=Array.from(token.actor?.effects??[]).find(e=>!e.disabled&&effectMeta(e)?.kind==='trapped'&&effectMeta(e).tokenUuid===token.uuid);
    if(!trap)return;
    const anchor=effectMeta(trap).anchor,grid=token.parent.grid;
    const x=changed.x??token.x,y=changed.y??token.y;
    const units=String(grid.units??'').toLowerCase(),conversion=/^(ft|feet|p[eé]s)$/.test(units)?3.280839895:1;
    const distance=Math.hypot(x-anchor.x,y-anchor.y)*grid.distance/grid.size;
    if(distance>3*conversion+0.001){ui.notifications.warn('A corrente da armadilha limita o movimento a 3 m. Liberte a criatura primeiro.');return false;}
  });
}

if(globalThis.Hooks){
  Hooks.once('init',()=>{
    if(game.system.id!=='skyfall')return;
    for(const [key,name,initial] of [['seeInvisibleRange','Poção V2: alcance para ver invisíveis (unidades da cena)',12],['seeInvisibleSeconds','Poção V2: duração para ver invisíveis (segundos de jogo)',3600]]){
      game.settings.register('quedaco-monstros',key,{name,hint:'Criação da mesa, não regra oficial do Skyfall.',scope:'world',config:true,type:Number,default:initial,onChange:value=>{if(!(value>0))ui.notifications.warn('O valor precisa ser maior que zero.');}});
    }
  });
  Hooks.once('init',()=>{
    if(game.system.id!=='skyfall')return;
    // Skyfall 1.0.1 lists climbing as a movement mode but omits its numeric schema field.
    for(const type of ['character','npc','partner']){
      const Base=CONFIG.Actor.dataModels[type];if(!Base||Base.schema.getField('movement.climb'))continue;
      CONFIG.Actor.dataModels[type]=class QuedacoClimbingData extends Base{
        static defineSchema(){const schema=super.defineSchema();schema.movement=new foundry.data.fields.SchemaField({...schema.movement.fields,
          climb:new foundry.data.fields.NumberField({required:true,initial:0,min:0,label:'Escalada'})});return schema;}
      };
    }
  });
  Hooks.once('ready',registerItemAutomations);
}
