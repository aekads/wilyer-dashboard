// src/config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const path = require('path');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// Allowed MIME types
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/mov', 'video/avi']
};

const storage = (orgId, folder = 'media') => new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const isVideo = file.mimetype.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';
    const orgFolder = `aekads/${orgId}/${folder}`;

    return {
      folder: orgFolder,
      resource_type: resourceType,
      allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'webm', 'mov'],
      transformation: isVideo
        ? [{ quality: 'auto', fetch_format: 'auto' }]
        : [{ quality: 'auto', fetch_format: 'auto' }],
      use_filename: true,
      unique_filename: true
    };
  }
});

const fileFilter = (req, file, cb) => {
  const allAllowed = [...ALLOWED_TYPES.image, ...ALLOWED_TYPES.video];
  if (allAllowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed`), false);
  }
};

const upload = (orgId) => multer({
  storage: storage(orgId, 'media'),
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB max
});

/**
 * Delete a file from Cloudinary
 */
const deleteFile = async (publicId, resourceType = 'image') => {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

/**
 * Generate thumbnail URL for video
 */
const getVideoThumbnail = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    format: 'jpg',
    transformation: [
      { width: 640, height: 360, crop: 'fill', gravity: 'auto' },
      { start_offset: options.offset || '0' }
    ]
  });
};

/**
 * Get transformed image URL
 */
const getImageUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    transformation: [
      {
        width: options.width || 1920,
        height: options.height || 1080,
        crop: options.crop || 'limit',
        quality: options.quality || 'auto',
        fetch_format: 'auto'
      }
    ]
  });
};

/**
 * Get file metadata from Cloudinary
 */
const getFileInfo = async (publicId, resourceType = 'image') => {
  return cloudinary.api.resource(publicId, { resource_type: resourceType });
};

module.exports = {
  cloudinary,
  upload,
  deleteFile,
  getVideoThumbnail,
  getImageUrl,
  getFileInfo,
  ALLOWED_TYPES
};
