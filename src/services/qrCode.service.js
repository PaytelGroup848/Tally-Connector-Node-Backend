const QRCode = require("qrcode");

// ClearTax/NIC return a "SignedQRCode" string — render it as a scannable image.
const renderQrCodeImage = async (signedData) => {
  if (!signedData) return "";
  try {
    const dataUrl = await QRCode.toDataURL(signedData, {
      errorCorrectionLevel: "M",
      width: 300,
    });
    return dataUrl; // "data:image/png;base64,...."
  } catch (err) {
    return "";
  }
};

module.exports = { renderQrCodeImage };
