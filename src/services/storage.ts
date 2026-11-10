import type {Attempt,MediaRef,QuizTest} from '../types';
import {collection,deleteDoc,doc,documentId,getDoc,getDocs,limit,orderBy,query,setDoc,startAfter,where,type DocumentData,type QueryDocumentSnapshot} from 'firebase/firestore';
import {auth,db,getUserProfile,isAdminUser,waitForUser} from './firebase';
import {shortCode} from '../lib/id';
const TK='notatest.tests.v1',AK='notatest.attempts.v1';
const memory=new Map<string,string>();
const API_BASE_URL=String(import.meta.env.VITE_API_BASE_URL??'').replace(/\/$/,'');
async function apiCall<T>(path:string,data:unknown):Promise<T>{const user=await waitForUser();if(!API_BASE_URL)throw new Error('API_NOT_CONFIGURED');const token=await user.getIdToken();const response=await fetch(`${API_BASE_URL}/api/${path}`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify(data)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error??`API HTTP ${response.status}`);return body as T}
export type StorageSettings={imageMaxMb:number;audioMaxMb:number;wavMaxMb:number;warningPercent:number;criticalPercent:number};
export type StorageOwnerStats={ownerId:string;name:string;images:number;imageBytes:number;audio:number;audioBytes:number;totalFiles:number;totalBytes:number};
export type StorageStats={provider:string;source:string;capacityBytes:number;usedBytes:number;freeBytes:number;percent:number;files:number;images:number;imageBytes:number;audio:number;audioBytes:number;other:number;otherBytes:number;reservedBytes:number;pendingUploads:number;owners:StorageOwnerStats[];updatedAt:string;limitations:string};
let uploadSettingsCache:StorageSettings|undefined;
export async function getUploadSettings(){if(uploadSettingsCache)return uploadSettingsCache;const result=await apiCall<{settings:StorageSettings}>('upload-settings',{});uploadSettingsCache=result.settings;return result.settings}
export const storageAdminService={get:()=>apiCall<{stats:StorageStats|null;settings:StorageSettings}>('storage-admin',{action:'get'}),refresh:()=>apiCall<{stats:StorageStats;settings:StorageSettings}>('storage-admin',{action:'refresh'}),saveSettings:async(settings:StorageSettings)=>{const result=await apiCall<{stats:StorageStats|null;settings:StorageSettings}>('storage-admin',{action:'settings',settings});uploadSettingsCache=result.settings;return result}};
export async function uploadMedia(file:File,kind:'image'|'audio'){const init=await apiCall<{media:MediaRef;uploadUrl:string}>('media-upload-url',{name:file.name,contentType:file.type,size:file.size,kind});const response=await fetch(init.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type},body:file});if(!response.ok)throw new Error(`S3 upload HTTP ${response.status}`);return apiCall<{media:MediaRef;url:string}>('media-complete',{mediaId:init.media.mediaId})}
async function hydrateMedia<T>(value:T,context:{testId?:string;slug?:string}):Promise<T>{const copy=JSON.parse(JSON.stringify(value));const refs:MediaRef[]=[];const visit=(node:unknown)=>{if(!node||typeof node!=='object')return;for(const [key,item] of Object.entries(node as Record<string,unknown>)){if(key.endsWith('Media')&&item&&typeof item==='object'&&'mediaId'in item)refs.push(item as MediaRef);else visit(item)}};visit(copy);if(!refs.length)return copy;const resolved=await apiCall<{urls:Record<string,string>}>('media-urls',{mediaIds:[...new Set(refs.map(ref=>ref.mediaId))],...context});const apply=(node:unknown)=>{if(!node||typeof node!=='object')return;for(const [key,item] of Object.entries(node as Record<string,unknown>)){if(key.endsWith('Media')&&item&&typeof item==='object'&&'mediaId'in item){const ref=item as MediaRef;(node as Record<string,unknown>)[`${key.slice(0,-5)}Url`]=resolved.urls[ref.mediaId]}else apply(item)}};apply(copy);return copy}
export const hydrateEditorTest=(test:QuizTest)=>hydrateMedia(test,{testId:test.id});
const firestoreData=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const withUnitPoints=(test:QuizTest):QuizTest=>({...test,questions:test.questions.map(question=>({...question,points:question.type==='matching'?question.pairs?.length??0:question.type==='ordering'?question.items?.length??0:question.type==='sorting'?question.sortItems?.length??0:1}))});
const read=<T>(k:string,f:T):T=>{try{return JSON.parse(localStorage.getItem(k)??memory.get(k)??'') as T}catch{try{return JSON.parse(memory.get(k)??'') as T}catch{return f}}};
const write=(k:string,v:unknown)=>{const value=JSON.stringify(v);memory.set(k,value);try{localStorage.setItem(k,value)}catch{/* file:// may block persistent storage; the app still works in memory */}};
const scope=()=>auth.currentUser&&!auth.currentUser.isAnonymous?auth.currentUser.uid:'guest';
const scoped=(key:string)=>`${key}.${scope()}`;
const readTests=()=>read<QuizTest[]>(scoped(TK),[]);
const writeTests=(tests:QuizTest[])=>write(scoped(TK),tests);
const readAttempts=()=>read<Attempt[]>(scoped(AK),[]);
const writeAttempts=(attempts:Attempt[])=>write(scoped(AK),attempts);
type CatalogEntry={testId:string;slug:string;title:string;subject?:string;grade?:string;topic?:string;description?:string;ownerId?:string;authorName?:string;questionCount?:number;updatedAt?:string};
const catalogTest=(entry:CatalogEntry):QuizTest=>({id:entry.testId,slug:entry.slug,title:entry.title,subject:entry.subject??'',grade:entry.grade??'',topic:entry.topic??'',description:entry.description??'',instructions:'',status:'published',questions:Array.from({length:entry.questionCount??0},()=>({} as QuizTest['questions'][number])),questionCount:entry.questionCount??0,createdAt:entry.updatedAt??'',updatedAt:entry.updatedAt??'',...(entry.ownerId?{ownerId:entry.ownerId}:{}),...(entry.authorName?{authorName:entry.authorName}:{})});
const cloudSaveTest=async(test:QuizTest)=>{const user=auth.currentUser;if(!user||user.isAnonymous)return;const response=await apiCall<{test:QuizTest}>('media-normalize',{test:{...test,ownerId:test.ownerId??user.uid}});await setDoc(doc(db,'tests',test.id),firestoreData(response.test))};
const saveLocal=(test:QuizTest)=>{const user=auth.currentUser;const a=readTests();const normalized=withUnitPoints(test);const requestedSlug=normalized.slug||shortCode(normalized.id);const slug=a.some(t=>t.id!==normalized.id&&t.slug===requestedSlug)?shortCode(normalized.id):requestedSlug;const next={...normalized,slug,...normalized.ownerId?{ownerId:normalized.ownerId}:user&&!user.isAnonymous?{ownerId:user.uid}:{}};const i=a.findIndex(t=>t.id===next.id);i<0?a.unshift(next):a.splice(i,1,next);writeTests(a);return next};
export const testService={all:()=>readTests().map(withUnitPoints),get:(idOrSlug:string)=>{const test=readTests().find(t=>t.id===idOrSlug||t.slug===idOrSlug);return test?withUnitPoints(test):undefined},save:(test:QuizTest)=>{const next=saveLocal(test);void cloudSaveTest(next).catch(error=>console.warn('Не удалось сохранить тест в облаке',error));return next},publish:async(test:QuizTest)=>{const user=await waitForUser();if(user.isAnonymous)throw new Error('AUTH_REQUIRED');const candidate:QuizTest={...test,status:'published',ownerId:test.ownerId??user.uid};const response=await apiCall<{test:QuizTest}>('publish-test',{test:candidate});return saveLocal(await hydrateMedia(response.test,{testId:response.test.id}))},remove:(id:string)=>{writeTests(readTests().filter(t=>t.id!==id));if(auth.currentUser&&!auth.currentUser.isAnonymous)void deleteDoc(doc(db,'tests',id))}};
export async function loadPublicTest(slug:string){const snapshot=await getDoc(doc(db,'publicTests',slug));if(snapshot.exists())return withUnitPoints(await hydrateMedia(snapshot.data() as QuizTest,{slug}));try{const legacy=await getDocs(query(collection(db,'tests'),where('slug','==',slug)));return legacy.empty?undefined:withUnitPoints(legacy.docs[0].data() as QuizTest)}catch{return undefined}}
export async function submitAttempt(test:QuizTest,student:Attempt['student'],answers:Attempt['answers']){const response=await apiCall<{attempt:Attempt;reviewTest:QuizTest}>('submit-attempt',{testId:test.id,student,answers});const next=response.attempt;writeAttempts([next,...readAttempts().filter(item=>item.id!==next.id)]);return{...response,reviewTest:await hydrateMedia(response.reviewTest,{slug:test.slug})}}
export const migratePublishedTests=()=>apiCall<{scanned:number;migrated:number}>('migrate-published-tests',{});
export type TelegramConnection={connected:boolean;username?:string;firstName?:string;connectedAt?:string};
export const teacherTelegramService={
  status:()=>apiCall<TelegramConnection>('teacher-telegram',{action:'status'}),
  connect:()=>apiCall<{url:string;expiresAt:number}>('teacher-telegram',{action:'connect'}),
  disconnect:()=>apiCall<TelegramConnection>('teacher-telegram',{action:'disconnect'}),
  test:()=>apiCall<{ok:boolean}>('teacher-telegram',{action:'test'})
};
export const resultService={all:()=>readAttempts(),save:async(a:Attempt)=>{await waitForUser();const test=testService.get(a.testId);if(!test?.ownerId)throw new Error('У теста не указан преподаватель. Его нужно повторно опубликовать из кабинета.');const next={...a,ownerId:test.ownerId,testTitle:test.title};await setDoc(doc(db,'attempts',a.id),firestoreData(next));writeAttempts([next,...readAttempts().filter(item=>item.id!==next.id)]);return next}};
const RESULTS_PAGE_SIZE=50;let resultsCursor:QueryDocumentSnapshot<DocumentData>|undefined;
export async function loadResultsPage(reset=true){const user=await waitForUser();if(user.isAnonymous){writeAttempts([]);resultsCursor=undefined;return{items:[] as Attempt[],hasMore:false}}const base=isAdminUser(user)?[collection(db,'attempts'),orderBy('completedAt','desc'),orderBy(documentId(),'desc')]:[collection(db,'attempts'),where('ownerId','==',user.uid),orderBy('completedAt','desc'),orderBy(documentId(),'desc')];const constraints=[...base.slice(1),...(reset||!resultsCursor?[]:[startAfter(resultsCursor)]),limit(RESULTS_PAGE_SIZE)] as Parameters<typeof query>[1][];const snapshot=await getDocs(query(base[0] as ReturnType<typeof collection>,...constraints));resultsCursor=snapshot.docs[snapshot.docs.length-1];const page=snapshot.docs.map(item=>item.data() as Attempt);const items=reset?page:[...readAttempts(),...page].filter((item,index,all)=>all.findIndex(value=>value.id===item.id)===index);writeAttempts(items);return{items,hasMore:snapshot.size===RESULTS_PAGE_SIZE}}
export async function refreshResults(){return(await loadResultsPage(true)).items}
export async function deleteAttempts(attemptIds:string[]){const ids=[...new Set(attemptIds)];if(!ids.length)return;for(let index=0;index<ids.length;index+=100)await apiCall<{deleted:number}>('delete-attempts',{attemptIds:ids.slice(index,index+100)});writeAttempts(readAttempts().filter(item=>!ids.includes(item.id)))}
export async function getProfileNames(){const user=await waitForUser();if(!isAdminUser(user))return{};const profiles=await getDocs(collection(db,'profiles'));return Object.fromEntries(profiles.docs.map(item=>[item.id,String(item.data().displayName||item.data().email||item.id)])) as Record<string,string>}
export async function initializeCloud(){try{const user=await waitForUser();if(!user.isAnonymous&&!isAdminUser(user)){const profile=await getUserProfile(user);if(profile?.role!=='teacher'||profile.status!=='active'){writeTests([]);writeAttempts([]);return}}if(isAdminUser(user)&&!readTests().length){const legacy=read<QuizTest[]>(TK,[]);if(legacy.length)writeTests(legacy)}if(user.isAnonymous){const catalog=(await getDocs(collection(db,'testCatalog'))).docs.map(item=>catalogTest(item.data() as CatalogEntry)).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));writeTests(catalog);writeAttempts([]);return}const testsQuery=isAdminUser(user)?collection(db,'tests'):query(collection(db,'tests'),where('ownerId','==',user.uid));const cloudTests=(await getDocs(testsQuery)).docs.map(item=>item.data() as QuizTest);const localOrphans=isAdminUser(user)?testService.all().filter(test=>!test.ownerId):[];const migrated=await Promise.all(localOrphans.map(async test=>{const owned={...test,ownerId:user.uid};await setDoc(doc(db,'tests',owned.id),firestoreData(owned));return owned}));const tests=[...cloudTests,...migrated].filter((test,index,all)=>all.findIndex(item=>item.id===test.id)===index);const seen=new Set<string>();const uniqueTests=await Promise.all(tests.map(async test=>{const slug=!test.slug||seen.has(test.slug)?shortCode(test.id):test.slug;seen.add(slug);if(slug!==test.slug){const repaired={...test,slug};await setDoc(doc(db,'tests',repaired.id),firestoreData(repaired));return repaired}return test}));writeTests(uniqueTests);await refreshResults()}catch(error){console.warn('Firebase недоступен, используется локальное хранилище',error)}}
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
