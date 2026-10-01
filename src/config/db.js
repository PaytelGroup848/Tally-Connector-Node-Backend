const mongoose = require("mongoose");

const connectDb = async () => {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/test";
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  return mongoose.connection;
};

module.exports = { connectDb };
