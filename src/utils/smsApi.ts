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
  code?: string;
  error?: string;
}

export interface OTPData {
  code: string;
  expiresAt: number;
  attempts: number;
  phoneNumber: string;
}

// In-memory OTP storage (replace with database in production)
const otpStorage = new Map<string, OTPData>();

// OTP configuration
const OTP_CONFIG = {
  LENGTH: 6,
  EXPIRY_MINUTES: 5,
  MAX_ATTEMPTS: 3,
  RESEND_COOLDOWN_MINUTES: 1
};

export const sendOTP = async (phoneNumber: string): Promise<SMSResponse & { code?: string }> => {
  try {
    // Validate phone number
    if (!isValidPhoneNumber(phoneNumber)) {
      return {
        success: false,
        message: 'Invalid phone number format',
        error: 'INVALID_PHONE'
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
    
    // Store OTP data
    otpStorage.set(phoneNumber, {
      code: newOTP,
      expiresAt,
      attempts: 0,
      phoneNumber
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
              phoneNumber
            });
          }
          
          return {
            success: true,
            message: 'OTP sent successfully via SMS',
            code: newOTP // Return generated OTP for demo/fallback
          };
        } else {
          console.warn('SMS API failed, using generated OTP:', data);
          // Fallback to generated OTP
          return {
            success: true,
            message: 'OTP generated successfully (SMS delivery failed)',
            code: newOTP
          };
        }
      } catch (apiError) {
        console.warn('SMS API error, using generated OTP:', apiError);
        // Fallback to generated OTP
        return {
          success: true,
          message: 'OTP generated successfully (SMS delivery failed)',
          code: newOTP
        };
      }
    } else {
      // No API key configured, use generated OTP
      return {
        success: true,
        message: 'OTP generated successfully (SMS not configured)',
        code: newOTP
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

export const resendOTP = async (phoneNumber: string): Promise<SMSResponse & { code?: string }> => {
  // Clear existing OTP first
  otpStorage.delete(phoneNumber);
  
  // Send new OTP
  return sendOTP(phoneNumber);
};

export const clearOTP = (phoneNumber: string): void => {
  otpStorage.delete(phoneNumber);
};

// Phone number validation and formatting
export const isValidPhoneNumber = (phoneNumber: string): boolean => {
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  return cleanPhone.length >= 10 && cleanPhone.length <= 15;
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

export const sendPasswordResetOTP = async (phoneNumber: string): Promise<SMSResponse & { code?: string }> => {
  return sendOTP(phoneNumber);
};

export const send2FACode = async (phoneNumber: string): Promise<SMSResponse & { code?: string }> => {
  return sendOTP(phoneNumber);
};