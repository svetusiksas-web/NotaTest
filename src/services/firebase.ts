import {initializeApp} from 'firebase/app';
import {createUserWithEmailAndPassword,getAuth,GoogleAuthProvider,onAuthStateChanged,sendPasswordResetEmail,signInAnonymously,signInWithEmailAndPassword,signInWithPopup,signOut,updatePassword,updateProfile,type User} from 'firebase/auth';
import {doc,getDoc,getFirestore,serverTimestamp,setDoc,updateDoc} from 'firebase/firestore';
import type{UserProfile}from'../types';

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
export const isAdminUser=(user:User|null|undefined)=>Boolean(user&&!user.isAnonymous&&user.email?.toLowerCase()===TEACHER_EMAIL);
export const isTeacher=(user:User|null|undefined,profile?:UserProfile|null)=>Boolean(user&&!user.isAnonymous&&(isAdminUser(user)||(profile?.role==='teacher'&&profile.status==='active')));

export async function getUserProfile(user:User|null):Promise<UserProfile|null>{
  if(!user||user.isAnonymous)return null;
  if(isAdminUser(user)){
    const admin:UserProfile={uid:user.uid,email:user.email??TEACHER_EMAIL,displayName:user.displayName??'Администратор',role:'admin',status:'active',createdAt:user.metadata.creationTime??new Date().toISOString()};
    const snapshot=await getDoc(doc(db,'profiles',user.uid));
    return snapshot.exists()?{...admin,...snapshot.data(),uid:user.uid,role:'admin',status:'active'} as UserProfile:admin;
  }
  const snapshot=await getDoc(doc(db,'profiles',user.uid));
  return snapshot.exists()?snapshot.data() as UserProfile:null;
}

const signInAsGuest=async()=>{
  await signOut(auth);
  return (await signInAnonymously(auth)).user;
};

export const waitForUser=()=>new Promise<User>((resolve,reject)=>{
  const stop=onAuthStateChanged(auth,user=>{stop();if(!user){signInAnonymously(auth).then(result=>resolve(result.user)).catch(reject);return}resolve(user)},reject);
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
export const loginWithEmail=(email:string,password:string)=>signInWithEmailAndPassword(auth,email.trim(),password);
export async function registerTeacher(email:string,password:string,displayName:string){
  const result=await createUserWithEmailAndPassword(auth,email.trim(),password);
  await updateProfile(result.user,{displayName:displayName.trim()});
  const profile:UserProfile={uid:result.user.uid,email:result.user.email??email.trim(),displayName:displayName.trim(),role:'teacher',status:'pending',createdAt:new Date().toISOString()};
  await setDoc(doc(db,'profiles',result.user.uid),{...profile,createdAt:serverTimestamp()});
  return result.user;
}
export const resetPassword=(email:string)=>sendPasswordResetEmail(auth,email.trim());
export async function updateDisplayName(displayName:string){const user=auth.currentUser;if(!user||user.isAnonymous)throw new Error('AUTH_REQUIRED');await updateProfile(user,{displayName:displayName.trim()});if(!isAdminUser(user))await updateDoc(doc(db,'profiles',user.uid),{displayName:displayName.trim()})}
export async function changePassword(password:string){const user=auth.currentUser;if(!user||user.isAnonymous)throw new Error('AUTH_REQUIRED');await updatePassword(user,password)}
