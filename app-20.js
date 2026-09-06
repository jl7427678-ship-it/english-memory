const memorizationText=globalThis.MemorizationText;
let memorizationReadMeta={encoding:'',analysis:null},memorizationMapPage=0,quickDeck=null;

splitSentences=function(text){return memorizationText.splitSentences(text)};
keywords=function(text,n=5){return memorizationText.keywords(text,n)};
const baseCloze20=cloze;
cloze=function(sentence,ratio,index){return memorizationText.hasCJK(sentence)?memorizationText.clozeChinese(sentence,ratio,index,esc):baseCloze20(sentence,ratio,index)};
const baseInitials20=initials;
initials=function(sentence){if(!memorizationText.hasCJK(sentence))return baseInitials20(sentence);const terms=keywords(sentence,5);return terms.length?terms.map(term=>`<span class="keyword-chip">${esc(term[0])}…</span>`).join(''):esc(sentence)};
normBlank=function(value){return memorizationText.normalizeAnswer(value)};

makeDoc=function(title,text,sourceFile=null){
  if([...text].length>2000000)throw new Error('文档超过 200 万字符，请拆分后再导入。');
  const ss=splitSentences(text);if(!ss.length)throw new Error('没有识别到可用于背诵的完整句子。');
  const ps=memorizationText.paragraphs(text),sections=[];
  if(ps.length>1&&ps.length<=500){let start=0;for(let i=0;i<ps.length;i++){const count=memorizationText.splitSentences(ps[i]).length;if(!count)continue;sections.push({name:'段落 '+(sections.length+1),keywords:keywords(ps[i],4),preview:ps[i].slice(0,80),startIndex:start,sentenceCount:count});start+=count}}
  else{const size=Math.max(4,Math.ceil(ss.length/Math.min(500,Math.max(1,Math.ceil(ss.length/4)))));for(let i=0;i<ss.length;i+=size){const chunk=ss.slice(i,i+size).join(' ');sections.push({name:'段落 '+(sections.length+1),keywords:keywords(chunk,4),preview:chunk.slice(0,80),startIndex:i,sentenceCount:Math.min(size,ss.length-i)})}}
  const analysis=memorizationText.analyze(text,sourceFile?.encoding||memorizationReadMeta.encoding||'直接粘贴');
  return {id:'d'+Date.now(),title:title||'未命名资料',text,sentences:ss,sections,created:now(),cards:ss.map((_,i)=>({i,ease:0,due:0,reps:0,lapses:0,last:0})),weak:{},importStats:analysis,...(sourceFile?{sourceFile:{...sourceFile,encoding:analysis.encoding}}:{})};
};

const baseAddDoc20=addDoc;
addDoc=function(title,text,sourceFile=null){baseAddDoc20(title,text,sourceFile);const doc=active();if(doc?.importStats?.keywords===0)toast('资料已导入，但未提取到可靠关键词；请使用全文阅读或手动整理关键词。')};

renderMap=function(requestedPage){
  const doc=active();if(!doc)return;const pageSize=40,pages=Math.max(1,Math.ceil(doc.sections.length/pageSize)),activeSection=doc.sections.findIndex(section=>(section.startIndex??0)<=state.study.index&&state.study.index<(section.startIndex??0)+(section.sentenceCount||4)),activePage=activeSection>=0?Math.floor(activeSection/pageSize):memorizationMapPage;memorizationMapPage=Math.max(0,Math.min(pages-1,Number.isInteger(requestedPage)?requestedPage:activePage));const start=memorizationMapPage*pageSize,visible=doc.sections.slice(start,start+pageSize);
  $('#storyMap').innerHTML=(pages>1?`<div class="story-map-pager"><button class="btn" id="mapPrev" ${memorizationMapPage===0?'disabled':''}>上一批</button><span class="sub">${memorizationMapPage+1} / ${pages}</span><button class="btn" id="mapNext" ${memorizationMapPage>=pages-1?'disabled':''}>下一批</button></div>`:'')+visible.map((section,offset)=>`<button class="node" data-node="${start+offset}"><b>${esc(section.name)}</b> · ${(section.keywords||[]).map(esc).join(' → ')||'暂无关键词'}</button>`).join('');
  $$('[data-node]').forEach(button=>button.onclick=()=>{const section=doc.sections[Number(button.dataset.node)],index=section?.startIndex??Number(button.dataset.node)*4;state.study.index=Math.min(index,doc.sentences.length-1);state.study.mode='keywords';save();renderStudy()});
  if($('#mapPrev'))$('#mapPrev').onclick=()=>renderMap(memorizationMapPage-1);if($('#mapNext'))$('#mapNext').onclick=()=>renderMap(memorizationMapPage+1);
};

const baseRenderStudy20=renderStudy;
renderStudy=function(){baseRenderStudy20();const doc=active(),mode=state.study.mode;if(!doc){$('#sentenceDisplay').textContent='先到资料库导入你的背诵资料。';return}if((mode==='cloze30'||mode==='cloze60')&&!$('#sentenceDisplay .cloze-input')){$('#clozeTools').style.display='none';$('#clozeFeedback').textContent='未找到可靠关键词，本句先使用全文阅读；也可以在原文中手动整理关键词。'}};

function importLimit(ext){return ext==='txt'||ext==='md'?8*1024*1024:ext==='docx'?30*1024*1024:ext==='pdf'?50*1024*1024:0}
readFile=async function(file,buffer){
  const ext=file.name.split('.').pop().toLowerCase(),limit=importLimit(ext);if(!limit)throw new Error('暂不支持这个文件格式');if(file.size>limit)throw new Error(`文件过大：${ext.toUpperCase()} 上限为 ${Math.round(limit/1024/1024)} MB，请拆分后再导入。`);
  if(ext==='txt'||ext==='md'){const decoded=memorizationText.decodeTextBuffer(buffer,$('#textEncoding')?.value||'auto');memorizationReadMeta={encoding:decoded.encoding,analysis:memorizationText.analyze(decoded.text,decoded.encoding)};return decoded.text}
  if(ext==='docx'){showLoading('正在解析 Word','DOCX 解析后只保存结构化文字，不保存原文件。');if(!window.mammoth)await loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js');const result=await window.mammoth.extractRawText({arrayBuffer:buffer}),text=result.value.replace(/\r\n?/g,'\n');if(!text.trim())throw new Error('该 DOCX 未检测到可提取文本。');memorizationReadMeta={encoding:'DOCX 文本层',analysis:memorizationText.analyze(text,'DOCX 文本层')};return text}
  showLoading('正在解析 PDF','PDF 解析后默认只保存结构化文字，不保存原 PDF。');const pdfjs=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';const pdf=await pdfjs.getDocument({data:new Uint8Array(buffer)}).promise;if(pdf.numPages>80)throw new Error('PDF 超过 80 页，请拆分后再导入。');const pages=[];for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){const page=await pdf.getPage(pageNo),content=await page.getTextContent();let pageText='';for(const item of content.items){pageText+=item.str;if(item.hasEOL)pageText+='\n';else pageText+=' '}pages.push(pageText.trim());if(pageNo%8===0)await new Promise(resolve=>setTimeout(resolve,0))}const text=pages.filter(Boolean).join('\n\n');if(!text.trim())throw new Error('该 PDF 未检测到可提取文本。');memorizationReadMeta={encoding:'PDF 文本层',analysis:memorizationText.analyze(text,'PDF 文本层')};return text;
};

function renderImportSummary(file,analysis){const box=$('#importSummary');if(!box)return;box.hidden=false;box.innerHTML=`<b>${esc(file.name)}</b><span>${analysis.characters} 字符</span><span>${analysis.paragraphs} 段</span><span>${analysis.sentences} 句</span><span>${analysis.language}</span><span>${esc(analysis.encoding||'未知编码')}</span><span>${analysis.keywords} 个关键词</span>${analysis.keywords===0?'<small>无法自动提取可靠关键词；不会进入无效挖空。</small>':''}`}
handleFile=async function(file){try{const buffer=await file.arrayBuffer(),sha256=await sha256Buffer(buffer);if(sha256&&state.docs.some(doc=>doc.sourceFile?.sha256===sha256)){pendingImportedFile=null;return toast('这份文件已经导入过，无需重复保存')}const text=await readFile(file,buffer),analysis=memorizationReadMeta.analysis||memorizationText.analyze(text,memorizationReadMeta.encoding);pendingImportedFile={name:file.name,type:file.type||'',size:file.size,sha256,retained:false,encoding:analysis.encoding};$('#pasteText').value=text;$('#materialTitle').value=file.name.replace(/\.[^.]+$/,'');renderImportSummary(file,analysis);toast('文件已读入；生成后只保存文字，不保留原文件')}catch(error){pendingImportedFile=null;alert(error.message)}finally{hideLoading()}};

function quickWord(){return quickDeck?.words[Math.max(0,Math.min(quickDeck.words.length-1,Number(state.vocab.quickResume[quickDeck.id])||0))]||null}
function renderVocabQuick(){const word=quickWord();if(!quickDeck||!word){$('#vocabQuickTrainer').hidden=true;return}const index=Number(state.vocab.quickResume[quickDeck.id])||0;$('#vocabQuickDeck').textContent=quickDeck.title;$('#vocabQuickIndex').textContent=`${index+1} / ${quickDeck.words.length}`;$('#vocabQuickWord').textContent=word.word;$('#vocabQuickMeta').textContent=[word.phonetic,word.pos].filter(Boolean).join(' · ');$$('[data-vquick-status]').forEach(button=>button.classList.toggle('active',button.dataset.vquickStatus===word.quickStatus))}
function startVocabQuick(deck){quickDeck=deck;state.vocab.quickResume[deck.id]=Math.max(0,Math.min(deck.words.length-1,Number(state.vocab.quickResume[deck.id])||0));$('#vocabTrainer').style.display='none';$('#vocabQuickTrainer').hidden=false;renderVocabQuick();$('#vocabQuickTrainer').scrollIntoView({behavior:'smooth',block:'start'})}
function answerVocabQuick(status){const word=quickWord();if(!word)return;word.quickStatus=status;if(quickDeck.builtin)saveBuiltinProgress(quickDeck,word);const next=(Number(state.vocab.quickResume[quickDeck.id])||0)+1;if(next>=quickDeck.words.length){state.vocab.quickResume[quickDeck.id]=0;save();toast('这个词库已经快速筛完一遍');renderVocabQuick();return}state.vocab.quickResume[quickDeck.id]=next;save();renderVocabQuick()}
$$('[data-vquick-status]').forEach(button=>button.onclick=()=>answerVocabQuick(button.dataset.vquickStatus));$('#vocabQuickSpeak').onclick=()=>{const word=quickWord();if(word)speak(word.word,{lang:quickDeck?.speechLang,userInitiated:true})};$('#exitVocabQuick').onclick=()=>{$('#vocabQuickTrainer').hidden=true;quickDeck=null;renderVocabHome()};

renderLibrary();renderStudy();renderVocabHome();
