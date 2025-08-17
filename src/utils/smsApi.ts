// SMS API Configuration
const SMS_API_KEY = import.meta.env.VITE_SMS_API_KEY;
const SMS_API_URL = 'https://2factor.in/API/V1';

// Validate API key configuration
if (!SMS_API_KEY) {
  console.error('SMS API key not configured. Please set VITE_SMS_API_KEY in your environment variables.');
}

export interface SMSResponse {
  success: boolean;
  message: string;
  error?: string;
}

export interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
  phoneNumber: string;
  createdAt: number;
}

// In-memory OTP storage (replace with database in production)
const otpStorage = new Map<string, OTPData>();

// OTP configuration
const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 5,
  MAX_ATTEMPTS: 3,
  RESEND_COOLDOWN_MINUTES: 1,
  MAX_OTPS_PER_HOUR: 5
};

// Rate limiting storage
const rateLimitStorage = new Map<string, { count: number; resetTime: number }>();

export const sendOTP = async (phoneNumber: string): Promise<SMSResponse> => {
  try {
    // Validate phone number
    if (!isValidPhoneNumber(phoneNumber)) {
      return {
        success: false,
        message: 'Invalid phone number format',
        error: 'INVALID_PHONE'
      };
    }

    // Check rate limiting
    const rateLimit = checkRateLimit(phoneNumber);
    if (!rateLimit.allowed) {
      return {
        success: false,
        message: `Too many OTP requests. Please wait ${rateLimit.waitTime} minute(s) before trying again.`,
        error: 'RATE_LIMIT_EXCEEDED'
      };
    }

    // Check if OTP was recently sent
    const existingOTP = otpStorage.get(phoneNumber);
    if (existingOTP && !isOTPExpired(existingOTP.expiresAt)) {
      const cooldownTime = existingOTP.expiresAt - Date.now() + (OTP_CONFIG.RESEND_COOLDOWN_MINUTES * 60 * 1000);
      if (cooldownTime > 0) {
        const minutesLeft = Math.ceil(cooldownTime / (60 * 1000));
        return {
          success: false,
          message: `Please wait ${minutesLeft} minute(s) before requesting another OTP`,
          error: 'COOLDOWN_ACTIVE'
        };
      }
    }

    // Clean phone number for API
    const cleanPhone = formatPhoneNumber(phoneNumber);
    
    // Generate new OTP
    const newOTP = generateOTP();
    const expiresAt = Date.now() + (OTP_CONFIG.EXPIRY_MINUTES * 60 * 1000);
    const createdAt = Date.now();
    
    // Store OTP data (without exposing it)
    otpStorage.set(phoneNumber, {
      code: newOTP,
      expiresAt,
      attempts: 0,
      phoneNumber,
      createdAt
    });

    // Try to send via SMS API if configured
    if (SMS_API_KEY) {
      try {
        const response = await fetch(`${SMS_API_URL}/${SMS_API_KEY}/SMS/${cleanPhone}/AUTOGEN/OTP1`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = await response.text();
        
        if (response.ok && data.includes('Status":"Success')) {
          // Extract OTP from response if available
          const otpMatch = data.match(/"OTP":"(\d+)"/);
          if (otpMatch) {
            // Update stored OTP with the one from API
            otpStorage.set(phoneNumber, {
              code: otpMatch[1],
              expiresAt,
              attempts: 0,
              phoneNumber,
              createdAt
            });
          }
          
          // Update rate limiting
          updateRateLimit(phoneNumber);
          
          return {
            success: true,
            message: 'OTP sent successfully via SMS'
          };
        } else {
          console.warn('SMS API failed:', data);
          // Remove stored OTP if SMS failed
          otpStorage.delete(phoneNumber);
          return {
            success: false,
            message: 'Failed to send OTP via SMS. Please try again later.',
            error: 'SMS_DELIVERY_FAILED'
          };
        }
      } catch (apiError) {
        console.warn('SMS API error:', apiError);
        // Remove stored OTP if API error
        otpStorage.delete(phoneNumber);
        return {
          success: false,
          message: 'Failed to send OTP. Please try again later.',
          error: 'API_ERROR'
        };
      }
    } else {
      // No API key configured
      otpStorage.delete(phoneNumber);
      return {
        success: false,
        message: 'SMS service not configured. Please contact support.',
        error: 'SMS_NOT_CONFIGURED'
      };
    }
  } catch (error) {
    console.error('OTP generation error:', error);
    return {
      success: false,
      message: 'Failed to generate OTP',
      error: 'GENERATION_ERROR'
    };
  }
};

export const verifyOTP = (phoneNumber: string, inputOTP: string): SMSResponse => {
  try {
    const storedOTP = otpStorage.get(phoneNumber);
    
    if (!storedOTP) {
      return {
        success: false,
        message: 'No OTP found for this phone number',
        error: 'OTP_NOT_FOUND'
      };
    }

    if (isOTPExpired(storedOTP.expiresAt)) {
      // Clean up expired OTP
      otpStorage.delete(phoneNumber);
      return {
        success: false,
        message: 'OTP has expired. Please request a new one.',
        error: 'OTP_EXPIRED'
      };
    }

    if (storedOTP.attempts >= OTP_CONFIG.MAX_ATTEMPTS) {
      // Clean up OTP after max attempts
      otpStorage.delete(phoneNumber);
      return {
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.',
        error: 'MAX_ATTEMPTS_EXCEEDED'
      };
    }

    // Increment attempts
    storedOTP.attempts++;
    otpStorage.set(phoneNumber, storedOTP);

    if (inputOTP === storedOTP.code) {
      // Clean up successful OTP
      otpStorage.delete(phoneNumber);
      return {
        success: true,
        message: 'OTP verified successfully'
      };
    } else {
      return {
        success: false,
        message: `Invalid OTP. ${OTP_CONFIG.MAX_ATTEMPTS - storedOTP.attempts} attempts remaining.`,
        error: 'INVALID_OTP'
      };
    }
  } catch (error) {
    console.error('OTP verification error:', error);
    return {
      success: false,
      message: 'Error verifying OTP',
      error: 'VERIFICATION_ERROR'
    };
  }
};

export const generateOTP = (): string => {
  // Use crypto.randomInt for better security if available
  if (typeof crypto !== 'undefined' && crypto.randomInt) {
    return crypto.randomInt(100000, 999999).toString();
  }
  // Fallback to Math.random (less secure but functional)
  return Math.floor(Math.pow(10, OTP_CONFIG.LENGTH - 1) + Math.random() * Math.pow(10, OTP_CONFIG.LENGTH - 1)).toString();
};

export const isOTPExpired = (expiresAt: number): boolean => {
  return Date.now() > expiresAt;
};

export const getOTPStatus = (phoneNumber: string): { exists: boolean; expiresIn?: number; attemptsLeft?: number } => {
  const storedOTP = otpStorage.get(phoneNumber);
  if (!storedOTP) {
    return { exists: false };
  }
  
  if (isOTPExpired(storedOTP.expiresAt)) {
    return { exists: false };
  }
  
  return {
    exists: true,
    expiresIn: Math.ceil((storedOTP.expiresAt - Date.now()) / (60 * 1000)),
    attemptsLeft: OTP_CONFIG.MAX_ATTEMPTS - storedOTP.attempts
  };
};

export const resendOTP = async (phoneNumber: string): Promise<SMSResponse> => {
  // Clear existing OTP first
  otpStorage.delete(phoneNumber);
  
  // Send new OTP
  return sendOTP(phoneNumber);
};

export const clearOTP = (phoneNumber: string): void => {
  otpStorage.delete(phoneNumber);
};

// Rate limiting functions
const checkRateLimit = (phoneNumber: string): { allowed: boolean; waitTime?: number } => {
  const now = Date.now();
  const hourAgo = now - (60 * 60 * 1000);
  
  const rateLimit = rateLimitStorage.get(phoneNumber);
  
  if (!rateLimit || rateLimit.resetTime < now) {
    // Reset rate limit
    rateLimitStorage.set(phoneNumber, { count: 1, resetTime: now + (60 * 60 * 1000) });
    return { allowed: true };
  }
  
  if (rateLimit.count >= OTP_CONFIG.MAX_OTPS_PER_HOUR) {
    const waitTime = Math.ceil((rateLimit.resetTime - now) / (60 * 1000));
    return { allowed: false, waitTime };
  }
  
  rateLimit.count++;
  rateLimitStorage.set(phoneNumber, rateLimit);
  return { allowed: true };
};

const updateRateLimit = (phoneNumber: string): void => {
  const now = Date.now();
  const rateLimit = rateLimitStorage.get(phoneNumber);
  
  if (rateLimit) {
    rateLimit.count++;
    rateLimitStorage.set(phoneNumber, rateLimit);
  }
};

// Phone number validation and formatting
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return false;
  }
  
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // Basic validation: 10-15 digits
  if (cleanPhone.length < 10 || cleanPhone.length > 15) {
    return false;
  }
  
  // Additional validation for Indian numbers
  if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
    return true;
  }
  
  if (cleanPhone.length === 10) {
    return true;
  }
  
  return false;
};

export const formatPhoneNumber = (phoneNumber: string): string => {
  let cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // Handle Indian numbers
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  } else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
    // Already in correct format
  } else if (cleanPhone.startsWith('+91')) {
    cleanPhone = cleanPhone.substring(1);
  }
  
  return cleanPhone;
};

export const sendSMS = async (phoneNumber: string, message: string): Promise<SMSResponse> => {
  try {
    if (!isValidPhoneNumber(phoneNumber)) {
      return {
        success: false,
        message: 'Invalid phone number format',
        error: 'INVALID_PHONE'
      };
    }

    if (!SMS_API_KEY) {
      return {
        success: false,
        message: 'SMS API not configured',
        error: 'API_NOT_CONFIGURED'
      };
    }

    const cleanPhone = formatPhoneNumber(phoneNumber);

    const response = await fetch(`${SMS_API_URL}/${SMS_API_KEY}/SMS/${cleanPhone}/${encodeURIComponent(message)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = await response.text();
    
    if (response.ok && data.includes('Status":"Success')) {
      return {
        success: true,
        message: 'SMS sent successfully'
      };
    } else {
      console.error('SMS API Error:', data);
      return {
        success: false,
        message: 'Failed to send SMS',
        error: 'API_ERROR'
      };
    }
  } catch (error) {
    console.error('SMS API Error:', error);
    return {
      success: false,
      message: 'Failed to send SMS',
      error: 'NETWORK_ERROR'
    };
  }
};

export const sendPasswordResetOTP = async (phoneNumber: string): Promise<SMSResponse> => {
  return sendOTP(phoneNumber);
};

export const send2FACode = async (phoneNumber: string): Promise<SMSResponse> => {
  return sendOTP(phoneNumber);
};