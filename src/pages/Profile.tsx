import{ExternalLink,RefreshCw,Send,Unlink}from'lucide-react';
import{useEffect,useState,type FormEvent}from'react';
import{Header}from'../components/Header';
import{useAuth}from'../contexts/AuthContext';
import{changePassword,updateDisplayName}from'../services/firebase';
import{teacherTelegramService,type TelegramConnection}from'../services/storage';

export function Profile(){
  const{user,profile,refreshProfile}=useAuth();
  const[name,setName]=useState(profile?.displayName??user?.displayName??'');
  const[password,setPassword]=useState('');
  const[message,setMessage]=useState('');
  const[error,setError]=useState('');
  const[busy,setBusy]=useState(false);
  const[telegram,setTelegram]=useState<TelegramConnection>({connected:false});
  const[telegramBusy,setTelegramBusy]=useState(false);

  const loadTelegram=async()=>{setTelegramBusy(true);setError('');try{setTelegram(await teacherTelegramService.status())}catch(cause){console.error(cause);setError('Не удалось проверить подключение Telegram.')}finally{setTelegramBusy(false)}};
  useEffect(()=>{if(profile?.role==='teacher')void loadTelegram()},[profile?.role]);
  const saveName=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{await updateDisplayName(name);await refreshProfile();setMessage('Профиль сохранён.')}catch(cause){console.error(cause);setError('Не удалось сохранить профиль.')}finally{setBusy(false)}};
  const savePassword=async(e:FormEvent)=>{e.preventDefault();setBusy(true);setError('');setMessage('');try{await changePassword(password);setPassword('');setMessage('Пароль изменён.')}catch(cause){console.error(cause);setError('Не удалось изменить пароль. Возможно, требуется выйти и войти снова.')}finally{setBusy(false)}};
  const connectTelegram=async()=>{setTelegramBusy(true);setError('');setMessage('');try{const{url}=await teacherTelegramService.connect();window.open(url,'_blank','noopener,noreferrer');setMessage('В Telegram нажмите «Запустить», затем вернитесь сюда и нажмите «Проверить подключение».')}catch(cause){console.error(cause);setError('Не удалось создать ссылку подключения Telegram.')}finally{setTelegramBusy(false)}};
  const disconnectTelegram=async()=>{if(!confirm('Отключить Telegram от NotaTest?'))return;setTelegramBusy(true);setError('');try{setTelegram(await teacherTelegramService.disconnect());setMessage('Telegram отключён.')}catch(cause){console.error(cause);setError('Не удалось отключить Telegram.')}finally{setTelegramBusy(false)}};
  const testTelegram=async()=>{setTelegramBusy(true);setError('');try{await teacherTelegramService.test();setMessage('Тестовое сообщение отправлено в Telegram.')}catch(cause){console.error(cause);setError('Не удалось отправить тестовое сообщение.')}finally{setTelegramBusy(false)}};

  return <><Header eyebrow="Личный кабинет" title="Профиль"/><div className="profile-grid"><form className="panel auth-form" onSubmit={saveName}><h2>Основные данные</h2><label>ФИО<input required minLength={3} value={name} onChange={e=>setName(e.target.value)}/></label><label>Электронная почта<input disabled value={user?.email??''}/></label><button className="button primary" disabled={busy}>Сохранить</button></form><form className="panel auth-form" onSubmit={savePassword}><h2>Смена пароля</h2><label>Новый пароль<input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="button" disabled={busy}>Изменить пароль</button></form>{profile?.role==='teacher'&&<section className="panel auth-form telegram-card"><h2>Результаты в Telegram</h2>{telegram.connected?<><div className="success-note">Telegram подключён{telegram.username?` — @${telegram.username}`:telegram.firstName?` — ${telegram.firstName}`:''}.</div><p>Сюда будут приходить результаты только ваших тестов.</p><div className="actions"><button className="button primary" disabled={telegramBusy} onClick={()=>void testTelegram()}><Send/>Тестовое сообщение</button><button className="button" disabled={telegramBusy} onClick={()=>void loadTelegram()}><RefreshCw/>Проверить</button><button className="button danger" disabled={telegramBusy} onClick={()=>void disconnectTelegram()}><Unlink/>Отключить</button></div></>:<><p>Подключите @NotaTestTeachersBot без ручного ввода Telegram ID.</p><button className="button primary" disabled={telegramBusy} onClick={()=>void connectTelegram()}><ExternalLink/>{telegramBusy?'Подождите…':'Подключить Telegram'}</button><button className="button" disabled={telegramBusy} onClick={()=>void loadTelegram()}><RefreshCw/>Проверить подключение</button></>}</section>}</div>{message&&<div className="success-note">{message}</div>}{error&&<div className="warning">{error}</div>}</>;
}
