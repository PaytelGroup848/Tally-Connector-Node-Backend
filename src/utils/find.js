const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

async function test() {
  try {
    await connectDb();

    const db = mongoose.connection.db;

    const organizationId = new mongoose.Types.ObjectId(
      "6aa0e95b0dd24bc558feeef5",
    );

    const companyId = new mongoose.Types.ObjectId("6abb4ec96e37745ef5c69c49");

    const voucherId = new mongoose.Types.ObjectId("6aca333bfa5e92fc5668086a");

    // =========================================================
    // QUERY 1: TOTAL LEDGERS
    // =========================================================
    const totalLedgers = await db.collection("ledgers").countDocuments({
      organizationId,
      companyId,
    });

    console.log("\n========================================");
    console.log("QUERY 1: TOTAL LEDGERS");
    console.log("========================================");
    console.log("Total Ledgers:", totalLedgers);

    // =========================================================
    // QUERY 2: SUNDRY DEBTORS
    // =========================================================
    const sundryDebtors = await db.collection("ledgers").countDocuments({
      organizationId,
      companyId,
      parent: "Sundry Debtors",
    });

    console.log("\n========================================");
    console.log('QUERY 2: PARENT = "Sundry Debtors"');
    console.log("========================================");
    console.log("Sundry Debtors Ledgers:", sundryDebtors);

    // =========================================================
    // QUERY 3: UNIQUE PARENTS / GROUPS
    // =========================================================
    const parentsGroups = await db
      .collection("ledgers")
      .aggregate([
        {
          $match: {
            organizationId,
            companyId,
          },
        },
        {
          $group: {
            _id: {
              parent: "$parent",
              group: "$group",
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: { count: -1 },
        },
      ])
      .toArray();

    console.log("\n========================================");
    console.log("QUERY 3: UNIQUE PARENTS / GROUPS");
    console.log("========================================");

    console.dir(parentsGroups, {
      depth: null,
      colors: true,
    });

    // =========================================================
    // QUERY 4: TOTAL CUSTOMERS
    // =========================================================
    const totalCustomers = await db.collection("customers").countDocuments({
      organizationId,
      companyId,
    });

    console.log("\n========================================");
    console.log("QUERY 4: TOTAL CUSTOMERS");
    console.log("========================================");
    console.log("Total Customers:", totalCustomers);

    // =========================================================
    // QUERY 5: FETCH VOUCHER DIRECTLY BY ID
    // IMPORTANT: No organizationId/companyId filter here.
    // =========================================================
    const voucher = await db.collection("vouchers").findOne({
      _id: voucherId,
    });

    console.log("\n========================================");
    console.log("QUERY 5: VOUCHER DETAILS BY ID");
    console.log("========================================");

    if (!voucher) {
      console.log("Voucher not found:", voucherId.toString());
    } else {
      console.log("\n--- VOUCHER BASIC DETAILS ---");

      console.dir(
        {
          _id: voucher._id,
          organizationId: voucher.organizationId,
          companyId: voucher.companyId,
          voucherNumber: voucher.voucherNumber,
          voucherType: voucher.voucherType,
          voucherTypeName: voucher.voucherTypeName,
          type: voucher.type,
          date: voucher.date,
          partyLedgerName: voucher.partyLedgerName,
          partyName: voucher.partyName,
          totalAmount: voucher.totalAmount,
        },
        {
          depth: null,
          colors: true,
        },
      );

      console.log("\n--- ORGANIZATION / COMPANY MATCH CHECK ---");

      console.log(
        "Organization matches:",
        String(voucher.organizationId) === String(organizationId),
      );

      console.log(
        "Company matches:",
        String(voucher.companyId) === String(companyId),
      );

      console.log("\n--- INVENTORY ENTRIES CHECK ---");

      console.log(
        "inventoryEntries exists:",
        Object.prototype.hasOwnProperty.call(voucher, "inventoryEntries"),
      );

      console.log(
        "inventoryEntries type:",
        Array.isArray(voucher.inventoryEntries)
          ? "Array"
          : typeof voucher.inventoryEntries,
      );

      console.log(
        "inventoryEntries count:",
        Array.isArray(voucher.inventoryEntries)
          ? voucher.inventoryEntries.length
          : "Not an array",
      );

      console.log("\n--- INVENTORY ENTRIES DATA ---");

      console.dir(voucher.inventoryEntries ?? null, {
        depth: null,
        colors: true,
      });

      console.log("\n--- LINES CHECK ---");

      console.log(
        "lines exists:",
        Object.prototype.hasOwnProperty.call(voucher, "lines"),
      );

      console.log(
        "lines type:",
        Array.isArray(voucher.lines) ? "Array" : typeof voucher.lines,
      );

      console.log(
        "lines count:",
        Array.isArray(voucher.lines) ? voucher.lines.length : "Not an array",
      );

      console.log("\n--- LINES DATA ---");

      console.dir(voucher.lines ?? null, {
        depth: null,
        colors: true,
      });

      console.log("\n--- COMPLETE VOUCHER DOCUMENT ---");

      console.dir(voucher, {
        depth: null,
        colors: true,
      });
    }

    // =========================================================
    // QUERY 6: SAMPLE SALES VOUCHERS FOR CURRENT COMPANY
    // =========================================================
    const salesVouchers = await db
      .collection("vouchers")
      .find({
        organizationId,
        companyId,
        $or: [
          { voucherType: /^sales$/i },
          { type: /^sales$/i },
          { voucherTypeName: /^sales$/i },
        ],
      })
      .limit(5)
      .toArray();

    console.log("\n========================================");
    console.log("QUERY 6: SALES VOUCHERS");
    console.log("========================================");
    console.log("Sales vouchers found:", salesVouchers.length);

    console.dir(
      salesVouchers.map((item) => ({
        _id: item._id,
        voucherNumber: item.voucherNumber,
        voucherType: item.voucherType,
        date: item.date,
        inventoryEntries: item.inventoryEntries,
        lines: item.lines,
      })),
      {
        depth: null,
        colors: true,
      },
    );

    // =========================================================
    // QUERY 7: SAMPLE LEDGERS
    // =========================================================
    const sampleLedgers = await db
      .collection("ledgers")
      .find(
        {
          organizationId,
          companyId,
        },
        {
          projection: {
            _id: 1,
            name: 1,
            parent: 1,
            group: 1,
            tallyExternalId: 1,
            ledgerType: 1,
          },
        },
      )
      .limit(20)
      .toArray();

    console.log("\n========================================");
    console.log("QUERY 7: SAMPLE LEDGERS");
    console.log("========================================");

    console.dir(sampleLedgers, {
      depth: null,
      colors: true,
    });

    console.log("\n========================================");
    console.log("ALL QUERIES COMPLETED");
    console.log("========================================");
  } catch (err) {
    console.error("\nERROR:", err);
  } finally {
    await mongoose.connection.close();
  }
}

test();
