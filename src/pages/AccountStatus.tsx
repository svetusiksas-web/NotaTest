import{Navigate}from'react-router-dom';
import{Clock3,ShieldX}from'lucide-react';
import{useAuth}from'../contexts/AuthContext';
import{logout}from'../services/firebase';
export function AccountStatus({blocked=false}:{blocked?:boolean}){const{user,profile,isApprovedTeacher}=useAuth();if(!user||user.isAnonymous)return <Navigate to="/login" replace/>;if(isApprovedTeacher)return <Navigate to="/" replace/>;return <div className="auth-shell"><div className="auth-card status-card">{blocked?<ShieldX/>:<Clock3/>}<h1>{blocked?'Аккаунт заблокирован':'Ожидает подтверждения'}</h1><p>{blocked?'Доступ к кабинету приостановлен администратором.':'Регистрация завершена. Администратор должен подтвердить ваш аккаунт, после чего станет доступен кабинет.'}</p><small>{profile?.email??user.email}</small><button className="button" onClick={()=>void logout()}>Выйти</button></div></div>}
