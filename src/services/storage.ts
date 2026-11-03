import type {Attempt,QuizTest} from '../types';
import {collection,deleteDoc,doc,getDocs,query,setDoc,where} from 'firebase/firestore';
import {auth,db,getUserProfile,isAdminUser,waitForUser} from './firebase';
import {shortCode} from '../lib/id';
const TK='notatest.tests.v1',AK='notatest.attempts.v1';
const memory=new Map<string,string>();
const firestoreData=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const withUnitPoints=(test:QuizTest):QuizTest=>({...test,questions:test.questions.map(question=>({...question,points:1}))});
const read=<T>(k:string,f:T):T=>{try{return JSON.parse(localStorage.getItem(k)??memory.get(k)??'') as T}catch{try{return JSON.parse(memory.get(k)??'') as T}catch{return f}}};
const write=(k:string,v:unknown)=>{const value=JSON.stringify(v);memory.set(k,value);try{localStorage.setItem(k,value)}catch{/* file:// may block persistent storage; the app still works in memory */}};
const scope=()=>auth.currentUser&&!auth.currentUser.isAnonymous?auth.currentUser.uid:'guest';
const scoped=(key:string)=>`${key}.${scope()}`;
const readTests=()=>read<QuizTest[]>(scoped(TK),[]);
const writeTests=(tests:QuizTest[])=>write(scoped(TK),tests);
const readAttempts=()=>read<Attempt[]>(scoped(AK),[]);
const writeAttempts=(attempts:Attempt[])=>write(scoped(AK),attempts);
const cloudSaveTest=async(test:QuizTest)=>{const user=auth.currentUser;if(!user||user.isAnonymous)return;await setDoc(doc(db,'tests',test.id),firestoreData({...test,ownerId:test.ownerId??user.uid}))};
const saveLocal=(test:QuizTest)=>{const user=auth.currentUser;const a=readTests();const normalized=withUnitPoints(test);const requestedSlug=normalized.slug||shortCode(normalized.id);const slug=a.some(t=>t.id!==normalized.id&&t.slug===requestedSlug)?shortCode(normalized.id):requestedSlug;const next={...normalized,slug,...normalized.ownerId?{ownerId:normalized.ownerId}:user&&!user.isAnonymous?{ownerId:user.uid}:{}};const i=a.findIndex(t=>t.id===next.id);i<0?a.unshift(next):a.splice(i,1,next);writeTests(a);return next};
export const testService={all:()=>readTests().map(withUnitPoints),get:(idOrSlug:string)=>{const test=readTests().find(t=>t.id===idOrSlug||t.slug===idOrSlug);return test?withUnitPoints(test):undefined},save:(test:QuizTest)=>{const next=saveLocal(test);void cloudSaveTest(next).catch(error=>console.warn('Не удалось сохранить тест в облаке',error));return next},publish:async(test:QuizTest)=>{const user=await waitForUser();if(user.isAnonymous)throw new Error('AUTH_REQUIRED');const next=saveLocal({...test,status:'published',ownerId:test.ownerId??user.uid});await setDoc(doc(db,'tests',next.id),firestoreData(next));return next},remove:(id:string)=>{writeTests(readTests().filter(t=>t.id!==id));if(auth.currentUser&&!auth.currentUser.isAnonymous)void deleteDoc(doc(db,'tests',id))}};
export const resultService={all:()=>readAttempts(),save:async(a:Attempt)=>{await waitForUser();const test=testService.get(a.testId);if(!test?.ownerId)throw new Error('У теста не указан преподаватель. Его нужно повторно опубликовать из кабинета.');const next={...a,ownerId:test.ownerId,testTitle:test.title};await setDoc(doc(db,'attempts',a.id),firestoreData(next));writeAttempts([next,...readAttempts().filter(item=>item.id!==next.id)]);return next}};
export async function refreshResults(){const user=await waitForUser();if(user.isAnonymous){writeAttempts([]);return[]}const source=isAdminUser(user)?collection(db,'attempts'):query(collection(db,'attempts'),where('ownerId','==',user.uid));const attempts=(await getDocs(source)).docs.map(item=>item.data() as Attempt).sort((a,b)=>b.completedAt.localeCompare(a.completedAt));writeAttempts(attempts);return attempts}
export async function getProfileNames(){const user=await waitForUser();if(!isAdminUser(user))return{};const profiles=await getDocs(collection(db,'profiles'));return Object.fromEntries(profiles.docs.map(item=>[item.id,String(item.data().displayName||item.data().email||item.id)])) as Record<string,string>}
export async function initializeCloud(){try{const user=await waitForUser();if(!user.isAnonymous&&!isAdminUser(user)){const profile=await getUserProfile(user);if(profile?.role!=='teacher'||profile.status!=='active'){writeTests([]);writeAttempts([]);return}}if(isAdminUser(user)&&!readTests().length){const legacy=read<QuizTest[]>(TK,[]);if(legacy.length)writeTests(legacy)}const testsQuery=user.isAnonymous?query(collection(db,'tests'),where('status','==','published')):isAdminUser(user)?collection(db,'tests'):query(collection(db,'tests'),where('ownerId','==',user.uid));const cloudTests=(await getDocs(testsQuery)).docs.map(item=>item.data() as QuizTest);if(user.isAnonymous){writeTests(cloudTests);writeAttempts([]);return}const localOrphans=isAdminUser(user)?testService.all().filter(test=>!test.ownerId):[];const migrated=await Promise.all(localOrphans.map(async test=>{const owned={...test,ownerId:user.uid};await setDoc(doc(db,'tests',owned.id),firestoreData(owned));return owned}));const tests=[...cloudTests,...migrated].filter((test,index,all)=>all.findIndex(item=>item.id===test.id)===index);const seen=new Set<string>();const uniqueTests=await Promise.all(tests.map(async test=>{const slug=!test.slug||seen.has(test.slug)?shortCode(test.id):test.slug;seen.add(slug);if(slug!==test.slug){const repaired={...test,slug};await setDoc(doc(db,'tests',repaired.id),firestoreData(repaired));return repaired}return test}));writeTests(uniqueTests);await refreshResults()}catch(error){console.warn('Firebase недоступен, используется локальное хранилище',error)}}
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
