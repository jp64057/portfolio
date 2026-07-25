# Alias records pointing the site domain at the CloudFront distribution.
# Z2FDTNDATAQYW2 is the fixed hosted-zone ID CloudFront uses for all
# distributions (AWS constant).
resource "aws_route53_record" "site_a" {
  zone_id = module.dns.zone_id
  name    = var.site_domain
  type    = "A"

  alias {
    name                   = module.cdn.cloudfront_domain
    zone_id                = "Z2FDTNDATAQYW2"
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "site_aaaa" {
  zone_id = module.dns.zone_id
  name    = var.site_domain
  type    = "AAAA"

  alias {
    name                   = module.cdn.cloudfront_domain
    zone_id                = "Z2FDTNDATAQYW2"
    evaluate_target_health = false
  }
}
