
const { S3Client, ListObjectsCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

async function testS3Access() {
    try {
        console.log('Testing S3 access...');
        console.log(`Bucket: ${process.env.AWS_S3_BUCKET_NAME}`);
        console.log(`Region: ${process.env.AWS_REGION}`);
        const command = new ListObjectsCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            MaxKeys: 1
        });

        const response = await s3Client.send(command);
        console.log('S3 access successful!');
        console.log(response);
    } catch (error) {
        console.error('S3 access failed:');
        console.error(error.message);

        if (error.Code === 'AccessDenied') {
            console.log('\nPossible solutions:');
            console.log('1. Check if your AWS credentials are correct');
            console.log('2. Verify that the IAM user has proper S3 permissions');
            console.log('3. Check if the bucket exists and is in the correct region');
            console.log('4. Make sure there\'s no restrictive bucket policy');
        }
    }
}

testS3Access();