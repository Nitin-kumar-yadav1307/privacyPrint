const express = require('express')
const authController = require('../controllers/authController')
const { requireShopSession } = require('../middleware/shopAuth')

const router = express.Router()

// Mock shop sign-in — exchanges the demo passcode for a signed session token.
router.post('/auth/shop/login', authController.shopLogin)

// Session inspection always requires a valid session, even in local demo mode.
router.get('/auth/shop/session', requireShopSession, authController.currentSession)

module.exports = router
