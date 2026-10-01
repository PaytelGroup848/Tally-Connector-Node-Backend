const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");

// ---------- Logo ----------
const getLogoBase64 = () => {
  try {
    const logoPath = path.join(__dirname, "../public/Cloudedata.svg");
    if (fs.existsSync(logoPath)) {
      const buf = fs.readFileSync(logoPath);
      return `data:image/svg+xml;base64,${buf.toString("base64")}`;
    }
  } catch (e) {
    console.warn("Logo read error:", e.message);
  }
  return "https://cloudedata.com/Cloudedata.svg";
};

// ---------- Seller / Company info (fixed) ----------
const companyInfo = {
  companyName: "PayTel Financial Technologies Pvt. Ltd.(Delhi)",
  addressLine1: "A-212, 1st Floor, Phase-3",
  addressLine2: "Okhla Industrial Area",
  cityPincode: "New Delhi-110020",
  gstin: "07AALCP3083C1ZH",
  stateName: "Delhi",
  stateCode: "07",
  cin: "U74999DL2020PTC367460",
  email: "customercare@cloudedata.com",
  website: "www.cloudedata.com",
  bankAccountHolder: "PAYTEL FINANCIAL TECHNOLOGIES PVT. LTD.",
  bankName: "Yes Bank Ltd.",
  bankAccountNumber: "029861900004141",
  bankBranch: "Okhla Industrial Estate-3",
  bankIFSC: "YESB0000298",
  jurisdiction: "DELHI",
};

const SERVICE_HSN = "998315";
const GST_RATE = 18;

// ---------- Number → Words ----------
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

  // Bill To — from invoice.billingTo
  const buyer = invoice.billingTo || {};
  const buyerName = buyer.name || invoice.seller?.name || "Customer";
  const buyerAddress = buyer.address || "";
  const buyerGstin = buyer.gstin || "";
  const buyerEmail = buyer.email || "";
  const buyerPhone = buyer.phone || "";

  // Round off
  const rounded = Math.round(totalAmount);
  const roundOff = rounded - totalAmount;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${invoice.invoiceNumber}</title>
<style>
  @page { size: A4; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; font-family: Arial, sans-serif; }
  body { background:#fff; color:#1e293b; }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 5mm 14mm 0 14mm;
    position: relative;
    overflow: hidden;
  }

  .page::before {
    content: "";
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) rotate(-20deg);
    width: 120mm; height: 120mm;
    background: url("${logoUrl}") no-repeat center;
    background-size: contain;
    opacity: 0.08;
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
  .company-logo { position:absolute; top:0; left:0; width:92px; height:auto; }
  .invoice-title {
    text-align: center;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 1px;
    text-transform: uppercase;
    line-height: 42px;
  }

  .top-grid {
    display:grid;
    grid-template-columns: 1fr 1fr;
    border:1px solid #ccc;
  }
  .top-grid .cell { padding:8px 10px; font-size:10.5px; line-height:1.55; }
  .top-grid .cell.border-right { border-right:1px solid #ccc; }
  .top-grid .cell.border-bottom { border-bottom:1px solid #ccc; }
  .company-name-top { font-size:13px; font-weight:700; margin-bottom:3px; }
  .label-sm { font-size:9.5px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.3px; }
  .value-md { font-size:11.5px; font-weight:700; }

  .bill-to-section {
    border:1px solid #ccc; border-top:none;
    padding:6px 10px; font-size:10.5px; line-height:1.5;
  }
  .section-head { font-size:10px; font-weight:700; text-transform:uppercase; color:#64748b; letter-spacing:0.4px; margin-bottom:4px; }
  .buyer-name { font-size:13px; font-weight:700; }

  .tax-table {
    width:100%; border-collapse:collapse; margin-top:8px; font-size:10.5px;
  }
  .tax-table th {
    border:1px solid #aaa; padding:5px 6px; background:#F1F5F9;
    font-size:9.5px; font-weight:700; text-transform:uppercase; text-align:center;
  }
  .tax-table td { border:1px solid #aaa; padding:5px 6px; text-align:center; }

  .amount-row {
    display:flex; justify-content:space-between; padding:6px 10px;
    font-size:11px; border:1px solid #aaa; border-top:none;
  }
  .amount-row.total-row { background:#EBEBEB; font-weight:700; font-size:12px; }

  .bank-section {
    margin-top:8px; border:1px solid #aaa; padding:10px 14px;
  }
  .bank-grid {
    display:grid; grid-template-columns:1fr 1fr; gap:4px 20px; font-size:10.5px;
  }
  .bank-key { color:#64748b; font-size:10px; min-width:100px; }
  .bank-val { font-weight:600; }

  .terms-title {
    font-size:12px; font-weight:700; text-transform:uppercase;
    margin-top:10px; padding-bottom:4px; border-bottom:1px solid #D5D5D5;
  }
  .terms-subtitle { font-size:10px; color:#64748b; margin-bottom:8px; }

  .page1-footer {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid #e2e8f0;
    font-size: 9.5px;
    color: #94a3b8;
    text-align: center;
    line-height: 1.5;
  }
</style>
</head>
<body>
<div class="page">

  <div class="invoice-header">
    <img class="company-logo" src="${logoUrl}" alt="Cloudedata"/>
    <div class="invoice-title">Tax Invoice</div>
  </div>

  <!-- Top Grid -->
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
          `
        <tr style="height:18px;">
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
  <div style="margin-top:8px;">
    <div class="amount-row"><span>Taxable Amount (Before GST)</span><span>₹ ${formatINR(baseAmount)}</span></div>
    <div class="amount-row"><span>IGST @ ${gstRate}%</span><span>₹ ${formatINR(gstAmount)}</span></div>
    <div class="amount-row total-row"><span>Total Amount Payable</span><span>₹ ${formatINR(totalAmount)}</span></div>
  </div>

  <!-- Bank Details -->
  <div class="bank-section">
    <div class="section-head" style="margin-bottom:6px;">Company's Bank Details</div>
    <div class="bank-grid">
      <div><span class="bank-key">Account Holder</span> <span class="bank-val">: ${companyInfo.bankAccountHolder}</span></div>
      <div><span class="bank-key">Account No.</span> <span class="bank-val">: ${companyInfo.bankAccountNumber}</span></div>
      <div><span class="bank-key">Bank Name</span> <span class="bank-val">: ${companyInfo.bankName}</span></div>
      <div><span class="bank-key">Branch</span> <span class="bank-val">: ${companyInfo.bankBranch}</span></div>
      <div><span class="bank-key">IFSC Code</span> <span class="bank-val">: ${companyInfo.bankIFSC}</span></div>
    </div>
  </div>

  <div class="terms-title">Terms &amp; Conditions</div>
  <div class="terms-subtitle">
    Invoice No: <strong>${invoice.invoiceNumber}</strong> &nbsp;|&nbsp;
    ${companyInfo.companyName} &nbsp;|&nbsp; ${companyInfo.website}
  </div>

  <div class="page1-footer">
    <strong>SUBJECT TO ${companyInfo.jurisdiction} JURISDICTION</strong> &nbsp;|&nbsp;
    This is a System Generated Invoice
  </div>

</div>
</body>
</html>`;
};

// ---------- Generate PDF ----------
const generateInvoicePdf = async (invoice) => {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-zygote",
        "--single-process",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });

    const html = generateHTML(invoice);
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await new Promise((r) => setTimeout(r, 800));

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
      displayHeaderFooter: false,
      landscape: false,
    });

    return Buffer.from(pdfBuffer);
  } catch (err) {
    console.error("PDF generation failed:", err);
    throw new Error(`Failed to generate invoice PDF: ${err.message}`);
  } finally {
    if (browser) await browser.close();
  }
};

module.exports = { generateInvoicePdf };
