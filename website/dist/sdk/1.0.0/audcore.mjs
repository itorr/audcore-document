/** Audcore browser SDK 1.0.0 — public local WebSocket resource API v1. */
export const SDK_VERSION = '1.0.0';
export class AudcoreError extends Error {
  constructor(status, data) { super(data?.error?.message || `API error ${status}`); this.name='AudcoreError';this.status=status;this.code=data?.error?.code || 'api_error'; }
}
function browserStore() {
  let db;
  async function database() {
    if (!globalThis.indexedDB) return null;
    return db ||= new Promise((resolve,reject)=>{const r=indexedDB.open('audcore-sdk',1);r.onupgradeneeded=()=>r.result.createObjectStore('credentials');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  }
  async function run(key,value,write) {
    const d=await database();if(!d)return null;
    return new Promise((resolve,reject)=>{const tx=d.transaction('credentials',write?'readwrite':'readonly');const store=tx.objectStore('credentials');const r=write?(value==null?store.delete(key):store.put(value,key)):store.get(key);tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
  }
  return {get:key=>run(key,null,false),set:(key,value)=>run(key,value,true),delete:key=>run(key,null,true)};
}
export class AudcoreClient {
  constructor({url='ws://127.0.0.1:38533/api/v1',appName='Audcore SDK',storage=browserStore(),WebSocket=globalThis.WebSocket,reconnect=true}={}) {
    const parsed=new URL(url);
    if(parsed.protocol!=='ws:'||parsed.hostname!=='127.0.0.1'||parsed.pathname!=='/api/v1'||parsed.search||parsed.hash)throw new TypeError('Use ws://127.0.0.1:port/api/v1');
    this.url=url;this.appName=appName;this.storage=storage;this.WebSocket=WebSocket;this.reconnect=reconnect;this.state='disconnected';this.listeners=new Map();this.pending=new Map();this.subscriptions=new Set();this.early=new Map();this.sequence=0;this.closed=true;this.key=`${url}:${appName}`;
  }
  on(event,callback) { let callbacks=this.listeners.get(event);if(!callbacks)this.listeners.set(event,callbacks=new Set());callbacks.add(callback);return()=>callbacks.delete(callback); }
  _emit(event,data) {for(const cb of this.listeners.get(event)||[]){try{cb(data);}catch(error){if(event!=='error')this._emit('error',error);}}}
  _state(state){this.state=state;this._emit('state',state);}
  async connect(){
    if(this.state==='connected')return this;
    if(this.connecting)return this.connecting;
    this.closed=false;
    this.connecting=(async()=>{
      this.token=await this.storage.get(this.key).catch(()=>null);
      if(this.closed)throw new Error('连接已取消');
      return new Promise((resolve,reject)=>{this.resolveConnect=resolve;this.rejectConnect=reject;this._open();});
    })().finally(()=>{this.connecting=null;});
    return this.connecting;
  }
  _open(){
    if(this.closed)return;
    this._state('connecting');this.early.clear();
    const socket=this.socket=new this.WebSocket(this.url);
    let helloId;
    const handshakeTimer=setTimeout(()=>{this._emit('error',new Error('声核连接或授权超时'));socket.close();},135000);
    socket.addEventListener('open',()=>{helloId=String(++this.sequence);socket.send(JSON.stringify({id:helloId,method:'POST',path:'/connections',body:{app_name:this.appName,...(this.token?{token:this.token}:{})}}));});
    socket.addEventListener('message',async({data})=>{
      if(socket!==this.socket)return;
      let m;try{m=JSON.parse(data);}catch{return;}
      if(m.id===helloId){
        if(m.status===401){this.token=null;await this.storage.delete(this.key).catch(()=>{});socket.close();return;}
        if(m.status===202){this._state('authorization-pending');this._emit('authorization-pending',m.data);return;}
        if(m.status===200){clearTimeout(handshakeTimer);this.instanceId=m.data.instance_id;this._authorized();return;}
        this.closed=true;this.rejectConnect?.(new AudcoreError(m.status,m.data));socket.close();return;
      }
      if(m.event==='authorized'){clearTimeout(handshakeTimer);this.token=m.data.token;this.instanceId=m.data.instance_id;await this.storage.set(this.key,this.token).catch(error=>this._emit('error',error));if(socket===this.socket&&!this.closed)this._authorized();return;}
      if(m.event==='rejected'||m.event==='revoked'){this.closed=true;this.token=null;await this.storage.delete(this.key).catch(()=>{});const error=new AudcoreError(403,{error:{code:m.event,message:m.event==='rejected'?'声核拒绝了连接':'授权已撤销'}});this.rejectConnect?.(error);this._emit(m.event,error);socket.close();return;}
      if(m.id){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.status>=200&&m.status<300?p.resolve(m.data):p.reject(new AudcoreError(m.status,m.data));}return;}
      if(m.subscription_id){const sub=[...this.subscriptions].find(s=>s.id===m.subscription_id);if(sub)this._deliver(sub,m);else{if(this.early.size<32){let events=this.early.get(m.subscription_id);if(!events)this.early.set(m.subscription_id,events=[]);if(events.length<128)events.push(m);}}}
    });
    socket.addEventListener('error',()=>this._emit('error',new Error('无法连接声核，请检查本地 API 开关、地址及浏览器的本地网络权限')));
    socket.addEventListener('close',()=>{
      clearTimeout(handshakeTimer);if(socket!==this.socket)return;this._state('disconnected');for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('连接已断开'));}this.pending.clear();for(const s of this.subscriptions)s.id=null;
      if(!this.closed&&this.reconnect){this.timer=setTimeout(()=>this._open(),800);}else{this.rejectConnect?.(new Error('连接已断开'));this.resolveConnect=null;this.rejectConnect=null;}
    });
  }
  async _authorized(){
    this._state('connected');this.resolveConnect?.(this);this.resolveConnect=null;this.rejectConnect=null;
    for(const s of [...this.subscriptions])if(!s.cancelled&&!s.id&&!s.loading){try{await this._subscribe(s);}catch(error){this._emit('error',error);}}
  }
  _deliver(sub,event){if(event.event==='subscription-error'){sub.cancelled=true;this.subscriptions.delete(sub);this._emit('error',new AudcoreError(event.status,event.data));return;}if(!sub.cancelled){try{sub.callback(event.data,event);}catch(error){this._emit('error',error);}}}
  request(method,path,body){
    if(this.state!=='connected')return Promise.reject(new Error('请先连接并在声核中允许'));
    const id=String(++this.sequence);
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('API 请求超时'));},15000);this.pending.set(id,{resolve,reject,timer});try{this.socket.send(JSON.stringify({id,method,path,...(body===undefined?{}:{body})}));}catch(error){clearTimeout(timer);this.pending.delete(id);reject(error);}});
  }
  getInfo(){return this.request('GET','/info');}
  getDevices(){return this.request('GET','/devices');}
  getStatus(){return this.request('GET','/status');}
  getChannels(){return this.request('GET','/channels');}
  getChannel(id){return this.request('GET',`/channels/${encodeURIComponent(id)}`);}
  updateChannel(id,body){return this.request('PATCH',`/channels/${encodeURIComponent(id)}`,body);}
  getEffects(channelId){return this.request('GET',`/channels/${encodeURIComponent(channelId)}/effects`);}
  updateEffect(id,body){return this.request('PATCH',`/effects/${encodeURIComponent(id)}`,body);}
  getParameters(effectId){return this.request('GET',`/effects/${encodeURIComponent(effectId)}/parameters`);}
  setParameter(effectId,parameterId,normalized){return this.request('PATCH',`/effects/${encodeURIComponent(effectId)}/parameters/${encodeURIComponent(parameterId)}`,{normalized});}
  async _subscribe(sub){
    sub.loading=true;let data;try{data=await this.request('POST','/subscriptions',{resource:sub.resource,frequency_hz:sub.frequencyHz});}finally{sub.loading=false;}sub.id=data.subscription_id;
    if(sub.cancelled){await this.request('DELETE',`/subscriptions/${sub.id}`).catch(()=>{});return;}
    for(const e of this.early.get(sub.id)||[])this._deliver(sub,e);this.early.delete(sub.id);
  }
  async subscribe(resource,{frequencyHz=10}={},callback){
    if(typeof callback!=='function')throw new TypeError('A subscription callback is required');
    const sub={resource,frequencyHz,callback,id:null,cancelled:false};this.subscriptions.add(sub);
    try{await this._subscribe(sub);}catch(error){this.subscriptions.delete(sub);throw error;}
    return {unsubscribe:async()=>{if(sub.cancelled)return;sub.cancelled=true;this.subscriptions.delete(sub);if(sub.id&&this.state==='connected')await this.request('DELETE',`/subscriptions/${sub.id}`).catch(()=>{});}};
  }
  async disconnect(){this.closed=true;clearTimeout(this.timer);this.rejectConnect?.(new Error('连接已取消'));this.rejectConnect=null;this.resolveConnect=null;for(const s of this.subscriptions)s.cancelled=true;this.subscriptions.clear();this.early.clear();this.socket?.close();this._state('disconnected');}
  async forgetAuthorization(){await this.disconnect();this.token=null;await this.storage.delete(this.key);}
}
