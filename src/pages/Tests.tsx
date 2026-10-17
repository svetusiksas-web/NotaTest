import{Copy,ExternalLink,Lock,Plus,Search,Trash2}from'lucide-react';
import{useState}from'react';
import{Link,useSearchParams}from'react-router-dom';
import{Header}from'../components/Header';
import{demo}from'../data/demo';
import{subjects}from'../data/subjects';
import{copyStudentTestUrl}from'../lib/publicLink';
import{auth,isTeacher}from'../services/firebase';
import{testService}from'../services/storage';
import type{QuizTest,TestStatus}from'../types';

export function Tests(){
  const[,refresh]=useState(0);const[copied,setCopied]=useState('');const[search,setSearch]=useState('');const[status,setStatus]=useState<TestStatus|''>('');const[params,setParams]=useSearchParams();
  const teacher=isTeacher(auth.currentUser);const canManage=(test:QuizTest)=>teacher&&(!test.ownerId||test.ownerId===auth.currentUser?.uid);
  let tests=testService.all();if(!tests.length){testService.save(demo);tests=[demo]}
  const subject=params.get('subject')??'';
  const shown=tests.filter(test=>(!subject||test.subject.trim()===subject)&&(!status||test.status===status)&&(!search.trim()||test.title.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')))).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
  const setSubject=(value:string)=>{const next=new URLSearchParams(params);value?next.set('subject',value):next.delete('subject');setParams(next)};
  const remove=(test:QuizTest)=>{if(confirm(`Удалить «${test.title}»? Результаты сохранятся.`)){testService.remove(test.id);refresh(value=>value+1)}};
  const closeAccess=(test:QuizTest)=>{if(confirm(`Закрыть ученикам доступ к тесту «${test.title}»? Результаты сохранятся.`)){testService.save({...test,status:'archived',updatedAt:new Date().toISOString()});refresh(value=>value+1)}};
  const copy=async(test:QuizTest)=>{try{await copyStudentTestUrl(test.slug);setCopied(test.id);setTimeout(()=>setCopied(current=>current===test.id?'':current),2000)}catch{alert('Не удалось скопировать ссылку. Откройте тест и скопируйте адрес из браузера.')}};
  return <><Header eyebrow="Библиотека" title={subject||(teacher?'Мои тесты':'Тесты')}>{teacher&&<Link className="button primary" to="/editor/new"><Plus/>Новый тест</Link>}</Header><div className="toolbar"><label><Search/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Поиск по названию…"/></label><select value={subject} onChange={event=>setSubject(event.target.value)}><option value="">Все предметы</option>{subjects.map(item=><option key={item} value={item}>{item}</option>)}</select><select value={status} onChange={event=>setStatus(event.target.value as TestStatus|'')}><option value="">Все статусы</option><option value="published">Опубликован</option><option value="draft">Черновик</option><option value="archived">Доступ закрыт</option></select></div><div className="test-grid">{shown.map(test=><article className="test-card" key={test.id}><div className="card-top"><span className={`status ${test.status}`}>{test.status==='published'?'Опубликован':test.status==='archived'?'Доступ закрыт':'Черновик'}</span><span>{test.questions.length} вопросов</span></div><h3>{test.title||'Без названия'}</h3><p>{test.subject} · {test.grade||'Все группы'}</p><div className="card-actions">{canManage(test)?<><Link className="button" to={'/editor/'+test.id}>Редактировать</Link>{test.status==='published'&&<><Link className="share-action open-action" aria-label="Открыть страницу ученика" title="Открыть страницу ученика" to={'/test/'+test.slug}><ExternalLink/></Link><button className="share-action" title="Копировать ссылку для ученика" onClick={()=>void copy(test)}><Copy/>{copied===test.id?'Скопировано':'Ссылка'}</button><button title="Закрыть доступ ученикам" onClick={()=>closeAccess(test)}><Lock/></button></>}<button className="danger" title="Удалить" onClick={()=>remove(test)}><Trash2/></button></>:test.status==='published'&&<Link className="button primary" to={'/test/'+test.slug}>Пройти тест</Link>}</div></article>)}</div>{!shown.length&&<div className="empty panel"><h3>Тестов не найдено</h3><p>Измените предмет, статус или строку поиска.</p></div>}</>;
}
