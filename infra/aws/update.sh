#!/usr/bin/env bash
# Ship the latest code to the running server: pull, rebuild, restart.
# Runs through Systems Manager, so no SSH key or open port 22 is needed.
#
#   ./infra/aws/update.sh
#   STACK=cropguard-dev REGION=us-east-1 ./infra/aws/update.sh
set -euo pipefail

STACK="${STACK:-cropguard}"
REGION="${REGION:-ap-south-1}"

INSTANCE=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='InstanceId'].OutputValue" --output text)
echo "Updating $INSTANCE ..."

COMMAND_ID=$(aws ssm send-command --region "$REGION" \
  --instance-ids "$INSTANCE" \
  --document-name AWS-RunShellScript \
  --comment "CropGuard update" \
  --parameters 'commands=["set -e","cd /opt/cropguard","git pull --ff-only","docker compose up -d --build","docker image prune -f","sleep 15","curl -fs http://127.0.0.1/api/health"]' \
  --query Command.CommandId --output text)

aws ssm wait command-executed --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE" || true
aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE" \
  --query '[Status,StandardOutputContent,StandardErrorContent]' --output text
