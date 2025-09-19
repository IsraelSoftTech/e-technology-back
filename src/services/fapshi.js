const axios = require('axios');

class FapshiService {
  constructor() {
    this.apiKey = process.env.FAPSHI_API_KEY || 'FAK_TEST_624ccaf50248189354f5';
    // Allow overriding base URL; default to commonly used prefix with /api/v1
    this.baseUrl = (process.env.FAPSHI_BASE_URL || 'https://fapshi.com/api/v1').replace(/\/$/, '');
    this.webhookUrl = process.env.FAPSHI_WEBHOOK_URL || 'http://localhost:4000/api/payments/fapshi/webhook';
  }

  /**
   * Create a payment request
   * @param {Object} paymentData - Payment details
   * @returns {Promise<Object>} Payment response
   */
  async createPayment(paymentData) {
    try {
      const payload = {
        amount: paymentData.amount,
        currency: paymentData.currency || 'XAF',
        phone: paymentData.phone,
        description: paymentData.description,
        reference: paymentData.reference,
        callbackUrl: this.webhookUrl,
        returnUrl: paymentData.returnUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/payment/success`
      };

      console.log('Creating Fapshi payment:', { apiKey: this.apiKey, ...payload });

      const response = await axios.post(`${this.baseUrl}/payments/request`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Try both common auth styles to maximize compatibility
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey,
        },
        timeout: 30000
      });

      return {
        success: true,
        data: response.data,
        paymentId: response.data.paymentId || response.data.id
      };
    } catch (error) {
      console.error('Fapshi payment creation error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Payment creation failed'
      };
    }
  }

  /**
   * Check payment status
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Payment status
   */
  async checkPaymentStatus(paymentId) {
    try {
      const response = await axios.get(`${this.baseUrl}/payments/${paymentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'x-api-key': this.apiKey,
          'Accept': 'application/json'
        },
        timeout: 15000
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Fapshi status check error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Status check failed'
      };
    }
  }

  /**
   * Verify webhook signature (if Fapshi provides signature verification)
   * @param {Object} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {boolean} - Whether signature is valid
   */
  verifyWebhookSignature(payload, signature) {
    // Fapshi may provide signature verification
    // This is a placeholder - implement based on Fapshi's documentation
    return true;
  }

  /**
   * Process webhook notification
   * @param {Object} webhookData - Webhook payload
   * @returns {Object} - Processed webhook data
   */
  processWebhook(webhookData) {
    return {
      paymentId: webhookData.paymentId || webhookData.id,
      reference: webhookData.reference,
      status: webhookData.status,
      amount: webhookData.amount,
      currency: webhookData.currency,
      phone: webhookData.phone,
      timestamp: webhookData.timestamp || new Date().toISOString()
    };
  }
}

module.exports = new FapshiService();
