output "zone_id" {
  description = "Route 53 hosted zone ID for the root domain"
  value       = aws_route53_zone.root.zone_id
}

output "name_servers" {
  description = "Route 53 name servers — set these at the registrar to delegate DNS"
  value       = aws_route53_zone.root.name_servers
}
