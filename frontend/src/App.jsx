import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Login from "./pages/login";
import Dashboard from "./pages/dashBoard";
import StudentDashboard from "./pages/studentDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teacher-dashboard"
              element={
                <ProtectedRoute>
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/student-dashboard"
              element={
                <ProtectedRoute>
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={
              <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
                  <p className="text-xl text-gray-600 mb-8">Page Not Found</p>
                  <a href="/" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                    Go Home
                  </a>
                </div>
              </div>
            } />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}