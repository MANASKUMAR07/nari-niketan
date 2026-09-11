// GET /api/health

'use strict';

const { Router } = require('express');
const router     = Router();

router.get('/', (req, res) => {
  res.json({
    success:   true,
    status:    'ok',
    service:   'nari-niketan-api',
    version:   process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'unknown',
  });
});

module.exports = router;
