const{cert,getApps,initializeApp}=require('firebase-admin/app');
const{getAuth}=require('firebase-admin/auth');
const{FieldValue,getFirestore}=require('firebase-admin/firestore');
const{createHash,randomUUID}=require('node:crypto');
const s3=require('./s3.cjs');

const ADMIN_EMAIL='svetusiksas@gmail.com';
const clean=value=>JSON.parse(JSON.stringify(value));
const shuffle=values=>{const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result};
const norm=value=>String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru').replace(/і/g,'и');

function app(){
  if(getApps().length)return getApps()[0];
  let serviceAccount={};
  if(process.env.FIREBASE_SERVICE_ACCOUNT_JSON){try{serviceAccount=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)}catch{throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON_INVALID')}}
  const projectId=serviceAccount.project_id??process.env.FIREBASE_PROJECT_ID;
  const clientEmail=serviceAccount.client_email??process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=(serviceAccount.private_key??process.env.FIREBASE_PRIVATE_KEY)?.replace(/\\n/g,'\n');
  if(!projectId||!clientEmail||!privateKey)throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
  return initializeApp({credential:cert({projectId,clientEmail,privateKey}),projectId});
}
const db=()=>getFirestore(app());
const telegramToken=()=>process.env.TELEGRAM_TEACHER_BOT_TOKEN;
const telegramSecret=()=>{const token=telegramToken();return token?createHash('sha256').update(token).digest('hex'):''};
const telegramApi=async(method,payload)=>{const token=telegramToken();if(!token)throw new Error('TELEGRAM_TEACHER_BOT_NOT_CONFIGURED');const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const body=await response.json().catch(()=>({}));if(!response.ok||!body.ok)throw new Error(body.description??`TELEGRAM_HTTP_${response.status}`);return body.result};
const escapeHtml=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const IMAGE_TYPES=new Set(['image/jpeg','image/png','image/webp']);
const AUDIO_TYPES=new Set(['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','audio/ogg']);
const safeName=value=>String(value??'file').normalize('NFKC').replace(/[^\p{L}\p{N}._-]+/gu,'-').slice(0,100)||'file';
const containsMedia=(value,id)=>JSON.stringify(value).includes(`\"mediaId\":\"${id}\"`);
function detectedType(buffer){const ascii=buffer.toString('ascii');if(buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return'image/jpeg';if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WEBP')return'image/webp';if(ascii.startsWith('RIFF')&&ascii.slice(8,12)==='WAVE')return'audio/wav';if(ascii.startsWith('OggS'))return'audio/ogg';if(ascii.startsWith('ID3')||(buffer[0]===0xff&&(buffer[1]&0xe0)===0xe0))return'audio/mpeg';if(ascii.slice(4,8)==='ftyp')return'audio/mp4';return''}
const GIB=1024**3;const MIB=1024**2;const CAPACITY_BYTES=100*GIB;
const DEFAULT_STORAGE_SETTINGS={imageMaxMb:10,audioMaxMb:50,wavMaxMb:150,warningPercent:80,criticalPercent:95};
async function storageSettings(){const snapshot=await db().doc('systemSettings/storage').get();return{...DEFAULT_STORAGE_SETTINGS,...(snapshot.exists?snapshot.data():{})}}
const limitFor=(contentType,settings)=>contentType==='audio/wav'||contentType==='audio/x-wav'?settings.wavMaxMb:IMAGE_TYPES.has(contentType)?settings.imageMaxMb:settings.audioMaxMb;
async function reserveStorage(size){await db().runTransaction(async transaction=>{const ref=db().doc('storageUsage/current');const snapshot=await transaction.get(ref);const data=snapshot.exists?snapshot.data():{};const usedBytes=Number(data.usedBytes??0),reservedBytes=Number(data.reservedBytes??0);if(usedBytes+reservedBytes+size>CAPACITY_BYTES)throw Object.assign(new Error('В хранилище недостаточно свободного места для этого файла.'),{status:507});transaction.set(ref,{usedBytes,reservedBytes:reservedBytes+size,capacityBytes:CAPACITY_BYTES,updatedAt:new Date().toISOString()},{merge:true})})}
async function confirmReservation(size){await db().runTransaction(async transaction=>{const ref=db().doc('storageUsage/current');const snapshot=await transaction.get(ref);const data=snapshot.exists?snapshot.data():{};transaction.set(ref,{usedBytes:Number(data.usedBytes??0)+size,reservedBytes:Math.max(0,Number(data.reservedBytes??0)-size),capacityBytes:CAPACITY_BYTES,updatedAt:new Date().toISOString()},{merge:true})})}

async function createMediaUpload(actor,{name,contentType,size,kind}){
  const allowed=kind==='image'?IMAGE_TYPES:AUDIO_TYPES;const settings=await storageSettings();const maxMb=limitFor(contentType,settings);
  if(!allowed.has(contentType)||!Number.isSafeInteger(size)||size<1)throw Object.assign(new Error('Недопустимый тип или размер файла.'),{status:400});
  if(size>maxMb*MIB)throw Object.assign(new Error(`Файл слишком большой. Максимальный размер для этого формата — ${maxMb} МБ.`),{status:400});
  await reserveStorage(size);
  const mediaId=randomUUID();const objectKey=`media/${actor.uid}/${mediaId}/${safeName(name)}`;const media={mediaId,objectKey,kind,name:safeName(name),contentType,size};
  await db().doc(`mediaFiles/${mediaId}`).set({...media,ownerId:actor.uid,status:'pending',createdAt:FieldValue.serverTimestamp()});
  return{media,uploadUrl:await s3.uploadUrl(objectKey,contentType)};
}
async function completeMediaUpload(actor,{mediaId}){const ref=db().doc(`mediaFiles/${mediaId}`);const snapshot=await ref.get();if(!snapshot.exists)throw Object.assign(new Error('Файл не найден.'),{status:404});const media=snapshot.data();if(!actor.admin&&media.ownerId!==actor.uid)throw Object.assign(new Error('Нет доступа к файлу.'),{status:403});const object=await s3.head(media.objectKey);const actualType=detectedType(await s3.peek(media.objectKey));const declaredMatches=media.contentType==='audio/x-wav'?actualType==='audio/wav':media.contentType==='audio/x-m4a'?actualType==='audio/mp4':actualType===media.contentType;if(Number(object.ContentLength)!==media.size||object.ContentType!==media.contentType||!declaredMatches)throw Object.assign(new Error('Параметры или фактический тип файла не совпадают.'),{status:400});await ref.update({status:'ready',verifiedAt:FieldValue.serverTimestamp()});await confirmReservation(media.size);await checkStorageAlerts().catch(error=>console.error('Storage alert check failed',error));return{media:{mediaId:media.mediaId,objectKey:media.objectKey,kind:media.kind,name:media.name,contentType:media.contentType,size:media.size},url:await s3.downloadUrl(media.objectKey)}}
async function mediaUrls(actor,{mediaIds,testId,slug}){if(!Array.isArray(mediaIds)||mediaIds.length>100)throw Object.assign(new Error('Некорректный список файлов.'),{status:400});let context;if(slug){const snapshot=await db().doc(`publicTests/${slug}`).get();if(!snapshot.exists||snapshot.data().status!=='published')throw Object.assign(new Error('Тест недоступен.'),{status:404});context=snapshot.data()}else if(testId){const snapshot=await db().doc(`tests/${testId}`).get();if(!snapshot.exists)throw Object.assign(new Error('Тест не найден.'),{status:404});context=snapshot.data();if(!actor.admin&&context.ownerId!==actor.uid)throw Object.assign(new Error('Нет доступа к тесту.'),{status:403})}else throw Object.assign(new Error('Не указан контекст доступа.'),{status:400});const urls={};for(const mediaId of [...new Set(mediaIds)]){if(!containsMedia(context,mediaId))throw Object.assign(new Error('Файл не используется в этом тесте.'),{status:403});const snapshot=await db().doc(`mediaFiles/${mediaId}`).get();if(!snapshot.exists||snapshot.data().status!=='ready')throw Object.assign(new Error('Файл недоступен.'),{status:404});urls[mediaId]=await s3.downloadUrl(snapshot.data().objectKey)}return{urls}}

const kindFromKey=key=>/\.(jpe?g|png|webp)$/i.test(key)?'image':/\.(mp3|wav|m4a|ogg)$/i.test(key)?'audio':'other';
async function checkStorageAlerts(){const[usageSnapshot,settings,stateSnapshot]=await Promise.all([db().doc('storageUsage/current').get(),storageSettings(),db().doc('systemState/storageAlerts').get()]);const usedBytes=Number(usageSnapshot.data()?.usedBytes??0),percent=usedBytes/CAPACITY_BYTES*100,previous=Number(stateSnapshot.data()?.level??0);let level=percent>=100?100:percent>=settings.criticalPercent?95:percent>=settings.warningPercent?80:0;if(previous===95&&percent>=settings.criticalPercent-2)level=Math.max(level,95);if(previous===80&&percent>=settings.warningPercent-2)level=Math.max(level,80);if(level>previous){const freeBytes=Math.max(0,CAPACITY_BYTES-usedBytes);const lead=level===100?'Хранилище HostFly S3 заполнено. Загрузка новых файлов может быть недоступна':level===95?'Внимание! Хранилище HostFly S3 заполнено на 95%. Свободное место заканчивается':'Хранилище HostFly S3 заполнено на 80%. Рекомендуется проверить свободное место';const text=`${lead}\nФактически: ${percent.toFixed(2)}% · занято ${(usedBytes/GIB).toFixed(2)} ГиБ · свободно ${(freeBytes/GIB).toFixed(2)} ГиБ`;if(process.env.TELEGRAM_ADMIN_CHAT_ID&&telegramToken())await telegramApi('sendMessage',{chat_id:process.env.TELEGRAM_ADMIN_CHAT_ID,text});await db().doc('systemState/storageAlerts').set({level,lastSentAt:new Date().toISOString(),percent},{merge:true})}else if(level<previous)await db().doc('systemState/storageAlerts').set({level,resetAt:new Date().toISOString(),percent},{merge:true});return{level,percent}}
async function refreshStorageStats(actor){const[objects,registrySnapshot,profilesSnapshot,settings]=await Promise.all([s3.listAll(''),db().collection('mediaFiles').get(),db().collection('profiles').get(),storageSettings()]);const registry=new Map(registrySnapshot.docs.map(doc=>[doc.data().objectKey,doc.data()]));const names=new Map(profilesSnapshot.docs.map(doc=>[doc.id,doc.data().displayName||doc.data().email||doc.id]));const totals={files:0,bytes:0,images:0,imageBytes:0,audio:0,audioBytes:0,other:0,otherBytes:0};const owners=new Map();for(const object of objects){if(!object.Key)continue;const size=Number(object.Size??0),record=registry.get(object.Key),kind=record?.kind??kindFromKey(object.Key),ownerId=record?.ownerId??'unknown';totals.files++;totals.bytes+=size;if(kind==='image'){totals.images++;totals.imageBytes+=size}else if(kind==='audio'){totals.audio++;totals.audioBytes+=size}else{totals.other++;totals.otherBytes+=size}const row=owners.get(ownerId)??{ownerId,name:ownerId==='unknown'?'Владелец не определён':ownerId===actor.uid?'Администратор':names.get(ownerId)??ownerId,images:0,imageBytes:0,audio:0,audioBytes:0,totalFiles:0,totalBytes:0};row.totalFiles++;row.totalBytes+=size;if(kind==='image'){row.images++;row.imageBytes+=size}else if(kind==='audio'){row.audio++;row.audioBytes+=size}owners.set(ownerId,row)}const pending=registrySnapshot.docs.map(doc=>doc.data()).filter(item=>item.status==='pending'),reservedBytes=pending.reduce((sum,item)=>sum+Number(item.size??0),0);const stats={provider:'HostFly S3',source:'S3 ListObjectsV2 + mediaFiles registry',capacityBytes:CAPACITY_BYTES,usedBytes:totals.bytes,freeBytes:Math.max(0,CAPACITY_BYTES-totals.bytes),percent:totals.bytes/CAPACITY_BYTES*100,...totals,reservedBytes,pendingUploads:pending.length,owners:[...owners.values()].sort((a,b)=>b.totalBytes-a.totalBytes),updatedAt:new Date().toISOString(),limitations:'Версии объектов и незавершённые multipart-загрузки могут занимать дополнительное место и не входят в ListObjectsV2.'};await Promise.all([db().doc('storageStats/current').set(stats),db().doc('storageUsage/current').set({usedBytes:stats.usedBytes,reservedBytes,capacityBytes:CAPACITY_BYTES,updatedAt:stats.updatedAt},{merge:true})]);await checkStorageAlerts();return{stats,settings}}
async function storageAdmin(actor,{action,settings:incoming}={}){if(action==='settings'){const next={imageMaxMb:Number(incoming?.imageMaxMb),audioMaxMb:Number(incoming?.audioMaxMb),wavMaxMb:Number(incoming?.wavMaxMb),warningPercent:Number(incoming?.warningPercent),criticalPercent:Number(incoming?.criticalPercent)};if(!Number.isFinite(next.imageMaxMb)||next.imageMaxMb<1||next.imageMaxMb>100||!Number.isFinite(next.audioMaxMb)||next.audioMaxMb<1||next.audioMaxMb>500||!Number.isFinite(next.wavMaxMb)||next.wavMaxMb<1||next.wavMaxMb>1000||next.warningPercent<1||next.criticalPercent<=next.warningPercent||next.criticalPercent>100)throw Object.assign(new Error('Проверьте значения ограничений и порогов.'),{status:400});await db().doc('systemSettings/storage').set({...next,updatedAt:new Date().toISOString(),updatedBy:actor.uid});const stats=(await db().doc('storageStats/current').get()).data()??null;return{stats,settings:next}}if(action==='refresh')return refreshStorageStats(actor);const snapshot=await db().doc('storageStats/current').get();return{stats:snapshot.exists?snapshot.data():null,settings:await storageSettings()}}
async function uploadSettings(){return{settings:await storageSettings()}}

function cors(req,res){
  const configuredOrigins=String(process.env.ALLOWED_ORIGIN??'').split(',').map(value=>value.trim()).filter(Boolean);
  const allowed=new Set([
    'https://notatest-f208b.web.app',
    'https://notatest-f208b.firebaseapp.com',
    'https://svetusiksas-web.github.io',
    ...configuredOrigins
  ]);
  const origin=req.headers.origin;
  if(origin&&allowed.has(origin))res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
  if(req.method==='OPTIONS'){res.status(204).end();return true}
  return false;
}

async function authenticate(req,{teacher=false,admin=false}={}){
  const header=String(req.headers.authorization??'');
  if(!header.startsWith('Bearer '))throw Object.assign(new Error('Требуется авторизация.'),{status:401});
  const token=await getAuth(app()).verifyIdToken(header.slice(7));
  if(!teacher&&!admin)return{uid:token.uid,token};
  const isAdmin=String(token.email??'').toLowerCase()===ADMIN_EMAIL&&token.email_verified===true;
  if(admin&&!isAdmin)throw Object.assign(new Error('Доступно только администратору.'),{status:403});
  if(isAdmin)return{uid:token.uid,admin:true,displayName:'Администратор',token};
  if(token.firebase?.sign_in_provider==='anonymous')throw Object.assign(new Error('Требуется вход преподавателя.'),{status:401});
  const profile=(await db().doc(`profiles/${token.uid}`).get()).data();
  if(profile?.role!=='teacher'||profile.status!=='active')throw Object.assign(new Error('Аккаунт преподавателя не активен.'),{status:403});
  return{uid:token.uid,admin:false,displayName:profile.displayName??profile.email??'',token};
}

function prepareQuestion(question){
  const privateQuestion=clean(question);const publicQuestion=clean(question);
  if(publicQuestion.options)publicQuestion.options=publicQuestion.options.map(({isCorrect,...option})=>option);
  delete publicQuestion.acceptedAnswers;
  if(question.type==='ordering')publicQuestion.items=shuffle(question.items??[]);
  if(question.type==='sorting')publicQuestion.sortItems=shuffle((question.sortItems??[]).map(({categoryId,...item})=>item));
  if(question.type==='gaps')publicQuestion.gaps=(question.gaps??[]).map(gap=>({id:gap.id,...question.gapMode==='select'?{choices:shuffle(gap.choices??[])}:{}}));
  if(question.type==='matching'){
    const tokens=(question.pairs??[]).map(pair=>({pair,id:question.matchingAnswerMap?.[pair.id]??randomUUID()}));
    privateQuestion.matchingAnswerMap=Object.fromEntries(tokens.map(({pair,id})=>[pair.id,id]));
    publicQuestion.pairs=(question.pairs??[]).map(pair=>({id:pair.id,left:pair.left,right:'',leftImageUrl:pair.leftImageUrl,leftImageName:pair.leftImageName,leftImageMedia:pair.leftImageMedia,leftAudioUrl:pair.leftAudioUrl,leftAudioName:pair.leftAudioName,leftAudioMedia:pair.leftAudioMedia}));
    publicQuestion.matchingOptions=shuffle(tokens.map(({pair,id})=>({id,text:pair.right,imageUrl:pair.rightImageUrl,imageName:pair.rightImageName,imageMedia:pair.rightImageMedia,audioUrl:pair.rightAudioUrl,audioName:pair.rightAudioName,audioMedia:pair.rightAudioMedia})));
  }
  return{privateQuestion,publicQuestion};
}

async function representations(test,actor){
  const prepared=test.questions.map(prepareQuestion);
  const privateTest=clean({...test,questions:prepared.map(item=>item.privateQuestion)});
  const ownerProfile=privateTest.ownerId===actor.uid&&!actor.admin?{displayName:actor.displayName}:((await db().doc(`profiles/${privateTest.ownerId}`).get()).data()??{});
  const authorName=privateTest.ownerId===actor.uid&&actor.admin?'Администратор':ownerProfile.displayName??ownerProfile.email??'Преподаватель';
  const publicTest=clean({...privateTest,authorName,questions:prepared.map(item=>item.publicQuestion)});
  const catalog={testId:privateTest.id,slug:privateTest.slug,title:privateTest.title,subject:privateTest.subject??'',grade:privateTest.grade??'',topic:privateTest.topic??'',description:privateTest.description??'',ownerId:privateTest.ownerId,authorName,questionCount:privateTest.questions.length,updatedAt:privateTest.updatedAt??new Date().toISOString()};
  return{privateTest,publicTest,catalog};
}

async function normalizeMediaReferences(value,actor){
  const copy=clean(value);const visit=async node=>{if(!node||typeof node!=='object')return;for(const[key,item]of Object.entries(node)){if(key.endsWith('Url')&&typeof item==='string'&&item.includes('X-Amz-')){const match=decodeURIComponent(item).match(/media\/[^/]+\/([0-9a-f-]{36})\//i);if(!match)continue;const snapshot=await db().doc(`mediaFiles/${match[1]}`).get();if(!snapshot.exists)throw Object.assign(new Error('Метаданные медиафайла не найдены.'),{status:400});const data=snapshot.data();if(!actor.admin&&data.ownerId!==actor.uid)throw Object.assign(new Error('Нельзя использовать чужой файл.'),{status:403});const prefix=key.slice(0,-3);node[`${prefix}Media`]={mediaId:data.mediaId,objectKey:data.objectKey,kind:data.kind,name:data.name,contentType:data.contentType,size:data.size};delete node[key]}else await visit(item)}};await visit(copy);return copy;
}
async function normalizeMediaTest(actor,{test}){if(!test?.id)throw Object.assign(new Error('Тест не указан.'),{status:400});const existing=await db().doc(`tests/${test.id}`).get();const owner=existing.exists?existing.data().ownerId:test.ownerId??actor.uid;if(!actor.admin&&owner!==actor.uid)throw Object.assign(new Error('Нельзя изменять чужой тест.'),{status:403});return{test:await normalizeMediaReferences({...test,ownerId:owner},actor)}}

async function publishTest(actor,incoming){
  if(!incoming?.id||!incoming?.slug||!incoming?.title||!Array.isArray(incoming.questions)||!incoming.questions.length)throw Object.assign(new Error('Тест заполнен не полностью.'),{status:400});
  const ref=db().doc(`tests/${incoming.id}`);const existing=await ref.get();const existingOwner=existing.exists?existing.data().ownerId:null;
  if(existingOwner&&!actor.admin&&existingOwner!==actor.uid)throw Object.assign(new Error('Нельзя публиковать чужой тест.'),{status:403});
  const test=await normalizeMediaReferences({...incoming,ownerId:existingOwner??actor.uid,status:'published',updatedAt:new Date().toISOString()},actor);
  const{privateTest,publicTest,catalog}=await representations(test,actor);const batch=db().batch();
  batch.set(ref,privateTest);batch.set(db().doc(`publicTests/${test.slug}`),publicTest);batch.set(db().doc(`testCatalog/${test.id}`),catalog);await batch.commit();
  return{test:privateTest};
}

function scoreQuestion(question,answer){
  if(answer===undefined)return 0;
  if(question.type==='single')return(question.options??[]).some(option=>option.id===answer&&option.isCorrect)?1:0;
  if(question.type==='multiple'){if(!Array.isArray(answer))return 0;const selected=[...new Set(answer)].sort();const correct=(question.options??[]).filter(option=>option.isCorrect).map(option=>option.id).sort();return correct.length>0&&selected.length===correct.length&&selected.every((id,index)=>id===correct[index])?1:0}
  if(question.type==='short')return(question.acceptedAnswers??[]).some(value=>norm(value)===norm(answer))?1:0;
  if(question.type==='ordering'){if(!Array.isArray(answer))return 0;return(question.items??[]).reduce((score,item,index)=>score+(answer[index]===item?1:0),0)}
  if(question.type==='sorting')return(question.sortItems??[]).reduce((score,item)=>score+(answer?.[item.id]===item.categoryId?1:0),0);
  if(question.type==='gaps')return(question.gaps??[]).length>0&&(question.gaps??[]).every(gap=>(gap.acceptedAnswers??[]).some(value=>norm(value)===norm(answer?.[gap.id]??'')))?1:0;
  const map=question.matchingAnswerMap??{};return(question.pairs??[]).reduce((score,pair)=>score+(answer?.[pair.id]===map[pair.id]?1:0),0);
}
const questionMaxScore=question=>question.type==='matching'?(question.pairs??[]).length:question.type==='ordering'?(question.items??[]).length:question.type==='sorting'?(question.sortItems??[]).length:1;
function isAnswered(question,answer){if(answer===undefined)return false;if(question.type==='single'||question.type==='short')return typeof answer==='string'&&answer.trim().length>0;if(question.type==='multiple')return Array.isArray(answer)&&answer.length>0;if(question.type==='matching')return(question.pairs??[]).length>0&&(question.pairs??[]).every(pair=>Boolean(answer?.[pair.id]));if(question.type==='ordering')return Array.isArray(answer)&&answer.length===(question.items??[]).length;if(question.type==='sorting')return(question.sortItems??[]).length>0&&(question.sortItems??[]).every(item=>Boolean(answer?.[item.id]));if(question.type==='gaps')return(question.gaps??[]).length>0&&(question.gaps??[]).every(gap=>Boolean(String(answer?.[gap.id]??'').trim()));return false}

async function submitAttempt({testId,student,answers}){
  if(!testId||!student?.firstName||!student?.lastName||!answers||typeof answers!=='object')throw Object.assign(new Error('Заполните данные ученика и ответы.'),{status:400});
  const snapshot=await db().doc(`tests/${testId}`).get();if(!snapshot.exists||snapshot.data().status!=='published')throw Object.assign(new Error('Тест недоступен.'),{status:404});
  const test=snapshot.data();if(test.questions.some(question=>!isAnswered(question,answers[question.id])))throw Object.assign(new Error('Ответьте на все задания перед завершением теста.'),{status:400});const maxScore=test.questions.reduce((total,question)=>total+questionMaxScore(question),0);const score=test.questions.reduce((total,question)=>total+scoreQuestion(question,answers[question.id]),0);const percentage=maxScore?Math.round(score/maxScore*100):0;
  const attempt={id:randomUUID(),testId:test.id,ownerId:test.ownerId,testTitle:test.title,student:clean(student),answers:clean(answers),score,maxScore,percentage,grade:Math.round(Math.max(0,Math.min(100,percentage))/10),completedAt:new Date().toISOString(),notificationStatus:'pending',createdAt:FieldValue.serverTimestamp()};
  await db().doc(`attempts/${attempt.id}`).set(attempt);
  try{const notified=await notifyTeacher(attempt,test);await db().doc(`attempts/${attempt.id}`).update({notificationStatus:notified?'sent':'not_connected'})}catch(error){console.error('Teacher Telegram notification failed',error);await db().doc(`attempts/${attempt.id}`).update({notificationStatus:'failed'}).catch(()=>{})}
  const responseAttempt={...attempt};delete responseAttempt.createdAt;return{attempt:responseAttempt,reviewTest:test};
}

async function deleteAttempts(actor,{attemptIds}){
  const ids=[...new Set(Array.isArray(attemptIds)?attemptIds.filter(value=>typeof value==='string'&&value):[])];
  if(!ids.length||ids.length>100)throw Object.assign(new Error('Выберите от 1 до 100 результатов.'),{status:400});
  const refs=ids.map(id=>db().doc(`attempts/${id}`));const snapshots=await db().getAll(...refs);
  for(const snapshot of snapshots){if(!snapshot.exists)continue;if(!actor.admin&&snapshot.data().ownerId!==actor.uid)throw Object.assign(new Error('Нельзя удалить чужой результат.'),{status:403})}
  const batch=db().batch();let deleted=0;snapshots.forEach(snapshot=>{if(snapshot.exists){batch.delete(snapshot.ref);deleted++}});await batch.commit();return{deleted};
}

async function notifyTeacher(attempt,test){
  if(!test.ownerId)return false;
  const connection=await db().doc(`teacherTelegram/${test.ownerId}`).get();
  if(!connection.exists)return false;
  const chatId=connection.data().chatId;
  const studentName=`${attempt.student.lastName} ${attempt.student.firstName}`.trim();
  const group=attempt.student.group?`\nГруппа: <b>${escapeHtml(attempt.student.group)}</b>`:'';
  await telegramApi('sendMessage',{chat_id:chatId,parse_mode:'HTML',text:`🎼 <b>Новый результат NotaTest</b>\n\nУченик: <b>${escapeHtml(studentName)}</b>${group}\nТест: <b>${escapeHtml(test.title)}</b>\nБаллы: <b>${attempt.score} из ${attempt.maxScore}</b>\nРезультат: <b>${attempt.percentage}%</b>\nОценка: <b>${attempt.grade}</b>`});
  return true;
}

async function ensureTelegramWebhook(){
  const origin=String(process.env.PUBLIC_API_ORIGIN??'https://nota-test-khaki.vercel.app').replace(/\/$/,'');
  await telegramApi('setWebhook',{url:`${origin}/api/telegram-webhook`,secret_token:telegramSecret(),allowed_updates:['message'],drop_pending_updates:false});
}

async function teacherTelegram(actor,{action}){
  const ref=db().doc(`teacherTelegram/${actor.uid}`);
  if(action==='status'){const snapshot=await ref.get();if(!snapshot.exists)return{connected:false};const data=snapshot.data();return{connected:true,username:data.username??'',firstName:data.firstName??'',connectedAt:data.connectedAt??''}}
  if(action==='connect'){
    await ensureTelegramWebhook();
    const code=randomUUID();const expiresAt=Date.now()+15*60*1000;
    await db().doc(`telegramLinks/${code}`).set({ownerId:actor.uid,expiresAt,createdAt:FieldValue.serverTimestamp()});
    return{url:`https://t.me/NotaTestTeachersBot?start=${code}`,expiresAt};
  }
  if(action==='disconnect'){await ref.delete();return{connected:false}}
  if(action==='test'){
    const snapshot=await ref.get();if(!snapshot.exists)throw Object.assign(new Error('Сначала подключите Telegram.'),{status:400});
    await telegramApi('sendMessage',{chat_id:snapshot.data().chatId,text:'✅ NotaTest подключён. Сюда будут приходить результаты только ваших тестов.'});return{ok:true};
  }
  throw Object.assign(new Error('Неизвестное действие.'),{status:400});
}

async function telegramWebhook(req,res){
  if(req.method!=='POST')return res.status(405).json({ok:false});
  if(!telegramSecret()||req.headers['x-telegram-bot-api-secret-token']!==telegramSecret())return res.status(403).json({ok:false});
  try{
    const message=req.body?.message;const text=String(message?.text??'');const match=text.match(/^\/start(?:@\w+)?\s+([\w-]+)$/);
    if(!message?.chat?.id||message.chat.type!=='private')return res.status(200).json({ok:true});
    if(!match){await telegramApi('sendMessage',{chat_id:message.chat.id,text:'Откройте персональную ссылку «Подключить Telegram» в профиле NotaTest.'});return res.status(200).json({ok:true})}
    const linkRef=db().doc(`telegramLinks/${match[1]}`);const link=await linkRef.get();
    if(!link.exists||Number(link.data().expiresAt)<Date.now()){await telegramApi('sendMessage',{chat_id:message.chat.id,text:'Ссылка недействительна или истекла. Создайте новую ссылку в профиле NotaTest.'});return res.status(200).json({ok:true})}
    const ownerId=link.data().ownerId;
    await db().doc(`teacherTelegram/${ownerId}`).set({ownerId,chatId:String(message.chat.id),username:message.from?.username??'',firstName:message.from?.first_name??'',connectedAt:new Date().toISOString()});
    await linkRef.delete();
    await telegramApi('sendMessage',{chat_id:message.chat.id,text:'✅ Telegram подключён к NotaTest. Теперь сюда будут приходить результаты только ваших тестов.'});
    return res.status(200).json({ok:true});
  }catch(error){console.error('Telegram webhook failed',error);return res.status(200).json({ok:false})}
}

async function migratePublishedTests(actor){
  const snapshots=await db().collection('tests').where('status','==','published').get();let migrated=0;
  for(const snapshot of snapshots.docs){const test=snapshot.data();if(!test.id||!test.slug||!test.ownerId||!Array.isArray(test.questions))continue;const data=await representations(test,actor);const batch=db().batch();batch.set(snapshot.ref,data.privateTest);batch.set(db().doc(`publicTests/${test.slug}`),data.publicTest);batch.set(db().doc(`testCatalog/${test.id}`),data.catalog);await batch.commit();migrated++}
  return{scanned:snapshots.size,migrated};
}

function handler(action,options={}){return async(req,res)=>{if(cors(req,res))return;if(req.method!=='POST')return res.status(405).json({error:'Метод не поддерживается.'});try{const actor=await authenticate(req,options);const result=await action(actor,req.body??{});return res.status(200).json(result)}catch(error){console.error(error);return res.status(error.status??500).json({error:error.status?error.message:'Ошибка сервера.'})}}}

module.exports={handler,publishTest,deleteAttempts,submitAttempt,migratePublishedTests,teacherTelegram,telegramWebhook,createMediaUpload,completeMediaUpload,mediaUrls,normalizeMediaTest,storageAdmin,uploadSettings};
