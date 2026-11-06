import backend from'../server/backend.cjs';
export default backend.handler((actor,body)=>backend.mediaUrls(actor,body));
