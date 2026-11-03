import backend from'../server/backend.cjs';
export default backend.handler((actor,body)=>backend.publishTest(actor,body.test),{teacher:true});
