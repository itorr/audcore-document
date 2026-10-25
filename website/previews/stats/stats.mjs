import {selectRows,fitScale,percentage} from './snapshot.mjs';

const $=id=>document.getElementById(id);
const number=value=>value==null?'':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(value);
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const states={device:{query:'',type:'',key:'users',direction:-1,page:0},plugin:{query:'',key:'users',direction:-1,page:0}};
const pageSize=15;
function fit(){document.documentElement.style.setProperty('--fit',fitScale(innerWidth,innerHeight));}
fit();addEventListener('resize',fit);
let preference;try{preference=localStorage.getItem('audcore-stats-theme');}catch{}
if(!['light','dark'].includes(preference))preference=matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';
document.documentElement.dataset.theme=preference;
document.querySelectorAll('input[name=theme]').forEach(input=>{
 input.checked=input.value===preference;
 input.addEventListener('change',()=>{if(!input.checked)return;document.documentElement.dataset.theme=input.value;try{localStorage.setItem('audcore-stats-theme',input.value);}catch{}});
});

async function load(){
 try{
  const response=await fetch('./snapshot.json',{cache:'no-store'});
  if(!response.ok)throw new Error('snapshot unavailable');
  const data=await response.json();
  if(data.schema!==2||data.demo!==false||!Array.isArray(data.devices)||!Array.isArray(data.plugins))throw new Error('unsupported snapshot');
  start(data);
 }catch(error){$('load-error').hidden=false;}
}

function start(data){
 let condition=data.conditions[0]||'';
 $('period').textContent=data.period.join(' — ');
 $('generated').textContent='更新 '+new Date(data.generatedAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
 $('generated').dateTime=data.generatedAt;
 for(const [label,value,title] of [
  ['安装样本',data.installations,'归档与当前记录中去重的匿名安装数，不等于真实人数'],
  ['设备报告',data.deviceReports,'各安装最新设备报告'],
  ['声卡 / 驱动',data.devices.length,'ASIO 名称按原值聚合；WASAPI 不披露自定义端点名称'],
  ['运行配置',data.runtimeReports,'有实际运行配置记录的安装数'],
  ['效果器',data.plugins.length,'按效果器标识跨文件版本去重'],
  ['完整清单',data.pluginReports,'提供完整效果器清单的安装数'],
 ]){const item=el('article',null,'metric');item.title=title;item.append(el('div',label,'metric-label'),el('div',number(value),'metric-value'));$('metrics').append(item);}

 const conditionSelect=$('perf-condition');
 for(const value of data.conditions){const option=el('option',value);option.value=value;conditionSelect.append(option);}
 if(!data.conditions.length){conditionSelect.append(el('option','无处理样本'));conditionSelect.disabled=true;}
 conditionSelect.value=condition;
 function pluginRows(){return data.plugins.map(row=>({...row,...(row.performance[condition]||{mean:null,peak:null,sampled:null})}));}
 function cell(row,value,cls){const td=el('td',value,cls);row.append(td);return td;}
 function render(kind){
  const state=states[kind],source=kind==='device'?data.devices:pluginRows(),rows=selectRows(source,state),pages=Math.max(1,Math.ceil(rows.length/pageSize));
  state.page=Math.min(state.page,pages-1);$(`${kind}-count`).textContent=`${rows.length.toLocaleString('zh-CN')} 项`;
  const body=$(`${kind}-table`).querySelector('tbody');body.replaceChildren();
  rows.slice(state.page*pageSize,(state.page+1)*pageSize).forEach((item,index)=>{
   const tr=el('tr');cell(tr,String(state.page*pageSize+index+1).padStart(2,'0'));
   const name=cell(tr),link=el('button',item.name,'name-button');link.type='button';link.title=item.name;link.addEventListener('click',()=>openDetail(kind,item));name.append(link);
   if(kind==='device'){
    cell(tr,number(item.users),'number');cell(tr,number(item.runningUsers));cell(tr,number(item.buffer));cell(tr,number(item.rate));
   }else{
    const vendor=cell(tr,item.vendor);vendor.title=item.vendor;
    cell(tr,number(item.users),'number');cell(tr,number(item.sampled));cell(tr,number(item.mean),'perf');cell(tr,number(item.peak),'perf');
   }
   body.append(tr);
  });
  $(`${kind}-empty`).hidden=rows.length!==0;$(`${kind}-page`).textContent=`${state.page+1} / ${pages}`;
  $(`${kind}-prev`).disabled=state.page===0;$(`${kind}-next`).disabled=state.page>=pages-1;
  document.querySelectorAll(`#${kind}-table th[data-key]`).forEach(th=>{
   const active=th.dataset.key===state.key,button=th.querySelector('button');button.textContent=button.textContent.replace(/ [↑↓]$/,'')+(active?(state.direction<0?' ↓':' ↑'):'');
   if(active)th.setAttribute('aria-sort',state.direction<0?'descending':'ascending');else th.removeAttribute('aria-sort');
  });
 }
 for(const kind of ['device','plugin']){
  $(`${kind}-search`).addEventListener('input',event=>{states[kind].query=event.target.value;states[kind].page=0;render(kind);});
  for(const [suffix,delta] of [['prev',-1],['next',1]])$(`${kind}-${suffix}`).addEventListener('click',()=>{states[kind].page+=delta;render(kind);});
  document.querySelectorAll(`#${kind}-table th[data-key] button`).forEach(button=>button.addEventListener('click',()=>{
   const key=button.parentElement.dataset.key,state=states[kind];state.direction=key===state.key?-state.direction:['name','vendor','buffer','rate','mean','peak'].includes(key)?1:-1;state.key=key;state.page=0;render(kind);
   if(kind==='plugin')$('plugin-order').value=['users','sampled','mean','name'].includes(key)?key:'';
  }));render(kind);
 }
 $('device-type').addEventListener('change',event=>{states.device.type=event.target.value;states.device.page=0;render('device');});
 $('plugin-order').addEventListener('change',event=>{states.plugin.key=event.target.value;states.plugin.direction=['name','mean'].includes(event.target.value)?1:-1;states.plugin.page=0;render('plugin');});
 conditionSelect.addEventListener('change',event=>{condition=event.target.value;states.plugin.page=0;render('plugin');});

 function limited(rows,limit=6){if(rows.length<=limit)return rows;return [...rows.slice(0,limit-1),['其他',rows.slice(limit-1).reduce((n,[,v])=>n+v,0)]];}
 function horizontal(target,rows,total,percent=true){
  target.replaceChildren();const max=Math.max(1,...rows.map(([,v])=>v));
  for(const [label,value] of rows){const row=el('div',null,'hrow'),track=el('div',null,'track'),fill=el('div',null,'fill');fill.style.width=percentage(value,percent?total:max);track.append(fill);row.title=`${label}：${number(value)}`;const title=el('span',label);title.title=label;row.append(title,track,el('span',percent?percentage(value,total):number(value)));target.append(row);}
 }
 const bufferRows=limited([...data.buffers].sort((a,b)=>b[1]-a[1]),9),maxBuffer=Math.max(1,...bufferRows.map(([,v])=>v));
 for(const [label,value] of bufferRows){const column=el('div',null,'column');column.dataset.peak=String(value===maxBuffer);column.title=`${label} frames：${number(value)} 个安装`;const bar=el('div',null,'bar');bar.style.height=`${Math.max(1,value/maxBuffer*135)}px`;column.append(el('span',number(value),'count'),bar,el('span',label,'label'));$('buffer-chart').append(column);}
 $('buffer-chart').title=`各安装最新运行配置，${data.runtimeReports} 个样本`;
 horizontal($('rate-chart'),limited(data.rates),data.runtimeReports);
 const vendors=new Map();for(const row of data.plugins)if(row.users&&row.vendor)vendors.set(row.vendor,(vendors.get(row.vendor)||0)+1);
 function distribution(){const isVersion=$('distribution').value!=='vendors';const rows=isVersion?data.versions:[...vendors].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));$('distribution-unit').textContent=isVersion?'安装占比':'效果器种数';horizontal($('version-chart'),limited(rows),data.installations,isVersion);}
 distribution();$('distribution').addEventListener('change',distribution);

 const ns='http://www.w3.org/2000/svg';
 function svgEl(tag,attrs){const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);return node;}
 const maxDaily=Math.max(1,...data.daily),graph=svgEl('svg',{viewBox:'0 0 330 150',role:'img','aria-label':`每日启动安装样本，${data.dailyDates[0]} 至 ${data.dailyDates.at(-1)}`}),coords=data.daily.map((v,i)=>[i/Math.max(1,data.daily.length-1)*318+4,128-v/maxDaily*100]),path=coords.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
 graph.append(svgEl('path',{d:`${path} L322,132 L4,132 Z`,class:'trend-area'}),svgEl('path',{d:path,class:'trend-line'}));
 coords.forEach(([x,y],i)=>{const dot=svgEl('circle',{cx:x,cy:y,r:3,class:'trend-point',opacity:i===coords.length-1?1:0});const title=svgEl('title',{});title.textContent=`${data.dailyDates[i]}：${data.daily[i]}`;dot.append(title);graph.append(dot);});
 const last=coords.at(-1);if(last){const label=svgEl('text',{x:last[0],y:last[1]-9,'text-anchor':'end'});label.textContent=number(data.daily.at(-1));graph.append(label);}
 $('trend-chart').append(graph);const axis=el('div',null,'trend-labels');axis.append(el('span',data.dailyDates[0]?.slice(5)),el('span',data.dailyDates[Math.floor(data.dailyDates.length/2)]?.slice(5)),el('span',data.dailyDates.at(-1)?.slice(5)));$('trend-chart').append(axis);$('trend-range').textContent='近 30 天';

 function detailItem(container,label,value,unit){const item=el('div',null,'detail-item'),strong=el('strong',value);if(unit&&value!=='')strong.append(el('small',unit));item.append(el('span',label),strong);container.append(item);}
 function openDetail(kind,item){
  $('detail-title').textContent=item.name;const content=$('detail-content');content.replaceChildren();const grid=el('div',null,'detail-grid');
  if(kind==='device'){
   content.append(el('p',item.type,'detail-subtitle'));detailItem(grid,'检出安装',number(item.users));detailItem(grid,'检出占比',percentage(item.users,data.deviceReports));detailItem(grid,'运行安装',number(item.runningUsers));detailItem(grid,'常见缓冲',number(item.buffer),'fr');detailItem(grid,'常见采样率',number(item.rate),'kHz');detailItem(grid,'设备报告分母',number(data.deviceReports));content.append(grid);
   const distributions=el('div',null,'detail-distributions');for(const [title,rows]of [['缓冲 frames',item.buffers],['采样率 kHz',item.rates]]){const section=el('section'),chart=el('div',null,'horizontal');section.append(el('h3',title),chart);horizontal(chart,rows,item.runningUsers,false);distributions.append(section);}content.append(distributions);
  }else{
   content.append(el('p',[item.vendor,condition].filter(Boolean).join(' · '),'detail-subtitle'));detailItem(grid,'安装样本',number(item.users));detailItem(grid,'处理样本',number(item.sampled));detailItem(grid,'清单分母',number(data.pluginReports));detailItem(grid,'诊断均耗',number(item.mean),'μs');detailItem(grid,'采样峰值',number(item.peak),'μs');detailItem(grid,'P95','');content.append(grid);
   content.append(el('p','诊断样本仅供参考；CPU、版本、声道与参数未统一。均耗按各安装最新采样汇总，非中位数。','detail-notes'));
   if(item.versions.length)content.append(el('p','清单文件版本：'+item.versions.join(' / '),'detail-versions'));
  }
  $('detail-dialog').showModal();
 }
 const dialog=$('detail-dialog');dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
}

await load();
