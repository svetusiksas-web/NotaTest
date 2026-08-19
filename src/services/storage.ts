import type {Attempt,QuizTest} from '../types';
const TK='notatest.tests.v1',AK='notatest.attempts.v1';
const memory=new Map<string,string>();
const read=<T>(k:string,f:T):T=>{try{return JSON.parse(localStorage.getItem(k)??memory.get(k)??'') as T}catch{try{return JSON.parse(memory.get(k)??'') as T}catch{return f}}};
const write=(k:string,v:unknown)=>{const value=JSON.stringify(v);memory.set(k,value);try{localStorage.setItem(k,value)}catch{/* file:// may block persistent storage; the app still works in memory */}};
export const testService={all:()=>read<QuizTest[]>(TK,[]),get:(idOrSlug:string)=>read<QuizTest[]>(TK,[]).find(t=>t.id===idOrSlug||t.slug===idOrSlug),save:(test:QuizTest)=>{const a=read<QuizTest[]>(TK,[]);const i=a.findIndex(t=>t.id===test.id);i<0?a.unshift(test):a.splice(i,1,test);write(TK,a);return test},remove:(id:string)=>write(TK,read<QuizTest[]>(TK,[]).filter(t=>t.id!==id))};
export const resultService={all:()=>read<Attempt[]>(AK,[]),save:(a:Attempt)=>write(AK,[a,...read<Attempt[]>(AK,[])])};
export const telegramService={notifyNewAttempt:async()=>({ok:false,reason:'Telegram backend is not configured'})};
