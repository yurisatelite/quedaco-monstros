import test from 'node:test';
import assert from 'node:assert/strict';
import {ITEM_AUTOMATIONS,TORCH_TEMPLATE,automationFor,makeV2Data,createV2Items} from '../src/item-automation-catalog.mjs';
import {createItemAutomationEngine,potionEffect,effectMeta} from '../src/item-automation-engine.mjs';

const assign=(object,path,value)=>{const parts=path.split('.');const last=parts.pop();for(const part of parts)object=object[part]??={};object[last]=value;};
function document(data){return {...data,
  getFlag(scope,key){return this.flags?.[scope]?.[key];},
  async setFlag(scope,key,value){assign(this,`flags.${scope}.${key}`,structuredClone(value));return this;},
  async update(changes){for(const [key,value] of Object.entries(changes))assign(this,key,structuredClone(value));return this;},
  toObject(){return structuredClone({light:this.light,system:this.system,flags:this.flags,detectionModes:this.detectionModes});}};}
function fixture(kind='heal'){
  const gm={id:'gm',isGM:true,active:true},player={id:'player',isGM:false,active:true};
  const users=[gm,player];users.get=id=>users.find(u=>u.id===id);
  const actor=document({documentName:'Actor',id:'hero',uuid:'Actor.hero',name:'Hero',flags:{},items:[],effects:[],statuses:new Set(),
    system:{resources:{hp:{value:5,max:20,temp:3}},movement:{walk:9,climb:0},abilities:{str:{value:1},dex:{value:2,protection:12}},death:{success:0,failure:2},modifiers:{damage:{taken:{fire:'normal'}}}}});
  actor.testUserPermission=user=>!!user&&['gm','player'].includes(user.id);
  actor.allApplicableEffects=()=>actor.effects;
  const items=actor.items;items.get=id=>items.find(i=>i.id===id);
  actor.createEmbeddedDocuments=async(type,rows)=>rows.map((row,index)=>{
    assert.equal(type,'ActiveEffect');const effect=document({...structuredClone(row),id:`e${actor.effects.length+index}`,parent:actor});
    effect.delete=async()=>{actor.effects.splice(actor.effects.indexOf(effect),1);};actor.effects.push(effect);return effect;
  });
  actor.toggleStatusEffect=async(id,{active}={})=>active?actor.statuses.add(id):actor.statuses.delete(id);
  const spec=ITEM_AUTOMATIONS.find(s=>s.id===kind);
  const item=document({documentName:'Item',id:'item',uuid:'Actor.hero.Item.item',actor,parent:actor,name:`${spec.name} V2`,type:spec.type,
    flags:{['quedaco-monstros']:{itemAutomation:kind,shieldCharges:3}},system:{quantity:3,uses:{value:10,max:10},type:kind==='shield'?'shield':'potion'}});
  actor.items.push(item);
  const scene={id:'s',grid:{size:100,distance:1.5,units:'m'},tokens:[]};
  const token=document({documentName:'Token',uuid:'Scene.s.Token.hero',id:'hero',parent:scene,actor,x:0,y:0,width:1,height:1,flags:{},light:{bright:2,dim:4,color:'#fff'},detectionModes:[{id:'basicSight',enabled:true,range:30}]});
  scene.tokens.push(token);
  const docs=new Map([[token.uuid,token],[actor.uuid,actor],[item.uuid,item]]);
  const calls=[];
  const game={user:gm,users,actors:[actor],scenes:[scene],time:{worldTime:100},combat:{id:'c',round:1,turn:0,started:true,combatant:{actor}}};
  const deps={game,resolve:async uuid=>docs.get(uuid),roll:async(formula,_actor,options)=>{calls.push({formula,options});return {total:8,options};},
    damage:async(target,result,multiplier)=>{calls.push({damage:multiplier});await target.update({'system.resources.hp.value':Math.min(target.system.resources.hp.max,target.system.resources.hp.value-result.total*multiplier)});},
    attack:async()=>({hit:true}),post:async()=>{}};
  const engine=createItemAutomationEngine(deps);
  const request=(extra={})=>({id:Math.random().toString(),action:'use',tokenUuid:token.uuid,targetUuid:token.uuid,...extra});
  return {actor,item,token,scene,game,docs,engine,deps,calls,request};
}
test('21 requested V2 entries; clone preserves official original and adds suffix once',()=>{
  assert.equal(ITEM_AUTOMATIONS.length,21);
  const spec=ITEM_AUTOMATIONS.find(s=>s.id==='heal');
  const source={_id:'official',name:'Poção de Cura',type:'consumable',system:{quantity:1,description:{value:'Original'}},effects:[{name:'Native'}],flags:{},ownership:{default:0}};
  const before=structuredClone(source),data=makeV2Data(spec,source,'folder');
  assert.deepEqual(source,before);assert.equal(data.name,'Poção de Cura V2');assert.equal(data._id,undefined);
  assert.equal(data.folder,'folder');assert.equal(automationFor(data).id,'heal');assert.deepEqual(data.effects,[]);
});
test('four healing strengths dispatch native magical healing and consume one dose only',async()=>{
  for(const kind of ['heal','heal-major','heal-superior','heal-supreme']){
    const {item,actor,engine,calls,request}=fixture(kind);const req=request();
    await Promise.all([engine.handle(item,req,'player'),engine.handle(item,req,'player')]);
    assert.equal(item.system.quantity,2);assert.equal(actor.system.resources.hp.value,13);
    assert.deepEqual(calls[0].options.descriptors,['heal','magical']);assert.equal(calls[1].damage,-1);
  }
});
test('healer consumes application, stabilizes and preserves permanent death failures',async()=>{
  const {item,actor,engine,request}=fixture('healer');actor.system.resources.hp.value=0;
  await engine.handle(item,request(),'player');
  assert.equal(actor.system.death.success,3);assert.equal(actor.system.death.failure,2);assert.equal(actor.system.resources.hp.value,0);
  assert.equal(item.system.uses.value,9);assert.equal(item.system.quantity,3);
  await assert.rejects(engine.handle(item,request(),'player'),/estabilizada/);
  assert.equal(item.system.uses.value,9);
});
test('healer moves to next kit after ten uses and rejects a dead target',async()=>{
  const {item,actor,engine,request}=fixture('healer');actor.system.resources.hp.value=0;item.system.uses.value=1;
  await engine.handle(item,request(),'player');assert.equal(item.system.quantity,2);assert.equal(item.system.uses.value,10);
  actor.system.death.success=0;actor.system.death.failure=3;
  await assert.rejects(engine.handle(item,request(),'player'),/criatura viva/);assert.equal(item.system.quantity,2);
});
test('temporary effects use native fields and antitoxin is protection, not immunity',()=>{
  const spec=id=>ITEM_AUTOMATIONS.find(s=>s.id===id);
  assert.equal(potionEffect(spec('strength')).changes[0].key,'system.abilities.str.value');
  assert.equal(potionEffect(spec('strength')).changes[0].value,'5');
  assert.equal(potionEffect(spec('climb'),{walk:9}).changes[0].value,'9');
  assert.deepEqual(potionEffect(spec('invisible')).statuses,['invisible']);
  assert.equal(potionEffect(spec('resistance'),{damageType:'fire'}).changes[0].value,'resistance');
  assert.throws(()=>potionEffect(spec('resistance'),{damageType:'evil.path'}),/válido/);
  assert.equal(potionEffect(spec('antitoxin')).changes.some(c=>c.key.includes('imune')),false);
  assert.equal(potionEffect(spec('antitoxin')).flags['quedaco-monstros'].itemEffect.until,'rest');
});
test('scene effects expire together while rest-bound antitoxin remains',async()=>{
  const f=fixture('climb');await f.engine.handle(f.item,f.request(),'player');
  const anti=potionEffect(ITEM_AUTOMATIONS.find(s=>s.id==='antitoxin'));await f.actor.createEmbeddedDocuments('ActiveEffect',[anti]);
  await f.engine.endScene();assert.equal(f.actor.effects.length,1);assert.equal(effectMeta(f.actor.effects[0]).kind,'antitoxin');
  await f.engine.rest(f.actor);assert.equal(f.actor.effects.length,0);
});
test('see invisible preserves existing unlimited vision and restores only its own mode on expiry',async()=>{
  const {item,actor,token,game,engine,request}=fixture('see-invisible');
  token.detectionModes.push({id:'seeInvisibility',enabled:true,range:-1});
  await engine.handle(item,request(),'player');assert.equal(token.detectionModes.at(-1).range,-1);
  token.detectionModes.push({id:'feelTremor',enabled:true,range:5});game.time.worldTime=3700;
  await engine.expire();assert.equal(actor.effects.length,0);
  assert.equal(token.detectionModes.find(m=>m.id==='seeInvisibility').range,-1);
  assert.equal(token.detectionModes.find(m=>m.id==='feelTremor').range,5);
});
test('invisibility ends without removing unrelated effects',async()=>{
  const {item,actor,engine,request}=fixture('invisible');await engine.handle(item,request(),'player');
  await actor.createEmbeddedDocuments('ActiveEffect',[{name:'Other',flags:{}}]);
  await engine.breakInvisible(actor);assert.deepEqual(actor.effects.map(e=>e.name),['Other']);
});
test('speed grants one extra bonus action per turn, does not stack and never changes movement',async()=>{
  const {item,actor,game,engine,request}=fixture('speed');await engine.handle(item,request(),'player');
  assert.deepEqual(actor.effects[0].changes,[]);assert.equal(actor.system.movement.walk,9);
  await engine.handle(item,request({action:'bonus'}),'player');
  await assert.rejects(engine.handle(item,request({action:'bonus'}),'player'),/já foi usada/);
  game.combat.round++;await engine.handle(item,request({action:'bonus'}),'player');
  assert.equal(item.system.quantity,2);
  await assert.rejects(engine.handle(item,request(),'player'),/já está ativo/);
});
test('Enoch blocks potion consumption and extra bonus action',async()=>{
  const {item,actor,engine,request}=fixture('speed');await actor.createEmbeddedDocuments('ActiveEffect',[{name:'Velocidade de Enoch',flags:{}}]);
  await assert.rejects(engine.handle(item,request(),'player'),/Enoch/);assert.equal(item.system.quantity,3);
});
test('shield pays one charge per scene, can be switched repeatedly and restores original light',async()=>{
  const {item,token,engine,request}=fixture('shield');const old=structuredClone(token.light);
  await engine.handle(item,request(),'player');assert.equal(item.getFlag('quedaco-monstros','shieldCharges'),2);assert.equal(token.light.bright,6);
  await engine.handle(item,request(),'player');assert.deepEqual(token.light,old);
  await engine.handle(item,request(),'player');assert.equal(item.getFlag('quedaco-monstros','shieldCharges'),2);
  await engine.endScene();assert.deepEqual(token.light,old);
  await engine.handle(item,request(),'player');assert.equal(item.getFlag('quedaco-monstros','shieldCharges'),1);
});
test('shield consumes native linked Iluminador charges instead of a parallel counter',async()=>{
  const {item,actor,engine,request}=fixture('shield');
  const sigil=document({id:'sigil',type:'sigil',flags:{['quedaco-monstros']:{itemAutomationSupport:'illuminator'}},system:{item:item.uuid,charges:{value:2,max:3}}});
  actor.items.push(sigil);await engine.handle(item,request(),'player');
  assert.equal(sigil.system.charges.value,1);assert.equal(item.getFlag('quedaco-monstros','shieldCharges'),3);
});
test('poison attaches to chosen weapon, one hit consumes coating, unauthorized hit rejected',async()=>{
  const {item,actor,token,engine,request}=fixture('poison-snake');
  const weapon=document({id:'weapon',uuid:'Actor.hero.Item.weapon',name:'Sword',actor,parent:actor,type:'weapon',flags:{},system:{quantity:1}});actor.items.push(weapon);
  await engine.handle(item,request({weaponId:'weapon'}),'player');assert.equal(item.system.quantity,2);
  assert.equal(weapon.getFlag('quedaco-monstros','poisonCoating').formula,'3d6');
  await assert.rejects(engine.handle(weapon,request({action:'poison-hit'}),'player'),/Mestra/);
  await engine.handle(weapon,request({action:'poison-hit'}),'gm');assert.equal(weapon.getFlag('quedaco-monstros','poisonCoating'),null);
});
test('acid and kishi consume on throw, hit deals damage and kishi ignites',async()=>{
  for(const id of ['acid','kishi']){
    const {item,actor,engine,request}=fixture(id);await engine.handle(item,request(),'player');
    assert.equal(item.system.quantity,2);assert.equal(actor.system.resources.hp.value,-3);
    assert.equal(actor.statuses.has('burning'),id==='kishi');
  }
});
test('cancelled throw refunds flask while a miss consumes it',async()=>{
  const f=fixture('acid');
  f.deps.attack=async()=>({cancelled:true});const cancel=createItemAutomationEngine(f.deps);
  await assert.rejects(cancel.handle(f.item,f.request(),'player'),/cancelado/);assert.equal(f.item.system.quantity,3);
  f.deps.attack=async()=>({hit:false});await createItemAutomationEngine(f.deps).handle(f.item,f.request(),'player');
  assert.equal(f.item.system.quantity,2);assert.equal(f.actor.system.resources.hp.value,5);
});
test('critical doubles the throw damage dice',async()=>{
  const f=fixture('acid');f.deps.attack=async()=>({hit:true,critical:true});
  await createItemAutomationEngine(f.deps).handle(f.item,f.request(),'player');assert.equal(f.calls[0].formula,'4d6[acid]');
});
test('trap is reusable, triggered by GM and creates a tether which can be released',async()=>{
  const {item,actor,engine,deps,request}=fixture('trap');
  await engine.handle(item,request({action:'prepare'}),'player');assert.ok(item.getFlag('quedaco-monstros','preparedTrap'));
  await assert.rejects(engine.handle(item,request({action:'trigger',victimUuid:'Scene.s.Token.hero'}),'player'),/Mestra/);
  await engine.handle(item,request({action:'trigger',victimUuid:'Scene.s.Token.hero'}),'gm');
  assert.equal(item.system.quantity,3);assert.equal(effectMeta(actor.effects[0]).kind,'trapped');
  deps.roll=async()=>({total:20});
  const effect=actor.effects[0];await engine.release({helper:actor,target:actor,effect,result:13});assert.equal(actor.effects.length,0);
});
test('rations require positive integer count and cannot overdraw inventory',async()=>{
  const {item,engine,request}=fixture('rations');
  for(const count of [-1,0,1.5,4])await assert.rejects(engine.handle(item,request({count}),'player'),/Quantidade/);
  await engine.handle(item,request({count:2}),'player');assert.equal(item.system.quantity,1);
});
test('failed effect creation refunds dose and detection changes',async()=>{
  const {item,actor,token,engine,request}=fixture('see-invisible');const old=structuredClone(token.detectionModes);
  actor.createEmbeddedDocuments=async()=>{throw Error('failed write');};
  await assert.rejects(engine.handle(item,request(),'player'),/failed write/);
  assert.equal(item.system.quantity,3);assert.deepEqual(token.detectionModes,old);
});
test('unknown user, foreign token and no stock cannot create effects',async()=>{
  const {item,actor,engine,request}=fixture('climb');
  await assert.rejects(engine.handle(item,request(),'stranger'),/possui/);
  await assert.rejects(engine.handle(item,request({tokenUuid:'foreign'}),'player'),/portador/);
  item.system.quantity=0;await assert.rejects(engine.handle(item,request(),'player'),/Quantidade/);
  assert.equal(actor.effects.length,0);
});
test('duplicate persisted receipt stays idempotent across engine restarts',async()=>{
  const {item,deps,request}=fixture('rations'),req=request();
  await createItemAutomationEngine(deps).handle(item,req,'player');
  await createItemAutomationEngine(deps).handle(item,req,'player');assert.equal(item.system.quantity,2);
});
test('V2 factory creates all templates, attaches native sigil, preserves originals and is idempotent',async()=>{
  const originals=[TORCH_TEMPLATE,...ITEM_AUTOMATIONS].filter(s=>!s.homebrew).map((spec,index)=>({_id:`o${index}`,name:(spec.source??[spec.name])[0],type:spec.type,system:{quantity:1,description:{value:'Original'}},flags:{},effects:[]}));
  originals.push({_id:'sigil',name:'Iluminador',type:'sigil',system:{charges:{value:3,max:3}},flags:{},effects:[]});
  const before=structuredClone(originals),items=[];
  const game={user:{isGM:true},folders:[],items,packs:[{documentName:'Item',collection:'skyfall-core.equipment',getIndex:async()=>originals,getDocument:async id=>({toObject:()=>structuredClone(originals.find(o=>o._id===id))})}]};
  const oldFolder=globalThis.Folder,oldItem=globalThis.Item;
  globalThis.Folder={create:async data=>{const folder={...data,id:'v2'};game.folders.push(folder);return folder;}};
  globalThis.Item={create:async data=>{const item=document({...data,id:`v${items.length}`,uuid:`Item.v${items.length}`});items.push(item);return item;}};
  try{
    const first=await createV2Items(game);assert.equal(first.missingSource.length,0);assert.equal(items.length,23);
    const shield=items.find(i=>automationFor(i)?.id==='shield');const sigil=items.find(i=>i.type==='sigil');
    assert.equal(shield.system.sigils[0].uuid,sigil.uuid);assert.equal(sigil.name,'Iluminador V2');
    assert.equal(items.every(i=>i.name.endsWith(' V2')),true);assert.deepEqual(originals,before);
    const second=await createV2Items(game);assert.equal(second.created.length,0);assert.equal(items.length,23);
  }finally{globalThis.Folder=oldFolder;globalThis.Item=oldItem;}
});
test('factory reports absent authorized compendium without inventing official items',async()=>{
  const oldFolder=globalThis.Folder,oldItem=globalThis.Item;
  const game={user:{isGM:true},folders:[{id:'v2',name:'QUEDAÇO — Itens V2',type:'Item'}],items:[],packs:[]};
  globalThis.Item={create:async data=>{const item=document(data);game.items.push(item);return item;}};
  try{const result=await createV2Items(game);assert.equal(result.created.length,1);assert.equal(automationFor(result.created[0]).id,'see-invisible');assert.equal(result.missingSource.length,21);}
  finally{globalThis.Folder=oldFolder;globalThis.Item=oldItem;}
});
