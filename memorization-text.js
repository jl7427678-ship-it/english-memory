(function(root){
  const ZH_STOP=new Set(['的','了','和','是','在','有','与','及','而','或','被','把','对','中','上','下','等']);
  const EN_STOP=new Set(['the','and','that','this','with','from','your','have','will','into','about','when','what','which','where','there','their','they','them','then','than','were','been','being','would','could','should']);
  const hasCJK=s=>/[\u3400-\u9fff]/u.test(s||'');
  const cleanText=s=>String(s||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  function suspicious(text){const bad=(text.match(/�/g)||[]).length;return bad>0||/(?:Ã.|Â.|â€|ï¿½)/.test(text)}
  function decode(bytes,label,fatal=true){return new TextDecoder(label,{fatal}).decode(bytes)}
  function decodeTextBuffer(buffer,choice='auto'){
    const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),selected=String(choice||'auto').toLowerCase();
    let text='',encoding='';
    if(bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf){text=decode(bytes.subarray(3),'utf-8');encoding='UTF-8 (BOM)'}
    else if(bytes[0]===0xff&&bytes[1]===0xfe){text=decode(bytes.subarray(2),'utf-16le',false);encoding='UTF-16LE (BOM)'}
    else if(bytes[0]===0xfe&&bytes[1]===0xff){text=decode(bytes.subarray(2),'utf-16be',false);encoding='UTF-16BE (BOM)'}
    else if(selected==='utf-8'){text=decode(bytes,'utf-8');encoding='UTF-8'}
    else if(selected==='gb18030'||selected==='gbk'){text=decode(bytes,'gb18030');encoding='GB18030/GBK'}
    else{
      try{text=decode(bytes,'utf-8');encoding='UTF-8'}catch(_){text=decode(bytes,'gb18030');encoding='GB18030/GBK'}
    }
    text=cleanText(text);
    if(suspicious(text))throw new Error('文本编码无法可靠识别，请手动选择 UTF-8 或 GB18030/GBK 后重试。');
    return {text,encoding};
  }
  function detectLanguage(text){const zh=(String(text).match(/[\u3400-\u9fff]/gu)||[]).length,en=(String(text).match(/[A-Za-z]/g)||[]).length;return zh>en?'中文':en?'英文':'未知'}
  function paragraphs(text){return cleanText(text).split(/\n+/).map(x=>x.trim()).filter(Boolean)}
  function fallbackSentences(text){return (text.match(/[^。！？；.!?\n]+[。！？；.!?]+|[^。！？；.!?\n]+$/gu)||[]).map(x=>x.trim()).filter(Boolean)}
  function splitSentences(text,limit=5000){
    const out=[],locale=hasCJK(text)?'zh-CN':'en';
    for(const paragraph of paragraphs(text)){
      let parts=[];
      if(typeof Intl!=='undefined'&&Intl.Segmenter){
        try{parts=[...new Intl.Segmenter(locale,{granularity:'sentence'}).segment(paragraph)].map(x=>x.segment)}catch(_){parts=[]}
      }
      if(!parts.length)parts=fallbackSentences(paragraph);
      for(const part of parts){for(const sentence of fallbackSentences(part)){if((hasCJK(sentence)||/[A-Za-z]/.test(sentence))&&sentence.length>1)out.push(sentence);if(out.length>limit)throw new Error('文档句子超过 '+limit+' 句，请拆分文件后再导入。')}}
    }
    return out;
  }
  function zhKeywords(text,n){
    const tokens=[];
    if(typeof Intl!=='undefined'&&Intl.Segmenter){
      try{for(const item of new Intl.Segmenter('zh-CN',{granularity:'word'}).segment(text)){const word=item.segment.trim();if(item.isWordLike&&hasCJK(word)&&word.length>=2&&!ZH_STOP.has(word))tokens.push(word)}}catch(_){}
    }
    if(!tokens.length){for(const run of String(text).match(/[\u3400-\u9fff]{2,12}/gu)||[]){const parts=run.split(/[的了和是在有与及而或被把对中上下等]/u).filter(x=>x.length>=2&&x.length<=8);tokens.push(...parts)}}
    const candidates=[...tokens];
    for(let i=0;i<tokens.length-1;i++){const pair=tokens[i]+tokens[i+1];if(pair.length<=8)candidates.push(pair)}
    const freq=new Map();candidates.forEach(word=>freq.set(word,(freq.get(word)||0)+1));
    return [...freq.keys()].sort((a,b)=>(freq.get(b)-freq.get(a))||(b.length-a.length)).slice(0,n);
  }
  function keywords(text,n=5){
    if(hasCJK(text))return zhKeywords(text,n);
    const words=(String(text).toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g)||[]).filter(word=>word.length>3&&!EN_STOP.has(word)),freq={};
    words.forEach(word=>freq[word]=(freq[word]||0)+1);
    return [...new Set(words)].sort((a,b)=>(freq[b]-freq[a])||(b.length-a.length)).slice(0,n);
  }
  function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function clozeChinese(sentence,ratio,index,esc=escapeHtml){
    const terms=keywords(sentence,12).filter(term=>sentence.includes(term));
    if(!terms.length)return esc(sentence);
    const count=Math.max(1,Math.round(terms.length*ratio)),chosen=new Set();
    for(let i=0;i<count;i++)chosen.add(terms[(i+index)%terms.length]);
    const matches=[];
    for(const term of chosen){let from=0,at;while((at=sentence.indexOf(term,from))>=0){matches.push({at,end:at+term.length,term});from=at+term.length}}
    matches.sort((a,b)=>a.at-b.at||b.end-a.end);
    let html='',cursor=0;
    for(const match of matches){if(match.at<cursor)continue;html+=esc(sentence.slice(cursor,match.at))+`<input class="cloze-input" data-answer="${esc(match.term)}" style="width:${Math.max(4,Math.min(12,match.term.length*2))}em">`;cursor=match.end}
    return html+esc(sentence.slice(cursor));
  }
  function analyze(text,encoding=''){const ps=paragraphs(text),ss=splitSentences(text),ks=keywords(text,100);return {characters:[...String(text)].length,paragraphs:ps.length,sentences:ss.length,language:detectLanguage(text),encoding,keywords:ks.length}}
  function normalizeAnswer(value){const text=String(value||'').normalize('NFKC').trim().replace(/\s+/g,' ');return hasCJK(text)?text:text.toLowerCase().replace(/[^a-z0-9']/g,'')}
  root.MemorizationText={decodeTextBuffer,detectLanguage,paragraphs,splitSentences,keywords,clozeChinese,analyze,normalizeAnswer,hasCJK};
})(globalThis);
