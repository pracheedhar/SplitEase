import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { AppError } from '../middlewares/error.js';
import { logger } from './logger.js';

// ─── Configure Cloudinary ────────────────────────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Multer — memory storage (files buffered, uploaded to Cloudinary) ─────────
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError('Only JPEG, PNG, WEBP, GIF, and PDF files are allowed.', 415) as any);
    }
  },
});

// ─── Upload buffer to Cloudinary ──────────────────────────────────────────────
export const uploadToCloudinary = async (
  buffer: Buffer,
  originalname: string
): Promise<{ url: string; publicId: string }> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'splitease/receipts',
        resource_type: 'auto',
        public_id: `${Date.now()}-${originalname.replace(/\s+/g, '_')}`,
      },
      (error, result) => {
        if (error || !result) {
          logger.error(`Cloudinary upload error: ${error?.message}`);
          reject(new AppError('File upload failed. Please try again.', 500));
        } else {
          resolve({ url: result.secure_url, publicId: result.public_id });
        }
      }
    );
    stream.end(buffer);
  });
};

// ─── Delete from Cloudinary ───────────────────────────────────────────────────
export const deleteFromCloudinary = async (publicId: string): Promise<void> => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err: any) {
    logger.warn(`Cloudinary delete failed for ${publicId}: ${err.message}`);
  }
};
