const QRCode = require('qrcode');
const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

async function generarQRConFotoCentro(dni, nombreFoto, archivoSalida) {
 const url = `http://localhost:3000/estudiante/${dni}`;
  const tamañoQR = 400;

  // 1. Generar QR base como buffer
  const qrBuffer = await QRCode.toBuffer(url, {
  width: tamañoQR,
  margin: 1,
  color: {
    dark: '#0e9f6e',    // Color del QR (verde esmeralda por ejemplo)
    light: '#ffffff'     // Color del fondo (blanco)
  }
});

  // 2. Cargar QR como imagen
  const qrImage = await Jimp.read(qrBuffer);

  // 3. Cargar foto y redondear
  const fotoPath = path.join(__dirname, 'public/uploads', nombreFoto);
  const foto = await Jimp.read(fotoPath);
  foto.resize(200, 200).circle();

  // 4. Insertar foto al centro del QR
  const centerX = (qrImage.bitmap.width - foto.bitmap.width) / 2;
  const centerY = (qrImage.bitmap.height - foto.bitmap.height) / 2;
  qrImage.composite(foto, centerX, centerY);

  // 5. Cargar fuente y escribir texto “Grupo 5” dentro del QR (parte superior)
  const font = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
  const texto = 'Grupo 5';
  const textWidth = Jimp.measureText(font, texto);
  const textX = (qrImage.bitmap.width - textWidth) / 2;
  const textY = 20; // parte superior del QR (ajustable)

  qrImage.print(font, textX, textY, texto);
  qrImage.print(font, textX + 1, textY, texto); 
  qrImage.print(font, textX + 2, textY, texto); 


  // 6. Guardar imagen
  const salidaPath = path.join(__dirname, 'public/qr_generados', archivoSalida);
  await qrImage.writeAsync(salidaPath);

  return `/qr_generados/${archivoSalida}`;
}

module.exports = { generarQRConFotoCentro };
