const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

async function test() {
  try {
    await connectDb();

    const db = mongoose.connection.db;

    console.log("DATABASE:", mongoose.connection.name);

    // =========================================================
    // 1. Get all distinct voucherType values for this company
    // =========================================================
    const voucherTypes = await db
      .collection("vouchers")
      .distinct("voucherType", {
        organizationId: new mongoose.Types.ObjectId("6aa0e95b0dd24bc558feeef5"),
        companyId: new mongoose.Types.ObjectId("6aa0f659f858467a84d08d57"),
      });

    console.log("\n=== DISTINCT VOUCHER TYPES ===");
    console.dir(voucherTypes, { depth: null });

    // =========================================================
    // 2. Find Sales Order type vouchers
    // =========================================================
    const salesOrders = await db
      .collection("vouchers")
      .find({
        organizationId: new mongoose.Types.ObjectId("6aa0e95b0dd24bc558feeef5"),
        companyId: new mongoose.Types.ObjectId("6aa0f659f858467a84d08d57"),
        voucherType: /sales.*order/i,
      })
      .limit(3)
      .toArray();

    console.log("\n=== SALES ORDER VOUCHERS ===");
    console.dir(salesOrders, { depth: null });

    // =========================================================
    // 3. Show voucherType + voucherNumber + raw
    // =========================================================
    const vouchers = await db
      .collection("vouchers")
      .find(
        {
          organizationId: new mongoose.Types.ObjectId(
            "6aa0e95b0dd24bc558feeef5",
          ),
          companyId: new mongoose.Types.ObjectId("6aa0f659f858467a84d08d57"),
        },
        {
          projection: {
            voucherType: 1,
            voucherNumber: 1,
            raw: 1,
          },
        },
      )
      .limit(5)
      .toArray();

    console.log("\n=== SAMPLE VOUCHERS ===");
    console.dir(vouchers, { depth: null });

    // =========================================================
    // 4. Count vouchers by voucherType
    // =========================================================
    const grouped = await db
      .collection("vouchers")
      .aggregate([
        {
          $match: {
            organizationId: new mongoose.Types.ObjectId(
              "6aa0e95b0dd24bc558feeef5",
            ),
            companyId: new mongoose.Types.ObjectId("6aa0f659f858467a84d08d57"),
          },
        },
        {
          $group: {
            _id: "$voucherType",
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            count: -1,
          },
        },
      ])
      .toArray();

    console.log("\n=== VOUCHER TYPE COUNTS ===");
    console.dir(grouped, { depth: null });
  } catch (err) {
    console.error("\nERROR:", err);
  } finally {
    await mongoose.connection.close();
  }
}

test();
