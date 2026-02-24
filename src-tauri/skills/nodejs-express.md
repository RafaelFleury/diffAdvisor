---
name: Node.js / Express
detect:
  files: ["package.json"]
  content_patterns: ["express", "fastify", "koa"]
  extensions: [".js", ".ts", ".mjs"]
tags: [backend, javascript, node]
description: Express/Node.js specific concerns including middleware order, async errors, and security headers
---

## Express-Specific Concerns

When analyzing Express.js code, pay special attention to:

### Middleware Order
Express middleware executes in registration order. Flag if:
- Error handling middleware is not registered last
- Authentication middleware comes after route handlers
- Body parsing middleware is missing before routes that read req.body
- CORS middleware is placed after routes that need it

### Security Headers
Check for helmet or manual security header configuration.
Flag if the app serves responses without:
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Strict-Transport-Security (if HTTPS)
- Content-Security-Policy

### Async Error Handling
Express does not catch async errors by default before v5.
Flag if async route handlers don't use try/catch or an async wrapper like express-async-errors.

### Common Express Pitfalls
- Not calling next() in middleware (request hangs forever)
- Using app.use() with a path that shadows other routes
- Trusting req.ip without configuring trust proxy
- Not setting appropriate timeouts on the server
- Missing body size limits (can cause memory exhaustion)
- Not validating Content-Type before parsing

### Environment & Configuration
- Is NODE_ENV set to production in deployment?
- Are debug/development middlewares (morgan verbose, error stack traces) disabled in production?
- Is the server configured to handle graceful shutdown (SIGTERM)?
