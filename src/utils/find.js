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
            count: {
              $sum: 1,
            },
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
      ])
      .toArray();

    console.log("\n========================================");
    console.log("QUERY 3: UNIQUE PARENTS / GROUPS");
    console.log("========================================");

    console.dir(parentsGroups, {
      depth: null,
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
    // EXTRA: SAMPLE LEDGERS
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
    console.log("SAMPLE LEDGERS");
    console.log("========================================");

    console.dir(sampleLedgers, {
      depth: null,
    });
  } catch (err) {
    console.error("\nERROR:", err);
  } finally {
    await mongoose.connection.close();
  }
}

test();
