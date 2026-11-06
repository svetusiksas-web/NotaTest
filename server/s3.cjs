const {S3Client,PutObjectCommand,GetObjectCommand,HeadObjectCommand,ListObjectsV2Command}=require('@aws-sdk/client-s3');
const {getSignedUrl}=require('@aws-sdk/s3-request-presigner');

const required=name=>{const value=process.env[name];if(!value)throw Object.assign(new Error(`${name}_NOT_CONFIGURED`),{status:503});return value};
let cached;
function config(){return{endpoint:required('S3_ENDPOINT'),region:process.env.S3_REGION||'us-east-1',bucket:required('S3_BUCKET'),forcePathStyle:String(process.env.S3_FORCE_PATH_STYLE??'true').toLowerCase()!=='false'}}
function client(){if(cached)return cached;const value=config();cached=new S3Client({endpoint:value.endpoint,region:value.region,forcePathStyle:value.forcePathStyle,credentials:{accessKeyId:required('S3_ACCESS_KEY_ID'),secretAccessKey:required('S3_SECRET_ACCESS_KEY')}});return cached}
const uploadUrl=(key,contentType)=>getSignedUrl(client(),new PutObjectCommand({Bucket:config().bucket,Key:key,ContentType:contentType}),{expiresIn:300});
const downloadUrl=key=>getSignedUrl(client(),new GetObjectCommand({Bucket:config().bucket,Key:key,ResponseCacheControl:'private, max-age=300'}),{expiresIn:900});
const head=key=>client().send(new HeadObjectCommand({Bucket:config().bucket,Key:key}));
async function peek(key){const response=await client().send(new GetObjectCommand({Bucket:config().bucket,Key:key,Range:'bytes=0-31'}));return Buffer.from(await response.Body.transformToByteArray())}
async function listAll(prefix='media/'){prefix=prefix||'media/';const objects=[];let ContinuationToken;do{const page=await client().send(new ListObjectsV2Command({Bucket:config().bucket,Prefix:prefix,ContinuationToken}));objects.push(...(page.Contents??[]));ContinuationToken=page.IsTruncated?page.NextContinuationToken:undefined}while(ContinuationToken);return objects}
module.exports={uploadUrl,downloadUrl,head,peek,listAll};
