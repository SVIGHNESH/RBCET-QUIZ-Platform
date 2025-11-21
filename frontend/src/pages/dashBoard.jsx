import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { userAPI } from "../services/api";
import BulkUploadModal from "../components/BulkUploadModal";
import {
    LayoutDashboard, Users, Zap, FileText, Settings, LogOut, CheckCircle, Clock,
    TrendingUp, TrendingDown, ClipboardList, BarChart3, Search, Plus, X, List, Save, UserCheck, Calendar, Upload,
    Eye, EyeOff, RefreshCw, Key, ShieldCheck, AlertTriangle
} from 'lucide-react';

/**
 * --- MOCK DATA ---
 * Initializing all data to N/A or 0 until the administrator provisions users/quizzes.
 */

const mockActivity = []; // No activity until users are added

// Mock data for the new Activity Tracker Table
// placeholders removed: using live API data instead of static mocks

/**
 * --- UTILITY FUNCTIONS ---
 */

// Password strength validator
const validatePasswordStrength = (password) => {
    const checks = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        // any non-word, non-space character treated as special
        special: /[^\w\s]/.test(password)
    };

    const score = Object.values(checks).filter(Boolean).length;

    let strength = 'weak';
    let color = 'bg-red-500';

    if (score >= 5) {
        strength = 'strong';
        color = 'bg-green-500';
    } else if (score >= 3) {
        strength = 'medium';
        color = 'bg-yellow-500';
    }

    return { checks, score, strength, color };
};

// Strong password generator
const generateStrongPassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*_-+=';

    const allChars = uppercase + lowercase + numbers + special;

    // Ensure at least one of each type
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill remaining characters (total length 12)
    for (let i = password.length; i < 12; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Email domain validator
const validateEmailDomain = (email) => {
    const allowedDomains = ['gmail.com', 'rbmi.in', 'yahoo.com', 'outlook.com', 'hotmail.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    return allowedDomains.includes(domain);
};


/**
 * --- UTILITY COMPONENTS ---
 */

// Stat Card component for key metrics
const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) => {
    // If trend is N/A, we prevent showing red/green colours
    const trendColor = trend === 'N/A' ? 'text-gray-500' : (trend.includes('-') ? 'text-red-600' : 'text-green-600');
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 transition duration-300 hover:shadow-xl">
            <div className="flex items-center justify-between">
                <div className={`p-3 rounded-full ${color}`}>
                    {Icon && <Icon size={24} />}
                </div>
                <div className="text-sm font-medium text-gray-500">{title}</div>
            </div>
            <div className="mt-4 flex items-end justify-between">
                <div className="text-4xl font-bold text-gray-900">{value}</div>
                <div className={`flex items-center text-sm font-semibold ${trendColor}`}>
                    {trend}
                </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{subtitle}</p>
        </div>
    );
};

// Activity Feed Item
const ActivityItem = ({ user, action, time, status }) => {
    const statusColor = status === 'success' ? 'text-green-500' : status === 'error' ? 'text-red-500' : 'text-blue-500'; // Reverted to blue accent
    const StatusIcon = status === 'success' ? CheckCircle : ClipboardList;

    return (
        <div className="flex items-center justify-between p-4 border-b last:border-b-0 hover:bg-gray-50 rounded-lg transition">
            <div className="flex items-center space-x-3">
                <StatusIcon size={20} className={statusColor} />
                <div>
                    <p className="font-semibold text-gray-800">{user}</p>
                    <p className="text-sm text-gray-600">{action}</p>
                </div>
            </div>
            <div className="text-xs text-gray-500 flex items-center">
                <Clock size={14} className="mr-1" />
                {time}
            </div>
        </div>
    );
};

// Card: Quick link for Admin to add new user (Teacher or Student)
const AddNewUserCard = ({ onAddClick }) => (
    // REMOVED: hover:shadow-2xl transition duration-300 transform hover:scale-[1.01]
    <div className="bg-blue-600/90 text-white p-6 rounded-2xl shadow-xl border border-blue-700 cursor-pointer" onClick={onAddClick}>
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-xl font-bold">New User Provisioning</h3>
                <p className="text-blue-200 text-sm mt-1">Quickly onboard new teachers or students.</p>
            </div>
        </div>
        {/* Reverted Button text color to blue */}
        <div className="mt-5 w-full bg-white text-blue-800 py-3 rounded-xl text-center font-semibold transition shadow-lg text-lg">
            Add Teacher / Student
        </div>
    </div>
);

// New Component: Form for creating new users
const UserCreationForm = ({ onCancel, onUserCreated }) => {
    const { success, error } = useToast();
    const [formData, setFormData] = useState({
        role: 'student', // Default role (lowercase for API)
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        phone_number: '', // New phone number field
        student_id: '', // Specific to student
        department: '',
        class_year: '1st Year'
    });
    const [showBulkUpload, setShowBulkUpload] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(null);
    const [emailError, setEmailError] = useState('');
    const [showDomainDropdown, setShowDomainDropdown] = useState(false);
    const [emailUsername, setEmailUsername] = useState('');
    const allowedDomains = ['gmail.com', 'rbmi.in', 'yahoo.com', 'outlook.com', 'hotmail.com'];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });

        // Validate password strength on change
        if (name === 'password') {
            if (value.length > 0) {
                setPasswordStrength(validatePasswordStrength(value));
            } else {
                setPasswordStrength(null);
            }
        }

        // Handle email input with domain dropdown
        if (name === 'email') {
            if (value.includes('@')) {
                const parts = value.split('@');
                setEmailUsername(parts[0]);
                setShowDomainDropdown(false);

                if (!validateEmailDomain(value)) {
                    setEmailError('Please use a valid email domain (gmail.com, rbmi.in, yahoo.com, outlook.com, hotmail.com)');
                } else {
                    setEmailError('');
                }
            } else {
                setEmailUsername(value);
                setShowDomainDropdown(value.length > 0);
                setEmailError('');
            }
        }
    };

    const handleDomainSelect = (domain) => {
        setFormData({ ...formData, email: `${emailUsername}@${domain}` });
        setShowDomainDropdown(false);
        setEmailError('');
    };

    const handleGeneratePassword = () => {
        const newPassword = generateStrongPassword();
        setFormData({ ...formData, password: newPassword });
        setPasswordStrength(validatePasswordStrength(newPassword));
        success('Strong password generated! Make sure to copy it.');
    };

    const handleBulkUploadSuccess = (result) => {
        success(`Successfully created ${result.created_count} users!`);

        if (result.error_count > 0) {
            console.error("Upload errors:", result.errors);
            error(`${result.error_count} rows had errors. Check console for details.`);
        }

        if (onUserCreated) {
            onUserCreated(result);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate email domain before submission
        if (!validateEmailDomain(formData.email)) {
            error('Please use a valid email domain (gmail.com, rbmi.in, yahoo.com, outlook.com, hotmail.com)');
            return;
        }

        // Validate password strength
        if (passwordStrength && passwordStrength.score < 3) {
            error('Password is too weak. Please use a stronger password or generate one.');
            return;
        }

        setIsSubmitting(true);

        try {
            const userData = {
                email: formData.email,
                password: formData.password,
                first_name: formData.first_name,
                last_name: formData.last_name,
                role: formData.role.toUpperCase(),
                department: formData.department,
                class_year: formData.class_year,
                phone_number: formData.phone_number || null, // Add phone number
            };

            // Add student_id only for students
            if (formData.role.toUpperCase() === 'student') {
                userData.student_id = formData.student_id;
            }

            const response = await userAPI.createUser(userData);

            success(`User ${response.first_name} ${response.last_name} created successfully!`);

            // Reset form
            setFormData({
                role: 'student',
                first_name: '',
                last_name: '',
                email: '',
                password: '',
                phone_number: '',
                student_id: '',
                department: '',
                class_year: '1st Year'
            });

            if (onUserCreated) {
                onUserCreated(response);
            }

            // Close form after 1 second
            setTimeout(() => {
                onCancel();
            }, 1000);

        } catch (err) {
            console.error(err);
            if (err.status === 400) {
                error(err.data?.detail || "Email or Student ID already exists!");
            } else if (err.status === 401 || err.status === 403) {
                error("You don't have permission to create users. Please login as admin.");
            } else {
                error(err.message || "Failed to create user. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <div className="flex justify-between items-center border-b pb-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Provision New User Account</h2>
                <button onClick={onCancel} className="text-gray-400 hover:text-red-600 transition">
                    <X size={24} />
                </button>
            </div>

            {/* Bulk Upload Modal */}
            <BulkUploadModal
                isOpen={showBulkUpload}
                onClose={() => setShowBulkUpload(false)}
                onSuccess={handleBulkUploadSuccess}
            />

            {/* New Bulk Upload Button */}
            <div className="border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl mb-8">
                <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                        <Upload size={24} className="text-blue-600 mt-1" />
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-2">
                                Bulk User Upload
                            </h3>
                            <p className="text-sm text-gray-600 mb-3">
                                Upload a CSV file to add multiple users at once. Preview data, detect duplicates, and validate before importing.
                            </p>
                            <ul className="text-xs text-gray-500 space-y-1">
                                <li>• Real-time validation and duplicate detection</li>
                                <li>• Preview imported data before uploading</li>
                                <li>• Automatic error reporting with line numbers</li>
                            </ul>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowBulkUpload(true)}
                        disabled={isSubmitting}
                        className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-lg whitespace-nowrap disabled:opacity-50"
                    >
                        <Upload size={20} className="mr-2" />
                        Bulk Upload
                    </button>
                </div>
            </div>

            <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Or, Add Single User Manually</h3>

            <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
                {/* User Role Selector */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User Role</label>
                    <select
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        required
                        disabled={isSubmitting}
                        className="w-full p-3 border border-gray-300 rounded-lg bg-blue-50 ring-2 ring-blue-500 font-semibold disabled:bg-gray-100"
                    >
                        <option value="teacher">Teacher / Professor</option>
                        <option value="student">Student</option>
                    </select>
                </div>

                {/* Student ID field (shown first for students) */}
                {formData.role === 'student' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Roll No. / Student ID (Required)</label>
                        <input
                            type="text"
                            name="student_id"
                            value={formData.student_id}
                            onChange={handleInputChange}
                            required={formData.role === 'student'}
                            disabled={isSubmitting}
                            autoComplete="off"
                            placeholder="e.g., CS2024001"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                    </div>
                )}

                {/* Grid for main details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                        <input
                            type="text"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleInputChange}
                            required
                            disabled={isSubmitting}
                            autoComplete="off"
                            placeholder="Enter first name"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                        <input
                            type="text"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleInputChange}
                            required
                            disabled={isSubmitting}
                            autoComplete="off"
                            placeholder="Enter last name"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email (Login ID) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                                disabled={isSubmitting}
                                autoComplete="off"
                                placeholder="Type username (e.g., john.doe)"
                                className={`w-full p-3 border rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 ${emailError ? 'border-red-500' : 'border-gray-300'}`}
                                onFocus={() => {
                                    if (!formData.email.includes('@') && formData.email.length > 0) {
                                        setShowDomainDropdown(true);
                                    }
                                }}
                            />

                            {/* Domain Dropdown */}
                            {showDomainDropdown && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                                    <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b text-xs font-medium text-gray-700 flex items-center justify-between">
                                        <span>📧 Select your email domain:</span>
                                        <button
                                            type="button"
                                            onClick={() => setShowDomainDropdown(false)}
                                            className="text-gray-400 hover:text-gray-600"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                    {allowedDomains.map((domain) => (
                                        <button
                                            key={domain}
                                            type="button"
                                            onClick={() => handleDomainSelect(domain)}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition flex items-center justify-between group border-b last:border-b-0"
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-800 group-hover:text-blue-600">
                                                    {emailUsername}@{domain}
                                                </span>
                                                <span className="text-xs text-gray-500 mt-0.5">
                                                    {domain === 'rbmi.in' && '🏫 Institute Domain'}
                                                    {domain === 'gmail.com' && '📬 Most Popular'}
                                                    {domain === 'yahoo.com' && '🌐 Yahoo Mail'}
                                                    {domain === 'outlook.com' && '📧 Microsoft Outlook'}
                                                    {domain === 'hotmail.com' && '📮 Hotmail'}
                                                </span>
                                            </div>
                                            <span className="text-xs text-blue-500 group-hover:text-blue-700 font-medium">
                                                Click →
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {emailError && (
                            <div className="flex items-center mt-2 text-xs text-red-600">
                                <AlertTriangle size={14} className="mr-1" />
                                {emailError}
                            </div>
                        )}
                        <div className="mt-2 text-xs text-gray-500">
                            <span className="font-medium">💡 Tip:</span> Type your username, then select a domain from the dropdown
                        </div>
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (Optional)</label>
                        <input
                            type="tel"
                            name="phone_number"
                            value={formData.phone_number}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                            autoComplete="off"
                            placeholder="+1234567890 or 1234567890"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                    </div>
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Temporary Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                required
                                disabled={isSubmitting}
                                autoComplete="new-password"
                                placeholder="Set temporary password"
                                className="w-full p-3 pr-24 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="p-2 text-gray-500 hover:text-gray-700 transition"
                                    title={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleGeneratePassword}
                                    disabled={isSubmitting}
                                    className="p-2 text-blue-600 hover:text-blue-700 transition disabled:opacity-50"
                                    title="Generate strong password"
                                >
                                    <RefreshCw size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Password Strength Indicator */}
                        {passwordStrength && (
                            <div className="mt-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-700">Password Strength:</span>
                                    <span className={`text-xs font-bold uppercase ${passwordStrength.strength === 'strong' ? 'text-green-600' :
                                        passwordStrength.strength === 'medium' ? 'text-yellow-600' :
                                            'text-red-600'
                                        }`}>
                                        {passwordStrength.strength === 'strong' && <span className="flex items-center"><ShieldCheck size={14} className="mr-1" />Strong</span>}
                                        {passwordStrength.strength === 'medium' && <span className="flex items-center"><Key size={14} className="mr-1" />Medium</span>}
                                        {passwordStrength.strength === 'weak' && <span className="flex items-center"><AlertTriangle size={14} className="mr-1" />Weak</span>}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${passwordStrength.color}`}
                                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                                    ></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className={passwordStrength.checks.length ? 'text-green-600' : 'text-gray-400'}>
                                        {passwordStrength.checks.length ? '✓' : '○'} At least 8 characters
                                    </div>
                                    <div className={passwordStrength.checks.uppercase ? 'text-green-600' : 'text-gray-400'}>
                                        {passwordStrength.checks.uppercase ? '✓' : '○'} Uppercase letter
                                    </div>
                                    <div className={passwordStrength.checks.lowercase ? 'text-green-600' : 'text-gray-400'}>
                                        {passwordStrength.checks.lowercase ? '✓' : '○'} Lowercase letter
                                    </div>
                                    <div className={passwordStrength.checks.number ? 'text-green-600' : 'text-gray-400'}>
                                        {passwordStrength.checks.number ? '✓' : '○'} Number
                                    </div>
                                    <div className={passwordStrength.checks.special ? 'text-green-600' : 'text-gray-400'}>
                                        {passwordStrength.checks.special ? '✓' : '○'} Special character
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Student-specific fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-6">
                    <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <select
                            name="department"
                            value={formData.department}
                            onChange={handleInputChange}
                            required
                            disabled={isSubmitting}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        >
                            <option value="">Select Department</option>
                            {['Computer Science Engg.', 'Artificial Intelligence', 'Mechanical Engineering', 'Electrical Engineering'].map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>
                    {formData.role === 'student' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Class/Year</label>
                            <select
                                name="class_year"
                                value={formData.class_year}
                                onChange={handleInputChange}
                                required={formData.role === 'student'}
                                disabled={isSubmitting}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            >
                                {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="flex items-center px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                    >
                        <X size={20} className="mr-2" /> Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                Creating...
                            </>
                        ) : (
                            <>
                                <Save size={20} className="mr-2" /> Create User
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

// Component for editing existing users
const EditUserModal = ({ user, onClose, onSuccess }) => {
    const { success, error } = useToast();
    const [formData, setFormData] = useState({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone_number: user.phone_number || '',
        department: user.department || '',
        class_year: user.class_year || '',
        is_active: user.is_active !== undefined ? user.is_active : true,
        password: '', // New password field (optional)
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(null);
    const [showPasswordSection, setShowPasswordSection] = useState(false);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        const finalValue = e.target.type === 'checkbox' ? e.target.checked : value;
        setFormData({ ...formData, [name]: finalValue });

        // Validate password strength on change
        if (name === 'password') {
            if (value.length > 0) {
                setPasswordStrength(validatePasswordStrength(value));
            } else {
                setPasswordStrength(null);
            }
        }
    };

    const handleGeneratePassword = () => {
        const newPassword = generateStrongPassword();
        setFormData({ ...formData, password: newPassword });
        setPasswordStrength(validatePasswordStrength(newPassword));
        success('Strong password generated! Make sure to copy it.');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate password strength if password is being changed
        if (formData.password && passwordStrength && passwordStrength.score < 3) {
            error('Password is too weak. Please use a stronger password or generate one.');
            return;
        }

        setIsSubmitting(true);

        try {
            const updateData = {
                first_name: formData.first_name,
                last_name: formData.last_name,
                phone_number: formData.phone_number || null,
                department: formData.department || null,
                class_year: formData.class_year || null,
                is_active: formData.is_active,
            };

            // Only include password if it's being changed
            if (formData.password) {
                updateData.password = formData.password;
            }

            await userAPI.updateUser(user.id, updateData);
            success(`User ${formData.first_name} ${formData.last_name} updated successfully!`);
            onSuccess();
        } catch (err) {
            console.error(err);
            if (err.status === 400) {
                error(err.data?.detail || "Failed to update user");
            } else if (err.status === 401 || err.status === 403) {
                error("You don't have permission to update users.");
            } else {
                error(err.message || "Failed to update user. Please try again.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold">Edit User</h2>
                        <p className="text-blue-100 text-sm mt-1">Update user information</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white hover:bg-white/20 p-2 rounded-full transition"
                        disabled={isSubmitting}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Email (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email (Login ID)</label>
                        <input
                            type="email"
                            value={formData.email}
                            disabled
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                    </div>

                    {/* Role (Read-only) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <input
                            type="text"
                            value={user.role}
                            disabled
                            className="w-full p-3 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed capitalize"
                        />
                        <p className="text-xs text-gray-500 mt-1">Role cannot be changed</p>
                    </div>

                    {/* Name fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                            <input
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleInputChange}
                                required
                                disabled={isSubmitting}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                            <input
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleInputChange}
                                required
                                disabled={isSubmitting}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            />
                        </div>
                    </div>

                    {/* Phone Number */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                            type="tel"
                            name="phone_number"
                            value={formData.phone_number}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                            placeholder="+1234567890"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                        />
                    </div>

                    {/* Department and Class/Year */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                            <select
                                name="department"
                                value={formData.department}
                                onChange={handleInputChange}
                                disabled={isSubmitting}
                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                            >
                                <option value="">Select Department</option>
                                {['Computer Science Engg.', 'Artificial Intelligence', 'Mechanical Engineering', 'Electrical Engineering', 'Mathematics', 'Physics'].map(dept => (
                                    <option key={dept} value={dept}>{dept}</option>
                                ))}
                            </select>
                        </div>
                        {user.role === 'student' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Class/Year</label>
                                <select
                                    name="class_year"
                                    value={formData.class_year}
                                    onChange={handleInputChange}
                                    disabled={isSubmitting}
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                >
                                    <option value="">Select Year</option>
                                    {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            name="is_active"
                            checked={formData.is_active}
                            onChange={handleInputChange}
                            disabled={isSubmitting}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-700">
                            Active User (Uncheck to deactivate account)
                        </label>
                    </div>

                    {/* Password Reset Section */}
                    <div className="border-t pt-4">
                        <button
                            type="button"
                            onClick={() => setShowPasswordSection(!showPasswordSection)}
                            className="flex items-center text-blue-600 hover:text-blue-700 font-medium text-sm mb-3"
                        >
                            <Key size={16} className="mr-2" />
                            {showPasswordSection ? 'Cancel Password Reset' : 'Reset User Password'}
                        </button>

                        {showPasswordSection && (
                            <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">
                                    New Password (Optional)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        disabled={isSubmitting}
                                        autoComplete="new-password"
                                        placeholder="Enter new password"
                                        className="w-full p-3 pr-24 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                                    />
                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1">
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="p-2 text-gray-500 hover:text-gray-700 transition"
                                            title={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleGeneratePassword}
                                            disabled={isSubmitting}
                                            className="p-2 text-blue-600 hover:text-blue-700 transition disabled:opacity-50"
                                            title="Generate strong password"
                                        >
                                            <RefreshCw size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* Password Strength Indicator */}
                                {passwordStrength && formData.password && (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-gray-700">Password Strength:</span>
                                            <span className={`text-xs font-bold uppercase ${passwordStrength.strength === 'strong' ? 'text-green-600' :
                                                passwordStrength.strength === 'medium' ? 'text-yellow-600' :
                                                    'text-red-600'
                                                }`}>
                                                {passwordStrength.strength === 'strong' && <span className="flex items-center"><ShieldCheck size={14} className="mr-1" />Strong</span>}
                                                {passwordStrength.strength === 'medium' && <span className="flex items-center"><Key size={14} className="mr-1" />Medium</span>}
                                                {passwordStrength.strength === 'weak' && <span className="flex items-center"><AlertTriangle size={14} className="mr-1" />Weak</span>}
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${passwordStrength.color}`}
                                                style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                                            ></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            <div className={passwordStrength.checks.length ? 'text-green-600' : 'text-gray-400'}>
                                                {passwordStrength.checks.length ? '✓' : '○'} At least 8 characters
                                            </div>
                                            <div className={passwordStrength.checks.uppercase ? 'text-green-600' : 'text-gray-400'}>
                                                {passwordStrength.checks.uppercase ? '✓' : '○'} Uppercase letter
                                            </div>
                                            <div className={passwordStrength.checks.lowercase ? 'text-green-600' : 'text-gray-400'}>
                                                {passwordStrength.checks.lowercase ? '✓' : '○'} Lowercase letter
                                            </div>
                                            <div className={passwordStrength.checks.number ? 'text-green-600' : 'text-gray-400'}>
                                                {passwordStrength.checks.number ? '✓' : '○'} Number
                                            </div>
                                            <div className={passwordStrength.checks.special ? 'text-green-600' : 'text-gray-400'}>
                                                {passwordStrength.checks.special ? '✓' : '○'} Special character
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-4 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex items-center px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                        >
                            <X size={20} className="mr-2" /> Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-md disabled:bg-blue-400 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <Save size={20} className="mr-2" /> Update User
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Component for listing existing users
const UserList = ({ onAddClick, refreshTrigger }) => {
    const { success, error } = useToast();
    const [users, setUsers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // all, teacher, student
    const [editingUser, setEditingUser] = useState(null);

    const fetchUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await userAPI.getAllUsers();
            setUsers(response);
        } catch (err) {
            console.error(err);
            error("Failed to load users");
        } finally {
            setIsLoading(false);
        }
    }, [error]);

    useEffect(() => {
        fetchUsers();
    }, [filter, refreshTrigger, fetchUsers]);

    const handleDelete = async (userId, userName) => {
        if (!window.confirm(`Are you sure you want to delete ${userName}?`)) {
            return;
        }

        try {
            await userAPI.deleteUser(userId);
            success(`User ${userName} deleted successfully`);
            fetchUsers(); // Refresh list
        } catch (err) {
            console.error(err);
            error(err.data?.detail || "Failed to delete user");
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
    };

    const handleUpdateSuccess = () => {
        setEditingUser(null);
        fetchUsers();
    };

    const filteredUsers = users.filter(user => {
        if (filter === 'all') return true;
        return user.role === filter;
    });

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
                <div>
                    <h2 className="text-xl font-semibold text-gray-800">Existing Users ({filteredUsers.length})</h2>
                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1 rounded-lg text-sm transition ${filter === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            All Users
                        </button>
                        <button
                            onClick={() => setFilter('teacher')}
                            className={`px-3 py-1 rounded-lg text-sm transition ${filter === 'teacher'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Teachers
                        </button>
                        <button
                            onClick={() => setFilter('student')}
                            className={`px-3 py-1 rounded-lg text-sm transition ${filter === 'student'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            Students
                        </button>
                    </div>
                </div>
                <button onClick={onAddClick} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-md">
                    <Plus size={20} className="mr-2" /> Add New User
                </button>
            </div>

            {isLoading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading users...</p>
                </div>
            ) : filteredUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-12">
                    No users found. Click "Add New User" to create one.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {user.first_name} {user.last_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phone_number || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                                            user.role === 'teacher' ? 'bg-blue-100 text-blue-800' :
                                                'bg-green-100 text-green-800'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.department || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.student_id || '-'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {user.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        {user.role !== 'admin' && (
                                            <div className="flex space-x-3">
                                                <button
                                                    onClick={() => handleEdit(user)}
                                                    className="text-blue-600 hover:text-blue-900 transition"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user.id, `${user.first_name} ${user.last_name}`)}
                                                    className="text-red-600 hover:text-red-900 transition"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Edit User Modal */}
            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    onClose={() => setEditingUser(null)}
                    onSuccess={handleUpdateSuccess}
                />
            )}
        </div>
    );
};

// New Component: Unified Table for Teacher/Student Activity Lookup
const UserActivityTable = ({ userType }) => {
    const { error } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [userData, setUserData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch users when component mounts
    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            try {
                const response = await userAPI.getAllUsers();
                // Filter by role based on userType
                const role = userType === 'Teachers' ? 'teacher' : 'student';
                const filteredUsers = response.filter(user => user.role === role);
                setUserData(filteredUsers);
            } catch (err) {
                error(`Failed to load ${userType.toLowerCase()}`);
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, [userType, error]);

    // Filter data based on search term (Name or ID/RollNo)
    const filteredData = userData.filter(user => {
        const searchLower = searchTerm.toLowerCase();
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
        const nameMatch = fullName.includes(searchLower);
        const emailMatch = user.email.toLowerCase().includes(searchLower);
        const idMatch = user.student_id ? user.student_id.toLowerCase().includes(searchLower) : false;

        return nameMatch || emailMatch || idMatch;
    });

    // Format last active date
    const formatLastActive = (lastActive) => {
        if (!lastActive) return 'Never';
        try {
            const date = new Date(lastActive);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return 'N/A';
        }
    };

    // Export to CSV functionality
    const exportToCSV = () => {
        // Prepare CSV headers with all details
        const headers = userType === 'Students'
            ? ['Sr. No.', 'Student ID', 'First Name', 'Last Name', 'Email', 'Phone Number', 'Department', 'Class/Year', 'Role', 'Created At', 'Last Active', 'Status']
            : ['Sr. No.', 'First Name', 'Last Name', 'Email', 'Phone Number', 'Department', 'Role', 'Created At', 'Last Active', 'Status'];

        // Prepare CSV rows with complete information
        const rows = filteredData.map((user, index) => {
            const createdDate = user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
            }) : 'N/A';

            if (userType === 'Students') {
                return [
                    index + 1,
                    user.student_id || 'N/A',
                    user.first_name,
                    user.last_name,
                    user.email,
                    user.phone_number || 'N/A',
                    user.department || 'N/A',
                    user.class_year || 'N/A',
                    user.role || 'student',
                    createdDate,
                    formatLastActive(user.last_active),
                    user.is_active ? 'Active' : 'Inactive'
                ];
            }

            // For teachers
            return [
                index + 1,
                user.first_name,
                user.last_name,
                user.email,
                user.phone_number || 'N/A',
                user.department || 'N/A',
                user.role || 'teacher',
                createdDate,
                formatLastActive(user.last_active),
                user.is_active ? 'Active' : 'Inactive'
            ];
        });

        // Combine headers and rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${userType.toLowerCase()}_complete_details_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">{userType} Activity Lookup</h2>
                <div className="text-sm text-gray-600">
                    Total: <span className="font-bold text-blue-600">{userData.length}</span> {userType}
                </div>
            </div>

            {/* Search Bar (Prominently placed at the top) */}
            <div className="flex items-center space-x-2 w-full max-w-lg">
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder={`Search ${userType} by Name${userType === 'Students' ? ', Roll No.' : ''} or Email...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                    <Search size={20} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                    >
                        Clear
                    </button>
                )}
            </div>

            {/* Loading State */}
            {isLoading ? (
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-500">Loading {userType.toLowerCase()}...</p>
                </div>
            ) : (
                <>
                    {/* Results Count */}
                    {searchTerm && (
                        <div className="text-sm text-gray-600">
                            Showing <span className="font-bold text-blue-600">{filteredData.length}</span> of {userData.length} {userType.toLowerCase()}
                        </div>
                    )}

                    {/* User List Table */}
                    <div className="overflow-x-auto border rounded-xl shadow-sm">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sr. No.</th>
                                    {userType === 'Students' && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Roll No.</th>}
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Class/Year</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredData.length > 0 ? filteredData.map((user, index) => (
                                    <tr key={user.id} className="hover:bg-gray-50 transition">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                                        {userType === 'Students' && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono bg-blue-50">
                                                {user.student_id || 'N/A'}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {user.first_name} {user.last_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {user.email}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.department || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {user.class_year || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatLastActive(user.last_active)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {user.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={userType === 'Students' ? 8 : 7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <UserCheck size={48} className="text-gray-300" />
                                                <p className="text-gray-500 font-medium">
                                                    {searchTerm
                                                        ? `No ${userType.toLowerCase()} found matching "${searchTerm}"`
                                                        : `No ${userType.toLowerCase()} found. Add some users to get started.`
                                                    }
                                                </p>
                                                {searchTerm && (
                                                    <button
                                                        onClick={() => setSearchTerm('')}
                                                        className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
                                                    >
                                                        Clear search
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Export/Actions */}
                    {filteredData.length > 0 && (
                        <div className="flex justify-between items-center pt-4 border-t">
                            <p className="text-sm text-gray-600">
                                Displaying {filteredData.length} {userType.toLowerCase()}
                            </p>
                            <button
                                onClick={exportToCSV}
                                className="flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md"
                            >
                                <Calendar size={16} className="mr-2" />
                                Export to CSV
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// Component for Detailed Reports Tab
const DetailedReportsTool = () => {
    // Mock data for filter options
    const departments = ['All', 'CS Engg.', 'AI', 'Mechanical', 'Electrical'];
    const years = ['All', '1st Year', '2nd Year', '3rd Year', '4th Year'];
    // const semesters = ['All', 'Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8']; // REMOVED STATIC ARRAY

    const [classYear, setClassYear] = useState(years[0]);
    const [department, setDepartment] = useState(departments[0]);
    const [semester, setSemester] = useState('All'); // Initialized to 'All'
    const [reportOutput, setReportOutput] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // --- NEW LOGIC TO CALCULATE SEMESTER OPTIONS BASED ON YEAR ---
    const availableSemesters = useMemo(() => {
        const baseOptions = ['All'];
        if (classYear === 'All') {
            return [...baseOptions, 'Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6', 'Sem 7', 'Sem 8'];
        }

        const yearMap = {
            '1st Year': [1, 2],
            '2nd Year': [3, 4],
            '3rd Year': [5, 6],
            '4th Year': [7, 8],
        };

        const yearSemesters = yearMap[classYear] || [];
        return [...baseOptions, ...yearSemesters.map(sem => `Sem ${sem}`)];
    }, [classYear]);

    // Effect to reset semester when classYear changes, if the current semester is no longer valid
    useEffect(() => {
        if (!availableSemesters.includes(semester)) {
            setSemester('All');
        }
    }, [classYear, availableSemesters, semester]);
    // -------------------------------------------------------------------


    // Function to simulate report data based on filters
    const generateMockReportData = () => {
        // Return a sample of data that Gemini will analyze
        return `Report Data for ${classYear}, ${department}, Semester ${semester}:
        - ${classYear} ${department} Average Score: 68% (5% decrease vs last month).
        - Top 3 failing topics: 'Algorithms', 'Data Structures', 'Thermodynamics'.
        - Overall Quiz completion rate: 75%.
        - 12 students achieved A+ grade.
        - Teacher Activity (CS Engg.): Prof. A has not submitted a quiz in 4 weeks.
        - Need to address low attendance in 2nd Year Electrical Engineering.`;
    };

    // Function to call the Gemini API
    const analyzeReport = async () => {
        setIsGenerating(true);
        setReportOutput(null);

        // 1. Get the mock report data (which would normally come from a database query)
        const mockData = generateMockReportData();

        // For now, using simulated analysis since Gemini API key is not provided
        // In production, you would uncomment the API call below
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API delay

        const simulatedAnalysis = `### Analysis for ${classYear} / ${department} / ${semester}
* **Targeted Remedial Action:** Focus on offering short, mandatory tutorials for students in **${classYear}** struggling with 'Algorithms' and 'Data Structures' to prevent cumulative failure.
* **Faculty Engagement Review:** Immediately follow up with **Prof. A (CS Engg.)** regarding the missing quiz submissions, as this directly impacts the overall completion rate.
* **Attendance Policy Reinforcement:** Implement a check-in process for **2nd Year Electrical Engineering** to address low attendance trends, potentially linking it to sessional marks.
* **A+ Student Utilization:** Launch a peer-tutoring initiative, leveraging the **12 A+ grade students** to mentor underperforming peers, improving overall class performance.
---
**Raw Data Preview:** ${mockData.substring(0, 100)}...`;

        setReportOutput(simulatedAnalysis);
        setIsGenerating(false);

        /* Uncomment this section when you have a Gemini API key:
        
        const apiKey = "YOUR_GEMINI_API_KEY_HERE";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
        const maxRetries = 3;
        
        const payload = {
            contents: [{
                parts: [{
                    text: `You are a world-class Educational Data Analyst. Analyze the provided report findings and generate exactly four concise, actionable recommendations for the administrative team to improve student performance and system engagement. Use simple bullet points.\n\nData: ${mockData}`
                }]
            }]
        };

        let result = null;
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                result = await response.json();
                break; // Exit loop on success
            } catch (error) {
                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                } else {
                    setReportOutput("Error: Could not fetch analysis from Gemini API.");
                    setIsGenerating(false);
                    return;
                }
            }
        }

        if (result && result.candidates?.[0]?.content?.parts?.[0]?.text) {
            setReportOutput(result.candidates[0].content.parts[0].text);
        } else {
            setReportOutput("Analysis failed or returned empty content.");
        }
        setIsGenerating(false);
        */
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Segmented Assessment Reports</h2>
            <p className="text-gray-600">
                Generate analytical reports by filtering the student results based on class structure, department, and semester.
            </p>

            {/* Input Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl border">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class/Year</label>
                    <select value={classYear} onChange={(e) => setClassYear(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-600 focus:border-blue-600">
                        {years.map(year => (<option key={year}>{year}</option>))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                    <select value={department} onChange={(e) => setDepartment(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-600 focus:border-blue-600">
                        {departments.map(dept => (<option key={dept}>{dept}</option>))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                    <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-600 focus:border-blue-600">
                        {/* UPDATED: Dynamic semester options based on classYear */}
                        {availableSemesters.map(sem => (<option key={sem}>{sem}</option>))}
                    </select>
                </div>
                <div className="flex items-end">
                    {/* Reverted primary button color to blue */}
                    <button onClick={analyzeReport} disabled={isGenerating} className="w-full flex items-center justify-center p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:bg-gray-400">
                        {isGenerating ? (
                            <div className="flex items-center">
                                <svg className="animate-spin h-5 w-5 mr-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Analyzing...
                            </div>
                        ) : (
                            <>
                                <BarChart3 size={20} className="mr-2" /> Generate Insights
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Gemini Analysis Output */}
            <div className="border-t pt-6 space-y-4">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Actionable Insights (Powered by Gemini)</h3>

                {/* Reverted BG and border to light blue */}
                <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-200 min-h-[150px] flex items-center justify-center">
                    {reportOutput ? (
                        <div className="prose max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: reportOutput.replace(/\n/g, '<br>') }} />
                    ) : (
                        <p className="text-gray-500 text-center">
                            Use the filters and click 'Generate Insights' to get immediate analysis and recommendations.
                        </p>
                    )}
                </div>
            </div>

        </div>
    );
};


// Add this component before the 'App' function
const QuizManagementTool = () => {
    const [quizView, setQuizView] = useState('active'); // active, pending, create

    // Mock data for display
    const mockQuizzes = {
        active: [
            { id: 101, title: "Data Structures Midterm", author: "Prof. Anjali D.", status: "Active", students: 120, submissions: 115, date: "Oct 25, 2025" },
            { id: 102, title: "Engineering Physics II Quiz 1", author: "Prof. Rohan B.", status: "Active", students: 95, submissions: 88, date: "Nov 1, 2025" },
        ],
        pending: [
            { id: 201, title: "Algorithms Final Exam", author: "Prof. Anjali D.", status: "Review", students: 120, submissions: 120, date: "Oct 15, 2025" },
            { id: 202, title: "Electrical Circuits Pre-Test", author: "Prof. Priya K.", status: "Review", students: 80, submissions: 75, date: "Nov 10, 2025" },
        ]
    };

    const renderQuizTable = (data, type) => (
        <div className="overflow-x-auto border rounded-xl shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quiz Title</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Author</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Students</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submissions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {data.length > 0 ? data.map((quiz) => (
                        <tr key={quiz.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{quiz.title}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quiz.author}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quiz.date}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{quiz.students}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600">{quiz.submissions}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button className="text-blue-600 hover:text-blue-900 transition mr-4">View Report</button>
                                {type === 'pending' && (
                                    <button className="text-green-600 hover:text-green-900 transition">Approve</button>
                                )}
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan="6" className="px-6 py-12 text-center text-gray-500">No quizzes found in this category.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderCreateQuiz = () => (
        <div className="p-8 border border-blue-200 bg-blue-50/50 rounded-xl space-y-6">
            <h3 className="text-xl font-bold text-blue-800 flex items-center">
                <Plus size={24} className="mr-2" /> Start a New Quiz / Exam
            </h3>
            <p className="text-gray-600">This feature is managed by individual teachers. As Admin, you can only set global parameters or launch the teacher-side interface.</p>
            <button
                onClick={() => console.log('Simulating redirect to Teacher Quiz Creation page...')}
                className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg"
            >
                <FileText size={20} className="mr-2" /> Access Quiz Creator Panel
            </button>
        </div>
    );

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">Quiz Management & Moderation</h2>

            <div className="flex space-x-3 border-b pb-4">
                <button
                    onClick={() => setQuizView('active')}
                    className={`px-4 py-2 rounded-xl font-semibold transition ${quizView === 'active' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    Active Quizzes ({mockQuizzes.active.length})
                </button>
                <button
                    onClick={() => setQuizView('pending')}
                    className={`px-4 py-2 rounded-xl font-semibold transition ${quizView === 'pending' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    Pending Review ({mockQuizzes.pending.length})
                </button>
                <button
                    onClick={() => setQuizView('create')}
                    className={`px-4 py-2 rounded-xl font-semibold transition ${quizView === 'create' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    Create Quiz
                </button>
            </div>

            {quizView === 'active' && (
                <div className="space-y-4">
                    <p className="text-gray-600">List of quizzes currently open for submissions or pending grading.</p>
                    {renderQuizTable(mockQuizzes.active, 'active')}
                </div>
            )}

            {quizView === 'pending' && (
                <div className="space-y-4">
                    <p className="text-gray-600">Quizzes submitted by teachers awaiting admin approval before being deployed.</p>
                    {renderQuizTable(mockQuizzes.pending, 'pending')}
                </div>
            )}

            {quizView === 'create' && renderCreateQuiz()}
        </div>
    );
};



// Add this component before the 'App' function
const SettingsTool = () => {
    const { success } = useToast();
    const [systemName, setSystemName] = useState('MacQuiz Learning Platform');
    const [defaultDomain, setDefaultDomain] = useState('rbmi.in');
    const [gradingScale, setGradingScale] = useState('A: 90+, B: 80-89, C: 70-79, D: 60-69, F: < 60');
    const [allowBulkUpload, setAllowBulkUpload] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = (e) => {
        e.preventDefault();
        setIsSaving(true);
        // Simulate API call delay
        setTimeout(() => {
            setIsSaving(false);
            success("System settings updated successfully!");
        }, 1500);
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 space-y-8">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
                <Settings size={28} className="mr-2 text-blue-600" /> System Configuration
            </h2>
            <p className="text-gray-600">Adjust core parameters for the platform, user management, and grading policies.</p>

            <form onSubmit={handleSave} className="space-y-6">

                {/* General Settings */}
                <div className="border p-6 rounded-xl bg-gray-50 space-y-4">
                    <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">General System Settings</h3>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Platform Name</label>
                        <input
                            type="text"
                            value={systemName}
                            onChange={(e) => setSystemName(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Default Email Domain (for new users)</label>
                        <input
                            type="text"
                            value={defaultDomain}
                            onChange={(e) => setDefaultDomain(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g., example.edu"
                            required
                        />
                    </div>
                </div>

                {/* Grading & Policy Settings */}
                <div className="border p-6 rounded-xl bg-gray-50 space-y-4">
                    <h3 className="text-xl font-semibold text-gray-800 border-b pb-2">User & Grading Policy</h3>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Global Grading Scale</label>
                        <textarea
                            value={gradingScale}
                            onChange={(e) => setGradingScale(e.target.value)}
                            rows="4"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Define letter grades and score ranges"
                            required
                        ></textarea>
                        <p className="text-xs text-gray-500 mt-1">This scale is applied to final report generation.</p>
                    </div>

                    <div className="flex items-center pt-2">
                        <input
                            type="checkbox"
                            name="allow_bulk_upload"
                            checked={allowBulkUpload}
                            onChange={(e) => setAllowBulkUpload(e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-gray-700">
                            Enable **Bulk User Upload** (Allow importing users via CSV)
                        </label>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={20} className="mr-2" /> Save Settings
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};


//import { Maximize2, Clock, Calendar, CheckSquare, List, UploadCloud } from 'lucide-react';

// Mock API functions for quizzes
const quizAPI = {
    createQuiz: (quizData) => new Promise((resolve) => {
        setTimeout(() => {
            console.log("Mock API: Creating Quiz", quizData);
            resolve({ id: Math.floor(Math.random() * 1000), ...quizData });
        }, 800);
    }),
};

const CreateNewQuizForm = ({ onQuizCreated, onCancel }) => {
    const { success, error } = useToast();
    const [formData, setFormData] = useState({
        title: '',
        department: '',
        class_year: '1st Year',
        duration_minutes: 60,
        total_questions: 20,
        start_date: new Date().toISOString().split('T')[0],
        requires_approval: true,
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const mockDepartments = ['Computer Science Engg.', 'Artificial Intelligence', 'Mechanical Engineering', 'Electrical Engineering'];
    const mockYears = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData({
            ...formData,
            [name]: type === 'checkbox' ? checked : value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Simple validation
        if (formData.title.length < 5) {
            error("Quiz title must be at least 5 characters long.");
            setIsSubmitting(false);
            return;
        }

        try {
            // Note: In a real app, 'author' (teacher ID) would be dynamically added here
            const response = await quizAPI.createQuiz({ ...formData, author_id: "ADMIN_001" });

            success(`Quiz '${response.title}' created successfully! It is now pending teacher or admin approval.`);
            onQuizCreated();
            onCancel();

        } catch (err) {
            console.error(err);
            error("Failed to create quiz. Please check the form data.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
            <h3 className="text-2xl font-bold text-blue-800 mb-6 flex items-center">
                <Plus size={24} className="mr-2" /> Define New Quiz Structure
            </h3>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quiz/Exam Title *</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            placeholder="e.g., Semester 1 Midterm Exam - CS 201"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                            <List size={16} className="mr-1 text-gray-500" /> Department Target
                        </label>
                        <select
                            name="department"
                            value={formData.department}
                            onChange={handleInputChange}
                            required
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Select Department</option>
                            {mockDepartments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                            <Maximize2 size={16} className="mr-1 text-gray-500" /> Class/Year Target
                        </label>
                        <select
                            name="class_year"
                            value={formData.class_year}
                            onChange={handleInputChange}
                            required
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                        >
                            {mockYears.map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Timing and Questions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                            <Clock size={16} className="mr-1 text-gray-500" /> Duration (Minutes)
                        </label>
                        <input
                            type="number"
                            name="duration_minutes"
                            value={formData.duration_minutes}
                            onChange={handleInputChange}
                            min="1"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                            <CheckSquare size={16} className="mr-1 text-gray-500" /> Total Questions
                        </label>
                        <input
                            type="number"
                            name="total_questions"
                            value={formData.total_questions}
                            onChange={handleInputChange}
                            min="1"
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                            <Calendar size={16} className="mr-1 text-gray-500" /> Deployment Date
                        </label>
                        <input
                            type="date"
                            name="start_date"
                            value={formData.start_date}
                            onChange={handleInputChange}
                            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>
                </div>

                {/* Settings */}
                <div className="flex items-center pt-2">
                    <input
                        type="checkbox"
                        name="requires_approval"
                        checked={formData.requires_approval}
                        onChange={handleInputChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm font-medium text-gray-700">
                        Quiz requires **Final Admin Approval** before deployment.
                    </label>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-4 border-t">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex items-center px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-100 transition"
                    >
                        <X size={20} className="mr-2" /> Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-md disabled:bg-gray-400"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                Submitting...
                            </>
                        ) : (
                            <>
                                <UploadCloud size={20} className="mr-2" /> Submit for Review
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};


// quiz review model


const ReviewQuizModal = ({ quiz, onClose, onActionSuccess }) => {
    const { success, error } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleApprove = async () => {
        setIsProcessing(true);
        try {
            // Simulate an API call to approve the quiz
            await new Promise(resolve => setTimeout(resolve, 1000));
            success(`Quiz '${quiz.title}' approved and marked ready for deployment.`);
            onActionSuccess();
        } catch (err) {
            console.error(err);
            error("Failed to approve quiz.");
        } finally {
            setIsProcessing(false);
            onClose();
        }
    };

    const handleReject = async () => {
        if (!window.confirm(`Are you sure you want to reject and archive '${quiz.title}'?`)) return;

        setIsProcessing(true);
        try {
            // Simulate an API call to reject/archive the quiz
            await new Promise(resolve => setTimeout(resolve, 1000));
            success(`Quiz '${quiz.title}' rejected and sent back to the author.`);
            onActionSuccess();
        } catch (err) {
            console.error(err);
            error("Failed to reject quiz.");
        } finally {
            setIsProcessing(false);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100">

                {/* Header */}
                <div className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white p-6 rounded-t-2xl flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center">
                            <ClipboardList size={24} className="mr-2" /> Review Quiz: {quiz.title}
                        </h2>
                        <p className="text-yellow-100 text-sm mt-1">Final administrative check before setting active.</p>
                    </div>
                    <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-full transition" disabled={isProcessing}>
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Quiz Details */}
                    <div className="grid grid-cols-2 gap-4 border p-4 rounded-lg bg-gray-50">
                        <p className="text-sm font-medium text-gray-700">Author: <span className="font-semibold text-gray-900">{quiz.author}</span></p>
                        <p className="text-sm font-medium text-gray-700">Department: <span className="font-semibold text-gray-900">{quiz.department || 'N/A'}</span></p>
                        <p className="text-sm font-medium text-gray-700">Date Proposed: <span className="font-semibold text-gray-900">{quiz.date}</span></p>
                        <p className="text-sm font-medium text-gray-700">Duration: <span className="font-semibold text-gray-900">{quiz.duration_minutes || '60'} mins</span></p>
                        <p className="text-sm font-medium text-gray-700">Total Questions: <span className="font-semibold text-gray-900">{quiz.total_questions || '20'}</span></p>
                        <p className="text-sm font-medium text-gray-700">Status: <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">{quiz.status}</span></p>
                    </div>

                    {/* Content Preview (Mock) */}
                    <div className="border border-dashed border-gray-300 p-4 rounded-lg bg-white">
                        <h3 className="text-lg font-bold text-gray-800 mb-3">Quiz Content Preview (Mock)</h3>
                        <p className="text-sm text-gray-600 italic">
                            [Simulated Preview: Question 1: What is the complexity of QuickSort in the worst case? (Option A: O(n log n), Option B: O(n²), Option C: O(n))...]
                        </p>
                        <p className="text-xs text-red-500 mt-2">
                            ⚠️ Admin should manually verify all content and security settings before approving.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end space-x-4 pt-4 border-t">
                        <button
                            type="button"
                            onClick={handleReject}
                            disabled={isProcessing}
                            className="flex items-center px-4 py-2 border border-red-300 rounded-xl text-red-700 hover:bg-red-50 transition disabled:opacity-50"
                        >
                            <X size={20} className="mr-2" /> Reject & Archive
                        </button>
                        <button
                            type="button"
                            onClick={handleApprove}
                            disabled={isProcessing}
                            className="flex items-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition shadow-md disabled:bg-gray-400"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                                    Approving...
                                </>
                            ) : (
                                <>
                                    <CheckCircle size={20} className="mr-2" /> Approve Quiz
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};



/**
 * --- MAIN APPLICATION COMPONENT (Admin Dashboard) ---
 */
export default function App() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const { success } = useToast();

    // userViewMode can be 'list' (show table) or 'add' (show form)
    const [activeTab, setActiveTab] = useState('Dashboard');
    const [userViewMode, setUserViewMode] = useState('list');
    const [userListRefresh, setUserListRefresh] = useState(0);
    const [allUsers, setAllUsers] = useState([]);
    const [statsLoading, setStatsLoading] = useState(true);

    // Fetch all users for dashboard stats
    useEffect(() => {
        const fetchDashboardStats = async () => {
            setStatsLoading(true);
            try {
                const users = await userAPI.getAllUsers();
                setAllUsers(users);
            } catch (err) {
                // Silently fail, will show 0 counts
                console.error(err);

            } finally {
                setStatsLoading(false);
            }
        };

        fetchDashboardStats();
    }, [userListRefresh]); // Re-fetch when users are added/deleted

    // Calculate dynamic stats from real user data
    const dynamicStats = useMemo(() => {
        const totalStudents = allUsers.filter(u => u.role === 'student').length;
        const totalTeachers = allUsers.filter(u => u.role === 'teacher').length;
        const totalUsers = allUsers.length;

        return [
            {
                title: "Total Quizzes Held",
                value: "0",
                icon: FileText,
                color: "bg-blue-100/50 text-blue-800",
                subtitle: "No quizzes created yet",
                trend: "N/A"
            },
            {
                title: "Total Students",
                value: totalStudents.toString(),
                icon: UserCheck,
                color: "bg-indigo-100/50 text-indigo-800",
                subtitle: `${totalStudents} student${totalStudents !== 1 ? 's' : ''} registered`,
                trend: totalStudents > 0 ? `+${totalStudents}` : "N/A"
            },
            {
                title: "Total Teachers",
                value: totalTeachers.toString(),
                icon: Users,
                color: "bg-green-100/50 text-green-800",
                subtitle: `${totalTeachers} teacher${totalTeachers !== 1 ? 's' : ''} registered`,
                trend: totalTeachers > 0 ? `+${totalTeachers}` : "N/A"
            },
            {
                title: "Total Users",
                value: totalUsers.toString(),
                icon: Zap,
                color: "bg-yellow-100/50 text-yellow-800",
                subtitle: `${totalUsers} user${totalUsers !== 1 ? 's' : ''} in system`,
                trend: totalUsers > 0 ? `+${totalUsers}` : "N/A"
            },
        ];
    }, [allUsers]);

    const handleLogout = () => {
        if (window.confirm('Are you sure you want to logout?')) {
            logout();
            success('Logged out successfully');
            navigate('/');
        }
    };

    // Handler when user is created successfully
    const handleUserCreated = () => {
        setUserListRefresh(prev => prev + 1); // Trigger refresh
    };

    // NOTE: Removed 'Activity Tracker' and replaced with dedicated 'Teachers' and 'Students' links.
    const navItems = [
        { name: "Dashboard", icon: LayoutDashboard, title: "Dashboard" },
        { name: "Users", icon: Users, title: "User Management", onClick: () => setUserViewMode('list') },
        { name: "Teachers", icon: Users, title: "Teacher Activity Lookup" }, // NEW DEDICATED LINK
        { name: "Students", icon: Users, title: "Student Activity Lookup" }, // NEW DEDICATED LINK
        { name: "Quizzes", icon: FileText, title: "Quiz Management" },
        { name: "Detailed Reports", icon: BarChart3, title: "Detailed Reports" },
        { name: "Settings", icon: Settings, title: "Settings" },
    ];

    // Handler to switch to Users tab and open the Add User form immediately
    const handleAddNewUser = () => {
        setActiveTab('Users');
        setUserViewMode('add');
    };

    const getCurrentTitle = () => {
        if (activeTab === 'Users' && userViewMode === 'add') {
            return 'Add New User';
        }
        const currentItem = navItems.find(item => item.name === activeTab);
        return currentItem ? currentItem.title : activeTab;
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'Dashboard': { // Added braces to fix no-case-declarations
                const hasActivity = mockActivity.length > 0;
                return (
                    <div className="space-y-8">
                        {/* 4 Block Metrics (Colors reverted) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {statsLoading ? (
                                // Loading skeleton
                                Array.from({ length: 4 }).map((_, idx) => (
                                    <div key={idx} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 animate-pulse">
                                        <div className="flex items-center justify-between">
                                            <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                                            <div className="h-4 w-24 bg-gray-200 rounded"></div>
                                        </div>
                                        <div className="mt-4">
                                            <div className="h-10 w-20 bg-gray-200 rounded"></div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                dynamicStats.map((stat) => (
                                    <StatCard key={stat.title} {...stat} />
                                ))
                            )}
                        </div>
                        {/* Quick Access Card (BG reverted) */}
                        <AddNewUserCard onAddClick={handleAddNewUser} />

                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                            <h2 className="text-xl font-semibold text-gray-800 border-b pb-4 mb-4">
                                Recent System Activity
                            </h2>
                            <div className="space-y-2">
                                {hasActivity ? (
                                    mockActivity.map((activity) => (
                                        <ActivityItem key={activity.id} {...activity} />
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-500 text-lg">
                                        No activity recorded yet. Start by provisioning users and creating quizzes!
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            } // Added braces to fix no-case-declarations
            case 'Users':
                return userViewMode === 'add' ? (
                    <UserCreationForm
                        onCancel={() => setUserViewMode('list')}
                        onUserCreated={handleUserCreated}
                    />
                ) : (
                    <UserList
                        onAddClick={() => setUserViewMode('add')}
                        refreshTrigger={userListRefresh}
                    />
                );
            // NEW CASES for dedicated sidebar links
            case 'Teachers':
                return <UserActivityTable userType="Teachers" />;
            case 'Students':
                return <UserActivityTable userType="Students" />;

            // 🚀 UPDATED: Use the dedicated QuizManagementTool component
            case 'Quizzes':
                return <QuizManagementTool />;

            case 'Detailed Reports':
                return <DetailedReportsTool />;

            // ⚙️ UPDATED: Use the dedicated SettingsTool component
            case 'Settings':
                return <SettingsTool />;

            default:
                return <Placeholder content="Page Not Found" />;
        }
    };

    // Generic placeholder component for unimplemented tabs
    const Placeholder = ({ content }) => (
        <div className="bg-white p-12 rounded-2xl shadow-lg border border-gray-100 text-center text-gray-500 h-96 flex items-center justify-center">
            <p className="text-2xl font-medium max-w-lg">{content}</p>
        </div>
    );

    return (
        <div className="min-h-screen flex bg-gray-50 font-inter">
            {/* Sidebar Navigation */}
            <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 bg-white border-r shadow-lg z-20">
                <div className="p-6 text-2xl font-extrabold text-blue-700 border-b">
                    MacQuiz <span className="text-gray-400 font-light">Admin</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = activeTab === item.name;
                        return (
                            <button
                                key={item.name}
                                onClick={() => {
                                    setActiveTab(item.name);
                                    if (item.onClick) item.onClick();
                                }}
                                className={`w-full flex items-center p-3 rounded-xl transition duration-150 text-left space-x-3
                                    ${isActive
                                        ? 'bg-blue-600 text-white shadow-md' // Active: Blue BG, White Text
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-blue-600' // Hover: Light Gray BG, Blue Text
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

            {/* Main Content Area */}
            <main className="flex-1 lg:ml-64 p-4 md:p-8">
                {/* Header/Title with Profile Avatar */}
                <header className="mb-8 flex justify-between items-start">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900">
                            {getCurrentTitle()}
                        </h1>
                        <p className="text-gray-500 mt-1">
                            {activeTab === 'Dashboard' ? "System overview and quick access actions." : "Detailed views and management tools."}
                        </p>
                    </div>

                    {/* Profile Panel (Top Right) */}
                    <div className="flex flex-col items-end space-y-1">
                        {/* Reverted profile avatar BG to blue */}
                        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-md cursor-pointer hover:ring-4 ring-blue-300 transition duration-150">
                            AD
                        </div>
                        <p className="text-sm font-semibold text-gray-800">Administrator</p>
                        <p className="text-xs text-gray-500">Admin ID: 001</p>
                    </div>
                </header>

                {renderContent()}
            </main>
        </div>
    );
}