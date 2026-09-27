---
name: coderabbit-security-audit
description: >-
  Perform a focused security audit on the codebase or specific files. Use this
  skill when you need a deep-dive security analysis beyond standard code review,
  checking for OWASP Top 10 vulnerabilities, dependency risks, and configuration issues.
---

# CodeRabbit Security Audit Skill

Perform a focused, in-depth security audit on the codebase.

## Audit Scope

### OWASP Top 10 Check
1. **Injection**: SQL, NoSQL, OS command, LDAP injection
2. **Broken Authentication**: Weak passwords, session management
3. **Sensitive Data Exposure**: Unencrypted data, missing HTTPS
4. **XML External Entities (XXE)**: Unsafe XML parsing
5. **Broken Access Control**: Missing authorization checks
6. **Security Misconfiguration**: Default credentials, verbose errors
7. **Cross-Site Scripting (XSS)**: Reflected, stored, DOM-based
8. **Insecure Deserialization**: Unsafe object reconstruction
9. **Known Vulnerabilities**: Outdated dependencies with CVEs
10. **Insufficient Logging**: Missing audit trails

### Dependency Audit
1. Check `package.json` / `requirements.txt` / `go.mod` for known vulnerabilities.
2. Run `npm audit`, `pip-audit`, or equivalent if available.
3. Flag outdated dependencies with known security issues.

### Configuration Audit
1. Check for hardcoded secrets, API keys, tokens.
2. Verify `.env` files are in `.gitignore`.
3. Review security headers and CORS configuration.
4. Check TLS/SSL configuration.

## Output Format

```markdown
## Security Audit Report

**Scope**: [Files/directories audited]
**Risk Level**: 🔴 Critical / 🟠 High / 🟡 Medium / 🟢 Low

### Findings

#### 🔴 Critical
- [Finding with exact file:line, impact, and remediation]

#### 🟠 High
- [Finding with details]

#### 🟡 Medium
- [Finding with details]

### Recommendations
- [Prioritized list of security improvements]
```
