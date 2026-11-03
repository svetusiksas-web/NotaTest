const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {randomUUID}=require('node:crypto');

initializeApp();
const db=getFirestore();
const ADMIN_EMAIL='svetusiksas@gmail.com';
const clean=value=>JSON.parse(JSON.stringify(value));
const shuffle=values=>{const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result};
const norm=value=>String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');

async function actor(auth){
  if(!auth||auth.token.firebase?.sign_in_provider==='anonymous')throw new HttpsError('unauthenticated','Требуется вход преподавателя.');
  if(String(auth.token.email??'').toLowerCase()===ADMIN_EMAIL)return{uid:auth.uid,admin:true};
  const profile=(await db.doc(`profiles/${auth.uid}`).get()).data();
  if(profile?.role!=='teacher'||profile.status!=='active')throw new HttpsError('permission-denied','Аккаунт преподавателя не активен.');
  return{uid:auth.uid,admin:false,displayName:profile.displayName??profile.email??''};
}

function prepareQuestion(question){
  const privateQuestion=clean(question);
  const publicQuestion=clean(question);
  if(publicQuestion.options)publicQuestion.options=publicQuestion.options.map(({isCorrect,...option})=>option);
  delete publicQuestion.acceptedAnswers;
  if(question.type==='ordering')publicQuestion.items=shuffle(question.items??[]);
  if(question.type==='matching'){
    const tokens=(question.pairs??[]).map(pair=>({pair,id:question.matchingAnswerMap?.[pair.id]??randomUUID()}));
    privateQuestion.matchingAnswerMap=Object.fromEntries(tokens.map(({pair,id})=>[pair.id,id]));
    publicQuestion.pairs=(question.pairs??[]).map(pair=>({
      id:pair.id,left:pair.left,right:'',leftImageUrl:pair.leftImageUrl,leftImageName:pair.leftImageName,leftAudioUrl:pair.leftAudioUrl,leftAudioName:pair.leftAudioName
    }));
    publicQuestion.matchingOptions=shuffle(tokens.map(({pair,id})=>({id,text:pair.right,imageUrl:pair.rightImageUrl,imageName:pair.rightImageName,audioUrl:pair.rightAudioUrl,audioName:pair.rightAudioName})));
  }
  return{privateQuestion,publicQuestion};
}

exports.publishTest=onCall(async request=>{
  const user=await actor(request.auth);
  const incoming=request.data?.test;
  if(!incoming?.id||!incoming?.slug||!incoming?.title||!Array.isArray(incoming.questions)||!incoming.questions.length)throw new HttpsError('invalid-argument','Тест заполнен не полностью.');
  const ref=db.doc(`tests/${incoming.id}`);
  const existing=await ref.get();
  const existingOwner=existing.exists?existing.data().ownerId:null;
  if(existingOwner&&!user.admin&&existingOwner!==user.uid)throw new HttpsError('permission-denied','Нельзя публиковать чужой тест.');
  const ownerId=existingOwner??user.uid;
  const prepared=incoming.questions.map(prepareQuestion);
  const privateTest=clean({...incoming,ownerId,status:'published',questions:prepared.map(item=>item.privateQuestion),updatedAt:new Date().toISOString()});
  const publicTest=clean({...privateTest,questions:prepared.map(item=>item.publicQuestion)});
  const ownerProfile=ownerId===user.uid&&!user.admin?{displayName:user.displayName}:((await db.doc(`profiles/${ownerId}`).get()).data()??{});
  const catalog={testId:privateTest.id,slug:privateTest.slug,title:privateTest.title,subject:privateTest.subject,grade:privateTest.grade,topic:privateTest.topic,description:privateTest.description,ownerId,authorName:ownerId===user.uid&&user.admin?'Администратор':ownerProfile.displayName??ownerProfile.email??'Преподаватель',questionCount:privateTest.questions.length,updatedAt:privateTest.updatedAt};
  publicTest.authorName=catalog.authorName;
  const batch=db.batch();
  batch.set(ref,privateTest);
  batch.set(db.doc(`publicTests/${privateTest.slug}`),publicTest);
  batch.set(db.doc(`testCatalog/${privateTest.id}`),catalog);
  await batch.commit();
  return{test:privateTest};
});

exports.migratePublishedTests=onCall(async request=>{
  const user=await actor(request.auth);
  if(!user.admin)throw new HttpsError('permission-denied','Миграция доступна только администратору.');
  const snapshots=await db.collection('tests').where('status','==','published').get();
  let migrated=0;
  for(const snapshot of snapshots.docs){
    const test=snapshot.data();
    if(!test.id||!test.slug||!test.ownerId||!Array.isArray(test.questions))continue;
    const prepared=test.questions.map(prepareQuestion);
    const privateTest=clean({...test,questions:prepared.map(item=>item.privateQuestion)});
    const ownerProfile=test.ownerId===user.uid?{}:((await db.doc(`profiles/${test.ownerId}`).get()).data()??{});
    const authorName=test.ownerId===user.uid?'Администратор':ownerProfile.displayName??ownerProfile.email??'Преподаватель';
    const publicTest=clean({...privateTest,authorName,questions:prepared.map(item=>item.publicQuestion)});
    const catalog={testId:test.id,slug:test.slug,title:test.title,subject:test.subject??'',grade:test.grade??'',topic:test.topic??'',description:test.description??'',ownerId:test.ownerId,authorName,questionCount:test.questions.length,updatedAt:test.updatedAt??new Date().toISOString()};
    const batch=db.batch();
    batch.set(snapshot.ref,privateTest);
    batch.set(db.doc(`publicTests/${test.slug}`),publicTest);
    batch.set(db.doc(`testCatalog/${test.id}`),catalog);
    await batch.commit();
    migrated++;
  }
  return{scanned:snapshots.size,migrated};
});

function scoreQuestion(question,answer){
  if(answer===undefined)return 0;
  if(question.type==='single')return(question.options??[]).some(option=>option.id===answer&&option.isCorrect)?1:0;
  if(question.type==='multiple'){
    if(!Array.isArray(answer))return 0;
    const selected=[...new Set(answer)].sort();
    const correct=(question.options??[]).filter(option=>option.isCorrect).map(option=>option.id).sort();
    return correct.length>0&&selected.length===correct.length&&selected.every((id,index)=>id===correct[index])?1:0;
  }
  if(question.type==='short')return(question.acceptedAnswers??[]).some(value=>norm(value)===norm(answer))?1:0;
  if(question.type==='ordering')return JSON.stringify(answer)===JSON.stringify(question.items)?1:0;
  const map=question.matchingAnswerMap??{};
  return(question.pairs??[]).every(pair=>answer?.[pair.id]===map[pair.id])?1:0;
}

exports.submitAttempt=onCall(async request=>{
  if(!request.auth)throw new HttpsError('unauthenticated','Не удалось определить сессию ученика.');
  const {testId,student,answers}=request.data??{};
  if(!testId||!student?.firstName||!student?.lastName||!answers||typeof answers!=='object')throw new HttpsError('invalid-argument','Заполните данные ученика и ответы.');
  const snapshot=await db.doc(`tests/${testId}`).get();
  if(!snapshot.exists||snapshot.data().status!=='published')throw new HttpsError('not-found','Тест недоступен.');
  const test=snapshot.data();
  const maxScore=test.questions.length;
  const score=test.questions.reduce((total,question)=>total+scoreQuestion(question,answers[question.id]),0);
  const percentage=maxScore?Math.round(score/maxScore*100):0;
  const attempt={id:randomUUID(),testId:test.id,ownerId:test.ownerId,testTitle:test.title,student:clean(student),answers:clean(answers),score,maxScore,percentage,grade:Math.round(Math.max(0,Math.min(100,percentage))/10),completedAt:new Date().toISOString(),notificationStatus:'pending',createdAt:FieldValue.serverTimestamp()};
  await db.doc(`attempts/${attempt.id}`).set(attempt);
  const responseAttempt={...attempt};delete responseAttempt.createdAt;
  return{attempt:responseAttempt,reviewTest:test};
});
