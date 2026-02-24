---
name: REST API Design
detect:
  files: []
  content_patterns: ["router", "route", "endpoint", "app.get", "app.post", "app.put", "app.delete", "@GetMapping", "@PostMapping", "@api_view"]
  extensions: []
tags: [api, rest, backend]
description: REST API design concerns including HTTP methods, status codes, versioning, pagination, and error format
---

## REST API Design Concerns

### HTTP Methods
- Is GET used for read operations (idempotent, no side effects)?
- Is POST used for creating resources?
- Is PUT/PATCH used for updates (PUT for full replacement, PATCH for partial)?
- Is DELETE used for removal?
- Are unsafe operations (create, update, delete) not using GET?

### Status Codes
- 200 for successful GET/PUT/PATCH
- 201 for successful POST (resource created)
- 204 for successful DELETE (no content)
- 400 for validation errors
- 401 for unauthenticated requests
- 403 for unauthorized (authenticated but not allowed)
- 404 for resource not found
- 409 for conflicts (duplicate resources)
- 429 for rate limiting
- 500 for server errors (should not expose internals)

### Error Format
- Are errors returned in a consistent format?
- Do error responses include a machine-readable code?
- Do validation errors specify which fields failed?
- Are error messages helpful without leaking internals?

### Pagination
- Are list endpoints paginated?
- Is the pagination format consistent (offset/limit or cursor-based)?
- Are total counts available for offset pagination?
- Are page size limits enforced?

### Filtering & Sorting
- Are filter parameters validated and sanitized?
- Are sortable fields whitelisted (not arbitrary column names)?
- Are default sort orders defined?

### Versioning
- Is API versioning in place (URL path, header, or query param)?
- Are breaking changes introduced in new versions?

### Request/Response Format
- Is Content-Type validated on incoming requests?
- Are response bodies consistent (envelope vs flat)?
- Are dates in ISO 8601 format?
- Are IDs consistent in type (string vs number)?
- Are nested resources limited in depth?

### Security
- Are all endpoints authenticated unless explicitly public?
- Are resource-level authorization checks in place?
- Are request bodies size-limited?
- Is input validated and sanitized before processing?
