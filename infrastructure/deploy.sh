#!/usr/bin/env bash
#
# PrivacyPrint AWS deployment (hackathon track: "Deployed, with a URL").
#
# Deploys, in dependency order:
#   1. S3 document bucket            (privacyprint-document-storage)
#   2. DynamoDB job/tenant tables    (privacyprint-database)
#   3. Expiry worker Lambda + code   (privacyprint-expiry-worker)
#   4. EventBridge schedule          (privacyprint-retention-schedule)
#   5. API Lambda + Function URL     (privacyprint-api)
#   6. Web static hosting            (privacyprint-web) + SPA upload
#
# Prerequisites: AWS CLI v2 installed and configured (`aws configure`),
# `zip` available, Node/npm available. Credentials are read from your
# environment/profile — never passed as command-line arguments here.
#
# Usage: REGION=ap-south-1 ./infrastructure/deploy.sh [--dry-run]

set -euo pipefail

REGION="${REGION:-ap-south-1}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOCLI=--no-cli-pager

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1 || DRY_RUN=0
run() { if [[ "$DRY_RUN" == 1 ]]; then echo "[dry-run] $*"; else "$@"; fi; }

log "Checking AWS identity"
run aws sts get-caller-identity --region "$REGION" $NOCLI
ACCOUNT_ID="$(aws sts get-caller-identity --region "$REGION" --query Account --output text $NOCLI)"
DEPLOY_BUCKET="privacyprint-deploy-${ACCOUNT_ID}-${REGION}"
log "Using deployment staging bucket s3://${DEPLOY_BUCKET}"
if ! aws s3api head-bucket --bucket "$DEPLOY_BUCKET" 2>/dev/null; then
  run aws s3api create-bucket \
    --bucket "$DEPLOY_BUCKET" \
    --region "$REGION" \
    $([[ "$REGION" == "us-east-1" ]] && echo "" || echo "--create-bucket-configuration LocationConstraint=${REGION}")
fi
run aws s3api put-public-access-block --bucket "$DEPLOY_BUCKET" --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true || true

# --- 1. S3 document storage -------------------------------------------------
log "Deploying S3 document storage stack"
run aws cloudformation deploy \
  --template-file "$ROOT/infrastructure/s3/template.json" \
  --stack-name privacyprint-document-storage \
  --region "$REGION" --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset $NOCLI
DOCUMENT_BUCKET="$(aws cloudformation describe-stacks --stack-name privacyprint-document-storage \
  --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`DocumentBucketName`].OutputValue' --output text $NOCLI)"
log "Document bucket: $DOCUMENT_BUCKET"

# --- 2. DynamoDB tables -----------------------------------------------------
log "Deploying DynamoDB stacks"
run aws cloudformation deploy \
  --template-file "$ROOT/infrastructure/dynamodb/template.json" \
  --stack-name privacyprint-database \
  --region "$REGION" --no-fail-on-empty-changeset $NOCLI

# --- 3. Expiry worker Lambda -------------------------------------------------
log "Building the expiry worker deployment package"
(
  cd "$ROOT/services/expiry-worker"
  npm install --omit=dev --no-audit --no-fund
  mkdir -p dist
  rm -f dist/lambda.zip
  (cd src && zip -q -r ../dist/lambda.zip .)
  zip -q -r dist/lambda.zip node_modules
)
log "Deploying expiry worker Lambda"
run aws cloudformation package \
  --template-file "$ROOT/infrastructure/lambda/template.json" \
  --s3-bucket "$DEPLOY_BUCKET" --s3-prefix expiry-worker \
  --output-template-file "$ROOT/infrastructure/lambda/packaged.json"
run aws cloudformation deploy \
  --template-file "$ROOT/infrastructure/lambda/packaged.json" \
  --stack-name privacyprint-expiry-worker \
  --parameter-overrides DocumentBucketName="$DOCUMENT_BUCKET" JobsTableName="privacyprint-jobs" \
  --region "$REGION" --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset $NOCLI
EXPIRY_ARN="$(aws cloudformation describe-stacks --stack-name privacyprint-expiry-worker \
  --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`ExpireJobsFunctionArn`].OutputValue' --output text $NOCLI)"

# --- 4. EventBridge schedule -------------------------------------------------
log "Deploying the retention schedule"
run aws cloudformation deploy \
  --template-file "$ROOT/infrastructure/eventbridge/template.json" \
  --stack-name privacyprint-retention-schedule \
  --parameter-overrides LambdaArn="$EXPIRY_ARN" \
  --region "$REGION" --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset $NOCLI

# --- 5. Web hosting ----------------------------------------------------------
log "Deploying web static hosting"
run aws cloudformation deploy \
  --template-file "$ROOT/infrastructure/web/template.json" \
  --stack-name privacyprint-web \
  --region "$REGION" --no-fail-on-empty-changeset $NOCLI
WEB_BUCKET="$(aws cloudformation describe-stacks --stack-name privacyprint-web \
  --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`WebBucketName`].OutputValue' --output text $NOCLI)"
WEBSITE_URL="$(aws cloudformation describe-stacks --stack-name privacyprint-web \
  --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`WebsiteURL`].OutputValue' --output text $NOCLI)"
CLOUDFRONT_URL="$(aws cloudformation describe-stacks --stack-name privacyprint-web \
  --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`CloudFrontURL`].OutputValue' --output text $NOCLI)"
log "Web S3: $WEBSITE_URL"
log "Web CloudFront (HTTPS): $CLOUDFRONT_URL"

# --- 6. API Lambda -----------------------------------------------------------
log "Building the API deployment package"
(
  cd "$ROOT/apps/api"
  npm install --no-audit --no-fund
  mkdir -p dist
  rm -f dist/lambda.zip
  zip -q -r dist/lambda.zip src node_modules package.json
)
log "Deploying API Lambda"
run aws cloudformation package \
  --template-file "$ROOT/infrastructure/api/template.json" \
  --s3-bucket "$DEPLOY_BUCKET" --s3-prefix api \
  --output-template-file "$ROOT/infrastructure/api/packaged.json"

AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -hex 32)}"
SHOP_DEMO_PASSCODE="${SHOP_DEMO_PASSCODE:-privacyprint-demo}"

run aws cloudformation deploy \
  --template-file "$ROOT/infrastructure/api/packaged.json" \
  --stack-name privacyprint-api \
  --parameter-overrides \
      DocumentBucketName="$DOCUMENT_BUCKET" \
      AuthSecret="$AUTH_SECRET" \
      ShopDemoPasscode="$SHOP_DEMO_PASSCODE" \
      CorsOrigin="${CORS_ORIGIN:-http://localhost:5173,$WEBSITE_URL,$CLOUDFRONT_URL}" \
  --region "$REGION" --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset $NOCLI
API_URL="$(aws cloudformation describe-stacks --stack-name privacyprint-api \
  --region "$REGION" --query 'Stacks[0].Outputs[?OutputKey==`ApiFunctionUrl`].OutputValue' --output text $NOCLI)"
log "API Function URL: $API_URL"

log "Building the web app against $API_URL"
(
  cd "$ROOT/apps/web"
  npm install --no-audit --no-fund
  VITE_API_BASE_URL="$API_URL" npm run build
)
log "Uploading the SPA to s3://$WEB_BUCKET"
run aws s3 sync "$ROOT/apps/web/dist" "s3://$WEB_BUCKET" --delete --cache-control "no-cache"

log "Deployment complete (region $REGION)"
printf '  API:         %s\n  Web (HTTPS): %s\n  Web (HTTP):  %s\n' "$API_URL" "$CLOUDFRONT_URL" "$WEBSITE_URL"
printf '  Health check: curl %sapi/health\n' "$API_URL"
printf '\nNext steps:\n'
printf '  1. Point the shop connector at the API URL (API_BASE_URL=%s)\n' "$API_URL"
printf '  2. Verify expiry: check the privacyprint-expire-jobs Lambda CloudWatch logs\n'
printf '  3. Tear down with the stack names above when the hackathon ends\n'