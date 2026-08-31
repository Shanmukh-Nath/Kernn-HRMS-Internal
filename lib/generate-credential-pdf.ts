/**
 * Official Corporate Credential & Password Reset PDF Generator
 * Generates an executive vector A4 PDF with security branding and clickable portal hyperlinks.
 */

import { jsPDF } from 'jspdf';
import { KERNN_LANDSCAPE_LOGO_BASE64 } from './logo-base64';

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
  const targetUrl = 'https://hrms.kernn.ai';
  const displayUrl = 'hrms.kernn.ai';
  const issuedDate = (data.issuedAt || new Date()).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const refCode = `KRN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Page width 210mm, height 297mm
  const margin = 18;
  const contentWidth = 210 - margin * 2; // 174mm

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

  // Brand Logo (Official Landscape Image)
  try {
    doc.addImage(KERNN_LANDSCAPE_LOGO_BASE64, 'PNG', margin, 7, 50, 21.7);
  } catch (_) {
    // Fallback if image rendering fails
    doc.setTextColor(225, 29, 72);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('KERNN', margin, 18);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('AUTOMATIONS & WORKFORCE MANAGEMENT', margin, 24);
  }

  // Document Badge on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  if (isReset) {
    doc.setFillColor(245, 158, 11);
    doc.setTextColor(11, 19, 34);
    doc.roundedRect(138, 12, 54, 8, 2, 2, 'F');
    doc.text('PASSWORD RESET NOTICE', 165, 17.5, { align: 'center' });
  } else {
    doc.setFillColor(225, 29, 72);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(138, 12, 54, 8, 2, 2, 'F');
    doc.text('OFFICIAL CREDENTIALS', 165, 17.5, { align: 'center' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`REF: ${refCode}`, 192, 26, { align: 'right' });
  doc.text(`ISSUED: ${issuedDate} IST`, 192, 31, { align: 'right' });

  // ─── 2. NOTICE / CONFIDENTIALITY BANNER ──────────────────────────────────
  let y = 48;
  if (isReset) {
    // Amber banner
    doc.setFillColor(254, 243, 199); // light amber
    doc.setDrawColor(245, 158, 11); // amber border
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 16, 2.5, 2.5, 'FD');

    doc.setTextColor(180, 83, 9); // dark amber
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CONFIDENTIAL: ADMINISTRATOR PASSWORD RESET', margin + 5, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(120, 53, 15);
    doc.text(
      'An administrator has updated the security credentials for this account. Previous passwords have been invalidated.',
      margin + 5,
      y + 11.5
    );
  } else {
    // Rose / Slate banner
    doc.setFillColor(241, 245, 249); // slate 100
    doc.setDrawColor(203, 213, 225); // slate 300
    doc.setLineWidth(0.5);
    doc.roundedRect(margin, y, contentWidth, 16, 2.5, 2.5, 'FD');

    doc.setTextColor(15, 23, 42); // slate 900
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('CONFIDENTIAL: NEW EMPLOYEE ONBOARDING ACCESS', margin + 5, y + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'This document contains private access credentials. Please share securely with the employee only.',
      margin + 5,
      y + 11.5
    );
  }

  // ─── 3. CREDENTIAL DETAILS CARD ──────────────────────────────────────────
  y = 70;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('Account Authentication Details', margin, y);

  y += 5;
  const cardHeight = 78;
  // Card Container
  doc.setFillColor(248, 250, 252); // slate 50
  doc.setDrawColor(226, 232, 240); // slate 200
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, cardHeight, 3.5, 3.5, 'FD');

  const col1X = margin + 8;
  const col2X = margin + 92;

  // Row 1: Name & Code
  const r1Y = y + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('EMPLOYEE FULL NAME', col1X, r1Y);
  doc.text('EMPLOYEE CODE', col2X, r1Y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.employeeName || 'Staff Member', col1X, r1Y + 5.5);
  doc.text(data.employeeCode || 'EMP-001', col2X, r1Y + 5.5);

  // Row 2: Mobile Username & Clickable Portal Hyperlink
  const r2Y = y + 26;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('LOGIN USERNAME (MOBILE)', col1X, r2Y);
  doc.text('PORTAL WEB ADDRESS', col2X, r2Y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.mobileNumber || '—', col1X, r2Y + 5.5);

  // Clickable Portal Link (hrms.kernn.ai)
  doc.setTextColor(2, 132, 199); // Electric Cyan / Blue
  doc.textWithLink(displayUrl, col2X, r2Y + 5.5, { url: targetUrl });
  // Underline for the hyperlink
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(0.3);
  doc.line(col2X, r2Y + 6.5, col2X + 28, r2Y + 6.5);

  // Row 3: Dedicated Prominent Password Box (No overlap)
  const passBoxY = y + 43;
  const passBoxHeight = 26;
  doc.setFillColor(isReset ? 255 : 255, isReset ? 251 : 241, isReset ? 235 : 242);
  doc.setDrawColor(isReset ? 245 : 225, isReset ? 158 : 29, isReset ? 11 : 72);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin + 6, passBoxY, contentWidth - 12, passBoxHeight, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(isReset ? 180 : 159, isReset ? 83 : 18, isReset ? 9 : 57);
  doc.text('TEMPORARY SECURITY PASSWORD', margin + 12, passBoxY + 7);

  doc.setFont('courier', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(isReset ? 180 : 225, isReset ? 83 : 29, isReset ? 9 : 72);
  doc.text(data.temporaryPassword || '••••••••', margin + 12, passBoxY + 16);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('Must be changed upon your initial login', margin + 12, passBoxY + 22);

  // ─── 4. SECURITY & LOGIN INSTRUCTIONS ────────────────────────────────────
  y = 160;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(15, 23, 42);
  doc.text('First-Time Login & Security Instructions', margin, y);

  y += 6;
  const steps = [
    {
      num: '1',
      title: 'Access the Portal via Web Browser',
      desc: 'Open your web browser and click ',
      link: displayUrl,
      url: targetUrl,
      post: ' to access the secure login gateway.',
    },
    {
      num: '2',
      title: 'Enter Initial Account Credentials',
      desc: `Input your registered mobile number (${data.mobileNumber}) as the User ID along with the temporary password above.`,
    },
    {
      num: '3',
      title: 'Mandatory Password Update',
      desc: 'The system will immediately prompt you to set a private, permanent password (minimum 8 characters).',
    },
    {
      num: '4',
      title: 'Enable Device Passkey (Recommended)',
      desc: 'On the desktop bridge app, enable Passkey for instant 1-click biometric sign-in without typing passwords.',
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

    // Step title
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.8);
    doc.text(st.title, margin + 11, y + 2.5);

    // Step description with optional hyperlink
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);

    if (st.link && st.url) {
      doc.text(st.desc, margin + 11, y + 7);
      const linkX = margin + 11 + doc.getTextWidth(st.desc);
      doc.setTextColor(2, 132, 199);
      doc.setFont('helvetica', 'bold');
      doc.textWithLink(st.link, linkX, y + 7, { url: st.url });
      const postX = linkX + doc.getTextWidth(st.link);
      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.text(st.post || '', postX, y + 7);
    } else {
      doc.text(st.desc, margin + 11, y + 7);
    }

    y += 13;
  });

  // ─── 5. COMPLIANCE & SECURITY WARNING BOX ────────────────────────────────
  y = 224;
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
    'Kernn HRMS enforces strict end-to-end access isolation. Never share or forward this document via public messaging\napps or unverified channels. If you did not request or expect this credential change, contact your HR or IT Administrator immediately.',
    margin + 6,
    y + 11.5
  );

  // ─── 6. FOOTER ────────────────────────────────────────────────────────────
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, 274, 210 - margin, 274);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Kernn Automations Pvt. Ltd. · Enterprise Workforce Security · ', margin, 280);
  const footLinkX = margin + doc.getTextWidth('Kernn Automations Pvt. Ltd. · Enterprise Workforce Security · ');
  doc.setTextColor(2, 132, 199);
  doc.textWithLink(displayUrl, footLinkX, 280, { url: targetUrl });

  doc.setTextColor(148, 163, 184);
  doc.text('STRICTLY CONFIDENTIAL · PAGE 1 OF 1', 210 - margin, 280, { align: 'right' });

  // ─── 7. SAVE / TRIGGER DOWNLOAD ───────────────────────────────────────────
  const safeName = (data.employeeName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = isReset
    ? `Kernn_PasswordReset_${safeName}.pdf`
    : `Kernn_Credentials_${safeName}.pdf`;

  doc.save(filename);
}
