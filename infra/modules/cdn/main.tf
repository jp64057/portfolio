locals {
  bucket_name = "jp64057-portfolio-site"
  # Strip the https:// prefix and trailing slash from API Gateway URL for use as a CloudFront origin
  api_origin_domain = replace(replace(var.api_gateway_endpoint, "https://", ""), "/", "")

  # Content-Security-Policy. The site is a Next.js static export: Next inlines
  # hydration/flight <script> blocks and next/font injects an inline <style>,
  # neither of which can be nonce'd without a server — hence 'unsafe-inline' on
  # script/style. Everything else (fonts, XHR to /api/*, images) is same-origin.
  csp = join("; ", [
    "default-src 'self'",
    "base-uri 'self'",
    # challenges.cloudflare.com: Turnstile CAPTCHA on the contact form (script + widget iframe + verify XHR).
    "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com",
    "object-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ])
}

# ── Security response headers ─────────────────────────────────────────────────
# Attached to the default (site) behavior below. Turns a securityheaders.com
# scan green: CSP, HSTS, nosniff, Referrer-Policy, Permissions-Policy, and
# frame-ancestors/X-Frame-Options against clickjacking.

resource "aws_cloudfront_response_headers_policy" "security" {
  name    = "portfolio-security-headers"
  comment = "Security response headers for the portfolio site"

  security_headers_config {
    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    strict_transport_security {
      access_control_max_age_sec = 63072000 # 2 years
      include_subdomains         = true
      preload                    = false
      override                   = true
    }

    content_security_policy {
      content_security_policy = local.csp
      override                = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"
      override = true
    }
  }
}

# ── S3 — static site assets ───────────────────────────────────────────────────

resource "aws_s3_bucket" "site" {
  bucket = local.bucket_name
}

# Object-level rollback / accidental-overwrite recovery. (issue #116)
resource "aws_s3_bucket_versioning" "site" {
  bucket = aws_s3_bucket.site.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "site" {
  bucket                  = aws_s3_bucket.site.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "site" {
  bucket = aws_s3_bucket.site.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.site.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.site.arn
          }
        }
      },
      # Defense-in-depth: reject any non-TLS access to the bucket/objects. (#116)
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.site.arn,
          "${aws_s3_bucket.site.arn}/*",
        ]
        Condition = {
          Bool = { "aws:SecureTransport" = "false" }
        }
      },
    ]
  })
}

# ── CloudFront Origin Access Control ──────────────────────────────────────────

resource "aws_cloudfront_origin_access_control" "site" {
  name                              = "portfolio-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── CloudFront Function — URL rewrite ─────────────────────────────────────────
# Appends /index.html to requests without a file extension so that clean
# URLs like /projects work with a static S3 export (which emits real files
# at /projects/index.html). Attached to the S3 behavior only.

resource "aws_cloudfront_function" "url_rewrite" {
  name    = "portfolio-url-rewrite"
  runtime = "cloudfront-js-2.0"
  publish = true

  code = <<-JS
    function handler(event) {
      var req = event.request;
      var uri = req.uri;
      // Next metadata image routes (opengraph-image / twitter-image) are real,
      // extensionless files — serve them as-is, don't append /index.html.
      if (uri.endsWith('/opengraph-image') || uri.endsWith('/twitter-image')) {
        return req;
      }
      // If the URI has no file extension, route to the index.html for that path
      if (!uri.includes('.')) {
        req.uri = uri.replace(/\/?$/, '/index.html');
      }
      return req;
    }
  JS
}

# ── CloudFront distribution ────────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  # Custom domain(s); empty when no ACM cert is supplied
  aliases = var.acm_certificate_arn == "" ? [] : [var.site_domain]

  # Origin 1: S3 (static site assets)
  origin {
    domain_name              = aws_s3_bucket.site.bucket_regional_domain_name
    origin_id                = "s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.site.id
  }

  # Origin 2: API Gateway (serverless API)
  origin {
    domain_name = local.api_origin_domain
    origin_id   = "apigw"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Behavior 1: /api/* → API Gateway, no caching, no CloudFront Function.
  # Keeping the API behavior free of custom error responses is intentional:
  # a blanket 403/404 → index.html response would swallow real API errors.
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = "apigw"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    forwarded_values {
      query_string = true
      headers      = ["Origin", "Content-Type", "Authorization"]
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Behavior 2 (default): /* → S3, with URL rewrite CloudFront Function
  default_cache_behavior {
    target_origin_id           = "s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security.id

    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.url_rewrite.arn
    }
  }

  # 404.html is a real file emitted by next build (not-found.tsx), so this
  # custom error only kicks in for genuine S3 key-not-found cases.
  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = var.acm_certificate_arn == "" ? true : null
    acm_certificate_arn            = var.acm_certificate_arn == "" ? null : var.acm_certificate_arn
    ssl_support_method             = var.acm_certificate_arn == "" ? null : "sni-only"
    # Prod always supplies a real ACM cert → TLSv1.2_2021 (modern floor). The
    # "" branch is a non-prod bootstrap on the default *.cloudfront.net cert,
    # where AWS *requires* minimum_protocol_version = "TLSv1" (you cannot set a
    # higher floor with the default cert). So TLSv1 here is unavoidable and only
    # ever applies to a certless bootstrap, never to the live site. (issue #116)
    minimum_protocol_version = var.acm_certificate_arn == "" ? "TLSv1" : "TLSv1.2_2021"
  }
}
