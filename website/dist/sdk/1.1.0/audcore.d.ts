export declare const SDK_VERSION: '1.1.0';
export interface Channel { id:string; index:number; name:string; gain_db:number; mute:boolean; color:string|null; display_name:string; visual_index:number; align_right:boolean; fx_bypass:boolean; channel_mode:0|1|2; phase:number; inputs:number[]; virtual_input?:string|null; sends:unknown[] }
export interface Effect { id:string; name:string|null; bypass:boolean; wet:number; available:boolean }
export interface ChannelUpdate { gain_db?:number; mute?:boolean; fx_bypass?:boolean; channel_mode?:0|1|2; phase?:number; align_right?:boolean }
export interface SoloState { selected:number[]; safe:number[]; excluded:number[] }
export interface RecordingSettings { directory:string; format:string }
export interface RecordingState { chain:number; active:boolean; stopping:boolean; path:string; error:string|null }
export interface RecordingSnapshot { settings:RecordingSettings; channels:RecordingState[] }
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
  updateChannel(id:string,body:ChannelUpdate):Promise<Channel>;
  getEffects(channelId:string):Promise<Effect[]>;updateEffect(id:string,body:{bypass?:boolean;wet?:number}):Promise<Effect>;
  getSolo():Promise<SoloState>; setSolo(channel:string,on:boolean):Promise<SoloState>;
  setSoloSafe(channel:string,safe:boolean):Promise<SoloState>; clearSolo():Promise<SoloState>;
  getRecording():Promise<RecordingSnapshot>; getRecordingSettings():Promise<RecordingSettings>;
  updateRecordingSettings(settings:Partial<RecordingSettings>):Promise<RecordingSettings>;
  getChannelRecording(index:number):Promise<RecordingState>;
  setChannelRecording(index:number,active:boolean):Promise<RecordingState>;
  getParameters(effectId:string):Promise<Parameter[]>;setParameter(effectId:string,parameterId:string,normalized:number):Promise<Parameter>;
  subscribe<T=unknown>(resource:string,options:{frequencyHz?:number},callback:(data:T,event:ApiEvent<T>)=>void):Promise<Subscription>;
}
