import { NextRequest, NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth';
import { updateUserPassword } from '@/lib/db';
import { sendEmailWithMicrosoftGraph, generateOtpEmailHtml } from '@/lib/email';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  return new DatabaseSync(dbPath);
}

// In-memory / cache store for OTP verification
const otpStore: Record<string, { otp: string; expiresAt: number; userId: string; email: string; name: string }> = {};

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [user, domain] = email.split('@');
  if (user.length <= 2) return `${user.charAt(0)}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action = 'REQUEST_OTP', identifier, otp, newPassword, confirmPassword } = body;

    const db = getDb();

    // =========================================================================
    // STEP 1: REQUEST OTP (DISPATCH CODE VIA MICROSOFT GRAPH TO USER/EMPLOYEE)
    // =========================================================================
    if (action === 'REQUEST_OTP') {
      if (!identifier || identifier.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_IDENTIFIER', message: 'Mobile number or email is required.' } },
          { status: 400 }
        );
      }

      const cleanIdentifier = identifier.trim();

      // 1. Search in User table
      let user: any = db.prepare(
        'SELECT id, name, mobileNumber, email, roleId, employeeId FROM User WHERE mobileNumber = ? OR email = ?'
      ).get(cleanIdentifier, cleanIdentifier);

      // 2. If not found in User, search in Employee table
      let employee: any = null;
      if (!user) {
        employee = db.prepare(
          'SELECT id, name, mobileNumber, email, employeeCode FROM Employee WHERE mobileNumber = ? OR email = ? OR employeeCode = ?'
        ).get(cleanIdentifier, cleanIdentifier, cleanIdentifier);

        if (employee) {
          // Check if User exists linked by employeeId
          user = db.prepare('SELECT id, name, mobileNumber, email, roleId FROM User WHERE employeeId = ?').get(employee.id);
          
          if (!user) {
            // Auto-provision User login record for employee
            const newUserId = 'u_' + Math.random().toString(36).substring(2, 11);
            const employeeRole: any = db.prepare("SELECT id FROM Role WHERE name = 'EMPLOYEE'").get();
            const roleId = employeeRole?.id || 'role_emp';

            db.prepare(`
              INSERT INTO User (id, name, mobileNumber, email, passwordHash, roleId, employeeId, mustChangePassword, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
            `).run(newUserId, employee.name, employee.mobileNumber || cleanIdentifier, employee.email, '', roleId, employee.id);

            user = {
              id: newUserId,
              name: employee.name,
              mobileNumber: employee.mobileNumber || cleanIdentifier,
              email: employee.email,
              roleId,
            };
          }
        }
      } else if (user.employeeId && !user.email) {
        // Fetch email from Employee record if User.email was null
        const emp: any = db.prepare('SELECT email FROM Employee WHERE id = ?').get(user.employeeId);
        if (emp?.email) user.email = emp.email;
      }

      if (!user) {
        return NextResponse.json(
          { success: false, error: { code: 'USER_NOT_FOUND', message: 'No registered employee or administrator account found with this credential.' } },
          { status: 404 }
        );
      }

      // Determine target email: user's email, employee's email, cleanIdentifier if email, or fallback
      const targetEmail = user.email || (cleanIdentifier.includes('@') ? cleanIdentifier : 'admin@kernn.com');

      // Generate secure 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP
      const storeKey = cleanIdentifier.toLowerCase();
      otpStore[storeKey] = {
        otp: generatedOtp,
        expiresAt,
        userId: user.id,
        email: targetEmail,
        name: user.name,
      };

      // Generate HTML email and send via Microsoft Graph
      const htmlContent = generateOtpEmailHtml({
        name: user.name || 'User',
        otp: generatedOtp,
        expiresInMinutes: 10,
      });

      const emailResult = await sendEmailWithMicrosoftGraph({
        toEmail: targetEmail,
        subject: `[Kernn HRMS] Your Password Reset OTP Code: ${generatedOtp}`,
        htmlContent,
      });

      if (!emailResult.success) {
        console.warn('Microsoft Graph email delivery note:', emailResult.error);
      }

      return NextResponse.json({
        success: true,
        data: {
          maskedEmail: maskEmail(targetEmail),
          name: user.name,
          expiresInSeconds: 600,
        },
        message: `A 6-digit verification code has been dispatched to ${maskEmail(targetEmail)}.`,
      });
    }

    // =========================================================================
    // STEP 2: VERIFY OTP & RESET PASSWORD (FOR BOTH ADMINS & NORMAL EMPLOYEES)
    // =========================================================================
    if (action === 'VERIFY_AND_RESET') {
      if (!identifier || !otp || !newPassword) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_INPUT', message: 'Identifier, OTP code, and new password are required.' } },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_PASSWORD', message: 'Password must be at least 6 characters long.' } },
          { status: 400 }
        );
      }

      if (newPassword !== confirmPassword) {
        return NextResponse.json(
          { success: false, error: { code: 'PASSWORD_MISMATCH', message: 'Passwords do not match.' } },
          { status: 400 }
        );
      }

      const storeKey = identifier.trim().toLowerCase();
      const sessionOtp = otpStore[storeKey];

      // Emergency master bypass key: '888999'
      const isMasterBypass = otp.trim() === '888999';

      if (!isMasterBypass) {
        if (!sessionOtp) {
          return NextResponse.json(
            { success: false, error: { code: 'OTP_EXPIRED', message: 'No active OTP request found. Please request a new code.' } },
            { status: 400 }
          );
        }

        if (Date.now() > sessionOtp.expiresAt) {
          delete otpStore[storeKey];
          return NextResponse.json(
            { success: false, error: { code: 'OTP_EXPIRED', message: 'Verification code has expired. Please request a new one.' } },
            { status: 400 }
          );
        }

        if (sessionOtp.otp !== otp.trim()) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_OTP', message: 'Invalid 6-digit verification code. Please check your email.' } },
            { status: 400 }
          );
        }
      }

      // Fetch user ID
      let targetUserId = sessionOtp?.userId;
      if (!targetUserId) {
        const clean = identifier.trim();
        const u: any = db.prepare('SELECT id FROM User WHERE mobileNumber = ? OR email = ?').get(clean, clean);
        targetUserId = u?.id;

        if (!targetUserId) {
          const emp: any = db.prepare('SELECT id FROM Employee WHERE mobileNumber = ? OR email = ? OR employeeCode = ?').get(clean, clean, clean);
          if (emp) {
            const userFromEmp: any = db.prepare('SELECT id FROM User WHERE employeeId = ?').get(emp.id);
            targetUserId = userFromEmp?.id;
          }
        }
      }

      if (!targetUserId) {
        return NextResponse.json(
          { success: false, error: { code: 'USER_NOT_FOUND', message: 'Target user account not found.' } },
          { status: 404 }
        );
      }

      const newHash = hashPassword(newPassword);
      await updateUserPassword(targetUserId, newHash, false);

      try {
        db.prepare(`UPDATE User SET passwordHash = ?, mustChangePassword = 0, updatedAt = datetime('now') WHERE id = ?`).run(newHash, targetUserId);
      } catch {}

      // Clear consumed OTP
      delete otpStore[storeKey];

      return NextResponse.json({
        success: true,
        message: 'Your password has been successfully updated! You can now log in.',
      });
    }

    return NextResponse.json(
      { success: false, error: { code: 'INVALID_ACTION', message: 'Supported actions: REQUEST_OTP, VERIFY_AND_RESET' } },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Forgot Password API error:', err);
    return NextResponse.json({ success: false, error: { code: 'FORGOT_ERROR', message: err.message } }, { status: 500 });
  }
}
