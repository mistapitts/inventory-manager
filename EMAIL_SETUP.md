# 📧 Email Setup Guide

The inventory management system can send invitation emails to new users. Here's how to configure email for different environments:

## 🚀 Quick Setup Options

### Option 1: Gmail (Easiest)
1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account Settings → Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. **Add to your `.env` file**:
   ```env
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   EMAIL_FROM=your-email@gmail.com
   ```

### Option 2: Outlook/Hotmail
1. **Add to your `.env` file**:
   ```env
   EMAIL_SERVICE=hotmail
   EMAIL_USER=your-email@outlook.com
   EMAIL_PASS=your-password
   EMAIL_FROM=your-email@outlook.com
   ```

### Option 3: Company SMTP Server
1. **Get SMTP details** from your IT department
2. **Add to your `.env` file**:
   ```env
   SMTP_HOST=smtp.yourcompany.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=noreply@yourcompany.com
   SMTP_PASS=your-smtp-password
   EMAIL_FROM=noreply@yourcompany.com
   ```

## 🏢 Render Deployment

### Environment Variables
In your Render dashboard, add these environment variables:
- `EMAIL_SERVICE` = `gmail` (or your service)
- `EMAIL_USER` = `your-email@gmail.com`
- `EMAIL_PASS` = `your-app-password`
- `EMAIL_FROM` = `your-email@gmail.com`

## 🧪 Development Mode

**No configuration needed!** 

If no email settings are provided, the system will:
- ✅ Still create invite codes
- ✅ Log email content to console
- ✅ Return invite codes in API response
- ✅ Allow manual sharing of invite links

## 🔧 Testing Email Setup

1. **Start your server**
2. **Check console logs** for email service status:
   - ✅ `Email service: Configured successfully`
   - ✅ `Email service: Ready to send emails`
   - ⚠️ `Email service: No configuration found, emails will be logged to console`

3. **Test by inviting a user** from the My Company page

## 📋 Supported Email Services

- **Gmail** (`gmail`)
- **Outlook/Hotmail** (`hotmail`)
- **Yahoo** (`yahoo`)
- **Custom SMTP** (any company server)

## 🔒 Security Notes

- **Never commit** email passwords to git
- **Use App Passwords** for Gmail (not your regular password)
- **Use environment variables** for all credentials
- **Consider using** a dedicated email account for system notifications

## ❓ Troubleshooting

### "Authentication failed"
- Check your email/password
- For Gmail: Use App Password, not regular password
- Ensure 2FA is enabled for Gmail

### "Connection refused"
- Check SMTP host and port
- Verify firewall settings
- Try different ports (587, 465, 25)

### "No configuration found"
- Check your `.env` file exists
- Verify environment variable names
- Restart your server after changes

## 🎯 Production Recommendations

1. **Use a dedicated email** (e.g., `noreply@yourcompany.com`)
2. **Set up SPF/DKIM records** to avoid spam filters
3. **Monitor email delivery** logs
4. **Have a backup method** for critical invitations

---

**Need help?** Check the console logs for detailed error messages!
