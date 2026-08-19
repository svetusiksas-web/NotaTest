import React from 'react';import{createRoot}from'react-dom/client';import{HashRouter}from'react-router-dom';import App from './App';import{demo}from'./data/demo';import{initializeCloud,testService}from'./services/storage';import'./styles.css';import'./enhancements.css';
window.addEventListener('error',event=>{const root=document.getElementById('root');if(root&&!root.hasChildNodes())root.innerHTML=`<div style="padding:32px;font:16px system-ui;color:#733"><h2>Не удалось открыть NotaTest</h2><p>${event.message||'Неизвестная ошибка'}</p></div>`});
async function bootstrap(){await initializeCloud();if(!testService.all().length)testService.save(demo);createRoot(document.getElementById('root')!).render(<React.StrictMode><HashRouter><App/></HashRouter></React.StrictMode>)}
void bootstrap();
