require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product');

const isProd = process.env.NODE_ENV === 'production';
const baseUri = isProd ? process.env.MONGODB_URI_PROD : process.env.MONGODB_URI_DEV;
const dbName = isProd ? process.env.DB_NAME_PROD : process.env.DB_NAME_DEV;

if (!baseUri) {
    console.error('MongoDB URI is not defined - cannot seed database');
    process.exit(1);
}

process.env.MONGODB_URI = `${baseUri}${baseUri.includes('?') ? '&' : '?'}dbName=${dbName}`;

mongoose.connect(process.env.MONGODB_URI);

const products = [
    {
        name: 'Palestine Flag T-Shirt',
        slug: 'palestine-flag-tshirt',
        description:
            'Show your pride with this premium cotton t-shirt featuring the Palestinian flag.',
        price: 29.99,
        compareAtPrice: 39.99,
        images: [
            {
                url: 'https://via.placeholder.com/500x500/000000/FFFFFF?text=Palestine+Flag+Tee',
                alt: 'Palestine Flag T-Shirt',
                isPrimary: true,
            },
        ],
        category: 'tshirts',
        tags: ['flag', 'pride', 'cotton'],
        variants: [
            { size: 'S', color: 'Black', sku: 'PFT-BLK-S', stock: 50 },
            { size: 'M', color: 'Black', sku: 'PFT-BLK-M', stock: 100 },
            { size: 'L', color: 'Black', sku: 'PFT-BLK-L', stock: 75 },
            { size: 'XL', color: 'Black', sku: 'PFT-BLK-XL', stock: 60 },
            { size: '2XL', color: 'Black', sku: 'PFT-BLK-2XL', stock: 30 },
        ],
        seo: {
            title: 'Palestine Flag T-Shirt - 48 Roots',
            description: 'Premium Palestinian flag t-shirt. Support Palestine with every purchase.',
            keywords: ['palestine', 'flag', 'tshirt', 'palestinian apparel'],
        },
        isActive: true,
        isFeatured: true,
    },
    {
        name: 'Free Palestine Hoodie',
        slug: 'free-palestine-hoodie',
        description:
            'Stay warm and stand in solidarity with this comfortable Free Palestine hoodie.',
        price: 54.99,
        images: [
            {
                url: 'https://via.placeholder.com/500x500/1a1a1a/FFFFFF?text=Free+Palestine+Hoodie',
                alt: 'Free Palestine Hoodie',
                isPrimary: true,
            },
        ],
        category: 'hoodies',
        tags: ['hoodie', 'solidarity', 'warm'],
        variants: [
            { size: 'S', color: 'Navy', sku: 'FPH-NVY-S', stock: 40 },
            { size: 'M', color: 'Navy', sku: 'FPH-NVY-M', stock: 80 },
            { size: 'L', color: 'Navy', sku: 'FPH-NVY-L', stock: 70 },
            { size: 'XL', color: 'Navy', sku: 'FPH-NVY-XL', stock: 50 },
            { size: '2XL', color: 'Navy', sku: 'FPH-NVY-2XL', stock: 25 },
        ],
        seo: {
            title: 'Free Palestine Hoodie - 48 Roots',
            description: 'Premium Free Palestine hoodie. Warm, comfortable, and meaningful.',
            keywords: ['palestine', 'hoodie', 'free palestine', 'sweatshirt'],
        },
        isActive: true,
        isFeatured: true,
    },
    {
        name: 'Olive Tree Crewneck',
        slug: 'olive-tree-crewneck',
        description:
            'Featuring the iconic Palestinian olive tree, this crewneck represents resilience and heritage.',
        price: 44.99,
        images: [
            {
                url: 'https://via.placeholder.com/500x500/2d5016/FFFFFF?text=Olive+Tree+Crew',
                alt: 'Olive Tree Crewneck',
                isPrimary: true,
            },
        ],
        category: 'sweatshirts',
        tags: ['olive tree', 'heritage', 'sweatshirt'],
        variants: [
            { size: 'S', color: 'Forest Green', sku: 'OTC-GRN-S', stock: 35 },
            { size: 'M', color: 'Forest Green', sku: 'OTC-GRN-M', stock: 70 },
            { size: 'L', color: 'Forest Green', sku: 'OTC-GRN-L', stock: 65 },
            { size: 'XL', color: 'Forest Green', sku: 'OTC-GRN-XL', stock: 45 },
        ],
        seo: {
            title: 'Olive Tree Crewneck - 48 Roots',
            description: 'Palestinian olive tree crewneck sweatshirt. Symbol of resilience.',
            keywords: ['palestine', 'olive tree', 'crewneck', 'sweatshirt'],
        },
        isActive: true,
        isFeatured: false,
    },
    {
        name: 'Jerusalem Skyline Tee',
        slug: 'jerusalem-skyline-tee',
        description: 'Beautiful Jerusalem skyline design on premium cotton. A timeless piece.',
        price: 32.99,
        images: [
            {
                url: 'https://via.placeholder.com/500x500/4a4a4a/FFD700?text=Jerusalem+Skyline',
                alt: 'Jerusalem Skyline Tee',
                isPrimary: true,
            },
        ],
        category: 'tshirts',
        tags: ['jerusalem', 'skyline', 'design'],
        variants: [
            { size: 'S', color: 'Charcoal', sku: 'JST-CHR-S', stock: 45 },
            { size: 'M', color: 'Charcoal', sku: 'JST-CHR-M', stock: 90 },
            { size: 'L', color: 'Charcoal', sku: 'JST-CHR-L', stock: 80 },
            { size: 'XL', color: 'Charcoal', sku: 'JST-CHR-XL', stock: 55 },
            { size: '2XL', color: 'Charcoal', sku: 'JST-CHR-2XL', stock: 30 },
        ],
        seo: {
            title: 'Jerusalem Skyline T-Shirt - 48 Roots',
            description: 'Jerusalem skyline design t-shirt. High quality Palestinian apparel.',
            keywords: ['jerusalem', 'skyline', 'tshirt', 'palestine'],
        },
        isActive: true,
        isFeatured: true,
    },
    {
        name: 'Keffiyeh Pattern Hoodie',
        slug: 'keffiyeh-pattern-hoodie',
        description: 'Traditional keffiyeh pattern meets modern streetwear in this unique hoodie.',
        price: 59.99,
        images: [
            {
                url: 'https://via.placeholder.com/500x500/000000/FFFFFF?text=Keffiyeh+Hoodie',
                alt: 'Keffiyeh Pattern Hoodie',
                isPrimary: true,
            },
        ],
        category: 'hoodies',
        tags: ['keffiyeh', 'pattern', 'traditional'],
        variants: [
            { size: 'M', color: 'Black/White', sku: 'KPH-BW-M', stock: 60 },
            { size: 'L', color: 'Black/White', sku: 'KPH-BW-L', stock: 75 },
            { size: 'XL', color: 'Black/White', sku: 'KPH-BW-XL', stock: 50 },
            { size: '2XL', color: 'Black/White', sku: 'KPH-BW-2XL', stock: 30 },
        ],
        seo: {
            title: 'Keffiyeh Pattern Hoodie - 48 Roots',
            description: 'Traditional keffiyeh pattern hoodie. Modern Palestinian streetwear.',
            keywords: ['keffiyeh', 'hoodie', 'pattern', 'palestine'],
        },
        isActive: true,
        isFeatured: false,
    },
    {
        name: 'Palestine Map Tote Bag',
        slug: 'palestine-map-tote-bag',
        description: 'Eco-friendly canvas tote bag featuring the map of Palestine.',
        price: 19.99,
        images: [
            {
                url: 'https://via.placeholder.com/500x500/f5f5dc/000000?text=Palestine+Tote',
                alt: 'Palestine Map Tote Bag',
                isPrimary: true,
            },
        ],
        category: 'accessories',
        tags: ['tote bag', 'map', 'eco-friendly'],
        variants: [{ size: 'M', color: 'Natural', sku: 'PMT-NAT-M', stock: 100 }],
        seo: {
            title: 'Palestine Map Tote Bag - 48 Roots',
            description: 'Eco-friendly Palestine map tote bag. Practical and meaningful.',
            keywords: ['palestine', 'tote bag', 'map', 'accessories'],
        },
        isActive: true,
        isFeatured: false,
    },
];

async function seedProducts() {
    try {
        console.log('Clearing existing products...');
        await Product.deleteMany({});

        console.log('Creating products...');
        const createdProducts = await Product.insertMany(products);

        console.log(`\n✓ Created ${createdProducts.length} products:`);
        createdProducts.forEach((product) => {
            console.log(`  - ${product.name} ($${product.price})`);
        });

        console.log('\n✓ Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedProducts();
