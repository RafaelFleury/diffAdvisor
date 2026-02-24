---
name: Security General
detect:
  files: []
  content_patterns: []
  extensions: []
tags: [security, owasp]
description: Always-active security checklist covering OWASP top 10, secrets management, input validation, and rate limiting
---

## Security General Checklist

This skill is always active. For every code change, check:

### Authentication & Authorization
- Are all protected routes behind authentication middleware?
- Is authorization checked at the resource level (not just route level)?
- Are JWT tokens validated properly (signature, expiry, issuer)?
- Is session management secure (httpOnly cookies, secure flag, SameSite)?

### Input Validation & Sanitization
- Is all user input validated on the server side?
- Are SQL queries parameterized (no string concatenation)?
- Is HTML output escaped to prevent XSS?
- Are file uploads validated (type, size, content)?
- Is path traversal prevented in file operations?

### Secrets Management
- Are API keys, passwords, and tokens in environment variables (not hardcoded)?
- Is `.env` in `.gitignore`?
- Are secrets rotatable without code changes?
- Are sensitive values masked in logs?

### Rate Limiting & Abuse Prevention
- Are authentication endpoints rate-limited?
- Are expensive operations (search, export, AI calls) rate-limited?
- Is CAPTCHA present on public-facing forms?
- Are pagination limits enforced on list endpoints?

### CORS & Headers
- Is CORS configured with specific origins (not `*` in production)?
- Are security headers set (X-Content-Type-Options, X-Frame-Options, HSTS)?
- Is Content-Security-Policy configured?

### Error Handling
- Do error responses avoid leaking stack traces or internal paths?
- Are 500 errors logged but not exposed to users?
- Do validation errors return specific field-level messages?
