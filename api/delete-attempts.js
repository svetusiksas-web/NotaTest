import backend from'../server/backend.cjs';
export default backend.handler((actor,body)=>backend.deleteAttempts(actor,body),{teacher:true});
