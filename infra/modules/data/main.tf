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
}
