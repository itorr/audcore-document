import {createBuffer} from './buffer.mjs';
import {createVisualizer} from './visualizer.mjs';
import {connectionFrom} from './connection.mjs';

const connection=connectionFrom(location),visual=createVisualizer(document.querySelector('canvas'));
let context,worker,node,sharedBuffer,starting=false,closed=false,permission,permissionChecked=false;
function resume(){
  if(context)context.resume().then(()=>visual.setActive(context?.state==='running')).catch(()=>{});
}
async function canConnect(gesture){
  if(!permissionChecked){
    permissionChecked=true;
    try{
      permission=await navigator.permissions.query({name:'loopback-network'});
      permission.addEventListener('change',()=>{if(permission.state==='granted')start();});
    }catch{/* Legacy OBS/CEF versions do not expose this permission. */}
  }
  if(!permission||permission.state==='granted')return true;
  if(permission.state==='denied'||!gesture)return false;
  const response=await fetch(connection.readyUrl,{mode:'cors',targetAddressSpace:'loopback'});
  return response.ok;
}
async function start(gesture=false){
  // A pending autoplay attempt must never prevent a later gesture from resuming.
  resume();
  if(starting||closed||!connection)return;starting=true;
  try{
    if(!crossOriginIsolated||typeof SharedArrayBuffer==='undefined'||!globalThis.AudioWorkletNode)return;
    if(!context){
      context=new AudioContext({latencyHint:'playback'});resume();
      sharedBuffer=createBuffer();visual.setMeter(new Int32Array(sharedBuffer,0,8));
      await context.audioWorklet.addModule(new URL('./worklet.mjs',import.meta.url));
      if(closed)return;
      node=new AudioWorkletNode(context,'audcore-local-audio',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{shared:sharedBuffer}});
      node.connect(context.destination);
      context.onstatechange=()=>visual.setActive(context.state==='running');
    }
    if(!worker&&await canConnect(gesture)&&!closed){
      worker=new Worker(new URL('./receiver.mjs',import.meta.url),{type:'module'});
      worker.onerror=()=>visual.setActive(false);
      worker.postMessage({shared:sharedBuffer,socketUrl:connection.socketUrl});
    }
    visual.setActive(context.state==='running');
  }catch(error){
    visual.setActive(false);visual.setMeter(null);worker?.terminate();node?.disconnect();context?.close().catch(()=>{});
    context=worker=node=sharedBuffer=undefined;console.warn('Audcore browser source:',error);
  }finally{starting=false;}
}
const activate=()=>start(true);
addEventListener('pointerdown',activate);addEventListener('keydown',activate);
addEventListener('pagehide',()=>{
  closed=true;removeEventListener('pointerdown',activate);removeEventListener('keydown',activate);
  visual.destroy();worker?.postMessage({stop:true});worker?.terminate();node?.disconnect();context?.close();
});
start();
