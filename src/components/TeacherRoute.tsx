import{Navigate,Outlet}from'react-router-dom';
import{useAuth}from'../contexts/AuthContext';

export function TeacherRoute(){
  const{user,profile,loading,isApprovedTeacher}=useAuth();
  if(loading)return <div className="route-loading">Загружаем кабинет…</div>;
  if(!user||user.isAnonymous)return <Navigate to="/login" replace/>;
  if(!isApprovedTeacher)return <Navigate to={profile?.status==='blocked'?'/blocked':'/pending'} replace/>;
  return <Outlet/>;
}
