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

/**
 * Parse any Cloudinary URL to extract cloudName, resourceType, publicId, and format
 */
function parseCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/res\.cloudinary\.com\/([^/]+)\/(image|video|raw)\/upload\/(?:(?:s--[^-]+--|c_[^/]+|[a-z]_[^/]+)\/)*(?:v\d+\/)?(.+?)(?:\.([a-zA-Z0-9]+))?$/);
  if (!match) return null;
  return {
    cloudName: match[1],
    resourceType: match[2],
    publicId: match[3],
    format: match[4] || (match[2] === 'raw' ? '' : 'pdf')
  };
}

/**
 * Generate authenticated private download URL that bypasses ACL / delivery restrictions
 */
function getPrivateDownloadUrl(publicId, format = 'pdf', resourceType = 'image', expiresInSeconds = 7200) {
  return cloudinary.utils.private_download_url(publicId, format, {
    resource_type: resourceType,
    type: 'upload',
    expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds
  });
}

module.exports = {
  cloudinary,
  uploadMedia,
  parseCloudinaryUrl,
  getPrivateDownloadUrl
};
