// Pure functions: view-model in -> HTML string out. No DB, no browser here.

/* ------------------------------ helpers ------------------------------ */

// EVERY dynamic value goes through esc(). Party names, addresses, narration and
// terms are user-controlled text rendered inside Chromium — never inject them raw.
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[ch],
  );

const escMultiline = (value) => esc(value).replace(/\r?\n/g, "<br/>");

const formatINR = (n) =>
  new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n) || 0);

const formatQty = (qty, unit) => {
  const q = Number(qty) || 0;
  const text = Number.isInteger(q)
    ? String(q)
    : q.toFixed(3).replace(/\.?0+$/, "");
  return unit ? `${text} ${unit}` : text;
};

const fmtDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const ONES = [
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
const TENS = [
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

const numberToWords = (num) => {
  if (num === 0) return "Zero";
  if (num < 20) return ONES[num];
  if (num < 100)
    return TENS[Math.floor(num / 10)] + (num % 10 ? ` ${ONES[num % 10]}` : "");
  if (num < 1000) {
    return `${ONES[Math.floor(num / 100)]} Hundred${num % 100 ? ` and ${numberToWords(num % 100)}` : ""}`;
  }
  if (num < 100000) {
    return `${numberToWords(Math.floor(num / 1000))} Thousand${num % 1000 ? ` ${numberToWords(num % 1000)}` : ""}`;
  }
  if (num < 10000000) {
    return `${numberToWords(Math.floor(num / 100000))} Lakh${num % 100000 ? ` ${numberToWords(num % 100000)}` : ""}`;
  }
  return `${numberToWords(Math.floor(num / 10000000))} Crore${num % 10000000 ? ` ${numberToWords(num % 10000000)}` : ""}`;
};

const amountInWords = (amount) => {
  const value = Math.abs(Number(amount) || 0);
  let rupees = Math.floor(value);
  let paise = Math.round((value - rupees) * 100);
  if (paise === 100) {
    rupees += 1;
    paise = 0;
  }
  let words = `Indian Rupees ${numberToWords(rupees)}`;
  if (paise > 0) words += ` and ${numberToWords(paise)} Paise`;
  return `${words} Only`;
};

/* ------------------------------ columns / rows ------------------------------ */

// Rows added when there are few items so a normal invoice still fills the page
// (the classic ruled look). Rows are only padding — they never cause a page break
// on their own for big invoices, because the count shrinks to 0 as items grow.
const FILLER_TARGET_ROWS = { ITEMIZED: 8, ACCOUNTING: 6 };

const buildColumns = (vm) => {
  if (vm.layout === "ACCOUNTING") {
    return [
      { key: "sl", label: "Sl No.", width: "7%", align: "center" },
      { key: "desc", label: "Particulars", width: "57%", align: "left" },
      { key: "debit", label: "Debit (INR)", width: "18%", align: "right" },
      { key: "credit", label: "Credit (INR)", width: "18%", align: "right" },
    ];
  }

  const showHsn = vm.items.some((item) => item.hsn);
  return [
    { key: "sl", label: "Sl No.", width: "6%", align: "center" },
    {
      key: "desc",
      label: "Description",
      width: showHsn ? "42%" : "54%",
      align: "left",
    },
    showHsn && { key: "hsn", label: "HSN/SAC", width: "12%", align: "center" },
    { key: "qty", label: "Qty", width: "12%", align: "right" },
    { key: "rate", label: "Rate", width: "12%", align: "right" },
    { key: "amount", label: "Amount (INR)", width: "16%", align: "right" },
  ].filter(Boolean);
};

const cellValue = (col, row, index) => {
  switch (col.key) {
    case "sl":
      return String(index + 1);
    case "desc":
      return `<div class="item-name">${esc(row.name)}</div>${
        row.description
          ? `<div class="muted">${escMultiline(row.description)}</div>`
          : ""
      }`;
    case "hsn":
      return esc(row.hsn);
    case "qty":
      return row.qty ? esc(formatQty(row.qty, row.unit)) : "";
    case "rate":
      return row.rate ? formatINR(row.rate) : "";
    case "amount":
      return formatINR(row.amount);
    case "debit":
      return row.debit > 0 ? formatINR(row.debit) : "";
    case "credit":
      return row.credit > 0 ? formatINR(row.credit) : "";
    default:
      return "";
  }
};

const buildTableRows = (vm, columns) => {
  const rows = vm.layout === "ITEMIZED" ? vm.items : vm.entries;

  const dataRows = rows
    .map(
      (row, index) =>
        `<tr>${columns
          .map(
            (col) =>
              `<td style="text-align:${col.align}">${cellValue(col, row, index)}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const fillerCount = Math.max(0, FILLER_TARGET_ROWS[vm.layout] - rows.length);
  const fillerRow = `<tr class="filler">${columns.map(() => "<td>&nbsp;</td>").join("")}</tr>`;

  return dataRows + fillerRow.repeat(fillerCount);
};

/* ------------------------------ blocks ------------------------------ */

const kvLine = (label, value) =>
  value ? `<div>${esc(label)}: <strong>${esc(value)}</strong></div>` : "";

const buildSellerHtml = (seller) => `
  <div class="seller-top">
    ${seller.logoDataUri ? '<div class="logo"></div>' : ""}
    <div class="seller-name">${esc(seller.name)}</div>
  </div>
  ${seller.address ? `<div>${escMultiline(seller.address)}</div>` : ""}
  ${kvLine("GSTIN", seller.gstin)}
  ${kvLine("PAN", seller.pan)}
  ${kvLine("CIN", seller.cin)}
  ${
    seller.state
      ? `<div>State: ${esc(seller.state)}${seller.stateCode ? ` | Code: ${esc(seller.stateCode)}` : ""}</div>`
      : ""
  }
  ${kvLine("Mobile", seller.mobile)}
  ${kvLine("Email", seller.email)}
  ${kvLine("Website", seller.website)}`;

const buildPartyHtml = (vm) => {
  if (!vm.party.name) return "";
  const p = vm.party;
  return `
  <div class="party">
    <div class="label">${esc(vm.partyLabel || "Party")}</div>
    <div class="party-name">${esc(p.name)}</div>
    ${p.address ? `<div>${escMultiline(p.address)}</div>` : ""}
    ${kvLine("GSTIN", p.gstin)}
    ${kvLine("Phone", p.phone)}
    ${kvLine("Email", p.email)}
  </div>`;
};

const buildBankHtml = (bank) => {
  if (!bank) return "";
  const rows = [
    ["Account Holder", bank.accountHolderName],
    ["Bank", bank.bankName],
    ["Account No.", bank.accountNumber],
    ["IFSC Code", bank.ifscCode],
    ["Branch", bank.branchName],
    ["SWIFT Code", bank.swiftCode],
  ].filter(([, value]) => value);

  return `
  <div class="box">
    <div class="box-title">Company's Bank Details</div>
    <div class="kv">
      ${rows.map(([k, v]) => `<span class="muted">${esc(k)}</span><strong>: ${esc(v)}</strong>`).join("")}
    </div>
  </div>`;
};

const buildTotalsRows = (vm) => {
  const rows = [];
  if (vm.layout === "ITEMIZED") {
    rows.push(["Taxable Amount", formatINR(vm.subtotal)]);
    vm.taxes.forEach((tax) => rows.push([tax.label, formatINR(tax.amount)]));
    if (Math.abs(vm.roundOff) >= 0.005) {
      rows.push([
        "Round Off",
        `${vm.roundOff > 0 ? "+" : "-"}${formatINR(Math.abs(vm.roundOff))}`,
      ]);
    }
  }
  return rows;
};

/* ------------------------------ styles ------------------------------ */

const buildStyles = (vm) => `
${vm.seller.logoDataUri ? `:root{--logo:url("${vm.seller.logoDataUri}");}` : ""}
@page { size: A4; }
*{margin:0;padding:0;box-sizing:border-box;font-family:Arial,"Noto Sans","DejaVu Sans",sans-serif;}
body{color:#1e293b;font-size:10.5px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact;}

/* position:fixed elements repeat on EVERY printed page in Chromium */
.wm{position:fixed;top:50%;left:50%;width:105mm;height:105mm;transform:translate(-50%,-50%) rotate(-20deg);
    background:var(--logo) no-repeat center/contain;opacity:.06;z-index:-1;}
.stamp{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);border:5px solid #dc2626;
    color:#dc2626;opacity:.35;font-size:44px;font-weight:900;letter-spacing:4px;padding:6px 22px;border-radius:10px;z-index:5;}

.doc-title{text-align:center;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 0 8px;}

.top-grid{display:grid;grid-template-columns:1.4fr 1fr;border:1px solid #aaa;}
.top-grid>div{padding:8px 10px;}
.top-grid>div:first-child{border-right:1px solid #aaa;}
.seller-top{display:flex;align-items:center;gap:10px;margin-bottom:4px;}
.logo{width:84px;height:46px;background:var(--logo) no-repeat left center/contain;flex:none;}
.seller-name{font-size:13px;font-weight:700;}
.label{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.3px;}
.value{font-size:11.5px;font-weight:700;margin-bottom:6px;}
.muted{color:#64748b;font-size:9.5px;}

.party{border:1px solid #aaa;border-top:none;padding:6px 10px;break-inside:avoid;}
.party-name{font-size:12.5px;font-weight:700;}

/* ---- items table: the part that must survive huge data ---- */
table.items{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:8px;}
table.items thead{display:table-header-group;}          /* header repeats on every page */
table.items tr{break-inside:avoid;page-break-inside:avoid;} /* a row is never cut in half */
table.items th{background:#f1f5f9;border:1px solid #aaa;padding:5px 6px;font-size:9.5px;text-transform:uppercase;}
table.items td{border-left:1px solid #aaa;border-right:1px solid #aaa;padding:4px 6px;vertical-align:top;overflow-wrap:anywhere;}
table.items tbody tr:last-child td{border-bottom:1px solid #aaa;}
table.items tr.filler td{height:20px;}
.item-name{font-weight:700;}

/* ---- closing: totals + bank + terms + signature always stay together ---- */
.closing{break-inside:avoid;page-break-inside:avoid;}
.words{border:1px solid #aaa;border-top:none;padding:5px 8px;background:#f1f5f9;display:flex;justify-content:space-between;gap:8px;}
.eoe{font-style:italic;color:#555;white-space:nowrap;}
table.totals{width:58%;margin-left:auto;border-collapse:collapse;border:1px solid #aaa;border-top:none;}
table.totals td{padding:4px 8px;border-bottom:1px solid #e2e8f0;}
table.totals td:last-child{text-align:right;}
table.totals tr.grand td{background:#ebebeb;font-weight:700;font-size:12px;border-top:1px solid #aaa;border-bottom:none;}

.lower{display:grid;grid-template-columns:1fr 62mm;gap:8px;margin-top:8px;}
.box{border:1px solid #aaa;padding:6px 8px;margin-bottom:6px;break-inside:avoid;}
.box-title{font-size:9.5px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:3px;}
.kv{display:grid;grid-template-columns:90px 1fr;gap:2px 6px;}
.sign{border:1px solid #aaa;padding:6px 8px;display:flex;flex-direction:column;justify-content:space-between;
    min-height:78px;text-align:center;align-self:start;}
.sign-space{height:40px;}
`;

/* ------------------------------ public API ------------------------------ */

const buildHtml = (vm) => {
  const columns = buildColumns(vm);

  const totalsRows = buildTotalsRows(vm);
  const totalsHtml = `
    <table class="totals">
      ${totalsRows.map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join("")}
      <tr class="grand"><td>Total</td><td>&#8377; ${formatINR(vm.total)}</td></tr>
    </table>`;

  const termsHtml = vm.terms
    ? `<div class="box"><div class="box-title">Terms &amp; Conditions</div>${escMultiline(vm.terms)}</div>`
    : "";
  const narrationHtml = vm.narration
    ? `<div class="box"><div class="box-title">Narration</div>${escMultiline(vm.narration)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"/>
<title>${esc(vm.docTitle)} ${esc(vm.number)}</title>
<style>${buildStyles(vm)}</style>
</head>
<body>
  ${vm.seller.logoDataUri ? '<div class="wm"></div>' : ""}
  ${vm.isCancelled ? '<div class="stamp">CANCELLED</div>' : ""}

  <div class="doc-title">${esc(vm.docTitle)}</div>

  <div class="top-grid">
    <div>${buildSellerHtml(vm.seller)}</div>
    <div>
      <div class="label">${esc(vm.numberLabel)}</div>
      <div class="value">${esc(vm.number)}</div>
      <div class="label">Date</div>
      <div class="value">${esc(fmtDate(vm.date))}</div>
    </div>
  </div>

  ${buildPartyHtml(vm)}

  <table class="items">
    <colgroup>${columns.map((col) => `<col style="width:${col.width}"/>`).join("")}</colgroup>
    <thead>
      <tr>${columns.map((col) => `<th style="text-align:${col.align}">${esc(col.label)}</th>`).join("")}</tr>
    </thead>
    <tbody>${buildTableRows(vm, columns)}</tbody>
  </table>

  <div class="closing">
    <div class="words">
      <span><strong>Amount in words:</strong> ${esc(amountInWords(vm.total))}</span>
      <span class="eoe">E. &amp; O.E.</span>
    </div>
    ${totalsHtml}
    <div class="lower">
      <div>${buildBankHtml(vm.bank)}${termsHtml}${narrationHtml}</div>
      <div class="sign">
        <div>For <strong>${esc(vm.seller.name)}</strong></div>
        <div class="sign-space"></div>
        <div>Authorised Signatory</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

// Chromium fills in pageNumber / totalPages itself, so "Page 2 of 4" is always correct.
const buildFooterHtml = (vm) => `
<div style="width:100%;padding:0 12mm;font-family:Arial,sans-serif;font-size:8px;color:#64748b;display:flex;justify-content:space-between;">
  <span>${esc(vm.footerNote)}</span>
  <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>`;

module.exports = { buildHtml, buildFooterHtml };
