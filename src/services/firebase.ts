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

export const waitForUser=()=>new Promise<User>((resolve,reject)=>{
  const stop=onAuthStateChanged(auth,user=>{stop();user?resolve(user):signInAnonymously(auth).then(result=>resolve(result.user)).catch(reject)},reject);
});
export const loginWithGoogle=()=>signInWithPopup(auth,new GoogleAuthProvider());
export const logout=()=>signOut(auth).then(()=>signInAnonymously(auth));
