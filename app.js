(async()=>{
  for(const src of ['app-1.js','app-2.js','app-3.js','app-4.js','app-5.js','app-6.js','app-7.js','app-8.js','app-9.js','app-10.js','app-11.js','app-12.js','app-13.js','app-14.js','app-15.js','app-16.js','app-17.js','app-18.js','app-19.js','memorization-text.js','app-20.js']){
    await new Promise((resolve,reject)=>{
      const s=document.createElement('script');
  s.src=src+'?v=20260906-26';
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
