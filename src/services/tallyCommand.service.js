const Command = require("../models/Command"); // apna model path check karo


async function postTallyCommand({
  organizationId,
  companyId,
  type,
  payload,
  user,
}) {
  const command = await Command.create({
    organizationId,
    companyId,
    type, 
    status: "PENDING",
    payload,
    requestedBy: user?._id || null,
  });

  return command;
}

module.exports = { postTallyCommand };
