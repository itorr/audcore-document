// Synthetic design fixture, kept outside website/dist to prevent accidental publication.
export const snapshot={schema:1,demo:true,edition:1,generatedAt:'2026-10-26T12:00:00+08:00',period:['2026-09-27','2026-10-26'],installations:1248,deviceReports:936,pluginReports:812,
devices:[
['ASIO Fireface USB','RME','ASIO',186,128,48],['Focusrite USB ASIO','Focusrite','ASIO',142,256,48],['Yamaha Steinberg USB ASIO','Yamaha / Steinberg','ASIO',118,256,48],['ASIO Babyface Pro','RME','ASIO',96,128,48],['MOTU Pro Audio','MOTU','ASIO',84,128,48],['Audient USB Audio ASIO','Audient','ASIO',75,256,48],['Midiplus USB Audio ASIO','Midiplus','ASIO',63,256,44.1],['PreSonus ASIO','PreSonus','ASIO',58,256,48],['Realtek Audio','Realtek','WASAPI',52,480,48],['ZOOM UAC-2 ASIO','ZOOM','ASIO',45,128,48],['BEHRINGER USB AUDIO','Behringer','ASIO',39,512,44.1],['TASCAM US-HR ASIO','TASCAM','ASIO',32,256,48],['ASIO4ALL v2','虚拟驱动','ASIO',28,512,48],['FlexASIO','虚拟驱动','ASIO',24,512,48],['VB-Audio Virtual Cable','虚拟设备','WASAPI',21,1024,48],['USB Audio Device','未标注','WASAPI',17,null,null],['ASIO Link Pro','虚拟驱动','ASIO',15,256,48],['High Definition Audio','未标注','WASAPI',12,480,48]
].map(([name,vendor,type,users,buffer,rate],id)=>({id,name,vendor,type,users,buffer,rate})),
plugins:[
['Pro-Q 4','FabFilter','4.01',482,318,37.2,61.5,156],['Fresh Air','Slate Digital','1.0',418,267,19.6,31.8,132],['ValhallaVintageVerb','Valhalla DSP','4.0',367,221,84.1,132.8,108],['Pro-C 2','FabFilter','2.20',342,196,42.5,68.3,96],['声核 · 动态均衡','Audcore','内置',328,284,16.8,27.4,142],['RX Voice De-noise','iZotope','11.0',294,187,214.6,341.2,83],['Pro-DS','FabFilter','1.25',271,163,23.4,39.6,89],['ValhallaRoom','Valhalla DSP','2.0',246,142,72.1,115.7,76],['声核 · 降噪','Audcore','内置',235,198,96.8,148.3,112],['Renaissance Vox','Waves','14.0',218,152,12.6,19.8,74],['Pro-L 2','FabFilter','2.23',207,118,48.3,79.2,62],['MAutoPitch','MeldaProduction','17.0',189,106,63.7,104.5,58],['SSL Native Channel Strip 2','SSL','2.4',174,91,41.5,66.8,48],['ValhallaDelay','Valhalla DSP','3.0',156,82,58.2,92.6,42],['TDR Nova','Tokyo Dawn Labs','2.2',143,87,52.4,86.1,39],['声核 · 采样延迟','Audcore','内置',118,64,2.6,4.8,36],['ReaComp','Cockos','2.0',96,52,8.7,14.2,29],['Other Effect','未标注','unknown',24,null,null,null,0]
].map(([name,vendor,version,users,active,median,p95,samples],id)=>({id,name,vendor,version,users,active,median,p95,samples})),
buffers:[['32',12],['64',68],['128',231],['256',378],['512',167],['1024+',52],['缺失',28]],rates:[['48',674],['44.1',187],['96',47],['其他',13],['缺失',15]],versions:[['v0.0.1658',786],['v0.0.1653',214],['更早版本',207],['缺失',41]],daily:[158,171,165,194,203,182,217,224,208,238,247,229,269,251,274,283,264,292,306,287,319,334,311,347,359,338,371,356,389,412]};
export function selectRows(rows,{query='',type='',key='users',direction=-1}={}){
 const term=query.trim().toLocaleLowerCase();
 return rows.filter(row=>(!type||row.type===type)&&(!term||`${row.name} ${row.vendor} ${row.type||''} ${row.version||''}`.toLocaleLowerCase().includes(term))).sort((a,b)=>{
  if(a[key]==null&&b[key]!=null)return 1;if(b[key]==null&&a[key]!=null)return -1;
  const order=typeof a[key]==='string'?a[key].localeCompare(b[key],'zh-CN'):(a[key]??0)-(b[key]??0);return order*direction||a.id-b.id;
 });
}
export function fitScale(width,height){return Math.max(.01,Math.min(width/1600,height/900));}
export function percentage(count,total){return total>0?(count/total*100).toFixed(1)+'%':'—';}
