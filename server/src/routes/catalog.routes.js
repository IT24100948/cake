/** EP02 - Categories, products, inventory and the public catalog. */
const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { requirePermission, requireAnyPermission } = require('../middleware/auth');
const { imageUpload } = require('../middleware/upload');
const { idParam } = require('../validators/common');
const categories = require('../controllers/category.controller');
const products = require('../controllers/product.controller');
const inventory = require('../controllers/inventory.controller');

// ---- Public (US11) ----
const publicRouter = express.Router();
publicRouter.get('/catalog/products', products.catalogList);
publicRouter.get('/catalog/products/:id', validate([idParam()]), products.catalogGet);
publicRouter.get('/categories', categories.list);

// ---- Staff ----
const staffRouter = express.Router();

const categoryRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Category name must be 2-80 characters'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 255 }),
];
staffRouter.post('/categories', requirePermission('products.manage'),
  validate([...categoryRules, body('type').isIn(['CAKE', 'DECORATION']).withMessage('Choose cake or decoration')]), categories.create);
staffRouter.put('/categories/:id', requirePermission('products.manage'), validate([idParam(), ...categoryRules]), categories.update);
staffRouter.delete('/categories/:id', requirePermission('products.manage'), validate([idParam()]), categories.remove);

const productRules = (isCreate) => [
  body('name').trim().isLength({ min: 2, max: 120 }).withMessage('Product name must be 2-120 characters'),
  body('sku').trim().toUpperCase().matches(/^[A-Z0-9-]{3,40}$/).withMessage('SKU must be 3-40 letters, numbers or dashes'),
  body('description').optional({ values: 'falsy' }).trim().isLength({ max: 2000 }).withMessage('Description is too long'),
  body('price').isFloat({ min: 0.01, max: 10000000 }).withMessage('Enter a valid price greater than 0').toFloat(),
  body('productType').isIn(['CAKE', 'DECORATION']).withMessage('Choose cake or decoration'),
  body('categoryId').isInt({ min: 1 }).withMessage('Select a category').toInt(),
  body('reorderLevel').isInt({ min: 0, max: 100000 }).withMessage('Reorder level must be 0 or more').toInt(),
  body('isAvailable').optional().isBoolean().withMessage('Invalid availability').toBoolean(),
  body('removeImage').optional().isBoolean().toBoolean(),
  ...(isCreate ? [body('stockQuantity').isInt({ min: 0, max: 100000 }).withMessage('Opening stock must be 0 or more').toInt()] : []),
];

// US08 - view/search, US07 - add, US09 - update
staffRouter.get('/products', requireAnyPermission('products.view', 'products.manage', 'inventory.manage'), products.list);
staffRouter.get('/products/:id', requireAnyPermission('products.view', 'products.manage', 'inventory.manage'), validate([idParam()]), products.getOne);
staffRouter.post('/products', requirePermission('products.manage'), imageUpload('image'), validate(productRules(true)), products.create);
staffRouter.put('/products/:id', requirePermission('products.manage'), imageUpload('image'), validate([idParam(), ...productRules(false)]), products.update);
staffRouter.patch('/products/:id/availability', requirePermission('products.manage'),
  validate([idParam(), body('isAvailable').isBoolean().withMessage('isAvailable must be true or false').toBoolean()]), products.setAvailability);

// US10 - Inventory
staffRouter.get('/inventory', requirePermission('inventory.manage'), inventory.list);
staffRouter.get('/inventory/:productId/history', requirePermission('inventory.manage'), validate([idParam('productId')]), inventory.history);
staffRouter.post(
  '/inventory/:productId/adjust',
  requirePermission('inventory.manage'),
  validate([
    idParam('productId'),
    body('type').isIn(['RESTOCK', 'ADJUSTMENT']).withMessage('Choose restock or adjustment'),
    body('mode').if(body('type').equals('ADJUSTMENT')).isIn(['SET', 'REMOVE']).withMessage('Choose set quantity or remove stock'),
    body('quantity')
      .if(body('mode').equals('SET')).isInt({ min: 0, max: 100000 }).withMessage('Quantity must be 0 or more').toInt(),
    body('quantity')
      .if((v, { req }) => req.body.mode !== 'SET').isInt({ min: 1, max: 100000 }).withMessage('Quantity must be at least 1').toInt(),
    body('reason').trim().isLength({ min: 3, max: 255 }).withMessage('Please give a reason (3-255 characters)'),
  ]),
  inventory.adjust
);

module.exports = { publicRouter, staffRouter };
