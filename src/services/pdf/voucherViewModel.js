const fs = require("fs");
const path = require("path");
const {
  LOGO_DIR,
  SIGNATURE_DIR,
} = require("../../middlewares/upload.middleware");

/* ------------------------------ voucher type config ------------------------------ */

const ITEMIZED_TYPES = {
  sales: {
    title: "Tax Invoice",
    numberLabel: "Invoice No.",
    partyLabel: "Bill To",
    showBank: true,
  },
  quotation: {
    title: "Quotation",
    numberLabel: "Quotation No.",
    partyLabel: "Quotation For",
    showBank: true,
  },
  "sales order": {
    title: "Sales Order",
    numberLabel: "Order No.",
    partyLabel: "Bill To",
    showBank: false,
  },
  "delivery note": {
    title: "Delivery Note",
    numberLabel: "Delivery Note No.",
    partyLabel: "Deliver To",
    showBank: false,
  },
  "credit note": {
    title: "Credit Note",
    numberLabel: "Credit Note No.",
    partyLabel: "Party",
    showBank: false,
  },
  purchase: {
    title: "Purchase Invoice",
    numberLabel: "Bill No.",
    partyLabel: "Supplier",
    showBank: false,
  },
  "purchase order": {
    title: "Purchase Order",
    numberLabel: "Order No.",
    partyLabel: "Supplier",
    showBank: false,
  },
  "debit note": {
    title: "Debit Note",
    numberLabel: "Debit Note No.",
    partyLabel: "Party",
    showBank: false,
  },
  "receipt note": {
    title: "Receipt Note",
    numberLabel: "Receipt Note No.",
    partyLabel: "Supplier",
    showBank: false,
  },
};

const ACCOUNTING_TYPES = {
  receipt: {
    title: "Receipt Voucher",
    numberLabel: "Receipt No.",
    partyLabel: "Received From",
  },
  payment: {
    title: "Payment Voucher",
    numberLabel: "Voucher No.",
    partyLabel: "Paid To",
  },
  journal: {
    title: "Journal Voucher",
    numberLabel: "Voucher No.",
    partyLabel: "",
  },
  contra: {
    title: "Contra Voucher",
    numberLabel: "Voucher No.",
    partyLabel: "",
  },
};

// Used by the controller to decide whether to look the party up in Suppliers first.
const SUPPLIER_SIDE_TYPES = [
  "purchase",
  "purchase order",
  "debit note",
  "receipt note",
  "payment",
];

const TAX_RE = /(cgst|sgst|utgst|igst|cess)/i;
const ROUND_RE = /round/i;

/* ------------------------------ small helpers ------------------------------ */

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Tally often stores quantity as "10 Nos" and rate as "500.00/Nos".
const parseQty = (v) => {
  if (v === null || v === undefined || v === "") return { qty: 0, unit: "" };
  if (typeof v === "number") return { qty: v, unit: "" };
  const m = String(v)
    .trim()
    .match(/^(-?[\d,.]+)\s*(.*)$/);
  return m
    ? { qty: parseFloat(m[1].replace(/,/g, "")) || 0, unit: m[2] || "" }
    : { qty: 0, unit: "" };
};

const parseRate = (v) => {
  if (typeof v === "number") return v;
  const m = String(v ?? "").match(/-?[\d,.]+/);
  return m ? parseFloat(m[0].replace(/,/g, "")) || 0 : 0;
};

const extractRateFromLabel = (label) => {
  const m = String(label || "").match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : 0;
};

const readLogoDataUri = async (fileName) => {
  if (!fileName) return "";
  const mime = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  }[path.extname(fileName).toLowerCase()];
  if (!mime) return "";
  try {
    const buf = await fs.promises.readFile(
      path.join(LOGO_DIR, path.basename(fileName)),
    );
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e) {
    return ""; // file missing on disk — render without a logo instead of failing the PDF
  }
};

const readSignatureDataUri = async (fileName) => {
  if (!fileName) return "";
  const mime = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  }[path.extname(fileName).toLowerCase()];
  if (!mime) return "";
  try {
    const buf = await fs.promises.readFile(
      path.join(SIGNATURE_DIR, path.basename(fileName)),
    );
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch (e) {
    return "";
  }
};

const ledgerEntriesOf = (voucher, lines) => {
  if (Array.isArray(voucher.ledgerEntries) && voucher.ledgerEntries.length) {
    return voucher.ledgerEntries.map((e) => {
      const amount = num(e.amount);
      return {
        name: e.ledgerName || "",
        debit: amount < 0 ? Math.abs(amount) : 0,
        credit: amount > 0 ? amount : 0,
        isParty: Boolean(e.isPartyLedger),
      };
    });
  }
  return lines.map((l) => ({
    name: l.ledgerName || "",
    debit: num(l.debit),
    credit: num(l.credit),
    isParty: false,
  }));
};

const mapInventoryEntry = (e) => {
  const { qty, unit } = parseQty(
    e.billedQty ?? e.quantity ?? e.qty ?? e.actualQty,
  );
  return {
    name: e.itemName || e.stockItemName || e.name || "",
    description: e.description || "",
    hsn: e.hsnCode || e.hsn || e.gstHsnCode || "",
    qty,
    unit: e.unit || e.uom || unit,
    rate: parseRate(e.rate),
    amount: Math.abs(num(e.amount)),
  };
};

const buildItems = (voucher, lines, entries, partyName) => {
  const inventoryEntries =
    (Array.isArray(voucher.inventoryEntries) && voucher.inventoryEntries) ||
    (Array.isArray(voucher.raw?.inventoryEntries) &&
      voucher.raw.inventoryEntries) ||
    [];

  if (inventoryEntries.length) {
    return inventoryEntries.map(mapInventoryEntry);
  }

  const itemLines = lines.filter((l) => l.itemName);
  if (itemLines.length) {
    return itemLines.map((l) => ({
      name: l.itemName,
      description: "",
      hsn: "",
      qty: num(l.qty),
      unit: "",
      rate: num(l.rate),
      amount:
        Math.abs(num(l.credit) - num(l.debit)) || num(l.qty) * num(l.rate),
    }));
  }

  const party = String(partyName || "")
    .trim()
    .toLowerCase();
  return entries
    .filter(
      (e) =>
        e.name &&
        !e.isParty &&
        e.name.trim().toLowerCase() !== party &&
        !TAX_RE.test(e.name) &&
        !ROUND_RE.test(e.name),
    )
    .map((e) => ({
      name: e.name,
      description: "",
      hsn: "",
      qty: 0,
      unit: "",
      rate: 0,
      amount: Math.max(e.debit, e.credit),
    }));
};

const buildVoucherViewModel = async ({
  company,
  voucher,
  lines,
  profile,
  bank,
  party,
}) => {
  const typeKey = String(voucher.voucherType || "")
    .trim()
    .toLowerCase();
  const itemizedCfg = ITEMIZED_TYPES[typeKey];
  const accountingCfg = ACCOUNTING_TYPES[typeKey] || {
    title: `${voucher.voucherType || "Voucher"} Voucher`,
    numberLabel: "Voucher No.",
    partyLabel: "Party",
  };
  const layout = itemizedCfg ? "ITEMIZED" : "ACCOUNTING";
  const cfg = itemizedCfg || accountingCfg;

  const partyName = voucher.partyLedger || party?.name || "";
  const entries = ledgerEntriesOf(voucher, lines);
  const total = Math.abs(num(voucher.amount));

  const items =
    layout === "ITEMIZED" ? buildItems(voucher, lines, entries, partyName) : [];

  const taxes =
    layout === "ITEMIZED"
      ? entries
          .filter((e) => TAX_RE.test(e.name))
          .map((e) => ({
            label: e.name,
            amount: Math.max(e.debit, e.credit),
            rate:
              num(e.taxRate ?? e.rate ?? e.gstRate) ||
              extractRateFromLabel(e.name),
          }))
      : [];
  const taxSum = taxes.reduce((sum, t) => sum + t.amount, 0);

  const itemsSum = items.reduce((sum, i) => sum + i.amount, 0);
  const subtotal = items.length ? itemsSum : Math.max(0, total - taxSum);
  const computed = subtotal + taxSum;
  const rounded = Math.round(computed);
  const roundOff = layout === "ITEMIZED" ? rounded - computed : 0;

  const totalQty = items.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  const totalUnit = items.find((i) => i.unit)?.unit || "";


    const advanced =
      voucher.raw?.advancedSettings || voucher.advancedSettings || {};

    const consignee = {
      name: advanced.consigneeName || "",
      gstin: advanced.consigneeGstin || "",
      address: advanced.consigneeAddress || "",
      state: advanced.consigneeState || "",
      country: advanced.consigneeCountry || "",
      pincode: advanced.consigneePincode || "",
    };

    const dispatch = {
      from: advanced.destination || "",
      through: advanced.dispatchedThrough || "",
      docNo: advanced.dispatchDocNo || "",
      date: advanced.dispatchDate || "",
      vehicleNo: advanced.vehicleNo || "",
    };

    const order = {
      no: advanced.orderNo || "",
      date: advanced.orderDate || "",
      terms: advanced.terms || "",
    };

  const seller = {
    name: company.tallyCompanyName || "",
    address: profile?.address || "",
    gstin: profile?.gstin || "",
    pan: profile?.pan || "",
    cin: profile?.cin || "",
    msmeNumber: profile?.msmeNumber || "",
    mobile: profile?.mobile || "",
    email: profile?.email || "",
    website: profile?.website || "",
    state: profile?.state || "",
    stateCode: profile?.stateCode || "",
    logoDataUri: await readLogoDataUri(profile?.logoFileName),
    signatureDataUri: await readSignatureDataUri(profile?.signatureFileName),
  };

  return {
    layout,
    docTitle: cfg.title,
    numberLabel: cfg.numberLabel,
    partyLabel: cfg.partyLabel,
    seller,

    number: voucher.voucherNumber || "",
    date: voucher.date,
    party: {
      name: partyName,
      address: party?.address || "",
      gstin: party?.gstin || "",
      phone: party?.phone || "",
      email: party?.email || "",
    },
    items,
    entries: layout === "ACCOUNTING" ? entries.filter((e) => e.name) : [],
    taxes,
    subtotal,
    roundOff,
    totalQty,
    totalUnit,
    total: rounded,
    bank: itemizedCfg?.showBank ? bank || null : null,
    terms: layout === "ITEMIZED" ? profile?.termsAndConditions || "" : "",
    consignee,
    dispatch,
    order,
    narration: String(voucher.narration || "").slice(0, 1000),
    isCancelled: Boolean(voucher.isCancelled),
    footerNote: profile?.state
      ? `Subject to ${profile.state} jurisdiction  |  This is a computer generated document`
      : "This is a computer generated document",
  };
};

module.exports = { buildVoucherViewModel, SUPPLIER_SIDE_TYPES };
