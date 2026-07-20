import { useState } from 'react'
import { CalendarCheck2, Eye, EyeOff, LockKeyhole, LogIn, ShieldCheck, User, UserPlus, UsersRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

function friendlyLoginError(error) {
  const message = String(error?.message || '').toLowerCase()
  if (message.includes('no active account') || message.includes('token') || message.includes('credentials')) {
    return 'The Staff ID or password you entered is incorrect.'
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return 'Cannot connect to the server right now. Please check that the backend is running.'
  }
  return 'Unable to sign in. Please check your details and try again.'
}

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSubmitting) return
    setFieldErrors({})
    const cleanUsername = username.trim()
    const nextErrors = {}
    if (!cleanUsername && !password) {
      nextErrors.username = 'Staff ID is required.'
      nextErrors.password = 'Password is required.'
      setFieldErrors(nextErrors)
      return
    }
    if (!cleanUsername) {
      nextErrors.username = 'Staff ID is required.'
      setFieldErrors(nextErrors)
      return
    }
    if (!password) {
      nextErrors.password = 'Password is required.'
      setFieldErrors(nextErrors)
      return
    }
    try {
      setIsSubmitting(true)
      await login(cleanUsername, password)
      navigate('/dashboard')
    } catch (err) {
      const friendlyMessage = friendlyLoginError(err)
      if (friendlyMessage.includes('server')) {
        setFieldErrors({ form: friendlyMessage })
      } else {
        setFieldErrors({ credentials: friendlyMessage })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-workspace">
        <div className="login-intro">
          <div className="portal-brand">
            <div className="portal-mark">
              <img src="/logo.png" alt="DBKU crest" />
            </div>
            <div>
              <h1>Attendance Management System</h1>
            </div>
          </div>

          <div className="login-metrics" aria-label="Portal coverage">
            <div className="login-metric">
              <CalendarCheck2 size={20} />
              <div>
                <strong>Events</strong>
                <span>Daily attendance tracking</span>
              </div>
            </div>
            <div className="login-metric">
              <UsersRound size={20} />
              <div>
                <strong>Staff & Visitors</strong>
                <span>Centralized records</span>
              </div>
            </div>
            <div className="login-metric">
              <ShieldCheck size={20} />
              <div>
                <strong>Protected Access</strong>
                <span>Role-based dashboard</span>
              </div>
            </div>
          </div>
        </div>

        <form className="login-card portal-login-card" onSubmit={handleSubmit}>
          <div className="login-form-header login-main-header">
            <h2>Welcome Back</h2>
          </div>

          <div className="login-form-body">
            <label className={`portal-field ${fieldErrors.username || fieldErrors.credentials ? 'has-error' : ''}`}>
              <span className="field-label">
                <span className="field-icon"><User size={16} /></span>
                Staff ID
              </span>
              <input
                value={username}
                placeholder="e.g. DBKU0001"
                aria-invalid={fieldErrors.username || fieldErrors.credentials ? 'true' : 'false'}
                onChange={(event) => {
                  setUsername(event.target.value)
                  if (fieldErrors.username || fieldErrors.credentials || fieldErrors.form) {
                    setFieldErrors((current) => ({ ...current, username: '', credentials: '', form: '' }))
                  }
                }}
              />
              {fieldErrors.username && <span className="field-error-message">{fieldErrors.username}</span>}
            </label>

            <label className={`portal-field ${fieldErrors.password || fieldErrors.credentials ? 'has-error' : ''}`}>
              <span className="field-label">
                <span className="field-icon"><LockKeyhole size={16} /></span>
                Password
              </span>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  placeholder="Enter your password"
                  aria-invalid={fieldErrors.password || fieldErrors.credentials ? 'true' : 'false'}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (fieldErrors.password || fieldErrors.credentials || fieldErrors.form) {
                      setFieldErrors((current) => ({ ...current, password: '', credentials: '', form: '' }))
                    }
                  }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
              {fieldErrors.password && <span className="field-error-message">{fieldErrors.password}</span>}
              {fieldErrors.credentials && (
                <span className="field-error-message login-credential-error">
                  {fieldErrors.credentials}{' '}
                  <Link to="/forgot-password">Forgot Password?</Link>
                </span>
              )}
            </label>

            {!fieldErrors.credentials && <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>}
            {fieldErrors.form && <div className="login-form-message" role="alert">{fieldErrors.form}</div>}

            <button type="submit" className="primary-button portal-login-button" disabled={isSubmitting}>
              <LogIn size={22} />
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>

            <div className="login-divider" />

            <button type="button" className="create-account-button" onClick={() => navigate('/register')}>
              <UserPlus size={22} />
              Create New Account
            </button>
          </div>
        </form>
      </div>

      <div className="login-footer">
        <div className="login-help">For access issues, contact Bahagian Teknologi Maklumat</div>
      </div>
    </div>
  )
}
