# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Auto2FA seriously. If you believe you've found a security vulnerability, please follow these steps:

1. **Do Not** disclose the vulnerability publicly until it has been addressed by our team.

2. Email your findings to [security@auto2fa.app](mailto:security@auto2fa.app).

3. Provide detailed information about the vulnerability:
   - Type of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fixes (if any)

4. We will acknowledge your email within 48 hours and aim to:
   - Confirm the vulnerability
   - Keep you informed of our progress
   - Release a fix as soon as possible

## Security Measures

Auto2FA implements several security measures to protect user data:

- All sensitive data is stored in the macOS Keychain
- Credentials are never stored in plain text
- Memory is cleared after use
- No data is sent to external servers
- All processing happens locally
- Regular security audits
- Dependency updates
- Code review process

## Best Practices

When using Auto2FA:

1. Keep your macOS and Safari up to date
2. Use strong master passwords
3. Enable FileVault on your Mac
4. Regularly review your account mappings
5. Report any suspicious behavior

## Responsible Disclosure

We believe in responsible disclosure and will:

1. Acknowledge receipt of vulnerability reports
2. Keep reporters informed of progress
3. Credit reporters in our security changelog
4. Release fixes promptly
5. Maintain transparency about security issues

## Security Updates

Security updates will be released as needed and will be clearly marked in the release notes. We recommend always using the latest version of Auto2FA. 