const sharp = require('sharp');

async function processLogo(fileBuffer) {
  try {
    // Resize and optimize logo
    const processedImage = await sharp(fileBuffer)
      .resize(200, 100, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    return processedImage;
  } catch (error) {
    console.error('Logo processing error:', error);
    throw new Error('Error processing logo');
  }
}

module.exports = {
  processLogo
};