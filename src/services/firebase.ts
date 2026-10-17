import {initializeApp} from 'firebase/app';
import {getAuth,GoogleAuthProvider,onAuthStateChanged,signInAnonymously,signInWithPopup,signOut,type User} from 'firebase/auth';
import {getFirestore} from 'firebase/firestore';

const firebaseConfig={
  apiKey:'AIzaSyCKPwWsyVz84NyOoRkG5CcTbu1-OZ3tj3A',
  authDomain:'notatest-f208b.firebaseapp.com',
  projectId:'notatest-f208b',
  storageBucket:'notatest-f208b.firebasestorage.app',
  messagingSenderId:'94833661296',
  appId:'1:94833661296:web:ec39b4c696568a69d7ebb5'
};

const app=initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const db=getFirestore(app);
export const TEACHER_EMAIL='svetusiksas@gmail.com';
export const isTeacher=(user:User|null|undefined)=>Boolean(user&&!user.isAnonymous&&user.email?.toLowerCase()===TEACHER_EMAIL);

const signInAsGuest=async()=>{
  await signOut(auth);
  return (await signInAnonymously(auth)).user;
};

export const waitForUser=()=>new Promise<User>((resolve,reject)=>{
  const stop=onAuthStateChanged(auth,user=>{stop();if(!user){signInAnonymously(auth).then(result=>resolve(result.user)).catch(reject);return}if(!user.isAnonymous&&!isTeacher(user)){signInAsGuest().then(resolve).catch(reject);return}resolve(user)},reject);
});
export const loginWithGoogle=async()=>{
  const provider=new GoogleAuthProvider();
  provider.setCustomParameters({prompt:'select_account'});
  const result=await signInWithPopup(auth,provider);
  if(!isTeacher(result.user)){
    await signInAsGuest();
    throw new Error('ACCOUNT_NOT_ALLOWED');
  }
  return result;
};
export const logout=()=>signOut(auth).then(()=>signInAnonymously(auth));
