terraform {
  backend "s3" {
    bucket         = "jp64057-portfolio-tfstate"
    key            = "portfolio/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "jp64057-portfolio-tflock"
    encrypt        = true
  }
}
