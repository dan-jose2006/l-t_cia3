const router = require('express').Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Digital Library Management System API',
    documentation: '/docs/API.md',
    health: '/api/health',
    version: '1.0.0',
  });
});

router.use('/auth', require('./authRoutes'));
router.use('/books', require('./bookRoutes'));
router.use('/transactions', require('./transactionRoutes'));
router.use('/holds', require('./holdRoutes'));
router.use('/membership-plans', require('./membershipPlanRoutes'));
router.use('/fine-payments', require('./finePaymentRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/members', require('./memberRoutes'));
router.use('/admin/reports', require('./reportRoutes'));
router.use('/admin', require('./adminRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/settings', require('./settingsRoutes'));

module.exports = router;
