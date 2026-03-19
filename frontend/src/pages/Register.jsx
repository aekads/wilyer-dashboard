// src/pages/Register.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Layers, ArrowRight, Eye, EyeOff, CheckCircle, Building2, User, Mail, Lock } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

export default function Register() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  
  const [form, setForm] = useState({ 
    firstName: '', 
    lastName: '', 
    email: '', 
    password: '', 
    orgName: '', 
    orgSlug: '' 
  })
  
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focusedField, setFocusedField] = useState(null)

  // Password strength check
  const getPasswordStrength = (pass) => {
    let strength = 0
    if (pass.length >= 8) strength++
    if (/[A-Z]/.test(pass)) strength++
    if (/[a-z]/.test(pass)) strength++
    if (/[0-9]/.test(pass)) strength++
    if (/[^A-Za-z0-9]/.test(pass)) strength++
    return strength
  }

  const passwordStrength = getPasswordStrength(form.password)
  const strengthText = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500']

  // Auto-generate slug from Organization Name
  const handleOrgNameChange = (val) => {
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    
    setForm(p => ({ ...p, orgName: val, orgSlug: slug }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return
    
    // Validate password strength
    if (passwordStrength < 3) {
      toast.error('Please use a stronger password')
      return
    }

    setLoading(true)
    try {
      // Call the registration API with corrected field names
      await authAPI.register(form)
      
      toast.success('Workspace created successfully!', {
        icon: '🎉',
        duration: 5000
      })

      // Automatically log the user in after successful registration
      await login({ 
        email: form.email, 
        password: form.password, 
        orgSlug: form.orgSlug 
      })

      // Redirect to dashboard
      navigate('/dashboard')
    } catch (error) {
      console.error('Registration failed:', error)
      // Error toast is handled by interceptor
    } finally {
      setLoading(false)
    }
  }

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const inputClasses = (fieldName) => `
    w-full px-4 py-3 bg-white border rounded-xl 
    transition-all duration-200 text-gray-800
    ${focusedField === fieldName 
      ? 'border-blue-400 ring-4 ring-blue-50' 
      : 'border-gray-200 hover:border-gray-300'
    }
    focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50
    placeholder:text-gray-400
  `

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12" style={{ backgroundColor: '#eaf6fd' }}>
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full opacity-20 blur-3xl"></div>
      </div>

      <div className="w-full max-w-md animate-slide-in-up relative">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 mx-auto mb-4 flex items-center justify-center shadow-lg shadow-blue-200">
            <Layers size={30} className="text-white" />
          </div>
        
        </div>

        {/* Main Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                  <User size={14} className="inline mr-1 text-gray-500" />
                  First Name
                </label>
                <input 
                  type="text" 
                  placeholder="John" 
                  required
                  value={form.firstName} 
                  onFocus={() => setFocusedField('firstName')}
                  onBlur={() => setFocusedField(null)}
                  onChange={e => updateField('firstName', e.target.value)}
                  className={inputClasses('firstName')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                  Last Name
                </label>
                <input 
                  type="text" 
                  placeholder="Doe" 
                  required
                  value={form.lastName} 
                  onFocus={() => setFocusedField('lastName')}
                  onBlur={() => setFocusedField(null)}
                  onChange={e => updateField('lastName', e.target.value)}
                  className={inputClasses('lastName')}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                <Mail size={14} className="inline mr-1 text-gray-500" />
                Work Email
              </label>
              <input 
                type="email" 
                placeholder="you@company.com" 
                required
                value={form.email} 
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                onChange={e => updateField('email', e.target.value)}
                className={inputClasses('email')}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                <Lock size={14} className="inline mr-1 text-gray-500" />
                Password
              </label>
              <div className="relative">
                <input 
                  type={showPass ? 'text' : 'password'} 
                  placeholder="Create a strong password" 
                  required
                  value={form.password} 
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  onChange={e => updateField('password', e.target.value)}
                  className={inputClasses('password')}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              
              {/* Password Strength Meter */}
              {form.password && (
                <div className="mt-3 space-y-2">
                  <div className="flex gap-1.5">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i < passwordStrength ? strengthColor[passwordStrength-1] : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">
                    Password strength: <span className="font-medium">{strengthText[passwordStrength-1]}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Organization */}
            <div className="pt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                <Building2 size={14} className="inline mr-1 text-gray-500" />
                Organization Name
              </label>
              <input 
                type="text" 
                placeholder="Acme Corporation" 
                required
                value={form.orgName} 
                onFocus={() => setFocusedField('orgName')}
                onBlur={() => setFocusedField(null)}
                onChange={e => handleOrgNameChange(e.target.value)}
                className={inputClasses('orgName')}
              />
            </div>

            {/* Workspace URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5 ml-1">
                Workspace URL
              </label>
              <div className="flex">
                <span className="flex items-center px-4 bg-gray-50 border border-r-0 border-gray-200 rounded-l-xl text-gray-600 text-sm">
                  aekads.com/
                </span>
                <input 
                  type="text" 
                  placeholder="your-company" 
                  required
                  value={form.orgSlug}
                  onFocus={() => setFocusedField('orgSlug')}
                  onBlur={() => setFocusedField(null)}
                  onChange={e => updateField('orgSlug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}
                  className={`${inputClasses('orgSlug')} rounded-l-none border-l-0`}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1.5 ml-1">
                Only lowercase letters, numbers, and hyphens
              </p>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-3.5 px-4 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg shadow-blue-200 flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create Workspace <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

      
        </div>

        {/* Sign In Link */}
        <p className="text-center text-gray-600 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-all">
            Sign in to your workspace
          </Link>
        </p>
      </div>
    </div>
  )
}