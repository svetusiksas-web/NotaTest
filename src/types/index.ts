export type QuestionType='single'|'multiple'|'short'|'matching'|'ordering';
export type TestStatus='draft'|'published'|'archived';
export interface Option {id:string;text:string;isCorrect:boolean}
export interface Pair {id:string;left:string;right:string}
export interface Question {id:string;type:QuestionType;text:string;points:number;options?:Option[];acceptedAnswers?:string[];pairs?:Pair[];items?:string[];imageUrl?:string;imageName?:string;imageAlt?:string;audioUrl?:string;audioName?:string}
export interface QuizTest {id:string;ownerId?:string;slug:string;title:string;subject:string;grade:string;topic:string;description:string;instructions:string;status:TestStatus;questions:Question[];createdAt:string;updatedAt:string}
export interface Student {firstName:string;lastName:string;group:string;comment:string}
export type Answer=string|string[]|Record<string,string>;
export interface Attempt {id:string;testId:string;ownerId?:string;student:Student;answers:Record<string,Answer>;score:number;maxScore:number;percentage:number;grade:number;completedAt:string}
