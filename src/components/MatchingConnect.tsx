import {X} from 'lucide-react';
import {useLayoutEffect,useRef,useState} from 'react';
import type {Answer,Question} from '../types';

export function MatchingConnect({q,value,set}:{q:Question;value:Answer|undefined;set:(answer:Answer)=>void}){
  const pairs=q.pairs??[];const answer=(value as Record<string,string>|undefined)??{};
  const options=q.matchingOptions??pairs.map(pair=>({id:pair.id,text:pair.right,imageUrl:pair.rightImageUrl,audioUrl:pair.rightAudioUrl}));
  const root=useRef<HTMLDivElement>(null);const left=useRef<Record<string,HTMLButtonElement|null>>({});const right=useRef<Record<string,HTMLButtonElement|null>>({});const[,redraw]=useState(0);
  useLayoutEffect(()=>{const update=()=>redraw(x=>x+1);const observer=new ResizeObserver(update);if(root.current)observer.observe(root.current);window.addEventListener('resize',update);return()=>{observer.disconnect();window.removeEventListener('resize',update)}},[]);
  const box=root.current?.getBoundingClientRect();
  const lines=Object.entries(answer).filter(([key])=>key!=='__selected').flatMap(([leftId,rightId],index)=>{const a=left.current[leftId]?.getBoundingClientRect(),b=right.current[rightId]?.getBoundingClientRect();return a&&b&&box?[<line key={leftId} x1={a.right-box.left} y1={a.top+a.height/2-box.top} x2={b.left-box.left} y2={b.top+b.height/2-box.top} className={`match-line line-${index%6}`}/>] :[]});
  const chooseLeft=(pairId:string)=>{if(answer[pairId]){const next={...answer};delete next[pairId];set(next)}else set({...answer,__selected:pairId})};
  const chooseRight=(optionId:string)=>{const selected=answer.__selected;if(!selected)return;const next=Object.fromEntries(Object.entries(answer).filter(([key,val])=>key!=='__selected'&&val!==optionId));set({...next,[selected]:optionId})};
  return <div className="matching-connect" ref={root}><svg aria-hidden="true">{lines}</svg><div className="match-column">{pairs.map((pair,index)=><button type="button" key={pair.id} ref={el=>{left.current[pair.id]=el}} className={answer.__selected===pair.id?'selected':answer[pair.id]?'connected':''} onClick={()=>chooseLeft(pair.id)}>{pair.leftImageUrl&&<img src={pair.leftImageUrl} alt=""/>}{pair.leftAudioUrl&&<audio controls src={pair.leftAudioUrl}/>}<span>{pair.left||`Элемент ${index+1}`}</span>{answer[pair.id]&&<X/>}</button>)}</div><div className="match-column">{options.map((option,index)=><button type="button" key={option.id} ref={el=>{right.current[option.id]=el}} className={Object.values(answer).includes(option.id)?'connected':''} onClick={()=>chooseRight(option.id)}>{option.imageUrl&&<img src={option.imageUrl} alt=""/>}{option.audioUrl&&<audio controls src={option.audioUrl}/>}<span>{option.text||`Вариант ${index+1}`}</span></button>)}</div></div>;
}
