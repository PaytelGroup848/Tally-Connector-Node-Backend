const mongoose = require("mongoose");

const connectDb = async () => {
  const uri =
    process.env.MONGO_URI ||
    "mongodb://datacloude8_db_user:6ru82Z0uNhMhoz5u@ac-twlm6pz-shard-00-00.xcqrnjz.mongodb.net:27017,ac-twlm6pz-shard-00-01.xcqrnjz.mongodb.net:27017,ac-twlm6pz-shard-00-02.xcqrnjz.mongodb.net:27017/?ssl=true&replicaSet=atlas-h0mo8s-shard-0&authSource=admin&appName=CloudedataConnect";
  if (!uri) {
    throw new Error("MONGO_URI is not set");
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  return mongoose.connection;
};

module.exports = { connectDb };
