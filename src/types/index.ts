export type QuestionType='single'|'multiple'|'short'|'matching'|'ordering';
export type TestStatus='draft'|'published'|'archived';
export interface MediaRef {mediaId:string;objectKey:string;kind:'image'|'audio';name:string;contentType:string;size:number;url?:string}
export interface Option {id:string;text:string;isCorrect:boolean;imageUrl?:string;imageName?:string;imageAlt?:string;imageMedia?:MediaRef;audioUrl?:string;audioName?:string;audioMedia?:MediaRef}
export interface Pair {id:string;left:string;right:string;leftImageUrl?:string;leftImageName?:string;leftImageMedia?:MediaRef;leftAudioUrl?:string;leftAudioName?:string;leftAudioMedia?:MediaRef;rightImageUrl?:string;rightImageName?:string;rightImageMedia?:MediaRef;rightAudioUrl?:string;rightAudioName?:string;rightAudioMedia?:MediaRef}
export interface MatchingOption {id:string;text:string;imageUrl?:string;imageName?:string;imageMedia?:MediaRef;audioUrl?:string;audioName?:string;audioMedia?:MediaRef}
export interface Question {id:string;type:QuestionType;text:string;points:number;options?:Option[];acceptedAnswers?:string[];pairs?:Pair[];matchingOptions?:MatchingOption[];matchingAnswerMap?:Record<string,string>;items?:string[];imageUrl?:string;imageName?:string;imageAlt?:string;imageMedia?:MediaRef;audioUrl?:string;audioName?:string;audioMedia?:MediaRef}
export interface QuizTest {id:string;ownerId?:string;authorName?:string;slug:string;title:string;subject:string;grade:string;topic:string;description:string;instructions:string;status:TestStatus;questions:Question[];questionCount?:number;createdAt:string;updatedAt:string}
export interface Student {firstName:string;lastName:string;group:string;comment:string}
export type Answer=string|string[]|Record<string,string>;
export interface Attempt {id:string;testId:string;ownerId?:string;testTitle?:string;student:Student;answers:Record<string,Answer>;score:number;maxScore:number;percentage:number;grade:number;completedAt:string}
export type UserRole='admin'|'teacher';
export type AccountStatus='pending'|'active'|'blocked';
export interface UserProfile {uid:string;email:string;displayName:string;role:UserRole;status:AccountStatus;createdAt:string;approvedAt?:string;approvedBy?:string}
