import {snapshot as data,selectRows,fitScale,percentage} from './snapshot.mjs';
const $=id=>document.getElementById(id),number=value=>value==null?'—':new Intl.NumberFormat('zh-CN',{maximumFractionDigits:1}).format(value);
const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;};
const states={device:{query:'',type:'',key:'users',direction:-1,page:0},plugin:{query:'',key:'users',direction:-1,page:0}},pageSize=10;
function fit(){document.documentElement.style.setProperty('--fit',fitScale(innerWidth,innerHeight));}fit();addEventListener('resize',fit);
let preference;try{preference=localStorage.getItem('audcore-stats-theme');}catch{}
if(!['light','dark'].includes(preference))preference=matchMedia('(prefers-color-scheme:light)').matches?'light':'dark';document.documentElement.dataset.theme=preference;
document.querySelectorAll('input[name=theme]').forEach(input=>{input.checked=input.value===preference;input.addEventListener('change',()=>{if(!input.checked)return;document.documentElement.dataset.theme=input.value;try{localStorage.setItem('audcore-stats-theme',input.value);}catch{}});});
for(const [label,code,value,unit,tone] of [['安装样本','INSTALLATIONS',data.installations,'30 天观测','accent'],['设备报告样本','DEVICE REPORTS',data.deviceReports,'最新设备报告'],['声卡 / 驱动','DEVICES',data.devices.length,'演示条目'],['完整效果器清单','INVENTORIES',data.pluginReports,'安装样本'],['效果器','EFFECTS',data.plugins.length,'演示条目'],['效果器厂商','VENDORS',new Set(data.plugins.map(x=>x.vendor).filter(v=>v!=='未标注')).size,'未标注单列']]){
 const item=el('article',null,'metric');if(tone)item.dataset.tone=tone;const title=el('div',label,'metric-label'),val=el('div',number(value),'metric-value');title.append(el('span',code,'metric-code'));val.append(el('small',unit));item.append(title,val);$('metrics').append(item);
}
function cell(row,value,cls){const td=el('td',value,cls);row.append(td);return td;}
function render(kind){
 const state=states[kind],source=kind==='device'?data.devices:data.plugins,rows=selectRows(source,state),pages=Math.max(1,Math.ceil(rows.length/pageSize));state.page=Math.min(state.page,pages-1);$(`${kind}-count`).textContent=`${rows.length} 项 / ${source.length} 项`;
 const body=$(`${kind}-table`).querySelector('tbody');body.replaceChildren();rows.slice(state.page*pageSize,(state.page+1)*pageSize).forEach((item,index)=>{
  const tr=el('tr');cell(tr,String(state.page*pageSize+index+1).padStart(2,'0'));const name=cell(tr),link=el('button',item.name,'name-button');link.type='button';link.title=item.name;link.addEventListener('click',()=>openDetail(kind,item));name.append(link);
  if(kind==='device'){cell(tr,number(item.users),'number');cell(tr,percentage(item.users,data.deviceReports));cell(tr,number(item.buffer));cell(tr,number(item.rate));}
  else{const vendor=cell(tr,item.vendor);vendor.title=item.vendor;cell(tr,number(item.users),'number');cell(tr,number(item.active),item.active==null?'missing':null);cell(tr,number(item.median),item.median==null?'missing':'perf');cell(tr,number(item.p95),item.p95==null?'missing':'perf');}body.append(tr);
 });
 $(`${kind}-empty`).hidden=rows.length!==0;$(`${kind}-page`).textContent=`${state.page+1} / ${pages}`;$(`${kind}-prev`).disabled=state.page===0;$(`${kind}-next`).disabled=state.page>=pages-1;
 document.querySelectorAll(`#${kind}-table th[data-key]`).forEach(th=>{const active=th.dataset.key===state.key,button=th.querySelector('button');button.textContent=button.textContent.replace(/ [↑↓]$/,'')+(active?(state.direction<0?' ↓':' ↑'):'');if(active)th.setAttribute('aria-sort',state.direction<0?'descending':'ascending');else th.removeAttribute('aria-sort');});
}
for(const kind of ['device','plugin']){
 $(`${kind}-search`).addEventListener('input',event=>{states[kind].query=event.target.value;states[kind].page=0;render(kind);});
 for(const [suffix,delta] of [['prev',-1],['next',1]])$(`${kind}-${suffix}`).addEventListener('click',()=>{states[kind].page+=delta;render(kind);});
 document.querySelectorAll(`#${kind}-table th[data-key] button`).forEach(button=>button.addEventListener('click',()=>{const key=button.parentElement.dataset.key,state=states[kind];state.direction=key===state.key?-state.direction:['name','vendor','buffer','rate','median','p95'].includes(key)?1:-1;state.key=key;state.page=0;render(kind);if(kind==='plugin')$('plugin-order').value=['users','active','median','name'].includes(key)?key:'';}));render(kind);
}
$('device-type').addEventListener('change',event=>{states.device.type=event.target.value;states.device.page=0;render('device');});
$('plugin-order').addEventListener('change',event=>{states.plugin.key=event.target.value;states.plugin.direction=['name','median'].includes(event.target.value)?1:-1;states.plugin.page=0;render('plugin');});
function columns(target,rows){target.replaceChildren();const max=Math.max(1,...rows.map(([,value])=>value));for(const [label,value] of rows){const column=el('div',null,'column');column.dataset.peak=String(value===max);column.title=`${label}：${number(value)} 个安装样本（演示）`;column.setAttribute('aria-label',column.title);const bar=el('div',null,'bar');bar.style.height=`${Math.max(2,value/max*75)}px`;column.append(el('span',number(value),'count'),bar,el('span',label,'label'));target.append(column);}}
function horizontal(target,rows,total){for(const [label,value] of rows){const row=el('div',null,'hrow'),track=el('div',null,'track'),fill=el('div',null,'fill');fill.style.width=percentage(value,total);track.append(fill);row.title=`${label}：${number(value)} 个安装样本（演示）`;row.append(el('span',label),track,el('span',percentage(value,total)));target.append(row);}}
columns($('buffer-chart'),data.buffers);horizontal($('rate-chart'),data.rates,data.deviceReports);horizontal($('version-chart'),data.versions,data.installations);
const ns='http://www.w3.org/2000/svg';function svgEl(tag,attrs){const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);return node;}
const graph=svgEl('svg',{viewBox:'0 0 330 105',role:'img','aria-label':'30 天启动安装样本趋势，演示数据；最低 158，最高 412'}),coords=data.daily.map((v,i)=>[i/(data.daily.length-1)*318+4,90-v/460*78]),path=coords.map(([x,y],i)=>`${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
graph.append(svgEl('path',{d:`${path} L322,94 L4,94 Z`,class:'trend-area'}),svgEl('path',{d:path,class:'trend-line'}));const last=coords.at(-1);graph.append(svgEl('circle',{cx:last[0],cy:last[1],r:3,class:'trend-point'}));const label=svgEl('text',{x:last[0],y:last[1]-9,'text-anchor':'end'});label.textContent=number(data.daily.at(-1));graph.append(label);$('trend-chart').append(graph);const axis=el('div',null,'trend-labels');axis.append(el('span','09.27'),el('span','10.11'),el('span','10.26'));$('trend-chart').append(axis);$('trend-range').textContent='158 — 412';
function detailItem(container,label,value,unit){const item=el('div',null,'detail-item'),strong=el('strong',value);if(unit)strong.append(el('small',unit));item.append(el('span',label),strong);container.append(item);}
function openDetail(kind,item){
 $('detail-title').textContent=item.name;const content=$('detail-content');content.replaceChildren();content.append(el('p',kind==='device'?`${item.vendor} · ${item.type} · 最新设备报告中的检出样本`:`${item.vendor} · 版本 ${item.version} · 48 kHz / 256 frames / 立体声`,'detail-subtitle'));const grid=el('div',null,'detail-grid');detailItem(grid,'安装样本',number(item.users),'个');
 if(kind==='device'){
  detailItem(grid,'检出占比',percentage(item.users,data.deviceReports));detailItem(grid,'设备报告分母',number(data.deviceReports),'个');detailItem(grid,'常用缓冲',number(item.buffer),'frames');detailItem(grid,'常用采样率',number(item.rate),'kHz');detailItem(grid,'理论单块时长',item.buffer&&item.rate?(item.buffer/item.rate).toFixed(2):'—','ms');
  content.append(grid,el('p','配置与覆盖范围','detail-section-title'),el('p','缓冲和采样率为界面演示配置。正式版需从该型号已匹配的实际运行样本分别聚合；不从检出清单推断已选设备，也不把理论单块时长当作端到端延迟。','detail-notes'),el('p','同一个安装可以检出多台设备，设备行之间不能相加得到人数。虚拟 ASIO 驱动不代表具体物理声卡，当前不声称已识别硬件型号。','detail-notes'));
 }else{
  detailItem(grid,'启用样本',number(item.active),'个');detailItem(grid,'性能样本',number(item.samples),'个');detailItem(grid,'处理中位',number(item.median),'μs');detailItem(grid,'处理 P95',number(item.p95),'μs');detailItem(grid,'单块预算占比',item.median==null?'—':percentage(item.median,256/48000*1e6));
  content.append(grid,el('p','性能比较条件','detail-section-title'),el('p','全部为构造的演示测量。正式版需补齐 CPU、插件版本、通道数、参数状态、过采样和处理模式等条件，不将跨机器耗时混合成性能排名。P95 为第 95 百分位，不是峰值。','detail-notes'),el('p','“启用”应来自实际处理样本；“安装”来自完整清单。没有启用或耗时来源时显示“—”，不能把安装量当作使用量，也不能用加载耗时代替音频处理耗时。','detail-notes'));
 }
 content.append(el('p','本页所有字段均为演示数据；正式接入范围见“统计口径”。','notice'));$('detail-dialog').showModal();
}
$('method').addEventListener('click',()=>$('method-dialog').showModal());document.querySelectorAll('dialog').forEach(dialog=>{dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});});
