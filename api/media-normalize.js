import backend from'../server/backend.cjs';
export default backend.handler((actor,body)=>backend.normalizeMediaTest(actor,body),{teacher:true});
