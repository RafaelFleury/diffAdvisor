---
name: Django
detect:
  files: ["requirements.txt", "manage.py", "pyproject.toml"]
  content_patterns: ["django", "Django"]
  extensions: [".py"]
tags: [backend, python, django]
description: Django-specific concerns including ORM N+1 queries, CSRF protection, model validation, and migration safety
---

## Django-Specific Concerns

### ORM & Database
- Are querysets using select_related / prefetch_related to avoid N+1 queries?
- Are database queries inside loops (N+1 pattern)?
- Are indexes defined on fields used in filter/order_by?
- Are bulk operations used (bulk_create, bulk_update) instead of save() in loops?
- Is .count() used instead of len(queryset)?

### Migrations
- Are migrations reversible (include reverse operations)?
- Do data migrations handle large tables gracefully (batching)?
- Are new NOT NULL columns added with defaults?
- Is RunSQL used carefully with proper reverse_sql?

### Security
- Is CSRF middleware enabled and tokens included in forms?
- Are views using appropriate permission classes?
- Is user input validated through Django forms/serializers?
- Are raw SQL queries parameterized (no f-strings or format)?
- Is DEBUG = False in production settings?
- Is ALLOWED_HOSTS configured?
- Are SECRET_KEY and database credentials in environment variables?

### Model Validation
- Are model constraints (unique, unique_together) defined?
- Are field validators in place for business rules?
- Is clean() overridden for cross-field validation?
- Are choices defined for fields with fixed options?

### Views & URLs
- Are class-based views using appropriate mixins?
- Are URL patterns specific (avoiding catch-all patterns)?
- Are file uploads handled with size limits and type validation?
- Is pagination implemented for list views?

### Common Django Anti-Patterns
- Putting business logic in views instead of models/services
- Not using transactions for multi-step operations
- Accessing request.user without @login_required
- Using .all() without pagination or limits
