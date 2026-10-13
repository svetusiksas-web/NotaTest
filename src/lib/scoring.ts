import type {Answer,Attempt,Question,QuizTest,Student} from '../types';
const norm=(v:string)=>v.trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');
export function scoreQuestion(q:Question,a:Answer|undefined){
  if(a===undefined)return 0;
  if(q.type==='single')return q.options?.find(o=>o.id===a&&o.isCorrect)?1:0;
  if(q.type==='multiple'){if(!Array.isArray(a))return 0;const selected=[...new Set(a)].sort();const correct=(q.options??[]).filter(o=>o.isCorrect).map(o=>o.id).sort();return correct.length>0&&selected.length===correct.length&&selected.every((id,index)=>id===correct[index])?1:0}
  if(q.type==='short')return q.acceptedAnswers?.some(v=>norm(v)===norm(a as string))?1:0;
  if(q.type==='ordering')return JSON.stringify(a)===JSON.stringify(q.items)?1:0;
  return q.pairs?.every(p=>{const answer=a as Record<string,string>;return answer[p.id]===p.id||answer[p.left]===p.right})?1:0;
}
export const gradeFromPercentage=(percentage:number)=>Math.round(Math.max(0,Math.min(100,percentage))/10);
export function scoreTest(test:QuizTest,student:Student,answers:Record<string,Answer>):Attempt{const maxScore=test.questions.length;const score=test.questions.reduce((n,q)=>n+scoreQuestion(q,answers[q.id]),0);const percentage=maxScore?Math.round(score/maxScore*100):0;const grade=gradeFromPercentage(percentage);return{id:crypto.randomUUID(),testId:test.id,student,answers,score,maxScore,percentage,grade,completedAt:new Date().toISOString()}}
