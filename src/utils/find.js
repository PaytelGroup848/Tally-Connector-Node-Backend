const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

async function test() {
  try {
    await connectDb();

    const db = mongoose.connection.db;

    const vouchers = await db
      .collection("vouchers")
      .find(
        {
          organizationId: new mongoose.Types.ObjectId(
            "6aa0e95b0dd24bc558feeef5",
          ),
          companyId: new mongoose.Types.ObjectId("6aa0f659f858467a84d08d57"),
          $or: [
            { voucherType: /quotation/i },
            { voucherType: /sales.*order/i },
          ],
        },
        {
          projection: {
            voucherType: 1,
            voucherNumber: 1,
            partyLedger: 1,
            date: 1,
            amount: 1,
            raw: 1,
          },
        },
      )
      .limit(10)
      .toArray();

    console.log("\n=== QUOTATIONS / SALES ORDERS ===");
    console.dir(vouchers, { depth: null });
  } catch (err) {
    console.error("\nERROR:", err);
  } finally {
    await mongoose.connection.close();
  }
}

test();
