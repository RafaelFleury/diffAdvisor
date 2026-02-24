---
name: SQL Databases
detect:
  files: []
  content_patterns: ["SELECT", "INSERT", "CREATE TABLE", "sequelize", "prisma", "knex", "typeorm", "sqlalchemy", "diesel"]
  extensions: [".sql"]
tags: [database, sql, performance]
description: SQL database concerns including query performance, N+1 queries, indexing, injection prevention, and transactions
---

## SQL Database Concerns

### Query Performance
- Are queries using indexes effectively (check WHERE and ORDER BY clauses)?
- Are JOIN operations necessary or can they be avoided?
- Is SELECT * avoided in favor of specific columns?
- Are aggregate queries (COUNT, SUM) running on indexed columns?
- Are subqueries replaced with JOINs where more efficient?

### N+1 Query Problem
- Are related records loaded eagerly when needed (JOIN, include, prefetch)?
- Are database queries inside loops?
- Is the total number of queries proportional to the result set size?

### Indexing
- Are columns used in WHERE clauses indexed?
- Are columns used in ORDER BY indexed?
- Are composite indexes defined for multi-column queries?
- Are indexes on foreign key columns?
- Are unnecessary indexes removed (they slow writes)?

### SQL Injection Prevention
- Are all queries parameterized (no string concatenation/interpolation)?
- Are ORM methods used instead of raw SQL where possible?
- If raw SQL is necessary, are bind parameters used?
- Are LIKE patterns sanitized (escape % and _)?

### Transactions
- Are multi-step operations wrapped in transactions?
- Is the transaction isolation level appropriate?
- Are deadlocks considered (consistent lock ordering)?
- Is transaction scope minimized (don't hold locks during I/O)?

### Schema Design
- Are NOT NULL constraints used where appropriate?
- Are default values set for new columns in migrations?
- Are UNIQUE constraints in place for naturally unique fields?
- Are CASCADE rules correct (ON DELETE, ON UPDATE)?
- Are ENUM/CHECK constraints used for fixed-value columns?

### Migration Safety
- Do migrations work with existing data?
- Are large table alterations done in steps (add column, backfill, add constraint)?
- Are destructive migrations (DROP COLUMN, DROP TABLE) intentional?
