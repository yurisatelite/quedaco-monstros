import test from 'node:test';
import assert from 'node:assert/strict';
import {registerIntegration} from '../src/integration.mjs';

test('contrato v1 registra e emite descriptor sem módulo principal nem documentos',()=>{
  const module={title:'QUEDAÇO - GERADOR',version:'0.2.0'},events=[];let opened=0;
  const game={modules:{get:id=>id==='quedaco-monstros'?module:undefined},system:{id:'skyfall'},user:{isGM:true}};
  const api=registerIntegration(game,{callAll:(...args)=>events.push(args)},()=>++opened);
  assert.equal(module.api,api);assert.equal(api.family,'quedaco');assert.equal(api.contractVersion,1);
  assert.equal(api.id,'quedaco-monstros');assert.equal(api.title,module.title);assert.equal(api.version,module.version);
  assert.deepEqual(api.capabilities,{monsterAudit:true,monsterConversion:true,batchRepair:true,itemEffects:true,torchLights:true});
  assert.ok(Object.values(api.capabilities).every(v=>typeof v==='boolean'));
  assert.equal(Object.isFrozen(api),true);assert.equal(Object.isFrozen(api.capabilities),true);
  assert.deepEqual(events,[['quedaco:register',api]]);
  assert.equal(api.open(),1);assert.equal(opened,1);
  assert.deepEqual(api.getStatus(),{ready:true,systemCompatible:true,canManage:true});
  game.user.isGM=false;
  assert.deepEqual(api.getStatus(),{ready:true,systemCompatible:true,canManage:false});
  assert.deepEqual(Object.keys(api),['family','contractVersion','id','title','version','capabilities','open','createItemsV2','getStatus']);
});
