const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

const LAMBDA_NAME = 'actsix-site-lambda';
const ZIP_FILE = path.join(__dirname, '../dist/site-lambda.zip');
const HANDLER = 'src/lambda.handler';
const ROLE_ARN = 'arn:aws:iam::YOUR_ACCOUNT_ID:role/YOUR_LAMBDA_ROLE';
const REGION = 'us-west-2';

AWS.config.update({ region: REGION });
const lambda = new AWS.Lambda();
const apiGateway = new AWS.APIGateway();
const iam = new AWS.IAM();

async function createLambdaRole() {
    const roleName = 'actsix-lambda-role';

    try {
        const existingRole = await iam.getRole({ RoleName: roleName }).promise();
        console.log('IAM Role already exists:', existingRole.Role.Arn);
        return existingRole.Role.Arn;
    } catch (error) {
        if (error.code === 'NoSuchEntity') {
            console.log('Creating IAM Role for Lambda...');

            const assumeRolePolicyDocument = {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com'
                        },
                        Action: 'sts:AssumeRole'
                    }
                ]
            };

            const role = await iam.createRole({
                RoleName: roleName,
                AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicyDocument)
            }).promise();

            console.log('IAM Role created:', role.Role.Arn);

            console.log('Attaching policy to IAM Role...');
            await iam.attachRolePolicy({
                RoleName: roleName,
                PolicyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
            }).promise();

            // Attach S3 access policy for deacon-care-system bucket
            const s3Policy = {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: [
                            's3:ListBucket',
                            's3:GetObject',
                            's3:PutObject',
                            's3:DeleteObject'
                        ],
                        Resource: [
                            'arn:aws:s3:::deacon-care-system',
                            'arn:aws:s3:::deacon-care-system/*'
                        ]
                    }
                ]
            };
            await iam.putRolePolicy({
                RoleName: roleName,
                PolicyName: 'DeaconCareSystemS3Access',
                PolicyDocument: JSON.stringify(s3Policy)
            }).promise();

            // Update trust relationship policy explicitly
            await iam.updateAssumeRolePolicy({
                RoleName: roleName,
                PolicyDocument: JSON.stringify(assumeRolePolicyDocument)
            }).promise();

            return role.Role.Arn;
        } else {
            throw error;
        }
    }
}

async function createOrUpdateLambda(roleArn) {
    const zipBuffer = fs.readFileSync(ZIP_FILE);
    const envVars = {
        S3_BUCKET: 'deacon-care-system'
    };
    try {
        const existingLambda = await lambda.getFunction({ FunctionName: LAMBDA_NAME }).promise();
        console.log('Lambda function already exists. Updating...');

        await lambda.updateFunctionCode({
            FunctionName: LAMBDA_NAME,
            ZipFile: zipBuffer
        }).promise();

        await lambda.updateFunctionConfiguration({
            FunctionName: LAMBDA_NAME,
            Environment: { Variables: envVars }
        }).promise();

        console.log('Lambda function code and environment updated.');
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.log('Lambda function does not exist. Creating...');

            await lambda.createFunction({
                FunctionName: LAMBDA_NAME,
                Runtime: 'nodejs22.x',
                Role: roleArn,
                Handler: HANDLER,
                Code: { ZipFile: zipBuffer },
                Timeout: 30,
                MemorySize: 128,
                Environment: { Variables: envVars }
            }).promise();

            console.log('Lambda function created.');
        } else {
            throw error;
        }
    }
}

async function getAccountId() {
    const sts = new AWS.STS();
    const identity = await sts.getCallerIdentity().promise();
    return identity.Account;
}

async function recreateRoutes(restApiId, resourceId, lambdaArn) {
    console.log('Recreating ANY method for /lambda/{proxy+}...');

    // Delete existing method if it exists
    try {
        await apiGateway.deleteMethod({
            restApiId,
            resourceId,
            httpMethod: 'ANY'
        }).promise();
        console.log('Deleted existing ANY method.');
    } catch (error) {
        console.log('No existing ANY method to delete:', error.message);
    }

    // Create new method
    await apiGateway.putMethod({
        restApiId,
        resourceId,
        httpMethod: 'ANY',
        authorizationType: 'NONE'
    }).promise();

    await apiGateway.putIntegration({
        restApiId,
        resourceId,
        httpMethod: 'ANY',
        type: 'AWS_PROXY',
        integrationHttpMethod: 'POST',
        uri: `arn:aws:apigateway:${REGION}:lambda:path/2015-03-31/functions/${lambdaArn}/invocations`
    }).promise();

    console.log('Recreated ANY method for /lambda/{proxy+}.');
}

async function setupApiGateway(lambdaArn) {
    const accountId = await getAccountId();

    const existingApis = await apiGateway.getRestApis({ limit: 500 }).promise();
    let restApi = existingApis.items.find(api => api.name === `${LAMBDA_NAME}-api`);

    if (!restApi) {
        console.log('Creating new API Gateway...');
        restApi = await apiGateway.createRestApi({ name: `${LAMBDA_NAME}-api` }).promise();
    } else {
        console.log('Using existing API Gateway:', restApi.id);
    }

    const resources = await apiGateway.getResources({ restApiId: restApi.id }).promise();
    let lambdaResource = resources.items.find(r => r.path === '/lambda');
    let proxyResource = resources.items.find(r => r.path === '/lambda/{proxy+}');

    if (!lambdaResource) {
        console.log('Creating new resource for /lambda...');
        lambdaResource = await apiGateway.createResource({
            restApiId: restApi.id,
            parentId: resources.items[0].id,
            pathPart: 'lambda'
        }).promise();
    } else {
        console.log('Using existing resource for /lambda:', lambdaResource.id);
    }

    if (!proxyResource) {
        console.log('Creating new resource for /lambda/{proxy+}...');
        proxyResource = await apiGateway.createResource({
            restApiId: restApi.id,
            parentId: lambdaResource.id,
            pathPart: '{proxy+}'
        }).promise();
    } else {
        console.log('Using existing resource for /lambda/{proxy+}:', proxyResource.id);
    }

    await recreateRoutes(restApi.id, proxyResource.id, lambdaArn);

    console.log('Updating deployment stage...');
    await apiGateway.createDeployment({
        restApiId: restApi.id,
        stageName: 'prod'
    }).promise();

    console.log(`API Gateway URL: https://${restApi.id}.execute-api.${REGION}.amazonaws.com/prod/lambda`);

    // Add API Gateway as a trigger for the Lambda function
    const statementId = `APIGatewayAccess-${Date.now()}`; // Generate unique StatementId
    await lambda.addPermission({
        FunctionName: LAMBDA_NAME,
        StatementId: statementId,
        Action: 'lambda:InvokeFunction',
        Principal: 'apigateway.amazonaws.com',
        SourceArn: `arn:aws:execute-api:${REGION}:${accountId}:${restApi.id}/*/ANY/lambda/{proxy+}`
    }).promise();
}

async function main() {
    try {
        const roleArn = await createLambdaRole();
        await createOrUpdateLambda(roleArn);
        await setupApiGateway(`arn:aws:lambda:${REGION}:${await getAccountId()}:function:${LAMBDA_NAME}`);
    } catch (error) {
        console.error('Error deploying lambda and API Gateway:', error);
    }
}

main();
