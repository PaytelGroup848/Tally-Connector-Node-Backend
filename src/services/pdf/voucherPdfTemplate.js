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

const FILLER_TARGET_ROWS = { ITEMIZED: 12, ACCOUNTING: 7 };

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

  let taxRows = "";

  if (vm.layout === "ITEMIZED") {
    // Har column ke liye ek cell banao — colspan use mat karo
    const buildTaxRow = (cells, cls = "tax-row") => {
      const tds = columns
        .map((col) => {
          const val = cells[col.key] ?? "";
          return `<td style="text-align:${col.align}">${val || "&nbsp;"}</td>`;
        })
        .join("");
      return `<tr class="${cls}">${tds}</tr>`;
    };

    // ---- Tax rows: label Desc+HSN mein right, Qty mein rate, Rate mein %, Amount mein value ----
    taxRows = vm.taxes
      .map((tax) => {
        const cells = {};
        // Desc column: label right-aligned (HSN blank rahega, isliye label Desc mein hi)
        if (columns.some((c) => c.key === "desc")) {
          cells.desc = `<span style="display:block;text-align:right">${esc(tax.label)}</span>`;
        }
        // Agar HSN column hai toh uska cell khaali
        if (columns.some((c) => c.key === "hsn")) cells.hsn = "";
        // Qty column mein tax rate number
        if (columns.some((c) => c.key === "qty")) {
          cells.qty = "";
        }
        // Rate column mein "%"
        if (columns.some((c) => c.key === "rate")) {
          cells.rate = tax.rate ? `${tax.rate}%` : "";
        }
        // Amount column mein tax amount
        if (columns.some((c) => c.key === "amount")) {
          cells.amount = formatINR(tax.amount);
        }
        return buildTaxRow(cells);
      })
      .join("");

    {
      const cells = {};
      if (columns.some((c) => c.key === "desc")) {
        cells.desc = `<span style="display:block;text-align:right">Round Off</span>`;
      }
      if (columns.some((c) => c.key === "amount")) {
        const sign = vm.roundOff > 0 ? "+" : vm.roundOff < 0 ? "-" : "+";
        cells.amount = `${sign}${formatINR(Math.abs(vm.roundOff))}`;
      }
      taxRows += buildTaxRow(cells);
    }

    // ---- Total row ----
    const totalCells = {};
    if (columns.some((c) => c.key === "desc")) {
      totalCells.desc = `<strong>Total</strong>`;
    }
    if (columns.some((c) => c.key === "qty")) {
      // Total qty — agar vm.totalQty ho toh; warna blank
      totalCells.qty = vm.totalQty
        ? esc(formatQty(vm.totalQty, vm.totalUnit || ""))
        : "";
    }
    if (columns.some((c) => c.key === "amount")) {
      totalCells.amount = `<strong>&#8377; ${formatINR(vm.total)}</strong>`;
    }
    taxRows += buildTaxRow(totalCells, "grand-row");
  }

  let extraRows = 0;
  if (vm.layout === "ITEMIZED") {
    extraRows = vm.taxes.length;
    extraRows += 1;
    extraRows += 1;
  }

  const fillerCount = Math.max(
    0,
    FILLER_TARGET_ROWS[vm.layout] - rows.length - extraRows,
  );
  const fillerRow = `<tr class="filler">${columns.map(() => "<td>&nbsp;</td>").join("")}</tr>`;

  return dataRows + fillerRow.repeat(fillerCount) + taxRows;
};

const kvLine = (label, value) =>
  value ? `<div>${esc(label)}: <strong>${esc(value)}</strong></div>` : "";

const buildSellerHtml = (seller) => `
  <div class="seller-top">
    ${seller.logoDataUri ? '<div class="logo"></div>' : ""}
    <div class="seller-info">
      <div class="seller-name">${esc(seller.name)}</div>
      ${seller.address ? `<div class="seller-addr">${escMultiline(seller.address)}</div>` : ""}
      ${kvLine("GSTIN", seller.gstin)}
      ${kvLine("PAN", seller.pan)}
      ${kvLine("CIN", seller.cin)}
      ${kvLine("MSME", seller.msmeNumber)}
      ${
        seller.state
          ? `<div>State: ${esc(seller.state)}${seller.stateCode ? ` | Code: ${esc(seller.stateCode)}` : ""}</div>`
          : ""
      }
      ${kvLine("Mobile", seller.mobile)}
      ${kvLine("Email", seller.email)}
    ${kvLine(
      "Website",
      seller.website
        ? String(seller.website)
            .replace(/^https?:\/\//i, "")
            .replace(/\/$/, "")
        : "",
    )}
    </div>
  </div>`;

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

const buildConsigneeHtml = (vm) => {
  const c = vm.consignee || {};
  if (!c.name && !c.gstin) return "";

  const stateLine = [
    c.state && `State: ${esc(c.state)}`,
    c.pincode && `Postal Code: ${esc(c.pincode)}`,
  ]
    .filter(Boolean)
    .join(" | ");

  return `
  <div class="ship-box">
    <div class="box-title">Ship To</div>
    <div class="party-name">${esc(c.name)}</div>
    ${c.gstin ? `<div>GSTIN/UIN: <strong>${esc(c.gstin)}</strong></div>` : ""}
    ${c.address ? `<div>Address: ${escMultiline(c.address)}</div>` : ""}
    ${c.country ? `<div>Country: ${esc(c.country)}</div>` : ""}
    ${stateLine ? `<div>${stateLine}</div>` : ""}
  </div>`;
};

const buildDispatchHtml = (vm) => {
  const d = vm.dispatch || {};
  const rows = [
    ["Dispatch From", d.from],
    ["Dispatch Through", d.through],
    ["Dispatch Document No", d.docNo],
    ["Dispatch Date", d.date && fmtDate(d.date)],
    ["Vehicle No", d.vehicleNo],
  ].filter(([, v]) => v);

  if (!rows.length) return "";

  return `
  <div class="ship-box">
    <div class="box-title">Dispatch Details</div>
    ${rows.map(([k, v]) => `<div>${esc(k)}: <strong>${esc(v)}</strong></div>`).join("")}
  </div>`;
};

const buildOrderHtml = (vm) => {
  const o = vm.order || {};
  const rows = [
    ["Order No", o.no],
    ["Order Date", o.date && fmtDate(o.date)],
    ["Terms of Delivery", o.terms],
  ].filter(([, v]) => v);

  if (!rows.length) return "";

  return `
  <div class="ship-box">
    <div class="box-title">Order Details</div>
    ${rows.map(([k, v]) => `<div>${esc(k)}: <strong>${esc(v)}</strong></div>`).join("")}
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

/* party-grid: 2x2 with dividers */
.party-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:4px;
  margin-top:6px;
}
.party-grid > .party,
.party-grid > .ship-box{
  border:1px solid #aaa;
  padding:8px 12px;
  break-inside:avoid;
}


/* HATAO — ye sab */
.party-grid > *:nth-child(odd){
  border-right:1px solid #aaa;
}
.party-grid > *:nth-child(-n+2){
  border-bottom:1px solid #aaa;
}
.party-grid > *:nth-child(-n+2){
  padding-bottom:10px;
}
.party-grid > *:nth-child(n+3){
  padding-top:10px;
}



.ship-box .box-title{margin-bottom:3px;}
.party .label{margin-bottom:2px;}
/* tax + total rows inside the items table */
table.items tr.tax-row td{
  border-left:1px solid #aaa;
  border-right:1px solid #aaa;
  padding:4px 6px;
  vertical-align:top;
}
table.items tbody tr.grand-row td{border-bottom:1px solid #aaa !important;}

table.items tr.tax-row td[colspan]{
  font-weight:500;
}
table.items tr.grand-row td{
  background:#ebebeb;
  font-weight:700;
  font-size:12px;
  border-top:1px solid #aaa;
  border-bottom:1px solid #aaa;
  padding:5px 6px;
}

/* position:fixed elements repeat on EVERY printed page in Chromium */
.wm{position:fixed;top:50%;left:50%;width:105mm;height:105mm;transform:translate(-50%,-50%) rotate(-20deg);
    background:var(--logo) no-repeat center/contain;opacity:.06;z-index:-1;}
.stamp{position:fixed;top:40%;left:50%;transform:translate(-50%,-50%) rotate(-25deg);border:5px solid #dc2626;
    color:#dc2626;opacity:.35;font-size:44px;font-weight:900;letter-spacing:4px;padding:6px 22px;border-radius:10px;z-index:5;}

.doc-title{text-align:center;font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 0 8px;}

.top-grid{display:grid;grid-template-columns:1.4fr 1fr;border:1px solid #aaa;}
.top-grid>div{padding:8px 10px;}
.top-grid>div:first-child{border-right:1px solid #aaa;}

.sign-img{height:40px;display:flex;align-items:center;justify-content:center;}
.sign-img img{max-height:38px;max-width:90%;object-fit:contain;}

/* seller block: logo left, info right */
.seller-top{display:flex;align-items:flex-start;gap:10px;}
.logo{width:84px;height:46px;background:var(--logo) no-repeat left center/contain;flex:none;margin-top:2px;}
.seller-info{flex:1;min-width:0;}
.seller-name{font-size:13px;font-weight:700;margin-bottom:2px;}
.seller-addr{white-space:pre-line;}
.label{font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.3px;}
.value{font-size:11.5px;font-weight:700;margin-bottom:6px;}
.muted{color:#64748b;font-size:9.5px;}


.party-name{font-size:12.5px;font-weight:700;}


.ship-box .box-title{margin-bottom:3px;}

/* ---- items table: the part that must survive huge data ---- */
table.items{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:8px;}
table.items thead{display:table-header-group;}          /* header repeats on every page */
table.items tr{break-inside:avoid;page-break-inside:avoid;} /* a row is never cut in half */
table.items th{background:#f1f5f9;border:1px solid #aaa;padding:5px 6px;font-size:9.5px;text-transform:uppercase;}
table.items td{border-left:1px solid #aaa;border-right:1px solid #aaa;padding:4px 6px;vertical-align:top;overflow-wrap:anywhere;}
table.items tbody tr:last-child td{border-bottom:1px solid #aaa;}
table.items tr.filler td{height:28px;}
.item-name{font-weight:700;}

/* ---- closing: totals + bank + terms + signature always stay together ---- */
.closing{break-inside:avoid;page-break-inside:avoid;}
.words{border:1px solid #aaa;border-top:none;padding:5px 8px;background:#f1f5f9;display:flex;justify-content:space-between;gap:8px;}
.eoe{font-style:italic;color:#555;white-space:nowrap;}
table.totals{width:58%;margin-left:auto;border-collapse:collapse;border:1px solid #aaa;border-top:none;}
table.totals td{padding:4px 8px;border-bottom:1px solid #e2e8f0;}
table.totals td:last-child{text-align:right;}
table.totals tr.grand td{background:#ebebeb;font-weight:700;font-size:12px;border-top:1px solid #aaa;border-bottom:none;}

.lower + .box{margin-top:8px;}

.lower{display:grid;grid-template-columns:1fr 62mm;gap:8px;margin-top:8px;align-items:stretch;}
.box{border:1px solid #aaa;padding:6px 8px;margin-bottom:6px;break-inside:avoid;}
.box-title{font-size:9.5px;font-weight:700;text-transform:uppercase;color:#64748b;margin-bottom:3px;}
.kv{display:grid;grid-template-columns:90px 1fr;gap:2px 6px;}
.sign{border:1px solid #aaa;padding:6px 8px;display:flex;flex-direction:column;justify-content:space-between;
    min-height:78px;text-align:center;}
.sign-space{height:40px;}
`;

/* ------------------------------ public API ------------------------------ */

const buildHtml = (vm) => {
  const columns = buildColumns(vm);

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

<div class="party-grid">
  ${buildPartyHtml(vm)}
  ${buildConsigneeHtml(vm)}
  ${buildDispatchHtml(vm)}
  ${buildOrderHtml(vm)}
</div>

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
    <div class="lower">
  <div>${buildBankHtml(vm.bank)}</div>
  <div class="sign">
    <div>For <strong>${esc(vm.seller.name)}</strong></div>
    ${
      vm.seller.signatureDataUri
        ? `<div class="sign-img"><img src="${vm.seller.signatureDataUri}" alt="Signature"/></div>`
        : `<div class="sign-space"></div>`
    }
    <div>Authorised Signatory</div>
  </div>
</div>
${termsHtml}
  </div>
</body>
</html>`;
};

// Chromium fills in pageNumber / totalPages itself, so "Page 2 of 4" is always correct.
const buildFooterHtml = (vm) => `
<div style="width:100%;padding:0 12mm;font-family:Arial,sans-serif;font-size:8px;color:#64748b;">
  <div style="display:flex;justify-content:space-between;align-items:center;">
    <span>${esc(vm.footerNote)}</span>
    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
  </div>
  <div style="text-align:center;margin-top:3px;font-size:7.5px;color:#94a3b8;">
    Powered by <strong style="color:#0ea5e9;">CtrlBooks</strong> — GST billing &amp; accounting software for growing businesses.
    <span style="color:#0ea5e9;">www.ctrlbooks.com</span>
  </div>
</div>`;

module.exports = { buildHtml, buildFooterHtml };
