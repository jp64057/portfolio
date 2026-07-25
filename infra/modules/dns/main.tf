# Route 53 hosted zone for the root domain. The domain is registered at an
# external registrar (GoDaddy); after this zone is created, its name servers
# must be set at the registrar to delegate DNS to Route 53.
resource "aws_route53_zone" "root" {
  name = var.root_domain
}
