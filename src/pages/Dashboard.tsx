import{BookOpen,FilePlus2,Sparkles}from'lucide-react';
import{Link}from'react-router-dom';
import{Header}from'../components/Header';
import{subjects}from'../data/subjects';
import{auth,isTeacher}from'../services/firebase';
import{testService}from'../services/storage';

function formatTestCount(count:number){
  const lastTwo=Math.abs(count)%100;
  const last=Math.abs(count)%10;
  const word=lastTwo>=11&&lastTwo<=14?'тестов':last===1?'тест':last>=2&&last<=4?'теста':'тестов';
  return `${count} ${word}`;
}

export function Dashboard(){
  const tests=testService.all();
  const teacher=isTeacher(auth.currentUser);
  return <div className="dashboard">
    <Header eyebrow={teacher?'Кабинет преподавателя Коровченко Светланы Александровны':'NotaTest'} title={teacher?'Добро пожаловать!':'Каталог музыкальных тестов'}/>
    <section className="hero"><div><span className="pill"><Sparkles/> Творческая мастерская · Коровченко С. А.</span>{teacher&&<h2>Что создадим сегодня?</h2>}<p>{teacher?'Соберите красивый музыкальный тест за несколько минут — вручную или вставив весь материал сразу.':'Выберите предмет и откройте интересующий тест для прохождения.'}</p>{teacher&&<div className="actions"><Link className="button primary" to="/editor/new"><FilePlus2/>Создать тест</Link></div>}</div><div className="staff" aria-hidden="true">𝄞<i>♪</i><i>♫</i></div></section>
    <section className="subject-section"><div className="section-title"><div><h2>Предметы</h2></div></div><div className="subject-grid">{subjects.map(subject=>{const count=tests.filter(test=>test.subject.trim()===subject).length;return <Link className="subject-card" key={subject} to={{pathname:'/tests',search:new URLSearchParams({subject}).toString()}}><span><BookOpen/></span><div><b>{subject}</b><small>{formatTestCount(count)}</small></div></Link>;})}</div></section>
  </div>;
}
