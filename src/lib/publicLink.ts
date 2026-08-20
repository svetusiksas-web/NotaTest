export function studentTestUrl(slug:string){
  const base=`${window.location.origin}${window.location.pathname}`;
  return `${base}#/test/${encodeURIComponent(slug)}`;
}

export async function copyStudentTestUrl(slug:string){
  const url=studentTestUrl(slug);
  await navigator.clipboard.writeText(url);
  return url;
}
