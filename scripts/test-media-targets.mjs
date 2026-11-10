import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {attachMediaByOrder,mediaTarget}=await server.ssrLoadModule('/src/lib/media.ts');
 const questions=[{id:'q1',type:'single',text:'Тест',points:1,options:[{id:'a1',text:'A',isCorrect:true},{id:'a2',text:'B',isCorrect:false}]},{id:'q2',type:'matching',text:'Пары',points:1,pairs:[{id:'p1',left:'L',right:'R'}]}];
 const media=[{id:'m1',name:'1-question.jpg',kind:'image',url:'question-url'},{id:'m2',name:'1-answer-2.mp3',kind:'audio',url:'answer-url'},{id:'m3',name:'2-left-1.jpg',kind:'image',url:'left-url'},{id:'m4',name:'2-right-1.mp3',kind:'audio',url:'right-url'}];
 const result=attachMediaByOrder(questions,media);
 if(result[0].imageUrl!=='question-url'||result[0].options[1].audioUrl!=='answer-url'||result[1].pairs[0].leftImageUrl!=='left-url'||result[1].pairs[0].rightAudioUrl!=='right-url')throw new Error('Media targets were attached incorrectly.');
 if(mediaTarget('3-answer-Б.png')?.itemIndex!==1)throw new Error('Letter answer target was parsed incorrectly.');
 console.log('Media targets OK: question, answer, matching left, matching right');
}finally{await server.close()}
