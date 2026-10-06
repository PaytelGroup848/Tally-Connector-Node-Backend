const fs = require("fs");
const path = require("path");

const possiblePaths = [
  path.join(__dirname, "../../public/ctrlbook.png"),
  path.join(__dirname, "../public/ctrlbook.png"),
  path.join(process.cwd(), "public/ctrlbook.png"),
];

console.log("__dirname:", __dirname);
console.log("cwd:", process.cwd());
console.log("\nChecking paths:");
possiblePaths.forEach((p) => {
  console.log(`  ${fs.existsSync(p) ? "✅" : "❌"} ${p}`);
});
