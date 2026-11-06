import backend from'../server/backend.cjs';
export default backend.handler(()=>backend.uploadSettings(),{teacher:true});
