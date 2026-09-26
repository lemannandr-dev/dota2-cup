import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

function requiredEnv() {
	const endpoint = process.env.S3_ENDPOINT;
	const accessKeyId = process.env.S3_ACCESS_KEY;
	const secretAccessKey = process.env.S3_SECRET_KEY;
	const bucket = process.env.S3_BUCKET || 'media-game-cup';
	if (!endpoint || !accessKeyId || !secretAccessKey) return null;
	return { endpoint, accessKeyId, secretAccessKey, bucket, region: process.env.S3_REGION || 'us-east-1' };
}

export function s3Configured() {
	return Boolean(requiredEnv());
}

function client() {
	const env = requiredEnv();
	if (!env) throw new Error('S3 is not configured');
	return {
		bucket: env.bucket,
		s3: new S3Client({
			region: env.region,
			endpoint: env.endpoint,
			forcePathStyle: true,
			credentials: { accessKeyId: env.accessKeyId, secretAccessKey: env.secretAccessKey }
		})
	};
}

async function ensureBucket() {
	const { s3, bucket } = client();
	try {
		await s3.send(new HeadBucketCommand({ Bucket: bucket }));
	} catch {
		await s3.send(new CreateBucketCommand({ Bucket: bucket }));
	}
	return { s3, bucket };
}

export async function putPrivateObject(key: string, body: Buffer, contentType: string) {
	const { s3, bucket } = await ensureBucket();
	await s3.send(
		new PutObjectCommand({
			Bucket: bucket,
			Key: key,
			Body: body,
			ContentType: contentType
		})
	);
	return { bucket, key };
}

export async function getPrivateObject(key: string) {
	const { s3, bucket } = client();
	const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
	const bytes = object.Body ? Buffer.from(await object.Body.transformToByteArray()) : Buffer.alloc(0);
	return { bytes, contentType: object.ContentType || 'application/octet-stream' };
}
