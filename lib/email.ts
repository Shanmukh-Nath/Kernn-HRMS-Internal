import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';

let ccaInstance: ConfidentialClientApplication | null = null;

function getMsalClient() {
  if (!ccaInstance) {
    const clientId = process.env.CLIENT_ID || '58c74a62-5a83-4267-ba12-ac36ebbe7b4f';
    const tenantId = process.env.TENANT_ID || '71846dff-e62d-451e-8300-92f1815230a3';
    const clientSecret = process.env.CLIENT_SECRET || 'nqf8Q~a1yW1IlkQmmZERVmx3DIbMTklezir.Za1V';

    ccaInstance = new ConfidentialClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      },
    });
  }
  return ccaInstance;
}

export async function getMicrosoftGraphAccessToken(): Promise<string> {
  const cca = getMsalClient();
  const tokenRequest = {
    scopes: ['https://graph.microsoft.com/.default'],
  };

  try {
    const response = await cca.acquireTokenByClientCredential(tokenRequest);
    if (!response || !response.accessToken) {
      throw new Error('No access token returned from Microsoft identity provider');
    }
    return response.accessToken;
  } catch (err: any) {
    console.error('Error acquiring Microsoft Graph token:', err.message);
    throw new Error(`Unable to acquire Graph API access token: ${err.message}`);
  }
}

/**
 * Generate a responsive, branded HTML email template for Kernn HRMS Password Reset OTP
 */
export function generateOtpEmailHtml(params: { name: string; otp: string; expiresInMinutes?: number }) {
  const { name, otp, expiresInMinutes = 10 } = params;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Kernn HRMS</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      color: #1e293b;
    }
    .wrapper {
      max-width: 540px;
      margin: 30px auto;
      background: #ffffff;
      border-radius: 20px;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #a92427 0%, #7f1d1d 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.85);
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
    .content {
      padding: 32px 28px;
    }
    .greeting {
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
    }
    .text {
      font-size: 13px;
      line-height: 1.6;
      color: #475569;
      margin-bottom: 24px;
    }
    .otp-box {
      background: #fff1f2;
      border: 2px dashed #fda4af;
      border-radius: 14px;
      padding: 20px;
      text-align: center;
      margin: 20px 0;
    }
    .otp-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9f1239;
      margin-bottom: 6px;
    }
    .otp-code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 32px;
      font-weight: 900;
      letter-spacing: 8px;
      color: #a92427;
      margin: 0;
    }
    .notice {
      background: #f1f5f9;
      border-radius: 10px;
      padding: 12px 16px;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 24px;
    }
    .footer {
      border-top: 1px solid #f1f5f9;
      padding: 20px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1 class="brand-title">Kernn HRMS Suite</h1>
      <div class="brand-subtitle">Enterprise Security & Access</div>
    </div>
    <div class="content">
      <div class="greeting">Hello, ${name}</div>
      <p class="text">
        We received a request to reset your password for your <strong>Kernn HRMS</strong> account. Use the one-time verification code below to authorize this password change:
      </p>

      <div class="otp-box">
        <div class="otp-label">One-Time Verification Code</div>
        <div class="otp-code">${otp}</div>
      </div>

      <div class="notice">
        ⏱️ <strong>Note:</strong> This verification code will expire in <strong>${expiresInMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this email.
      </div>

      <p class="text" style="margin-bottom: 0; font-size: 12px; color: #64748b;">
        Best regards,<br>
        <strong>Kernn Automations IT & Security Team</strong>
      </p>
    </div>
    <div class="footer">
      &copy; 2026 Kernn Automations. All rights reserved.<br>
      This is an automated administrative notification.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send an email via Microsoft Graph API
 */
export async function sendEmailWithMicrosoftGraph(options: {
  toEmail: string;
  subject: string;
  htmlContent: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { toEmail, subject, htmlContent } = options;
  const fromEmail = process.env.SMTP_FROM || 'noreply@kernn.ai';

  try {
    const accessToken = await getMicrosoftGraphAccessToken();

    const emailPayload = {
      message: {
        subject,
        body: {
          contentType: 'HTML',
          content: htmlContent,
        },
        toRecipients: [
          {
            emailAddress: {
              address: toEmail,
            },
          },
        ],
      },
      saveToSentItems: 'false',
    };

    const response = await axios.post(
      `https://graph.microsoft.com/v1.0/users/${fromEmail}/sendMail`,
      emailPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return { success: true };
  } catch (err: any) {
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error('Microsoft Graph sendMail failed:', errorDetails);
    return { success: false, error: errorDetails };
  }
}
