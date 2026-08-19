import type {Answer,Attempt,Question,QuizTest,Student} from '../types';
const norm=(v:string)=>v.trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
export function scoreQuestion(q:Question,a:Answer|undefined){
  if(a===undefined)return 0;
  if(q.type==='single')return q.options?.find(o=>o.id===a&&o.isCorrect)?q.points:0;
  if(q.type==='multiple'){const selected=[...(a as string[])].sort();const correct=(q.options??[]).filter(o=>o.isCorrect).map(o=>o.id).sort();return JSON.stringify(selected)===JSON.stringify(correct)?q.points:0}
  if(q.type==='short')return q.acceptedAnswers?.some(v=>norm(v)===norm(a as string))?q.points:0;
  if(q.type==='ordering')return JSON.stringify(a)===JSON.stringify(q.items)?q.points:0;
  return q.pairs?.every(p=>(a as Record<string,string>)[p.left]===p.right)?q.points:0;
}
export function scoreTest(test:QuizTest,student:Student,answers:Record<string,Answer>):Attempt{const maxScore=test.questions.reduce((n,q)=>n+q.points,0);const score=test.questions.reduce((n,q)=>n+scoreQuestion(q,answers[q.id]),0);const percentage=maxScore?Math.round(score/maxScore*100):0;const grade=percentage>=90?5:percentage>=75?4:percentage>=50?3:2;return{id:crypto.randomUUID(),testId:test.id,student,answers,score,maxScore,percentage,grade,completedAt:new Date().toISOString()}}
