import{Navigate,Outlet}from'react-router-dom';
import{useAuth}from'../contexts/AuthContext';
export function AdminRoute(){const{loading,isAdmin}=useAuth();if(loading)return <div className="route-loading">Проверяем права…</div>;return isAdmin?<Outlet/>:<Navigate to="/" replace/>}
