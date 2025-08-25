// src/services/email.ts
import nodemailer from 'nodemailer';

interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  service?: string; // For Gmail, Outlook, etc.
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      // Check for email configuration in environment
      const emailConfig = this.getEmailConfig();

      if (!emailConfig) {
        console.log('📧 Email service: No configuration found, emails will be logged to console');
        return;
      }

      this.transporter = nodemailer.createTransport(emailConfig);
      this.isConfigured = true;
      console.log('📧 Email service: Configured successfully');

      // Verify connection
      if (this.transporter) {
        this.transporter.verify((error) => {
          if (error) {
            console.error('📧 Email service: Connection verification failed:', error.message);
            this.isConfigured = false;
          } else {
            console.log('📧 Email service: Ready to send emails');
          }
        });
      }
    } catch (error) {
      console.error('📧 Email service: Initialization failed:', error);
      this.isConfigured = false;
    }
  }

  private getEmailConfig(): EmailConfig | null {
    // Method 1: Full SMTP configuration
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      return {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      };
    }

    // Method 2: Service-based (Gmail, Outlook, etc.)
    if (process.env.EMAIL_SERVICE && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      return {
        service: process.env.EMAIL_SERVICE, // 'gmail', 'outlook', etc.
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS, // App password for Gmail
        },
      };
    }

    return null;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      if (!this.isConfigured || !this.transporter) {
        // Fallback: Log to console for development
        console.log('\n📧 EMAIL (Development Mode):');
        console.log('To:', options.to);
        console.log('Subject:', options.subject);
        console.log('Content:', options.text || options.html);
        console.log('─'.repeat(50));
        return true;
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.SMTP_USER,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('📧 Email send failed:', error);
      return false;
    }
  }

  // Template for user invitation emails
  async sendUserInvitation(options: {
    to: string;
    firstName: string;
    lastName: string;
    companyName: string;
    inviteCode: string;
    inviteLink: string;
    inviterName: string;
  }): Promise<boolean> {
    const { to, firstName, lastName, companyName, inviteCode, inviteLink, inviterName } = options;

    const subject = `Invitation to join ${companyName} - Inventory Manager`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a2b3d; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .invite-code { background: #e3f2fd; padding: 15px; border-radius: 4px; text-align: center; margin: 20px 0; }
          .code { font-family: monospace; font-size: 24px; font-weight: bold; color: #1565c0; }
          .button { display: inline-block; background: #7080ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏢 You're Invited!</h1>
            <p>Join ${companyName} on Inventory Manager</p>
          </div>
          <div class="content">
            <p>Hi ${firstName} ${lastName},</p>
            
            <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on our Inventory Management System.</p>
            
            <div class="invite-code">
              <p><strong>Your Invite Code:</strong></p>
              <div class="code">${inviteCode}</div>
            </div>
            
            <p>To get started:</p>
            <ol>
              <li>Click the button below to accept your invitation</li>
              <li>Choose a secure password for your account</li>
              <li>Start managing inventory with your team!</li>
            </ol>
            
            <div style="text-align: center;">
              <a href="${inviteLink}" class="button">Accept Invitation</a>
            </div>
            
            <p><strong>Note:</strong> This invitation will expire in 7 days.</p>
            
            <p>If you have any questions, please contact your system administrator.</p>
            
            <p>Welcome to the team!</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Inventory Manager</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      You're invited to join ${companyName}!
      
      ${inviterName} has invited you to join ${companyName} on our Inventory Management System.
      
      Your invite code: ${inviteCode}
      
      To get started:
      1. Visit: ${inviteLink}
      2. Choose a secure password for your account
      3. Start managing inventory with your team!
      
      This invitation expires in 7 days.
      
      Welcome to the team!
    `;

    return this.sendEmail({ to, subject, html, text });
  }

  // Template for password reset emails
  async sendPasswordResetEmail(options: {
    to: string;
    firstName: string;
    resetLink: string;
  }): Promise<boolean> {
    const { to, firstName, resetLink } = options;

    const subject = `Password Reset - Inventory Manager`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .warning { background: #fef3c7; padding: 15px; border-radius: 4px; border-left: 4px solid #f59e0b; margin: 20px 0; }
          .button { display: inline-block; background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔒 Password Reset</h1>
            <p>Your administrator has reset your password</p>
          </div>
          <div class="content">
            <p>Hi ${firstName},</p>
            
            <p>Your company administrator has initiated a password reset for your Inventory Manager account.</p>
            
            <div class="warning">
              <p><strong>⚠️ Security Notice:</strong></p>
              <p>If you did not request this password reset, please contact your administrator immediately.</p>
            </div>
            
            <p>To set your new password:</p>
            <ol>
              <li>Click the button below within the next 24 hours</li>
              <li>Choose a strong, secure password</li>
              <li>Log in with your new credentials</li>
            </ol>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button">Reset My Password</a>
            </div>
            
            <p><strong>Important:</strong> This link will expire in 24 hours for security purposes.</p>
            
            <p>If you have any questions or concerns, please contact your system administrator.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from Inventory Manager</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset - Inventory Manager
      
      Hi ${firstName},
      
      Your company administrator has initiated a password reset for your account.
      
      To set your new password, visit: ${resetLink}
      
      This link expires in 24 hours.
      
      If you did not request this reset, contact your administrator immediately.
    `;

    return this.sendEmail({ to, subject, html, text });
  }
}

// Export singleton instance
export const emailService = new EmailService();
