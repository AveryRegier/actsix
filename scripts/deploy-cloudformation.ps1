# Deploy CloudFormation stack for actsix-site-lambda and API Gateway
param(
    [string]$StackName = "actsix-deacon-care-system",
    [string]$TemplateFile = "cloudformation.yaml",
    [string]$S3Bucket = $env:S3_BUCKET,
    [string]$S3Key = "site-lambda.zip",
    [string]$S3ObjectVersion = "<latest-version-id>",
    [switch]$DeployCognitoStack = $false
)


# Deploy Cognito stack first
$CognitoStackName = "actsix-cognito-stack"
$CognitoTemplateFile = "cognito-stack.yaml"

if ($DeployCognitoStack) {
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
}

# # Retrieve Cognito stack outputs
# $CognitoUserPoolId = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
# $CognitoAppClientId = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='AppClientId'].OutputValue" --output text
# #$CognitoLoginUrl = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='CognitoLoginUrl'].OutputValue" --output text
# $CognitoUserPoolDomain = aws cloudformation describe-stacks --stack-name $CognitoStackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolDomain'].OutputValue" --output text
# $CognitoLoginUrl = "https://$($CognitoUserPoolDomain).auth.$(aws configure get region).amazoncognito.com/login"

# # Debugging: Log Cognito stack outputs
# Write-Host "CognitoUserPoolId: $CognitoUserPoolId"
# Write-Host "CognitoAppClientId: $CognitoAppClientId"
# Write-Host "CognitoLoginUrl: $CognitoLoginUrl"
# Write-Host "CognitoUserPoolDomain: $CognitoUserPoolDomain"


# Delete stack if in ROLLBACK_COMPLETE state
$StackStatus = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].StackStatus" --output text
if ($StackStatus -eq "ROLLBACK_COMPLETE") {
    Write-Host "Stack is in ROLLBACK_COMPLETE state. Deleting stack..."
    aws cloudformation delete-stack --stack-name $StackName
    Write-Host "Waiting for stack deletion to complete..."
    aws cloudformation wait stack-delete-complete --stack-name $StackName
}

# Determine whether the application stack exists before deploy (used to pick the correct waiter)
$stackExists = $false
$preCheck = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].StackStatus" --output text 2>$null
if ($LASTEXITCODE -eq 0 -and $preCheck) {
    $stackExists = $true
    Write-Host "Detected existing stack with status: $preCheck"
} else {
    Write-Host "No existing stack detected; a new stack will be created."
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

# Read desired environment parameter values from environment variables (fall back to empty strings)
$pcClientId = $env:PLANNING_CENTER_CLIENT_ID
if (-not $pcClientId) { $pcClientId = "" }
$pcClientSecret = $env:PLANNING_CENTER_CLIENT_SECRET
if (-not $pcClientSecret) { $pcClientSecret = "" }
$oidcDiscovery = $env:OIDC_DISCOVERY_URL
if (-not $oidcDiscovery) { $oidcDiscovery = "" }
$pcApiUrl = $env:PLANNING_CENTER_API_URL
if (-not $pcApiUrl) { $pcApiUrl = "" }
$allowedOrgId = $env:ALLOWED_ORGANIZATION_ID
if (-not $allowedOrgId) { $allowedOrgId = "" }
$customDomainName = $env:CUSTOM_DOMAIN_NAME
if (-not $customDomainName) { $customDomainName = "" }
$customDomainCert = $env:CUSTOM_DOMAIN_CERT_ARN
if (-not $customDomainCert) { $customDomainCert = "" }

# Read additional environment variables requested by the user (take from local environment)
$generationApiKey = $env:GENERATION_API_KEY
if (-not $generationApiKey) { $generationApiKey = "" }
## Note: we do not pass AWS_PROFILE into Lambda; it's only used locally for AWS CLI operations.
# Do not read or forward AWS_PROFILE into CloudFormation parameters.
$jwtSecret = $env:JWT_SECRET
if (-not $jwtSecret) { $jwtSecret = "" }
$gmailAppPassword = $env:GMAIL_APP_PASSWORD
if (-not $gmailAppPassword) { $gmailAppPassword = "" }
$gmailFromAddress = $env:GMAIL_FROM_ADDRESS
if (-not $gmailFromAddress) { $gmailFromAddress = "" }

# Validate required sensitive environment variables are present before attempting deploy.
# Fail fast with a clear message so we don't deploy a stack with empty credentials.
$missing = @()
if (-not $generationApiKey -or $generationApiKey -eq "") { $missing += 'GENERATION_API_KEY' }
if (-not $jwtSecret -or $jwtSecret -eq "") { $missing += 'JWT_SECRET' }
if (-not $gmailAppPassword -or $gmailAppPassword -eq "") { $missing += 'GMAIL_APP_PASSWORD' }
if (-not $gmailFromAddress -or $gmailFromAddress -eq "") { $missing += 'GMAIL_FROM_ADDRESS' }
if ($missing.Count -gt 0) {
    Write-Host "Missing required environment variables for deploy: $($missing -join ', ')"
    Write-Host "Set them in your shell (PowerShell example):"
    Write-Host "  `$env:GENERATION_API_KEY = '...'; `$env:JWT_SECRET = '...'; `$env:GMAIL_APP_PASSWORD = '...'; `$env:GMAIL_FROM_ADDRESS = 'you@example.com'"
    exit 1
}

aws cloudformation deploy `
    --stack-name $StackName `
    --template-file $TemplateFile `
    --parameter-overrides S3BucketName=$S3Bucket S3ObjectVersion=$S3ObjectVersion `
        PlanningCenterClientId="$pcClientId" PlanningCenterClientSecret="$pcClientSecret" `
        OIDCDiscoveryUrl="$oidcDiscovery" PlanningCenterApiUrl="$pcApiUrl" AllowedOrganizationId="$allowedOrgId" `
        CustomDomainName="$customDomainName" CustomDomainCertificateArn="$customDomainCert" `
    GENERATIONAPIKEY="$generationApiKey" JWTSECRET="$jwtSecret" GMAILAPPPASSWORD="$gmailAppPassword" GMAILFROMADDRESS="$gmailFromAddress" `
    --capabilities CAPABILITY_NAMED_IAM

if ($LASTEXITCODE -ne 0) {
    Write-Host "CloudFormation deploy command failed (exit code $LASTEXITCODE). Printing recent stack events for diagnosis..."
    aws cloudformation describe-stack-events --stack-name $StackName --max-items 30 --output table
    exit $LASTEXITCODE
}

# CognitoUserPoolId=$CognitoUserPoolId CognitoAppClientId=$CognitoAppClientId CognitoLoginUrl=$CognitoLoginUrl CognitoUserPoolDomain=$CognitoUserPoolDomain 

# Debugging: Log application stack parameters
Write-Host "Deploying Application CloudFormation stack with parameters:"
Write-Host "S3BucketName=$S3Bucket"
Write-Host "S3ObjectVersion=$S3ObjectVersion"
#Write-Host "CognitoUserPoolId=$CognitoUserPoolId"
#Write-Host "CognitoAppClientId=$CognitoAppClientId"
#Write-Host "CognitoLoginUrl=$CognitoLoginUrl"
#Write-Host "CognitoUserPoolDomain=$CognitoUserPoolDomain"

Write-Host "Deployment complete."
aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs" --output table

# Wait for Application CloudFormation stack to be fully deployed (choose correct waiter based on pre-check)
Write-Host "Waiting for Application CloudFormation stack deployment to complete..."
if ($stackExists) {
    Write-Host "Waiting for stack update to complete..."
    aws cloudformation wait stack-update-complete --stack-name $StackName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Stack update failed or timed out. Recent stack events:"
        aws cloudformation describe-stack-events --stack-name $StackName --max-items 30 --output table
        exit $LASTEXITCODE
    }
} else {
    Write-Host "Waiting for stack create to complete..."
    aws cloudformation wait stack-create-complete --stack-name $StackName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Stack create failed or timed out. Recent stack events:"
        aws cloudformation describe-stack-events --stack-name $StackName --max-items 30 --output table
        exit $LASTEXITCODE
    }
}

# Retrieve ApiGatewayUrl after stack deployment
$ApiGatewayUrl = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs[?OutputKey=='ApiGatewayUrl'].OutputValue" --output text
Write-Host "Retrieved ApiGatewayUrl: $ApiGatewayUrl"

# Validate ApiGatewayUrl
if (-not $ApiGatewayUrl -or $ApiGatewayUrl -eq "None") {
    Write-Host "ApiGatewayUrl not retrieved or invalid. Exiting..."
    exit 1
}

# Extract API id from the ApiGatewayUrl (format: https://{apiId}.execute-api.{region}.amazonaws.com)
try {
    $apiHost = $ApiGatewayUrl -replace '^https?://',''
    $apiId = $apiHost.Split('.')[0]
    if (-not $apiId) {
        throw "Failed to parse apiId from $ApiGatewayUrl"
    }
    Write-Host "Detected ApiId: $apiId"
} catch {
    Write-Host "Could not extract ApiId from ApiGatewayUrl: $_"
    $apiId = $null
}

# Publish a new deployment for the HTTP API (apigatewayv2) and update the $default stage to point to it.
# This ensures the API stage uses the latest configuration without replacing the ApiGateway resource itself.
if ($apiId) {
    Write-Host "Creating API Gateway deployment for API ID: $apiId"
    $deploymentId = aws apigatewayv2 create-deployment --api-id $apiId --description "deploy $((Get-Date).ToString('o'))" --query 'DeploymentId' --output text
    if ($LASTEXITCODE -ne 0 -or -not $deploymentId -or $deploymentId -eq 'None') {
        Write-Host "Failed to create API deployment (or none returned). Skipping stage update."
    } else {
        Write-Host "Created deployment: $deploymentId. Updating stage 'default' to use this deployment."
        # Update the $default stage to point to the new deployment
        aws apigatewayv2 update-stage --api-id $apiId --stage-name '$default' --deployment-id $deploymentId
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to update stage to new deployment. You may need to run the update manually."
        } else {
            Write-Host "API Gateway stage updated to new deployment successfully."
        }
    }
} else {
    Write-Host "ApiId not available; skipping API deployment publish step."
}

if ($DeployCognitoStack) {
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
}
