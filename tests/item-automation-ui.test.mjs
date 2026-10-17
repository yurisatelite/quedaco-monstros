import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';

test('V2 inventory buttons render once, consume a ration and coexist with native controls',{skip:process.platform!=='win32'},async()=>{
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  try{
    const page=await browser.newPage();
    await page.route('https://quedaco.test/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      if(path==='/')return route.fulfill({contentType:'text/html',body:'<main id="sheet"><div class="window-content"><li data-entry-id="ration"><div class="item-controls"><a data-action="edit">Editar</a></div></li></div></main>'});
      const file=new URL(`../${path.slice(1)}`,import.meta.url);
      await route.fulfill({contentType:'text/javascript',body:await readFile(file,'utf8')});
    });
    await page.goto('https://quedaco.test/');
    await page.evaluate(async()=>{
      const callbacks={};window.Hooks={once(){},on(name,fn){(callbacks[name]??=[]).push(fn);}};
      const values={};
      window.ui={notifications:{error:message=>{throw Error(message);},warn:()=>{},info:()=>{}}};
      window.foundry={utils:{deepClone:structuredClone,getProperty:(data,path)=>path.split('.').reduce((o,k)=>o?.[k],data),randomID:()=>`request-${Date.now()}`},applications:{api:{DialogV2:{wait:async()=>({action:'use',count:'2'})}}}};
      const user={id:'gm',isGM:true,active:true,targets:new Set()};const users=[user];users.get=id=>users.find(u=>u.id===id);
      const actor={documentName:'Actor',uuid:'Actor.hero',name:'Hero',isOwner:true,effects:[],system:{resources:{hp:{value:20,max:20}},movement:{walk:9}},testUserPermission:()=>true};
      const item={id:'ration',uuid:'Actor.hero.Item.ration',type:'consumable',name:'Rações (1 dia) V2',actor,parent:actor,system:{quantity:3},getFlag:(_scope,key)=>key==='itemAutomation'?'rations':values[key],setFlag:async(_scope,key,value)=>{values[key]=value;},update:async data=>{item.system.quantity=data['system.quantity'];}};
      actor.items=[item];actor.items.get=id=>id==='ration'?item:null;
      const scene={id:'s',grid:{size:100,distance:1.5,units:'m'},tokens:[]};
      const token={documentName:'Token',uuid:'Scene.s.Token.hero',actor,parent:scene,x:0,y:0,width:1,height:1,getFlag:()=>null};scene.tokens.push(token);
      window.game={system:{id:'skyfall'},user,users,actors:[actor],scenes:[scene],settings:{get:()=>12}};
      window.canvas={tokens:{placeables:[{actor,document:token,controlled:true}]}};
      window.fromUuid=async uuid=>uuid===token.uuid?token:null;window.fromUuidSync=()=>actor;
      window.ChatMessage={getSpeaker:()=>({actor:'hero'}),create:async()=>{}};
      const module=await import('/src/item-automation.mjs');module.registerItemAutomations();
      const root=document.querySelector('#sheet');const app={document:actor};
      for(let n=0;n<2;n++)for(const callback of callbacks.renderApplicationV2)callback(app,root);
      window.testQuantity=()=>item.system.quantity;
    });
    assert.equal(await page.getByRole('button',{name:'Consumir',exact:true}).count(),1);
    assert.equal(await page.locator('[data-action="edit"]').count(),1);
    await page.getByRole('button',{name:'Consumir',exact:true}).click();
    await page.waitForFunction(()=>window.testQuantity()===1);
    assert.equal(await page.evaluate(()=>window.testQuantity()),1);
  }finally{await browser.close();}
});
