# Portfolio — Claude Code guide

Personal portfolio: Next.js 15 static site on S3 + CloudFront, with serverless
API (Lambda + API Gateway) for the contact form, GitHub stats, visitor counts,
and resume-download tracking. All infra in Terraform; CI/CD via GitHub Actions
with OIDC (no long-lived AWS keys in GitHub).

## Layout (pnpm monorepo, Node ≥22, pnpm ≥9)

- `apps/web` — Next.js 15 frontend, static export (`next build` → `apps/web/out`)
- `api` — TypeScript Lambda handlers; `pnpm --filter api build` bundles each to
  `api/dist/<name>/handler.js` (CJS), which CI zips and ships
- `infra` — Terraform. Root wires modules `data` (DynamoDB), `api` (Lambda + API
  Gateway v2 + SES), `cdn` (S3 site + CloudFront). Remote state in S3.

## Common commands

```bash
pnpm install                 # install workspace
pnpm dev                     # Next dev on http://localhost:3000
pnpm --filter web build      # static export → apps/web/out
pnpm --filter api build      # bundle Lambdas → api/dist/*/handler.js
pnpm lint                    # web (next lint + tsc) + api
pnpm test                    # api tests (vitest)
```

Local API calls fail unless `NEXT_PUBLIC_API_URL` points at a running API
Gateway stage, or you run `sam local start-api`. In prod the frontend calls
`/api/*`, which CloudFront routes to API Gateway — no absolute URL needed.

## Live deployment (AWS account 816683906576, us-east-1)

- **URL:** https://jacob.prue.info (custom domain; CloudFront `E28U32DJIHP4X9`,
  ACM cert in us-east-1). Also reachable at https://d1ngproq726rg2.cloudfront.net.
- **DNS:** `prue.info` registered at GoDaddy, delegated to Route 53 (all DNS in
  Terraform via the `dns` module). Cert validation + `jacob.prue.info` A/AAAA
  alias records are in `acm.tf` / `dns_records.tf`.
- **Site bucket:** `jp64057-portfolio-site`
- **API Gateway v2 (HTTP):** `oba4jwe8k9` (`portfolio`), fronted at `/api/*`
- **Lambdas (Node 22):** `portfolio-github-stats`, `portfolio-contact`,
  `portfolio-resume-tracker`, `portfolio-visitor-counter`; exec role
  `portfolio-lambda-exec`
- **DynamoDB:** table `portfolio`
- **Terraform state:** S3 `jp64057-portfolio-tfstate` + lock table
  `jp64057-portfolio-tflock`

## CI/CD (.github/workflows)

- `deploy-frontend.yml` — on `apps/web/**`: build → `aws s3 sync` → CloudFront
  invalidation. ✅ working.
- `deploy-api.yml` — on `api/**`: typecheck/test/bundle/zip →
  `lambda update-function-code`. ✅ working.
- `deploy-infra.yml` — on `infra/**` push/PR: runs `terraform plan` only (never
  changes infra). **Apply is manual:** trigger the workflow via
  `workflow_dispatch` with input `action: apply` from `main`. Uses the scoped
  `TF_ROLE_ARN` role (see below).
- GitHub secrets: `AWS_ROLE_ARN` (deploy role, used by frontend/api),
  `TF_ROLE_ARN` (scoped Terraform role, used by infra), `S3_BUCKET`,
  `CLOUDFRONT_DISTRIBUTION_ID`.

## Gotchas / non-obvious facts

- **Bootstrapped manually, NOT in Terraform:** the state bucket + lock table,
  and the GitHub OIDC provider + two roles: `portfolio-github-actions`
  (deploy-only: S3 site write, CloudFront invalidation, `lambda:UpdateFunctionCode`)
  and `portfolio-terraform-ci` (scoped Terraform role).
- **Two distinct OIDC roles, by design:**
  - `portfolio-github-actions` → used by `deploy-frontend`/`deploy-api`.
    Deploy-only permissions.
  - `portfolio-terraform-ci` → used by `deploy-infra`. Service-scoped least
    privilege: full `s3/cloudfront/lambda/apigateway/dynamodb/ses/logs/cloudwatch`,
    `iam:*` **restricted to `arn:*:iam::*:role/policy portfolio-*`**, plus global
    IAM read. Trust allows `refs/heads/main` and `pull_request`. Cannot touch
    EC2/RDS/billing/users or IAM outside `portfolio-*`.
- You can still apply infra locally instead of via CI:
  `cd infra && terraform init && terraform apply -var-file=environments/prod/terraform.tfvars`
  (fill the `ses_*` addresses in that tfvars first).
- CloudFront uses the default `*.cloudfront.net` cert — no custom domain.
- Lambda bundles are CJS (a past fix for a dynamic-require error).

## Local AWS CLI

AWS CLI v2 is at `~/.local/bin/aws` (not on `$PATH` by default — use the full
path). Auth is IAM user `jadmin` via `~/.aws/credentials`, region us-east-1.
Account is on the 2025 credit-based **Free plan**.
