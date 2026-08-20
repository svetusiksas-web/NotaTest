import{useEffect,useState}from'react';
import{Header}from'../components/Header';
import{refreshResults,resultService,testService}from'../services/storage';
import type{Attempt}from'../types';

export function Results(){
  const[rows,setRows]=useState<Attempt[]>(()=>resultService.all());
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{setRows(await refreshResults())}catch(cause){console.error(cause);setError('Не удалось загрузить свежие результаты. Проверьте интернет и вход в аккаунт.')}finally{setLoading(false)}};
  useEffect(()=>{void load()},[]);
  return <><Header eyebrow="Учебный журнал" title="Результаты"><button className="button" disabled={loading} onClick={()=>void load()}>{loading?'Обновляем…':'Обновить'}</button></Header>{error&&<div className="warning">{error}</div>}<div className="table-wrap"><table><thead><tr><th>Ученик</th><th>Тест</th><th>Дата</th><th>Баллы</th><th>Результат</th><th>Оценка</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><b>{r.student.lastName} {r.student.firstName}</b><small>{r.student.group}</small></td><td>{testService.get(r.testId)?.title??'Удалённый тест'}</td><td>{new Date(r.completedAt).toLocaleDateString('ru')}</td><td>{r.score} / {r.maxScore}</td><td><span className="score">{r.percentage}%</span></td><td><b>{r.grade}</b></td></tr>)}</tbody></table>{!loading&&!rows.length&&<div className="empty"><h3>Попыток пока нет</h3><p>Результаты появятся после прохождения опубликованных тестов.</p></div>}</div></>
}
