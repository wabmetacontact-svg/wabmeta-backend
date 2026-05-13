// src/utils/email.resend.ts

import { Resend } from 'resend';
import { config } from '../config';

// ============================================
// INITIALIZE RESEND
// ============================================

const resend = config.email.resendApiKey
    ? new Resend(config.email.resendApiKey)
    : null;

if (!resend) {
    console.warn('⚠️ Resend API key not configured');
}

// ============================================
// EMAIL TEMPLATES
// ============================================

export const emailTemplates = {
    verifyEmail: (name: string, verifyUrl: string) => ({
        subject: '🔐 Verify your WabMeta account',
        html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f4f4f7;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px; 
            }
            .button { 
              display: inline-block; 
              background: #667eea; 
              color: white !important; 
              padding: 14px 32px; 
              text-decoration: none; 
              border-radius: 8px; 
              margin: 24px 0;
              font-weight: 600;
              transition: background 0.3s;
            }
            .button:hover {
              background: #5568d3;
            }
            .link-box {
              background: #f8f9fa;
              padding: 16px;
              border-radius: 8px;
              word-break: break-all;
              margin: 20px 0;
              font-size: 13px;
              color: #666;
            }
            .footer { 
              text-align: center; 
              padding: 20px;
              background: #f8f9fa;
              color: #666; 
              font-size: 13px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to WabMeta! 🎉</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px; margin-bottom: 10px;">Hi <strong>${name}</strong>,</p>
              <p style="color: #666; margin-bottom: 24px;">
                Thanks for signing up! Please verify your email address to activate your account and start using WabMeta.
              </p>
              <div style="text-align: center;">
                <a href="${verifyUrl}" class="button">Verify Email Address</a>
              </div>
              <div class="link-box">
                <strong>Or copy this link:</strong><br>
                <a href="${verifyUrl}" style="color: #667eea;">${verifyUrl}</a>
              </div>
              <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                ⏰ This link will expire in 24 hours.<br>
                🚫 If you didn't create an account, please ignore this email.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
              <p style="margin: 8px 0 0 0;">
                <a href="https://wabmeta.com" style="color: #667eea; text-decoration: none;">Visit Website</a>
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
    }),

    resetPassword: (name: string, resetUrl: string) => ({
        subject: '🔑 Reset your WabMeta password',
        html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f4f4f7;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content { 
              padding: 40px 30px; 
            }
            .button { 
              display: inline-block; 
              background: #f5576c; 
              color: white !important; 
              padding: 14px 32px; 
              text-decoration: none; 
              border-radius: 8px; 
              margin: 24px 0;
              font-weight: 600;
            }
            .link-box {
              background: #f8f9fa;
              padding: 16px;
              border-radius: 8px;
              word-break: break-all;
              margin: 20px 0;
              font-size: 13px;
              color: #666;
            }
            .footer { 
              text-align: center; 
              padding: 20px;
              background: #f8f9fa;
              color: #666; 
              font-size: 13px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Password Reset Request 🔒</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px;">Hi <strong>${name}</strong>,</p>
              <p style="color: #666;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              <div class="link-box">
                <strong>Or copy this link:</strong><br>
                <a href="${resetUrl}" style="color: #f5576c;">${resetUrl}</a>
              </div>
              <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                ⏰ This link will expire in 1 hour.<br>
                🚫 If you didn't request a password reset, please ignore this email or contact support if you're concerned.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    }),

    otp: (name: string, otp: string) => ({
        subject: '🔢 Your WabMeta verification code',
        html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f4f4f7;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .content { 
              padding: 40px 30px; 
            }
            .otp { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 24px; 
              text-align: center; 
              font-size: 42px; 
              font-weight: bold; 
              letter-spacing: 12px; 
              margin: 30px 0; 
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
            .footer { 
              text-align: center; 
              padding: 20px;
              background: #f8f9fa;
              color: #666; 
              font-size: 13px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Verification Code 🔐</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px;">Hi <strong>${name}</strong>,</p>
              <p style="color: #666;">
                Your verification code is:
              </p>
              <div class="otp">${otp}</div>
              <p style="text-align: center; color: #666; font-size: 15px;">
                Enter this code to verify your account
              </p>
              <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                ⏰ This code will expire in 10 minutes.<br>
                🚫 If you didn't request this code, please ignore this email.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    }),

    welcome: (name: string) => ({
        subject: '🎉 Welcome to WabMeta!',
        html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background-color: #f4f4f7;
            }
            .container { 
              max-width: 600px; 
              margin: 40px auto; 
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 40px 30px; 
              text-align: center; 
            }
            .content { 
              padding: 40px 30px; 
            }
            .button { 
              display: inline-block; 
              background: #667eea; 
              color: white !important; 
              padding: 14px 32px; 
              text-decoration: none; 
              border-radius: 8px; 
              margin: 24px 0;
              font-weight: 600;
            }
            .footer { 
              text-align: center; 
              padding: 20px;
              background: #f8f9fa;
              color: #666; 
              font-size: 13px; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to WabMeta! 🎉</h1>
            </div>
            <div class="content">
              <p style="font-size: 16px;">Hi <strong>${name}</strong>,</p>
              <p style="color: #666;">
                Welcome to WabMeta! We're excited to have you on board.
              </p>
              <p style="color: #666;">
                WabMeta helps you scale your business with WhatsApp Marketing, Automation, and CRM.
              </p>
              <div style="text-align: center;">
                <a href="${config.frontendUrl}/dashboard" class="button">Go to Dashboard</a>
              </div>
              <p style="color: #999; font-size: 13px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                Need help? Reply to this email or visit our help center.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">© ${new Date().getFullYear()} WabMeta. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    }),
};

// ============================================
// SEND EMAIL FUNCTION
// ============================================

interface SendEmailOptions {
    to: string;
    subject: string;
    html: string;
}

export const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
    // Check if Resend is configured
    if (!resend) {
        console.warn('⚠️ Resend not configured - Email not sent:', options.subject);
        return false;
    }

    try {
        const { data, error } = await resend.emails.send({
            from: `${config.email.fromName} <${config.email.from}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
        });

        if (error) {
            console.error('❌ Resend error:', error);
            return false;
        }

        console.log('✅ Email sent successfully:', {
            to: options.to,
            subject: options.subject,
            id: data?.id,
        });

        return true;
    } catch (error: any) {
        console.error('📧 Email sending failed:', error);
        return false;
    }
};

// ============================================
// VERIFY CONFIGURATION
// ============================================

export const verifyEmailConfig = async (): Promise<boolean> => {
    if (!resend) {
        console.log('ℹ️ Resend not configured');
        return false;
    }

    console.log('✅ Resend configured and ready');
    return true;
};