// SMS API Configuration
const SMS_API_KEY = import.meta.env.VITE_SMS_API_KEY || '97cb7504-7494-11f0-a562-0200cd936042';
const SMS_API_URL = 'https://2factor.in/API/V1';

export interface SMSResponse {
  success: boolean;
  message: string;
  code?: string;
}

export const sendOTP = async (phoneNumber: string): Promise<SMSResponse & { code?: string }> => {
  try {
    // Clean phone number - remove +91 if present and ensure it starts with country code
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }
    
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
      const otp = otpMatch ? otpMatch[1] : generateOTP();
      
      return {
        success: true,
        message: 'OTP sent successfully',
        code: otp
      };
    } else {
      console.error('SMS API Error:', data);
      return {
        success: false,
        message: 'Failed to send OTP'
      };
    }
  } catch (error) {
    console.error('OTP API Error:', error);
    return {
      success: false,
      message: 'Failed to send OTP'
    };
  }
};

export const generateOTP = (): string => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

export const sendSMS = async (phoneNumber: string, message: string): Promise<SMSResponse> => {
  try {
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.startsWith('91') && cleanPhone.length === 12) {
      cleanPhone = cleanPhone.substring(2);
    }
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

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
      return {
        success: false,
        message: 'Failed to send SMS'
      };
    }
  } catch (error) {
    console.error('SMS API Error:', error);
    return {
      success: false,
      message: 'Failed to send SMS'
    };
  }
};

export const sendPasswordResetOTP = async (phoneNumber: string): Promise<SMSResponse & { code?: string }> => {
  return sendOTP(phoneNumber);
};

export const send2FACode = async (phoneNumber: string): Promise<SMSResponse & { code?: string }> => {
  return sendOTP(phoneNumber);
};