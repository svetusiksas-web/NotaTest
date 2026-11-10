import type {Answer,Attempt,Question,QuizTest,Student} from '../types';
const norm=(v:string)=>v.trim().replace(/\s+/g,' ').toLocaleLowerCase('ru').replace(/і/g,'и');
export function scoreQuestion(q:Question,a:Answer|undefined){
  if(a===undefined)return 0;
  if(q.type==='single')return q.options?.find(o=>o.id===a&&o.isCorrect)?1:0;
  if(q.type==='multiple'){if(!Array.isArray(a))return 0;const selected=[...new Set(a)].sort();const correct=(q.options??[]).filter(o=>o.isCorrect).map(o=>o.id).sort();return correct.length>0&&selected.length===correct.length&&selected.every((id,index)=>id===correct[index])?1:0}
  if(q.type==='short')return q.acceptedAnswers?.some(v=>norm(v)===norm(a as string))?1:0;
  if(q.type==='ordering'){if(!Array.isArray(a))return 0;return (q.items??[]).reduce((score,item,index)=>score+(a[index]===item?1:0),0)}
  if(q.type==='sorting'){const answer=a as Record<string,string>;return (q.sortItems??[]).reduce((score,item)=>score+(answer[item.id]===item.categoryId?1:0),0)}
  if(q.type==='gaps'){const answer=a as Record<string,string>;return (q.gaps?.length??0)>0&&q.gaps!.every(gap=>gap.acceptedAnswers.some(value=>norm(value)===norm(answer[gap.id]??'')))?1:0}
  const answer=a as Record<string,string>;
  return (q.pairs??[]).reduce((score,p)=>{const correct=q.matchingAnswerMap?(answer[p.id]===q.matchingAnswerMap[p.id]||answer[p.id]===p.id):(answer[p.id]===p.id||answer[p.left]===p.right);return score+(correct?1:0)},0);
}
export const questionMaxScore=(q:Question)=>q.type==='matching'?q.pairs?.length??0:q.type==='ordering'?q.items?.length??0:q.type==='sorting'?q.sortItems?.length??0:1;
export const gradeFromPercentage=(percentage:number)=>Math.round(Math.max(0,Math.min(100,percentage))/10);
export function scoreTest(test:QuizTest,student:Student,answers:Record<string,Answer>):Attempt{const maxScore=test.questions.reduce((total,q)=>total+questionMaxScore(q),0);const score=test.questions.reduce((n,q)=>n+scoreQuestion(q,answers[q.id]),0);const percentage=maxScore?Math.round(score/maxScore*100):0;const grade=gradeFromPercentage(percentage);return{id:crypto.randomUUID(),testId:test.id,student,answers,score,maxScore,percentage,grade,completedAt:new Date().toISOString()}}
