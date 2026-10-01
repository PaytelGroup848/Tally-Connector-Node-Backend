const EMAIL_KEYS = new Set([
  "email",
  "emailid",
  "emailaddress",
  "ledgeremail",
  "e-mail",
]);

const PHONE_KEYS = new Set([
  "phone",
  "mobile",
  "telephone",
  "phonenumber",
  "mobilenumber",
  "ledgerphone",
  "ledgermobile",
  "ledgercontact",
  "contact",
  "contactnumber",
]);

const ADDRESS_KEYS = new Set([
  "address",
  "mailingaddress",
  "ledgeraddress",
  "addresslist",
]);

const GSTIN_KEYS = new Set([
  "gstin",
  "gstno",
  "gstnumber",
  "partygstin",
  "gstregistrationnumber",
  "partygstinno",
]);

const SKIP_KEYS = new Set([
  "organizationid",
  "companyid",
  "_id",
  "id",
  "tallyexternalid",
  "openingbalance",
  "closingbalance",
  "creditlimit",
  "creditdays",
  "name",
  "parent",
  "group",
  "ledgertype",
]);

const normalizeKey = (key) => String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();

const stringifyValue = (value) => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    const preferred =
      stringifyValue(value.EMAIL) ||
      stringifyValue(value.email) ||
      stringifyValue(value.ADDRESS) ||
      stringifyValue(value.address) ||
      stringifyValue(value.PHONE) ||
      stringifyValue(value.phone);
    if (preferred) return preferred;
    return Object.values(value).map(stringifyValue).filter(Boolean).join(", ");
  }
  return "";
};

const walk = (node, depth, bags) => {
  if (!node || typeof node !== "object" || depth > 5) return;

  if (Array.isArray(node)) {
    node.forEach((item) => walk(item, depth + 1, bags));
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    const normalized = normalizeKey(key);
    if (SKIP_KEYS.has(normalized)) {
      if (value && typeof value === "object") walk(value, depth + 1, bags);
      continue;
    }

    const text = stringifyValue(value);
    if (EMAIL_KEYS.has(normalized) && text.includes("@")) bags.email.push(text);
    else if (PHONE_KEYS.has(normalized) && text) bags.phone.push(text);
    else if (ADDRESS_KEYS.has(normalized) && text) bags.address.push(text);
    else if (GSTIN_KEYS.has(normalized) && text) bags.gstin.push(text);

    if (value && typeof value === "object") walk(value, depth + 1, bags);
  }
};

const first = (values) => {
  for (const value of values) {
    if (value && String(value).trim()) return String(value).trim();
  }
  return "";
};

const pickPartyContact = (doc = {}) => {
  const bags = { email: [], phone: [], address: [], gstin: [] };
  walk(doc, 0, bags);
  if (doc.raw && typeof doc.raw === "object") walk(doc.raw, 0, bags);

  return {
    email: first([doc.email, ...bags.email]),
    phone: first([doc.phone, ...bags.phone]),
    address: first([doc.address, ...bags.address]),
    gstin: first([doc.gstin, ...bags.gstin]),
  };
};

const withPartyContact = (doc = {}) => {
  const contact = pickPartyContact(doc);
  return {
    email: doc.email || contact.email || "",
    phone: doc.phone || contact.phone || "",
    address: doc.address || contact.address || "",
    gstin: doc.gstin || contact.gstin || "",
  };
};

module.exports = { pickPartyContact, withPartyContact };
