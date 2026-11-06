import backend from'../server/backend.cjs';
export default backend.handler((actor,body)=>backend.completeMediaUpload(actor,body),{teacher:true});
