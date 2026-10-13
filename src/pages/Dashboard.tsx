import{BookOpen,FilePlus2,Sparkles}from'lucide-react';
import{Link}from'react-router-dom';
import{Header}from'../components/Header';
import{subjects}from'../data/subjects';
import{auth}from'../services/firebase';
import{testService}from'../services/storage';

export function Dashboard(){
  const tests=testService.all();
  const teacher=Boolean(auth.currentUser&&!auth.currentUser.isAnonymous);
  return <div className="dashboard">
    <Header eyebrow={teacher?'Кабинет преподавателя':'NotaTest'} title={teacher?'Добро пожаловать, Светлана!':'Каталог музыкальных тестов'}/>
    <section className="hero"><div><span className="pill"><Sparkles/> Творческая мастерская</span><h2>{teacher?'Что создадим сегодня?':'Музыкальные тесты'}</h2><p>{teacher?'Соберите красивый музыкальный тест за несколько минут — вручную или вставив весь материал сразу.':'Выберите предмет и откройте интересующий тест для прохождения.'}</p>{teacher&&<div className="actions"><Link className="button primary" to="/editor/new"><FilePlus2/>Создать тест</Link></div>}</div><div className="staff" aria-hidden="true">𝄞<i>♪</i><i>♫</i></div></section>
    <section className="subject-section"><div className="section-title"><div><p className="eyebrow">Каталог тестов</p><h2>Предметы</h2></div></div><div className="subject-grid">{subjects.map(subject=><Link className="subject-card" key={subject} to={{pathname:'/tests',search:new URLSearchParams({subject}).toString()}}><span><BookOpen/></span><div><b>{subject}</b><small>{tests.filter(test=>test.subject.trim()===subject).length} тестов</small></div></Link>)}</div></section>
  </div>;
}
