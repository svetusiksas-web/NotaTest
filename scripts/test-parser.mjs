import {createServer} from 'vite';
const server=await createServer({server:{middlewareMode:true},appType:'custom'});
try{
 const {parseQuestions}=await server.ssrLoadModule('/src/lib/parser.ts');
 const sample=`1. Выберите один вариант
А) Первый
Б) Второй
Ответ: Б

2. Выберите несколько вариантов
А) Первый
Б) Второй
В) Третий
Ответ: А, В

3. Назовите термин
Ответ: Доминанта | доминантовая функция

4. Найдите пары
Тип: Сопоставление
Чайковский => Щелкунчик
Мусоргский => Борис Годунов

5. Расположите по порядку
Тип: Последовательность
- Начало
- Развитие
- Завершение

6. Распределите инструменты
Тип: Сортировка
Струнные: скрипка; виолончель
Духовые: флейта; труба

7. Заполните {{1}} и {{2}}
Тип: Пропуски
Режим: список
1: тоника | тоническая => тоника | доминанта
2: доминанта => субдоминанта | доминанта`;
 const result=parseQuestions(sample),types=result.questions.map(question=>question.type),expected=['single','multiple','short','matching','ordering','sorting','gaps'];
 if(result.unrecognized.length||JSON.stringify(types)!==JSON.stringify(expected))throw new Error(`Parser failed: ${JSON.stringify({types,unrecognized:result.unrecognized})}`);
 const [,,,matching,ordering,sorting,gaps]=result.questions;
 if(matching.pairs.length!==2||ordering.items.length!==3||sorting.categories.length!==2||sorting.sortItems.length!==4||gaps.gaps.length!==2||gaps.gapMode!=='select')throw new Error('Structured fields were parsed incorrectly.');
 console.log(`Parser OK: ${types.join(', ')}`);
}finally{await server.close()}
