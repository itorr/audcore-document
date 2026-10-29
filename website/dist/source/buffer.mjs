// Single producer (network Worker), single consumer (AudioWorklet).
// Neither side waits; only the consumer advances READ. RESET is acknowledged
// by the consumer before the producer may reuse any unread storage.
export const READ=0, WRITE=1, RATE=2, RESET=3, PLAYING=4, LEVEL=5;
export const CAPACITY=1<<19, HEADER=32;
export function createBuffer(){return new SharedArrayBuffer(HEADER+CAPACITY*8);}
export class PcmWriter {
  constructor(shared){this.control=new Int32Array(shared,0,HEADER/4);this.samples=new Float32Array(shared,HEADER);this.capacity=this.samples.length/2;this.next=null;}
  reset(){Atomics.store(this.control,RESET,1);this.next=null;}
  packet(packet){
    if(!(packet instanceof ArrayBuffer)||packet.byteLength<24)return false;
    const view=new DataView(packet),rate=view.getUint32(4,true),frames=view.getUint32(16,true);
    if(view.getUint32(0,true)!==0x31574341||rate<8000||rate>768000||frames>Math.ceil(rate/50)||packet.byteLength!==24+frames*8)return false;
    const start=view.getBigUint64(8,true),gap=this.next!==null&&start!==this.next;
    this.next=start+BigInt(frames);
    if(Atomics.load(this.control,RATE)!==rate||view.getUint32(20,true)||gap){
      Atomics.store(this.control,RATE,rate);Atomics.store(this.control,RESET,1);return true;
    }
    if(Atomics.load(this.control,RESET))return true;
    const read=Atomics.load(this.control,READ)>>>0,write=Atomics.load(this.control,WRITE)>>>0;
    if(((write-read)>>>0)+frames>=this.capacity){Atomics.store(this.control,RESET,1);return true;}
    for(let i=0;i<frames;i++)for(let ch=0;ch<2;ch++){
      const value=view.getFloat32(24+i*8+ch*4,true);
      this.samples[((write+i)%this.capacity)*2+ch]=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;
    }
    Atomics.store(this.control,WRITE,(write+frames)|0);return true;
  }
}
export class PcmReader {
  constructor(shared,outputRate){this.control=new Int32Array(shared,0,HEADER/4);this.samples=new Float32Array(shared,HEADER);this.capacity=this.samples.length/2;this.outputRate=outputRate;this.fraction=0;this.primed=false;this.correction=0;this.integral=0;this.fade=0;this.lastL=0;this.lastR=0;}
  render(left,right){
    left.fill(0);right.fill(0);
    let read=Atomics.load(this.control,READ)>>>0;
    const write=Atomics.load(this.control,WRITE)>>>0,rate=Atomics.load(this.control,RATE);
    if(Atomics.load(this.control,RESET)){
      Atomics.store(this.control,READ,write|0);this.primed=false;this.fraction=0;this.correction=0;this.integral=0;
      Atomics.store(this.control,PLAYING,0);Atomics.store(this.control,RESET,0);
      this.tail(left,right,0);return;
    }
    if(!rate)return;
    let queued=(write-read)>>>0;const target=rate*.5,step=rate/this.outputRate,needed=left.length*step+2;
    if(!this.primed){
      if(queued<target+needed){this.tail(left,right,0);return;}
      read=(write-Math.ceil(target+needed))>>>0;queued=(write-read)>>>0;
      this.primed=true;this.fade=0;this.fraction=0;
    }
    if(queued>target+rate*.5){
      read=(write-Math.ceil(target+needed))>>>0;queued=(write-read)>>>0;this.fraction=0;this.fade=0;
    }
    const dt=left.length/this.outputRate,error=(queued-target-needed)/target;
    this.integral=Math.max(-.002,Math.min(.002,this.integral+error*dt*.001));
    const desired=Math.max(-.005,Math.min(.005,error*.002+this.integral));
    this.correction+=(desired-this.correction)*Math.min(1,dt/.5);
    const increment=step*(1+this.correction);
    for(let i=0;i<left.length;i++){
      if(((write-read)>>>0)<2){this.primed=false;this.fraction=0;read=write;this.tail(left,right,i);break;}
      const a=(read%this.capacity)*2,b=(((read+1)>>>0)%this.capacity)*2;
      const gain=Math.min(1,++this.fade/128);
      this.lastL=left[i]=(this.samples[a]+(this.samples[b]-this.samples[a])*this.fraction)*gain;
      this.lastR=right[i]=(this.samples[a+1]+(this.samples[b+1]-this.samples[a+1])*this.fraction)*gain;
      this.fraction+=increment;const whole=Math.floor(this.fraction);this.fraction-=whole;read=(read+whole)>>>0;
      if(((write-read)>>>0)>this.capacity){read=write;this.fraction=0;this.primed=false;this.tail(left,right,i+1);break;}
    }
    Atomics.store(this.control,READ,read|0);Atomics.store(this.control,PLAYING,this.primed?1:0);
  }
  tail(left,right,start){const l=this.lastL,r=this.lastR;for(let i=start;i<left.length;i++){const gain=Math.max(0,1-(i-start+1)/64);left[i]=l*gain;right[i]=r*gain;}this.lastL=0;this.lastR=0;}
}
