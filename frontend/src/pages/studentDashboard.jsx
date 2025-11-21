import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigationBlock } from '../hooks/useNavigationBlock';
import {
    BookOpen, Trophy, Clock, LogOut, User, TrendingUp, Key,
    CheckCircle, XCircle, Award, BarChart3, FileText, Mail, ChevronDown, ChevronUp,
    PlayCircle, AlertCircle, ChevronLeft, ChevronRight, Send, X, List, UserCheck, AlertTriangle, Lightbulb, Info, Calendar, XOctagon // Added XOctagon for Expired
} from 'lucide-react';

// ===================================
// 📢 TOAST CONTEXT MOCK (Assumes external context is available via App.jsx)
// ===================================

const useToast = () => {
    // Mock implementation for demonstration purposes
    return useMemo(() => ({
        success: (message) => console.log(`[TOAST SUCCESS]: ${message}`),
        error: (message) => console.error(`[TOAST ERROR]: ${message}`),
    }), []);
};

// ===================================
// API UTILITIES & DATA STRUCTURES (API Dependent)
// ===================================

const API_BASE_URL = 'http://localhost:8000'; // Using localhost default base URL for this environment

// Session management defaults (milliseconds)
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_DURATION_MS = 60 * 1000; // 1 minute warning

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
        // --- API INTEGRATION POINT: RELYING ON BACKEND ---

        // This is the actual fetch call structure using the collected headers:
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
        // FIX: If actual fetch call fails (network error, localhost not running), throw APIError
        throw new APIError(error.message || 'Network connectivity error.', 0, {});
    }
}

// MOCK QUIZ CONTENT (Only used for QuizPage structure, not for fetching list)
const MOCK_QUIZ_Q103_DATA = [
    {
        id: 'SEC1',
        title: 'Section A: Mock Content Structure',
        questions: [
            { id: 'Q1', text: "Mock Question 1", marks: 4, negative_marks: 1.0, options: [{ text: "A", id: 'optA' }, { text: "B", id: 'optB' }, { text: "C", id: 'optC' }], correct_id: 'optB' },
        ]
    }
];

const quizAPI = {
    // Should return the array of quizzes from the backend
    getAllQuizzes: () => fetchAPI('/api/v1/quizzes/'),
    getQuizQuestions: () => MOCK_QUIZ_Q103_DATA // Structure placeholder
};

const attemptAPI = {
    getMyAttempts: () => fetchAPI('/api/v1/attempts/my-attempts'), // Should return attempts array
    startAttempt: (quizId) => fetchAPI('/api/v1/attempts/start', {
        method: 'POST',
        body: JSON.stringify({ quiz_id: quizId }),
    }),
    submitAttempt: (attemptId, answers) => fetchAPI('/api/v1/attempts/submit', {
        method: 'POST',
        body: JSON.stringify({ attempt_id: attemptId, answers }),
    }),
};

const userAPI = {
    getCurrentUser: () => fetchAPI('/api/v1/users/me'), // Should return the logged-in user object
};

// FIX: Define the useAuth hook here as a mock since the real context is external.
const useAuth = () => {
    return useMemo(() => ({
        logout: () => {
            console.log('Auth Logout: Clearing token and redirecting to /');
            localStorage.removeItem('access_token');
            window.location.href = '/';
        },
    }), []);
};


// ===================================
// QUIZ ATTEMPT INTERFACE & INTEGRITY CHECKS
// ===================================

const QuizPage = ({ quiz, onEndQuiz }) => {
    const { error, success } = useToast();
    const initialDuration = (quiz.duration || 30) * 60;
    const [currentTime, setCurrentTime] = useState(initialDuration);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [exitReason, setExitReason] = useState(null);

    const structuredQuestions = useMemo(() => quizAPI.getQuizQuestions(quiz.id), [quiz.id]);

    const allQuestions = useMemo(() => {
        let continuousIndex = 0;
        return structuredQuestions.flatMap(section =>
            section.questions.map(q => ({
                ...q,
                sectionId: section.id,
                sectionTitle: section.title,
                continuousIndex: continuousIndex++
            }))
        );
    }, [structuredQuestions]);

    const maxQuizScore = useMemo(() => {
        return allQuestions.reduce((sum, q) => sum + q.marks, 0);
    }, [allQuestions]);

    // 1. Strict Submit Function (Used by Timer, Manual Submit, and Integrity Check)
    const handleSubmitQuiz = useCallback(async (timedOut = false, integrityViolation = false) => {
        if (isSubmitting) return;

        if (!timedOut && !integrityViolation && !window.confirm("Do you want to submit the quiz? Once submitted, you cannot return.")) {
            return;
        }

        const reason = integrityViolation ? "INTEGRITY_VIOLATION" : (timedOut ? "TIME_OUT" : "MANUAL_SUBMIT");
        setExitReason(reason);
        setIsSubmitting(true);

        const finalAnswers = Object.entries(answers).map(([qId, ansId]) => ({
            question_id: qId,
            selected_option_id: ansId,
        }));

        try {
            // API CALL: Submit Attempt
            const response = await attemptAPI.submitAttempt(quiz.id, finalAnswers);

            const scoreMsg = `Score: ${response.score} / ${maxQuizScore.toFixed(1)}`;
            if (integrityViolation) {
                error(`Quiz submitted due to integrity breach (Exited Fullscreen or Tab Switched). ${scoreMsg}`);
            } else if (timedOut) {
                error(`Quiz automatically submitted. Time expired! ${scoreMsg}`);
            } else {
                success(`Quiz submitted! ${scoreMsg}`);
            }

            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen();
            }

            onEndQuiz();

        } catch (e) {
            error('Failed to submit quiz: ' + e.message);
        }
    }, [answers, quiz.id, maxQuizScore, success, error, onEndQuiz, isSubmitting]);


    // 2. Timer Logic (Auto-submit on timeout)
    useEffect(() => {
        if (currentTime <= 0) {
            if (!isSubmitting) {
                handleSubmitQuiz(true, false); // timedOut=true
            }
            return;
        }

        const timer = setInterval(() => {
            setCurrentTime(prevTime => prevTime - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [currentTime, isSubmitting, handleSubmitQuiz]);

    // 3. Fullscreen & Visibility Integrity Check (Auto-submit on exit or tab switch)
    useEffect(() => {
        const checkIntegrityAndSubmit = () => {
            // Check isSubmitting to prevent multiple submissions
            if (!isSubmitting) {
                console.log("Integrity violation detected: Fullscreen/Visibility state changed.");
                handleSubmitQuiz(false, true); // integrityViolation=true
            }
        };

        const handleFullscreenChange = () => {
            if (document.fullscreenElement === null) {
                checkIntegrityAndSubmit();
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                checkIntegrityAndSubmit();
            }
        };

        const element = document.documentElement;

        if (element.requestFullscreen) {
            element.requestFullscreen().catch(err => {
                error('Fullscreen access required to start the quiz. Exiting.');
                console.error('Initial Fullscreen attempt blocked:', err);
                onEndQuiz();
            });
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('msfullscreenchange', handleFullscreenChange);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('msfullscreenchange', handleFullscreenChange);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [handleSubmitQuiz, isSubmitting, onEndQuiz, error]);


    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    const handleAnswerSelect = (questionId, optionId) => {
        setAnswers(prevAnswers => ({
            ...prevAnswers,
            [questionId]: optionId,
        }));
    };

    const handleQuestionJump = (index) => {
        setCurrentQuestionIndex(index);
    };

    if (isSubmitting) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900/90 text-white">
                <div className="text-center p-8 bg-gray-800 rounded-xl shadow-2xl">
                    <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
                    <h2 className="text-xl font-semibold">
                        {exitReason === 'INTEGRITY_VIOLATION' ? "Integrity Violation Detected..." : "Submitting Quiz Automatically..."}
                    </h2>
                    <p className="mt-2 text-gray-400">Please wait, your attempt is being finalized and graded.</p>
                </div>
            </div>
        );
    }

    const currentQuestion = allQuestions[currentQuestionIndex];
    if (!currentQuestion) return null;

    const isFirst = currentQuestionIndex === 0;
    const isLast = currentQuestionIndex === allQuestions.length - 1;
    const selectedAnswerId = answers[currentQuestion.id];
    const answeredCount = Object.keys(answers).length;
    const currentSectionId = currentQuestion.sectionId;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">

            <header className="flex justify-between items-center bg-white p-4 shadow-xl border-b-4 border-blue-600 sticky top-0 z-10">
                <h1 className="text-2xl font-extrabold text-gray-900 flex items-center">
                    <BookOpen size={28} className="mr-3 text-blue-600" />
                    {quiz.title}
                </h1>
                <div className="p-2 rounded-xl font-mono text-xl font-extrabold flex items-center border-4 transition-all duration-300 bg-red-100 text-red-700 border-red-600">
                    <Clock size={24} className="mr-2" />
                    {formatTime(currentTime)}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto flex">

                {/* ⬅️ LEFT SIDEBAR: Unified Section/Palette */}
                <aside className="w-64 p-4 bg-white border-r shadow-lg hidden md:block space-y-4 overflow-y-auto">

                    <h2 className="text-xl font-bold text-gray-800 flex items-center border-b pb-3 mb-2">
                        <Info size={24} className="mr-2 text-indigo-600" /> Quiz Details
                    </h2>
                    <div className="text-xs space-y-1 p-2 border rounded-lg bg-indigo-50/50">
                        <p className="font-semibold text-gray-700">Subject: {quiz.subject_name} ({quiz.subject_id})</p>
                        <p className="text-gray-600">Assigned To: {quiz.assigned_class_year} ({quiz.assigned_department})</p>
                        {quiz.scheduled_start_time && (
                            <p className="text-gray-600 flex items-center">
                                <Calendar size={12} className="mr-1" /> Scheduled: {new Date(quiz.scheduled_start_time).toLocaleDateString()} at {new Date(quiz.scheduled_start_time).toLocaleTimeString()}
                            </p>
                        )}
                        {quiz.scheduled_end_time && (
                            <p className="text-red-600 flex items-center font-semibold">
                                <Clock size={12} className="mr-1" /> Ends: {new Date(quiz.scheduled_end_time).toLocaleDateString()} at {new Date(quiz.scheduled_end_time).toLocaleTimeString()}
                            </p>
                        )}
                    </div>


                    <h2 className="text-xl font-bold text-gray-800 flex items-center border-b pb-3 mb-2 pt-4">
                        <UserCheck size={24} className="mr-2 text-indigo-600" /> Exam Navigation
                    </h2>
                    {/* Unified Section Navigation and Question Palette */}
                    <div className="space-y-4">
                        {structuredQuestions.map((section) => (
                            <div
                                key={section.id}
                                className={`p-3 rounded-xl shadow-sm border ${section.id === currentSectionId ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-100'}`}
                            >
                                <h3 className="font-bold text-base text-gray-800 mb-2 border-b pb-2 flex items-center">
                                    <List size={16} className="mr-2 text-purple-600" /> {section.title}
                                </h3>

                                {/* Question Buttons Nested by Section */}
                                <div className="grid grid-cols-4 gap-3 pt-2">
                                    {allQuestions
                                        .filter(q => q.sectionId === section.id)
                                        .map((q) => (
                                            <button
                                                key={q.id}
                                                onClick={() => handleQuestionJump(q.continuousIndex)}
                                                className={`w-12 h-10 rounded-lg font-semibold text-sm transition duration-150 
                                                    ${q.continuousIndex === currentQuestionIndex
                                                        ? 'bg-blue-600 text-white ring-4 ring-blue-200 p-0.5 transform scale-105 shadow-md'
                                                        : answers[q.id]
                                                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                            >
                                                {/* Display continuous index */}
                                                {q.continuousIndex + 1}
                                            </button>
                                        ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-4 p-2 text-xs text-gray-500 border-t pt-4">
                        <p>Total Questions: {allQuestions.length}</p>
                        <p>Answered: {answeredCount}</p>
                    </div>

                </aside>

                {/* ➡️ MAIN CONTENT: Question & Navigation */}
                <main className="flex-1 p-4 sm:p-8">

                    <div className="max-w-4xl mx-auto space-y-6">

                        {/* Progress Bar & Section Info */}
                        <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
                            <div className="text-sm font-bold text-gray-700 mb-2 flex justify-between">
                                <span>Question {currentQuestionIndex + 1} of {allQuestions.length}</span>
                                <span className='text-purple-600 font-extrabold'>{currentQuestion.sectionTitle}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                                    style={{ width: `${((currentQuestionIndex + 1) / allQuestions.length) * 100}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Question Card */}
                        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-blue-100">

                            {/* Marking Details */}
                            <div className="mb-4 p-3 border-l-4 border-yellow-500 bg-yellow-50 text-sm font-semibold text-gray-700">
                                <p>Marks for Correct: {currentQuestion.marks.toFixed(1)}</p>
                                <p className="text-red-600">Negative Marking: -{currentQuestion.negative_marks.toFixed(2)}</p>
                            </div>

                            <p className="text-xl sm:text-2xl font-semibold text-gray-800 mb-6">{currentQuestion.text}</p>

                            {/* Options */}
                            <div className="space-y-4">
                                {currentQuestion.options.map((option, idx) => (
                                    <button
                                        key={option.id}
                                        onClick={() => handleAnswerSelect(currentQuestion.id, option.id)}
                                        className={`w-full text-left p-4 rounded-xl border-2 transition duration-150 flex items-center
                                            ${selectedAnswerId === option.id
                                                ? 'bg-blue-50 border-blue-600 ring-4 ring-blue-200 text-blue-800 font-semibold shadow-md'
                                                : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-700'
                                            }`}
                                    >
                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 font-mono text-sm ${selectedAnswerId === option.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                                            {String.fromCharCode(65 + idx)}
                                        </span>
                                        {option.text}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Navigation Buttons */}
                        <div className="flex justify-between pt-4">
                            <button
                                onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
                                disabled={isFirst || isSubmitting}
                                className={`flex items-center px-6 py-3 rounded-xl transition font-semibold ${isFirst ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'}`}
                            >
                                <ChevronLeft size={20} className="mr-2" /> Previous
                            </button>

                            {isLast ? (
                                <button
                                    onClick={() => handleSubmitQuiz(false)}
                                    disabled={isSubmitting}
                                    className="flex items-center px-8 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition shadow-lg disabled:bg-gray-400 font-semibold"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            Submit Quiz <Send size={20} className="ml-2" />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    onClick={() => setCurrentQuestionIndex(prev => Math.min(allQuestions.length - 1, prev + 1))}
                                    disabled={isSubmitting}
                                    className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg font-semibold"
                                >
                                    Next Question <ChevronRight size={20} className="ml-2" />
                                </button>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};


// ===================================
// PERFORMANCE CHART (CLUSTERED BAR CHART)
// ===================================

const PerformanceChart = ({ attempts }) => {

    const chartData = useMemo(() => {
        const completedAttempts = attempts
            .filter(a => a.status === 'Completed' && a.score !== null)
            // Sort by submission time to ensure we process attempts chronologically
            .sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));

        const groupedByDate = completedAttempts.reduce((acc, attempt) => {
            // Get date string (e.g., "11/13/2025") for grouping
            const date = new Date(attempt.submitted_at).toLocaleDateString();
            if (!acc[date]) {
                acc[date] = {
                    // Use a short label for the chart axis
                    dateLabel: new Date(attempt.submitted_at).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
                    dateKey: new Date(attempt.submitted_at).getTime(),
                    attempts: []
                };
            }
            acc[date].attempts.push({
                id: attempt.id,
                // Short label for the quiz name (e.g., DSB for Data Structures Basics)
                label: attempt.quiz_title.split(' ').map(w => w[0]).join(''),
                score: attempt.score || 0,
                maxScore: attempt.max_score || 100,
            });
            return acc;
        }, {});

        // Convert object to array, sort by date, and keep only the last 7 unique days
        const allDays = Object.values(groupedByDate).sort((a, b) => a.dateKey - b.dateKey);

        // Take the data for the last 7 unique days where attempts were made
        const last7DaysData = allDays.slice(-7);

        return last7DaysData;
    }, [attempts]);

    if (chartData.length < 2) {
        return <p className="p-4 text-center text-gray-500"><BarChart3 size={24} className="mx-auto mb-2" /> Complete at least 2 quiz days to view the clustered bar chart trend.</p>;
    }

    // --- SVG Drawing Calculations ---
    const numDays = chartData.length;
    const chartWidth = 100;
    const groupWidth = chartWidth / numDays; // Width allocated per day cluster (e.g., 100/7 = ~14.28%)
    const groupPadding = 2; // Padding on the left/right of the entire group (1% on each side)

    const drawGroups = chartData.map((dayGroup, dayIndex) => {
        const dayXStart = dayIndex * groupWidth;
        const numBarsInGroup = dayGroup.attempts.length;

        // Calculate bar width for this cluster
        const innerPadding = 0.5 * (numBarsInGroup - 1); // 0.5% spacing between bars
        const availableBarWidth = groupWidth - (groupPadding * 2); // 2% padding from group edges (1% left, 1% right)

        // Calculate the width for each bar inside the cluster
        const barWidth = Math.max(2, (availableBarWidth - innerPadding) / numBarsInGroup); // Ensure min width of 2%

        return {
            ...dayGroup,
            dayXCenter: dayXStart + (groupWidth / 2),
            attempts: dayGroup.attempts.map((attempt, barIndex) => {
                const scorePercent = (attempt.score / attempt.maxScore) * 100;
                const barHeight = scorePercent;
                const barY = 100 - barHeight; // SVG Y-axis is inverted (0 is top)

                // Calculate X position: Group Start + Left Padding + (Bar Index * (Bar Width + Spacing))
                const clusterStart = dayXStart + groupPadding;
                const barX = clusterStart + (barIndex * (barWidth + 0.5));

                return {
                    ...attempt,
                    barHeight: barHeight,
                    barY: barY,
                    barX: barX,
                    barWidth: barWidth,
                    color: scorePercent >= 80 ? '#10B981' : scorePercent >= 60 ? '#3B82F6' : '#EF4444' // Green, Blue, Red
                };
            })
        };
    });
    // --- End SVG Drawing Calculations ---


    return (
        <div className="bg-white p-6 rounded-2xl shadow-inner border border-gray-100">
            <h3 className="text-xl font-bold mb-1 text-gray-800 flex items-center">
                <TrendingUp size={24} className="mr-2 text-indigo-600" /> Performance Trend (Clustered Bar Chart)
            </h3>
            <p className="text-sm text-gray-500 mb-4">Data Source: Percentage Score of Last {numDays} Unique Days with Attempts</p>

            <div className="relative overflow-x-auto">
                <div className="h-64" style={{ minWidth: '100%' }}>

                    {/* viewBox adjusted to give vertical space for labels above 100% and below 0% line */}
                    <svg className="w-full h-full" viewBox="0 -10 100 120" preserveAspectRatio="none">

                        {/* Grid Lines */}
                        <line x1="0" y1="100" x2="100" y2="100" stroke="#E5E7EB" strokeWidth="0.5" /> {/* 0% */}
                        <line x1="0" y1="50" x2="100" y2="50" stroke="#E5E7EB" strokeWidth="0.5" />  {/* 50% */}
                        <line x1="0" y1="0" x2="100" y2="0" stroke="#E5E7EB" strokeWidth="0.5" />    {/* 100% */}

                        {/* Y-Axis Labels */}
                        <text x="-1" y="100" textAnchor="end" fontSize="2.5" fill="#6B7280">0%</text>
                        <text x="-1" y="50" textAnchor="end" fontSize="2.5" fill="#6B7280">50%</text>
                        <text x="-1" y="3" textAnchor="end" fontSize="2.5" fill="#6B7280">100%</text>

                        {/* Data Bars and Labels */}
                        {drawGroups.map((group, groupIndex) => (
                            <React.Fragment key={groupIndex}>

                                {/* Date Label (X-Axis Label) */}
                                <text
                                    x={`${group.dayXCenter}%`}
                                    y="108%"
                                    textAnchor="middle"
                                    fontSize="3"
                                    fill="#6B7280"
                                >
                                    {group.dateLabel}
                                </text>

                                {/* Render individual bars within the group */}
                                {group.attempts.map((p) => (
                                    <React.Fragment key={p.id}>
                                        {/* Bar */}
                                        <rect
                                            x={`${p.barX}%`}
                                            y={`${p.barY}%`}
                                            width={`${p.barWidth}%`}
                                            height={`${p.barHeight}%`}
                                            fill={p.color}
                                            rx="1"
                                            ry="1"
                                            className="transition-all duration-500 hover:opacity-90"
                                            title={`${p.label}: ${(p.score / p.maxScore * 100).toFixed(1)}%`}
                                        />

                                        {/* Score Label (Above bar) */}
                                        <text
                                            x={`${p.barX + (p.barWidth / 2)}%`}
                                            y={`${p.barY - 4}%`}
                                            textAnchor="middle"
                                            fontSize="2.5" // Smaller font for clarity in clusters
                                            fill="#1F2937"
                                            fontWeight="bold"
                                        >
                                            {p.label}
                                        </text>
                                    </React.Fragment>
                                ))}
                            </React.Fragment>
                        ))}
                    </svg>
                </div>
            </div>
            <div className="flex justify-around mt-4 text-xs text-gray-600 border-t pt-4">
                <span>Total days tracked: <span className="font-bold text-indigo-600">{chartData.length}</span></span>
                <span>Total attempts shown: <span className="font-bold text-indigo-600">{drawGroups.reduce((sum, g) => sum + g.attempts.length, 0)}</span></span>
            </div>
        </div>
    );
};


// ===================================
// PROFILE SETTINGS COMPONENT
// ===================================

const ProfileSettings = ({ currentUser }) => {
    const { success, error } = useToast();
    const [showPasswordForm, setShowPasswordForm] = useState(false); // Controls visibility
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChangePassword = (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (newPassword.length < 8) {
            error("Password must be at least 8 characters long.");
            setIsSubmitting(false);
            return;
        }

        if (newPassword !== confirmPassword) {
            error("New passwords do not match.");
            setIsSubmitting(false);
            return;
        }

        // Simulate API call delay
        setTimeout(() => {
            setIsSubmitting(false);
            setNewPassword('');
            setConfirmPassword('');
            setShowPasswordForm(false); // Hide form on success
            success("Password successfully updated! (Mock)");
        }, 1500);
    };

    return (
        <div className="space-y-8 max-w-4xl mx-auto">

            {/* User Information Card */}
            <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-100">
                <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-4 flex items-center">
                    <User size={28} className="mr-3 text-blue-600" /> Account Details
                </h2 >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-500 flex items-center">Name</label>
                        <p className="text-lg font-semibold text-gray-800">{currentUser?.first_name} {currentUser?.last_name}</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-500 flex items-center">Student ID</label>
                        <p className="text-lg font-semibold text-gray-800">{currentUser?.student_id || currentUser?.id}</p>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-500 mb-1 
                         items-center"><Mail size={16} className="mr-1" /> Email</label>
                        <p className="text-lg font-semibold text-gray-800">{currentUser?.email}</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-500 flex items-center">Class/Year</label>
                        <p className="text-lg font-semibold text-gray-800">{currentUser?.class_year}</p>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-500 flex items-center">Department</label>
                        <p className="text-lg font-semibold text-gray-800">{currentUser?.department}</p>
                    </div>
                </div>
            </div>

            {/* Password Management Section */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-red-100">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-4 flex items-center">
                    <Key size={24} className="mr-3 text-red-600" /> Security Settings
                </h2 >

                {/* Toggle Button to show/hide form */}
                <button
                    onClick={() => setShowPasswordForm(prev => !prev)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-red-50 text-red-700 font-semibold rounded-lg hover:bg-red-100 transition duration-150 border border-red-200"
                >
                    <span>Change Account Password</span>
                    {showPasswordForm ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>

                {/* Change Password Form (Conditional Visibility) */}
                {showPasswordForm && (
                    <div className="pt-6 border-t mt-4 border-gray-100">
                        <form onSubmit={handleChangePassword} className="space-y-4">

                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Update Your Password</h3>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="new-password">New Password (Min 8 Chars)</label>
                                <input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="confirm-password">Confirm New Password</label>
                                <input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition"
                                    disabled={isSubmitting}
                                    required
                                />
                            </div>

                            <div className='flex space-x-4'>
                                <button
                                    type="button"
                                    onClick={() => { setNewPassword(''); setConfirmPassword(''); setShowPasswordForm(false); }}
                                    className="w-1/3 flex items-center justify-center gap-2 px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-300 transition duration-150"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !newPassword || !confirmPassword}
                                    className="w-2/3 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl shadow-md hover:bg-indigo-700 transition duration-150 disabled:bg-gray-400"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                            Updating...
                                        </>
                                    ) : (
                                        <>
                                            <Key size={20} /> Update Password
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};


// ===================================
// REPORT MODAL & SUGGESTION LOGIC
// ===================================

/**
 * Generates mock improvement suggestions based on mock attempt data, prioritized 
 * by lowest score percentage first (Law of Suggestion principle).
 */
const generateImprovementSuggestions = (attempt) => {
    // Mock Data based on the provided quiz mock structure (Q101-Q105)
    const scorePercent = (attempt.score / attempt.max_score) * 100;
    const suggestions = [];

    // Logic: Identify weak mock subjects (lowest score) and suggest improvement.

    if (scorePercent < 60) {
        // Low score indicates foundational issues. Highest priority: foundation.
        suggestions.push({
            area: "Review Foundational Concepts",
            tip: "Start by thoroughly reviewing the core concepts of the entire syllabus. A strong foundation prevents small errors from compounding in high-stakes environments.",
            priority: 1,
            color: "bg-red-100 border-red-500 text-red-700"
        });
        suggestions.push({
            area: attempt.quiz_title + " Specifics",
            tip: "Immediately focus on the most difficult topics within this quiz. Concentrate on understanding why the incorrect answers were chosen.",
            priority: 2,
            color: "bg-yellow-100 border-yellow-500 text-yellow-700"
        });
        suggestions.push({
            area: "Strategic Practice",
            tip: "Engage in timed practice sessions specifically designed to mimic exam pressure and actively reinforce learned concepts.",
            priority: 3,
            color: "bg-gray-100 border-gray-400 text-gray-700"
        });
    } else if (scorePercent < 80) {
        // Medium score indicates precision/depth issues. Highest priority: precision/negatives.
        suggestions.push({
            area: "Conceptual Precision",
            tip: "You possess a solid base. Your errors likely stem from minor conceptual gaps or misinterpretation of tricky questions. Practice similar questions with close options to improve analytical precision.",
            priority: 1,
            color: "bg-yellow-100 border-yellow-500 text-yellow-700"
        });
        suggestions.push({
            area: "Eliminate Negative Marking Errors",
            tip: "Focus intensely on problems carrying negative marks. Slow down when making choices in these areas to confirm your selection before marking it.",
            priority: 2,
            color: "bg-indigo-100 border-indigo-500 text-indigo-700"
        });
        suggestions.push({
            area: "Knowledge Consolidation",
            tip: "Review your notes for complex topics, ensuring you can explain the core theory without relying on external resources.",
            priority: 3,
            color: "bg-gray-100 border-gray-400 text-gray-700"
        });
    } else {
        // High Score indicates mastery. Highest priority: speed and minor gaps.
        suggestions.push({
            area: "Achieving Perfect Mastery",
            tip: "Outstanding result! To aim for a perfect score, focus on eliminating the final few, subtle conceptual blind spots. Analyze your one or two incorrect answers deeply.",
            priority: 1,
            color: "bg-green-100 border-green-500 text-green-700"
        });
        suggestions.push({
            area: "Time Efficiency & Speed",
            tip: "Practice speed drills for easy-to-medium questions. This builds confidence and frees up crucial time for approaching the most challenging problems.",
            priority: 2,
            color: "bg-indigo-100 border-indigo-500 text-indigo-700"
        });
    }

    // Sort by priority (Lowest number first)
    return suggestions.sort((a, b) => a.priority - b.priority);
};

const ReportModal = ({ attempt, onClose }) => {
    const suggestions = useMemo(() => generateImprovementSuggestions(attempt), [attempt]);

    return (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl transform transition-all scale-100">
                <header className="p-6 border-b bg-blue-600 text-white rounded-t-3xl flex justify-between items-center">
                    <h2 className="text-2xl font-bold flex items-center">
                        <BarChart3 size={24} className="mr-3" /> Quiz Performance Report
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/20 transition"
                        title="Close Report"
                    >
                        <X size={24} />
                    </button>
                </header>

                <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">

                    {/* Summary */}
                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border-l-4 border-blue-500">
                        <div>
                            <p className="text-sm text-gray-600">Quiz Title / Date</p>
                            <h3 className="text-xl font-bold text-gray-800">{attempt.quiz_title}</h3>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-gray-600">Final Score</p>
                            <h3 className={`text-2xl font-extrabold ${((attempt.score / attempt.max_score) * 100) >= 60 ? 'text-green-600' : 'text-red-600'}`}>
                                {attempt.score.toFixed(1)} / {attempt.max_score}
                            </h3>
                            <span className="text-sm text-gray-500">{((attempt.score / attempt.max_score) * 100).toFixed(1)}%</span>
                        </div>
                    </div>

                    {/* Suggestions Section */}
                    <h3 className="text-xl font-bold text-indigo-700 flex items-center border-b pb-2">
                        <Lightbulb size={20} className="mr-2" /> Improvement Suggestions (High Priority First)
                    </h3>

                    <div className="space-y-4">
                        {suggestions.map((s, index) => (
                            <div key={index} className={`p-4 rounded-xl border-l-4 shadow-sm ${s.color}`}>
                                <p className="font-semibold text-lg mb-1 flex items-center">
                                    <span className="w-6 h-6 rounded-full mr-2 flex items-center justify-center bg-indigo-500 text-white text-xs font-bold">{s.priority}</span>
                                    {s.area}
                                </p>
                                <p className="text-gray-700 ml-8 text-sm italic">{s.tip}</p>
                            </div>
                        ))}
                    </div>

                </div>
            </div>
        </div>
    );
};


// Helper function for strict eligibility
const isStudentEligibleForQuiz = (quiz, studentClassYear, studentDepartment) => {
    // 1. Year must always match
    if (quiz.assigned_class_year !== studentClassYear) {
        return false;
    }

    // 2. Department Logic
    const isFirstYear = quiz.assigned_class_year === '1st Year';

    if (isFirstYear) {
        // Rule: First Year is Universal (ALL departments)
        return true;
    } else {
        // Rule: 2nd Year+ requires Department match
        return quiz.assigned_department === studentDepartment;
    }
};


// ===================================
// STUDENT DASHBOARD CORE LOGIC
// ===================================

// eslint-disable-next-line no-unused-vars
const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 transition duration-300 hover:shadow-xl">
        <div className="flex items-center justify-between">
            <div className={`p-3 rounded-full ${color} flex items-center justify-center`}>
                <Icon size={24} />
            </div>
            <div className="text-sm font-medium text-gray-500">{title}</div>
        </div>
        <div className="mt-4">
            <div className="text-4xl font-bold text-gray-900">{value}</div>
        </div>
        <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
    </div>
);


const QuizCard = ({ quiz, getQuizStatus, handleStartQuiz }) => {
    // FIX: Pass the full quiz object to getQuizStatus
    const { status, canStart, scheduledFuture, isExpired } = getQuizStatus(quiz);

    // Determine button class based on status
    let buttonClasses = '';
    let buttonIcon = PlayCircle;
    let buttonText = '';

    // Strict disabling for Expired, Future, and Completed (no retake)
    const isDisabled = isExpired || scheduledFuture || status === 'Completed';

    if (isExpired) {
        buttonIcon = XOctagon;
        buttonText = 'Expired';
        buttonClasses = 'bg-red-600 text-white cursor-not-allowed';
    } else if (scheduledFuture) {
        buttonIcon = Clock;
        buttonText = 'Scheduled';
        buttonClasses = 'bg-yellow-600 text-white cursor-not-allowed'; // Use yellow for scheduled
    } else if (status === 'Completed') {
        buttonIcon = BarChart3;
        buttonText = 'View Report';
        buttonClasses = 'bg-green-600 hover:bg-green-700 text-white'; // Completed uses green and is clickable
    } else if (canStart) {
        // New or In Progress
        buttonIcon = PlayCircle;
        buttonText = status === 'New' ? 'Start Quiz' : 'Continue Attempt';
        buttonClasses = 'bg-blue-600 hover:bg-blue-700 text-white';
    }

    const ButtonIcon = buttonIcon;


    return (
        <div className={`bg-white p-6 rounded-xl border-l-4 ${isExpired ? 'border-red-400' : (scheduledFuture ? 'border-yellow-400' : 'border-blue-400')} shadow-sm hover:shadow-lg transition duration-300`}>
            <div className="flex items-center justify-between">
                <div className="flex-1 space-y-1">
                    <h3 className="text-lg font-bold text-gray-800">{quiz.title || 'Untitled Quiz'}</h3>
                    <p className="text-sm font-semibold text-indigo-600">{quiz.subject_name} ({quiz.subject_id})</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center"><FileText size={16} className="mr-1" /> {quiz.questions?.length || (quiz.id === 'Q103' ? MOCK_QUIZ_Q103_DATA.flatMap(s => s.questions).length : 5)} Questions</span>
                        <span className="flex items-center"><Clock size={16} className="mr-1" /> {quiz.duration || 30} Mins</span>
                    </div>

                    {quiz.scheduled_start_time && (
                        <div className={`mt-2 text-sm flex items-center font-medium ${isExpired ? 'text-red-600' : 'text-gray-700'}`}>
                            <Calendar size={16} className={`mr-2 ${isExpired ? 'text-red-600' : 'text-yellow-700'}`} />
                            {isExpired ? 'Ended:' : 'Scheduled:'} {new Date(isExpired ? quiz.scheduled_end_time : quiz.scheduled_start_time).toLocaleString()}
                        </div>
                    )}

                </div>
                <button
                    onClick={() => handleStartQuiz(quiz)}
                    // Button is strictly disabled for Expired, Future. Completed status triggers handleView Report inside handleStartQuiz
                    disabled={isDisabled && status !== 'Completed'}
                    className={`px-4 py-2 text-white rounded-lg transition flex items-center gap-2 font-semibold whitespace-nowrap ${buttonClasses}`}
                >
                    <ButtonIcon size={18} />
                    {buttonText}
                </button>
            </div>
        </div>
    );
};


const AttemptRow = ({ attempt, index, handleViewReport }) => {
    const scorePercent = ((attempt.score / attempt.max_score) * 100).toFixed(1);
    const scoreColor = scorePercent >= 60 ? 'text-green-600' : 'text-red-600';
    const statusIcon = scorePercent >= 60 ? CheckCircle : XCircle;
    const StatusIcon = statusIcon;
    const attemptDate = attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleDateString() : 'N/A';

    return (
        <tr className="border-b hover:bg-gray-50">
            <td className="px-4 py-3 text-sm text-gray-700">{index + 1}</td>
            <td className="px-4 py-3 text-sm font-medium text-gray-900">{attempt.quiz_title || 'Quiz'}</td>
            <td className="px-4 py-3 text-sm text-gray-600">{attemptDate}</td>
            <td className="px-4 py-3">
                <span className={`text-sm font-bold ${scoreColor} flex items-center gap-1`}>
                    {attempt.status === 'Completed' ? <StatusIcon size={16} /> : <AlertTriangle size={16} />}
                    {attempt.status === 'Completed' ? attempt.score.toFixed(1) + '/' + attempt.max_score + ' (' + scorePercent + '%)' : attempt.status}
                </span>
            </td>
            <td className="px-4 py-3 text-sm text-gray-500">{attempt.time_taken || 'N/A'}</td>
            <td className="px-4 py-3">
                {attempt.status === 'Completed' && (
                    <button
                        onClick={() => handleViewReport(attempt)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-semibold"
                    >
                        View Report
                    </button>
                )}
            </td>
        </tr>
    );
};


// Navigation items constant (moved outside component for stability)
const NAV_ITEMS = [
    { name: 'Dashboard', icon: BookOpen, title: 'Student Dashboard' },
    { name: 'Available Quizzes', icon: FileText, title: 'Available Quizzes' },
    { name: 'My Progress', icon: BarChart3, title: 'My Performance' },
    { name: 'Profile', icon: User, title: 'Profile & Settings' },
];

export default function StudentDashboard() {
    const { logout } = useAuth(); // Assuming useAuth provides logout only
    const { success, error } = useToast();

    // Block browser back/forward navigation
    useNavigationBlock();

    // Local state to control custom logout confirmation (replaces browser confirm())
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    // Session management: inactivity timers and warning modal
    const [showSessionWarning, setShowSessionWarning] = useState(false);
    const [sessionCountdown, setSessionCountdown] = useState(0); // seconds remaining during warning
    const inactivityTimerRef = useRef(null);
    const logoutTimerRef = useRef(null);
    const countdownIntervalRef = useRef(null);
    const navigationBlockedShownRef = useRef(false);

    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
    const WARNING_DURATION_MS = 60 * 1000; // 1 minute warning

    const [activeTab, setActiveTab] = useState('Dashboard');
    const [quizzes, setQuizzes] = useState([]);
    const [attempts, setAttempts] = useState([]);
    const [currentUser, setCurrentUser] = useState(null); // Actual user data state
    const [isLoading, setIsLoading] = useState(false);
    const [activeQuizAttempt, setActiveQuizAttempt] = useState(null);
    const [reportModalData, setReportModalData] = useState(null); // State for modal data

    const [stats, setStats] = useState({
        totalAttempts: 0,
        averageScore: 0,
        quizzesTaken: 0,
        bestScore: 0
    });

    // FIX: Fetch User Data separately and ensure it's loaded before main dashboard data
    const fetchCurrentUser = useCallback(async () => {
        try {
            // FIX: This call now uses the production fetchAPI with the user's token
            const user = await userAPI.getCurrentUser();

            if (user && user.id) {
                setCurrentUser(user);
                return user;
            } else {
                // If the API technically succeeded but returned empty/invalid user data (e.g., {})
                throw new Error("Invalid user data received from API.");
            }
        } catch (e) {
            console.error("Failed to fetch current user:", e);
            // This is the true failure point, redirecting to login page (handled by ProtectedRoute logic)
            error('Could not load user data. Please log in again.');
            return null;
        }
    }, [error]);

    const fetchDashboardData = useCallback(async (user) => {
        // FIX: Ensure user object is valid before proceeding
        if (!user || !user.class_year || !user.department) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            // API CALL: Fetch All Quizzes (relying on fetchAPI mock)
            const allQuizzes = await quizAPI.getAllQuizzes();

            // Filter quizzes based on student's class and department
            const eligibleQuizzes = allQuizzes.filter(quiz =>
                isStudentEligibleForQuiz(quiz, user.class_year, user.department)
            );

            setQuizzes(eligibleQuizzes || []);

            // API CALL: Fetch my attempts
            const attemptsData = await attemptAPI.getMyAttempts();
            setAttempts(attemptsData || []);

            if (attemptsData && attemptsData.length > 0) {
                const completedAttempts = attemptsData.filter(att => att.status === 'Completed');

                const totalPercentScore = completedAttempts.reduce((sum, att) => {
                    const max = att.max_score || 100;
                    return sum + ((att.score || 0) / max) * 100;
                }, 0);

                const avgScore = completedAttempts.length > 0 ? totalPercentScore / completedAttempts.length : 0;

                const bestScore = completedAttempts.length > 0 ? Math.max(...completedAttempts.map(att => {
                    const max = att.max_score || 100;
                    return (att.score || 0) / max * 100;
                })) : 0;

                setStats({
                    totalAttempts: completedAttempts.length,
                    averageScore: avgScore.toFixed(1),
                    quizzesTaken: new Set(completedAttempts.map(att => att.quiz_id)).size,
                    bestScore: bestScore.toFixed(1)
                });
            } else {
                setStats({ totalAttempts: 0, averageScore: 0, quizzesTaken: 0, bestScore: 0 });
            }
        } catch (e) {
            // FIX: If Quizzes/Attempts fetch fails, set to empty arrays and log error
            console.error("API Fetch Error (Quizzes/Attempts):", e);
            setQuizzes([]);
            setAttempts([]);
            error('Failed to load Quizzes/Attempts from API. Showing empty list.');

        } finally {
            setIsLoading(false);
        }
    }, [error]);

    // Initial load effect
    useEffect(() => {
        // Start by fetching current user data
        fetchCurrentUser().then(user => {
            // Then run fetchDashboardData with the fetched user data
            fetchDashboardData(user);
        });
    }, [fetchCurrentUser, fetchDashboardData]);


    const handleLogout = () => {
        // Open custom confirmation card/modal instead of native browser confirm
        setShowLogoutConfirm(true);
    };

    const confirmLogout = () => {
        setShowLogoutConfirm(false);
        try {
            logout();
            success('Successfully logged out');
        } catch (e) {
            error('Logout failed.');
            console.error(e);
        }
    };

    const cancelLogout = () => {
        setShowLogoutConfirm(false);
    };

    // Reset inactivity timers (call on user activity)
    const resetInactivityTimers = useCallback(() => {
        // clear existing timers
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
        }
        if (logoutTimerRef.current) {
            clearTimeout(logoutTimerRef.current);
        }
        if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
        setShowSessionWarning(false);

        // Set warning timer: show warning WARNING_DURATION_MS before logout
        inactivityTimerRef.current = setTimeout(() => {
            setShowSessionWarning(true);
            setSessionCountdown(Math.floor(WARNING_DURATION_MS / 1000));

            // Start countdown interval updating every second
            countdownIntervalRef.current = setInterval(() => {
                setSessionCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(countdownIntervalRef.current);
                        countdownIntervalRef.current = null;
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }, Math.max(0, INACTIVITY_LIMIT_MS - WARNING_DURATION_MS));

        // Set logout timer
        logoutTimerRef.current = setTimeout(() => {
            // auto logout
            setShowSessionWarning(false);
            try {
                logout();
                success('You have been logged out due to inactivity.');
            } catch (e) {
                console.error('Auto logout failed', e);
            }
        }, INACTIVITY_LIMIT_MS);
    }, [logout, success, INACTIVITY_LIMIT_MS, WARNING_DURATION_MS]);

    // Activity listeners and popstate interception (disable back/forward navigation)
    useEffect(() => {
        const activityHandler = () => {
            try {
                resetInactivityTimers();
            } catch (e) {
                console.error('Failed to reset inactivity timers', e);
            }
        };

        const onPopState = () => {
            // Re-push state to effectively prevent history navigation away
            try { window.history.pushState(null, '', window.location.href); } catch { /* ignore */ }
            if (!navigationBlockedShownRef.current) {
                navigationBlockedShownRef.current = true;
                error('Back/forward navigation is disabled on dashboard. Use Logout to exit.');
            }
        };

        // Register activity events
        const events = ['mousemove', 'keydown', 'click', 'touchstart'];
        events.forEach(ev => window.addEventListener(ev, activityHandler));

        // Register popstate
        window.addEventListener('popstate', onPopState);

        // Push initial state to history so popstate can be intercepted
        try { window.history.pushState(null, '', window.location.href); } catch { /* ignore */ }

        // Initialize timers
        resetInactivityTimers();

        return () => {
            events.forEach(ev => window.removeEventListener(ev, activityHandler));
            window.removeEventListener('popstate', onPopState);

            // Clear timers
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
            if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        };
    }, [resetInactivityTimers, error]);

    // FIX: useCallback for getQuizStatus
    const getQuizStatus = useCallback((quiz) => { // Takes full quiz object
        // NOTE: Keeping the mock date here since we rely on time checks for scheduling
        const MOCK_CURRENT_DATE = new Date('2025-11-15T10:00:00Z');
        const now = MOCK_CURRENT_DATE; // Use Mock Date for consistency

        const scheduledStartTime = quiz?.scheduled_start_time ? new Date(quiz.scheduled_start_time) : now;
        const scheduledEndTime = quiz?.scheduled_end_time ? new Date(quiz.scheduled_end_time) : new Date(new Date().setFullYear(new Date().getFullYear() + 9999));

        const isScheduled = scheduledStartTime > now;
        const isExpired = scheduledEndTime < now; // Check if end time is in the past

        // 1. Check for Expired Status
        if (isExpired) {
            return {
                status: 'Expired',
                label: 'Expired',
                canStart: false,
                attempt: null,
                scheduledFuture: false,
                isExpired: true,
                scheduledTime: quiz.scheduled_start_time
            };
        }

        // 2. Check for Future Scheduled Status
        if (isScheduled) {
            return {
                status: 'Scheduled',
                label: 'Scheduled',
                canStart: false,
                attempt: null,
                scheduledFuture: true,
                isExpired: false,
                scheduledTime: quiz.scheduled_start_time
            };
        }

        // 3. Check Attempt Status (only if quiz is currently active - time is between start and end)
        const latestAttempt = attempts
            .filter(att => att.quiz_id === quiz.id)
            .sort((a, b) => new Date(b.submitted_at || 0) - new Date(a.submitted_at || 0))[0];

        if (latestAttempt?.status === 'Completed') {
            // Rule: No Retake, but allows View Report
            return { status: 'Completed', label: 'Completed', canStart: false, attempt: latestAttempt, scheduledFuture: false, isExpired: false };
        }

        if (latestAttempt?.status === 'In Progress') {
            return { status: 'In Progress', label: 'Continue Attempt', canStart: true, attempt: latestAttempt, scheduledFuture: false, isExpired: false };
        }

        // If no latest attempt and time is active
        return { status: 'New', label: 'Start Quiz', canStart: true, attempt: null, scheduledFuture: false, isExpired: false };

    }, [attempts]); // Dependency is stable

    // FIX: useCallback for handleViewReport
    const handleViewReport = useCallback((attempt) => {
        setReportModalData(attempt);
    }, []); // No dependencies

    // FIX: useCallback for handleStartQuiz
    const handleStartQuiz = useCallback(async (quiz) => {
        const status = getQuizStatus(quiz); // Pass full quiz object

        // 1. Handle Completed status first (it triggers View Report)
        if (status.status === 'Completed') {
            handleViewReport(status.attempt);
            return;
        }

        // 2. Handle Disabled status (Scheduled or Expired)
        if (status.scheduledFuture) {
            error(`Quiz is scheduled to start at ${new Date(quiz.scheduled_start_time).toLocaleString()}. Please wait.`);
            return;
        }

        if (status.isExpired) {
            error(`This quiz expired at ${new Date(quiz.scheduled_end_time).toLocaleString()}.`);
            return;
        }

        if (!status.canStart) {
            error('Cannot start quiz: Status is ' + status.status);
            return;
        }

        // 3. Start Quiz (Integrity Check)
        const element = document.documentElement;
        if (element.requestFullscreen) {
            try {
                await element.requestFullscreen();
            } catch (e) {
                error('Fullscreen access required to start the quiz. Please try again.');
                console.error('Fullscreen blocked:', e);
                return; // Prevent quiz start if fullscreen fails
            }
        }

        try {
            let _attemptId = status.attempt?.id;

            // API CALL: Start Attempt
            if (status.status === 'New') {
                const response = await attemptAPI.startAttempt(quiz.id);
                _attemptId = response.attempt_id;
            }

            // NOTE: We pass the full quiz object to QuizPage 
            setActiveQuizAttempt(quiz);

        } catch (e) {
            error('Failed to start quiz: ' + e.message);
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }, [getQuizStatus, error, handleViewReport]); // Dependencies are stable

    // FIX: useCallback for handleEndQuiz
    const handleEndQuiz = useCallback(() => {
        setActiveQuizAttempt(null);
        // FIX: Re-fetch dashboard data using the current user info
        fetchDashboardData(currentUser);

        // Exit fullscreen, although the QuizPage component already handles this after submission
        if (document.fullscreenElement && document.exitFullscreen) {
            try {
                document.exitFullscreen();
            } catch (e) {
                console.warn("Failed to exit fullscreen (might already be exited):", e.message);
            }
        }
    }, [fetchDashboardData, currentUser]); // Added currentUser to dependencies


    // FIX: useCallback for getCurrentTitle
    const getCurrentTitle = useCallback(() => {
        const currentItem = NAV_ITEMS.find(item => item.name === activeTab);
        return currentItem ? currentItem.title : activeTab;
    }, [activeTab]); // Dependency is stable since NAV_ITEMS is constant

    // FIX: useCallback for renderContent
    const renderContent = useCallback(() => {
        // If user data hasn't loaded yet (isLoading is false, but currentUser is null), show loading
        if (isLoading || !currentUser) {
            return (
                <div className="text-center py-20 bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto"></div>
                    <p className="mt-6 text-xl text-gray-500">Loading Dashboard Data...</p>
                </div>
            );
        }

        switch (activeTab) {
            case 'Dashboard': {
                const allEligibleQuizzes = quizzes; // 'quizzes' state is already filtered

                const unattemptedQuizzes = allEligibleQuizzes.filter(quiz => {
                    const status = getQuizStatus(quiz); // Pass full quiz object
                    // Only show New and Scheduled on Dashboard overview
                    return (status.status === 'New' || status.status === 'Scheduled') && !status.isExpired;
                });

                const recentAttempts = attempts.filter(att => att.status === 'Completed').slice(-5).reverse();

                return (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Total Attempts" value={stats.totalAttempts} icon={Trophy} color="bg-blue-100/50 text-blue-800" subtitle="Total Attempts Made" />
                            <StatCard title="Average Score" value={stats.averageScore + '%'} icon={TrendingUp} color="bg-indigo-100/50 text-indigo-800" subtitle="Your Overall Performance" />
                            <StatCard title="Quizzes Taken" value={stats.quizzesTaken} icon={FileText} color="bg-green-100/50 text-green-800" subtitle="Unique Quizzes Taken" />
                            <StatCard title="Best Score" value={stats.bestScore + '%'} icon={Award} color="bg-yellow-100/50 text-yellow-800" subtitle="Your Highest Achievement" />
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-blue-200">
                            <h2 className="text-xl font-bold text-gray-800 border-b pb-4 mb-4 flex items-center">
                                <AlertCircle size={24} className="mr-2 text-blue-700" /> Available Quizzes
                            </h2>
                            {unattemptedQuizzes.length > 0 ? (
                                <div className="space-y-4">
                                    {unattemptedQuizzes.map(quiz => (
                                        <QuizCard key={quiz.id} quiz={quiz} getQuizStatus={getQuizStatus} handleStartQuiz={handleStartQuiz} />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-5 text-gray-500">
                                    <p>No new quizzes available to start or scheduled right now.</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 border-b pb-4 mb-4">
                                Recent Attempts
                            </h2>
                            {recentAttempts.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className="bg-gray-50 border-b">
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">#</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Quiz</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Score</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Time</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {recentAttempts.map((attempt, idx) => (
                                                <AttemptRow key={attempt.id} attempt={attempt} index={idx} handleViewReport={handleViewReport} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-gray-500">
                                    <AlertCircle size={48} className="mx-auto mb-3 text-gray-400" />
                                    <p>No quiz attempts recorded yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }
            case 'Available Quizzes': {
                // Filter quizzes to display based on the current list
                const quizzesToDisplay = quizzes.filter(quiz => {
                    const status = getQuizStatus(quiz);
                    // Show scheduled, new, and in progress
                    return status.status !== 'Completed' && !status.isExpired;
                });

                return (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-4 mb-4">
                            All Available Quizzes
                        </h2>
                        {quizzesToDisplay.length > 0 ? (
                            <div className="space-y-4">
                                {quizzesToDisplay.map(quiz => (
                                    <QuizCard key={quiz.id} quiz={quiz} getQuizStatus={getQuizStatus} handleStartQuiz={handleStartQuiz} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-gray-500">
                                <AlertCircle size={48} className="mx-auto mb-3 text-gray-400" />
                                <p>No quizzes available for your class at the moment.</p>
                            </div>
                        )}
                    </div>
                );
            }
            case 'My Progress':
                return (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 space-y-8">
                        <h2 className="text-xl font-semibold text-gray-800">My Performance History</h2>

                        <div className="border p-4 rounded-xl bg-gray-50">
                            <PerformanceChart attempts={attempts} />
                        </div>

                        <div className="border-t pt-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Overall Quiz History</h3>
                            {attempts.length > 0 ? (
                                <div className="overflow-x-auto border rounded-xl shadow-sm">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className="bg-gray-50 border-b">
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">#</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Quiz</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Date</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Score</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Time</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {attempts.map((attempt, idx) => (
                                                <AttemptRow key={attempt.id} attempt={attempt} index={idx} handleViewReport={handleViewReport} />
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-10 text-gray-500">
                                    <p>No quiz attempt record.</p>
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 'Profile':
                return <ProfileSettings currentUser={currentUser} />;

            default:
                return null;
        }
    }, [activeTab, isLoading, currentUser, stats, quizzes, attempts, getQuizStatus, handleStartQuiz, handleViewReport]); // Dependencies are stable


    if (activeQuizAttempt) {
        return <QuizPage quiz={activeQuizAttempt} onEndQuiz={handleEndQuiz} />;
    }


    return (
        <>
            <div className="min-h-screen bg-gray-50 flex">
                <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r shadow-lg z-10">
                    <div className="p-6 text-2xl font-extrabold text-blue-700 border-b">
                        MacQuiz <span className="text-gray-400 font-light">|Student</span>
                    </div>
                    <nav className="flex-1 p-4 space-y-2">
                        {NAV_ITEMS.map((item) => (
                            <button
                                key={item.name}
                                onClick={() => setActiveTab(item.name)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-150 text-left 
                                    ${activeTab === item.name
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-blue-600'
                                    }`}
                            >
                                <item.icon size={20} />
                                <span className="font-medium">{item.title}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="p-4 border-t">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition duration-150 text-red-500 hover:bg-red-50"
                        >
                            <LogOut size={20} />
                            <span className="font-medium">Logout</span>
                        </button>
                    </div>
                </aside>

                <main className="flex-1 lg:ml-64 p-4 md:p-8">
                    <header className="mb-8 flex justify-between items-start">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900">{getCurrentTitle()}</h1>
                            <p className="text-gray-500 mt-1">
                                Welcome back, {currentUser?.first_name || 'Student'}!
                            </p>
                        </div>
                        <div className="flex flex-col items-end space-y-1">
                            <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md cursor-pointer hover:ring-4 ring-blue-300 transition duration-150">
                                {currentUser ? (currentUser.first_name?.[0] + currentUser.last_name?.[0]) : 'S'}
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{currentUser?.first_name} {currentUser?.last_name}</p>
                            <p className="text-xs text-gray-500">Student id: {currentUser?.student_id || currentUser?.id || 'Student'}</p>
                        </div>
                    </header>

                    {renderContent()}
                </main>
            </div>

            {/* Report Modal Integration */}
            {/* Custom Logout Confirmation Modal (replaces native confirm) */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Are you sure you want to logout?</h3>
                        <p className="text-sm text-gray-600 mb-4">You will be redirected to the login page. Any unsaved changes may be lost.</p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={cancelLogout}
                                className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 font-semibold hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmLogout}
                                className="px-4 py-2 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Session Warning Modal (appears shortly before auto-logout) */}
            {showSessionWarning && (
                <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Session Expiring Soon</h3>
                        <p className="text-sm text-gray-600 mb-4">You've been inactive. Your session will expire in <span className="font-semibold">{sessionCountdown}s</span>. Do you want to stay logged in?</p>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => { resetInactivityTimers(); setShowSessionWarning(false); success('Session extended'); }}
                                className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700 font-semibold hover:bg-gray-200 transition"
                            >
                                Stay Logged In
                            </button>
                            <button
                                onClick={() => { setShowSessionWarning(false); try { logout(); success('Logged out'); } catch { error('Logout failed'); } }}
                                className="px-4 py-2 bg-red-600 rounded-lg text-white font-semibold hover:bg-red-700 transition"
                            >
                                Logout Now
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {reportModalData && (
                <ReportModal attempt={reportModalData} onClose={() => setReportModalData(null)} />
            )}
        </>
    );
}