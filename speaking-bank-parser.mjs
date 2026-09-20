// Parses only the user-supplied New Channel 0903 PDF/text to preserve the original IDs and wording.
const PREFIX = {PLACE:'PL', PEOPLE:'PE', OBJECT:'OB', OBJECTS:'OB', EVENT:'EV', EVENTS:'EV', ABSTRACT:'AB'};
const clean = line => String(line).trim().replace(/\s+/g,' ');
const isNoise = line => !line || line === '35' || /^Institute\s*of\s*Teaching/.test(line) ||
  /^新航道国际教育集团/.test(line) || /^打造具有新航道/.test(line);
const linesOf = pages => pages.flatMap((page,pageIndex) => String(page).split(/\r?\n/)
  .map(line => ({text:clean(line),page:pageIndex+1})).filter(item => !isNoise(item.text)));

export function parseSpeakingBank(pages) {
  if (!Array.isArray(pages) || pages.length !== 47) throw new Error('需要原版 47 页的 0903 当季题库');
  const part1=[], part2=[], part3=[];
  let category='mandatory', current=null;
  for (const item of linesOf(pages.slice(4,18))) {
    const line=item.text;
    if (line==='Part 1 高频话题') continue;
    if (PREFIX[line]) {category=PREFIX[line];continue}
    const heading=line.match(/^(\d+)\.\s*(.+?)\s*\[(old|new)\]\s*$/i);
    if (heading) {
      const id=category==='mandatory'?`P1-M${String(heading[1]).padStart(2,'0')}`:
        `P1-${category}${String(heading[1]).padStart(2,'0')}`;
      current={id,section:'part1',category,title:heading[2],season:'2026-09/12',
               sourcePage:item.page+4,questions:[]}; part1.push(current);
      continue;
    }
    // Work and Study are subheadings under the original Work or Studies topic.
    if (current && /^(Work|Study)( \[(old|new)\])?$/i.test(line)) {
      current.branches=current.branches||[];
      current.branches.push({title:line,startQuestionIndex:current.questions.length});
      continue;
    }
    const q=line.match(/^\d+\)\s*(.+)$/);
    if (q && current) current.questions.push(q[1]);
    else if (current && current.questions.length && !/^Part 1|IELTS Speaking/.test(line))
      current.questions[current.questions.length-1]+=' '+line;
  }
  let pending=null, cue=null, group=null, mode=''; category='';
  for (const item of linesOf(pages.slice(18,46).map((page,index)=>page))) {
    const line=item.text, realPage=item.page+18;
    if (PREFIX[line]) {category=PREFIX[line];pending=null;continue}
    const heading=line.match(/^(\d+)\.\s*(Describe\b.*)$/);
    if (heading) {
      pending={id:`P2-${category}${String(heading[1]).padStart(2,'0')}`,
               section:'part2',category,season:'2026-09/12',sourcePage:realPage,
               prompt:heading[2],cuePoints:[],part3GroupId:`P3-${category}${String(heading[1]).padStart(2,'0')}`};
      cue=null;group=null;mode='heading';continue;
    }
    if (line==='You should say:' && pending) {
      cue=pending;part2.push(cue);mode='cue';continue;
    }
    if (line==='Part 3' && cue) {
      group={id:cue.part3GroupId,section:'part3',linkedPart2Id:cue.id,
             category,sourcePage:realPage,questions:[]};part3.push(group);mode='part3';continue;
    }
    // Index pages list cue titles without cue points. They are ignored.
    if (mode==='heading' && pending && !line.match(/^\d+\)/)) pending.prompt+=' '+line;
    else if (mode==='cue' && cue && !line.match(/^\d+\)/)) cue.cuePoints.push(line);
    else if (mode==='part3' && group) {
      if (group.id==='P3-PE13' && /^5\)\s*research\?$/i.test(line)) {
        group.questions[group.questions.length-1]+=' research?';continue;
      }
      const q=line.match(/^\d+\)\s*(.+)$/);
      if(q)group.questions.push(q[1]);
      else if(group.questions.length)group.questions[group.questions.length-1]+=' '+line;
    }
  }
  const counts={part1Topics:part1.length,part1Questions:part1.reduce((n,t)=>n+t.questions.length,0),
                part2Cards:part2.length,part3Groups:part3.length,
                part3Questions:part3.reduce((n,g)=>n+g.questions.length,0)};
  const wanted={part1Topics:43,part1Questions:247,part2Cards:46,part3Groups:46,part3Questions:233};
  if(Object.keys(wanted).some(key=>counts[key]!==wanted[key]) ||
     part2.some(card=>!part3.some(group=>group.id===card.part3GroupId)) ||
     part1.some(topic=>!topic.questions.length) || part2.some(card=>!card.cuePoints.length))
    throw new Error(`PDF 解析数量不匹配：${JSON.stringify(counts)}；未保存任何题目，请改用原版 PDF 或导出文字`);
  return {season:'2026-09/12',sourceType:'private-local',licenseClass:'copyright-risk',
          availability:'local-only',counts,part1,part2,part3};
}
