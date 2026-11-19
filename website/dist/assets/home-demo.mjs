import {MixerGL} from './home-demo-gl.mjs';
import {createState,applyScene,frame,scenes,sceneAt,signal,toggleChannel} from './home-demo-scene.mjs';
import {translate} from './home-demo-i18n.mjs';

const root=document.querySelector('[data-home-demo]');
if(root) start(root);
export function start(root) {
  const canvas=root.querySelector('canvas'), layer=root.querySelector('.demo-hit-layer'), windowBox=root.querySelector('.demo-window');
  const pause=document.querySelector('#demo-pause'), language=document.querySelector('#demo-language'), size=document.querySelector('#demo-size');
  const status=root.querySelector('.demo-status'), dialog=root.querySelector('.demo-options');
  const title=document.querySelector('#demo-story-title'), copy=document.querySelector('#demo-story-copy');
  const selectors=[...document.querySelectorAll('[data-scene]')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const state=createState();
  let renderer,raf=0,last=0,time=0,visible=false,playing=!reduced.matches,manual=false,signature='',current=-1,destroyed=false,contextLost=false;
  function unavailable() {
    playing=false;root.dataset.available='false';
    status.textContent='此设备暂不能运行 WebGL2 演示。仍可阅读功能介绍并下载声核。';
    pause.disabled=true;size.disabled=true;language.disabled=true;
  }
  try {renderer=new MixerGL(canvas);}catch {unavailable();}
  function setStory(index) {
    current=index;title.textContent=scenes[index].title;copy.textContent=scenes[index].text;
    for(const el of selectors) {const selected=Number(el.dataset.scene)===index;el.setAttribute('aria-pressed',String(selected));}
  }
  function setPlaying(value) {
    playing=value;last=0;pause.textContent=playing?'暂停演示':'播放演示';pause.setAttribute('aria-pressed',String(!playing));schedule();
  }
  function interact() {manual=true;setPlaying(false);}
  function announce(message) {status.textContent=message;}
  function closeOptions() {dialog.hidden=true;dialog.replaceChildren();}
  function choose(hit,options,onchange) {
    closeOptions();const label=document.createElement('label');label.textContent=options.title;
    const select=document.createElement('select');
    for(const [value,name] of options.values) {const option=document.createElement('option');option.value=value;option.textContent=name;select.append(option);}
    select.value=options.value??'';label.append(select);dialog.append(label);
    const close=document.createElement('button');close.type='button';close.textContent='完成';close.addEventListener('click',()=>{closeOptions();layer.querySelector(`[data-key="${hit.kind}-${hit.index}"]`)?.focus();});dialog.append(close);
    select.addEventListener('change',()=>{onchange(select.value);draw();});dialog.hidden=false;select.focus();
  }
  function action(hit) {
    interact();const c=state.channels[hit.index];
    if(hit.kind==='project')state.phase='menu';
    if(hit.kind==='new')state.phase='empty';
    if(hit.kind==='preset') {Object.assign(state,createState(['monitor','singing','chat_singing'][hit.index]));state.phase='ready';announce('已建立演示预设，可以添加效果器、调推子和开关通道。');}
    if(hit.kind==='mute') {toggleChannel(state,hit.index);announce(`${translate(c.name,state.language)}：${c.mute?'已静音':'已接通'}${c.group?' · 编组 '+c.group:''}`);}
    if(hit.kind==='record') {c.record=!c.record;announce(`${translate(c.name,state.language)}：${c.record?'录音演示开始':'录音演示停止'}，不会生成真实音频文件。`);}
    if(hit.kind==='fx') {c.bypass=!c.bypass;announce(`${c.name}效果器${c.bypass?'旁通':'启用'}`);}
    if(hit.kind==='effect') {c.bypassed=c.bypassed.includes(hit.value)?c.bypassed.filter(v=>v!==hit.value):[...c.bypassed,hit.value];announce(`${translate(hit.value,state.language)}：${c.bypassed.includes(hit.value)?'旁通':'启用'}`);}
    if(hit.kind==='solo')state.solo=state.solo===hit.index?null:hit.index;
    if(hit.kind==='polarity') {c.phase=!c.phase;announce(`${c.name}极性${c.phase?'反转':'恢复'}`);}
    if(hit.kind==='settings') {language.focus();announce('用上方语言选择切换中文、English 或日本語。');}
    if(hit.kind==='link') choose(hit,{title:'通道编组',value:c.group||'',values:[['','不编组'],['A1','A1 · 联动组 1'],['A2','A2 · 与 A1 互斥'],['B1','B1 · 联动组 2']]},value=>{c.group=value||null;announce('同组联动，同字母不同组互斥。点击通道圆形开关试试。');});
    if(hit.kind==='add') choose(hit,{title:'添加效果器',values:[['','选择效果器'],...['静音降噪','去齿音','抬升压缩','组合混响','动态均衡','输出限制','Aud2A'].map(v=>[v,translate(v,state.language)])]},value=>{if(value&&!c.fx.includes(value)&&c.fx.length<6)c.fx.push(value);closeOptions();announce('已添加 '+translate(value,state.language));});
    if(hit.kind==='send'||hit.kind==='sendAdd') choose(hit,{title:'通道发送',value:hit.value||'',values:[['','不发送'],...state.channels.filter(peer=>peer.id>c.id).map(peer=>[peer.name,translate(peer.name,state.language)]),['输出 1/2',translate('输出 1/2',state.language)],['网页源',translate('网页源',state.language)]]},value=>{
      if(hit.value)c.sends=c.sends.filter(v=>v!==hit.value);
      if(value&&!c.sends.includes(value)&&c.sends.length<3)c.sends.push(value);
      closeOptions();announce('演示发送已更新。');
    });
    draw();
  }
  const labels={project:'工程菜单',new:'新建预设',preset:'选择预设',settings:'语言设置',mute:'通道接通',record:'录音',fx:'效果器旁通',solo:'独听',polarity:'极性反转',link:'设置编组',add:'添加效果器',effect:'效果器旁通',send:'设置发送',sendAdd:'添加发送',gain:'增益'};
  function updateHits(scene) {
    const key=[state.height,state.phase,state.language,...state.channels.map(c=>c.fx.join()+c.sends.join())].join('|');
    if(key!==signature) {
      signature=key;layer.replaceChildren();
      for(const hit of scene.hits) {
        if(hit.kind==='keyboard')continue;
        const name=(state.channels[hit.index]?translate(state.channels[hit.index].name,state.language)+' · ':'')+(labels[hit.kind]||hit.kind)+(hit.value?' · '+translate(hit.value,state.language):'');
        let control;
        if(['mute','record'].includes(hit.kind)) {
          control=document.createElement('label');control.title=name;
          const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',name);input.addEventListener('change',()=>action(hit));control.append(input);
        } else if(hit.kind==='gain') {
          control=document.createElement('input');control.type='range';control.min='-60';control.max='12';control.step='.1';control.setAttribute('aria-label',name);control.setAttribute('aria-orientation','vertical');
          control.addEventListener('input',()=>{interact();state.channels[hit.index].gain=Number(control.value);draw();});
          control.addEventListener('dblclick',()=>{interact();state.channels[hit.index].gain=0;draw();});
        } else {control=document.createElement('button');control.type='button';control.setAttribute('aria-label',name);control.title=name;control.addEventListener('click',()=>action(hit));}
        control.className='demo-hit';control.dataset.key=`${hit.kind}-${hit.index}`;
        control.style.left=hit.x/scene.width*100+'%';control.style.top=hit.y/scene.height*100+'%';control.style.width=hit.w/scene.width*100+'%';control.style.height=hit.h/scene.height*100+'%';
        layer.append(control);
      }
    }
    for(const c of state.channels) {
      const gain=layer.querySelector(`[data-key="gain-${c.id}"]`);
      if(gain) {gain.value=String(c.gain);gain.setAttribute('aria-valuetext',c.gain.toFixed(1)+' dB');}
      for(const kind of ['mute','record']) {
        const input=layer.querySelector(`[data-key="${kind}-${c.id}"] input`);if(input)input.checked=kind==='mute'?!c.mute:c.record;
      }
    }
  }
  function draw() {
    if(!renderer||contextLost||destroyed||document.hidden)return;
    const scene=frame(state,time/1000);windowBox.style.aspectRatio=`${scene.width} / ${state.height}`;
    renderer.render(scene);updateHits(scene);
    language.value=state.language;size.value=String(state.height);
    const wave=root.querySelector('.demo-wave path');
    if(wave)wave.setAttribute('d',Array.from({length:140},(_,i)=>{
      const sample=Math.sin(i*1.8+time/85)*signal(time/1000-i/90,2)*12;
      return `${i?'L':'M'}${i*3},${16+sample}`;
    }).join(''));
  }
  function tick(now) {
    raf=0;if(!canRun())return;
    if(last && now-last<1000/30) {schedule();return;}
    if(last)time+=Math.min(now-last,80);last=now;
    const at=sceneAt(time);
    if(!manual) {applyScene(state,at.index,at.elapsed);if(current!==at.index){closeOptions();setStory(at.index);}}
    draw();schedule();
  }
  function canRun() {return !destroyed&&!contextLost&&renderer&&playing&&visible&&!document.hidden;}
  function schedule() {if(canRun()&&!raf)raf=requestAnimationFrame(tick);else if(!canRun()){cancelAnimationFrame(raf);raf=0;last=0;}}
  pause.addEventListener('click',()=>{
    if(!playing&&manual) {manual=false;const at=sceneAt(time);applyScene(state,at.index,at.elapsed);closeOptions();}
    setPlaying(!playing);draw();
  });
  language.addEventListener('change',()=>{interact();state.language=language.value;draw();announce('界面语言：'+language.selectedOptions[0].textContent);});
  size.addEventListener('change',()=>{interact();state.height=Number(size.value);closeOptions();draw();});
  for(const el of selectors)el.addEventListener('click',()=>{
    const index=Number(el.dataset.scene);time=scenes.slice(0,index).reduce((n,s)=>n+s.duration,0);
    manual=false;setStory(index);applyScene(state,index,0);closeOptions();draw();last=0;
  });
  root.addEventListener('keydown',e=>{if(e.key==='Escape')closeOptions();});
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;if(visible)draw();schedule();},{threshold:.05});observer.observe(root);
  const visibility=()=>schedule();document.addEventListener('visibilitychange',visibility);
  reduced.addEventListener('change',()=>{if(reduced.matches){manual=true;setPlaying(false);draw();}});
  const resize=new ResizeObserver(()=>{if(visible)draw();});resize.observe(windowBox);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;schedule();announce('演示画面暂时中断，等待图形上下文恢复。');});
  canvas.addEventListener('webglcontextrestored',()=>{try{renderer.destroy();renderer=new MixerGL(canvas);contextLost=false;draw();schedule();announce('演示画面已恢复。');}catch{unavailable();}});
  const teardown=()=>{destroyed=true;cancelAnimationFrame(raf);observer.disconnect();resize.disconnect();document.removeEventListener('visibilitychange',visibility);renderer?.destroy();};
  // bfcache pages are suspended, not destroyed, so Back restores working controls.
  window.addEventListener('pagehide',event=>{if(!event.persisted)teardown();else{cancelAnimationFrame(raf);raf=0;last=0;}});
  window.addEventListener('pageshow',()=>{last=0;schedule();});
  setStory(0);if(!reduced.matches)applyScene(state,0,0);else {state.phase='ready';manual=true;}
  setPlaying(playing);draw();return {state,teardown};
}
