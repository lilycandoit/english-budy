# Open Questions

## Future Questions

- If the app scales beyond personal use, should password reset use Gmail app-password SMTP, Resend with a custom domain, or another transactional email provider?

- If the app needs richer reporting or filtering over AI-generated word data, should selected text JSON fields migrate to Prisma `Json`?

- If automated testing becomes a priority, which minimal test layer should be added first?

## Testing Recommendation

Automated testing is deferred for now. If added later, start with a small suite that protects high-risk logic rather than broad UI coverage:

- `extractJson`, because AI responses can be malformed and this helper protects multiple AI routes.
- Password reset token hashing and expiry, because it is security-sensitive.
- SM-2 scheduling if extracted into a helper, because it controls review timing.
- Signup/auth basics, because email normalization, duplicate email rejection, and password length checks are easy to regress.
