// ============================================================================
// NARI NIKETAN — Agentic AI Routes
// ============================================================================

'use strict';

const express = require('express');
const router = express.Router();
const agentService = require('../services/agentService');

/**
 * POST /api/v1/agent/chat
 * Customer fashion stylist & autonomous shopping concierge (Supports text + outfit photo)
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, history, imageBase64, mimeType, apiKey } = req.body;
    const resolvedKey = apiKey || req.headers['x-gemini-key'] || req.headers['x-api-key'];

    if (!message && !imageBase64) {
      return res.status(400).json({ success: false, error: 'Message or image is required' });
    }

    const result = await agentService.processCustomerMessage({
      message: (message || '').trim(),
      history: Array.isArray(history) ? history : [],
      imageBase64: imageBase64 || null,
      mimeType: mimeType || 'image/jpeg',
      apiKey: resolvedKey || null
    });

    res.json({
      success: true,
      reply: result.reply,
      cards: result.cards || {},
      toolsUsed: result.toolsUsed || []
    });
  } catch (error) {
    console.error('Agent chat route error:', error);
    res.status(500).json({ success: false, error: 'Agent encountered an issue processing request' });
  }
});

/**
 * POST /api/v1/agent/analyze-product-photo
 * Seller 1-Photo auto-catalog multimodal analysis
 */
router.post('/analyze-product-photo', async (req, res) => {
  try {
    const { imageBase64, mimeType, apiKey } = req.body;
    const resolvedKey = apiKey || req.headers['x-gemini-key'] || req.headers['x-api-key'];

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }

    const result = await agentService.analyzeProductPhoto({
      imageBase64,
      mimeType: mimeType || 'image/jpeg',
      apiKey: resolvedKey || null
    });

    if (!result.success) {
      return res.status(422).json({ success: false, error: result.error || 'Failed to analyze photo' });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Agent analyze-product-photo route error:', error);
    res.status(500).json({ success: false, error: 'Photo analysis failed' });
  }
});

/**
 * POST /api/v1/agent/admin-copilot
 * Admin Business Operations Natural Language Copilot
 */
router.post('/admin-copilot', async (req, res) => {
  try {
    const { query, apiKey } = req.body;
    const resolvedKey = apiKey || req.headers['x-gemini-key'] || req.headers['x-api-key'];

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const result = await agentService.processAdminQuery({
      query,
      apiKey: resolvedKey || null
    });

    res.json({
      success: true,
      reply: result.reply,
      data: result.data || {}
    });
  } catch (error) {
    console.error('Agent admin-copilot route error:', error);
    res.status(500).json({ success: false, error: 'Admin copilot query failed' });
  }
});

module.exports = router;
