const mongoose = require("mongoose");
const { connectDb } = require("../config/db");

async function test() {
  try {
    await connectDb();

    const db = mongoose.connection.db;
    const vouchers = db.collection("vouchers");

    console.log("DATABASE:", mongoose.connection.name);

    
   const result = await db
     .collection("vouchers")
     .aggregate([
       {
         $match: {
           voucherType: "Sales",
         },
       },
       {
         $group: {
           _id: "$raw.raw.parent",
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

   console.dir(result, { depth: null });

  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    await mongoose.connection.close();
  }
}

test();
