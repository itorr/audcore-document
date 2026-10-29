export const ORIGIN='https://audcore.utae.cn';
export const PORT=38539;
export function connectionFrom(location){
  const query=new URLSearchParams(location.search||''),fragment=(location.hash||'').slice(1);
  const token=/^[a-f\d]{32}$/i.test(fragment)?fragment:new URLSearchParams(fragment).get('token');
  const port=query.get('port')||String(PORT);
  if(!/^[a-f\d]{32}$/i.test(token||'')||!/^\d{1,5}$/.test(port)||Number(port)<1||Number(port)>65535)return null;
  return {token,port:Number(port),socketUrl:`ws://127.0.0.1:${Number(port)}/pcm?token=${token}`,
    readyUrl:`http://127.0.0.1:${Number(port)}/ready`};
}
export function sourceUrl(connection){return `${ORIGIN}/source/?port=${connection.port}#token=${connection.token}`;}
