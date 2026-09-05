(async()=>{
  const mount=document.getElementById('appMount');
  try{
    const r=await fetch('ui.html?v=20260905-11',{cache:'no-store'});
    if(!r.ok) throw new Error('ui.html');
    mount.outerHTML=await r.text();
    await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='app.js?v=20260905-11';s.onload=resolve;s.onerror=reject;document.body.appendChild(s)});
  }catch(err){
    mount.innerHTML='<main style="font-family:system-ui;padding:28px;max-width:720px;margin:auto"><h1>串题记忆室</h1><p>页面资源加载失败。请联网刷新一次；之后会自动缓存离线版本。</p><button onclick="location.reload()">重新加载</button></main>';
    console.error(err);
  }
})();
