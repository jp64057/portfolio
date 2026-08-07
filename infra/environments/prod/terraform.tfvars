aws_region  = "us-east-1"
github_repo = "jp64057/portfolio"

root_domain = "prue.info"
site_domain = "jacob.prue.info"

# Fill these in before running terraform apply:
ses_from_address = "jimmabapa@gmail.com"
ses_to_address   = "jimmabapa@gmail.com"

# ── SECRETS DO NOT GO IN THIS FILE ──────────────────────────────────────────
# This tfvars is committed (CI reads it for non-secret config). NEVER put a
# secret here. Provide secrets via TF_VAR_* environment variables — in CI from
# GitHub secrets (anthropic_api_key, turnstile_secret_key), or locally from a
# gitignored terraform.tfvars.local (e.g. github_pat, guestbook_admin_token).
# See infra/environments/prod/terraform.tfvars.local (untracked).

# Observability (#25): dashboard + Lambda/API alarms → SNS email + AWS Budgets.
# Requires the terraform-ci role to have sns:* + budgets:* (granted for #54).
enable_observability = true
