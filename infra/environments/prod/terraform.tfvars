aws_region  = "us-east-1"
github_repo = "jp64057/portfolio"

root_domain = "prue.info"
site_domain = "jacob.prue.info"

# Fill these in before running terraform apply:
ses_from_address = "jimmabapa@gmail.com"
ses_to_address   = "jimmabapa@gmail.com"
# github_pat = "ghp_..."   # optional — increases GitHub API rate limit from 60 to 5000 req/hr

# Observability (#25): dashboard + Lambda/API alarms → SNS email + AWS Budgets.
# Requires the terraform-ci role to have sns:* + budgets:* (granted for #54).
enable_observability = true
