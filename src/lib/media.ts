export const IMAGE_TYPES=['image/jpeg','image/png','image/webp'];
export const AUDIO_TYPES=['audio/mpeg','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','audio/ogg'];
export type ImportedMedia={id:string;name:string;kind:'image'|'audio';url:string};

export function isSupportedMedia(file:File){return IMAGE_TYPES.includes(file.type)||AUDIO_TYPES.includes(file.type)}
export function mediaKind(file:File):'image'|'audio'|null{return IMAGE_TYPES.includes(file.type)?'image':AUDIO_TYPES.includes(file.type)?'audio':null}
export function fileToDataUrl(file:File):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file)})}
export async function importMediaFiles(files:FileList|File[]){const imported:ImportedMedia[]=[];const rejected:string[]=[];for(const file of Array.from(files)){const kind=mediaKind(file);if(!kind){rejected.push(file.name);continue}const limit=kind==='image'?5:15;if(file.size>limit*1024*1024){rejected.push(`${file.name} (больше ${limit} МБ)`);continue}imported.push({id:crypto.randomUUID(),name:file.name,kind,url:await fileToDataUrl(file)})}return{imported,rejected}}

export function attachMediaByOrder<T extends {imageUrl?:string;imageName?:string;imageAlt?:string;audioUrl?:string;audioName?:string}>(questions:T[],media:ImportedMedia[]):T[]{const images=media.filter(m=>m.kind==='image'),audio=media.filter(m=>m.kind==='audio');return questions.map((q,i)=>({...q,...(images[i]?{imageUrl:images[i].url,imageName:images[i].name,imageAlt:images[i].name.replace(/\.[^.]+$/,'')}:{ }),...(audio[i]?{audioUrl:audio[i].url,audioName:audio[i].name}:{ })}))}
