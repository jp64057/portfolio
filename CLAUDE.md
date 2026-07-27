# Portfolio — Claude Code guide

Personal portfolio: Next.js 15 static site on S3 + CloudFront, with serverless
API (Lambda + API Gateway) for the contact form, GitHub stats, and visitor
counts. The résumé is shown in an in-site PDF.js viewer (no download). All infra
in Terraform; CI/CD via GitHub Actions with OIDC (no long-lived AWS keys in
GitHub).

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
pnpm --filter web test:unit  # web unit tests (vitest, lib/**/*.test.ts)
pnpm --filter web build && pnpm --filter web test:e2e  # Playwright E2E vs the static export
pnpm verify                  # run all of the above (typecheck/lint/build/tests) pre-PR
```

`pnpm verify` (→ `scripts/dev-verify.sh [web|api|all]`) mirrors CI and papers
over a couple of pnpm-v11-on-a-dev-box quirks (eslint plugins not hoisted into
`apps/web`; a missing `next` bin shim) that CI on pnpm 9 doesn't hit.

OpenGraph/Twitter cards are generated at build by `app/**/opengraph-image.tsx`
/ `twitter-image.tsx` (Next `ImageResponse`) via a shared renderer in
`app/_og/og.tsx`, using the committed DejaVu Sans Mono TTFs. Each route sets
`dynamic = 'force-static'` (required under `output: export`), and
`deploy-frontend` re-uploads the extensionless outputs with `image/png`.

E2E tests live in `apps/web/e2e/*.spec.ts` and run against the real static
export (`out/`) served by `apps/web/tests/static-server.mjs`. They need the
Playwright browser once: `pnpm --filter web exec playwright install chromium`
(add `--with-deps` in CI / on a fresh Linux box). The `Web Tests` workflow
(`.github/workflows/test-web.yml`) runs unit + E2E on every PR touching
`apps/web/**`.

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
  `portfolio-visitor-counter`, `portfolio-stats` (aggregates visitor counts for
  the `/stats` page), `portfolio-guestbook`, `portfolio-chat`; exec role
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

- **Bootstrapped manually, NOT in Terraform:** only the state bucket + lock
  table (they must exist before `terraform init`) and the `portfolio-terraform-ci`
  role (the role that *runs* Terraform — chicken-and-egg, so kept out-of-band;
  its policy is maintained via the AWS CLI).
- **In Terraform** (`modules/api`): the GitHub OIDC provider and the
  `portfolio-github-actions` role/policy.
- **Two distinct OIDC roles, by design:**
  - `portfolio-github-actions` (Terraform-managed) → used by
    `deploy-frontend`/`deploy-api`. Deploy-only: S3 site write, CloudFront
    invalidation, `lambda:UpdateFunctionCode`. Trust: `refs/heads/main` only.
  - `portfolio-terraform-ci` (out-of-band, CLI-managed) → used by
    `deploy-infra`. Service-scoped least privilege: full
    `s3/cloudfront/lambda/apigateway/dynamodb/ses/logs/cloudwatch/route53/acm`,
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
