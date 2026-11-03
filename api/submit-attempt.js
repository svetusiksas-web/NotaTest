import backend from'../server/backend.cjs';
export default backend.handler((_actor,body)=>backend.submitAttempt(body));
