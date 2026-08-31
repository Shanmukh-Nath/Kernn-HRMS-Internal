/**
 * Official Corporate Credential & Password Reset PDF Generator
 * Generates an executive A4 PDF with security branding and instructions.
 */

import { jsPDF } from 'jspdf';

export interface CredentialPdfData {
  type: 'NEW_EMPLOYEE' | 'PASSWORD_RESET';
  employeeName: string;
  employeeCode?: string;
  mobileNumber: string;
  temporaryPassword: string;
  portalUrl?: string;
  adminName?: string;
  issuedAt?: Date;
}

export function generateCredentialPdf(data: CredentialPdfData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const isReset = data.type === 'PASSWORD_RESET';
  const portalUrl = data.portalUrl || 'https://hrms.kernn.ai';
  const issuedDate = (data.issuedAt || new Date()).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const refCode = `KRN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Page width 210mm, height 297mm
  const margin = 20;
  const contentWidth = 210 - margin * 2; // 170mm

  // ─── 1. TOP CORPORATE HEADER ──────────────────────────────────────────────
  // Dark navy background header banner
  doc.setFillColor(11, 19, 34); // #0b1322
  doc.rect(0, 0, 210, 42, 'F');

  // Accent stripe on the bottom of header (Crimson or Amber)
  if (isReset) {
    doc.setFillColor(245, 158, 11); // #f59e0b Amber
  } else {
    doc.setFillColor(225, 29, 72); // #e11d48 Crimson
  }
  doc.rect(0, 40, 210, 2, 'F');

  // Brand Logo
  doc.setTextColor(225, 29, 72); // Crimson
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('KERNN', margin, 18);

  doc.setTextColor(148, 163, 184); // Slate 400
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('AUTOMATIONS & WORKFORCE MANAGEMENT', margin, 24);

  // Document Badge on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  if (isReset) {
    doc.setFillColor(245, 158, 11);
    doc.setTextColor(11, 19, 34);
    doc.roundedRect(140, 12, 50, 8, 2, 2, 'F');
    doc.text('PASSWORD RESET NOTICE', 165, 17.5, { align: 'center' });
  } else {
    doc.setFillColor(225, 29, 72);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(140, 12, 50, 8, 2, 2, 'F');
    doc.text('OFFICIAL CREDENTIALS', 165, 17.5, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`REF: ${refCode}`, 190, 26, { align: 'right' });
  doc.text(`ISSUED: ${issuedDate} IST`, 190, 31, { align: 'right' });

  // ─── 2. NOTICE / CONFIDENTIALITY BANNER ──────────────────────────────────
  let y = 52;
  if (isReset) {
    // Amber banner
    doc.setFillColor(254, 243, 199); // light amber
    doc.setDrawColor(245, 158, 11); // amber border
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 18, 3, 3, 'FD');

    doc.setTextColor(180, 83, 9); // dark amber
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('CONFIDENTIAL: ADMINISTRATOR PASSWORD RESET', margin + 6, y + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 53, 15);
    doc.text(
      'An administrator has updated the security credentials for this account. Previous passwords have been invalidated.',
      margin + 6,
      y + 12.5
    );
  } else {
    // Rose / Blue banner
    doc.setFillColor(241, 245, 249); // slate 100
    doc.setDrawColor(203, 213, 225); // slate 300
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 18, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42); // slate 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text('CONFIDENTIAL: NEW EMPLOYEE ONBOARDING ACCESS', margin + 6, y + 6.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'This document contains private access credentials. Please share securely with the employee only.',
      margin + 6,
      y + 12.5
    );
  }

  // ─── 3. CREDENTIAL DETAILS CARD ──────────────────────────────────────────
  y = 78;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Account Authentication Details', margin, y);

  y += 6;
  // Card Container
  doc.setFillColor(248, 250, 252); // slate 50
  doc.setDrawColor(226, 232, 240); // slate 200
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 76, 4, 4, 'FD');

  const fields = [
    { label: 'EMPLOYEE NAME', val: data.employeeName || 'Staff Member' },
    { label: 'EMPLOYEE CODE', val: data.employeeCode || 'EMP-001' },
    { label: 'LOGIN USERNAME (MOBILE)', val: data.mobileNumber || '—' },
    { label: 'PORTAL WEB ADDRESS', val: portalUrl },
  ];

  let fy = y + 10;
  fields.forEach((f) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139); // slate 500
    doc.text(f.label, margin + 8, fy);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42); // slate 900
    doc.text(f.val, margin + 8, fy + 5.5);

    fy += 13.5;
  });

  // Password Special Highlight Box
  const passBoxY = y + 54;
  doc.setFillColor(isReset ? 254 : 255, isReset ? 242 : 241, isReset ? 242 : 242);
  doc.setDrawColor(isReset ? 245 : 225, isReset ? 158 : 29, isReset ? 11 : 72);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin + 8, passBoxY, contentWidth - 16, 16, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(isReset ? 180 : 159, isReset ? 83 : 18, isReset ? 9 : 57);
  doc.text('TEMPORARY SECURITY PASSWORD', margin + 14, passBoxY + 5.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(isReset ? 180 : 225, isReset ? 83 : 29, isReset ? 9 : 72);
  doc.text(data.temporaryPassword || '••••••••', margin + 14, passBoxY + 11.5);

  // ─── 4. SECURITY & LOGIN INSTRUCTIONS ────────────────────────────────────
  y = 168;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('First-Time Login & Security Instructions', margin, y);

  y += 6;
  const steps = [
    {
      num: '1',
      title: 'Access the Portal',
      desc: `Open your web browser and navigate to ${portalUrl}`,
    },
    {
      num: '2',
      title: 'Enter Initial Credentials',
      desc: `Use your registered mobile number (${data.mobileNumber}) as the username and the temporary password above.`,
    },
    {
      num: '3',
      title: 'Mandatory Password Update',
      desc: 'You will be prompted immediately to create a new, strong personal password (minimum 8 characters).',
    },
    {
      num: '4',
      title: 'Enable Device Passkey (Recommended)',
      desc: 'On the desktop bridge app, enable Passkey for instant 1-click biometric authentication on your machine.',
    },
  ];

  steps.forEach((st) => {
    // Circle step icon
    doc.setFillColor(225, 29, 72);
    doc.circle(margin + 4, y + 3.5, 3.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(st.num, margin + 4, y + 4.7, { align: 'center' });

    // Step title & desc
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(st.title, margin + 12, y + 2.5);

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(st.desc, margin + 12, y + 7);

    y += 13.5;
  });

  // ─── 5. COMPLIANCE & SECURITY WARNING BOX ────────────────────────────────
  y = 232;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('SECURITY & PRIVACY POLICY ADVISORY', margin + 6, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Kernn HRMS enforces strict end-to-end access isolation. Never share or forward this document via public messaging\napps or unverified emails. If you did not request or expect this credential change, contact your HR or IT Administrator immediately.',
    margin + 6,
    y + 11.5
  );

  // ─── 6. FOOTER ────────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 274, 210 - margin, 274);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Kernn Automations Pvt. Ltd. · Enterprise Workforce Security · https://kernn.ai', margin, 280);
  doc.text('STRICTLY CONFIDENTIAL · PAGE 1 OF 1', 210 - margin, 280, { align: 'right' });

  // ─── 7. SAVE / TRIGGER DOWNLOAD ───────────────────────────────────────────
  const safeName = (data.employeeName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = isReset
    ? `Kernn_PasswordReset_${safeName}.pdf`
    : `Kernn_Credentials_${safeName}.pdf`;

  doc.save(filename);
}
