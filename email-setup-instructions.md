# Email Service Setup for Render

## Environment Variables to Add in Render Dashboard

Go to your Render service → Environment → Add these variables:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-character-app-password
EMAIL_FROM=Inventory Manager <your-gmail@gmail.com>
```

## Alternative: SendGrid (More Professional)

If you want a more professional email service:

1. Sign up for SendGrid (free tier: 100 emails/day)
2. Get your API key
3. Use these variables instead:

```
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
EMAIL_FROM=Inventory Manager <noreply@yourdomain.com>
```

## Testing

Once added, redeploy and try sending an invite. You should see:
- ✅ Actual emails being sent
- ✅ Professional invite emails
- ✅ Password reset emails working

## Domain Migration Later

When you get a custom domain:
1. Update `EMAIL_FROM` to use your domain
2. Set up proper SPF/DKIM records
3. No code changes needed!
