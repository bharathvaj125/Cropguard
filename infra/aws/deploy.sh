#!/usr/bin/env bash
# Create or update the CropGuard stack on AWS.
#
#   ./infra/aws/deploy.sh                      # stack "cropguard" in ap-south-1 (Mumbai)
#   STACK=cropguard-dev REGION=us-east-1 ./infra/aws/deploy.sh
#   ./infra/aws/deploy.sh InstanceType=t3.small AdminEmail=you@example.com
#
# Needs the AWS CLI v2, signed in to an account that can create the resources in
# cropguard.yaml (EC2, S3, IAM role, Secrets Manager, CloudFront).
set -euo pipefail

STACK="${STACK:-cropguard}"
REGION="${REGION:-ap-south-1}"
HERE="$(cd "$(dirname "$0")" && pwd)"

echo "Deploying stack '$STACK' to $REGION. The first deploy takes 10-20 minutes:"
echo "the server builds the containers, and CloudFront needs a few minutes to go live."

overrides=()
if [ "$#" -gt 0 ]; then overrides=(--parameter-overrides "$@"); fi

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file "$HERE/cropguard.yaml" \
  --capabilities CAPABILITY_IAM \
  "${overrides[@]}"

aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output table
