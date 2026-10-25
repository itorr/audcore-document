export function selectRows(rows,{query='',type='',key='users',direction=-1}={}){
 const term=query.trim().toLocaleLowerCase();
 return rows.filter(row=>(!type||row.type===type)&&(!term||`${row.name} ${row.vendor} ${row.type||''} ${row.version||''}`.toLocaleLowerCase().includes(term))).sort((a,b)=>{
  if(a[key]==null&&b[key]!=null)return 1;if(b[key]==null&&a[key]!=null)return -1;
  const order=typeof a[key]==='string'?a[key].localeCompare(b[key],'zh-CN'):(a[key]??0)-(b[key]??0);return order*direction||a.id-b.id;
 });
}
export function fitScale(width,height){return Math.max(.01,Math.min(width/1600,height/900));}
export function percentage(count,total){return total>0&&count!=null?(count/total*100).toFixed(1)+'%':'';}
