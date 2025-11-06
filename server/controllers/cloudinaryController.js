const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();
const { logger } = require('../utils/logger');

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
};

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 10,
    },
    fileFilter,
});

const uploadProductImage = async (fileBuffer, productSlug, isPrimary = false) => {
    const options = {
        folder: `48roots/products/${productSlug}`,
        transformation: [
            { width: 1200, height: 1200, crop: 'limit' },
            { quality: 'auto:good' },
            { fetch_format: 'auto' },
        ],
        resource_type: 'image',
    };

    return new Promise((resolve, reject) => {
        cloudinary.uploader
            .upload_stream(options, (error, result) => {
                if (error) {
                    logger.error('Cloudinary upload error:', error);
                    reject(error);
                } else {
                    resolve({
                        url: result.secure_url,
                        publicId: result.public_id,
                        width: result.width,
                        height: result.height,
                        format: result.format,
                        bytes: result.bytes,
                    });
                }
            })
            .end(fileBuffer);
    });
};

const uploadMultipleProductImages = async (files, productSlug) => {
    try {
        const uploadPromises = files.map((file, index) =>
            uploadProductImage(file.buffer, productSlug, index === 0)
        );

        const results = await Promise.all(uploadPromises);

        return results.map((result, index) => ({
            url: result.url,
            alt: `${productSlug} image ${index + 1}`,
            isPrimary: index === 0,
        }));
    } catch (error) {
        logger.error('Error uploading multiple product images:', error);
        throw error;
    }
};

const deleteImageFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        logger.info(`Deleted image: ${publicId}`, result);
        return result;
    } catch (error) {
        logger.error('Error deleting image from Cloudinary:', error);
        throw error;
    }
};

const deleteProductImages = async (productSlug) => {
    try {
        const result = await cloudinary.api.delete_resources_by_prefix(
            `48roots/products/${productSlug}`
        );
        logger.info(`Deleted all images for product: ${productSlug}`);
        return result;
    } catch (error) {
        logger.error('Error deleting product images:', error);
        throw error;
    }
};

const handleImageUpload = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file provided',
            });
        }

        const { productSlug } = req.body;

        if (!productSlug) {
            return res.status(400).json({
                success: false,
                message: 'Product slug is required',
            });
        }

        const result = await uploadProductImage(req.file.buffer, productSlug);

        res.json({
            success: true,
            data: {
                url: result.url,
                publicId: result.publicId,
            },
        });
    } catch (error) {
        logger.error('Image upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload image',
        });
    }
};

const handleMultipleImageUpload = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No image files provided',
            });
        }

        const { productSlug } = req.body;

        if (!productSlug) {
            return res.status(400).json({
                success: false,
                message: 'Product slug is required',
            });
        }

        const images = await uploadMultipleProductImages(req.files, productSlug);

        res.json({
            success: true,
            data: images,
            count: images.length,
        });
    } catch (error) {
        logger.error('Multiple image upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to upload images',
        });
    }
};

const handleImageDeletion = async (req, res) => {
    try {
        const { publicId } = req.params;

        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: 'Public ID is required',
            });
        }

        const result = await deleteImageFromCloudinary(publicId);

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        logger.error('Image deletion error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete image',
        });
    }
};

const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            logger.error('File size exceeded limit');
            return res.status(400).json({
                success: false,
                message: 'File size must be less than 10MB',
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            logger.error('Too many files uploaded');
            return res.status(400).json({
                success: false,
                message: 'Maximum 10 files allowed',
            });
        }
    }

    if (error.message === 'Only JPEG, PNG, and WebP images are allowed') {
        logger.error('Invalid file type uploaded');
        return res.status(400).json({
            success: false,
            message: error.message,
        });
    }

    logger.error('Upload error:', error);
    res.status(500).json({
        success: false,
        message: 'Upload error occurred',
    });
};

module.exports = {
    upload,
    uploadProductImage,
    uploadMultipleProductImages,
    deleteImageFromCloudinary,
    deleteProductImages,
    handleImageUpload,
    handleMultipleImageUpload,
    handleImageDeletion,
    handleMulterError,
};
