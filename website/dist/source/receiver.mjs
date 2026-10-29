import {PcmWriter,PLAYING} from './buffer.mjs';
let socket,timer,watchdog,writer,socketUrl,stopped=false,attempt=0,lastState='';
function state(value){if(value!==lastState){lastState=value;postMessage({state:value});}}
function connect(){
  if(stopped)return;
  state('connecting');socket=new WebSocket(socketUrl);socket.binaryType='arraybuffer';
  const arm=()=>{clearTimeout(watchdog);watchdog=setTimeout(()=>socket.close(),2000);};
  socket.onopen=()=>{attempt=0;writer.reset();state('buffering');arm();};
  socket.onmessage=event=>{if(!writer.packet(event.data)){socket.close();return;}arm();state(Atomics.load(writer.control,PLAYING)?'playing':'buffering');};
  socket.onerror=()=>socket.close();
  socket.onclose=()=>{clearTimeout(watchdog);writer.reset();state('disconnected');if(!stopped)timer=setTimeout(connect,Math.min(5000,500*2**Math.min(attempt++,4)));};
}
onmessage=({data})=>{
  if(data.stop){stopped=true;clearTimeout(timer);clearTimeout(watchdog);socket?.close();writer?.reset();return;}
  if(writer)return;writer=new PcmWriter(data.shared);socketUrl=data.socketUrl;connect();
};
