import React, { useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import mammoth from "mammoth";
import { quizAPI } from "../services/api";
import {
    Save, UploadCloud, Plus, Trash2, FileText, Settings,
    CheckCircle, AlertCircle, X, HelpCircle,
    Clock, Calendar, BookOpen, Hash, Percent, Layout
} from 'lucide-react';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.js`;

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const API_ROUTE = "/api/v1/quizzes/";
const SUBJECTS_ROUTE = "/api/v1/subjects/";

// --- UI SUB-COMPONENTS ---

const InputField = ({ label, icon: Icon, ...props }) => (
    <div className="mb-4">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            {Icon && <Icon size={14} />} {label}
        </label>
        <input
            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm text-slate-700"
            {...props}
        />
    </div>
);

const SelectField = ({ label, icon: Icon, children, ...props }) => (
    <div className="mb-4">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            {Icon && <Icon size={14} />} {label}
        </label>
        <div className="relative">
            <select
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm text-slate-700 appearance-none"
                {...props}
            >
                {children}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
        </div>
    </div>
);

const QuestionCard = ({ question, index, onEdit, onDelete }) => (
    <div className="group relative bg-white border border-slate-200 rounded-xl p-5 mb-4 hover:shadow-md transition-all duration-200 hover:border-blue-200">
        <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(index)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                <Settings size={16} />
            </button>
            <button onClick={() => onDelete(index)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Delete">
                <Trash2 size={16} />
            </button>
        </div>

        <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center font-bold text-sm">
                Q{index + 1}
            </div>
            <div className="flex-grow">
                <p className="text-slate-800 font-medium text-base mb-3">{question.text}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {question.options.map((opt, i) => (
                        <div
                            key={i}
                            className={`flex items-center px-3 py-2 rounded-lg text-sm border ${question.correct === i
                                ? 'bg-green-50 border-green-200 text-green-800'
                                : 'bg-slate-50 border-slate-100 text-slate-600'
                                }`}
                        >
                            <div className={`w-4 h-4 rounded-full border mr-2 flex items-center justify-center ${question.correct === i ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300'
                                }`}>
                                {question.correct === i && <CheckCircle size={10} />}
                            </div>
                            {opt}
                        </div>
                    ))}
                </div>
                <div className="mt-3 text-sm text-slate-500 flex gap-4">
                    <span>Marks: <strong className="text-slate-700">{question.marks ?? ''}</strong></span>
                    <span>Penalty: <strong className="text-slate-700">{question.negative_marks ?? ''}</strong></span>
                </div>
            </div>
        </div>
    </div>
);

const FileUploadArea = ({ uploadedFile, onChange, onClear }) => (
    <div className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${uploadedFile ? 'border-green-300 bg-green-50/50' : 'border-blue-200 bg-blue-50/50 hover:border-blue-400 hover:bg-blue-50'
        }`}>
        <input
            type="file"
            accept=".csv,.pdf,.docx"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            onChange={onChange}
            disabled={!!uploadedFile}
        />

        {uploadedFile ? (
            <div className="relative z-20">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <CheckCircle size={24} />
                </div>
                <p className="text-green-800 font-medium mb-1">File Ready to Parse</p>
                <p className="text-green-600 text-sm mb-4">{uploadedFile.name}</p>
                <button
                    onClick={onClear}
                    className="px-4 py-2 bg-white border border-green-200 text-green-700 text-sm rounded-lg hover:bg-green-50 font-medium shadow-sm relative z-30"
                >
                    Change File
                </button>
            </div>
        ) : (
            <div>
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <UploadCloud size={24} />
                </div>
                <h4 className="text-slate-800 font-bold mb-1">Drop your document here</h4>
                <p className="text-slate-500 text-sm mb-0">Supports CSV, PDF, DOCX (Auto-parser)</p>
            </div>
        )}
    </div>
);

export default function TeacherQuizPage({ initialCreatorId = null }) {
    // Meta Data
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [creatorId, _setCreatorId] = useState(initialCreatorId || "");
    const [subjectId, setSubjectId] = useState("");
    const [department, setDepartment] = useState("Computer Science Engg.");
    const [classYear, setClassYear] = useState("1st Year");
    const [scheduledStartTime, setScheduledStartTime] = useState("");
    const [durationMinutes, setDurationMinutes] = useState(30);
    const [gracePeriodMinutes, setGracePeriodMinutes] = useState(0);
    const [marksPerCorrect, setMarksPerCorrect] = useState(1);
    const [marksPerIncorrect, setMarksPerIncorrect] = useState(0);
    const [totalMarks, _setTotalMarks] = useState(0);
    const [isActive, setIsActive] = useState(true);

    // Question Management
    const [questions, setQuestions] = useState([]);
    const [uploadedFile, setUploadedFile] = useState(null);
    const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'upload'

    // Manual Entry State
    const [currentQText, setCurrentQText] = useState("");
    const [currentOptions, setCurrentOptions] = useState(["", "", "", ""]);
    const [currentCorrect, setCurrentCorrect] = useState(0);
    const [currentMarks, setCurrentMarks] = useState(marksPerCorrect);
    const [currentNegativeMarks, setCurrentNegativeMarks] = useState(marksPerIncorrect);

    // Data & UI State
    const [subjects, setSubjects] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function fetchSubjects() {
            try {
                // Fallback subjects if API fails or is empty for demo
                const mockSubjects = [
                    { id: 1, name: "Data Structures" },
                    { id: 2, name: "Algorithms" },
                    { id: 3, name: "Database Systems" },
                    { id: 4, name: "Operating Systems" }
                ];

                try {
                    const res = await fetch(`${API_BASE_URL}${SUBJECTS_ROUTE}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (!cancelled) setSubjects(data.length > 0 ? data : mockSubjects);
                        return;
                    }
                } catch (err) {
                    console.warn("API fetch failed, using mocks", err);
                }
                if (!cancelled) setSubjects(mockSubjects);
            } catch (err) {
                console.debug('fetchSubjects failed:', err);
            }
        }
        fetchSubjects();
        return () => { cancelled = true; };
    }, []);

    // File Handling
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploadedFile(file);
        const ext = file.name.split(".").pop().toLowerCase();
        let text = "";

        try {
            if (ext === "csv") text = await file.text();
            else if (ext === "pdf") {
                const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    text += content.items.map((s) => s.str).join(" ") + "\n";
                }
            } else if (ext === "docx") {
                const arrayBuffer = await file.arrayBuffer();
                const { value } = await mammoth.extractRawText({ arrayBuffer });
                text = value;
            } else {
                alert("Only CSV, PDF, or DOCX files are supported.");
                setUploadedFile(null);
                return;
            }
            parseTextToQuestions(text);
        } catch (err) {
            alert("Error reading file. Please try again.");
            console.error(err);
            setUploadedFile(null);
        }
    };

    const clearFile = () => {
        setUploadedFile(null);
    };

    const parseTextToQuestions = (text) => {
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
        const parsed = [];
        let current = null;

        lines.forEach((line) => {
            const qMatch = line.match(/^(?:Question[:]?|\d+[.)])\s*(.*)/i);
            const optMatch = line.match(/^[A-Da-d]\W?\s*(.*)/);
            const ansMatch = line.match(/^Answer[:]?\s*([A-Da-d0-9])/i);

            if (qMatch) {
                if (current) parsed.push(current);
                current = {
                    text: (qMatch[1] || '').trim(),
                    options: [],
                    correct: null,
                    marks: Number(marksPerCorrect),
                    negative_marks: Number(marksPerIncorrect),
                };
            } else if (optMatch && current) {
                current.options.push(optMatch[1].trim());
            } else if (ansMatch && current) {
                const ans = ansMatch[1].toUpperCase();
                const index = isNaN(ans) ? ["A", "B", "C", "D"].indexOf(ans) : parseInt(ans) - 1;
                current.correct = index >= 0 ? index : null;
            }
        });

        if (current) parsed.push(current);
        setQuestions(prev => [...prev, ...parsed]);
    };

    // Manual Question Handling
    const handleAddManualQuestion = () => {
        if (!currentQText.trim()) return alert("Question text cannot be empty");
        if (currentOptions.some(opt => !opt.trim())) return alert("All options must be filled");

        const newQ = {
            text: currentQText,
            options: [...currentOptions],
            correct: currentCorrect
            ,
            marks: Number(currentMarks),
            negative_marks: Number(currentNegativeMarks),
        };

        setQuestions([...questions, newQ]);
        // Reset fields
        setCurrentQText("");
        setCurrentOptions(["", "", "", ""]);
        setCurrentCorrect(0);
        setCurrentMarks(marksPerCorrect);
        setCurrentNegativeMarks(marksPerIncorrect);
    };

    const updateOptionText = (idx, val) => {
        const newOpts = [...currentOptions];
        newOpts[idx] = val;
        setCurrentOptions(newOpts);
    };

    const handleDeleteQuestion = (idx) => {
        setQuestions(questions.filter((_, i) => i !== idx));
    };

    const handleEditQuestion = (idx) => {
        const q = questions[idx];
        setCurrentQText(q.text);
        setCurrentOptions(q.options);
        setCurrentCorrect(q.correct);
        setCurrentMarks(q.marks ?? marksPerCorrect);
        setCurrentNegativeMarks(q.negative_marks ?? marksPerIncorrect);
        handleDeleteQuestion(idx);
        setActiveTab('manual');
        // Scroll to top of editor
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Final Save
    const handleSave = async () => {
        if (!title.trim()) return alert("Please fill the quiz title.");
        if (!subjectId) return alert("Please select a subject.");
        if (questions.length === 0) return alert("Add at least one question.");

        const computedTotal = questions.reduce((s, q) => s + (Number(q.marks ?? marksPerCorrect) || 0), 0);
        const payload = {
            title,
            description,
            creator_id: creatorId || null,
            subject_id: subjectId,
            department: department || null,
            class_year: classYear || null,
            scheduled_start_time: scheduledStartTime ? new Date(scheduledStartTime).toISOString() : null,
            duration_minutes: Number(durationMinutes),
            grace_period_minutes: Number(gracePeriodMinutes),
            marks_per_correct: Number(marksPerCorrect),
            marks_per_incorrect: Number(marksPerIncorrect),
            total_marks: Number(totalMarks) || computedTotal,
            is_active: Boolean(isActive),
            questions,
        };

        setIsSaving(true);
        try {
            // Use shared API service
            const response = await quizAPI.createQuiz(payload);
            // Show success
            alert(`🎉 Quiz "${response.title || title}" saved successfully with ${questions.length} questions!`);

            // Reset
            setTitle("");
            setDescription("");
            setQuestions([]);
            setUploadedFile(null);
        } catch (err) {
            console.error("Save failed:", err);
            alert(err.message || "Error saving quiz. Please check console.");
        } finally {
            setIsSaving(false);
        }
    };

    const estimatedTotal = questions.reduce((s, q) => s + (Number(q.marks ?? marksPerCorrect) || 0), 0);

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            <div className="max-w-7xl mx-auto p-4 md:p-8">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">Quiz Builder</h1>
                        <p className="text-slate-500 mt-1 flex items-center gap-2">
                            <BookOpen size={16} /> Create comprehensive assessments
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => {
                                setTitle("");
                                setQuestions([]);
                                setUploadedFile(null);
                            }}
                            className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 font-medium transition shadow-sm"
                        >
                            Discard
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-md flex items-center gap-2 disabled:opacity-70 transition"
                        >
                            {isSaving ? (
                                <>Saving...</>
                            ) : (
                                <><Save size={18} /> Save & Publish</>
                            )}
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* LEFT SIDEBAR: SETTINGS */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <Settings size={18} className="text-indigo-500" /> Quiz Configuration
                            </h3>

                            <InputField
                                label="Quiz Title"
                                icon={FileText}
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g., Mid-Term Evaluation"
                            />

                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
                                <textarea
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-slate-700 resize-none"
                                    placeholder="Brief instructions for students..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <SelectField label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                                    <option value="">Select...</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </SelectField>

                                <SelectField label="Class" value={classYear} onChange={(e) => setClassYear(e.target.value)}>
                                    <option>1st Year</option>
                                    <option>2nd Year</option>
                                    <option>3rd Year</option>
                                    <option>4th Year</option>
                                </SelectField>
                            </div>

                            <SelectField label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                                <option>Computer Science Engg.</option>
                                <option>Mechanical Engineering</option>
                                <option>Electrical Engineering</option>
                                <option>Civil Engineering</option>
                            </SelectField>

                            <div className="border-t border-slate-100 my-4 pt-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Timing & Access</h4>
                                <InputField
                                    label="Scheduled Start"
                                    type="datetime-local"
                                    icon={Calendar}
                                    value={scheduledStartTime}
                                    onChange={(e) => setScheduledStartTime(e.target.value)}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <InputField
                                        label="Duration (Min)"
                                        type="number"
                                        icon={Clock}
                                        value={durationMinutes}
                                        onChange={(e) => setDurationMinutes(e.target.value)}
                                    />
                                    <InputField
                                        label="Grace Period"
                                        type="number"
                                        value={gracePeriodMinutes}
                                        onChange={(e) => setGracePeriodMinutes(e.target.value)}
                                    />
                                </div>
                                <div className="flex items-center mt-2 bg-slate-50 p-3 rounded-lg">
                                    <input
                                        type="checkbox"
                                        id="isActive"
                                        checked={isActive}
                                        onChange={(e) => setIsActive(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="isActive" className="ml-2 text-sm font-medium text-slate-700">Publish Immediately</label>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2 pb-3 border-b border-slate-100">
                                <Hash size={18} className="text-green-500" /> Scoring Rules
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <InputField
                                    label="+ Score"
                                    type="number"
                                    value={marksPerCorrect}
                                    onChange={(e) => setMarksPerCorrect(e.target.value)}
                                />
                                <InputField
                                    label="- Penalty"
                                    type="number"
                                    value={marksPerIncorrect}
                                    onChange={(e) => setMarksPerIncorrect(e.target.value)}
                                />
                            </div>
                            <div className="mt-2 pt-3 border-t border-slate-100 flex justify-between items-center">
                                <span className="text-sm text-slate-500 font-medium">Total Est. Marks:</span>
                                <span className="text-xl font-bold text-indigo-600">{estimatedTotal}</span>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT CONTENT: QUESTIONS */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Question Editor Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            {/* Tabs */}
                            <div className="flex border-b border-slate-200">
                                <button
                                    onClick={() => setActiveTab('manual')}
                                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition ${activeTab === 'manual' ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        }`}
                                >
                                    <Plus size={16} /> Manual Entry
                                </button>
                                <button
                                    onClick={() => setActiveTab('upload')}
                                    className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition ${activeTab === 'upload' ? 'bg-white text-purple-600 border-b-2 border-purple-600' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                                        }`}
                                >
                                    <UploadCloud size={16} /> Bulk Upload
                                </button>
                            </div>

                            <div className="p-6">
                                {activeTab === 'manual' ? (
                                    <div className="space-y-4 animate-in fade-in duration-300">
                                        <div>
                                            <label className="block text-sm font-bold text-slate-700 mb-2">Question Text</label>
                                            <textarea
                                                value={currentQText}
                                                onChange={(e) => setCurrentQText(e.target.value)}
                                                placeholder="Type your question here..."
                                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 text-slate-700"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {currentOptions.map((opt, idx) => (
                                                <div key={idx} className="relative">
                                                    <div className={`absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border flex items-center justify-center cursor-pointer transition ${currentCorrect === idx ? 'bg-green-500 border-green-500 text-white' : 'border-slate-300 text-transparent hover:border-green-400'
                                                        }`} onClick={() => setCurrentCorrect(idx)}>
                                                        <CheckCircle size={14} />
                                                    </div>
                                                    <input
                                                        type="text"
                                                        value={opt}
                                                        onChange={(e) => updateOptionText(idx, e.target.value)}
                                                        placeholder={`Option ${idx + 1}`}
                                                        className={`w-full pl-12 pr-4 py-3 border rounded-xl outline-none transition ${currentCorrect === idx ? 'border-green-400 bg-green-50' : 'border-slate-200 focus:border-blue-400'
                                                            }`}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-3">
                                            <InputField
                                                label="Marks"
                                                type="number"
                                                icon={Percent}
                                                value={currentMarks}
                                                onChange={(e) => setCurrentMarks(e.target.value)}
                                            />
                                            <InputField
                                                label="Penalty"
                                                type="number"
                                                icon={Percent}
                                                value={currentNegativeMarks}
                                                onChange={(e) => setCurrentNegativeMarks(e.target.value)}
                                            />
                                        </div>

                                        <div className="pt-4 flex justify-end">
                                            <button
                                                onClick={handleAddManualQuestion}
                                                className="bg-slate-800 text-white px-6 py-2.5 rounded-xl hover:bg-slate-900 font-medium shadow-lg hover:shadow-xl transition transform active:scale-95 flex items-center gap-2"
                                            >
                                                <Plus size={18} /> Add Question
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="animate-in fade-in duration-300">
                                        <FileUploadArea
                                            uploadedFile={uploadedFile}
                                            onChange={handleFileUpload}
                                            onClear={clearFile}
                                        />

                                        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                                            <h5 className="flex items-center gap-2 font-bold text-blue-800 mb-2">
                                                <HelpCircle size={16} /> Formatting Guide
                                            </h5>
                                            <p className="text-sm text-blue-700 mb-2">The parser is smart! It supports simple text formats like:</p>
                                            <pre className="bg-white p-3 rounded-lg text-xs text-slate-600 font-mono border border-blue-100 overflow-x-auto">
                                                1. What is the capital of France?{'\n'}
                                                A) London{'\n'}
                                                B) Paris{'\n'}
                                                C) Berlin{'\n'}
                                                Answer: B
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Question List */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Layout size={20} className="text-slate-400" />
                                    Questions <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs ml-2">{questions.length}</span>
                                </h3>
                                {questions.length > 0 && (
                                    <button
                                        onClick={() => setQuestions([])}
                                        className="text-sm text-red-500 hover:text-red-700 font-medium"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>

                            {questions.length === 0 ? (
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center bg-slate-50">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                                        <HelpCircle size={32} className="text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 font-medium">No questions added yet.</p>
                                    <p className="text-slate-400 text-sm mt-1">Use the manual entry or upload a file above.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {questions.map((q, i) => (
                                        <QuestionCard
                                            key={i}
                                            index={i}
                                            question={q}
                                            onDelete={handleDeleteQuestion}
                                            onEdit={handleEditQuestion}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}