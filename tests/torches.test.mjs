import test from 'node:test';
import assert from 'node:assert/strict';
import {createTorchService,isTorch,TORCH_PRESET} from '../src/torches.mjs';

function fixture(){
  const gm={id:'gm',active:true,isGM:true},player={id:'player',active:true,isGM:false};
  const users=[gm,player];users.get=id=>users.find(u=>u.id===id);
  const actor={uuid:'Actor.hero',testUserPermission:user=>['gm','player'].includes(user.id)};
  const item={uuid:'Actor.hero.Item.torch',type:'equipment',name:'TOCHA V2',actor,system:{quantity:2},
    async update(data){this.system.quantity=data['system.quantity'];}};
  const light={bright:2,dim:4,color:'#ffffff',animation:{type:null}};
  const token={documentName:'Token',actor,uuid:'Scene.s.Token.t',light:structuredClone(light),state:null,
    getFlag(){return this.state;},toObject(){return {light:this.light};},
    async update(data){this.light=data.light;this.state=data['flags.quedaco-monstros.torchLight'];}};
  const game={user:gm,users,scenes:[{tokens:[token]}],time:{worldTime:100}};
  const service=createTorchService({game,resolve:async uuid=>uuid===token.uuid?token:null});
  const request={id:'request',on:true,tokenUuid:token.uuid};
  return {game,item,token,service,request,light};
}
test('equipment torches and V2 clones recognized, unrelated equipment excluded',()=>{
  assert.equal(isTorch({type:'equipment',name:'TOCHA V2'}),true);
  assert.equal(isTorch({type:'weapon',name:'Tocha'}),false);
  assert.equal(isTorch({type:'equipment',name:'Lanterna'}),false);
});
test('concurrent enable requests charge exactly once; extinction restores full light',async()=>{
  const {item,token,service,request,light}=fixture();
  await Promise.all([service.handle(item,request,'player'),service.handle(item,{...request,id:'again'},'player')]);
  assert.equal(item.system.quantity,1);
  assert.equal(token.light.bright,TORCH_PRESET.bright);
  assert.equal(token.state.expires,3700);
  await service.handle(item,{...request,on:false},'player');
  assert.deepEqual(token.light,light);assert.equal(token.state,null);assert.equal(item.system.quantity,1);
});
test('expired stored state is cleaned up on startup / world-time advance',async()=>{
  const {game,item,token,service,request,light}=fixture();
  await service.handle(item,request,'gm');game.time.worldTime=3700;
  await service.expire();assert.deepEqual(token.light,light);assert.equal(token.state,null);
});
test('empty stack, unowned actor and wrong token cannot enable light',async()=>{
  const {item,token,service,request}=fixture();
  item.system.quantity=0;
  await assert.rejects(service.handle(item,request,'player'),/estoque/);
  item.system.quantity=2;
  await service.handle(item,request,'unknown');
  await service.handle(item,{...request,tokenUuid:'wrong'},'player');
  assert.equal(item.system.quantity,2);assert.equal(token.state,null);
});
test('failed token write refunds quantity; deleting lit item restores light',async()=>{
  const {item,token,service,request,light}=fixture();
  const update=token.update;token.update=async()=>{throw Error('write failed');};
  await assert.rejects(service.handle(item,request,'gm'),/write failed/);
  assert.equal(item.system.quantity,2);
  token.update=update;await service.handle(item,request,'gm');
  await service.remove(item);assert.deepEqual(token.light,light);
});
test('only the elected GM processes requests',async()=>{
  const {game,item,token,service,request}=fixture();
  game.users.unshift({id:'aa',active:true,isGM:true});
  await service.handle(item,request,'player');assert.equal(item.system.quantity,2);assert.equal(token.state,null);
});
