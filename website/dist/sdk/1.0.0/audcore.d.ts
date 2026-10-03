export declare const SDK_VERSION: '1.0.0';
export interface Channel { id:string; index:number; name:string; gain_db:number; mute:boolean; color:string|null }
export interface Effect { id:string; name:string|null; bypass:boolean; available:boolean }
export interface Parameter { id:string; name:string; units:string; normalized:number; default_normalized:number; step_count:number; writable:boolean; plain:number|null; display:string|null }
export interface ApiEvent<T=unknown> { event:'snapshot'|'update'|'removed'|'subscription-error'; subscription_id:string; resource:string; data:T; sequence:number; status?:number }
export interface Subscription { unsubscribe():Promise<void> }
export interface CredentialStore { get(key:string):Promise<string|null|undefined>; set(key:string,value:string):Promise<unknown>; delete(key:string):Promise<unknown> }
export declare class AudcoreError extends Error { status:number; code:string }
export declare class AudcoreClient {
  constructor(options?:{url?:string;appName?:string;storage?:CredentialStore;WebSocket?:typeof WebSocket;reconnect?:boolean});
  readonly state:'disconnected'|'connecting'|'authorization-pending'|'connected'; readonly instanceId?:string;
  on(event:string,callback:(data:any)=>void):()=>void;
  connect():Promise<this>; disconnect():Promise<void>; forgetAuthorization():Promise<void>;
  request<T=unknown>(method:'GET'|'POST'|'PATCH'|'DELETE',path:string,body?:unknown):Promise<T>;
  getInfo():Promise<{api_version:string;instance_id:string;version:string}>;
  getDevices():Promise<{inputs:unknown[];outputs:unknown[];current:unknown}>;
  getStatus():Promise<{running:boolean;sample_rate:number;buffer_frames:number;latency_ms:number;xruns:number}>;
  getChannels():Promise<Channel[]>;getChannel(id:string):Promise<Channel>;
  updateChannel(id:string,body:{gain_db?:number;mute?:boolean}):Promise<Channel>;
  getEffects(channelId:string):Promise<Effect[]>;updateEffect(id:string,body:{bypass:boolean}):Promise<Effect>;
  getParameters(effectId:string):Promise<Parameter[]>;setParameter(effectId:string,parameterId:string,normalized:number):Promise<Parameter>;
  subscribe<T=unknown>(resource:string,options:{frequencyHz?:number},callback:(data:T,event:ApiEvent<T>)=>void):Promise<Subscription>;
}
