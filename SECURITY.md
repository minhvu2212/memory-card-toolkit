# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** create a public GitHub issue
2. Email the maintainers directly with details
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

## Security Considerations

This application handles disk operations that can result in **data loss**. 
Please be aware of the following:

- Always run with appropriate privileges (Administrator on Windows)
- The app protects system drives (C:) from formatting
- All destructive operations require explicit confirmation
- No data is sent to external servers

Thank you for helping keep Memory Card Toolkit secure!
