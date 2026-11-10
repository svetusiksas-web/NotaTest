import type {Gap,Question,QuestionType} from '../types';
import {id} from './id';

export interface ParseResult{questions:Question[];unrecognized:string[]}

const answerPattern=/^(?:Ответ|Правильный ответ|Адказ|Правільны адказ):\s*/i;
const typePattern=/^Тип:\s*(.+)$/i;
const modePattern=/^Режим:\s*(.+)$/i;
const optionPattern=/^([-•*]|[A-Za-zА-Яа-яЁёІіЎў])(?:[.)])?\s*(.+)$/;
const questionStart=/^(?:(?:Вопрос|Пытанне)\s*)?\d+[.)]?\s+(.+)$/i;
const normalize=(value:string)=>value.trim().toLocaleLowerCase('ru');
const list=(value:string)=>value.split(/[;|]/).map(x=>x.trim()).filter(Boolean);

const typeAliases:Record<string,QuestionType>={
  'один ответ':'single','один правильный ответ':'single','single':'single',
  'несколько ответов':'multiple','несколько правильных ответов':'multiple','multiple':'multiple',
  'короткий ответ':'short','short':'short',
  'сопоставление':'matching','matching':'matching',
  'последовательность':'ordering','ordering':'ordering',
  'сортировка':'sorting','sorting':'sorting',
  'пропуски':'gaps','gaps':'gaps'
};

function blocks(raw:string){
  const result:string[][]=[];let current:string[]=[];
  for(const source of raw.split(/\r?\n/)){
    const line=source.trim();
    if(questionStart.test(line)&&current.length){result.push(current);current=[]}
    if(line||current.length)current.push(line);
  }
  if(current.some(Boolean))result.push(current);
  return result.map(lines=>lines.filter(Boolean));
}

function parseStructured(type:QuestionType,text:string,lines:string[]):Question|undefined{
  const base={id:id(),type,text,points:1};
  if(type==='matching'){
    const pairs=lines.map(line=>line.split(/\s*(?:=>|—|→)\s*/,2)).filter(parts=>parts.length===2&&parts.every(Boolean)).map(([left,right])=>({id:id(),left,right}));
    return pairs.length>=2?{...base,pairs}:undefined;
  }
  if(type==='ordering'){
    const items=lines.map(line=>line.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
    return items.length>=2?{...base,items}:undefined;
  }
  if(type==='sorting'){
    const categories:NonNullable<Question['categories']>=[];const sortItems:NonNullable<Question['sortItems']>=[];
    for(const line of lines){const separator=line.indexOf(':');if(separator<1)continue;const name=line.slice(0,separator).trim();const categoryId=id();const items=list(line.slice(separator+1));if(!name||!items.length)continue;categories.push({id:categoryId,name});items.forEach(item=>sortItems.push({id:id(),text:item,categoryId}))}
    return categories.length>=2&&sortItems.length?{...base,categories,sortItems}:undefined;
  }
  if(type==='gaps'){
    const modeLine=lines.find(line=>modePattern.test(line));const gapMode:NonNullable<Question['gapMode']>=normalize(modeLine?.replace(modePattern,'$1')??'').includes('спис')?'select':'input';const gaps:Gap[]=[];
    for(const line of lines.filter(x=>!modePattern.test(x))){const match=line.match(/^\{?\{?(\d+)\}?\}?:\s*(.+)$/);if(!match)continue;const [answersPart,choicesPart]=match[2].split(/\s*=>\s*/,2);const acceptedAnswers=list(answersPart);let choices=list(choicesPart??'');if(gapMode==='select')choices=[...new Set([...acceptedAnswers,...choices])];if(acceptedAnswers.length)gaps[Number(match[1])-1]={id:id(),acceptedAnswers,choices}}
    return gaps.length&&gaps.every(Boolean)?{...base,gapMode,gaps}:undefined;
  }
  return undefined;
}

function parseBlock(lines:string[]):Question|undefined{
  const first=lines[0]?.match(questionStart);if(!first)return undefined;const text=first[1].trim();const typeLine=lines.find(line=>typePattern.test(line));const explicitType=typeLine?typeAliases[normalize(typeLine.replace(typePattern,'$1'))]:undefined;const body=lines.slice(1).filter(line=>line!==typeLine);
  if(explicitType==='matching'||explicitType==='ordering'||explicitType==='sorting'||explicitType==='gaps')return parseStructured(explicitType,text,body);
  const answerLine=body.find(line=>answerPattern.test(line));if(!answerLine)return undefined;const rawAnswer=answerLine.replace(answerPattern,'');
  if(explicitType==='short'||body.filter(line=>line!==answerLine&&optionPattern.test(line)).length===0)return{id:id(),type:'short',text,points:1,acceptedAnswers:list(rawAnswer)};
  const answers=rawAnswer.split(/[,;]/).map(normalize).filter(Boolean);const optionLines=body.filter(line=>line!==answerLine&&optionPattern.test(line));const options=optionLines.map(line=>{const match=line.match(optionPattern)!;const label=normalize(match[1]);const value=match[2].trim();return{id:id(),text:value,isCorrect:answers.includes(label)||answers.includes(normalize(value))}});
  if(!options.some(option=>option.isCorrect))return undefined;const type:QuestionType=explicitType??(options.filter(option=>option.isCorrect).length>1?'multiple':'single');return{id:id(),type,text,points:1,options};
}

export function parseQuestions(raw:string):ParseResult{const questions:Question[]=[];const unrecognized:string[]=[];for(const lines of blocks(raw)){const question=parseBlock(lines);question?questions.push(question):unrecognized.push(lines.join('\n'))}return{questions,unrecognized}}
