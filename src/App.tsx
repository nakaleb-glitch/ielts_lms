import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute, RoleRedirect } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { TestList } from './pages/teacher/TestList'
import { TestBuilder } from './pages/teacher/TestBuilder'
import { AssignTest } from './pages/teacher/AssignTest'
import { TeacherResults } from './pages/teacher/TeacherResults'
import { MyTests } from './pages/student/MyTests'
import { StudentResults } from './pages/student/Results'
import { ReadingPlayer } from './pages/player/ReadingPlayer'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RoleRedirect />} />

            <Route element={<ProtectedRoute roles={['admin', 'teacher']} />}>
              <Route element={<Layout />}>
                <Route path="/tests" element={<TestList />} />
                <Route path="/tests/:testId/edit" element={<TestBuilder />} />
                <Route path="/tests/:testId/assign" element={<AssignTest />} />
                <Route path="/tests/:testId/results" element={<TeacherResults />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute roles={['student']} />}>
              <Route element={<Layout />}>
                <Route path="/my-tests" element={<MyTests />} />
                <Route path="/results/:sessionId" element={<StudentResults />} />
              </Route>
              <Route path="/player/:sessionId" element={<ReadingPlayer />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
