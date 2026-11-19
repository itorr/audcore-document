import {icons} from './home-skin-data.mjs';

export const vertexSource=`#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec4 box;
layout(location=2) in vec4 ink;
layout(location=3) in vec4 uvBox;
layout(location=4) in vec2 style;
uniform vec2 resolution;
out vec2 point;
out vec2 extent;
out vec4 color;
out vec2 uv;
out vec2 flags;
void main(){
  vec2 pos=box.xy+corner*box.zw;
  gl_Position=vec4(pos.x/resolution.x*2.-1.,1.-pos.y/resolution.y*2.,0.,1.);
  point=corner*box.zw;extent=box.zw;color=ink;
  uv=uvBox.xy+corner*uvBox.zw;flags=style;
}`;
export const fragmentSource=`#version 300 es
precision highp float;
uniform sampler2D atlas;
in vec2 point;
in vec2 extent;
in vec4 color;
in vec2 uv;
in vec2 flags;
out vec4 pixel;
void main(){
  float coverage;
  if(flags.y>.5) coverage=texture(atlas,uv).a;
  else {
    float r=min(flags.x,min(extent.x,extent.y)*.5);
    vec2 q=abs(point-extent*.5)-(extent*.5-r);
    float d=length(max(q,0.))+min(max(q.x,q.y),0.)-r;
    coverage=1.-smoothstep(-fwidth(d)*.5,fwidth(d)*.5,d);
  }
  float alpha=color.a*coverage;
  pixel=vec4(color.rgb*alpha,alpha);
}`;
export function rgba(hex,opacity=1) {
  const h=hex.replace('#','');
  const alpha=h.length===8?parseInt(h.slice(0,2),16)/255:1;
  const rgb=h.slice(-6);
  return [0,2,4].map(i=>parseInt(rgb.slice(i,i+2),16)/255).concat(alpha*opacity);
}
export class MixerGL {
  constructor(canvas) {
    const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true,depth:false,stencil:false,preserveDrawingBuffer:false});
    if(!gl) throw Error('WebGL2 unavailable');
    this.gl=gl;this.canvas=canvas;this.cache=new Map();this.cursor={x:2,y:2,row:0};this.dirtyTiles=[];
    // Canvas2D only rasterizes cached glyph/icon masks; the mixer is drawn by WebGL2.
    this.sheet=document.createElement('canvas');this.sheet.width=1024;this.sheet.height=1024;
    this.ctx=this.sheet.getContext('2d');
    if(!this.ctx) throw Error('Glyph atlas unavailable');
    const shaders=[];
    try {
      this.program=gl.createProgram();
      for(const [type,source] of [[gl.VERTEX_SHADER,vertexSource],[gl.FRAGMENT_SHADER,fragmentSource]]) {
        const shader=gl.createShader(type); shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
        gl.attachShader(this.program,shader);
      }
      gl.linkProgram(this.program);
      if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(this.program));
    } finally {for(const shader of shaders) gl.deleteShader(shader);}
    this.vao=gl.createVertexArray();gl.bindVertexArray(this.vao);
    this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,8,0);
    this.instances=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);
    for(const [location,size,offset] of [[1,4,0],[2,4,16],[3,4,32],[4,2,48]]) {
      gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,56,offset);gl.vertexAttribDivisor(location,1);
    }
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1024,1024,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    gl.useProgram(this.program);gl.uniform1i(gl.getUniformLocation(this.program,'atlas'),0);
    this.resolution=gl.getUniformLocation(this.program,'resolution');
    gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  }
  mask(command) {
    const key=command.kind==='icon'?'icon:'+command.name:`${command.size}:${command.value}`;
    if(this.cache.has(key)) return this.cache.get(key);
    const ctx=this.ctx, scale=2;
    ctx.font=`${command.size*scale}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    const width=command.kind==='icon'?48:Math.ceil(ctx.measureText(command.value).width)+4;
    const height=command.kind==='icon'?48:Math.ceil(command.size*scale*1.5);
    if(this.cursor.x+width+2>1024) {this.cursor.x=2;this.cursor.y+=this.cursor.row+4;this.cursor.row=0;}
    if(this.cursor.y+height+2>1024) throw Error('Glyph atlas full');
    const {x,y}=this.cursor;
    ctx.save();ctx.fillStyle='#ffffff';
    if(command.kind==='icon') {
      ctx.translate(x,y);ctx.scale(2,2);
      if(icons[command.name]?.d) ctx.fill(new Path2D(icons[command.name].d));
    } else {ctx.textBaseline='middle';ctx.fillText(command.value,x+2,y+height/2);}
    ctx.restore();
    this.cursor.x+=width+4;this.cursor.row=Math.max(this.cursor.row,height);
    const tile={u:x/1024,v:y/1024,uw:width/1024,vh:height/1024,width:width/scale,height:height/scale};
    this.cache.set(key,tile);this.dirtyTiles.push({x,y,width,height});return tile;
  }
  render(scene) {
    const gl=this.gl, data=[];
    // Bound arbitrary slider/text variants; rebuild only between complete frames.
    if(this.cursor.y>700) {
      this.ctx.clearRect(0,0,1024,1024);this.cache.clear();this.cursor={x:2,y:2,row:0};this.dirtyTiles=[];
      gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1024,1024,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    }
    const dpr=Math.min(window.devicePixelRatio||1,2);
    const width=Math.round(this.canvas.clientWidth*dpr),height=Math.round(this.canvas.clientHeight*dpr);
    if(width===0||height===0) return;
    if(this.canvas.width!==width||this.canvas.height!==height) {this.canvas.width=width;this.canvas.height=height;}
    for(const c of scene.commands) {
      let {x,y,w,h}=c, uv=[0,0,0,0];
      if(c.kind!=='rect') {
        const tile=this.mask(c);uv=[tile.u,tile.v,tile.uw,tile.vh];
        if(c.kind==='text') {
          const fit=Math.min(1,w/tile.width);const tw=tile.width*fit,th=tile.height*fit;
          if(c.align==='right')x+=w-tw;else if(c.align!=='left')x+=(w-tw)/2;
          y+=(h-th)/2;w=tw;h=th;
        }
      }
      data.push(x,y,w,h,...rgba(c.color,c.alpha??1),...uv,c.r||0,c.kind==='rect'?0:1);
    }
    gl.bindTexture(gl.TEXTURE_2D,this.texture);
    for(const tile of this.dirtyTiles) {
      const {x,y,width,height}=tile;
      // ImageData is Straight RGBA. Only its alpha mask is sampled; the fragment
      // shader emits Premultiplied RGBA exactly once for ONE/ONE_MINUS_SRC_ALPHA.
      gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,this.ctx.getImageData(x,y,width,height).data);
    }
    this.dirtyTiles=[];
    gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);gl.uniform2f(this.resolution,scene.width,scene.height);gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.instances);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES,0,6,data.length/14);
  }
  destroy() {
    const gl=this.gl;gl.deleteTexture(this.texture);gl.deleteBuffer(this.quad);gl.deleteBuffer(this.instances);gl.deleteVertexArray(this.vao);gl.deleteProgram(this.program);this.cache.clear();
  }
}
