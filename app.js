(async()=>{
  for(const src of ['app-1.js','app-2.js','app-3.js','app-4.js','app-5.js']){
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=()=>reject(new Error('加载失败：'+src));
      document.body.appendChild(s);
    });
  }
})().catch(err=>{
  console.error(err);
  const el=document.getElementById('toast');
  if(el){el.textContent='程序加载失败，请刷新页面';el.classList.add('show')}
});
