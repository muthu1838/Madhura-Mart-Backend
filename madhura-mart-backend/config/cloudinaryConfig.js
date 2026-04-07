import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'madhura-mart',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif', 'mp4', 'mov', 'webm', 'pdf'],
    resource_type: 'auto', // Important for videos and PDFs
  },
});

export { cloudinary, storage };
