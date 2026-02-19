import type {
  Project,
  Commit,
  DebriefResult,
  CheckpointResponse,
  Evaluation,
  KnowledgeNote,
  Skill,
  AppSettings,
} from '@/types/index.ts'
import type {
  IProjectService,
  IDebriefService,
  ICheckpointService,
  IKnowledgeService,
  ISettingsService,
} from './types.ts'

// ── Helpers ──

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms + Math.random() * 150))

// ── Mock Data ──

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'e-commerce-api',
    path: '~/projects/e-commerce-api',
    language: 'TypeScript',
    frameworks: ['Express', 'Prisma'],
    activeSkills: ['security-general', 'nodejs-express', 'sql-databases', 'rest-api'],
    createdAt: '2026-02-10T10:00:00Z',
    lastAnalyzedAt: '2026-02-19T08:30:00Z',
  },
]

let activeProjectId = 'proj-1'

const mockCommits: Commit[] = [
  {
    hash: 'a3f7c2d',
    message: 'feat: add user authentication endpoint',
    author: 'dev',
    timestamp: '12 min ago',
    filesChanged: 3,
    additions: 87,
    deletions: 4,
    status: 'pending',
  },
  {
    hash: 'e91b4f8',
    message: 'fix: update database connection pooling',
    author: 'dev',
    timestamp: '2 hours ago',
    filesChanged: 2,
    additions: 23,
    deletions: 11,
    status: 'pending',
  },
  {
    hash: '7d2e5a1',
    message: 'feat: add product listing API',
    author: 'dev',
    timestamp: 'yesterday',
    filesChanged: 4,
    additions: 112,
    deletions: 8,
    status: 'reviewed',
  },
  {
    hash: 'b8c3f01',
    message: 'refactor: extract validation middleware',
    author: 'dev',
    timestamp: '2 days ago',
    filesChanged: 5,
    additions: 45,
    deletions: 67,
    status: 'reviewed',
  },
]

const mockDiff = `@@ -1,4 +1,87 @@
 import express from 'express';
+import bcrypt from 'bcrypt';
+import jwt from 'jsonwebtoken';
+import { PrismaClient } from '@prisma/client';
+
+const router = express.Router();
+const prisma = new PrismaClient();
+const JWT_SECRET = 'my-super-secret-key-123';
+
+router.post('/register', async (req, res) => {
+  const { email, password, name } = req.body;
+
+  const hashedPassword = await bcrypt.hash(password, 10);
+
+  const user = await prisma.user.create({
+    data: {
+      email,
+      password: hashedPassword,
+      name,
+    },
+  });
+
+  res.json({
+    id: user.id,
+    email: user.email,
+    name: user.name,
+    password: user.password,
+  });
+});
+
+router.post('/login', async (req, res) => {
+  const { email, password } = req.body;
+
+  const user = await prisma.user.findUnique({
+    where: { email },
+  });
+
+  if (!user) {
+    return res.status(401).json({ error: 'Invalid credentials' });
+  }
+
+  const valid = await bcrypt.compare(password, user.password);
+
+  if (!valid) {
+    return res.status(401).json({ error: 'Invalid credentials' });
+  }
+
+  const token = jwt.sign(
+    { userId: user.id, email: user.email },
+    JWT_SECRET,
+    { expiresIn: '24h' }
+  );
+
+  res.json({ token, user: { id: user.id, email: user.email } });
+});
+
+router.get('/me', async (req, res) => {
+  const authHeader = req.headers.authorization;
+
+  if (!authHeader) {
+    return res.status(401).json({ error: 'No token provided' });
+  }
+
+  const token = authHeader.split(' ')[1];
+
+  try {
+    const decoded = jwt.verify(token, JWT_SECRET);
+    const user = await prisma.user.findUnique({
+      where: { id: decoded.userId },
+    });
+    res.json(user);
+  } catch {
+    res.status(401).json({ error: 'Invalid token' });
+  }
+});
+
+export default router;`

const mockDebriefs: Record<string, DebriefResult> = {
  a3f7c2d: {
    id: 'debrief-1',
    commitHash: 'a3f7c2d',
    architecturalSummary:
      'This commit implements a JWT-based authentication system using Express.js with three endpoints: user registration, login, and profile retrieval. It follows the stateless authentication pattern where the server issues signed tokens instead of maintaining sessions, delegating state to the client.',
    patternsIdentified: [
      'Stateless JWT Authentication',
      'Express Router Module Pattern',
      'Password Hashing with bcrypt',
    ],
    decisionsMade: [
      {
        decision: 'JWT tokens instead of server-side sessions',
        alternatives:
          'Server-side sessions with express-session and a session store (Redis, PostgreSQL). Session-based auth keeps state on the server, making revocation trivial.',
        tradeoffs:
          'JWTs are stateless and scale horizontally without shared state, but cannot be revoked until expiry. Sessions can be invalidated instantly but require a centralized store.',
      },
      {
        decision: '24-hour token expiration with no refresh token mechanism',
        alternatives:
          'Short-lived access tokens (15 min) with a refresh token stored in an httpOnly cookie. This limits the damage window if a token is stolen.',
        tradeoffs:
          'A single long-lived token is simpler but means a stolen token is valid for a full day. Refresh tokens add complexity but significantly reduce risk.',
      },
    ],
    gaps: [
      {
        id: 'gap-1',
        severity: 'critical',
        category: 'security',
        description: 'JWT secret is hardcoded in source code',
        explanation:
          'The JWT_SECRET is a string literal in the source file. Anyone with access to the repository (which is likely public or shared) can forge valid tokens for any user. This is the most common authentication vulnerability in Node.js applications.',
        suggestion:
          'Move the secret to an environment variable (process.env.JWT_SECRET) and ensure it is generated as a cryptographically random string of at least 256 bits. Add .env to .gitignore.',
      },
      {
        id: 'gap-2',
        severity: 'critical',
        category: 'security',
        description: 'No input validation on registration or login',
        explanation:
          'The email and password fields from req.body are used directly without validation. A malformed email, an empty password, or injected fields could cause unexpected behavior or security vulnerabilities downstream.',
        suggestion:
          'Add validation middleware using a library like zod or joi. Validate email format, enforce minimum password length (8+ characters), and reject unexpected fields.',
      },
      {
        id: 'gap-3',
        severity: 'warning',
        category: 'security',
        description: 'No rate limiting on authentication endpoints',
        explanation:
          'Without rate limiting, an attacker can attempt thousands of login requests per second to brute-force credentials. At 10,000 requests per second, a common password can be cracked in minutes.',
        suggestion:
          'Add rate limiting middleware (express-rate-limit) specifically on /login and /register. Recommended: 5 attempts per minute per IP, with exponential backoff.',
      },
      {
        id: 'gap-4',
        severity: 'warning',
        category: 'reliability',
        description: 'No error handling for database failures',
        explanation:
          'Prisma calls (user.create, user.findUnique) can throw on connection failures, unique constraint violations (duplicate email), or timeout. Without try/catch, the Express process may crash or return a 500 with stack trace details.',
        suggestion:
          'Wrap all Prisma operations in try/catch blocks. Handle specific errors: P2002 for unique violations (return 409), connection errors (return 503), and generic errors (return 500 with safe message).',
      },
      {
        id: 'gap-5',
        severity: 'info',
        category: 'security',
        description: 'Registration response returns user data without auth token',
        explanation:
          'After successful registration, the response includes the user object (including the hashed password!) but no authentication token. The user must make a separate login request. Additionally, returning the hashed password is a security concern.',
        suggestion:
          'Never return the password hash in any response. Consider issuing a JWT on registration to auto-login the user, reducing friction.',
      },
    ],
    checkpointQuestions: [
      {
        id: 'q-1',
        question:
          'If a user changes their password, what happens to all previously issued JWT tokens? How would you solve this with the current architecture?',
        concept: 'token revocation in stateless auth',
        goodAnswerIncludes:
          'Existing tokens remain valid until expiry since JWTs are stateless. Solutions include: token blacklist (stored in Redis), token versioning (store a version counter on the user, include it in JWT, check on verify), or switching to short-lived tokens with refresh tokens.',
      },
      {
        id: 'q-2',
        question:
          'An attacker starts sending 10,000 login requests per second with random passwords. What happens to the application, and what are the two most effective defenses?',
        concept: 'brute force protection and rate limiting',
        goodAnswerIncludes:
          'The bcrypt hashing on each attempt consumes CPU, potentially causing a denial of service. Defenses: rate limiting per IP (express-rate-limit), account lockout after N failed attempts, CAPTCHA after suspicious activity, and potentially moving bcrypt to a worker thread.',
      },
      {
        id: 'q-3',
        question:
          'What is the security risk on the line where JWT_SECRET is defined, and what would an attacker need to exploit it?',
        concept: 'secrets management',
        goodAnswerIncludes:
          'The secret is hardcoded, meaning anyone with repo access can forge tokens. An attacker with the secret can create tokens for any userId, effectively impersonating any user. The fix is environment variables with a strong random secret.',
      },
    ],
    knowledgeBaseNotes: [
      {
        title: 'JWT Authentication',
        category: 'concepts/security',
        tags: ['security', 'authentication', 'jwt', 'stateless'],
        linksTo: ['Rate Limiting', 'Input Validation', 'Secrets Management'],
        content:
          '# JWT Authentication\n\nJSON Web Tokens (JWT) provide stateless authentication by encoding user claims in a signed token.\n\n## How it works\n\n1. User sends credentials to `/login`\n2. Server verifies credentials and signs a JWT with a secret\n3. Client stores the token and sends it in `Authorization: Bearer <token>` headers\n4. Server verifies the token signature on each request\n\n## Key Trade-offs\n\n**When to use JWT:**\n- Microservices (no shared session store needed)\n- Mobile apps (tokens stored on device)\n- APIs consumed by third parties\n\n**When to prefer sessions:**\n- Single monolith applications\n- Need instant revocation (e.g., logout everywhere)\n- Server-side rendering with cookies\n\n## Security Essentials\n\n```javascript\n// NEVER do this:\nconst JWT_SECRET = "hardcoded-secret";\n\n// ALWAYS do this:\nconst JWT_SECRET = process.env.JWT_SECRET;\n```\n\n## Common Vulnerabilities\n\n1. Hardcoded secrets → forge tokens\n2. No expiration → stolen tokens last forever\n3. Storing sensitive data in payload → JWT is base64, not encrypted\n4. Using `none` algorithm → bypasses signature verification\n5. Not validating `iss` and `aud` claims\n\nSee also: [[Rate Limiting]], [[Input Validation]], [[Secrets Management]]',
      },
    ],
    skillsUsed: ['security-general', 'nodejs-express', 'rest-api'],
    status: 'pending',
    createdAt: '2026-02-19T08:42:00Z',
  },
}

const mockKnowledgeNotes: KnowledgeNote[] = [
  {
    id: 'note-1',
    projectId: null,
    title: 'JWT Authentication',
    categoryPath: 'concepts/security',
    filePath: 'concepts/security/JWT Authentication.md',
    autoGenerated: true,
    tags: ['security', 'authentication', 'jwt', 'stateless'],
    content: `# JWT Authentication

JSON Web Tokens (JWT) provide stateless authentication by encoding user claims in a signed token.

## What it is

JWT is a compact, URL-safe token format defined in RFC 7519. It consists of three parts: header (algorithm), payload (claims), and signature. The server signs the token with a secret or private key, and can verify it later without database lookups.

## How it works in this project

1. User sends credentials to \`/login\`
2. Server verifies password with bcrypt and signs a JWT
3. Client stores the token and sends it in \`Authorization: Bearer <token>\`
4. Protected routes verify the signature before processing

## Key Trade-offs

### When to use JWT
- Microservices where services can't share a session store
- Mobile apps where cookies aren't practical
- APIs consumed by third parties

### When to prefer sessions
- Single monolith applications
- Need instant revocation (e.g., "logout everywhere")
- Server-side rendering with cookies

## Security Essentials

\`\`\`javascript
// NEVER do this:
const JWT_SECRET = "hardcoded-secret";

// ALWAYS do this:
const JWT_SECRET = process.env.JWT_SECRET;
\`\`\`

## Common Vulnerabilities

1. Hardcoded secrets — attacker can forge tokens for any user
2. No expiration — stolen tokens last forever
3. Storing sensitive data in payload — JWT is base64-encoded, not encrypted
4. Using \`none\` algorithm — bypasses signature verification entirely
5. Not validating \`iss\` and \`aud\` claims — tokens from other services accepted

---

*See also: [[Rate Limiting]], [[Input Validation]], [[Secrets Management]]*

*Auto-generated from debrief on 2026-02-19*`,
    createdAt: '2026-02-19T08:45:00Z',
    updatedAt: '2026-02-19T08:45:00Z',
  },
  {
    id: 'note-2',
    projectId: null,
    title: 'Input Validation',
    categoryPath: 'concepts/security',
    filePath: 'concepts/security/Input Validation.md',
    autoGenerated: true,
    tags: ['security', 'validation', 'backend'],
    content: `# Input Validation

Never trust data from the client. Every field that crosses a system boundary must be validated on the server.

## Why it matters

Client-side validation is a UX convenience, not a security measure. An attacker can bypass any client-side check by sending requests directly to your API. Server-side validation is the only real defense.

## What to validate

- **Type**: Is it a string, number, boolean?
- **Format**: Does the email match a valid pattern? Is the date in ISO format?
- **Length**: Minimum and maximum constraints prevent abuse
- **Range**: Numeric values within expected bounds
- **Presence**: Required fields are not null/undefined/empty

## Libraries

\`\`\`javascript
// Using Zod (recommended for TypeScript)
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
});
\`\`\`

See also: [[SQL Injection]], [[Server-Side Validation]], [[JWT Authentication]]

*Auto-generated from debrief on 2026-02-19*`,
    createdAt: '2026-02-19T08:45:00Z',
    updatedAt: '2026-02-19T08:45:00Z',
  },
  {
    id: 'note-3',
    projectId: null,
    title: 'Rate Limiting',
    categoryPath: 'concepts/security',
    filePath: 'concepts/security/Rate Limiting.md',
    autoGenerated: false,
    tags: ['security', 'performance', 'api'],
    content: `# Rate Limiting

Restricting the number of requests a client can make in a time window. Essential for any public-facing API.

## Why it matters

Without rate limiting:
- Brute force attacks on login endpoints go unchecked
- A single client can DoS your entire service
- API abuse racks up infrastructure costs

## Implementation

\`\`\`javascript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 attempts per window
  message: { error: 'Too many attempts, try again later' },
});

app.use('/auth', authLimiter);
\`\`\`

## Strategies

- **Fixed window**: Simple counter reset every N minutes
- **Sliding window**: More accurate, prevents burst at window edges
- **Token bucket**: Allows bursts up to a limit, then throttles

See also: [[JWT Authentication]], [[Input Validation]]`,
    createdAt: '2026-02-18T14:00:00Z',
    updatedAt: '2026-02-18T14:00:00Z',
  },
  {
    id: 'note-4',
    projectId: null,
    title: 'Event Loop',
    categoryPath: 'languages/javascript',
    filePath: 'languages/javascript/Event Loop.md',
    autoGenerated: false,
    tags: ['javascript', 'runtime', 'async'],
    content: `# Event Loop

The mechanism that allows Node.js to perform non-blocking I/O operations despite JavaScript being single-threaded.

## How it works

1. Call stack executes synchronous code
2. Async operations (I/O, timers) are delegated to the OS/thread pool
3. Completed callbacks are queued
4. Event loop picks callbacks from the queue when the call stack is empty

## Phases

1. **Timers**: executes setTimeout/setInterval callbacks
2. **I/O callbacks**: executes I/O callbacks (not timers, not close)
3. **Poll**: retrieves new I/O events
4. **Check**: executes setImmediate callbacks
5. **Close**: executes close event callbacks

See also: [[Promises & Async Await]], [[Closures & Scope]]`,
    createdAt: '2026-02-15T10:00:00Z',
    updatedAt: '2026-02-15T10:00:00Z',
  },
  {
    id: 'note-5',
    projectId: null,
    title: 'Closures & Scope',
    categoryPath: 'languages/javascript',
    filePath: 'languages/javascript/Closures & Scope.md',
    autoGenerated: false,
    tags: ['javascript', 'fundamentals'],
    content: `# Closures & Scope

A closure is a function that remembers the variables from the scope where it was created, even after that scope has closed.

## Example

\`\`\`javascript
function createCounter() {
  let count = 0;
  return () => ++count;
}
const counter = createCounter();
counter(); // 1
counter(); // 2
\`\`\`

The inner function "closes over" the \`count\` variable.

See also: [[Event Loop]], [[Promises & Async Await]]`,
    createdAt: '2026-02-14T10:00:00Z',
    updatedAt: '2026-02-14T10:00:00Z',
  },
  {
    id: 'note-6',
    projectId: null,
    title: 'Promises & Async Await',
    categoryPath: 'languages/javascript',
    filePath: 'languages/javascript/Promises & Async Await.md',
    autoGenerated: false,
    tags: ['javascript', 'async', 'fundamentals'],
    content: `# Promises & Async Await

Promises represent the eventual result of an asynchronous operation. Async/await is syntactic sugar that makes asynchronous code read like synchronous code.

## Promise states

- **Pending**: initial state
- **Fulfilled**: operation completed successfully
- **Rejected**: operation failed

## Async/Await

\`\`\`javascript
async function fetchUser(id) {
  try {
    const user = await db.user.findUnique({ where: { id } });
    return user;
  } catch (error) {
    throw new Error('User not found');
  }
}
\`\`\`

See also: [[Event Loop]], [[Closures & Scope]]`,
    createdAt: '2026-02-14T11:00:00Z',
    updatedAt: '2026-02-14T11:00:00Z',
  },
  {
    id: 'note-7',
    projectId: null,
    title: 'Decorators',
    categoryPath: 'languages/python',
    filePath: 'languages/python/Decorators.md',
    autoGenerated: false,
    tags: ['python', 'fundamentals'],
    content: `# Decorators

Functions that modify the behavior of other functions. A core Python pattern used extensively in frameworks like Django and Flask.

## Basic decorator

\`\`\`python
def require_auth(func):
    def wrapper(*args, **kwargs):
        if not current_user.is_authenticated:
            raise Unauthorized()
        return func(*args, **kwargs)
    return wrapper

@require_auth
def get_profile():
    return current_user.profile
\`\`\`

See also: [[Generators & Yield]]`,
    createdAt: '2026-02-13T10:00:00Z',
    updatedAt: '2026-02-13T10:00:00Z',
  },
  {
    id: 'note-8',
    projectId: null,
    title: 'Generators & Yield',
    categoryPath: 'languages/python',
    filePath: 'languages/python/Generators & Yield.md',
    autoGenerated: false,
    tags: ['python', 'fundamentals', 'async'],
    content: `# Generators & Yield

Generator functions produce a sequence of values lazily, one at a time, using the \`yield\` keyword.

## Example

\`\`\`python
def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

gen = fibonacci()
next(gen)  # 0
next(gen)  # 1
next(gen)  # 1
\`\`\`

See also: [[Decorators]]`,
    createdAt: '2026-02-13T11:00:00Z',
    updatedAt: '2026-02-13T11:00:00Z',
  },
  {
    id: 'note-9',
    projectId: null,
    title: 'REST API Design',
    categoryPath: 'concepts/architecture',
    filePath: 'concepts/architecture/REST API Design.md',
    autoGenerated: false,
    tags: ['api', 'architecture', 'backend'],
    content: `# REST API Design

Representational State Transfer — an architectural style for designing networked applications.

## Core Principles

- **Resources**: Everything is a resource identified by a URL
- **HTTP methods**: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- **Stateless**: Each request contains all information needed
- **Consistent responses**: Use standard HTTP status codes

## Status codes

- \`200\` OK — success
- \`201\` Created — resource created
- \`400\` Bad Request — invalid input
- \`401\` Unauthorized — not authenticated
- \`403\` Forbidden — not authorized
- \`404\` Not Found
- \`429\` Too Many Requests — rate limited
- \`500\` Internal Server Error

See also: [[Middleware Pattern]], [[Rate Limiting]], [[JWT Authentication]]`,
    createdAt: '2026-02-12T10:00:00Z',
    updatedAt: '2026-02-12T10:00:00Z',
  },
  {
    id: 'note-10',
    projectId: null,
    title: 'Middleware Pattern',
    categoryPath: 'concepts/architecture',
    filePath: 'concepts/architecture/Middleware Pattern.md',
    autoGenerated: false,
    tags: ['architecture', 'patterns', 'backend'],
    content: `# Middleware Pattern

A chain of functions that process a request sequentially, each able to modify the request/response or short-circuit the chain.

## In Express.js

\`\`\`javascript
app.use(cors());          // 1st: CORS headers
app.use(helmet());        // 2nd: security headers
app.use(rateLimit());     // 3rd: rate limiting
app.use(authenticate());  // 4th: auth check
app.use('/api', router);  // 5th: routes
app.use(errorHandler());  // LAST: error handling
\`\`\`

**Order matters.** Error handling middleware must be registered last. Authentication must come before protected routes.

See also: [[REST API Design]], [[Chain of Responsibility]]`,
    createdAt: '2026-02-12T11:00:00Z',
    updatedAt: '2026-02-12T11:00:00Z',
  },
  {
    id: 'note-11',
    projectId: null,
    title: 'Pre-Deploy Security',
    categoryPath: 'checklists',
    filePath: 'checklists/Pre-Deploy Security.md',
    autoGenerated: false,
    tags: ['checklist', 'security', 'deployment'],
    content: `# Pre-Deploy Security Checklist

Review before every deployment to production.

## Authentication & Authorization
- [ ] No hardcoded secrets in source code
- [ ] JWT secrets are strong (256+ bit random)
- [ ] All protected routes check authentication
- [ ] Role-based access control is enforced

## Input & Data
- [ ] All inputs validated server-side
- [ ] SQL queries use parameterized statements
- [ ] File uploads are restricted and scanned
- [ ] Sensitive data is encrypted at rest

## Infrastructure
- [ ] HTTPS enforced everywhere
- [ ] CORS configured for specific origins
- [ ] Rate limiting on public endpoints
- [ ] Security headers set (helmet or equivalent)

## Monitoring
- [ ] Error logging captures enough context
- [ ] No sensitive data in logs
- [ ] Alerting on authentication failures

See also: [[JWT Authentication]], [[Input Validation]], [[Rate Limiting]]`,
    createdAt: '2026-02-11T10:00:00Z',
    updatedAt: '2026-02-11T10:00:00Z',
  },
  {
    id: 'note-12',
    projectId: null,
    title: 'Production Readiness',
    categoryPath: 'checklists',
    filePath: 'checklists/Production Readiness.md',
    autoGenerated: false,
    tags: ['checklist', 'deployment', 'reliability'],
    content: `# Production Readiness Checklist

## Performance
- [ ] Database queries are indexed
- [ ] N+1 queries resolved
- [ ] Static assets are cached
- [ ] API responses use pagination

## Reliability
- [ ] Error boundaries catch React crashes
- [ ] API errors return structured responses
- [ ] Database connections use pooling
- [ ] Graceful shutdown on SIGTERM

## Observability
- [ ] Health check endpoint exists
- [ ] Structured logging is configured
- [ ] Key metrics are tracked

See also: [[REST API Design]], [[Middleware Pattern]]`,
    createdAt: '2026-02-11T11:00:00Z',
    updatedAt: '2026-02-11T11:00:00Z',
  },
]

const mockSkills: Skill[] = [
  {
    id: 'security-general',
    name: 'Security General',
    description: 'OWASP top 10, secrets management, input validation, rate limiting, CORS',
    tags: ['security'],
    detect: { files: [], contentPatterns: [], extensions: [] },
    content: '',
    enabled: true,
    autoDetected: true,
    builtIn: true,
  },
  {
    id: 'nodejs-express',
    name: 'Node.js / Express',
    description: 'Middleware order, async errors, security headers, trust proxy',
    tags: ['backend', 'javascript', 'node'],
    detect: { files: ['package.json'], contentPatterns: ['express'], extensions: ['.js', '.ts'] },
    content: '',
    enabled: true,
    autoDetected: true,
    builtIn: true,
  },
  {
    id: 'react',
    name: 'React',
    description: 'State management, useEffect pitfalls, key prop, re-render performance',
    tags: ['frontend', 'javascript'],
    detect: { files: ['package.json'], contentPatterns: ['react'], extensions: ['.jsx', '.tsx'] },
    content: '',
    enabled: false,
    autoDetected: false,
    builtIn: true,
  },
  {
    id: 'nextjs',
    name: 'Next.js',
    description: 'SSR/SSG trade-offs, API routes security, middleware, caching',
    tags: ['frontend', 'fullstack', 'javascript'],
    detect: { files: ['package.json'], contentPatterns: ['next'], extensions: ['.jsx', '.tsx'] },
    content: '',
    enabled: false,
    autoDetected: false,
    builtIn: true,
  },
  {
    id: 'django',
    name: 'Django',
    description: 'ORM N+1, CSRF, model validation, migration safety',
    tags: ['backend', 'python'],
    detect: { files: ['requirements.txt'], contentPatterns: ['django'], extensions: ['.py'] },
    content: '',
    enabled: false,
    autoDetected: false,
    builtIn: true,
  },
  {
    id: 'sql-databases',
    name: 'SQL Databases',
    description: 'Query performance, N+1, indexing, injection, transactions',
    tags: ['database', 'backend'],
    detect: { files: [], contentPatterns: [], extensions: ['.sql'] },
    content: '',
    enabled: true,
    autoDetected: true,
    builtIn: true,
  },
  {
    id: 'rest-api',
    name: 'REST API',
    description: 'HTTP methods, status codes, versioning, pagination, error format',
    tags: ['api', 'backend'],
    detect: { files: [], contentPatterns: [], extensions: [] },
    content: '',
    enabled: true,
    autoDetected: true,
    builtIn: true,
  },
]

const mockSettings: AppSettings = {
  project: {
    monitoredDirectory: '~/projects/e-commerce-api',
    fileExtensions: '.ts, .tsx, .js, .jsx, .py, .rs',
    ignoredPaths: 'node_modules, .git, dist, __pycache__',
  },
  ai: {
    endpointUrl: 'https://api.anthropic.com/v1',
    model: 'Claude Sonnet 4',
    apiKey: 'sk-ant-••••••••••••••••',
    provider: 'anthropic',
    webSearch: true,
  },
  analysis: {
    autoAnalyze: false,
    checkpointMode: 'free_text',
    analysisDepth: 'balanced',
  },
  knowledge: {
    storagePath: '~/.codementor/knowledge',
    autoGenerateNotes: true,
  },
  appearance: {
    theme: 'dark',
    debriefLanguage: 'english',
  },
}

// ── Mutable state for session persistence ──

let commits = [...mockCommits]
let notes = [...mockKnowledgeNotes]
let skills = [...mockSkills]
let settings = { ...mockSettings }
const checkpointResponses: CheckpointResponse[] = []

// ── Service Implementations ──

export class MockProjectService implements IProjectService {
  async getProjects(): Promise<Project[]> {
    await delay()
    return [...mockProjects]
  }

  async getActiveProject(): Promise<Project | null> {
    await delay()
    return mockProjects.find((p) => p.id === activeProjectId) ?? null
  }

  async setActiveProject(projectId: string): Promise<void> {
    await delay()
    activeProjectId = projectId
  }

  async addProject(path: string): Promise<Project> {
    await delay()
    const project: Project = {
      id: `proj-${Date.now()}`,
      name: path.split('/').pop() ?? 'unknown',
      path,
      language: 'TypeScript',
      frameworks: [],
      activeSkills: ['security-general'],
      createdAt: new Date().toISOString(),
      lastAnalyzedAt: null,
    }
    mockProjects.push(project)
    return project
  }

  async removeProject(projectId: string): Promise<void> {
    await delay()
    const idx = mockProjects.findIndex((p) => p.id === projectId)
    if (idx !== -1) mockProjects.splice(idx, 1)
  }
}

export class MockDebriefService implements IDebriefService {
  async getPendingCommits(_projectId: string): Promise<Commit[]> {
    await delay()
    return commits.filter((c) => c.status === 'pending')
  }

  async getReviewedCommits(_projectId: string): Promise<Commit[]> {
    await delay()
    return commits.filter((c) => c.status === 'reviewed')
  }

  async getDebriefByCommit(commitHash: string): Promise<DebriefResult | null> {
    await delay(400)
    return mockDebriefs[commitHash] ?? null
  }

  async runDebrief(commitHash: string): Promise<DebriefResult> {
    await delay(800)
    const debrief = mockDebriefs[commitHash]
    if (!debrief) {
      throw new Error(`No mock debrief available for commit ${commitHash}`)
    }
    return debrief
  }

  async markReviewed(debriefId: string): Promise<void> {
    await delay()
    const debrief = Object.values(mockDebriefs).find((d) => d.id === debriefId)
    if (debrief) {
      debrief.status = 'reviewed'
      const commit = commits.find((c) => c.hash === debrief.commitHash)
      if (commit) commit.status = 'reviewed'
    }
  }

  async getDiffContent(_commitHash: string): Promise<string> {
    await delay()
    return mockDiff
  }

  async getGapCount(_projectId: string): Promise<number> {
    await delay()
    return Object.values(mockDebriefs).reduce((sum, d) => sum + d.gaps.length, 0)
  }
}

export class MockCheckpointService implements ICheckpointService {
  async submitCheckpoint(
    debriefId: string,
    questionId: string,
    answer: string
  ): Promise<Evaluation> {
    await delay(600)
    const evaluation: Evaluation = {
      score: 7,
      feedback:
        'Good understanding of the core concept. You correctly identified the stateless nature of JWTs and the revocation challenge. Consider also mentioning token versioning as an alternative to blacklisting.',
      keyPointsCovered: [
        'Tokens remain valid until expiry',
        'Need for a revocation mechanism',
      ],
      keyPointsMissed: [
        'Token versioning approach',
        'Short-lived tokens with refresh tokens',
      ],
    }

    const response: CheckpointResponse = {
      id: `resp-${Date.now()}`,
      debriefId,
      questionId,
      questionText: '',
      responseText: answer,
      evaluation,
      mode: 'free_text',
      createdAt: new Date().toISOString(),
    }
    checkpointResponses.push(response)

    return evaluation
  }

  async getResponses(debriefId: string): Promise<CheckpointResponse[]> {
    await delay()
    return checkpointResponses.filter((r) => r.debriefId === debriefId)
  }
}

export class MockKnowledgeService implements IKnowledgeService {
  async getNotes(): Promise<KnowledgeNote[]> {
    await delay()
    return [...notes]
  }

  async getNote(noteId: string): Promise<KnowledgeNote | null> {
    await delay()
    return notes.find((n) => n.id === noteId) ?? null
  }

  async saveNote(
    note: Partial<KnowledgeNote> & { title: string; content: string; categoryPath: string }
  ): Promise<KnowledgeNote> {
    await delay()
    const existing = note.id ? notes.find((n) => n.id === note.id) : null

    if (existing) {
      Object.assign(existing, { ...note, updatedAt: new Date().toISOString() })
      return existing
    }

    const newNote: KnowledgeNote = {
      id: `note-${Date.now()}`,
      projectId: null,
      title: note.title,
      categoryPath: note.categoryPath,
      filePath: `${note.categoryPath}/${note.title}.md`,
      content: note.content,
      autoGenerated: note.autoGenerated ?? false,
      tags: note.tags ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    notes.push(newNote)
    return newNote
  }

  async deleteNote(noteId: string): Promise<void> {
    await delay()
    notes = notes.filter((n) => n.id !== noteId)
  }

  async searchNotes(query: string): Promise<KnowledgeNote[]> {
    await delay()
    if (!query.trim()) return [...notes]
    const q = query.toLowerCase()
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q)) ||
        n.content.toLowerCase().includes(q)
    )
  }
}

export class MockSettingsService implements ISettingsService {
  async getSettings(): Promise<AppSettings> {
    await delay()
    return { ...settings }
  }

  async updateSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
    await delay()
    settings = {
      project: { ...settings.project, ...partial.project },
      ai: { ...settings.ai, ...partial.ai },
      analysis: { ...settings.analysis, ...partial.analysis },
      knowledge: { ...settings.knowledge, ...partial.knowledge },
      appearance: { ...settings.appearance, ...partial.appearance },
    }
    return { ...settings }
  }

  async getSkills(): Promise<Skill[]> {
    await delay()
    return [...skills]
  }

  async toggleSkill(skillId: string, enabled: boolean): Promise<void> {
    await delay()
    const skill = skills.find((s) => s.id === skillId)
    if (skill) skill.enabled = enabled
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    await delay(800)
    if (settings.ai.apiKey && settings.ai.apiKey.length > 5) {
      return { success: true, message: 'Connection successful! Model responded.' }
    }
    return { success: false, message: 'Connection refused: invalid API key.' }
  }
}
