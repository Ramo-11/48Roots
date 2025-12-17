const Product = require('../../../models/Product');
const Order = require('../../../models/Order');
const Settings = require('../../../models/Settings');
const { logger } = require('../../utils/logger');
const {
    getSyncProducts,
    getSyncProductDetails,
    getStoreInfo,
    getPrintfulOrderStatus,
    mapPrintfulCategory,
    normalizePrintfulSize,
} = require('../../config/printful');

/**
 * Get sync status - API endpoint
 */
exports.getSyncStatus = async (req, res) => {
    try {
        let printfulConnected = false;
        let storeName = null;
        let printfulProductCount = 0;

        // Check Printful connection
        if (process.env.PRINTFUL_API_TOKEN) {
            const storeInfo = await getStoreInfo();
            printfulConnected = storeInfo && storeInfo.length > 0;

            if (printfulConnected) {
                storeName = storeInfo[0]?.name || null;
                const syncProducts = await getSyncProducts();
                printfulProductCount = syncProducts.length;
            }
        }

        // Get local product counts
        const totalLocalProducts = await Product.countDocuments({});
        const syncedProductCount = await Product.countDocuments({
            printfulSyncProductId: { $exists: true, $ne: null },
        });

        // Get recent orders with Printful
        const printfulOrderCount = await Order.countDocuments({
            'fulfillment.printfulOrderId': { $exists: true, $ne: null },
        });

        // Get last sync time
        const lastSync = await Settings.get('printful_last_sync');

        res.json({
            success: true,
            data: {
                printfulConnected,
                storeName,
                printfulProducts: printfulProductCount,
                localProducts: totalLocalProducts,
                syncedProducts: syncedProductCount,
                unsyncedProducts: totalLocalProducts - syncedProductCount,
                printfulOrders: printfulOrderCount,
                lastSync: lastSync ? new Date(lastSync).toISOString() : null,
            },
        });
    } catch (error) {
        logger.error('Error getting sync status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get sync status',
            error: error.message,
        });
    }
};

/**
 * Sync a single product from Printful
 */
exports.syncSingleProduct = async (req, res) => {
    try {
        const { printfulProductId } = req.params;

        const productDetails = await getSyncProductDetails(printfulProductId);
        if (!productDetails || !productDetails.sync_product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found in Printful',
            });
        }

        const { sync_product, sync_variants } = productDetails;

        const baseSlug = sync_product.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        let slug = baseSlug;
        const existingWithSlug = await Product.findOne({
            slug: baseSlug,
            printfulSyncProductId: { $ne: sync_product.id },
        });
        if (existingWithSlug) {
            slug = `${baseSlug}-${sync_product.id}`;
        }

        const images = [];
        if (sync_product.thumbnail_url) {
            images.push({
                url: sync_product.thumbnail_url,
                alt: sync_product.name,
                isPrimary: true,
            });
        }

        const variants = [];
        let category = 'other';
        let price = 0;

        if (sync_variants?.length > 0) {
            price = parseFloat(sync_variants[0].retail_price) || 0;

            for (const syncVariant of sync_variants) {
                if (syncVariant.product) {
                    category = mapPrintfulCategory(syncVariant.product.name?.split(' ')[0]);
                }

                variants.push({
                    size: normalizePrintfulSize(syncVariant.size || 'One Size'),
                    color: syncVariant.color || '',
                    sku: syncVariant.sku || `PF-${syncVariant.id}`,
                    price: parseFloat(syncVariant.retail_price) || 0,
                    stock: 999,
                    printfulVariantId: syncVariant.variant_id,
                    printfulSyncVariantId: syncVariant.id,
                    printfulCost: parseFloat(syncVariant.cost) || 0,
                    printfulRetailPrice: parseFloat(syncVariant.retail_price) || 0,
                });
            }
        }

        const productData = {
            name: sync_product.name,
            slug,
            description: sync_product.name,
            price,
            images:
                images.length > 0
                    ? images
                    : [{ url: '/images/placeholder.png', alt: sync_product.name, isPrimary: true }],
            category,
            variants,
            printfulSyncProductId: sync_product.id,
            printfulExternalId: sync_product.external_id,
            isActive: !sync_product.is_ignored,
        };

        // Check for existing product and preserve locked prices
        const existingProduct = await Product.findOne({ printfulSyncProductId: sync_product.id });
        if (existingProduct) {
            const updatedVariants = variants.map((newVariant) => {
                const existingVariant = existingProduct.variants.find(
                    (v) =>
                        v.size === newVariant.size &&
                        ((v.color || '') === (newVariant.color || ''))
                );
                if (existingVariant?.priceLocked) {
                    return {
                        ...newVariant,
                        price: existingVariant.price,
                        priceLocked: true,
                    };
                }
                return newVariant;
            });
            productData.variants = updatedVariants;
        }

        const product = await Product.findOneAndUpdate(
            { printfulSyncProductId: sync_product.id },
            productData,
            { upsert: true, new: true }
        );

        res.json({
            success: true,
            message: 'Product synced successfully',
            data: product,
        });
    } catch (error) {
        logger.error('Error syncing single product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync product',
        });
    }
};

/**
 * Sync all products from Printful
 */
exports.syncAllProducts = async (req, res) => {
    try {
        logger.info('Starting Printful product sync...');

        // Verify API connection
        if (!process.env.PRINTFUL_API_TOKEN) {
            return res.status(400).json({
                success: false,
                message: 'Printful API token not configured',
            });
        }

        const storeInfo = await getStoreInfo();
        if (!storeInfo) {
            logger.error(`GET request to /store returned an error`);
            return res.status(500).json({
                success: false,
                message: 'Unable to connect to Printful. Please check your API token.',
            });
        }

        // Get all sync products
        const syncProducts = await getSyncProducts();

        if (!syncProducts || syncProducts.length === 0) {
            return res.json({
                success: true,
                message: 'No products found in your Printful store.',
                data: { synced: 0, created: 0, updated: 0, errors: 0 },
            });
        }

        let created = 0;
        let updated = 0;
        let errors = 0;
        const processedProducts = [];

        for (const syncProduct of syncProducts) {
            try {
                const productDetails = await getSyncProductDetails(syncProduct.id);

                if (!productDetails || !productDetails.sync_product) {
                    logger.warn(`Could not get details for product ${syncProduct.id}`);
                    errors++;
                    continue;
                }

                const { sync_product, sync_variants } = productDetails;

                // Generate slug
                const baseSlug = sync_product.name
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/^-|-$/g, '');

                // Check for existing product to avoid duplicate slugs
                let slug = baseSlug;
                const existingWithSlug = await Product.findOne({
                    slug: baseSlug,
                    printfulSyncProductId: { $ne: sync_product.id },
                });
                if (existingWithSlug) {
                    slug = `${baseSlug}-${sync_product.id}`;
                }

                // Build images array
                const images = [];
                if (sync_product.thumbnail_url) {
                    images.push({
                        url: sync_product.thumbnail_url,
                        alt: sync_product.name,
                        isPrimary: true,
                    });
                }

                // Add variant preview images
                if (sync_variants?.length > 0) {
                    const addedUrls = new Set([sync_product.thumbnail_url]);
                    for (const variant of sync_variants) {
                        if (variant.files) {
                            for (const file of variant.files) {
                                const previewUrl = file.preview_url || file.thumbnail_url;
                                if (
                                    file.type === 'preview' &&
                                    previewUrl &&
                                    !addedUrls.has(previewUrl)
                                ) {
                                    images.push({
                                        url: previewUrl,
                                        alt: `${sync_product.name} - ${variant.name}`,
                                        isPrimary: false,
                                    });
                                    addedUrls.add(previewUrl);
                                }
                            }
                        }
                    }
                }

                // Build variants
                const variants = [];
                let category = 'other';
                let price = 0;
                let baseCost = 0;

                if (sync_variants?.length > 0) {
                    price = parseFloat(sync_variants[0].retail_price) || 0;
                    // Get the cost from the first variant as base cost
                    baseCost = parseFloat(sync_variants[0].cost) || 0;

                    for (const syncVariant of sync_variants) {
                        if (syncVariant.product) {
                            category = mapPrintfulCategory(syncVariant.product.name?.split(' ')[0]);
                        }

                        variants.push({
                            size: normalizePrintfulSize(syncVariant.size || 'One Size'),
                            color: syncVariant.color || '',
                            sku: syncVariant.sku || `PF-${syncVariant.id}`,
                            price: parseFloat(syncVariant.retail_price) || 0,
                            stock: 999,
                            printfulVariantId: syncVariant.variant_id,
                            printfulSyncVariantId: syncVariant.id,
                            printfulCost: parseFloat(syncVariant.cost) || 0,
                            printfulRetailPrice: parseFloat(syncVariant.retail_price) || 0,
                        });
                    }
                }

                const productData = {
                    name: sync_product.name,
                    slug,
                    description: sync_product.name,
                    price,
                    images:
                        images.length > 0
                            ? images
                            : [
                                  {
                                      url: '/images/placeholder.png',
                                      alt: sync_product.name,
                                      isPrimary: true,
                                  },
                              ],
                    category,
                    variants,
                    printfulSyncProductId: sync_product.id,
                    printfulExternalId: sync_product.external_id,
                    printfulBaseCost: baseCost,
                    isActive: !sync_product.is_ignored,
                };

                // Upsert product
                const existingProduct = await Product.findOne({
                    printfulSyncProductId: sync_product.id,
                });

                if (existingProduct) {
                    // Preserve locked prices from existing variants
                    const updatedVariants = variants.map((newVariant) => {
                        const existingVariant = existingProduct.variants.find(
                            (v) =>
                                v.size === newVariant.size &&
                                ((v.color || '') === (newVariant.color || ''))
                        );
                        if (existingVariant?.priceLocked) {
                            return {
                                ...newVariant,
                                price: existingVariant.price,
                                priceLocked: true,
                            };
                        }
                        return newVariant;
                    });
                    productData.variants = updatedVariants;

                    await Product.findByIdAndUpdate(existingProduct._id, productData);
                    updated++;
                    processedProducts.push({ name: sync_product.name, action: 'updated' });
                } else {
                    await Product.create(productData);
                    created++;
                    processedProducts.push({ name: sync_product.name, action: 'created' });
                }
            } catch (productError) {
                logger.error(`Error processing product ${syncProduct.id}:`, productError.message);
                errors++;
                processedProducts.push({
                    name: syncProduct.name,
                    action: 'error',
                    error: productError.message,
                });
            }
        }

        // Update last sync time
        await Settings.set('printful_last_sync', new Date().toISOString());

        logger.info(
            `Printful sync complete: ${created} created, ${updated} updated, ${errors} errors`
        );

        res.json({
            success: true,
            message: 'Product sync completed',
            data: {
                total: syncProducts.length,
                created,
                updated,
                errors,
                products: processedProducts,
            },
        });
    } catch (error) {
        logger.error('Error syncing products from Printful:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync products',
            error: error.message,
        });
    }
};

/**
 * Get all products with sync status
 */
exports.getProducts = async (req, res) => {
    try {
        const products = await Product.find({})
            .select(
                'name slug price compareAtPrice description images printfulSyncProductId printfulBaseCost isActive isFeatured category variants createdAt'
            )
            .sort({ createdAt: -1 })
            .lean();

        const formattedProducts = products.map((p) => {
            // Calculate profit margin using base cost
            const cost = p.printfulBaseCost || 0;
            const basePrice = p.price || 0;
            const profit = basePrice - cost;
            const profitMargin = cost > 0 && basePrice > 0 ? ((profit / basePrice) * 100).toFixed(1) : 0;

            // Get price range from variants
            const variantPrices = (p.variants || []).map((v) => v.price).filter((pr) => pr != null);
            const minPrice = variantPrices.length > 0 ? Math.min(...variantPrices) : basePrice;
            const maxPrice = variantPrices.length > 0 ? Math.max(...variantPrices) : basePrice;

            return {
                _id: p._id,
                name: p.name,
                slug: p.slug,
                price: basePrice,
                minPrice,
                maxPrice,
                compareAtPrice: p.compareAtPrice,
                description: p.description,
                image: p.images?.[0]?.url || '/images/placeholder.png',
                category: p.category,
                isActive: p.isActive,
                isFeatured: p.isFeatured,
                isSynced: !!p.printfulSyncProductId,
                isLocalOnly: !p.printfulSyncProductId,
                printfulId: p.printfulSyncProductId,
                variantCount: p.variants?.length || 0,
                variants: (p.variants || []).map((v) => ({
                    size: v.size,
                    color: v.color,
                    price: v.price,
                    priceLocked: v.priceLocked || false,
                    sku: v.sku,
                    printfulCost: v.printfulCost || 0,
                    printfulRetailPrice: v.printfulRetailPrice || 0,
                })),
                // Cost and profit data
                printfulCost: cost,
                profit: profit,
                profitMargin: parseFloat(profitMargin),
                createdAt: p.createdAt,
            };
        });

        res.json({
            success: true,
            data: formattedProducts,
        });
    } catch (error) {
        logger.error('Error getting products:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get products',
        });
    }
};

/**
 * Toggle product active status
 */
exports.toggleProductStatus = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        product.isActive = !product.isActive;
        await product.save();

        res.json({
            success: true,
            data: {
                isActive: product.isActive,
            },
        });
    } catch (error) {
        logger.error('Error toggling product status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product',
        });
    }
};

/**
 * Toggle product featured status
 */
exports.toggleProductFeatured = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        product.isFeatured = !product.isFeatured;
        await product.save();

        res.json({
            success: true,
            data: {
                isFeatured: product.isFeatured,
            },
        });
    } catch (error) {
        logger.error('Error toggling featured status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product',
        });
    }
};

/**
 * Update product details
 */
exports.updateProduct = async (req, res) => {
    try {
        const { productId } = req.params;
        const { name, description, price, category, isActive, isFeatured } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        if (name) product.name = name;
        if (description) product.description = description;
        if (price !== undefined) product.price = parseFloat(price);
        if (category) product.category = category;
        if (isActive !== undefined) product.isActive = isActive;
        if (isFeatured !== undefined) product.isFeatured = isFeatured;

        await product.save();

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        logger.error('Error updating product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product',
        });
    }
};

/**
 * Delete a product
 */
exports.deleteProduct = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findByIdAndDelete(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        res.json({
            success: true,
            message: 'Product deleted',
        });
    } catch (error) {
        logger.error('Error deleting product:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete product',
        });
    }
};

/**
 * Update product images
 */
exports.updateProductImages = async (req, res) => {
    try {
        const { productId } = req.params;
        const { images } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        // Validate images array
        if (!Array.isArray(images)) {
            return res.status(400).json({
                success: false,
                message: 'Images must be an array',
            });
        }

        // Update images
        product.images = images.map((img, index) => ({
            url: img.url,
            alt: img.alt || product.name,
            isPrimary: index === 0,
        }));

        await product.save();

        logger.info(`Updated images for product ${productId}`);

        res.json({
            success: true,
            data: {
                images: product.images,
            },
        });
    } catch (error) {
        logger.error('Error updating product images:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product images',
        });
    }
};

/**
 * Get single product with full details for editing
 */
exports.getProductForEdit = async (req, res) => {
    try {
        const { productId } = req.params;

        const product = await Product.findById(productId).lean();
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        logger.error('Error getting product for edit:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get product',
        });
    }
};

/**
 * Update product variant prices
 */
exports.updateProductVariants = async (req, res) => {
    try {
        const { productId } = req.params;
        const { variants } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Product not found',
            });
        }

        // Update variant prices by matching size and color (handle empty strings)
        if (Array.isArray(variants)) {
            for (const updatedVariant of variants) {
                const existingVariant = product.variants.find((v) => {
                    const sizeMatch = v.size === updatedVariant.size;
                    const colorMatch =
                        (v.color || '') === (updatedVariant.color || '') ||
                        (!v.color && !updatedVariant.color);
                    return sizeMatch && colorMatch;
                });

                if (existingVariant) {
                    if (updatedVariant.price != null) {
                        existingVariant.price = parseFloat(updatedVariant.price);
                    }
                    if (updatedVariant.priceLocked != null) {
                        existingVariant.priceLocked = updatedVariant.priceLocked;
                    }
                }
            }
        }

        await product.save();

        logger.info(`Updated variants for product ${productId}`);

        res.json({
            success: true,
            data: {
                variants: product.variants,
            },
        });
    } catch (error) {
        logger.error('Error updating product variants:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update product variants',
        });
    }
};

/**
 * Get recent orders
 */
exports.getRecentOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .sort({ createdAt: -1 })
            .limit(20)
            .select('orderNumber customer total fulfillment payment createdAt')
            .lean();

        const formattedOrders = orders.map((o) => ({
            _id: o._id,
            orderNumber: o.orderNumber,
            customerName: `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim(),
            customerEmail: o.customer?.email,
            total: o.total,
            paymentStatus: o.payment?.status,
            fulfillmentStatus: o.fulfillment?.status,
            printfulOrderId: o.fulfillment?.printfulOrderId,
            createdAt: o.createdAt,
        }));

        res.json({
            success: true,
            data: formattedOrders,
        });
    } catch (error) {
        logger.error('Error getting orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get orders',
        });
    }
};

/**
 * Refresh order status from Printful
 */
exports.refreshOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found',
            });
        }

        if (!order.fulfillment?.printfulOrderId) {
            return res.status(400).json({
                success: false,
                message: 'Order not linked to Printful',
            });
        }

        const printfulOrder = await getPrintfulOrderStatus(order.fulfillment.printfulOrderId);
        if (printfulOrder) {
            await order.updateFromPrintful(printfulOrder);
        }

        res.json({
            success: true,
            data: {
                fulfillmentStatus: order.fulfillment.status,
                printfulStatus: order.fulfillment.printfulOrderStatus,
                trackingNumber: order.fulfillment.trackingNumber,
            },
        });
    } catch (error) {
        logger.error('Error refreshing order status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh order',
        });
    }
};

/**
 * Get recent orders with full details
 */
exports.getRecentOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('items.product')
            .lean();

        const formattedOrders = orders.map((o) => ({
            _id: o._id,
            orderNumber: o.orderNumber,
            customerName: `${o.customer?.firstName || ''} ${o.customer?.lastName || ''}`.trim(),
            customerEmail: o.customer?.email,
            customerPhone: o.customer?.phone,
            shippingAddress: o.shippingAddress,
            items: o.items?.map((item) => ({
                name: item.productSnapshot?.name || item.product?.name,
                image: item.productSnapshot?.image || item.product?.images?.[0]?.url,
                variant: item.variant,
                quantity: item.quantity,
                price: item.price,
            })),
            itemCount: o.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
            subtotal: o.subtotal,
            shippingCost: o.shipping?.cost,
            donation: o.donation?.amount,
            total: o.total,
            paymentStatus: o.payment?.status,
            paymentMethod: o.payment?.method,
            paidAt: o.payment?.paidAt,
            fulfillmentStatus: o.fulfillment?.status,
            printfulOrderId: o.fulfillment?.printfulOrderId,
            printfulOrderStatus: o.fulfillment?.printfulOrderStatus,
            trackingNumber: o.fulfillment?.trackingNumber,
            trackingUrl: o.fulfillment?.trackingUrl,
            carrier: o.fulfillment?.carrier,
            createdAt: o.createdAt,
        }));

        res.json({
            success: true,
            data: formattedOrders,
        });
    } catch (error) {
        logger.error('Error getting orders:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get orders',
        });
    }
};
