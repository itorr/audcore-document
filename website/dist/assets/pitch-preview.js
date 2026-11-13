const canvas = document.querySelector('canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const readout = document.querySelector('#pitch-readout .digits');
const svgNamespace = 'http://www.w3.org/2000/svg';
const digitRight = [26,17,26,27,27,27,27,26,27,26];
const pitchGlyphs = Array.from({length:25}, (_,index)=>{
  const value=index-12;
  const digits=String(Math.abs(value));
  const group=document.createElementNS(svgNamespace,'g');
  const rightSlot=80;
  const left=rightSlot-(digits.length-1)*34;
  function use(glyph,x) {
    const node=document.createElementNS(svgNamespace,'use');
    node.setAttribute('href','#pitch-'+glyph);
    node.setAttribute('x',x);
    group.append(node);
  }
  if (value) use(value>0?'plus':'minus',left-25);
  for (const [i,digit] of [...digits].entries()) use(digit,left+i*34+27-digitRight[Number(digit)]);
  group.style.display='none';
  readout.append(group);
  return group;
});
let visibleGlyph;
const resolution = document.querySelector('#resolution');
const fullWidth=540, fullHeight=300;

function updateResolution() {
  const divisor=Number(resolution.value);
  canvas.width=fullWidth/divisor;
  canvas.height=fullHeight/divisor;
  draw();
}
let pitch=0, shift=0, pointer=null, frame=0, lastTime, phase=0, renderer;

const fragment = `
precision highp float;
varying vec2 uv;
uniform vec2 state;

float soft(float x,float width) { float d=x/width; return exp(-d*d); }

float noiseSeed(float n) { return fract(sin(n*127.1+31.7)*43758.5453); }

float movingLight(vec2 uv,float t,float seed) {
  float speed=.13+noiseSeed(seed+9.0)*.11;
  float clock=uv.x+t*speed+seed*.37;
  float cell=floor(clock);
  float local=fract(clock);
  float key=cell+seed*19.0;
  float middle=.24+.51*noiseSeed(key+2.0);
  float center=.34+.34*noiseSeed(key+3.0);
  float width=.07+.15*noiseSeed(key+4.0);
  float height=.08+.16*noiseSeed(key+5.0);
  float skew=(noiseSeed(key+6.0)-.5)*.64;
  float window=smoothstep(0.0,.15,local)*(1.0-smoothstep(.85,1.0,local));
  return window*soft(local-middle+skew*(uv.y-center),width)
    *soft(uv.y-center,height)*(.42+.58*noiseSeed(key+7.0));
}

float filament(float v,float x,float phase,float t,float outflow,float pitch,
               float offset,float width,float seed,float length) {
  float wobble=.09*sin(phase*(.61+seed*.12)+seed*5.7)
              +.055*sin(x*(11.0+seed*3.0)+t*.41+seed*9.0);
  float center=(offset+wobble)*(1.0-outflow*pitch*.16);
  float packet=fract(x*(.72+seed*.32)+t*(.17+seed*.09)+seed*.37)-.5;
  float visibility=soft(packet,length)*(1.0-smoothstep(.32,.5,abs(packet)));
  return soft(v-center,width)*visibility*visibility;
}

vec4 field(vec2 uv,float t,float pitch) {
  float x=uv.x,y=uv.y;
  float anchor=.5+pitch*.38;
  float wall=anchor+.013*sin(y*13.0+t*.95)+.006*cos(y*23.0-t*.61);
  float dx=x-wall;
  float transition=.039+abs(pitch)*.015;
  float outflow=1.0-smoothstep(-transition,transition,dx);
  float travel=max(0.0,-dx);
  float fan=smoothstep(0.0,anchor*.85,travel);
  float center=.54+.064*sin((x-.5)*7.5)-outflow*pitch*.11*fan;
  center+=.032*sin((x-.5)*12.0+t*1.6)*smoothstep(.02,.36,abs(x-.5));
  float v=(y-center)/(.18-outflow*pitch*.082*fan);
  float wave=soft(v,1.27);

  // Integrate the change in wave spacing across the soft boundary.
  float u=clamp((dx+transition)/(2.0*transition),0.0,1.0);
  float bend=min(dx+transition,0.0)+2.0*transition*u*(1.0-u*u+u*u*u*.5);
  float path=(x-.5)*10.8+7.0*(bend-transition)*(pow(2.0,pitch)-1.0);
  float phase=path+t*4.2;
  float packet=movingLight(uv,t,1.0)+.72*movingLight(uv,t,3.0);
  float edge=movingLight(uv,t,7.0);

  float airDrift=.5+.5*sin(t*.43+y*1.6+x*1.8);
  float bodyDrift=.5+.5*sin(t*.58+v*2.9+x*3.0);
  vec3 inputAir=mix(vec3(.76,.69,.88),vec3(.67,.84,.95),airDrift);
  vec3 inputBody=mix(vec3(.34,.23,.59),vec3(.27,.50,.73),bodyDrift);
  vec3 inputLight=mix(vec3(.87,.70,1.0),vec3(.59,.86,1.0),airDrift);
  float tuning=outflow*smoothstep(0.0,1.0,abs(pitch));
  float up=step(0.0,pitch);
  vec3 tunedAir=mix(
    mix(vec3(.39,.61,.89),vec3(.46,.83,.95),airDrift),
    mix(vec3(.91,.58,.55),vec3(1.0,.79,.54),airDrift),up);
  vec3 tunedBody=mix(
    mix(vec3(.13,.15,.59),vec3(.08,.50,.75),bodyDrift),
    mix(vec3(.63,.22,.32),vec3(.86,.43,.24),bodyDrift),up);
  vec3 tunedCore=mix(vec3(.14,.24,.61),vec3(.62,.26,.33),up);
  vec3 tunedLight=mix(vec3(.31,.90,1.0),vec3(1.0,.78,.46),up);
  vec3 hue=mix(inputLight,tunedLight,tuning);
  vec3 glass=mix(inputAir,tunedAir,tuning);
  float ribbon=soft(v+.10*sin(phase*.72),.96);
  float core=soft(v-.19*sin(phase*.64),.57);
  glass=mix(glass,mix(inputBody,tunedBody,tuning),ribbon*.87);
  glass=mix(glass,mix(vec3(.30,.29,.57),tunedCore,tuning),core*.28);

  float sheet=v+.22*sin(phase*.87+v*2.1)+.09*sin(phase*1.7-v*3.0);
  float film=.5+.5*cos(sheet*9.0+phase*.85);
  vec3 spectrum=.57+.43*cos(vec3(.4,2.35,4.15)+sheet*5.1+phase*.57);
  float crease=pow(film,12.0)*wave;
  float grazing=soft(abs(sheet)-.84,.095)*wave;
  glass+=spectrum*(crease*.25+grazing*.26);
  glass+=vec3(.66,.90,1.0)*grazing*(.14+packet*.28);
  glass+=hue*soft(v*1.1+.23*sin(phase*.7)-.92,.22)*.13;

  float veil=soft(dx,transition*1.45);
  vec3 iridescence=.60+.39*cos(vec3(.35,2.0,3.9)+y*15.0+t*1.6);
  glass=mix(glass,iridescence,veil*(.11+.12*wave));
  glass+=iridescence*soft(dx,transition)*(.05+.08*wave);
  float filaments=.75*filament(v,x,phase,t,outflow,pitch,-.66,.047,.17,.24)
                 +.44*filament(v,x,phase,t,outflow,pitch,-.27,.068,.71,.15)
                 +.91*filament(v,x,phase,t,outflow,pitch,.09,.032,.42,.20)
                 +.59*filament(v,x,phase,t,outflow,pitch,.72,.054,.93,.17);
  float light=wave*(.10+.43*packet);
  glass+=hue*(light*.38+wave*filaments*(.17+.31*packet));
  glass+=mix(hue,vec3(1.0,1.0,1.0),.53)*edge*wave*filaments*.23;
  return vec4(clamp(glass,0.0,1.0),1.0);
}
void main() { gl_FragColor=field(uv,state.x,state.y); }
`;

function createRenderer() {
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false});
  if (!gl) throw new Error('WebGL unavailable');
  const program=gl.createProgram();
  function attach(type,source) {
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program,shader);
    gl.deleteShader(shader);
  }
  attach(gl.VERTEX_SHADER,`attribute vec2 pos; varying vec2 uv;
    void main(){ uv=vec2(pos.x*.5+.5,.5-pos.y*.5); gl_Position=vec4(pos,0.0,1.0); }`);
  attach(gl.FRAGMENT_SHADER,fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'pos');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const stateUniform=gl.getUniformLocation(program,'state');
  let renderWidth=0, renderHeight=0;
  canvas.style.opacity='1';
  return (time,amount)=>{
    if (renderWidth!==gl.drawingBufferWidth || renderHeight!==gl.drawingBufferHeight) {
      renderWidth=gl.drawingBufferWidth;
      renderHeight=gl.drawingBufferHeight;
      gl.viewport(0,0,renderWidth,renderHeight);
    }
    gl.uniform2f(stateUniform,time,amount);
    gl.drawArrays(gl.TRIANGLES,0,3);
  };
}

function startRenderer() {
  try { renderer=createRenderer(); }
  catch (error) {
    console.error(error);
    canvas.style.opacity='0';
    audioStatus.textContent='WebGL 不可用，无法显示能量场';
  }
}
canvas.addEventListener('webglcontextlost',event=>{
  event.preventDefault();
  renderer=undefined;
  canvas.style.opacity='0';
});
canvas.addEventListener('webglcontextrestored',startRenderer);

const player = new Audio();
player.loop = true;
const demoButton = document.querySelector('#demo');
const chooseButton = document.querySelector('#choose');
const playButton = document.querySelector('#play');
const fileInput = document.querySelector('#file');
const audioStatus = document.querySelector('#audio-status');
let sourceUrl, sourceName;

function makeDemo() {
  const rate=24000, length=rate*4;
  const pcm=new Float32Array(length);
  let seed=8371;
  const notes=[
    [.03,.22,.60,54,'kick'],[.22,.44,.34,110,'tone'],[.54,.15,.38,170,'snare'],
    [.83,.78,.34,165,'tone'],[1.04,.23,.68,56,'kick'],[1.56,.14,.40,160,'snare'],
    [2.02,.22,.64,55,'kick'],[2.26,.57,.34,131,'tone'],[2.55,.15,.40,174,'snare'],
    [3.01,.25,.68,51,'kick'],[3.11,.67,.36,196,'tone'],[3.54,.12,.39,172,'snare']
  ];
  for (const [start,duration,gain,hz,kind] of notes) {
    const first=Math.round(start*rate);
    for(let i=0;i<duration*rate;i++) {
      const t=i/rate, tail=1-t/duration, phase=2*Math.PI*hz*t;
      let sample;
      if (kind==='kick') sample=Math.sin(phase+5*(1-Math.exp(-t*52)))*tail**2.8;
      else if (kind==='snare') {
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        sample=((seed/0xffffffff-.5)*1.7+.23*Math.sin(phase))*tail**2.7;
      } else sample=(Math.sin(phase)+.36*Math.sin(phase*1.5)+.23*Math.sin(2*phase))*tail*.57;
      pcm[first+i]+=sample*gain*Math.min(1,t/(kind==='tone'?.065:.004));
    }
  }
  const bytes=new ArrayBuffer(44+length*2), view=new DataView(bytes);
  const tag=(at,value)=>[...value].forEach((ch,i)=>view.setUint8(at+i,ch.charCodeAt(0)));
  const word=(at,value)=>view.setUint16(at,value,true);
  const size=(at,value)=>view.setUint32(at,value,true);
  tag(0,'RIFF'); size(4,36+length*2); tag(8,'WAVE'); tag(12,'fmt ');
  size(16,16); word(20,1); word(22,1); size(24,rate); size(28,rate*2);
  word(32,2); word(34,16); tag(36,'data'); size(40,length*2);
  for(let i=0;i<length;i++) view.setInt16(44+i*2,Math.round(Math.max(-1,Math.min(1,pcm[i]))*32767),true);
  return new Blob([bytes],{type:'audio/wav'});
}

async function playAudio(blob,name) {
  try {
    if (blob) {
      player.pause();
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      sourceUrl=URL.createObjectURL(blob);
      sourceName=name;
      player.src=sourceUrl;
      playButton.disabled=false;
    }
    audioStatus.textContent=sourceName;
    await player.play();
  } catch {
    audioStatus.textContent='无法播放，请重试或选择 MP3、WAV 文件';
  }
}

demoButton.addEventListener('click',()=>playAudio(makeDemo(),'示例音频'));
chooseButton.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',()=>{
  const file=fileInput.files[0];
  fileInput.value='';
  if (file) playAudio(file,file.name);
});
playButton.addEventListener('click',()=>{
  if (player.paused) playAudio();
  else player.pause();
});
function syncPlayButton() {
  playButton.textContent=player.paused?'播放':'暂停';
  playButton.setAttribute('aria-pressed',String(!player.paused));
}
player.addEventListener('play',syncPlayButton);
player.addEventListener('pause',syncPlayButton);
player.addEventListener('error',()=>{ audioStatus.textContent='无法读取音频，可尝试 MP3 或 WAV 文件'; });

function draw() {
  renderer?.(phase,shift);
}
function setPitch(value) {
  pitch=Math.max(-12,Math.min(12,value));
  const glyph=pitchGlyphs[pitch+12];
  if (visibleGlyph!==glyph) {
    if (visibleGlyph) visibleGlyph.style.display='none';
    glyph.style.display='';
    visibleGlyph=glyph;
  }
  canvas.setAttribute('aria-valuenow',pitch);
  canvas.setAttribute('aria-valuetext',pitch+' 半音');
  if (reduced.matches) shift=pitch/12;
  draw();
}
function fromPointer(event) {
  const rect=canvas.getBoundingClientRect();
  const position=(event.clientX-rect.left)/rect.width;
  setPitch(Math.round((position-.5)/.38*12));
}
canvas.addEventListener('pointerdown',event => {
  if (pointer!==null || event.button!==0) return;
  pointer=event.pointerId;
  canvas.setPointerCapture(pointer);
  fromPointer(event);
});
canvas.addEventListener('pointermove',event => {
  if (event.pointerId===pointer && (event.buttons&1)) fromPointer(event);
});
canvas.addEventListener('lostpointercapture',event => {
  if (event.pointerId===pointer) pointer=null;
});
let wheelRemainder=0;
canvas.addEventListener('wheel',event=>{
  if (!event.deltaY) return;
  event.preventDefault();
  const delta=event.deltaMode===0 ? -event.deltaY/100 : -Math.sign(event.deltaY);
  wheelRemainder+=delta;
  const steps=Math.trunc(wheelRemainder);
  wheelRemainder-=steps;
  if (steps) setPitch(pitch+steps);
},{passive:false});
canvas.addEventListener('dblclick',()=>setPitch(0));
canvas.addEventListener('keydown',event => {
  const values={ArrowLeft:pitch-1,ArrowDown:pitch-1,ArrowRight:pitch+1,ArrowUp:pitch+1,Home:-12,End:12,'0':0};
  if (!Object.hasOwn(values,event.key)) return;
  event.preventDefault();
  setPitch(values[event.key]);
});
function animate(time) {
  const elapsed = lastTime === undefined ? 0 : Math.min(50,time-lastTime);
  lastTime=time;
  shift+=(pitch/12-shift)*(1-Math.exp(-elapsed/85));
  if (!reduced.matches) phase+=elapsed*.001;
  draw();
  frame=requestAnimationFrame(animate);
}
function motion() {
  cancelAnimationFrame(frame);
  lastTime=undefined;
  if (reduced.matches) shift=pitch/12;
  draw();
  if (!reduced.matches) frame=requestAnimationFrame(animate);
}
resolution.addEventListener('change',updateResolution);
updateResolution();
startRenderer();
reduced.addEventListener('change',motion);
setPitch(0);
motion();
