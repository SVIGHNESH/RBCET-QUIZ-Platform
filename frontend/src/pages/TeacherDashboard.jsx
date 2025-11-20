import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import TeacherQuizPage from './TeacherQuizPage';
import { useNavigationBlock } from '../hooks/useNavigationBlock';
import {
    LayoutDashboard, Users, FileText, Settings, LogOut, CheckCircle, Clock, Save, UserCheck,
    UploadCloud, Edit, Trash2, Plus, X, List, AlertTriangle, MessageSquare, BookOpen, Clock2, Award, Key, Minus, Info, RefreshCw, Calendar, Search, Maximize2, ChevronRight, Eye
} from 'lucide-react';

// ===================================
// 📢 TOAST SYSTEM
// ===================================

const useToast = () => {
    return useMemo(() => ({
        success: (message) => console.log(`[TOAST SUCCESS]: ${message}`),
        error: (message) => console.error(`[TOAST ERROR]: ${message}`),
    }), []);
};

// ===================================
// API UTILITIES 
// ===================================

const API_BASE_URL = 'http://localhost:8000';

class APIError extends Error {
    constructor(message, status, data) {
        super(message);
        this.status = status;
        this.data = data;
        this.name = 'APIError';
    }
}

async function fetchAPI(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = localStorage.getItem('access_token');

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token && !options.skipAuth) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new APIError(
                errorData.detail || `HTTP Error ${response.status}`,
                response.status,
                errorData
            );
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }

        return response;

    } catch (error) {
        if (error instanceof APIError) {
            throw error;
        }
        throw new APIError(error.message || 'Network connectivity error.', 0, {});
    }
}

const userAPI = {
    getCurrentUser: () => fetchAPI('/api/v1/auth/me'),
    getAllUsers: () => fetchAPI('/api/v1/users/?role=student'),
    changePassword: (newPassword) => fetchAPI('/api/v1/users/change-password', {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
    }),
    createUser: (userData) => fetchAPI('/api/v1/users/', {
        method: 'POST',
        body: JSON.stringify(userData),
    }),
};

const quizAPI = {
    getAllQuizzes: () => fetchAPI('/api/v1/quizzes/'),
    createQuiz: (quizData) => fetchAPI('/api/v1/quizzes/', {
        method: 'POST',
        body: JSON.stringify(quizData),
    }),
};

const analyticsAPI = {
    getTeacherStats: (teacherId) => fetchAPI(`/api/v1/analytics/teacher/${teacherId}/stats`),
    getStudentStats: (studentId) => fetchAPI(`/api/v1/analytics/student/${studentId}/stats`),
};

const useAuth = () => {
    return useMemo(() => ({
        logout: () => {
            localStorage.removeItem('access_token');
            window.location.href = '/';
        },
    }), []);
};

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000;
const WARNING_DURATION_MS = 60 * 1000;

// ===================================
// COMPONENT DEFINITIONS
// ===================================

const TeacherStatCard = ({ title, value, icon: IconComponent, color, subtitle, trend }) => {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 transition duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between">
                <div className={`p-3 rounded-full ${color}`}>
                    {IconComponent && <IconComponent size={24} />}
                </div>
                <div className="text-sm font-medium text-gray-500">{title}</div>
            </div>
            <div className="mt-4 flex items-end justify-between">
                <div className="text-4xl font-bold text-gray-900">{value}</div>
                <div className={`flex items-center text-sm font-semibold text-gray-500`}>
                    {trend}
                </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
        </div>
    );
};

// --- NEW COMPONENT: Student Progress Tracker ---
const StudentProgressTracker = () => {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const { error } = useToast();
    const [showStudentModal, setShowStudentModal] = useState(false);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentProgress, setStudentProgress] = useState(null);
    const [loadingProgress, setLoadingProgress] = useState(false);

    useEffect(() => {
        const fetchStudentData = async () => {
            setLoading(true);
            try {
                // Fetch users directly from backend
                const response = await userAPI.getAllUsers();
                // Filter ensuring only students are shown
                const studentList = response.filter(u => (u.role || '').toLowerCase() === 'student');
                setStudents(studentList);
            } catch (err) {
                console.error(err);
                error("Failed to fetch student progress data");
            } finally {
                setLoading(false);
            }
        };

        fetchStudentData();
    }, [error]);

    const filteredStudents = students.filter(student => {
        const term = searchTerm.toLowerCase();
        return (
            (student.first_name?.toLowerCase() || '').includes(term) ||
            (student.last_name?.toLowerCase() || '').includes(term) ||
            (student.student_id?.toLowerCase() || '').includes(term) ||
            (student.department?.toLowerCase() || '').includes(term) ||
            (student.class_year?.toLowerCase() || '').includes(term)
        );
    });

    // Fetch and display individual student progress in a modal
    const viewStudent = async (student) => {
        setSelectedStudent(student);
        setShowStudentModal(true);
        await fetchStudentProgress(student.id);
    };

    const fetchStudentProgress = async (studentId) => {
        setLoadingProgress(true);
        try {
            const stats = await analyticsAPI.getStudentStats(studentId);
            setStudentProgress(stats || null);
        } catch (err) {
            console.error('Failed to fetch student progress:', err);
            error('Failed to load student progress.');
            setStudentProgress(null);
        } finally {
            setLoadingProgress(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Student Progress Tracker</h2>
                    <p className="text-sm text-gray-500 mt-1">Monitor student performance and course details.</p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full md:w-72">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search size={18} className="text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search ID, Name, Course..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Year</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                                <th scope="col" className="relative px-6 py-3">
                                    <span className="sr-only">View</span>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredStudents.length > 0 ? (
                                filteredStudents.map((student) => (
                                    <tr key={student.id} className="hover:bg-blue-50 transition duration-150">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 font-mono">
                                                {student.student_id || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                                                    {student.first_name?.[0]}{student.last_name?.[0]}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {student.first_name} {student.last_name}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {student.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {student.class_year || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {student.department || 'General'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => viewStudent(student)}
                                                className="text-indigo-600 hover:text-indigo-900 flex items-center justify-end gap-1 hover:underline"
                                            >
                                                View <Eye size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-10 text-center text-gray-500">
                                        No students found matching your search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {showStudentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
                        <div className="flex items-start justify-between">
                            <h3 className="text-xl font-bold">Student Progress Report</h3>
                            <button onClick={() => setShowStudentModal(false)} className="text-gray-500 hover:text-gray-800">Close</button>
                        </div>
                        <div className="mt-4">
                            {loadingProgress ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div>
                                </div>
                            ) : studentProgress ? (
                                <div className="space-y-3 text-sm text-gray-700">
                                    <p><strong>Name:</strong> {selectedStudent?.first_name} {selectedStudent?.last_name}</p>
                                    <p><strong>Student ID:</strong> {selectedStudent?.student_id}</p>
                                    <p><strong>Total quizzes attempted:</strong> {studentProgress.total_quizzes_attempted ?? '-'}</p>
                                    <p><strong>Quizzes completed:</strong> {studentProgress.quizzes_completed ?? '-'}</p>
                                    <p><strong>Average score:</strong> {studentProgress.average_score ?? '-'} ({studentProgress.average_percentage ?? '-'}%)</p>
                                    <p><strong>Highest score:</strong> {studentProgress.highest_score ?? '-'}</p>
                                    <p><strong>Lowest score:</strong> {studentProgress.lowest_score ?? '-'}</p>
                                    <p><strong>Last attempt:</strong> {studentProgress.last_attempt ? new Date(studentProgress.last_attempt).toLocaleString() : '-'}</p>
                                    <p><strong>Pending quizzes:</strong> {studentProgress.pending_quizzes ?? '-'}</p>
                                </div>
                            ) : (
                                <p className="text-gray-500">No progress data available for this student.</p>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end">
                            <button onClick={() => setShowStudentModal(false)} className="px-4 py-2 bg-gray-200 rounded">Close</button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

// --- NEW COMPONENT: Teacher Quiz History ---
const TeacherQuizHistory = ({ createdQuizzes }) => {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <h2 className="text-xl font-bold text-gray-800 mb-6">My Quiz History</h2>
            {(!createdQuizzes || createdQuizzes.length === 0) ? (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                    <List size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">You haven't created any quizzes yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {createdQuizzes.map((quiz) => (
                        <div key={quiz.id} className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-white border border-gray-200 rounded-xl hover:shadow-md transition hover:border-blue-300">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg">{quiz.title}</h3>
                                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                                        <span className="flex items-center gap-1"><BookOpen size={14} /> {quiz.subject || 'General'}</span>
                                        <span className="flex items-center gap-1"><Clock size={14} /> {quiz.duration_minutes} mins</span>
                                        <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(quiz.created_at || Date.now()).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 md:mt-0 flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${quiz.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                    {quiz.is_active ? 'Active' : 'Draft'}
                                </span>
                                <button className="p-2 text-gray-400 hover:text-blue-600 transition rounded-full hover:bg-blue-50">
                                    <Edit size={18} />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-red-600 transition rounded-full hover:bg-red-50">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}



        </div>
    );
};

// --- NEW COMPONENT: Teacher Settings Tool ---
const TeacherSettingsTool = ({ currentUser }) => {
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const { success, error } = useToast();

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            error("New passwords do not match");
            return;
        }
        try {
            await userAPI.changePassword(passwords.new);
            success("Password updated successfully");
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (err) {
            console.error('Failed to update password:', err);
            error("Failed to update password");
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <UserCheck className="text-blue-600" /> Profile Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-500">Full Name</label>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{currentUser?.first_name} {currentUser?.last_name}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500">Email Address</label>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{currentUser?.email}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500">Role</label>
                        <p className="mt-1 text-lg font-semibold text-gray-900 capitalize">{currentUser?.role}</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-500">Department</label>
                        <p className="mt-1 text-lg font-semibold text-gray-900">{currentUser?.department || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Key className="text-orange-500" /> Security Settings
                </h2>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                        <input
                            type="password"
                            value={passwords.new}
                            onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Enter new password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                        <input
                            type="password"
                            value={passwords.confirm}
                            onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Confirm new password"
                        />
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                            Update Password
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// TeacherQuizPage component is imported from `./TeacherQuizPage` file above

// ===================================
// MAIN APP COMPONENT
// ===================================

const TeacherDashboardApp = () => {
    const { logout } = useAuth();
    const { error } = useToast();

    // Block browser back/forward navigation
    useNavigationBlock();

    const [currentUser, setCurrentUser] = useState(null);
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [createdQuizzes, setCreatedQuizzes] = useState([]);
    const [teacherStats, setTeacherStats] = useState(null);

    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [showSessionWarning, setShowSessionWarning] = useState(false);
    const [sessionCountdown, setSessionCountdown] = useState(Math.floor(WARNING_DURATION_MS / 1000));
    const inactivityTimerRef = useRef(null);
    const logoutTimerRef = useRef(null);
    const countdownIntervalRef = useRef(null);

    const resetInactivityTimers = useCallback(() => {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

        setShowSessionWarning(false);
        setSessionCountdown(Math.floor(WARNING_DURATION_MS / 1000));

        inactivityTimerRef.current = setTimeout(() => {
            setShowSessionWarning(true);
            setSessionCountdown(Math.floor(WARNING_DURATION_MS / 1000));

            countdownIntervalRef.current = setInterval(() => {
                setSessionCountdown((prev) => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current);
                        logout();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            logoutTimerRef.current = setTimeout(() => {
                logout();
            }, WARNING_DURATION_MS);
        }, INACTIVITY_LIMIT_MS - WARNING_DURATION_MS);
    }, [logout]);

    const fetchCurrentUser = useCallback(async () => {
        setIsLoading(true);
        try {
            const user = await userAPI.getCurrentUser();
            if (user && user.id && (user.role || '').toLowerCase() === 'teacher') {
                setCurrentUser(user);
                return user;
            } else {
                throw new Error("Invalid or non-teacher user data received.");
            }
        } catch (err) {
            console.error("Failed to fetch current user:", err);
            if (err instanceof APIError && (err.status === 401 || err.status === 403)) {
                error('Session expired or unauthorized. Redirecting to login.');
                logout();
            } else {
                error('Failed to load user data. Please reload or contact admin.');
            }
            return null;
        }
    }, [error, logout]);

    const fetchDashboardData = useCallback(async (user) => {
        if (!user || (user.role || '').toLowerCase() !== 'teacher') {
            setIsLoading(false);
            return;
        }

        try {
            const studentsData = await userAPI.getAllUsers();
            const studentUsers = studentsData.filter(u => (u.role || '').toLowerCase() === 'student');
            setStudents(studentUsers || []);

            const quizzesData = await quizAPI.getAllQuizzes();
            const authoredQuizzes = quizzesData.filter(q => q.author_id === user.id);
            setCreatedQuizzes(authoredQuizzes || []);

            const stats = await analyticsAPI.getTeacherStats(user.id);
            setTeacherStats(stats || null);

        } catch (err) {
            console.error("API Fetch Error (Dashboard Data):", err);
            setStudents([]);
            setCreatedQuizzes([]);
            setTeacherStats(null);
            error('Failed to load dashboard data from API.');
        }
    }, [error]);

    useEffect(() => {
        if (!currentUser) return;

        resetInactivityTimers();

        const activities = ['mousemove', 'keydown', 'click', 'touchstart'];
        activities.forEach(activity => {
            window.addEventListener(activity, resetInactivityTimers);
        });

        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

            activities.forEach(activity => {
                window.removeEventListener(activity, resetInactivityTimers);
            });
        };
    }, [currentUser, resetInactivityTimers]);

    useEffect(() => {
        fetchCurrentUser().then(user => {
            if (user) {
                fetchDashboardData(user).then(() => {
                    setIsLoading(false);
                });
            } else {
                setIsLoading(false);
            }
        });
    }, [fetchCurrentUser, fetchDashboardData]);

    const confirmLogout = () => {
        setShowLogoutConfirm(false);
        logout();
    };

    const cancelLogout = () => {
        setShowLogoutConfirm(false);
    };

    const handleLogout = () => {
        setShowLogoutConfirm(true);
    };

    const dynamicStats = useMemo(() => {
        const totalQuizzes = teacherStats?.total_quizzes_created ?? createdQuizzes.length;
        const totalStudents = teacherStats?.students_attempted ?? students.length;
        const avgScore = teacherStats?.average_quiz_score ?? 0;
        const activeQuizzes = teacherStats?.active_quizzes ?? 0;

        return [
            {
                title: "Quizzes Created",
                value: totalQuizzes.toString(),
                icon: FileText,
                color: "bg-blue-100/50 text-blue-800",
                subtitle: "Total quizzes authored by you",
                trend: "N/A"
            },
            {
                title: "Students Attempted",
                value: totalStudents.toString(),
                icon: UserCheck,
                color: "bg-indigo-100/50 text-indigo-800",
                subtitle: `${totalStudents} students completed quizzes`,
                trend: "N/A"
            },
            {
                title: "Avg. Quiz Score",
                value: `${avgScore.toFixed(1)}%`,
                icon: Award,
                color: "bg-green-100/50 text-green-800",
                subtitle: "Average quiz performance",
                trend: "N/A"
            },
            {
                title: "Active Quizzes",
                value: activeQuizzes.toString(),
                icon: Clock,
                color: "bg-yellow-100/50 text-yellow-800",
                subtitle: "Quizzes currently open for students",
                trend: "N/A"
            },
        ];
    }, [teacherStats, students, createdQuizzes]);

    const navItems = [
        { name: "Dashboard", icon: LayoutDashboard, title: "Teacher Dashboard" },
        { name: "Quiz Builder", icon: Edit, title: "New Quiz Builder" },
        { name: "Quiz History", icon: List, title: "My Quiz History" },
        { name: "Progress Tracker", icon: Users, title: "Student Progress" },
        { name: "Settings", icon: Settings, title: "My Profile" },
    ];

    const getCurrentTitle = () => {
        const currentItem = navItems.find(item => item.name === activeTab);
        return currentItem ? currentItem.title : activeTab;
    }

    const renderContent = () => {
        if (isLoading || !currentUser) {
            return (
                <div className="text-center py-20 bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-6 text-xl text-gray-500">Loading Teacher Dashboard Data...</p>
                </div>
            );
        }

        switch (activeTab) {
            case 'Dashboard':
                return (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {dynamicStats.map((stat) => (
                                <TeacherStatCard key={stat.title} {...stat} />
                            ))}
                        </div>

                        <div className="bg-blue-600/90 text-white p-6 rounded-2xl shadow-xl border border-blue-700 cursor-pointer" onClick={() => setActiveTab('Quiz Builder')}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-xl font-bold">Launch Quiz Builder</h3>
                                    <p className="text-blue-200 text-sm mt-1">Create a new MCQ quiz or generate questions from a document.</p>
                                </div>
                                <div className="p-3 bg-white/20 rounded-full">
                                    <Edit size={24} />
                                </div>
                            </div>
                            <div className="mt-5 w-full bg-white text-blue-800 py-3 rounded-xl text-center font-semibold transition shadow-lg text-lg">
                                Create New Quiz
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 border-b pb-4 mb-4">
                                My Recent Quizzes ({createdQuizzes.length})
                            </h2>
                            <div className="space-y-3">
                                {createdQuizzes.length > 0 ? (
                                    createdQuizzes.slice(-3).map((quiz) => (
                                        <div key={quiz.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                                            <p className="font-semibold text-gray-800">{quiz.title}</p>
                                            <span className="text-sm text-gray-500">Target: {quiz.assigned_class_year} / {quiz.assigned_department}</span>
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">{quiz.status}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-500 text-lg">
                                        No quizzes created yet. Use the Quiz Builder to start.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'Quiz Builder':
                return <TeacherQuizPage initialCreatorId={currentUser?.id} />;
            case 'Quiz History':
                return <TeacherQuizHistory createdQuizzes={createdQuizzes} />;
            case 'Progress Tracker':
                return <StudentProgressTracker />;
            case 'Settings':
                return <TeacherSettingsTool currentUser={currentUser} />;
            default:
                return <div className="bg-white p-12 rounded-2xl shadow-lg border border-gray-100 text-center text-gray-500 h-96 flex items-center justify-center">
                    <p className="text-2xl font-medium max-w-lg">Page Not Found</p>
                </div>;
        }
    };

    const avatarInitials = (currentUser ? ((currentUser?.first_name?.[0] || '') + (currentUser?.last_name?.[0] || '')) : 'T');

    return (
        <div className="min-h-screen flex bg-gray-50 font-inter">
            <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 bg-white border-r shadow-lg z-20">
                <div className="p-6 text-2xl font-extrabold text-blue-700 border-b">
                    MacQuiz <span className="text-gray-400 font-light">| Techer</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.name;
                        return (
                            <button
                                key={item.name}
                                onClick={() => setActiveTab(item.name)}
                                className={`w-full flex items-center p-3 rounded-xl transition duration-150 text-left space-x-3
                                    ${isActive
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-blue-600'
                                    }`}
                            >
                                <item.icon size={20} />
                                <span className="font-medium">{item.title}</span>
                            </button>
                        );
                    })}
                </nav>
                <div className="p-4 border-t">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center p-3 rounded-xl transition duration-150 text-red-500 hover:bg-red-50"
                    >
                        <LogOut size={20} className="mr-3" />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 lg:ml-64 p-4 md:p-8">
                <header className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900">{getCurrentTitle()}</h1>
                        <p className="text-gray-500 mt-1">
                            {activeTab === 'Dashboard' ? `Welcome back, ${currentUser?.first_name || 'Teacher'}. Track student performance.` : "Manage your academic content and records."}
                        </p>
                    </div>

                    <div className="flex flex-col items-end space-y-1">
                        <div className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center text-white font-bold text-xl shadow-md cursor-pointer hover:ring-4 ring-green-300 transition duration-150">
                            {avatarInitials || 'T'}
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{currentUser?.first_name} {currentUser?.last_name}</p>
                        <p className="text-xs text-gray-500">Teacher ID: {currentUser?.id || 'N/A'}</p>
                    </div>
                </header>

                {renderContent()}

                {showLogoutConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm">
                            <h3 className="text-lg font-bold text-gray-800 mb-4">Confirm Logout</h3>
                            <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
                            <div className="flex gap-3 justify-end">
                                <button onClick={cancelLogout} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400">
                                    Cancel
                                </button>
                                <button onClick={confirmLogout} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {showSessionWarning && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm">
                            <h3 className="text-lg font-bold text-orange-600 mb-4">⏰ Session Inactivity Warning</h3>
                            <p className="text-gray-600 mb-4">Your session will expire in <span className="font-bold text-red-600">{sessionCountdown}s</span> due to inactivity.</p>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => { setShowSessionWarning(false); resetInactivityTimers(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                                    Stay Logged In
                                </button>
                                <button onClick={logout} className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500">
                                    Logout Now
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

const AppWrapper = () => (
    <TeacherDashboardApp />
);

export default AppWrapper;