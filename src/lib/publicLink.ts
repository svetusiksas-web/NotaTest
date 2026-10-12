export function studentTestUrl(slug:string){
  const base=`${window.location.origin}${window.location.pathname}`;
  return `${base}#/t/${encodeURIComponent(slug)}`;
}

export async function copyStudentTestUrl(slug:string){
  const url=studentTestUrl(slug);
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(url);
  else{
    const input=document.createElement('textarea');
    input.value=url;input.style.position='fixed';input.style.opacity='0';
    document.body.appendChild(input);input.select();
    if(!document.execCommand('copy'))throw new Error('COPY_FAILED');
    input.remove();
  }
  return url;
}
