import React, { useState } from "react";
import { useToast } from "../context/ToastContext";
import { userAPI } from "../services/api";
import BulkUploadModal from "./BulkUploadModal";
import {
    X, Save, Upload, Eye, EyeOff, RefreshCw, Key, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { validatePasswordStrength, generateStrongPassword, validateEmailDomain } from "../utils/formUtils";

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

export default UserCreationForm;
