import{Navigate,Outlet}from'react-router-dom';
import{auth}from'../services/firebase';

export function TeacherRoute(){
  return auth.currentUser&&!auth.currentUser.isAnonymous?<Outlet/>:<Navigate to="/" replace/>;
}
