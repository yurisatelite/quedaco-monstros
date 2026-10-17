// Equipment stays native Skyfall data. QUEDAÇO supplies the inventory switch and runtime.
export const TORCH_SCOPE = 'quedaco-monstros';
export const TORCH_STATE = 'torchLight';
export const TORCH_REQUEST = 'torchRequest';
export const TORCH_PRESET = Object.freeze({bright:10,dim:0,angle:360,color:'#d4aa00',alpha:0.5,negative:false,
  animation:Object.freeze({type:'torch',speed:5,intensity:5,reverse:false})});
export function isTorch(item){
  return item?.type==='equipment' && (item.getFlag?.(TORCH_SCOPE,'torch')===true || /^tocha(?:\s+v\d+)?$/i.test(item.name?.trim()??''));
}
const flag=(doc,key)=>doc?.getFlag?.(TORCH_SCOPE,key);

/** A single elected GM serializes requests, expiry and cleanup across all scenes. */
export function createTorchService({game,resolve,clone=structuredClone}){
  let queue=Promise.resolve();
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  const leader=()=>game.users.filter(u=>u.active&&u.isGM).sort((a,b)=>a.id.localeCompare(b.id))[0]?.id===game.user.id;
  const tokens=()=>Array.from(game.scenes).flatMap(s=>Array.from(s.tokens));
  async function off(token){
    const state=flag(token,TORCH_STATE);
    if(state)await token.update({light:clone(state.previousLight),[`flags.${TORCH_SCOPE}.${TORCH_STATE}`]:null});
  }
  return {
    leader,
    handle(item,request,userId){return serial(async()=>{
      if(!leader()||!isTorch(item)||!request?.id||typeof request.on!=='boolean')return;
      const actor=item.actor??item.parent;
      const user=game.users.get(userId);
      if(!actor||!user||!actor.testUserPermission(user,'OWNER'))return;
      const token=await resolve(request.tokenUuid);
      if(token?.documentName!=='Token'||token.actor?.uuid!==actor.uuid)return;
      const saved=flag(token,TORCH_STATE);
      if(!request.on){if(saved?.itemUuid===item.uuid)await off(token);return;}
      // Idempotent across duplicate hooks and two clients clicking at once.
      if(saved?.itemUuid===item.uuid)return;
      if(saved)throw Error('Apague a outra tocha deste token primeiro.');
      if(token.getFlag(TORCH_SCOPE,'shieldLight')?.lit)throw Error('Apague o escudo Iluminador antes de acender a tocha.');
      if(tokens().some(t=>flag(t,TORCH_STATE)?.itemUuid===item.uuid))throw Error('Esta pilha já tem uma tocha acesa em outro token.');
      const quantity=Number(item.system.quantity);
      if(!(quantity>=1))throw Error('Não há tochas no estoque.');
      const previousLight=clone(token.toObject().light);
      await item.update({'system.quantity':quantity-1});
      try{
        await token.update({light:{...clone(previousLight),...clone(TORCH_PRESET)},
          [`flags.${TORCH_SCOPE}.${TORCH_STATE}`]:{itemUuid:item.uuid,previousLight,expires:game.time.worldTime+3600,requestId:request.id}});
      }catch(error){
        await item.update({'system.quantity':quantity});
        throw error;
      }
    });},
    expire(){return serial(async()=>{
      if(!leader())return;
      for(const token of tokens()){
        const state=flag(token,TORCH_STATE);
        if(state&&game.time.worldTime>=state.expires)await off(token);
      }
    });},
    remove(item){return serial(async()=>{
      if(!leader())return;
      for(const token of tokens())if(flag(token,TORCH_STATE)?.itemUuid===item.uuid)await off(token);
    });}
  };
}

export function registerTorches({game,hooks,canvas,resolve,clone,notifications}){
  if(game.system.id!=='skyfall')return;
  const service=createTorchService({game,resolve,clone});
  const error=e=>{console.error('QUEDAÇO | Tocha',e);notifications.error(e.message);};
  const refresh=()=>{
    for(const app of foundry.applications.instances.values()){
      if(app.document?.documentName==='Actor'&&app.rendered)app.render(false);
    }
  };
  const roots=new WeakMap();
  function render(app,element){
    const actor=app.document??app.actor;
    if(actor?.documentName!=='Actor'||!actor.isOwner)return;
    const root=element instanceof HTMLElement?element:element?.[0]??app.element;
    if(!root?.querySelectorAll)return;
    for(const row of root.querySelectorAll('[data-entry-id]')){
      const item=actor.items.get(row.dataset.entryId);
      if(!isTorch(item))continue;
      const controls=row.querySelector('.item-controls');
      if(!controls)continue;
      controls.querySelector('[data-quedaco-torch]')?.remove();
      const lit=Array.from(game.scenes).some(s=>Array.from(s.tokens).some(t=>flag(t,TORCH_STATE)?.itemUuid===item.uuid));
      const button=document.createElement('button');
      button.type='button';button.className='control icon';button.dataset.quedacoTorch=item.id;
      button.style.cssText='border:0;background:transparent;padding:0;min-height:0;line-height:inherit;color:inherit;flex:0 0 auto;';
      button.title=lit?'Apagar tocha':'Acender tocha (gasta 1 unidade; dura 1 hora de jogo)';
      button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(lit));
      button.innerHTML=`<i class="fa-solid fa-toggle-${lit?'on':'off'}"></i>`;
      controls.prepend(button);
    }
    if(roots.has(root))return;
    const pending=new Set();
    const handler=async event=>{
      const button=event.target.closest?.('[data-quedaco-torch]');
      if(!button||!root.contains(button))return;
      event.preventDefault();event.stopImmediatePropagation();
      const item=actor.items.get(button.dataset.quedacoTorch);
      if(!isTorch(item)||pending.has(item.id))return;
      if(!game.users.some(u=>u.active&&u.isGM))return notifications.warn('Uma Mestra precisa estar conectada para operar a tocha.');
      const candidates=canvas.tokens?.placeables.filter(t=>t.actor?.uuid===actor.uuid)??[];
      const token=candidates.find(t=>t.controlled)??(candidates.length===1?candidates[0]:null);
      if(!token)return notifications.warn('Selecione o token deste personagem na cena.');
      const state=flag(token.document,TORCH_STATE);
      const on=state?.itemUuid!==item.uuid;
      if(on&&state)return notifications.warn('Apague a outra tocha deste token primeiro.');
      if(on&&!(Number(item.system.quantity)>=1))return notifications.warn('Não há tochas no estoque.');
      pending.add(item.id);button.disabled=true;
      try{
        // Server-authenticated Item update carries the initiating userId to the GM.
        await item.setFlag(TORCH_SCOPE,TORCH_REQUEST,{id:foundry.utils.randomID(),tokenUuid:token.document.uuid,on});
      }catch(e){error(e);}finally{pending.delete(item.id);button.disabled=false;}
    };
    root.addEventListener('click',handler,true);roots.set(root,handler);
  }
  hooks.on('renderApplicationV2',render);
  hooks.on('updateItem',(item,changed,_options,userId)=>{
    const request=foundry.utils.getProperty(changed,`flags.${TORCH_SCOPE}.${TORCH_REQUEST}`)
      ??changed[`flags.${TORCH_SCOPE}.${TORCH_REQUEST}`];
    if(request&&service.leader())void service.handle(item,flag(item,TORCH_REQUEST),userId).catch(error);
  });
  hooks.on('updateToken',(_token,changed)=>{
    if(foundry.utils.getProperty(changed,`flags.${TORCH_SCOPE}`)||Object.keys(changed).some(k=>k.startsWith(`flags.${TORCH_SCOPE}.`)))refresh();
  });
  hooks.on('deleteItem',item=>{void service.remove(item).catch(error);});
  hooks.on('updateWorldTime',()=>{void service.expire().catch(error);});
  hooks.on('updateUser',()=>{void service.expire().catch(error);});
  void service.expire().catch(error);
  return service;
}

if(globalThis.Hooks)Hooks.once('ready',()=>registerTorches({game,hooks:Hooks,canvas,
  resolve:uuid=>fromUuid(uuid),clone:value=>foundry.utils.deepClone(value),notifications:ui.notifications}));
