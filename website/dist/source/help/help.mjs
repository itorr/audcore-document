import {connectionFrom,sourceUrl} from '../connection.mjs';
const connection=connectionFrom(location),input=document.querySelector('#source-address'),button=document.querySelector('#copy-address'),status=document.querySelector('#copy-status');
if(connection){input.value=sourceUrl(connection);button.disabled=false;}
else{input.value='';status.textContent='请从声核网页源的右键菜单打开本页。';}
button.addEventListener('click',async()=>{
  if(!connection)return;
  try{await navigator.clipboard.writeText(input.value);status.textContent='地址已复制';}
  catch{input.focus();input.select();status.textContent='复制失败，请选中地址后复制。';}
});
