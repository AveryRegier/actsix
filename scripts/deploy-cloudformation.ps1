# Deploy CloudFormation stack for actsix-site-lambda and API Gateway
param(
    [string]$StackName = "actsix-deacon-care-system",
    [string]$TemplateFile = "cloudformation.yaml",
    [string]$S3Bucket = "deacon-care-system",
    [string]$S3Key = "site-lambda.zip",
    [string]$S3ObjectVersion = "<latest-version-id>"
)

# Deploy Cognito stack first
$CognitoStackName = "actsix-cognito-stack"
$CognitoTemplateFile = "cognito-stack.yaml"

Write-Host "Deploying Cognito CloudFormation stack..."
aws cloudformation deploy `
    --stack-name $CognitoStackName `
    --template-file $CognitoTemplateFile `
    --capabilities CAPABILITY_NAMED_IAM

# Retrieve Cognito stack outputs
$CognitoUserPoolId = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
$CognitoAppClientId = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='AppClientId'].OutputValue" --output text

# Deploy application stack
Write-Host "Uploading Lambda zip to S3..."
$S3ObjectVersion = aws s3api put-object --bucket $S3Bucket --key $S3Key --body "dist/site-lambda.zip" --query VersionId --output text

Write-Host "Deploying Application CloudFormation stack..."
aws cloudformation deploy `
    --stack-name $StackName `
    --template-file $TemplateFile `
    --parameter-overrides S3BucketName=$S3Bucket S3ObjectVersion=$S3ObjectVersion CognitoUserPoolId=$CognitoUserPoolId CognitoAppClientId=$CognitoAppClientId `
    --capabilities CAPABILITY_NAMED_IAM

Write-Host "Deployment complete."
aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs" --output table

# Check if application stack exists
$StackExists = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].StackStatus" --output text
if ($LASTEXITCODE -ne 0) {
    Write-Host "Application stack does not exist. Exiting..."
    exit $LASTEXITCODE
}

# Retrieve ApiGateway URL dynamically
$ApiGatewayUrl = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to retrieve ApiGateway URL. Exiting..."
    exit $LASTEXITCODE
}

# Configure CallbackURLs after application stack deployment
Write-Host "Configuring Cognito CallbackURLs..."
aws cognito-idp update-user-pool-client `
    --user-pool-id $CognitoUserPoolId `
    --client-id $CognitoAppClientId `
    --callback-urls $ApiGatewayUrl/cognito
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to configure CallbackURLs. Exiting..."
    exit $LASTEXITCODE
}
