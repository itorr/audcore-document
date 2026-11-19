import {palette as p} from './home-skin-data.mjs';
import {muteGroupChanges} from './home-mute-groups.mjs';
import {translate} from './home-demo-i18n.mjs';
import {presets,roleNames,effectNames} from './home-demo-presets.mjs';

// Port of the default console's shared geometry, not an alternate mixer skin.
export const STRIP = 74, STEP = 76, HEAD = 40, WIDTH = 422;
export const scenes = [
  {title:'从一个预设，开始好声音。', text:'选择「新建简单唱歌直播预设」，一次准备好人声、伴奏和监听通道。', label:'新建预设', duration:9000},
  {title:'小体积，超低占用。', text:'免费、轻巧。原生调音台搭配 ASIO 与 WASAPI，把更多算力留给声音。', label:'轻装上阵', duration:7000},
  {title:'大小随你，收放自如。', text:'自由调整界面尺寸；缩成迷你调音台，推子和通道开关依然随手可控。', label:'自由尺寸', duration:9000},
  {title:'直播常用，开箱就有。', text:'降噪、去齿音、压缩、均衡、混响和限制，自带常用效果器，也支持 VST3。', label:'自带效果器', duration:9000},
  {title:'每一路声音，自由发送。', text:'人声、伴奏、混响、监听与混音独立安排。调推子、选发送，让声音去该去的地方。', label:'灵活路由', duration:9000},
  {title:'一起开关，也能互斥。', text:'相同编组联动开关；同字母的不同组互斥切换。讲话、唱歌，一次切好。', label:'编组联动', duration:11000},
  {title:'好声音，随时录下来。', text:'按通道开关录音，独立保存需要的声音。直播、练歌，都能留下这一刻。', label:'通道录音', duration:9000},
  {title:'熟悉的界面，换种语言。', text:'中文、English、日本語。效果器与通道显示随语言切换，推子、编组和音量保持原位。', label:'多种语言', duration:9000},
];
export const cycle = scenes.reduce((n,s)=>n+s.duration,0);
export function sceneAt(time) {
  let elapsed = ((time % cycle) + cycle) % cycle;
  for (let index=0; index<scenes.length; index++) {
    if (elapsed<scenes[index].duration) return {index,elapsed,progress:elapsed/scenes[index].duration};
    elapsed-=scenes[index].duration;
  }
}
export function createState(template='singing') {
  const colors=['#38b9ec','#f3ad50','#33d69a','#a879e8','#24c5d9','#9baab9'];
  return {height:494,language:'zh',phase:'ready',channels:presets[template].channels.map((c,id)=>({
    id,name:roleNames[c.role],role:c.role,
    input:c.role==='microphone'?'输入 1':c.role==='music'?'截获播放器':'空输入',
    color:colors[id%colors.length],gain:c.gain_db||0,
    fx:(c.effects||[]).map(fx=>effectNames[fx.code]||fx.code),
    bypassed:(c.effects||[]).filter(fx=>fx.bypass).map(fx=>effectNames[fx.code]||fx.code),
    sends:[...(c.send_to||[]).map(role=>roleNames[role]),...(c.sidechain?[roleNames[c.sidechain.channel]+' · 侧链']:[]),...(['output','monitor'].includes(c.role)?['输出 1/2']:[])],
    mute:!!c.mute,record:false,group:c.mute_group||null,
  }))};
}
export function toggleChannel(state,index) {
  const chains=state.channels.map(c=>({...c,muteGroup:c.group}));
  for(const {chain,mute} of muteGroupChanges(chains,chains[index],!chains[index].mute)) state.channels[chain.id].mute=mute;
}
export function applyScene(state,index,elapsed) {
  const base=createState();
  state.phase=index===0?(elapsed<1800?'menu':elapsed<5000?'preset-menu':'ready'):'ready';
  state.previewingPreset=state.phase==='preset-menu';
  state.language=index===7?(elapsed<3000?'zh':elapsed<6000?'en':'ja'):'zh';
  index-=1;
  state.height=index===1 ? (elapsed<2800?574:elapsed<6400?220:414) :494;
  state.channels=base.channels;
  state.solo=null;
  if(index===2 && elapsed>2800) state.channels[1].fx.push('动态均衡');
  if(index===2 && elapsed>5600) state.channels[1].fx.push('Aud2A');
  if(index===3) {
    state.channels[2].gain=-18+12*(.5+.5*Math.sin(elapsed/1700));
    if(elapsed>3500) state.channels[0].sends=['输出','混响'];
  }
  if(index===4) {
    state.channels[1].group='A1'; state.channels[2].group='A1'; state.channels[0].group='A2';
    if(elapsed>3500 && elapsed<7000) {state.channels[0].mute=true;}
    else if(elapsed>=7000) {state.channels[1].mute=true;state.channels[2].mute=true;}
  }
  if(index===5 && elapsed>2000 && elapsed<7500) {state.channels[1].record=true;state.channels[4].record=true;}
  return state;
}
export function geometry(height,count=5) {
  const h=height-4, route=height<=360?0:Math.max(40,h-186);
  return Array.from({length:count},(_,id)=>({id,x:HEAD+2+id*STEP,y:2,h,route,controls:2+route,trackY:12+route,trackH:h-route-38,bottom:2+h}));
}
export function sideControls(b) {
  // Current default preferences hide FX and solo; short panels progressively
  // hide upper controls using the same order as the native layout.
  const names=['polarity','link','keyboard','record'];
  while(names.length) {
    const controls=names.map((name,i)=>({name,y:b.controls+44+i*30-(name==='record'&&i>0?6:0),h:name==='record'?26:22}));
    const last=controls.at(-1);
    if(last.y+last.h<=b.bottom-56) return controls;
    names.shift();
  }
  return [];
}
export function signal(time,index) {
  // Deterministic speech/music-like envelopes. Never read a microphone or device.
  const syllable=Math.max(0,Math.sin(time*4.9+index*1.7));
  const phrase=.35+.65*Math.max(0,Math.sin(time*.83+index));
  return .16+.65*syllable*phrase+.08*Math.sin(time*13+index)**2;
}
export function frame(state,time=0) {
  const width=Math.max(WIDTH,HEAD+2+state.channels.length*STEP);
  const commands=[], hits=[];
  const rect=(x,y,w,h,color,r=0,alpha=1)=>commands.push({kind:'rect',x,y,w,h,color,r,alpha});
  const text=(value,x,y,w,h,size=11,color=p.text_primary,align='center')=>commands.push({kind:'text',value:translate(String(value),state.language),x,y,w,h,size,color,align});
  const icon=(name,x,y,size,color=p.text_control)=>commands.push({kind:'icon',name,x,y,w:size,h:size,color});
  const hit=(kind,index,x,y,w,h,extra={})=>hits.push({kind,index,x,y,w,h,...extra});
  rect(0,0,width,state.height,p.surface_canvas,8);
  function paintLogo() {
    for(const [i,color] of ['#38b9ec','#f3ad50','#ff635b'].entries()) {
      rect(10+i*7.7,10,2,19,['#286781','#8a663b','#843e3c'][i],1);
      rect(8.3+i*7.7,[16,21,12][i],5.7,5.7,color,3);
    }
  }
  if(state.phase==='menu'||state.phase==='preset-menu') {
    // Native system workspace: menu_layout.rs, menu_paint.rs and project_menu.rs.
    const menuWidth=124, rowHeight=28.1875;
    const presetsOpen=state.phase==='preset-menu';
    const rows=[
      ['新建预设','Ctrl+N'],['打开文件','Ctrl+O'],['保存预设','Ctrl+S'],
      ['撤销','Ctrl+Z'],['重做','Ctrl+Y'],['系统设置'],['输入输出'],['显示'],
      ['皮肤'],['性能'],['API'],['录制'],['效果器'],['关于声核'],
    ];
    rect(0,0,width,state.height,p.surface_popup,8);
    paintLogo();
    text('返回控制台',40,0,menuWidth-48,40,12,p.text_primary,'left');
    hit('close-project',-1,0,0,menuWidth,40);
    for(const [i,[label,shortcut]] of rows.entries()) {
      const y=44+i*rowHeight+(i>=3?7:0)+(i>=5?7:0)+(i>=13?7:0);
      if(y+rowHeight>state.height-4)break;
      const active=i===0&&presetsOpen;
      if(active)rect(0,y,menuWidth,rowHeight,p.surface_field_inset);
      text(label,12,y,shortcut?52:100,rowHeight,12,active?p.text_primary:p.text_sidebar,'left');
      if(shortcut)text(shortcut,65,y,47,rowHeight,12,p.text_scrollbar,'right');
      if(i===0)hit('new',-1,0,y,menuWidth,rowHeight);
    }
    if(presetsOpen) {
      const labels=['新建空白预设','新建单通道监听预设','新建简单唱歌直播预设','新建聊天和唱歌直播预设'];
      for(const [i,label] of labels.entries()) {
        const y=44+i*rowHeight;
        if(i===2&&state.previewingPreset)rect(menuWidth+1,y,width-menuWidth-1,rowHeight,p.surface_button_hover);
        text(label,menuWidth+13,y,width-menuWidth-25,rowHeight,12,p.text_primary,'left');
        hit(i===0?'empty-project':'preset',i-1,menuWidth+1,y,width-menuWidth-1,rowHeight,{value:label});
      }
    }
    return {commands,hits,width,height:state.height};
  }
  paintLogo();
  if(state.height>241) {icon('plus',9,47,22,p.text_sidebar);icon('play',9,83,22,p.text_sidebar);}
  if(state.height>360) ['48k','128','ASIO'].forEach((v,i)=>text(v,0,120+i*16,40,16,9,p.text_format));
  icon('settings',9,state.height-65,22,p.text_sidebar);
  icon('hide',9,state.height-29,22,p.text_sidebar);
  hit('project',-1,0,0,40,40);
  if(state.phase==='empty') {
    const rowWidth=Math.min(160,width-HEAD-24);
    const x=HEAD+(width-HEAD-rowWidth)/2;
    const rowHeight=Math.max(24,Math.min(40,(state.height-32)/3));
    const top=Math.max(4,(state.height-16-3*rowHeight)/2);
    for(const [i,label] of ['单通道监听','唱歌直播','聊天和唱歌'].entries()) {
      const y=top+i*(rowHeight+8);
      rect(x,y,rowWidth,rowHeight,p.surface_button,6);
      text(label,x+8,y,rowWidth-16,rowHeight,12);
      hit('preset',i,x,y,rowWidth,rowHeight,{value:label});
    }
    return {commands,hits,width,height:state.height};
  }
  const boxes=geometry(state.height,state.channels.length);
  for(const b of boxes) {
    const c=state.channels[b.id], x=b.x, col=c.color;
    rect(x,2,STRIP,b.h,p.surface_controls,3);
    if(b.route) {
      rect(x,2,STRIP,b.route,p.surface_effects);
      text(c.input,x+2,2,70,20,11,p.text_secondary);
      const showSends=b.route>=21+c.fx.length*21+17+(c.sends.length+1)*17;
      const sendTop=showSends?b.controls-c.sends.length*17-17:b.controls;
      let y=23;
      for(const fx of c.fx.slice(0,Math.floor((sendTop-17-23)/21))) {const bypass=c.bypass||c.bypassed?.includes(fx);rect(x,y,74,20,p.surface_effect_item);rect(x+4,y+6,8,8,bypass?p.text_dim:col,4);text(fx,x+16,y,54,20,11,bypass?p.text_secondary:p.text_primary,'left');hit('effect',b.id,x,y,74,20,{value:fx});y+=21;}
      icon('plus',x+31,y+2,12,p.text_dim);hit('add',b.id,x,y,74,17);
      let sy=sendTop+17;
      if(showSends) {icon('plus',x+31,sendTop+2,12,p.text_dim);hit('sendAdd',b.id,x,sendTop,74,17);}
      for(const send of showSends?c.sends:[]) {rect(x,sy,74,16,p.surface_button);text(send,x+2,sy,70,16,11,p.text_secondary,'left');hit('send',b.id,x,sy,74,16,{value:send});sy+=17;}
    }
    const mono=c.role==='microphone';
    rect(x+(mono?10:8.5),b.trackY,mono?6:9,b.trackH,p.surface_track,3);
    const level=c.mute?0:Math.max(0,Math.min(1,signal(time,b.id)+c.gain/72));
    const meterWidth=mono?4:3;
    for(let side=0;side<(mono?1:2);side++) {
      const ht=Math.max(meterWidth,(b.trackH-2)*(level-side*.035));
      rect(x+(mono?11:9.5+side*4),b.trackY+b.trackH-1-ht,meterWidth,ht,col,meterWidth/2);
    }
    for(const db of [0,-12,-24,-36,-48]) text(Math.abs(db),x+19,b.trackY+3+(b.trackH-6)*(1-(db+60)/72)-4,14,8,8,p.text_scale,'right');
    text('∞',x+19,b.trackY+b.trackH-8,14,8,8,p.text_scale,'right');
    text(c.gain.toFixed(1),x+24,b.controls+6,44,18,16,p.text_primary,'right');
    text('dB',x+24,b.controls+24,44,12,10,p.text_unit,'right');
    const ky=b.trackY+b.trackH-3-(b.trackH-6)*(c.gain+60)/72-11;
    rect(x+4,ky,18,26,p.knob_shadow,6,.5);
    rect(x+6,ky,14,22,p.surface_knob_rim,5);
    rect(x+7,ky+1,12,20,p.surface_knob,4);
    rect(x+10,ky+9.5,6,3,col,1.5);
    hit('gain',b.id,x,b.trackY-8,28,b.trackH+16,{trackY:b.trackY,trackH:b.trackH});
    for(const control of sideControls(b)) {
      const {name,y,h}=control;
      if(name==='fx') text('FX',x+38,y,36,h,12,c.fx.length?col:p.text_dim);
      else if(name==='link' && c.group) text(c.group,x+38,y,36,h,14,col);
      else if(name==='record'&&c.record || name==='polarity'&&c.phase || name==='solo'&&state.solo===b.id) {icon(name,x+45,y+(h-22)/2,22,col);}
      else icon(name,x+45,y+(h-22)/2,22);
      hit(name,b.id,x+38,y,36,h);
    }
    rect(x+42,b.bottom-56,28,28,col,14);
    rect(x+45,b.bottom-53,22,22,p.surface_ring,11);
    if(!c.mute) rect(x+50,b.bottom-48,12,12,col,6);
    hit('mute',b.id,x+38,b.bottom-64,36,44);
    // Match the native channel color band, including the rounded bottom corners.
    rect(x,b.bottom-8,STRIP,8,col,3);
    rect(x,b.bottom-8,STRIP,4,p.surface_controls);
    text(c.name,x+3,b.bottom-20,68,12,11,p.text_bright);
    if(c.mute || state.solo!=null && state.solo!==b.id) rect(x,2,STRIP,b.h,p.surface_canvas,3,.75);
  }
  return {commands,hits,width,height:state.height};
}
