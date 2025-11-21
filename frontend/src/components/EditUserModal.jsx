import React, { useState } from "react";
import { useToast } from "../context/ToastContext";
import { userAPI } from "../services/api";
import {
    X, Save, Eye, EyeOff, RefreshCw, Key, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { validatePasswordStrength, generateStrongPassword } from "../utils/formUtils";

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

export default EditUserModal;
