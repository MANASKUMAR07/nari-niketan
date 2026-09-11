// ============================================================================
// NARI NIKETAN — Agentic AI Routes
// ============================================================================
// SECURITY:
//   - Customer /chat and /analyze-product-photo are PUBLIC (no login required)
//     so that guest shoppers can use the Nari AI stylist widget.
//   - /admin-copilot requires authenticateFirebaseUser + requireAdmin.
//   - The Gemini API key is NEVER accepted from the client. Only
//     process.env.GEMINI_API_KEY (set on Cloud Run) is used.
// ============================================================================

'use strict';

const express = require('express');
const router = express.Router();
const agentService = require('../services/agentService');
const { authenticateFirebaseUser, requireAdmin } = require('../middleware/auth');
const { agentLimiter } = require('../middleware/rateLimiter');

/**
 * POST /api/v1/agent/chat
 * Customer fashion stylist & autonomous shopping concierge (text + outfit photo).
 * Publicly accessible — no login required so guests can use the AI widget.
 */
router.post('/chat', agentLimiter, async (req, res) => {
  try {
    const { message, history, imageBase64, mimeType } = req.body;

    if (!message && !imageBase64) {
      return res.status(400).json({ success: false, error: 'Message or image is required' });
    }

    const result = await agentService.processCustomerMessage({
      message: (message || '').trim(),
      history: Array.isArray(history) ? history : [],
      imageBase64: imageBase64 || null,
      mimeType: mimeType || 'image/jpeg'
    });

    res.json({
      success: true,
      reply: result.reply,
      cards: result.cards || {},
      toolsUsed: result.toolsUsed || []
    });
  } catch (error) {
    console.error('Agent chat route error:', error.message);
    res.status(500).json({ success: false, error: 'Agent encountered an issue processing your request' });
  }
});

/**
 * POST /api/v1/agent/analyze-product-photo
 * Seller 1-Photo auto-catalog multimodal analysis.
 * Publicly accessible — seller frontend may not have user auth context at call time.
 * The result is non-destructive (read-only analysis).
 */
router.post('/analyze-product-photo', agentLimiter, async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }

    const result = await agentService.analyzeProductPhoto({
      imageBase64,
      mimeType: mimeType || 'image/jpeg'
    });

    if (!result.success) {
      return res.status(422).json({ success: false, error: result.error || 'Failed to analyze photo' });
    }

    res.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Agent analyze-product-photo route error:', error.message);
    res.status(500).json({ success: false, error: 'Photo analysis failed' });
  }
});

/**
 * POST /api/v1/agent/admin-copilot
 * Admin Business Operations Natural Language Copilot.
 * REQUIRES: valid Firebase ID token with admin or owner custom claim.
 */
router.post('/admin-copilot', agentLimiter, authenticateFirebaseUser, requireAdmin, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'Query is required' });
    }

    const result = await agentService.processAdminQuery({
      query
    });

    res.json({
      success: true,
      reply: result.reply,
      data: result.data || {}
    });
  } catch (error) {
    console.error('Agent admin-copilot route error:', error.message);
    res.status(500).json({ success: false, error: 'Admin copilot query failed' });
  }
});

module.exports = router;
