import{BookOpen,FilePlus2,Sparkles}from'lucide-react';
import{Link}from'react-router-dom';
import{Header}from'../components/Header';
import{subjects}from'../data/subjects';
import{testService}from'../services/storage';

export function Dashboard(){
  const tests=testService.all();
  return <div className="dashboard">
    <Header eyebrow="Кабинет преподавателя" title="Добро пожаловать, Светлана!"/>
    <section className="hero"><div><span className="pill"><Sparkles/> Творческая мастерская</span><h2>Что создадим<br/>сегодня?</h2><p>Соберите красивый музыкальный тест за несколько минут — вручную или вставив весь материал сразу.</p><div className="actions"><Link className="button primary" to="/editor/new"><FilePlus2/>Создать тест</Link></div></div><div className="staff" aria-hidden="true">𝄞<i>♪</i><i>♫</i></div></section>
    <section className="subject-section"><div className="section-title"><div><p className="eyebrow">Каталог тестов</p><h2>Предметы</h2></div></div><div className="subject-grid">{subjects.map(subject=><Link className="subject-card" key={subject} to={{pathname:'/tests',search:new URLSearchParams({subject}).toString()}}><span><BookOpen/></span><div><b>{subject}</b><small>{tests.filter(test=>test.subject.trim()===subject).length} тестов</small></div></Link>)}</div></section>
  </div>;
}
