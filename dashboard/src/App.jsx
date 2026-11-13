import { useState, useEffect } from 'react'
import Login from './Login'
import Dashboard from './Dashboard'
import { hasValidSession, logout } from './api'

export default function App() {
  const [authed, setAuthed] = useState(() => hasValidSession())

  const handleLogout = () => {
    logout()
    setAuthed(false)
  }

  return authed ? (
    <Dashboard onLogout={handleLogout} />
  ) : (
    <Login onAuth={() => setAuthed(true)} />
  )
}
