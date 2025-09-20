# Fapshi Payment Integration Configuration

## Current Status
✅ **LIVE API CONNECTION SUCCESSFUL!** - Using live Fapshi API
✅ **Fixed API endpoint**: Now using correct path `/payments/direct_request`
✅ **Fixed authentication**: Using Basic auth with base64 encoding
✅ **Live credentials configured**: Using provided live API credentials
✅ **Real mobile money prompts**: Customers will receive actual payment prompts

## Current Configuration

The system is now configured with live Fapshi credentials:

### Live Production Settings:
```bash
FAPSHI_API_USER=ae6e76a3-048c-4e3b-8a6e-a6821d8ebcdd
FAPSHI_API_KEY=FAK_ea73788edd840acb772d5069a8b70cda
FAPSHI_BASE_URL=https://fapshi.com
```

### Environment Variables (Optional Override):
If you need to change credentials, set these environment variables:

```bash
FAPSHI_API_USER=your_api_user
FAPSHI_API_KEY=your_api_key
FAPSHI_BASE_URL=https://fapshi.com
```

## How to Get Credentials

1. **Visit Fapshi Dashboard**: Go to [Fapshi Dashboard](https://dashboard.fapshi.com)
2. **Create Service**: Create a new service (sandbox or live)
3. **Get Credentials**: Copy your API user, API key, and service ID
4. **Set Environment Variables**: Add them to your `.env` file or system environment

## Live Production Mode

The system is now running in live production mode, which means:
- ✅ Payment requests are processed successfully
- ✅ Database records are created correctly
- ✅ Webhook handling works
- ✅ **Real mobile money prompts are sent to customers**
- ✅ **Actual payments are processed through Fapshi**

## Testing the Integration

The live integration is working! To test:
1. Make a payment request through your application
2. Check the logs for "LIVE FAPSHI API CONNECTION SUCCESSFUL!"
3. Customers will receive real mobile money prompts
4. Payments will be processed through the live Fapshi system

## API Endpoints Used

- **Payment Creation**: `POST {baseUrl}/payments/direct_request`
- **Status Check**: `GET {baseUrl}/transactions/{paymentId}`
- **Webhook**: `POST {webhookUrl}/api/payments/fapshi/webhook`

## Authentication

Using Basic Authentication:
```
Authorization: Basic base64(apiUser:apiKey)
```

## Payment Payload Structure

```json
{
  "amount": 1000,
  "currency": "XAF",
  "customer_phone": "675644383",
  "customer_name": "Customer",
  "description": "Course enrollment payment - ENROLL_123",
  "reference": "ENROLL_123",
  "callback_url": "http://localhost:4000/api/payments/fapshi/webhook",
  "return_url": "http://localhost:5173/payment/success?ref=ENROLL_123"
}
```

**Note**: Service ID is not required for live Fapshi API.
