import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";

export function objectKey(organizationId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `orgs/${organizationId}/${safeName}`;
}

export function createStorageClient() {
  const endpoint = process.env.S3_ENDPOINT;
  const config: S3ClientConfig = {
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  };
  if (endpoint) config.endpoint = endpoint;
  return new S3Client(config);
}

export async function ensureBucket(client = createStorageClient()) {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error("S3_BUCKET is not set.");
  const abortSignal = AbortSignal.timeout(2500);
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }), { abortSignal });
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }), {
      abortSignal: AbortSignal.timeout(2500),
    });
  }
  return bucket;
}
