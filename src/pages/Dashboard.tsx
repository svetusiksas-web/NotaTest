import{BookOpen,ChartNoAxesColumn,FilePlus2,Sparkles}from'lucide-react';
import{Link}from'react-router-dom';
import{Header}from'../components/Header';
import{resultService,testService}from'../services/storage';

export function Dashboard(){
  const tests=testService.all(),results=resultService.all();
  return <>
    <Header eyebrow="Кабинет преподавателя" title="Добро пожаловать, Светлана!"/>
    <section className="hero"><div><span className="pill"><Sparkles/> Творческая мастерская</span><h2>Что создадим<br/>сегодня?</h2><p>Соберите красивый музыкальный тест за несколько минут — вручную или вставив весь материал сразу.</p><div className="actions"><Link className="button primary" to="/editor/new"><FilePlus2/>Создать тест</Link></div></div><div className="staff" aria-hidden="true">𝄞<i>♪</i><i>♫</i></div></section>
    <div className="stats"><article><span className="icon lavender"><BookOpen/></span><div><strong>{tests.length}</strong><small>Всего тестов</small></div></article><article><span className="icon mint"><ChartNoAxesColumn/></span><div><strong>{results.length}</strong><small>Попыток учеников</small></div></article><article><span className="icon peach">%</span><div><strong>{results.length?Math.round(results.reduce((n,r)=>n+r.percentage,0)/results.length):'—'}</strong><small>Средний результат</small></div></article></div>
  </>;
}
