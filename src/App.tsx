import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { ProtectedRoute, RoleRedirect } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { ModuleTestList } from './pages/teacher/ModuleTestList'
import { TestBuilder } from './pages/teacher/TestBuilder'
import { AssignTest } from './pages/teacher/AssignTest'
import { TeacherResults } from './pages/teacher/TeacherResults'
import { UserManagement } from './pages/admin/UserManagement'
import { ClassManagement } from './pages/admin/ClassManagement'
import { MyTests } from './pages/student/MyTests'
import { ComingSoon } from './pages/student/ComingSoon'
import { StudentResults } from './pages/student/Results'
import { ReadingPlayer } from './pages/player/ReadingPlayer'
import { ChangePassword } from './pages/ChangePassword'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<RoleRedirect />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/change-password" element={<ChangePassword />} />
            </Route>

            <Route element={<ProtectedRoute roles={['admin', 'teacher']} />}>
              <Route element={<Layout />}>
                <Route path="/tests" element={<Navigate to="/tests/reading" replace />} />
                <Route path="/tests/:module" element={<ModuleTestList />} />
                <Route path="/tests/:testId/edit" element={<TestBuilder />} />
                <Route path="/tests/:testId/assign" element={<AssignTest />} />
                <Route path="/tests/:testId/results" element={<TeacherResults />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route element={<Layout />}>
                <Route path="/admin/users" element={<UserManagement />} />
                <Route path="/admin/classes" element={<ClassManagement />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute roles={['student']} />}>
              <Route element={<Layout />}>
                <Route path="/my-tests" element={<Navigate to="/my-tests/reading" replace />} />
                <Route path="/my-tests/reading" element={<MyTests />} />
                <Route path="/my-tests/writing" element={<ComingSoon />} />
                <Route path="/my-tests/listening" element={<ComingSoon />} />
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
