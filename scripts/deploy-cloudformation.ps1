# Deploy CloudFormation stack for actsix-site-lambda and API Gateway
param(
    [string]$StackName = "actsix-deacon-care-system",
    [string]$TemplateFile = "cloudformation.yaml",
    [string]$S3Bucket = "deacon-care-system",
    [string]$S3Key = "site-lambda.zip"
)

Write-Host "Uploading Lambda zip to S3..."
aws s3 cp "dist/site-lambda.zip" "s3://$S3Bucket/$S3Key"

Write-Host "Deploying CloudFormation stack..."
aws cloudformation deploy `
    --stack-name $StackName `
    --template-file $TemplateFile `
    --parameter-overrides S3BucketName=$S3Bucket `
    --capabilities CAPABILITY_NAMED_IAM

Write-Host "Deployment complete."
aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs" --output table
