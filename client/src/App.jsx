import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { ProtectedRoute, RoleRoute } from './components/ProtectedRoute';

import Login from './pages/Login';
import Register from './pages/Register';
import CourseCatalog from './pages/CourseCatalog';
import CourseDetail from './pages/CourseDetail';
import LessonViewer from './pages/LessonViewer';
import QuizAttemptPage from './pages/QuizAttemptPage';
import StudentDashboard from './pages/StudentDashboard';
import TutorDashboard from './pages/TutorDashboard';
import TutorCourseEditor from './pages/TutorCourseEditor';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from './pages/NotFound';

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<CourseCatalog />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route
            path="/courses/:courseId/lessons/:lessonId"
            element={
              <ProtectedRoute>
                <LessonViewer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quizzes/:id"
            element={
              <ProtectedRoute>
                <QuizAttemptPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RoleRoute role="student">
                <StudentDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/tutor"
            element={
              <RoleRoute roles={['tutor', 'admin']}>
                <TutorDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/tutor/courses/new"
            element={
              <RoleRoute roles={['tutor', 'admin']}>
                <TutorCourseEditor />
              </RoleRoute>
            }
          />
          <Route
            path="/tutor/courses/:id"
            element={
              <RoleRoute roles={['tutor', 'admin']}>
                <TutorCourseEditor />
              </RoleRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <RoleRoute role="admin">
                <AdminDashboard />
              </RoleRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;
