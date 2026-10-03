import { AudcoreClient } from '/sdk/1.0.0/audcore.mjs';
const form=document.getElementById('demo-form'),status=document.getElementById('demo-status'),list=document.getElementById('demo-channels'),address=document.getElementById('demo-url'),connect=document.getElementById('demo-connect');
const channels=new Map(),rows=new Map();let client=null;
function connectionState(state){
  const busy=state==='connecting'||state==='authorization-pending';
  connect.disabled=busy;address.disabled=busy||state==='connected';
  connect.textContent=busy?'连接中…':state==='connected'?'断开连接':'连接声核';
}
function render(){
  const live=client?.state==='connected';
  for(const[id,row]of rows)if(!channels.has(id)){row.element.remove();rows.delete(id);}
  if(channels.size){list.querySelector('p')?.remove();}
  for(const channel of channels.values()){
    let row=rows.get(channel.id);
    if(!row){const element=document.createElement('div');element.className='demo-channel';const name=document.createElement('span');name.className='demo-channel-name';const label=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.className='setting-switch';const state=document.createElement('span');state.className='demo-channel-state';label.append(input,state);element.append(name,label);list.append(element);row={element,name,input,state};rows.set(channel.id,row);
      input.addEventListener('change',async()=>{const requested=input.checked;input.checked=!channels.get(channel.id).mute;input.disabled=true;try{const result=await client.updateChannel(channel.id,{mute:!requested});channels.set(result.id,result);render();}catch(error){status.textContent=error.message;}finally{input.disabled=client?.state!=='connected';}});
    }
    row.name.textContent=channel.name||`通道 ${channel.index+1}`;row.input.setAttribute('aria-label',`${row.name.textContent}启用`);row.input.checked=!channel.mute;row.input.disabled=!live;row.state.textContent=channel.mute?'静音':'启用';
  }
  if(!channels.size){let empty=list.querySelector('p');if(!empty){empty=document.createElement('p');empty.className='subtle';list.append(empty);}empty.textContent=live?'当前没有通道':'连接并允许后，通道会显示在这里。';}
}
form.addEventListener('submit',async e=>{
  e.preventDefault();if(connect.disabled)return;if(client?.state==='connected'){await client.disconnect();render();return;}connectionState('connecting');
  try{
    await client?.disconnect();
    client=new AudcoreClient({url:address.value.trim(),appName:'声核官网演示'});
    client.on('state',state=>{connectionState(state);status.textContent=({connecting:'正在连接声核…','authorization-pending':'请在声核客户端的全局确认中允许「声核官网演示」。',connected:'已连接，通道状态实时同步。',disconnected:'连接已断开。'})[state];render();});
    client.on('error',error=>{status.textContent=error.message;});
    client.on('revoked',()=>{status.textContent='授权已撤销。再次连接需要在声核中允许。';connectionState('disconnected');});
    client.on('rejected',()=>{status.textContent='声核拒绝了连接。';connectionState('disconnected');});
    await client.connect();
    await client.subscribe('/channels',{frequencyHz:10},(data,event)=>{
      if(event.event==='snapshot'){channels.clear();for(const channel of data)channels.set(channel.id,channel);}
      else if(/^\/channels\/[^/]+$/.test(event.resource)){const id=event.resource.split('/')[2];if(event.event==='removed')channels.delete(id);else channels.set(data.id,data);}
      render();
    });
  }catch(error){await client?.disconnect();connectionState('disconnected');status.textContent=error.message;}
});
window.addEventListener('pagehide',()=>{void client?.disconnect();});
