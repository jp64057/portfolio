# jp64057 — Portfolio

Personal portfolio site demonstrating full-stack and cloud engineering skills.

**Stack:** Next.js 15 · TypeScript · Tailwind CSS · AWS Lambda · API Gateway · DynamoDB · S3 · CloudFront · Terraform · GitHub Actions

**Architecture:** Static Next.js export hosted on S3+CloudFront. Serverless API functions (Lambda + API Gateway) handle the contact form, live GitHub stats, per-page visitor counting, and resume download tracking. All infrastructure is defined in Terraform. CI/CD uses GitHub Actions with OIDC — no long-lived AWS credentials in GitHub secrets.

---

## First-time setup

### 1. Bootstrap Terraform state backend

Before running Terraform, create the S3 bucket and DynamoDB table used for remote state. Run these once:

```bash
aws s3api create-bucket \
  --bucket jp64057-portfolio-tfstate \
  --region us-east-1

aws s3api put-bucket-versioning \
  --bucket jp64057-portfolio-tfstate \
  --versioning-configuration Status=Enabled

aws dynamodb create-table \
  --table-name jp64057-portfolio-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

### 2. Fill in terraform.tfvars

Edit `infra/environments/prod/terraform.tfvars`:

```hcl
ses_from_address = "you@yourdomain.com"
ses_to_address   = "you@yourdomain.com"
github_pat       = "ghp_..."   # optional
```

### 3. Build the Lambda functions (required before first terraform apply)

```bash
pnpm install
pnpm --filter api build

# Zip each bundle
for fn in api/dist/*/; do
  name=$(basename "$fn")
  (cd "$fn" && zip -r handler.zip handler.mjs)
done
```

### 4. Deploy infrastructure

```bash
cd infra
terraform init
terraform apply -var-file=environments/prod/terraform.tfvars
```

Note the outputs — you'll need `cloudfront_distribution_id` and `cloudfront_domain`.

### 5. Set GitHub Actions secrets

In your GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `AWS_ROLE_ARN` | From `terraform output github_actions_role_arn` |
| `S3_BUCKET` | `jp64057-portfolio-site` |
| `CLOUDFRONT_DISTRIBUTION_ID` | From `terraform output cloudfront_distribution_id` |

### 6. Verify SES email

AWS SES starts in sandbox mode. You must verify your email address before SES will send:

```bash
aws ses verify-email-identity --email-address you@yourdomain.com --region us-east-1
```

Check your inbox for the verification link.

---

## Local development

```bash
pnpm install
pnpm dev           # Starts Next.js on http://localhost:3000
```

API calls will fail locally unless you point `NEXT_PUBLIC_API_URL` at a running API Gateway stage or run functions locally with `sam local start-api`.

---

## Deployment

Push to `main` — GitHub Actions handles the rest:

- Changes to `apps/web/**` → build + S3 sync + CloudFront invalidation
- Changes to `api/**` → esbuild bundle + Lambda update
- Changes to `infra/**` → `terraform plan` on PRs, `terraform apply` on merge

---

## AWS cost

All services used fall within the AWS always-free tier at portfolio traffic levels (~hundreds of visitors/month). Expected monthly cost: **$0**.

The only non-free cost is the domain name (~$10-15/year from any registrar). Route53 is not used — DNS is handled by Cloudflare's free plan pointing a CNAME to the CloudFront domain.
