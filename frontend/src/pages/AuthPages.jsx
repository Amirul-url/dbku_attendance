import { useState } from 'react'
import { ArrowLeft, CheckCircle2, ChevronDown, Eye, EyeOff, KeyRound, Mail, MessageSquareText, UserPlus } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { apiRequest } from '../api/client.js'

const departments = [
  'Administration (ADM)',
  'Internal Audit (AUD)',
  'Building (BLG)',
  'Community Development & Services (CDS)',
  'Contract and Procurement (COP)',
  'Committee Secretariat (CTS)',
  'Engineering Project (ENG)',
  'Enforcement and Security (ENS)',
  'Health and Environment (ENV)',
  'Finance (FIN)',
  'Geoinformation and Property Management (GPM)',
  'Human Resource Management (HRM)',
  'Information and Communication Technology (ICT)',
  'Infrastructure Maintenance (IMT)',
  'Information Resource (IRD)',
  'Legal Affairs (LAW)',
  'Licensing (LES)',
  'Landscape and Planning (LNP)',
  'Mechanical and Electrical (MNE)',
  'Public Relations (PRD)',
  'Special Project & Public Facility (SPF)',
  'Transformation and Innovation (TRI)',
  'Valuation and Taxation (VAL)',
  'Others',
]

const countryCodeOptions = ['+60']

const existingAccountMessages = {
  staff_id: 'This Staff ID already has an account. Please login to the existing account or use Forgot Password.',
  email: 'This email address already has an account. Please login to the existing account or use Forgot Password.',
  phone_number: 'This WhatsApp number already has an account. Please login to the existing account or use Forgot Password.',
}

function getApiFieldError(data, field) {
  const value = data?.[field]
  if (!value) return ''
  return Array.isArray(value) ? value[0] : String(value)
}

function mapRegisterErrors(data) {
  const nextErrors = {}
  for (const field of ['staff_id', 'email', 'phone_number', 'confirm_password', 'password']) {
    const apiMessage = getApiFieldError(data, field)
    if (!apiMessage) continue
    const isExistingAccount = /already|exist|registered/i.test(apiMessage)
    nextErrors[field] = isExistingAccount && existingAccountMessages[field]
      ? existingAccountMessages[field]
      : apiMessage
  }
  return nextErrors
}

function AuthShell({ badge, title, subtitle, children }) {
  return (
    <div className="login-screen auth-web-screen">
      <div className="login-workspace auth-workspace">
        <div className="login-card auth-card">
          <div className="login-form-header auth-form-header">
            <div className="auth-header-top">
              <div className="login-badge">{badge}</div>
              <Link to="/login" className="auth-top-link">
                <ArrowLeft size={16} />
                Back to Login
              </Link>
            </div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div className="auth-form-body">{children}</div>
        </div>
      </div>
    </div>
  )
}

function OtpInput({ value, onChange }) {
  const digits = value.padEnd(6, ' ').slice(0, 6).split('')

  function updateDigit(index, nextValue) {
    const cleanValue = nextValue.replace(/\D/g, '')
    if (!cleanValue) {
      const nextDigits = digits.map((digit) => (digit === ' ' ? '' : digit))
      nextDigits[index] = ''
      onChange(nextDigits.join('').slice(0, 6))
      return
    }

    const nextDigits = digits.map((digit) => (digit === ' ' ? '' : digit))
    cleanValue.slice(0, 6 - index).split('').forEach((digit, offset) => {
      nextDigits[index + offset] = digit
    })
    onChange(nextDigits.join('').slice(0, 6))

    const nextIndex = Math.min(index + cleanValue.length, 5)
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-otp-index="${nextIndex}"]`)?.focus()
    })
  }

  function handleKeyDown(event, index) {
    if (event.key === 'Backspace' && !digits[index].trim() && index > 0) {
      window.requestAnimationFrame(() => {
        document.querySelector(`[data-otp-index="${index - 1}"]`)?.focus()
      })
    }
  }

  return (
    <div className="otp-input-grid" aria-label="Enter 6-digit OTP">
      {digits.map((digit, index) => (
        <input
          key={index}
          data-otp-index={index}
          inputMode="numeric"
          maxLength={1}
          value={digit.trim()}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          onFocus={(event) => event.target.select()}
          aria-label={`OTP digit ${index + 1}`}
          required
        />
      ))}
    </div>
  )
}

function splitPhoneNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.startsWith('60')) {
    return { countryCode: '+60', localNumber: digits.slice(2) }
  }
  return { countryCode: '+60', localNumber: digits }
}

function combinePhoneNumber(countryCode, localNumber) {
  const cleanLocalNumber = String(localNumber || '').replace(/\D/g, '')
  if (!cleanLocalNumber) return ''
  return `${String(countryCode || '').replace(/\D/g, '')}${cleanLocalNumber}`
}

function PhoneNumberInput({ value, onChange, required = false }) {
  const initialPhone = splitPhoneNumber(value)
  const [countryCode, setCountryCode] = useState(initialPhone.countryCode)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const countryDigits = String(countryCode || '').replace(/\D/g, '')
  const valueDigits = String(value || '').replace(/\D/g, '')
  const localNumber = countryDigits && valueDigits.startsWith(countryDigits)
    ? valueDigits.slice(countryDigits.length)
    : splitPhoneNumber(value).localNumber

  function updatePhone(nextCountryCode, nextLocalNumber) {
    setCountryCode(nextCountryCode)
    onChange(combinePhoneNumber(nextCountryCode, nextLocalNumber))
  }

  function chooseCountryCode(nextCountryCode) {
    setIsMenuOpen(false)
    updatePhone(nextCountryCode, localNumber)
  }

  return (
    <div className="phone-input-grid">
      <div className="phone-code-combo">
        <input
          className="phone-code-input"
          inputMode="tel"
          value={countryCode}
          onChange={(event) => updatePhone(event.target.value, localNumber)}
          aria-label="Country code"
          required={required}
        />
        <button
          type="button"
          className="phone-code-toggle"
          aria-label="Select country code"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">▾</span>
        </button>
        {isMenuOpen && (
          <div className="phone-code-menu">
            {countryCodeOptions.map((option) => (
              <button type="button" key={option} onClick={() => chooseCountryCode(option)}>
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
      <input
        inputMode="tel"
        value={localNumber}
        onChange={(event) => updatePhone(countryCode, event.target.value)}
        placeholder="e.g. 123456789"
        aria-label="Phone number"
        required={required}
      />
    </div>
  )
}

function PhoneNumberSelectInput({ value, onChange, required = false }) {
  const initialPhone = splitPhoneNumber(value)
  const [countryCode, setCountryCode] = useState(initialPhone.countryCode)
  const countryDigits = String(countryCode || '').replace(/\D/g, '')
  const valueDigits = String(value || '').replace(/\D/g, '')
  const localNumber = countryDigits && valueDigits.startsWith(countryDigits)
    ? valueDigits.slice(countryDigits.length)
    : splitPhoneNumber(value).localNumber

  function updatePhone(nextCountryCode, nextLocalNumber) {
    setCountryCode(nextCountryCode)
    onChange(combinePhoneNumber(nextCountryCode, nextLocalNumber))
  }

  return (
    <div className="phone-input-grid">
      <div className="phone-code-select-wrap">
        <select
          className="phone-code-select"
          value={countryCode}
          onChange={(event) => updatePhone(event.target.value, localNumber)}
          aria-label="Country code"
          required={required}
        >
          {countryCodeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <ChevronDown className="phone-code-chevron" size={18} aria-hidden="true" />
      </div>
      <input
        inputMode="tel"
        value={localNumber}
        onChange={(event) => updatePhone(countryCode, event.target.value)}
        placeholder="e.g. 123456789"
        aria-label="Phone number"
        required={required}
      />
    </div>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '',
    staff_id: '',
    email: '',
    phone_number: '',
    department: '',
    other_department: '',
    password: '',
    confirm_password: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors((current) => ({ ...current, [field]: '' }))
    }
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setFieldErrors({})
    setSaving(true)
    try {
      await apiRequest('/auth/register/manual/', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          department: form.department === 'Others' ? form.other_department : form.department,
        }),
      })
      setMessage('Registration successful. Redirecting to login...')
      window.setTimeout(() => navigate('/login', { replace: true }), 900)
    } catch (err) {
      const nextFieldErrors = mapRegisterErrors(err.data)
      setFieldErrors(nextFieldErrors)
      if (Object.keys(nextFieldErrors).length) {
        const hasExistingAccountError = ['staff_id', 'email', 'phone_number'].some((field) => nextFieldErrors[field])
        setError(hasExistingAccountError
          ? 'An account already exists with one of these details. Please login to the existing account or use Forgot Password.'
          : 'Please fix the highlighted fields and try again.')
      } else {
        setError(err.message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthShell
      badge="New Account"
      title="Register Staff Account"
      subtitle="Fill in your details to create a staff account."
    >
      <form className="stack-form" onSubmit={submit}>
        <div className="form-section-title">Personal Information</div>
        <div className="form-grid-2">
          <label className="compact-field">
            <span>Full Name</span>
            <input value={form.full_name} onChange={(event) => update('full_name', event.target.value)} placeholder="e.g. Ali bin Abu" required />
          </label>
          <label className={`compact-field ${fieldErrors.staff_id ? 'has-error' : ''}`}>
            <span>Staff ID</span>
            <input value={form.staff_id} onChange={(event) => update('staff_id', event.target.value)} placeholder="e.g. DBKU0001" required />
            {fieldErrors.staff_id && <span className="field-error-message">{fieldErrors.staff_id}</span>}
          </label>
        </div>
        <label className={`compact-field ${fieldErrors.email ? 'has-error' : ''}`}>
          <span>Email Address</span>
          <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="e.g. ali@dbku.gov.my" required />
          {fieldErrors.email && <span className="field-error-message">{fieldErrors.email}</span>}
        </label>
        <label className={`compact-field ${fieldErrors.phone_number ? 'has-error' : ''}`}>
          <span>WhatsApp Number</span>
          <PhoneNumberSelectInput value={form.phone_number} onChange={(value) => update('phone_number', value)} />
          {fieldErrors.phone_number && <span className="field-error-message">{fieldErrors.phone_number}</span>}
        </label>
        <label className="compact-field">
          <span>Department</span>
          <select value={form.department} onChange={(event) => update('department', event.target.value)} required>
            <option value="">-- Please Select --</option>
            {departments.map((department) => <option key={department} value={department}>{department}</option>)}
          </select>
        </label>
        {form.department === 'Others' && (
          <label className="compact-field">
            <span>Specify Department</span>
            <input value={form.other_department} onChange={(event) => update('other_department', event.target.value)} placeholder="Enter department name" required />
          </label>
        )}
        <div className="form-section-title">Security</div>
        <label className={`compact-field ${fieldErrors.password ? 'has-error' : ''}`}>
          <span>Password</span>
          <div className="password-input-wrap">
            <input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => update('password', event.target.value)} required minLength={8} />
            <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password">
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {fieldErrors.password && <span className="field-error-message">{fieldErrors.password}</span>}
        </label>
        <label className={`compact-field ${fieldErrors.confirm_password ? 'has-error' : ''}`}>
          <span>Confirm Password</span>
          <input type="password" value={form.confirm_password} onChange={(event) => update('confirm_password', event.target.value)} required minLength={8} />
          {fieldErrors.confirm_password && <span className="field-error-message">{fieldErrors.confirm_password}</span>}
        </label>
        <div className="requirement-box">Password must be at least 8 characters and should include letters and numbers.</div>
        {error && <div className="alert-error">{error}</div>}
        {message && <div className="alert-success">{message}</div>}
        <button type="submit" className="primary-button portal-login-button" disabled={saving}>
          <UserPlus size={20} />
          {saving ? 'Registering...' : 'Register Account'}
        </button>
        <Link to="/login" className="create-account-button auth-link-button">
          <ArrowLeft size={20} />
          I already have an account
        </Link>
      </form>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('email')
  const [otpMethod, setOtpMethod] = useState('email')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sendingOtp, setSendingOtp] = useState(false)

  async function requestOtp() {
    setError('')
    setMessage('')
    setSendingOtp(true)
    try {
      await apiRequest('/auth/forgot-password/send-otp/', {
        method: 'POST',
        body: JSON.stringify({
          method: otpMethod,
          email: otpMethod === 'email' ? email : '',
          phone_number: otpMethod === 'whatsapp' ? phone : '',
        }),
      })
      setStep('otp')
      setOtp('')
      setMessage(`OTP sent by ${otpMethod}.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSendingOtp(false)
    }
  }

  async function sendOtp(event) {
    event.preventDefault()
    await requestOtp()
  }

  async function verifyOtp(event) {
    event.preventDefault()
    setError('')
    try {
      await apiRequest('/auth/forgot-password/verify-otp/', {
        method: 'POST',
        body: JSON.stringify({
          method: otpMethod,
          email: otpMethod === 'email' ? email : '',
          phone_number: otpMethod === 'whatsapp' ? phone : '',
          otp,
        }),
      })
      const params = new URLSearchParams({ method: otpMethod, otp })
      if (otpMethod === 'email') {
        params.set('email', email)
      } else {
        params.set('phone_number', phone)
      }
      navigate(`/reset-password?${params.toString()}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AuthShell
      badge="Account Recovery"
      title="Reset your password"
      subtitle="Enter your registered email, choose how to receive the OTP, then create a new password after verification."
    >
      <div className="steps-row progress-steps">
        <span className={step === 'email' ? 'active' : 'done'}>{otpMethod === 'email' ? 'Email' : 'WhatsApp'}</span>
        <span className={step === 'otp' ? 'active' : ''}>OTP</span>
        <span>Password</span>
      </div>
      {step === 'email' ? (
        <form className="stack-form" onSubmit={sendOtp}>
          <label className="compact-field">
            <span>{otpMethod === 'email' ? 'Email Address' : 'WhatsApp Number'}</span>
            {otpMethod === 'email' ? (
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="e.g. name@email.com" required />
            ) : (
              <PhoneNumberSelectInput value={phone} onChange={setPhone} required />
            )}
          </label>
          <div className="compact-field">
            <span>Receive OTP by</span>
            <div className="auth-method-grid">
              <button
                type="button"
                className={`auth-method-card ${otpMethod === 'email' ? 'active' : ''}`}
                onClick={() => {
                  setOtpMethod('email')
                  setError('')
                  setMessage('')
                }}
              >
                <Mail size={24} />
                <strong>Email</strong>
                <span>Send the OTP to your registered email.</span>
              </button>
              <button
                type="button"
                className={`auth-method-card ${otpMethod === 'whatsapp' ? 'active' : ''}`}
                onClick={() => {
                  setOtpMethod('whatsapp')
                  setError('')
                  setMessage('')
                }}
              >
                <MessageSquareText size={24} />
                <strong>WhatsApp</strong>
                <span>Send the OTP to your registered phone number.</span>
              </button>
            </div>
          </div>
          {error && <div className="alert-error">{error}</div>}
          <button type="submit" className="primary-button portal-login-button" disabled={sendingOtp}>
            {sendingOtp ? 'Sending...' : 'Get OTP'}
          </button>
        </form>
      ) : (
        <form className="stack-form" onSubmit={verifyOtp}>
          <div className="requirement-box">
            A 6-digit OTP has been sent to {otpMethod === 'email' ? email : phone}. Check your {otpMethod === 'email' ? 'inbox or spam folder' : 'WhatsApp messages'}.
          </div>
          <label className="compact-field">
            <span>Enter 6-digit OTP</span>
            <OtpInput value={otp} onChange={setOtp} />
          </label>
          {message && <div className="alert-success">{message}</div>}
          {error && <div className="alert-error">{error}</div>}
          <div className="resend-otp-text">
            Didn't receive it?{' '}
            <button type="button" onClick={requestOtp} disabled={sendingOtp}>
              {sendingOtp ? 'Sending...' : 'Resend OTP'}
            </button>
          </div>
          <button type="submit" className="primary-button portal-login-button"><CheckCircle2 size={20} /> Verify OTP</button>
          <button type="button" className="create-account-button" onClick={() => setStep('email')}>
            <ArrowLeft size={20} />
            Change {otpMethod === 'email' ? 'Email' : 'WhatsApp'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const [form, setForm] = useState({
    method: params.get('method') || 'email',
    email: params.get('email') || '',
    phone_number: params.get('phone_number') || '',
    otp: params.get('otp') || '',
    password: '',
    confirm_password: '',
  })
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      await apiRequest('/auth/reset-password/submit/', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setMessage('Password reset successful. Redirecting to login...')
      window.setTimeout(() => navigate('/login'), 900)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <AuthShell
      badge="Account Recovery"
      title="Reset your password"
      subtitle="Enter your registered email, choose how to receive the OTP, then create a new password after verification."
    >
      <div className="steps-row progress-steps">
        <span className="done">Email</span>
        <span className="done">OTP</span>
        <span className="active">Password</span>
      </div>
      <form className="stack-form" onSubmit={submit}>
        <label className="compact-field">
          <span><KeyRound size={16} /> New Password</span>
          <input type="password" value={form.password} onChange={(event) => update('password', event.target.value)} required minLength={8} />
        </label>
        <label className="compact-field">
          <span>Confirm New Password</span>
          <input type="password" value={form.confirm_password} onChange={(event) => update('confirm_password', event.target.value)} required minLength={8} />
        </label>
        {error && <div className="alert-error">{error}</div>}
        {message && <div className="alert-success">{message}</div>}
        <button type="submit" className="primary-button portal-login-button">Reset Password</button>
      </form>
    </AuthShell>
  )
}
