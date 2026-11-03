import backend from'../server/backend.cjs';
export default backend.handler(actor=>backend.migratePublishedTests(actor),{admin:true});
