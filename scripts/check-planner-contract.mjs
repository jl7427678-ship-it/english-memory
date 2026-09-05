import { readFile } from 'node:fs/promises';

const ROOT=new URL('../',import.meta.url),read=path=>readFile(new URL(path,ROOT),'utf8');
const [app1,app2,app5,app8,ui]=await Promise.all(['app-1.js','app-2.js','app-5.js','app-8.js','ui.html'].map(read));
function assert(condition,message){if(!condition)throw new Error(message)}

assert(app1.includes('maxDailyReviews:100')&&app1.includes('taskStatus:{}'), 'Planner defaults are incomplete');
assert(app2.includes('days=[0,1,3,7,14,30]')&&app2.includes('reviewStep'), 'Story review schedule is not backward-compatible Day 0/1/3/7/14/30');
assert(app8.includes('REVIEW_DAYS=[0,1,3,7,14,30]'), 'Planner review cadence is incorrect');
assert(app8.indexOf("id:'review-'" )<app8.indexOf('state.planner.schedules.filter'), 'Review must be generated before new-content schedules');
assert(app8.includes('schedule.weekdays.includes(weekday)'), 'Weekday filtering is missing');
assert(app8.includes('project.examDate')&&app8.includes('projectCountdown'), 'Exam countdown is missing');
assert(app5.includes("typeof generatedTodayTasks==='function'?generatedTodayTasks()"), 'Today does not consume generated plan tasks');
for(const id of ['planProject','planTitle','planMode','planAmount','planUnit','maxDailyReviews','examDateList','scheduleList'])assert(ui.includes(`id="${id}"`),`Missing planner control ${id}`);

console.log('Validated exam countdowns, weekly quantity/time plans, review priority, and Day 0/1/3/7/14/30 cadence.');
