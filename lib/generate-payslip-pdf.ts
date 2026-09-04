/**
 * Official Corporate Payslip PDF Generator
 * Generates an executive A4 PDF payslip with branding, itemized earnings/deductions,
 * net salary in words, and trackable Super Admin direct clearance seal.
 */

import { jsPDF } from 'jspdf';
import { KERNN_LANDSCAPE_LOGO_BASE64 } from './logo-base64';

export interface PayslipPdfData {
  employeeName: string;
  employeeCode?: string;
  department?: string;
  designation?: string;
  month: number;
  year: number;
  structureName?: string;
  basicSalary: number;
  hra: number;
  allowances: number;
  grossSalary: number;
  pfDeduction: number;
  esiDeduction: number;
  ptDeduction: number;
  lopDeduction: number;
  customDeductions?: number;
  totalDeductions: number;
  netSalary: number;
  auditNotes?: string;
  generatedBy?: string;
  isSuperAdminDirect?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Number to Indian Rupee Words converter
 */
function numberToWordsINR(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n: number): string => {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str.trim();
  };

  let integerPart = Math.floor(num);
  let crore = Math.floor(integerPart / 10000000);
  integerPart %= 10000000;
  let lakh = Math.floor(integerPart / 100000);
  integerPart %= 100000;
  let thousand = Math.floor(integerPart / 1000);
  integerPart %= 1000;
  let hundred = integerPart;

  let res = '';
  if (crore > 0) res += inWords(crore) + ' Crore ';
  if (lakh > 0) res += inWords(lakh) + ' Lakh ';
  if (thousand > 0) res += inWords(thousand) + ' Thousand ';
  if (hundred > 0) res += inWords(hundred) + ' ';

  return (res.trim() + ' Rupees Only').replace(/\s+/g, ' ');
}

export function downloadPayslipPdf(data: PayslipPdfData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Background tint
  doc.setFillColor(252, 252, 253);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Top Burgundy Header Banner
  doc.setFillColor(169, 36, 39); // #a92427
  doc.rect(margin, margin, contentWidth, 24, 'F');

  // Decorative gold/amber stripe
  doc.setFillColor(217, 119, 6);
  doc.rect(margin, margin + 24, contentWidth, 1.5, 'F');

  // Corporate Brand Header Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('KERNN AUTOMATIONS PVT LTD', margin + 6, margin + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(254, 202, 202);
  doc.text('Workforce Systems & Enterprise Biometric Infrastructure Suite', margin + 6, margin + 15);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const monthName = MONTH_NAMES[(data.month || 1) - 1] || 'Current';
  const payPeriodText = `SALARY SLIP: ${monthName.toUpperCase()} ${data.year}`;
  doc.text(payPeriodText, pageWidth - margin - 6, margin + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(254, 202, 202);
  const refCode = `KRN-PAY-${(data.employeeCode || 'EXEC').replace(/[^a-zA-Z0-9]/g, '')}-${data.year}${String(data.month).padStart(2, '0')}`;
  doc.text(`Ref: ${refCode}`, pageWidth - margin - 6, margin + 15, { align: 'right' });

  let y = margin + 32;

  // Direct Super Admin Clearance Banner (if applicable)
  if (data.isSuperAdminDirect) {
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(16, 185, 129); // emerald-500
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, 'FD');

    doc.setTextColor(6, 95, 70);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PRIVILEGED CLEARANCE: Pre-Authorized & Certified by Super Administrator (Zero Approvals Required)', margin + 4, y + 6.5);
    y += 14;
  }

  // Employee Information Box
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 32, 2.5, 2.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('EMPLOYEE IDENTIFICATION', margin + 5, y + 6);
  doc.text('COMPENSATION PARAMETERS', margin + (contentWidth / 2) + 5, y + 6);

  doc.setDrawColor(241, 245, 249);
  doc.line(margin + 5, y + 8, margin + contentWidth - 5, y + 8);
  doc.line(margin + (contentWidth / 2), y + 8, margin + (contentWidth / 2), y + 29);

  // Left Column: Identity
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  doc.text('Employee Name:', margin + 5, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.employeeName || 'Staff Member', margin + 35, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Employee Code:', margin + 5, y + 20);
  doc.setFont('courier', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.employeeCode || 'KRN-001', margin + 35, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Department:', margin + 5, y + 26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.department || 'Executive Office', margin + 35, y + 26);

  // Right Column: Parameters
  const col2X = margin + (contentWidth / 2) + 5;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Designation:', col2X, y + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.designation || 'Administrator', col2X + 30, y + 14);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Salary Package:', col2X, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(data.structureName || 'Executive Direct FTE', col2X + 30, y + 20);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Payment Mode:', col2X, y + 26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('Direct Bank Remittance', col2X + 30, y + 26);

  y += 37;

  // Earnings & Deductions Table
  const tableW = contentWidth / 2 - 2;

  // Table Headers
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, tableW, 8, 1.5, 1.5, 'FD');
  doc.roundedRect(margin + tableW + 4, y, tableW, 8, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('ITEMIZED EARNINGS', margin + 4, y + 5.5);
  doc.text('AMOUNT (INR)', margin + tableW - 4, y + 5.5, { align: 'right' });

  const dedX = margin + tableW + 4;
  doc.text('STATUTORY DEDUCTIONS', dedX + 4, y + 5.5);
  doc.text('AMOUNT (INR)', dedX + tableW - 4, y + 5.5, { align: 'right' });

  y += 10;

  // Rows Data
  const earningsList = [
    { label: 'Basic Salary (50%)', val: data.basicSalary || 0 },
    { label: 'House Rent Allowance (HRA 40%)', val: data.hra || 0 },
    { label: 'Special / Executive Allowances', val: data.allowances || 0 },
  ];

  const deductionsList = [
    { label: 'Provident Fund (PF - 12%)', val: data.pfDeduction || 0 },
    { label: 'ESIC Employee Fund', val: data.esiDeduction || 0 },
    { label: 'Professional Tax (PT)', val: data.ptDeduction || 0 },
    { label: 'Loss of Pay / Absenteeism (LOP)', val: data.lopDeduction || 0 },
  ];

  if (data.customDeductions && data.customDeductions > 0) {
    deductionsList.push({ label: 'Custom / Other Deductions', val: data.customDeductions });
  }

  const maxRows = Math.max(earningsList.length, deductionsList.length);
  const rowHeight = 7;

  for (let i = 0; i < maxRows; i++) {
    const isEven = i % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 1.5, tableW, rowHeight, 'F');
      doc.rect(dedX, y - 1.5, tableW, rowHeight, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(51, 65, 85);

    // Earning Row
    if (i < earningsList.length) {
      doc.text(earningsList[i].label, margin + 4, y + 3);
      doc.setFont('courier', 'bold');
      doc.text(`INR ${earningsList[i].val.toLocaleString('en-IN')}`, margin + tableW - 4, y + 3, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    // Deduction Row
    if (i < deductionsList.length) {
      doc.text(deductionsList[i].label, dedX + 4, y + 3);
      doc.setFont('courier', 'bold');
      doc.text(`INR ${deductionsList[i].val.toLocaleString('en-IN')}`, dedX + tableW - 4, y + 3, { align: 'right' });
      doc.setFont('helvetica', 'normal');
    }

    y += rowHeight;
  }

  y += 2;

  // Subtotal Bars
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, tableW, 8, 1.5, 1.5, 'FD');
  doc.roundedRect(dedX, y, tableW, 8, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);

  doc.text('TOTAL GROSS EARNINGS', margin + 4, y + 5.5);
  doc.setFont('courier', 'bold');
  doc.setTextColor(16, 185, 129); // emerald
  doc.text(`INR ${(data.grossSalary || 0).toLocaleString('en-IN')}`, margin + tableW - 4, y + 5.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL DEDUCTIONS', dedX + 4, y + 5.5);
  doc.setFont('courier', 'bold');
  doc.setTextColor(225, 29, 72); // rose
  doc.text(`INR ${(data.totalDeductions || 0).toLocaleString('en-IN')}`, dedX + tableW - 4, y + 5.5, { align: 'right' });

  y += 14;

  // Net Salary Highlight Card
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129);
  doc.roundedRect(margin, y, contentWidth, 18, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(6, 78, 59);
  doc.text('NET TAKE-HOME REMUNERATION:', margin + 6, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(5, 150, 105);
  doc.text(`INR ${(data.netSalary || 0).toLocaleString('en-IN')}`, pageWidth - margin - 6, y + 8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`In Words: ${numberToWordsINR(data.netSalary || 0)}`, margin + 6, y + 13.5);

  y += 24;

  // Statutory Audit & Compliance Footer
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text('STATUTORY AUDIT & AUTHENTICITY CERTIFICATION', margin + 4, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This is a system-generated electronic payslip issued under Kernn Automations Corporate Governance Policy. Pre-authorized by Super Admin with immutable cryptographic ledger entry.',
    margin + 4,
    y + 10.5
  );

  doc.text(
    `Certified By: ${data.generatedBy || 'Super Administrator'} • Date of Issuance: ${new Date().toLocaleDateString('en-IN')} • System Verify Code: ${refCode}`,
    margin + 4,
    y + 16
  );

  // Download the PDF
  const cleanName = (data.employeeName || 'Staff').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Payslip_${cleanName}_${monthName}_${data.year}.pdf`;
  doc.save(fileName);
}
