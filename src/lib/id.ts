export const id=()=>crypto.randomUUID?.()??`${Date.now()}-${Math.random()}`;
export const slugify=(s:string)=>s.toLowerCase().trim().replace(/[^a-zа-яё0-9]+/gi,'-').replace(/^-|-$/g,'')||id().slice(0,8);
