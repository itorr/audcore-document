// Port of 歌映 crates/utae-shader/effects/Siri@1.hlsl (2026-10-29).
// Preserve its four breathing clouds, default HSL palette and edge feather.
// CPU/Canvas2D pixels are Straight RGBA; WebGL emits Premultiplied RGBA.
import {LEVEL,PLAYING} from './buffer.mjs';
export const SIZE=128;
const palette=[[.9,.1,.6],[.4,.1,.9],[0,.4,.9],[0,.8,.7]];
const widths=[.20,.25,.22,.15];
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const field=`
precision highp float;
uniform float time;
uniform float loudness;
uniform float beat;
float feather(float width,float distance){return 1.0-smoothstep(0.0,width,distance);}
vec4 siri(vec2 uv){
  vec2 p=(uv-0.5)*2.0;
  float t=time*0.8;
  float audio=loudness+beat*0.3;
  float r=length(p),a=atan(p.y,p.x);
  float pink=0.25+0.10*audio+sin(a+t*1.3)*cos(a*2.0-t*0.7)*0.15*(1.0+audio);
  float purple=0.35+0.15*audio+cos(a*2.0-t*1.1)*sin(a+t*1.5)*0.12*(1.0+audio);
  float blue=0.42+0.20*audio+sin(a*3.0+t*0.9)*cos(a-t*1.2)*0.18*(1.0+audio);
  float cyan=0.50+0.25*audio+cos(a*1.5-t*1.6)*sin(a*2.5+t*0.8)*0.10*(1.0+audio);
  vec3 rgb=vec3(.9,.1,.6)*feather(.20,abs(r-pink))
    +vec3(.4,.1,.9)*feather(.25,abs(r-purple))
    +vec3(0.,.4,.9)*feather(.22,abs(r-blue))
    +vec3(0.,.8,.7)*feather(.15,abs(r-cyan));
  rgb*=feather(1.5+audio,r)*(1.1+audio);
  rgb+=vec3(.4,.1,.9)*audio*.04*feather(1.,r);
  rgb+=beat*.1*vec3(.5,.4,1.);
  vec3 e=exp(-2.0*rgb);rgb=(1.0-e)/(1.0+e);
  float alpha=max(rgb.r,max(rgb.g,rgb.b))*(1.0-smoothstep(.3,1.0,r));
  return vec4(rgb*alpha,alpha);
}`;
export function shaderSources(webgl2){return {
  vertex:webgl2?'#version 300 es\nin vec2 position;void main(){gl_Position=vec4(position,0.,1.);}':'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}',
  fragment:(webgl2?'#version 300 es\n':'')+field+(webgl2?'\nout vec4 pixel;void main(){pixel=siri(gl_FragCoord.xy/128.0);}':'\nvoid main(){gl_FragColor=siri(gl_FragCoord.xy/128.0);}')
};}
// Straight pixel reference also serves the software fallback. out is reused.
export function sampleSiri(x,y,time,loudness,beat,out){
  const t=time*.8,audio=loudness+beat*.3,r=Math.hypot(x,y),angle=Math.atan2(y,x);
  let red=0,green=0,blue=0;
  for(let i=0;i<4;i++){
    let radius;
    if(i===0)radius=.25+.10*audio+Math.sin(angle+t*1.3)*Math.cos(angle*2-t*.7)*.15*(1+audio);
    if(i===1)radius=.35+.15*audio+Math.cos(angle*2-t*1.1)*Math.sin(angle+t*1.5)*.12*(1+audio);
    if(i===2)radius=.42+.20*audio+Math.sin(angle*3+t*.9)*Math.cos(angle-t*1.2)*.18*(1+audio);
    if(i===3)radius=.50+.25*audio+Math.cos(angle*1.5-t*1.6)*Math.sin(angle*2.5+t*.8)*.10*(1+audio);
    const weight=1-smooth(0,widths[i],Math.abs(r-radius));
    red+=palette[i][0]*weight;green+=palette[i][1]*weight;blue+=palette[i][2]*weight;
  }
  const mask=(1-smooth(0,1.5+audio,r))*(1.1+audio),spill=audio*.04*(1-smooth(0,1,r));
  red=Math.tanh(red*mask+.4*spill+beat*.05);
  green=Math.tanh(green*mask+.1*spill+beat*.04);
  blue=Math.tanh(blue*mask+.9*spill+beat*.1);
  out[0]=red;out[1]=green;out[2]=blue;out[3]=Math.max(red,green,blue)*(1-smooth(.3,1,r));return out;
}
export function renderSiriPixels(data,time,level,beat,scratch){
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    sampleSiri((x+.5)/SIZE*2-1,1-(y+.5)/SIZE*2,time,level,beat,scratch);
    const at=(y*SIZE+x)*4;for(let ch=0;ch<4;ch++)data[at+ch]=Math.round(scratch[ch]*255);
  }
}
export function levelTarget(rms){return Math.max(0,Math.min(1,(20*Math.log10(Math.max(1e-6,rms))+54)/48));}
function gpuRenderer(gl,webgl2){
  const sources=shaderSources(webgl2),program=gl.createProgram(),shaders=[];
  let buffer;
  try{
    for(const [type,text] of [[gl.VERTEX_SHADER,sources.vertex],[gl.FRAGMENT_SHADER,sources.fragment]]){
      const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,text);gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('shader');gl.attachShader(program,shader);
    }
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('link');
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const time=gl.getUniformLocation(program,'time'),loudness=gl.getUniformLocation(program,'loudness'),beat=gl.getUniformLocation(program,'beat');
    gl.disable(gl.BLEND);gl.viewport(0,0,SIZE,SIZE);gl.clearColor(0,0,0,0);
    return {fps:30,draw(t,l,b){gl.uniform1f(time,t);gl.uniform1f(loudness,l);gl.uniform1f(beat,b);gl.drawArrays(gl.TRIANGLES,0,3);},destroy(){gl.deleteBuffer(buffer);gl.deleteProgram(program);}};
  }catch(error){if(buffer)gl.deleteBuffer(buffer);gl.deleteProgram(program);throw error;}
  finally{for(const shader of shaders)gl.deleteShader(shader);}
}
export function createVisualizer(original,host=globalThis){
  let canvas=original,renderer,control,active=false,frame=0,last=0,level=0,beat=0,closed=false;
  const doc=host.document,options={alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'low-power'};
  canvas.width=canvas.height=SIZE;
  function software(){
    canvas.removeEventListener('webglcontextlost',lost);const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;
    canvas.width=canvas.height=SIZE;canvas.dataset.renderer='canvas2d';
    const ctx=canvas.getContext('2d',{alpha:true});
    if(!ctx)return {fps:1,draw(){},destroy(){}};
    const image=ctx.createImageData(SIZE,SIZE),scratch=new Float32Array(4);
    return {fps:15,draw(t,l,b){renderSiriPixels(image.data,t,l,b,scratch);ctx.putImageData(image,0,0);},destroy(){}};
  }
  function lost(event){event.preventDefault();renderer?.destroy();renderer=software();}
  try{
    let gl=canvas.getContext('webgl2',options),webgl2=!!gl;
    if(!gl)gl=canvas.getContext('webgl',options);
    if(!gl)throw Error('gpu unavailable');renderer=gpuRenderer(gl,webgl2);canvas.dataset.renderer=webgl2?'webgl2':'webgl';
    canvas.addEventListener('webglcontextlost',lost);
  }catch{renderer=software();}
  function draw(now){
    if(closed||doc.hidden)return;
    frame=host.requestAnimationFrame(draw);
    if(last&&now-last<1000/renderer.fps-1)return;
    const dt=last?Math.min(.1,(now-last)/1000):1/renderer.fps;last=now;
    const rms=active&&control&&Atomics.load(control,PLAYING)?Atomics.load(control,LEVEL)/1e6:0;
    const target=levelTarget(rms),previous=level;
    level+=(target-level)*(1-Math.exp(-dt/(target > level ? .04 : .22)));
    beat=Math.max(beat*Math.exp(-dt/.16),Math.min(1,Math.max(0,level-previous)*3));
    renderer.draw(now/1000,level,beat);
  }
  function visibility(){host.cancelAnimationFrame(frame);last=0;if(!doc.hidden&&!closed)frame=host.requestAnimationFrame(draw);}
  doc.addEventListener('visibilitychange',visibility);visibility();
  return {setMeter(value){control=value;},setActive(value){active=value;},destroy(){closed=true;host.cancelAnimationFrame(frame);doc.removeEventListener('visibilitychange',visibility);canvas.removeEventListener('webglcontextlost',lost);renderer.destroy();}};
}
