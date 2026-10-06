const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// ---------- Logo ----------
const getLogoBase64 = () => {
  try {
    const candidates = [
      path.join(__dirname, "../../public/ctrlbook.png"), // src/services → root/public
      path.join(__dirname, "../public/ctrlbook.png"), // fallback
      path.join(process.cwd(), "public/ctrlbook.png"), // fallback
      path.join(process.cwd(), "src/public/ctrlbook.png"), // fallback
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        if (buf.length === 0) {
          console.warn(" Logo file empty:", p);
          continue;
        }
        console.log(` Logo loaded from ${p} (${buf.length} bytes)`);
        return `data:image/png;base64,${buf.toString("base64")}`;
      }
    }

    console.warn(" Logo not found in any candidate path:");
    candidates.forEach((p) => console.warn("   -", p));
    return "";
  } catch (e) {
    console.warn("Logo read error:", e.message);
    return "";
  }
};

// ---------- Seller / Company info ----------
const companyInfo = {
  companyName: "PayTel Financial Technologies Pvt. Ltd.(Delhi)",
  addressLine1: "A-212, 1st Floor, Phase-3",
  addressLine2: "Okhla Industrial Area",
  cityPincode: "New Delhi-110020",
  gstin: "07AALCP3083C1ZH",
  stateName: "Delhi",
  stateCode: "07",
  cin: "U74999DL2020PTC367460",
  email: "customercare@ctrlbooks.com",
  website: "www.ctrlbooks.com",
  bankAccountHolder: "PAYTEL FINANCIAL TECHNOLOGIES PVT. LTD.",
  bankName: "Yes Bank Ltd.",
  bankAccountNumber: "029861900004141",
  bankBranch: "Okhla Industrial Estate-3",
  bankIFSC: "YESB0000298",
  jurisdiction: "DELHI",
};

const SERVICE_HSN = "998315";
const GST_RATE = 18;

// ---------- Number → Words (Indian) ----------
const numberToWords = (num) => {
  if (num === 0) return "Zero";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  if (num < 20) return ones[num];
  if (num < 100)
    return tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "");
  if (num < 1000)
    return (
      ones[Math.floor(num / 100)] +
      " Hundred" +
      (num % 100 ? " and " + numberToWords(num % 100) : "")
    );
  if (num < 100000)
    return (
      numberToWords(Math.floor(num / 1000)) +
      " Thousand" +
      (num % 1000 ? " " + numberToWords(num % 1000) : "")
    );
  if (num < 10000000)
    return (
      numberToWords(Math.floor(num / 100000)) +
      " Lakh" +
      (num % 100000 ? " " + numberToWords(num % 100000) : "")
    );
  return (
    numberToWords(Math.floor(num / 10000000)) +
    " Crore" +
    (num % 10000000 ? " " + numberToWords(num % 10000000) : "")
  );
};

const amountInWords = (amount) => {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = numberToWords(rupees) + " Rupees";
  if (paise > 0) words += " and " + numberToWords(paise) + " Paise";
  return words + " Only";
};

const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const fmtDateShort = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

// ---------- Terms & Conditions ----------
// ---------- Terms & Conditions ----------
const termsAndConditionsPage1 = [
  {
    title: "Scope of Services",
    points: [
      'PayTel Financial Technologies Pvt. Ltd. ("Company") provides CtrlBooks, a cloud-based accounting and Tally connector software, on a subscription basis. The subscription grants the Client a limited, non-exclusive, non-transferable right to access and use CtrlBooks for its internal business purposes during the active subscription term.',
      "The service includes cloud hosting, secure storage of the Client's accounting data, Tally synchronization, and access to the CtrlBooks web application. Support, updates, and feature enhancements are provided as per the subscribed plan.",
    ],
  },
];

const termsAndConditions = [
  {
    title: "License Grant & Usage",
    points: [
      "CtrlBooks is licensed, not sold. The Client is granted a limited, non-exclusive, non-transferable, revocable license to use the software strictly for its own internal business operations during the active subscription period.",
      "The Client shall not: (a) copy, modify, reverse-engineer, decompile, or disassemble the software; (b) sublicense, resell, rent, lease, or distribute CtrlBooks to any third party; (c) use CtrlBooks to build a competing product; or (d) remove or alter any proprietary notices, trademarks, or branding.",
    ],
  },
  {
    title: "Subscription Term & Renewal",
    points: [
      "The subscription is valid for the period mentioned on the invoice. Access to CtrlBooks will be automatically suspended upon expiry of the subscription term.",
      "Renewal is optional and requires payment of the applicable fees for the chosen plan and billing period. The Company may revise subscription fees with prior notice to the Client.",
    ],
  },
  {
    title: "Fees, Taxes & Payment",
    points: [
      "The Client agrees to pay all fees mentioned in the invoice, including applicable GST and any additional charges for extra users/seats, as per the selected plan.",
      "All payments are to be made in advance through the Company's authorized payment gateway (Razorpay or equivalent). Invoices are generated electronically and shared via email or the Client's dashboard.",
    ],
  },
  {
    title: "No Refund Policy",
    points: [
      "All fees paid for CtrlBooks subscriptions are non-refundable under any circumstances, including but not limited to cancellation, non-usage, partial usage, dissatisfaction, or early termination.",
      "In case of duplicate payment or technical error, refunds will be considered at the sole discretion of the Company after verification.",
    ],
  },
  {
    title: "Data Ownership & Responsibility",
    points: [
      "All accounting data, ledgers, vouchers, and business records entered or synchronized into CtrlBooks remain the sole property of the Client.",
      "The Company does not claim any ownership over the Client's data. However, the Client is solely responsible for the accuracy, legality, and completeness of the data uploaded or synchronized via the Tally connector.",
      "The Company shall store data securely on cloud infrastructure and maintain regular backups. In the event of data loss, the Company will restore the most recent verified backup.",
    ],
  },

  {
    title: "Client Conduct & Acceptable Use",
    points: [
      "The Client agrees to use CtrlBooks in a lawful, responsible, and professional manner. Any misuse, abusive behavior, or unauthorized activity toward the Company's personnel, systems, or other users is strictly prohibited.",
      "Uploading or executing malicious files, viruses, or harmful code is strictly forbidden. If such actions cause data loss, service disruption, or damage, the Client shall be fully liable for the resulting losses and recovery costs.",
      "The Company reserves the right to suspend or terminate access if the Client violates these terms.",
    ],
  },
  {
    title: "Service Availability & Support",
    points: [
      "The Company aims to provide high uptime but does not guarantee uninterrupted service. Scheduled and emergency maintenance may cause temporary downtime, with prior notice where possible.",
      "Support is available during working hours (Monday to Saturday, 10:00 AM – 7:30 PM IST). All support requests must be raised via the official support portal or designated support email. No after-hours, weekend, or holiday support is provided.",
    ],
  },

  {
    title: "Governing Law & Jurisdiction",
    points: [
      "This Agreement shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or related to CtrlBooks or this Agreement shall be subject to the exclusive jurisdiction of the courts at New Delhi.",
      "By subscribing to and using CtrlBooks, the Client confirms having read, understood, and agreed to all the terms and conditions mentioned above.",
    ],
  },
];

// ---------- HTML Generator ----------
const generateHTML = (invoice) => {
  const logoUrl = getLogoBase64();

  const baseAmount = Number(invoice.subtotal) || 0;
  const gstAmount = Number(invoice.gstAmount) || 0;
  const totalAmount = Number(invoice.totalAmount) || 0;
  const gstRate = Number(invoice.gstPercent) || GST_RATE;

  const planName = invoice.plan?.name || "Subscription";
  const durationMonths = invoice.plan?.durationMonths || 1;
  const extraSeats = invoice.plan?.extraSeats || 0;
  const serviceName = `${planName} Subscription`;

  const invoiceDate = invoice.invoiceDate || new Date();
  const renewalDate = new Date(invoiceDate);
  renewalDate.setMonth(renewalDate.getMonth() + durationMonths);

  const buyer = invoice.billingTo || {};
  const buyerName = buyer.name || invoice.seller?.name || "Customer";
  const buyerAddress = buyer.address || "";
  const buyerGstin = buyer.gstin || "";
  const buyerEmail = buyer.email || "";
  const buyerPhone = buyer.phone || "";

  const rounded = Math.round(totalAmount);
  const roundOff = rounded - totalAmount;
  const isPaid = invoice.status === "PAID";

  // --- Build Terms HTML ---
  const page1TermsHTML = termsAndConditionsPage1
    .map(
      (section) => `
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.3px;">${section.title}</div>
        <ul style="margin:0;padding-left:18px;">
          ${section.points.map((p) => `<li style="font-size:10.5px;color:#334155;line-height:1.6;margin-bottom:3px;">${p}</li>`).join("")}
        </ul>
      </div>`,
    )
    .join("");

  const termsHTML = termsAndConditions
    .map(
      (section) => `
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.3px;">${section.title}</div>
        <ul style="margin:0;padding-left:18px;">
          ${section.points.map((p) => `<li style="font-size:10.5px;color:#334155;line-height:1.6;margin-bottom:3px;">${p}</li>`).join("")}
        </ul>
      </div>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Invoice ${invoice.invoiceNumber}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; font-family: Arial, sans-serif; }
  body { background:#fff; color:#1e293b; }

  /* ===== PAGE 1 ===== */
  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 5mm 14mm 0mm 14mm;
    position: relative;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: avoid; }

  .page::before {
    content: "";
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-20deg);
    width: 120mm; height: 120mm;
    background: url("${logoUrl}") no-repeat center;
    background-size: contain;
    opacity: 0.06;
    z-index: 0;
    pointer-events: none;
  }
  .page > * { position: relative; z-index: 1; }

  .invoice-header {
    position: relative;
    padding-bottom: 6px;
    margin-bottom: 5px;
    min-height: 30px;
  }
  .company-logo {
    position: absolute;
    top: 0; left: 0;
    width: 92px;
    height: auto;
  }
  .invoice-title {
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: #1e293b;
    line-height: 42px;
  }

  .top-grid {
    display:grid;
    grid-template-columns: 1fr 1fr;
    gap:0;
    border:1px solid #ccc;
    margin-bottom:0;
  }
  .top-grid .cell {
    padding:8px 10px;
    font-size:10.5px;
    line-height:1.55;
  }
  .top-grid .cell.border-right { border-right:1px solid #ccc; }
  .top-grid .cell.border-bottom { border-bottom:1px solid #ccc; }
  .company-name-top {
    font-size:13px;
    font-weight:700;
    color:#1e293b;
    margin-bottom:3px;
  }
  .label-sm {
    font-size:9.5px;
    font-weight:700;
    color:#64748b;
    text-transform:uppercase;
    letter-spacing:0.3px;
  }
  .value-md {
    font-size:11.5px;
    font-weight:700;
    color:#1e293b;
  }

  .bill-to-section {
    border:1px solid #ccc;
    border-top:none;
    padding:4px 6px;
    font-size:10.5px;
    line-height:1.4;
  }
  .section-head {
    font-size:10px;
    font-weight:700;
    text-transform:uppercase;
    color:#64748b;
    letter-spacing:0.4px;
    margin-bottom:4px;
  }
  .buyer-name {
    font-size:13px;
    font-weight:700;
    color:#1e293b;
  }

  .specs-table {
    width:100%;
    border-collapse:collapse;
    margin-top:8px;
    font-size:11px;
  }
  .specs-table thead tr { background:#f1f5f9; }
  .specs-table th {
    border:1px solid #ccc;
    padding:7px 10px;
    text-align:left;
    font-size:10px;
    font-weight:700;
    color:#475569;
    text-transform:uppercase;
    letter-spacing:0.3px;
  }
  .specs-table td {
    border:1px solid #ccc;
    padding:7px 10px;
    font-size:11px;
    color:#1e293b;
  }
  .specs-table tr:nth-child(even) td { background:#f8fafc; }

  .amount-box {
    border:1px solid #ccc;
    border-top:none;
  }
  .amount-row {
    display:flex;
    justify-content:space-between;
    align-items:center;
    padding:6px 10px;
    font-size:11px;
    border-bottom:1px solid #f1f5f9;
  }
  .amount-row:last-child { border-bottom:none; }
  .amount-row.total-row {
    background:#EBEBEB;
    color:#000000;
    font-weight:700;
    font-size:12px;
  }

  .tax-table {
    width:100%;
    border-collapse:collapse;
    margin-top:8px;
    font-size:10.5px;
  }
  .tax-table th {
    border:1px solid #ccc;
    padding:6px 10px;
    background:#f1f5f9;
    font-size:9.5px;
    font-weight:700;
    text-transform:uppercase;
    color:#475569;
    text-align:center;
  }
  .tax-table td {
    border:1px solid #ccc;
    padding:6px 10px;
    text-align:center;
    color:#1e293b;
  }

  .bank-section {
    margin-top:8px;
    border:1px solid #ccc;
    padding:8px 10px;
    font-size:10.5px;
    line-height:1.7;
  }
  .bank-grid {
    display:grid;
    grid-template-columns:160px 1fr;
    gap:2px 8px;
    font-size:10.5px;
  }
  .bank-key { color:#64748b; font-size:10px; }
  .bank-val { font-weight:600; color:#1e293b; }

  .page1-footer {
    position: absolute;
    left: 14mm; right: 14mm;
    bottom: 10mm;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-size: 9.5px;
    color: #94a3b8;
    text-align: center;
    line-height: 1.5;
  }

  /* ===== PAGE 2 - Terms ===== */
  .terms-page {
    width:210mm;
    height:297mm;
    padding:14mm 14mm 14mm 14mm;
    position: relative;
    overflow: hidden;
    page-break-after: avoid;
    box-sizing: border-box;
  }
  .terms-title {
    font-size:12px;
    font-weight:700;
    color:#1e293b;
    text-transform:uppercase;
    letter-spacing:0.5px;
    margin-bottom:2px;
    padding-bottom:4px;
    margin-top:7px;
    border-bottom:1px solid #D5D5D5;
  }
  .terms-subtitle {
    font-size:10px;
    color:#64748b;
    margin-bottom:8px;
  }
  .terms-page::before {
    content: "";
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-20deg);
    width: 120mm; height: 120mm;
    background: url("${logoUrl}") no-repeat center;
    background-size: contain;
    opacity: 0.06;
    z-index: 0;
    pointer-events: none;
  }
  .terms-page > * { position: relative; z-index: 1; }

  .terms-footer {
    position: absolute;
    left: 14mm; right: 14mm;
    bottom: 4mm;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    font-size: 9.5px;
    color: #64748b;
    text-align: center;
    line-height: 1.6;
  }
</style>
</head>
<body>

<!-- ==================== PAGE 1: INVOICE ==================== -->
<div class="page">

  ${
    isPaid
      ? `
  <div style="
    position: absolute;
    top: 12%; left: 80%;
    transform: translate(-50%, -50%);
    z-index: 10;
    pointer-events: none;
    border: 5px solid #4CAF50;
    border-radius: 12px;
    padding: 8px 18px;
    text-align: center;
    opacity: 0.60;
  ">
    <div style="font-size:18px;font-weight:900;color:#4CAF50;letter-spacing:2px;line-height:1;">PAID</div>
    <div style="font-size:8px;font-weight:700;color:#4CAF50;letter-spacing:1px;">APPROVED</div>
  </div>`
      : ""
  }

  <div class="invoice-header">
    ${logoUrl ? `<img class="company-logo" src="${logoUrl}" alt="CtrlBooks Logo"/>` : ""}
    <div class="invoice-title">Tax Invoice</div>
  </div>

  <!-- Top grid -->
  <div class="top-grid">
    <div class="cell border-right border-bottom">
      <div class="company-name-top">${companyInfo.companyName}</div>
      <div>${companyInfo.addressLine1}, ${companyInfo.addressLine2}</div>
      <div>${companyInfo.cityPincode}</div>
      <div>GSTIN: <strong>${companyInfo.gstin}</strong></div>
      <div>State: ${companyInfo.stateName} | Code: ${companyInfo.stateCode}</div>
      <div>CIN: ${companyInfo.cin}</div>
      <div>Email: ${companyInfo.email}</div>
      <div>Website: ${companyInfo.website}</div>
    </div>
    <div class="cell border-bottom">
      <div style="margin-bottom:6px;">
        <div class="label-sm">Invoice No.</div>
        <div class="value-md">${invoice.invoiceNumber}</div>
      </div>
      <div style="margin-bottom:6px;">
        <div class="label-sm">Billing Date</div>
        <div class="value-md">${fmtDate(invoiceDate)}</div>
      </div>
      <div style="margin-bottom:6px;">
        <div class="label-sm">Renewal Date</div>
        <div class="value-md">${fmtDate(renewalDate)}</div>
      </div>
      <div>
        <div class="label-sm">Service</div>
        <div class="value-md">${serviceName}</div>
      </div>
    </div>
  </div>

  <!-- Bill To -->
  <div class="bill-to-section">
    <div class="section-head">Bill To</div>
    <div class="buyer-name">${buyerName}</div>
    ${buyerAddress ? `<div>Address: ${buyerAddress}</div>` : ""}
    ${buyerPhone ? `<div>Phone: ${buyerPhone}</div>` : ""}
    ${buyerEmail ? `<div>Email: ${buyerEmail}</div>` : ""}
    ${buyerGstin ? `<div>GSTIN: <strong>${buyerGstin}</strong></div>` : ""}
  </div>

  <!-- Service Table -->
  <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:11px;">
    <thead>
      <tr style="background:#F1F5F9;">
        <th style="border:1px solid #aaa;padding:5px 6px;text-align:center;width:5%;font-size:10px;">Sl<br>No.</th>
        <th style="border:1px solid #aaa;padding:5px 6px;text-align:center;width:36%;font-size:10px;">Description of<br>Services</th>
        <th style="border:1px solid #aaa;padding:5px 6px;text-align:center;width:7%;font-size:10px;">GST<br>Rate</th>
        <th style="border:1px solid #aaa;padding:5px 6px;text-align:center;width:10%;font-size:10px;">Quantity</th>
        <th style="border:1px solid #aaa;padding:5px 6px;text-align:right;width:12%;font-size:10px;">Rate</th>
        <th style="border:1px solid #aaa;padding:5px 6px;text-align:center;width:6%;font-size:10px;">per</th>
        <th style="border:1px solid #aaa;padding:5px 6px;text-align:right;width:14%;font-size:10px;">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border-left:1px solid #aaa;border-right:1px solid #aaa;padding:5px 6px;text-align:center;">1</td>
        <td style="border-right:1px solid #aaa;padding:5px 6px;">
          <div style="font-weight:700;">${serviceName}</div>
          <div style="font-size:10px;color:#555;">
            From ${fmtDateShort(invoiceDate)} to ${fmtDateShort(renewalDate)}
          </div>
          ${extraSeats > 0 ? `<div style="font-size:10px;color:#555;">+ ${extraSeats} extra seat(s)</div>` : ""}
        </td>
        <td style="border-right:1px solid #aaa;padding:5px 6px;text-align:center;">${gstRate}%</td>
        <td style="border-right:1px solid #aaa;padding:5px 6px;text-align:center;">1 No.</td>
        <td style="border-right:1px solid #aaa;padding:5px 6px;text-align:right;">${formatINR(baseAmount)}</td>
        <td style="border-right:1px solid #aaa;padding:5px 6px;text-align:center;">No.</td>
        <td style="border-right:1px solid #aaa;padding:5px 6px;text-align:right;font-weight:700;">${formatINR(baseAmount)}</td>
      </tr>

      ${Array(6)
        .fill(
          `<tr style="height:18px;">
            <td style="border-left:1px solid #aaa;border-right:1px solid #aaa;"></td>
            <td style="border-right:1px solid #aaa;"></td>
            <td style="border-right:1px solid #aaa;"></td>
            <td style="border-right:1px solid #aaa;"></td>
            <td style="border-right:1px solid #aaa;"></td>
            <td style="border-right:1px solid #aaa;"></td>
            <td style="border-right:1px solid #aaa;"></td>
          </tr>`,
        )
        .join("")}

      <tr>
        <td style="border-left:1px solid #aaa;border-right:1px solid #aaa;border-top:1px solid #aaa;"></td>
        <td style="border-right:1px solid #aaa;border-top:1px solid #aaa;padding:5px 6px;text-align:right;font-size:10.5px;">
          IGST Output-${gstRate}% (${companyInfo.stateName})
        </td>
        <td style="border-right:1px solid #aaa;border-top:1px solid #aaa;"></td>
        <td style="border-right:1px solid #aaa;border-top:1px solid #aaa;"></td>
        <td style="border-right:1px solid #aaa;border-top:1px solid #aaa;padding:5px 6px;text-align:center;">${gstRate}</td>
        <td style="border-right:1px solid #aaa;border-top:1px solid #aaa;padding:5px 6px;text-align:center;">%</td>
        <td style="border-right:1px solid #aaa;border-top:1px solid #aaa;padding:5px 6px;text-align:right;">${formatINR(gstAmount)}</td>
      </tr>

      <tr>
        <td style="border-left:1px solid #aaa;border-right:1px solid #aaa;"></td>
        <td style="border-right:1px solid #aaa;padding:3px 6px;text-align:right;font-size:10.5px;">Round Off</td>
        <td style="border-right:1px solid #aaa;"></td>
        <td style="border-right:1px solid #aaa;"></td>
        <td style="border-right:1px solid #aaa;"></td>
        <td style="border-right:1px solid #aaa;"></td>
        <td style="border-right:1px solid #aaa;padding:3px 6px;text-align:right;font-size:10.5px;">
          ${(roundOff >= 0 ? "+" : "") + formatINR(roundOff)}
        </td>
      </tr>

      <tr style="background:#F1F5F9;border-top:2px solid #aaa;">
        <td style="border:1px solid #aaa;padding:6px;"></td>
        <td style="border:1px solid #aaa;padding:6px;font-weight:700;">Total</td>
        <td style="border:1px solid #aaa;"></td>
        <td style="border:1px solid #aaa;padding:6px;text-align:center;font-weight:700;">1 No.</td>
        <td style="border:1px solid #aaa;"></td>
        <td style="border:1px solid #aaa;"></td>
        <td style="border:1px solid #aaa;padding:6px;text-align:right;font-weight:700;font-size:12px;">₹ ${formatINR(rounded)}</td>
      </tr>
    </tbody>
  </table>

  <div style="border:1px solid #aaa;border-top:none;display:flex;justify-content:space-between;padding:5px 8px;font-size:10.5px;background:#F1F5F9;">
    <span><strong>Amount Chargeable (in words):</strong> &nbsp; INR ${amountInWords(rounded)}</span>
    <span style="color:#555;font-style:italic;">E. &amp; O.E.</span>
  </div>

  <!-- Tax Breakup -->
  <table class="tax-table">
    <thead>
      <tr>
        <th>HSN/SAC</th>
        <th>Taxable Value (₹)</th>
        <th>IGST Rate</th>
        <th>IGST Amount (₹)</th>
        <th>Total Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${SERVICE_HSN}</td>
        <td>${formatINR(baseAmount)}</td>
        <td>${gstRate}%</td>
        <td>${formatINR(gstAmount)}</td>
        <td><strong>${formatINR(totalAmount)}</strong></td>
      </tr>
    </tbody>
  </table>

  <!-- Amount breakup -->
  <div class="amount-box" style="margin-top:0;">
    <div class="amount-row"><span>Taxable Amount (Before GST)</span><span>₹ ${formatINR(baseAmount)}</span></div>
    <div class="amount-row"><span>IGST @ ${gstRate}%</span><span>₹ ${formatINR(gstAmount)}</span></div>
    <div class="amount-row total-row"><span>Total Amount Payable</span><span>₹ ${formatINR(totalAmount)}</span></div>
  </div>

  <!-- Bank Details -->
  <div style="margin-top:8px;border:1px solid #aaa;padding:10px 14px;page-break-inside:avoid;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.4px;margin-bottom:6px;">
      Company's Bank Details
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;font-size:10.5px;">
      <div style="display:flex;gap:8px;">
        <span style="color:#64748b;font-size:10px;min-width:100px;">Account Holder</span>
        <span style="font-weight:600;color:#1e293b;">: ${companyInfo.bankAccountHolder}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <span style="color:#64748b;font-size:10px;min-width:100px;">Account No.</span>
        <span style="font-weight:600;color:#1e293b;">: ${companyInfo.bankAccountNumber}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <span style="color:#64748b;font-size:10px;min-width:100px;">Bank Name</span>
        <span style="font-weight:600;color:#1e293b;">: ${companyInfo.bankName}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <span style="color:#64748b;font-size:10px;min-width:100px;">Branch</span>
        <span style="font-weight:600;color:#1e293b;">: ${companyInfo.bankBranch}</span>
      </div>
      <div style="display:flex;gap:8px;">
        <span style="color:#64748b;font-size:10px;min-width:100px;">IFSC Code</span>
        <span style="font-weight:600;color:#1e293b;">: ${companyInfo.bankIFSC}</span>
      </div>
    </div>
  </div>

  <div class="terms-title">Terms &amp; Conditions</div>
  <div class="terms-subtitle">
    Invoice No: <strong>${invoice.invoiceNumber}</strong> &nbsp;|&nbsp;
    ${companyInfo.companyName} &nbsp;|&nbsp; ${companyInfo.website}
  </div>
  ${page1TermsHTML}

  <div class="page1-footer">
    <strong>SUBJECT TO ${companyInfo.jurisdiction} JURISDICTION</strong> &nbsp;|&nbsp;
    This is a System Generated Invoice |&nbsp; Page 1 of 2
  </div>
</div>

<!-- ==================== PAGE 2: TERMS & CONDITIONS ==================== -->
<div class="terms-page">
  ${termsHTML}

  <div class="terms-footer">
    <strong>${companyInfo.companyName}</strong><br>
    ${companyInfo.addressLine1}, ${companyInfo.addressLine2}, ${companyInfo.cityPincode}<br>
    Email: ${companyInfo.email} &nbsp;|&nbsp; Website: ${companyInfo.website}<br>
    GSTIN: ${companyInfo.gstin} &nbsp;|&nbsp; CIN: ${companyInfo.cin}<br><br>
    <strong>SUBJECT TO ${companyInfo.jurisdiction} JURISDICTION</strong>
    &nbsp;|&nbsp; Page 2 of 2
  </div>
</div>

</body>
</html>`;
};

// ---------- Generate PDF ----------
const generateInvoicePdf = async (invoice) => {
  let browser = null;
  let page = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      // Windows pe stable rakhne ke liye system Chrome use karna ho to uncomment:
      // executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-accelerated-2d-canvas",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
      ],
      protocolTimeout: 120000,
    });

    page = await browser.newPage();

    await page.setViewport({
      width: 1200,
      height: 1600,
      deviceScaleFactor: 1,
    });

    // Block heavy resources — crash kam hote hain
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const type = req.resourceType();
      if (type === "media" || type === "font" || type === "websocket") {
        req.abort();
      } else {
        req.continue();
      }
    });

    page.on("error", (err) => console.error("Page error:", err.message));
    page.on("pageerror", (err) => console.error("Page JS error:", err.message));

    const html = generateHTML(invoice);

    console.log("Setting HTML content...");
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Fonts/images settle hone do
    await new Promise((r) => setTimeout(r, 1000));

    console.log("Generating PDF...");
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
      displayHeaderFooter: false,
      landscape: false,
      timeout: 60000,
    });

    console.log(
      `PDF generated successfully. Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`,
    );

    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error("PDF generation failed:", err);
    throw new Error(`Failed to generate invoice PDF: ${err.message}`);
  } finally {
    try {
      if (page) await page.close();
    } catch (_) {}
    try {
      if (browser) await browser.close();
    } catch (_) {}
  }
};

module.exports = { generateInvoicePdf };
