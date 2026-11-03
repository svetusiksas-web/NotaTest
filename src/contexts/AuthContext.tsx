import{createContext,useContext,useEffect,useState,type ReactNode}from'react';
import{onAuthStateChanged,type User}from'firebase/auth';
import{auth,getUserProfile,isAdminUser}from'../services/firebase';
import type{UserProfile}from'../types';

interface AuthState{user:User|null;profile:UserProfile|null;loading:boolean;isAdmin:boolean;isApprovedTeacher:boolean;refreshProfile:()=>Promise<void>}
const AuthContext=createContext<AuthState|undefined>(undefined);

export function AuthProvider({children}:{children:ReactNode}){
  const[user,setUser]=useState<User|null>(auth.currentUser);
  const[profile,setProfile]=useState<UserProfile|null>(null);
  const[loading,setLoading]=useState(true);
  const load=async(next:User|null)=>{setUser(next);try{setProfile(await getUserProfile(next))}catch(error){console.error('Не удалось загрузить профиль',error);setProfile(null)}finally{setLoading(false)}};
  useEffect(()=>onAuthStateChanged(auth,next=>{setLoading(true);void load(next)}),[]);
  const refreshProfile=async()=>{setLoading(true);await load(auth.currentUser)};
  const isAdmin=isAdminUser(user)||profile?.role==='admin';
  return <AuthContext.Provider value={{user,profile,loading,isAdmin,isApprovedTeacher:Boolean(isAdmin||(profile?.role==='teacher'&&profile.status==='active')),refreshProfile}}>{children}</AuthContext.Provider>;
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth должен использоваться внутри AuthProvider');return value}
