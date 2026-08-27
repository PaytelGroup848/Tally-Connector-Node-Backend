require('dotenv').config();
const { connectDb } = require('./src/config/db');
const { seedSuperAdmin } = require('./src/config/seed');
const app = require('./src/app');

const port = Number(process.env.PORT || 5000);

const start = async () => {
  await connectDb();
  await seedSuperAdmin();
  app.listen(port, () => {
    console.log(`LiveKeeping backend listening on port ${port}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
