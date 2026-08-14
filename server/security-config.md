# LandLinq Security Configuration

## 🛡️ Implemented Security Measures

### 1. Rate Limiting
- **General API Rate Limit**: 100 requests per 15 minutes per IP
- **Strict Rate Limit**: 10 requests per 15 minutes for sensitive endpoints
- **Protected Endpoints**:
  - `/api/deals` (deal submissions)
  - `/api/deals/:id/score` (scoring operations)
  - `/api/deals/:id/insights` (AI analysis)
- **Headers**: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset

### 2. Input Sanitization & Validation
- **Automatic sanitization** of all request bodies, query parameters, and URL parameters
- **XSS prevention**: Removes HTML tags, JavaScript protocols, event handlers
- **Control character removal**: Strips dangerous control characters
- **Field validation** for all user inputs with proper length limits and type checking

### 3. SQL Injection Prevention
- **Pattern detection** for common SQL injection attempts
- **Parameterized queries** through Drizzle ORM
- **Input validation** before database operations
- **Automatic blocking** of suspicious patterns

### 4. XSS Protection
- **Security Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Content-Security-Policy` with strict source restrictions
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` with restricted features

### 5. CORS Configuration
- **Allowed Origins**:
  - Production: `https://landlinq.replit.app`
  - Development: `http://localhost:3000`, `http://localhost:5000`
  - Dynamic Replit domains from `REPLIT_DOMAINS` environment variable
- **Credentials Support**: Enabled for authenticated requests
- **Pre-flight Caching**: 24 hours for OPTIONS requests

### 6. Environment Variable Security
- **Required Variables**: DATABASE_URL, SESSION_SECRET
- **Validation**: Checks for minimum security requirements
- **Sensitive Data Protection**: Never exposes secrets in logs or responses
- **Auto-validation**: Startup validation ensures all critical vars are present

## 🔒 Authentication Security

### Session Management
- **PostgreSQL Session Store**: Persistent, secure session storage
- **Secure Cookies**: HTTPOnly, Secure in production, SameSite protection
- **Session TTL**: 7 days maximum
- **CSRF Protection**: SameSite cookie policy

### Password Security
- **Team Accounts**: Environment-managed password for @catalystcp.com emails (CATALYST_TEAM_PASSWORD)
- **Password Hashing**: Scrypt with random salt for external users
- **Timing Attack Prevention**: Constant-time password comparison

## 📝 Validation Schemas

### Deal Submissions
- Property address: 10-500 characters
- Asking price: $0 - $100,000,000
- Property size: 0.1 - 10,000 acres
- Zoning: 1-50 characters
- Sewer: Boolean validation
- Notes/Description: 0-2000 characters

### User Registration
- Name: 2-100 characters
- Email: Valid email format
- Phone: 10-20 characters
- Company: 2-200 characters

### Analyst Updates
- Classification: 'green', 'yellow', 'red' only
- Notes: 0-2000 characters
- Priority: 'low', 'medium', 'high', 'critical' only

## 🚨 Security Logging

All security events are logged with:
- Timestamp
- Event type
- IP address
- User agent
- Request details
- Outcome

### Logged Events
- Login attempts (successful/failed)
- Registration attempts
- Rate limit violations
- Validation failures
- Suspicious input patterns

## 🔧 Security Monitoring

- **Real-time logging** of security events
- **Rate limit tracking** with automatic blocking
- **Input validation monitoring** for attack patterns
- **Authentication audit trail** for all access attempts

## 📋 Security Checklist

✅ Rate limiting on all endpoints
✅ Input sanitization and validation
✅ SQL injection prevention
✅ XSS protection with security headers
✅ CORS configuration for secure origins
✅ Environment variable security
✅ Secure session management
✅ Password security best practices
✅ Security event logging
✅ Automated security monitoring

## 🛠️ Maintenance

- **Regular Updates**: Keep security packages updated
- **Log Monitoring**: Review security logs weekly
- **Rate Limit Tuning**: Adjust limits based on usage patterns
- **Security Testing**: Periodic penetration testing recommended
- **Compliance Review**: Quarterly security audit

## 🚀 Performance Impact

- **Minimal overhead**: Security middleware adds <10ms per request
- **Memory efficient**: In-memory rate limiting with automatic cleanup
- **Database optimized**: Efficient session storage with PostgreSQL
- **Scalable design**: Supports high-traffic production environments