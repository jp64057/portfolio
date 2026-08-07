resource "aws_dynamodb_table" "portfolio" {
  name         = "portfolio"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # Enables DynamoDB TTL so rate-limit and cache items expire automatically
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  # Recover from an accidental/malicious mass delete or bad write (issue #114).
  point_in_time_recovery {
    enabled = true
  }

  # Prevent the table (guestbook + visitor data) from being dropped by
  # `terraform destroy` or the broad terraform-ci role.
  deletion_protection_enabled = true
}
