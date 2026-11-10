import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {questionMaxScore,scoreQuestion}=await server.ssrLoadModule('/src/lib/scoring.ts');
 const ordering={id:'q',type:'ordering',text:'Порядок',points:1,items:['A','B','C','D','E']};
 if(questionMaxScore(ordering)!==5)throw new Error('Ordering maximum must equal item count.');
 if(scoreQuestion(ordering,['A','C','B','D','E'])!==3)throw new Error('Ordering must award one point for each correctly positioned item.');
 if(scoreQuestion(ordering,['E','D','C','B','A'])!==1)throw new Error('Ordering partial score is incorrect.');
 const sorting={id:'s',type:'sorting',text:'Категории',points:1,categories:[{id:'c1',name:'Первая'},{id:'c2',name:'Вторая'}],sortItems:[{id:'i1',text:'A',categoryId:'c1'},{id:'i2',text:'B',categoryId:'c1'},{id:'i3',text:'C',categoryId:'c2'},{id:'i4',text:'D',categoryId:'c2'}]};
 if(questionMaxScore(sorting)!==4||scoreQuestion(sorting,{i1:'c1',i2:'c2',i3:'c2',i4:'c1'})!==2)throw new Error('Sorting must award one point for each correctly categorized item.');
 const gap={id:'g',type:'gaps',text:'Назва {{1}}',points:1,gaps:[{id:'gap1',acceptedAnswers:['Дзявочыя песні']}]};
 if(scoreQuestion(gap,{gap1:'  Дзявочыя   песни  '})!==1)throw new Error('Belarusian і and Russian и must be treated as equivalent in text answers.');
 console.log('Scoring OK: partial element scores and Belarusian і/Russian и equivalence');
}finally{await server.close()}
