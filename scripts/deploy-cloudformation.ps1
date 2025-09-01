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

# Pass CognitoUserPoolId and CognitoAppClientId to the Cognito stack deployment
aws cloudformation deploy `
    --template-file cognito-stack.yaml `
    --stack-name actsix-cognito-stack `
    --parameter-overrides CognitoUserPoolId=$CognitoUserPoolId CognitoAppClientId=$CognitoAppClientId `
    --capabilities CAPABILITY_NAMED_IAM

# Retrieve Cognito stack outputs
$CognitoUserPoolId = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
$CognitoAppClientId = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='AppClientId'].OutputValue" --output text
#$CognitoLoginUrl = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='CognitoLoginUrl'].OutputValue" --output text
$CognitoUserPoolDomain = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolDomain'].OutputValue" --output text
$CognitoLoginUrl = "https://$($CognitoUserPoolDomain).auth.$(aws configure get region).amazoncognito.com/login"

# Debugging: Log Cognito stack outputs
Write-Host "CognitoUserPoolId: $CognitoUserPoolId"
Write-Host "CognitoAppClientId: $CognitoAppClientId"
Write-Host "CognitoLoginUrl: $CognitoLoginUrl"
Write-Host "CognitoUserPoolDomain: $CognitoUserPoolDomain"


# Delete stack if in ROLLBACK_COMPLETE state
$StackStatus = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].StackStatus" --output text
if ($StackStatus -eq "ROLLBACK_COMPLETE") {
    Write-Host "Stack is in ROLLBACK_COMPLETE state. Deleting stack..."
    aws cloudformation delete-stack --stack-name $StackName
    Write-Host "Waiting for stack deletion to complete..."
    aws cloudformation wait stack-delete-complete --stack-name $StackName
}

# Deploy application stack
Write-Host "Uploading Lambda zip to S3..."
$S3ObjectVersion = aws s3api put-object --bucket $S3Bucket --key $S3Key --body "dist/site-lambda.zip" --query VersionId --output text

# Handle missing S3ObjectVersion
if (-not $S3ObjectVersion -or $S3ObjectVersion -eq "null") {
    Write-Host "S3ObjectVersion not returned or invalid. Using default value."
    $S3ObjectVersion = "null"
}

# Log the S3 Object Version ID
Write-Host "Using S3 Object Version ID: $S3ObjectVersion"

Write-Host "Deploying Application CloudFormation stack..."
aws cloudformation deploy `
    --stack-name $StackName `
    --template-file $TemplateFile `
    --parameter-overrides S3BucketName=$S3Bucket S3ObjectVersion=$S3ObjectVersion CognitoUserPoolId=$CognitoUserPoolId CognitoAppClientId=$CognitoAppClientId CognitoLoginUrl=$CognitoLoginUrl CognitoUserPoolDomain=$CognitoUserPoolDomain `
    --capabilities CAPABILITY_NAMED_IAM

# Debugging: Log application stack parameters
Write-Host "Deploying Application CloudFormation stack with parameters:"
Write-Host "S3BucketName=$S3Bucket"
Write-Host "S3ObjectVersion=$S3ObjectVersion"
Write-Host "CognitoUserPoolId=$CognitoUserPoolId"
Write-Host "CognitoAppClientId=$CognitoAppClientId"
Write-Host "CognitoLoginUrl=$CognitoLoginUrl"
Write-Host "CognitoUserPoolDomain=$CognitoUserPoolDomain"

Write-Host "Deployment complete."
aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs" --output table

# Check if application stack exists
$StackExists = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].StackStatus" --output text
if ($LASTEXITCODE -ne 0) {
    Write-Host "Application stack does not exist. Exiting..."
    exit $LASTEXITCODE
}

# Wait for Application CloudFormation stack to be fully deployed
Write-Host "Waiting for Application CloudFormation stack deployment to complete..."
aws cloudformation wait stack-create-complete --stack-name $StackName

# Retrieve ApiGatewayUrl after stack deployment
$ApiGatewayUrl = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text
Write-Host "Retrieved ApiGatewayUrl: $ApiGatewayUrl"

# Validate ApiGatewayUrl
if (-not $ApiGatewayUrl -or $ApiGatewayUrl -eq "None") {
    Write-Host "ApiGatewayUrl not retrieved or invalid. Exiting..."
    exit 1
}


# Configure CallbackURLs after application stack deployment
Write-Host "Configuring Cognito CallbackURLs..."
$CallbackURLs = "$ApiGatewayUrl/cognito"
# Log the Callback URL
Write-Host "Configuring Cognito CallbackURLs with: $CallbackURLs"
aws cognito-idp update-user-pool-client `
    --user-pool-id $CognitoUserPoolId `
    --client-id $CognitoAppClientId `
    --callback-urls $CallbackURLs
    
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to configure CallbackURLs. Exiting..."
    exit $LASTEXITCODE
}
