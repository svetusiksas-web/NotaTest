import backend from'../server/backend.cjs';
export default backend.handler((actor,body)=>backend.teacherTelegram(actor,body),{teacher:true});
