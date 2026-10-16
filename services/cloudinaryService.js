const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dqmjtblih',
  api_key: process.env.CLOUDINARY_API_KEY || '456975356334345',
  api_secret: process.env.CLOUDINARY_API_SECRET || '1K9GoNmFFCkYY7ih_60ZfDZ6jfU',
  secure: true
});

/**
 * Upload base64 or remote URL or file path to Cloudinary
 */
async function uploadMedia(fileData, folder = 'team_management') {
  try {
    const uploadResult = await cloudinary.uploader.upload(fileData, {
      folder: folder,
      resource_type: 'auto'
    });
    return {
      success: true,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      format: uploadResult.format,
      bytes: uploadResult.bytes
    };
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  cloudinary,
  uploadMedia
};
