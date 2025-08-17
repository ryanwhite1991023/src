import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Star } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { sendOTP } from '../utils/smsApi';
import { storage } from '../utils/localStorage';

const SignUpPage = () => {
  const navigate = useNavigate();
  const { login } = useUser();
  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    gstNumber: '',
    upiId: ''
  });
  const [businessAddress, setBusinessAddress] = useState('');
  const [showOTPVerification, setShowOTPVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [sentOTP, setSentOTP] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (formData.phone) {
      setLoading(true);
      try {
        const result = await sendOTP(formData.phone);
        if (result.success && result.code) {
          setSentOTP(result.code);
          setShowOTPVerification(true);
          alert(`OTP sent to ${formData.phone}: ${result.code}`); // For demo purposes
        } else {
          alert('Failed to send OTP. Please check your internet connection and try again.');
        }
      } catch (error) {
        alert('Error sending OTP. Please try again.');
      } finally {
        setLoading(false);
      }
    } else {
      createAccount();
    }
  };

  const verifyOTP = () => {
    if (otp === sentOTP) {
      createAccount();
    } else {
      alert('Invalid OTP. Please try again.');
    }
  };

  const createAccount = () => {
    // Create user account
    const userData = {
      id: Date.now().toString(),
      fullName: formData.fullName,
      businessName: formData.businessName,
      email: formData.email,
      phone: formData.phone,
      gstNumber: formData.gstNumber,
      businessAddress: businessAddress || '',
      upiId: formData.upiId,
      isLoggedIn: true,
      registrationDate: new Date().toISOString(),
      subscription: {
        type: 'trial' as const,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true
      },
      trialDaysLeft: 7
    };

    // Save user to localStorage for future logins
    storage.saveUser(userData);

    login(userData);
    navigate('/dashboard');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16">
        <div className="max-w-md mx-auto w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-2 mb-6">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold text-gray-900">InvenEase</span>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
            <p className="text-gray-600">Join thousands of businesses using InvenEase</p>
          </div>

          {showOTPVerification ? (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Verify Phone Number</h2>
                <p className="text-gray-600">Enter the 4-digit code sent to {formData.phone}</p>
              </div>
              
              <div>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 4-digit OTP"
                  maxLength={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowOTPVerification(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={verifyOTP}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700"
                >
                  Verify & Create Account
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Name
              </label>
              <input
                type="text"
                name="businessName"
                value={formData.businessName}
                onChange={handleChange}
                placeholder="Enter business name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Create password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Business Address
              </label>
              <input
                type="text"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                placeholder="Enter business address"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number (For OTP Verification)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Enter phone number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                UPI ID (For payments)
              </label>
              <input
                type="text"
                name="upiId"
                value={formData.upiId}
                onChange={handleChange}
                placeholder="Enter your UPI ID"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST Number (Optional)
              </label>
              <input
                type="text"
                name="gstNumber"
                value={formData.gstNumber}
                onChange={handleChange}
                placeholder="Enter GST number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-300"
            >
              {loading ? 'Sending OTP...' : 'Create Account'}
            </button>
          </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/signin" className="text-blue-600 hover:text-blue-500 font-medium">
                Sign in
              </Link>
            </p>
          </div>

          <div className="mt-6 text-xs text-gray-500 text-center">
            By continuing, you agree to our{' '}
            <Link to="/terms" className="text-blue-600 hover:text-blue-500">Terms of Service</Link>
            {' '}and{' '}
            <Link to="/privacy" className="text-blue-600 hover:text-blue-500">Privacy Policy</Link>
          </div>
        </div>
      </div>

      {/* Right Side - Info Panel */}
      <div className="hidden lg:flex lg:flex-1 bg-gradient-to-br from-blue-600 to-purple-600 text-white relative overflow-hidden">
        <div className="flex flex-col justify-center px-12 relative z-10">
          <div className="mb-12">
            <h2 className="text-3xl font-bold mb-4">Transform Your Business Operations</h2>
            <p className="text-xl opacity-90 mb-8">
              The most comprehensive point-of-sale and inventory management platform designed for modern businesses of all sizes.
            </p>
          </div>

          <div className="space-y-6 mb-12">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Complete POS System</h3>
                <p className="text-sm opacity-75">Full-featured point of sale with barcode scanning</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold">Advanced Analytics</h3>
                <p className="text-sm opacity-75">Real-time sales tracking and detailed reports</p>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="font-semibold">R</span>
              </div>
              <div>
                <p className="font-semibold">Rajesh Kumar</p>
                <p className="text-sm opacity-75">Retail Store Owner</p>
              </div>
            </div>
            <p className="text-sm opacity-90 italic">
              "InvenEase revolutionized our store operations. Sales tracking, inventory management, and GST compliance - everything in one place. Our revenue increased by 40% in just 3 months!"
            </p>
          </div>
        </div>
        
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full transform translate-x-32 -translate-y-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full transform -translate-x-48 translate-y-48"></div>
      </div>

      {/* Bottom links for mobile */}
      <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex justify-center space-x-6 text-sm text-gray-600">
          <Link to="/about">About</Link>
          <Link to="/contact">Contact Us</Link>
          <Link to="/returns">Returns</Link>
          <Link to="/shipping">Shipping</Link>
          <Link to="/cookies">Cookies</Link>
        </div>
      </div>
    </div>
  );
};

export default SignUpPage;