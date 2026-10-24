#!/usr/bin/env bash
# Disposable AWS turbo-cache conformance lab (goal turborepo-cache-conformance, P2).
#
#   lab-aws.sh bootstrap <epoch>   lab KMS key + three SecureStrings + stack config
#   lab-aws.sh preview  <epoch>    pulumi preview of the lab stack only
#   lab-aws.sh up       <epoch>    pulumi up of the lab stack
#   lab-aws.sh destroy  <epoch>    empty bucket, destroy stack, delete params, schedule key deletion
#   lab-aws.sh inventory <epoch>   list anything still tagged for this lab (must be empty after destroy)
#
# Spending subcommands refuse to run unless BEEP_TCL_APPROVED_CEILING_USD names
# the operator-approved ceiling (see goals/turborepo-cache-conformance/research/lab-deployment-preview.md).
# Secret values are generated in-process and passed to AWS on stdin-free
# arguments only through a 0600 temporary file; nothing is printed.
set -euo pipefail
umask 077

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
account=832907639880
region=us-east-1
die() { printf 'lab-aws: %s\n' "$*" >&2; exit 1; }

cmd="${1:-}"; epoch="${2:-}"
[[ "$epoch" =~ ^[a-z0-9]{4,16}$ ]] || die "usage: lab-aws.sh bootstrap|preview|up|destroy|inventory <epoch>"
stack="lab-$epoch"
prefix="beep-tcl-$epoch"
bucket="$prefix-$account"
params="/beep-ci/cache-lab/$epoch"
tag_filter="Key=beep:lab,Values=turbo-cache-conformance"

require_approval() {
  [[ -n "${BEEP_TCL_APPROVED_CEILING_USD:-}" ]] || die "no approved cost ceiling; see lab-deployment-preview.md"
}
require_account() {
  local got; got="$(aws sts get-caller-identity --query Account --output text)"
  [[ "$got" == "$account" ]] || die "caller account is not the lab account"
}

bootstrap() {
  require_approval; require_account
  local key
  key="$(aws kms create-key --region "$region" --description "$prefix lab SecureStrings" \
    --tags TagKey=beep:lab,TagValue=turbo-cache-conformance --query KeyMetadata.Arn --output text)"
  local name
  for name in read-only-token trusted-write-token writer-hmac-secret; do
    local value_file; value_file="$(mktemp)"
    openssl rand -hex 32 | tr -d '\n' >"$value_file"
    aws ssm put-parameter --region "$region" --name "$params/$name" --type SecureString --key-id "$key" \
      --value "file://$value_file" --tags Key=beep:lab,Value=turbo-cache-conformance >/dev/null
    rm -f "$value_file"
  done
  (cd "$here" && pulumi stack init "$stack" >/dev/null &&
    pulumi config set --stack "$stack" turboCacheLab:epoch "$epoch" &&
    pulumi config set --stack "$stack" ciTurboCache:bucketName "$bucket" &&
    pulumi config set --stack "$stack" ciTurboCache:lambdaZipPath turbo-cache/2.12.0/turbo-cache.zip &&
    pulumi config set --plaintext --stack "$stack" ciTurboCache:tokenKmsKeyArn "$key" &&
    pulumi config set --plaintext --stack "$stack" ciTurboCache:readOnlyTokenSsmParameterArn "arn:aws:ssm:$region:$account:parameter$params/read-only-token" &&
    pulumi config set --plaintext --stack "$stack" ciTurboCache:trustedWriteTokenSsmParameterArn "arn:aws:ssm:$region:$account:parameter$params/trusted-write-token" &&
    pulumi config set --plaintext --stack "$stack" ciTurboCache:writerSharedSecretSsmParameterArn "arn:aws:ssm:$region:$account:parameter$params/writer-hmac-secret")
  echo "lab-aws: bootstrapped $stack"
}

preview() { require_account; (cd "$here" && pulumi preview --stack "$stack" --diff); }
up() { require_approval; require_account; (cd "$here" && pulumi up --stack "$stack" --yes); }

destroy() {
  require_account
  # CiTurboCache's bucket policy denies every object action outside the two
  # cache roles, and neither role may delete, so the bucket cannot be emptied
  # while that policy stands. Remove it through the stack first, then empty
  # the bucket (versions included), then destroy the rest.
  (cd "$here" && pulumi destroy --stack "$stack" --yes \
    --target "**${prefix}-bucket-policy" --target "**${prefix}-evo-bucket-policy")
  local b remaining
  for b in "$bucket" "$prefix-evo-$account"; do
    aws s3api head-bucket --bucket "$b" --region "$region" 2>/dev/null || continue
    aws s3 rm "s3://$b" --recursive --region "$region" >/dev/null
    remaining="$(aws s3api list-objects-v2 --bucket "$b" --region "$region" --query 'length(Contents || `[]`)' --output text)"
    [[ "$remaining" == "0" ]] || die "lab bucket $b still holds $remaining objects; not destroying"
  done
  (cd "$here" && pulumi destroy --stack "$stack" --yes && pulumi stack rm "$stack" --yes)
  local key
  key="$(aws ssm describe-parameters --region "$region" --parameter-filters "Key=Name,Option=BeginsWith,Values=$params/" \
    --query 'Parameters[0].KeyId' --output text 2>/dev/null || true)"
  aws ssm delete-parameters --region "$region" --names "$params/read-only-token" "$params/trusted-write-token" "$params/writer-hmac-secret" >/dev/null || true
  if [[ -n "$key" && "$key" != "None" ]]; then
    aws kms schedule-key-deletion --region "$region" --key-id "$key" --pending-window-in-days 7 >/dev/null
  fi
  inventory
}

inventory() {
  require_account
  aws resourcegroupstaggingapi get-resources --region "$region" --tag-filters "$tag_filter" \
    --query 'ResourceTagMappingList[].ResourceARN' --output text | tr '\t' '\n' | grep -F "$epoch" || echo "lab-aws: no tagged $epoch resources"
}

case "$cmd" in
  bootstrap) bootstrap ;;
  preview) preview ;;
  up) up ;;
  destroy) destroy ;;
  inventory) inventory ;;
  *) die "unknown subcommand" ;;
esac
