const QRCode = require('qrcode');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

async function generarQRConFotoCentro(dni, nombreFoto, archivoSalida) {
 const url = `http://192.168.137.1:3000/estudiante/${dni}`;
  const tamañoQR = 400;

  // 1. Generar QR base como buffer
 const qrBuffer = await QRCode.toBuffer(url, {
  width: tamañoQR,
  margin: 2,
  errorCorrectionLevel: 'H', 
  color: {
    dark: '#000000',
    light: '#ffffff'
  }
});

  // 2. Cargar QR como imagen
  const qrImage = await Jimp.read(qrBuffer);

  // 3. Cargar foto y redondear
  const fotoPath = path.join(__dirname, 'public/uploads', nombreFoto);
  const foto = await Jimp.read(fotoPath);
  foto.resize(175,175).circle();

  // 4. Insertar foto al centro del QR
  const centerX = (qrImage.bitmap.width - foto.bitmap.width) / 2;
  const centerY = (qrImage.bitmap.height - foto.bitmap.height) / 2;
  qrImage.composite(foto, centerX, centerY);


  // 6. Guardar imagen
  const salidaPath = path.join(__dirname, 'public/qr_generados', archivoSalida);
  await qrImage.writeAsync(salidaPath);

  return `/qr_generados/${archivoSalida}`;
}

module.exports = { generarQRConFotoCentro };
