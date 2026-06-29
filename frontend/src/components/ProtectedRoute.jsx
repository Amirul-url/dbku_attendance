import { Navigate } from 'react-router-dom'
import { useAuth } from '../state/AuthContext.jsx'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="screen-center">Loading</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
