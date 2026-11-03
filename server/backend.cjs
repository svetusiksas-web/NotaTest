const{cert,getApps,initializeApp}=require('firebase-admin/app');
const{getAuth}=require('firebase-admin/auth');
const{FieldValue,getFirestore}=require('firebase-admin/firestore');
const{randomUUID}=require('node:crypto');

const ADMIN_EMAIL='svetusiksas@gmail.com';
const clean=value=>JSON.parse(JSON.stringify(value));
const shuffle=values=>{const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result};
const norm=value=>String(value??'').trim().replace(/\s+/g,' ').toLocaleLowerCase('ru');

function app(){
  if(getApps().length)return getApps()[0];
  const projectId=process.env.FIREBASE_PROJECT_ID;
  const clientEmail=process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey=process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n');
  if(!projectId||!clientEmail||!privateKey)throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
  return initializeApp({credential:cert({projectId,clientEmail,privateKey}),projectId});
}
const db=()=>getFirestore(app());

function cors(req,res){
  const allowed=new Set(['https://notatest-f208b.web.app','https://notatest-f208b.firebaseapp.com',process.env.ALLOWED_ORIGIN].filter(Boolean));
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
  if(question.type==='matching'){
    const tokens=(question.pairs??[]).map(pair=>({pair,id:question.matchingAnswerMap?.[pair.id]??randomUUID()}));
    privateQuestion.matchingAnswerMap=Object.fromEntries(tokens.map(({pair,id})=>[pair.id,id]));
    publicQuestion.pairs=(question.pairs??[]).map(pair=>({id:pair.id,left:pair.left,right:'',leftImageUrl:pair.leftImageUrl,leftImageName:pair.leftImageName,leftAudioUrl:pair.leftAudioUrl,leftAudioName:pair.leftAudioName}));
    publicQuestion.matchingOptions=shuffle(tokens.map(({pair,id})=>({id,text:pair.right,imageUrl:pair.rightImageUrl,imageName:pair.rightImageName,audioUrl:pair.rightAudioUrl,audioName:pair.rightAudioName})));
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

async function publishTest(actor,incoming){
  if(!incoming?.id||!incoming?.slug||!incoming?.title||!Array.isArray(incoming.questions)||!incoming.questions.length)throw Object.assign(new Error('Тест заполнен не полностью.'),{status:400});
  const ref=db().doc(`tests/${incoming.id}`);const existing=await ref.get();const existingOwner=existing.exists?existing.data().ownerId:null;
  if(existingOwner&&!actor.admin&&existingOwner!==actor.uid)throw Object.assign(new Error('Нельзя публиковать чужой тест.'),{status:403});
  const test=clean({...incoming,ownerId:existingOwner??actor.uid,status:'published',updatedAt:new Date().toISOString()});
  const{privateTest,publicTest,catalog}=await representations(test,actor);const batch=db().batch();
  batch.set(ref,privateTest);batch.set(db().doc(`publicTests/${test.slug}`),publicTest);batch.set(db().doc(`testCatalog/${test.id}`),catalog);await batch.commit();
  return{test:privateTest};
}

function scoreQuestion(question,answer){
  if(answer===undefined)return 0;
  if(question.type==='single')return(question.options??[]).some(option=>option.id===answer&&option.isCorrect)?1:0;
  if(question.type==='multiple'){if(!Array.isArray(answer))return 0;const selected=[...new Set(answer)].sort();const correct=(question.options??[]).filter(option=>option.isCorrect).map(option=>option.id).sort();return correct.length>0&&selected.length===correct.length&&selected.every((id,index)=>id===correct[index])?1:0}
  if(question.type==='short')return(question.acceptedAnswers??[]).some(value=>norm(value)===norm(answer))?1:0;
  if(question.type==='ordering')return JSON.stringify(answer)===JSON.stringify(question.items)?1:0;
  const map=question.matchingAnswerMap??{};return(question.pairs??[]).every(pair=>answer?.[pair.id]===map[pair.id])?1:0;
}

async function submitAttempt({testId,student,answers}){
  if(!testId||!student?.firstName||!student?.lastName||!answers||typeof answers!=='object')throw Object.assign(new Error('Заполните данные ученика и ответы.'),{status:400});
  const snapshot=await db().doc(`tests/${testId}`).get();if(!snapshot.exists||snapshot.data().status!=='published')throw Object.assign(new Error('Тест недоступен.'),{status:404});
  const test=snapshot.data();const maxScore=test.questions.length;const score=test.questions.reduce((total,question)=>total+scoreQuestion(question,answers[question.id]),0);const percentage=maxScore?Math.round(score/maxScore*100):0;
  const attempt={id:randomUUID(),testId:test.id,ownerId:test.ownerId,testTitle:test.title,student:clean(student),answers:clean(answers),score,maxScore,percentage,grade:Math.round(Math.max(0,Math.min(100,percentage))/10),completedAt:new Date().toISOString(),notificationStatus:'pending',createdAt:FieldValue.serverTimestamp()};
  await db().doc(`attempts/${attempt.id}`).set(attempt);const responseAttempt={...attempt};delete responseAttempt.createdAt;return{attempt:responseAttempt,reviewTest:test};
}

async function migratePublishedTests(actor){
  const snapshots=await db().collection('tests').where('status','==','published').get();let migrated=0;
  for(const snapshot of snapshots.docs){const test=snapshot.data();if(!test.id||!test.slug||!test.ownerId||!Array.isArray(test.questions))continue;const data=await representations(test,actor);const batch=db().batch();batch.set(snapshot.ref,data.privateTest);batch.set(db().doc(`publicTests/${test.slug}`),data.publicTest);batch.set(db().doc(`testCatalog/${test.id}`),data.catalog);await batch.commit();migrated++}
  return{scanned:snapshots.size,migrated};
}

function handler(action,options={}){return async(req,res)=>{if(cors(req,res))return;if(req.method!=='POST')return res.status(405).json({error:'Метод не поддерживается.'});try{const actor=await authenticate(req,options);const result=await action(actor,req.body??{});return res.status(200).json(result)}catch(error){console.error(error);return res.status(error.status??500).json({error:error.status?error.message:'Ошибка сервера.'})}}}

module.exports={handler,publishTest,submitAttempt,migratePublishedTests};
