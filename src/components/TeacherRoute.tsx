import{Navigate,Outlet}from'react-router-dom';
import{auth,isTeacher}from'../services/firebase';

export function TeacherRoute(){
  return isTeacher(auth.currentUser)?<Outlet/>:<Navigate to="/" replace/>;
}
