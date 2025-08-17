# OTP System Setup Guide

## Environment Configuration

To use the OTP system, you need to create a `.env.local` file in your project root with the following variables:

```env
# SMS API Configuration
# Get your API key from https://2factor.in/
VITE_SMS_API_KEY=your_actual_api_key_here

# Application Configuration
VITE_APP_NAME=InvenEase
VITE_APP_VERSION=1.0.0

# Development Configuration
VITE_DEV_MODE=true
```

## Getting SMS API Key

1. Visit [2factor.in](https://2factor.in/)
2. Sign up for an account
3. Get your API key from the dashboard
4. Replace `your_actual_api_key_here` with your real API key

## OTP System Features

### ✅ Fixed Issues
- **Removed hardcoded API key** - Now uses environment variables
- **Secure OTP storage** - OTPs are stored with expiration and attempt limits
- **6-digit OTPs** - More secure than 4-digit codes
- **Rate limiting** - Prevents spam OTP requests
- **Expiration handling** - OTPs expire after 5 minutes
- **Attempt tracking** - Maximum 3 verification attempts
- **Resend functionality** - Users can request new OTPs with cooldown
- **Better error handling** - Clear error messages for users

### 🔧 Configuration Options

```typescript
const OTP_CONFIG = {
  LENGTH: 6,                    // OTP length (6 digits)
  EXPIRY_MINUTES: 5,           // OTP expiration time
  MAX_ATTEMPTS: 3,             // Maximum verification attempts
  RESEND_COOLDOWN_MINUTES: 1   // Cooldown between resend requests
};
```

### 📱 Usage

The OTP system is now integrated into:
- **Sign In Page** - Phone verification for existing users
- **Sign Up Page** - Phone verification for new accounts
- **Settings Page** - Phone number updates and 2FA

### 🚀 Production Deployment

For production, ensure:
1. **Valid SMS API key** is configured
2. **Environment variables** are properly set
3. **Database storage** replaces in-memory storage
4. **Rate limiting** is configured on the server
5. **Monitoring** is set up for OTP delivery

## Testing

1. Start the development server: `npm run dev`
2. Navigate to sign-in or sign-up pages
3. Enter a phone number to test OTP functionality
4. Check console for OTP codes (in development mode)

## Security Notes

- OTPs are never logged or stored in plain text
- Failed attempts are tracked and limited
- Resend requests have cooldown periods
- OTPs expire automatically
- Phone numbers are validated before sending OTPs
