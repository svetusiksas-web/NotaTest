import type {Attempt,QuizTest} from '../types';
import {collection,deleteDoc,doc,getDocs,query,setDoc,where} from 'firebase/firestore';
import {auth,db,waitForUser} from './firebase';
import {shortCode} from '../lib/id';
const TK='notatest.tests.v1',AK='notatest.attempts.v1';
const memory=new Map<string,string>();
const firestoreData=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const read=<T>(k:string,f:T):T=>{try{return JSON.parse(localStorage.getItem(k)??memory.get(k)??'') as T}catch{try{return JSON.parse(memory.get(k)??'') as T}catch{return f}}};
const write=(k:string,v:unknown)=>{const value=JSON.stringify(v);memory.set(k,value);try{localStorage.setItem(k,value)}catch{/* file:// may block persistent storage; the app still works in memory */}};
const cloudSaveTest=async(test:QuizTest)=>{const user=auth.currentUser;if(!user||user.isAnonymous)return;await setDoc(doc(db,'tests',test.id),firestoreData({...test,ownerId:user.uid}))};
export const testService={all:()=>read<QuizTest[]>(TK,[]),get:(idOrSlug:string)=>read<QuizTest[]>(TK,[]).find(t=>t.id===idOrSlug||t.slug===idOrSlug),save:(test:QuizTest)=>{const user=auth.currentUser;const a=read<QuizTest[]>(TK,[]);const requestedSlug=test.slug||shortCode(test.id);const slug=a.some(t=>t.id!==test.id&&t.slug===requestedSlug)?shortCode(test.id):requestedSlug;const next={...test,slug,...user&&!user.isAnonymous?{ownerId:user.uid}:{}};const i=a.findIndex(t=>t.id===next.id);i<0?a.unshift(next):a.splice(i,1,next);write(TK,a);void cloudSaveTest(next);return next},remove:(id:string)=>{write(TK,read<QuizTest[]>(TK,[]).filter(t=>t.id!==id));if(auth.currentUser&&!auth.currentUser.isAnonymous)void deleteDoc(doc(db,'tests',id))}};
export const resultService={all:()=>read<Attempt[]>(AK,[]),save:async(a:Attempt)=>{await waitForUser();const test=testService.get(a.testId);if(!test?.ownerId)throw new Error('У теста не указан преподаватель. Его нужно повторно опубликовать из кабинета.');const next={...a,ownerId:test.ownerId};await setDoc(doc(db,'attempts',a.id),firestoreData(next));write(AK,[next,...read<Attempt[]>(AK,[]).filter(item=>item.id!==next.id)]);return next}};
export async function refreshResults(){const user=await waitForUser();if(user.isAnonymous){write(AK,[]);return[]}const attempts=(await getDocs(query(collection(db,'attempts'),where('ownerId','==',user.uid)))).docs.map(item=>item.data() as Attempt).sort((a,b)=>b.completedAt.localeCompare(a.completedAt));write(AK,attempts);return attempts}
export async function initializeCloud(){try{const user=await waitForUser();const testsQuery=user.isAnonymous?query(collection(db,'tests'),where('status','==','published')):query(collection(db,'tests'),where('ownerId','==',user.uid));const cloudTests=(await getDocs(testsQuery)).docs.map(item=>item.data() as QuizTest);if(user.isAnonymous){write(TK,cloudTests);return}const localOrphans=testService.all().filter(test=>!test.ownerId);const migrated=await Promise.all(localOrphans.map(async test=>{const owned={...test,ownerId:user.uid};await setDoc(doc(db,'tests',owned.id),firestoreData(owned));return owned}));const tests=[...cloudTests,...migrated].filter((test,index,all)=>all.findIndex(item=>item.id===test.id)===index);const seen=new Set<string>();const uniqueTests=await Promise.all(tests.map(async test=>{const slug=!test.slug||seen.has(test.slug)?shortCode(test.id):test.slug;seen.add(slug);if(slug!==test.slug){const repaired={...test,slug};await setDoc(doc(db,'tests',repaired.id),firestoreData(repaired));return repaired}return test}));if(uniqueTests.length)write(TK,uniqueTests);await refreshResults()}catch(error){console.warn('Firebase недоступен, используется локальное хранилище',error)}}
export const telegramService={
  notifyNewAttempt:async(attempt:Attempt,test:QuizTest)=>{
    try{
      const response=await fetch(
        'https://bot-1787302223-1403-svetlana-korovchenko.bothost.tech/result',
        {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            firstName:attempt.student.firstName,
            lastName:attempt.student.lastName,
            group:attempt.student.group,
            testName:test.title,
            score:attempt.score,
            maxScore:attempt.maxScore,
            percent:attempt.percentage,
            grade:attempt.grade,
            completedAt:attempt.completedAt,
            attemptId:attempt.id,
            testId:attempt.testId
          })
        }
      );

      if(!response.ok){
        throw new Error(`Telegram HTTP ${response.status}`);
      }

      return await response.json();
    }catch(error){
      console.warn('Не удалось отправить уведомление в Telegram',error);
      return {ok:false,reason:String(error)};
    }
  }
};
