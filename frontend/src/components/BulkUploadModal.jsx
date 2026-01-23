import React, { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
import { X, Upload, Download, CheckCircle, AlertCircle, Users, FileText, Eye, AlertTriangle } from 'lucide-react';

const BulkUploadModal = ({ isOpen, onClose, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [previewData, setPreviewData] = useState([]);
    const [validationResults, setValidationResults] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [showPreview, setShowPreview] = useState(false);

    if (!isOpen) return null;

    const parseCSV = (text) => {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) return { headers: [], rows: [] };

        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map((line, index) => {
            const values = line.split(',').map(v => v.trim());
            const row = {};
            headers.forEach((header, i) => {
                row[header] = values[i] || '';
            });
            row._rowNumber = index + 2; // +2 because header is row 1
            return row;
        });

        return { headers, rows };
    };

    const validateData = (rows, existingEmails = [], existingStudentIds = []) => {
        const errors = [];
        const warnings = [];
        const validRows = [];
        const skippedRows = [];
        const duplicateEmails = new Set();
        const duplicateStudentIds = new Set();
        const fileEmails = new Set();
        const fileStudentIds = new Set();

        rows.forEach((row, index) => {
            const rowErrors = [];
            const rowWarnings = [];
            let willBeSkipped = false;

            // Check required fields
            if (!row.role) rowErrors.push('Role is required');
            if (!row.first_name) rowErrors.push('First name is required');
            if (!row.last_name) rowErrors.push('Last name is required');
            if (!row.email) rowErrors.push('Email is required');
            if (!row.password) rowErrors.push('Password is required');

            // Validate role
            if (row.role && !['student', 'teacher', 'admin'].includes(row.role.toLowerCase())) {
                rowErrors.push('Role must be student, teacher, or admin');
            }

            // Check email format
            if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
                rowErrors.push('Invalid email format');
            }

            // Validate phone number format if provided
            if (row.phone_number && row.phone_number.trim()) {
                const phoneRegex = /^[\d\s\-\+\(\)]+$/;
                if (!phoneRegex.test(row.phone_number)) {
                    rowErrors.push('Invalid phone number format (use digits, spaces, +, -, ( ) only)');
                } else if (row.phone_number.replace(/\D/g, '').length < 10) {
                    rowWarnings.push('Phone number should have at least 10 digits');
                }
            }

            // Check for duplicates within file
            if (row.email) {
                if (fileEmails.has(row.email.toLowerCase())) {
                    duplicateEmails.add(row.email.toLowerCase());
                    rowErrors.push('Duplicate email in file');
                } else {
                    fileEmails.add(row.email.toLowerCase());
                }

                // Check against existing emails - CHANGED TO WARNING instead of ERROR
                if (existingEmails.includes(row.email.toLowerCase())) {
                    rowWarnings.push('Email already exists - will be skipped');
                    willBeSkipped = true;
                }
            }

            // Student-specific validation
            if (row.role && row.role.toLowerCase() === 'student') {
                if (!row.student_id) {
                    rowErrors.push('Student ID is required for students');
                } else {
                    // Check for duplicates within file
                    if (fileStudentIds.has(row.student_id)) {
                        duplicateStudentIds.add(row.student_id);
                        rowErrors.push('Duplicate student ID in file');
                    } else {
                        fileStudentIds.add(row.student_id);
                    }

                    // Check against existing student IDs - CHANGED TO WARNING instead of ERROR
                    if (existingStudentIds.includes(row.student_id)) {
                        rowWarnings.push('Student ID already exists - will be skipped');
                        willBeSkipped = true;
                    }
                }

                if (!row.class_year) {
                    rowWarnings.push('Class/Year is recommended for students');
                }
            }

            // Department warning
            if (!row.department) {
                rowWarnings.push('Department is recommended');
            }

            // Password strength validation
            if (row.password && row.password.length < 6) {
                rowWarnings.push('Password should be at least 6 characters');
            }

            // Add to valid rows only if no critical errors and not skipped
            if (rowErrors.length === 0 && !willBeSkipped) {
                validRows.push(row);
            } else if (willBeSkipped && rowErrors.length === 0) {
                skippedRows.push(row);
            }

            if (rowErrors.length > 0 || rowWarnings.length > 0) {
                (rowErrors.length > 0 ? errors : warnings).push({
                    row: row._rowNumber,
                    data: row,
                    issues: rowErrors.length > 0 ? rowErrors : rowWarnings,
                    type: rowErrors.length > 0 ? 'error' : 'warning'
                });
            }
        });

        return {
            valid: validRows,
            errors,
            warnings,
            skippedRows,
            duplicateEmails: Array.from(duplicateEmails),
            duplicateStudentIds: Array.from(duplicateStudentIds),
            totalRows: rows.length,
            validCount: validRows.length,
            errorCount: errors.length,
            warningCount: warnings.length,
            skippedCount: skippedRows.length
        };
    };

    const handleFileChange = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        if (!selectedFile.name.endsWith('.csv')) {
            alert('Please upload a CSV file');
            return;
        }

        setFile(selectedFile);
        setIsProcessing(true);

        try {
            const text = await selectedFile.text();
            const { rows } = parseCSV(text);
            
            setPreviewData(rows);

            // Fetch existing users to check for duplicates
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_BASE_URL}/api/v1/users/`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const existingUsers = await response.json();
                const existingEmails = existingUsers.map(u => u.email.toLowerCase());
                const existingStudentIds = existingUsers
                    .filter(u => u.student_id)
                    .map(u => u.student_id);

                const validation = validateData(rows, existingEmails, existingStudentIds);
                setValidationResults(validation);
                setShowPreview(true);
            } else {
                // If can't fetch users, still validate file structure
                const validation = validateData(rows);
                setValidationResults(validation);
                setShowPreview(true);
            }
        } catch (error) {
            alert('Error reading file: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUpload = async () => {
        if (!file || !validationResults || validationResults.errorCount > 0) {
            return;
        }

        setIsProcessing(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = localStorage.getItem('access_token');
            
            // Simulate progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90));
            }, 200);

            const response = await fetch(`${API_BASE_URL}/api/v1/users/bulk-upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            clearInterval(progressInterval);
            setUploadProgress(100);

            const result = await response.json();

            if (response.ok) {
                setTimeout(() => {
                    onSuccess(result);
                    handleClose();
                }, 500);
            } else {
                alert(result.detail || 'Upload failed');
            }
        } catch (error) {
            alert('Upload failed: ' + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setPreviewData([]);
        setValidationResults(null);
        setShowPreview(false);
        setUploadProgress(0);
        onClose();
    };

    const downloadTemplate = () => {
        const csvContent = `role,first_name,last_name,email,password,phone_number,student_id,department,class_year
student,John,Doe,john.doe@example.com,password123,+1234567890,CS001,Computer Science Engg.,1st Year
student,Jane,Smith,jane.smith@example.com,password123,9876543210,CS002,Computer Science Engg.,2nd Year
teacher,Alice,Johnson,alice.johnson@example.com,password123,+1-555-0100,,Mathematics,
teacher,Bob,Williams,bob.williams@example.com,password123,555-0200,,Physics,
student,Charlie,Brown,charlie.brown@example.com,password123,(555) 123-4567,EE001,Electrical Engineering,3rd Year`;
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bulk_users_template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const getSummaryColor = () => {
        if (!validationResults) return 'gray';
        if (validationResults.errorCount > 0) return 'red';
        if (validationResults.warningCount > 0) return 'yellow';
        return 'green';
    };

    const canUpload = validationResults && validationResults.errorCount === 0 && validationResults.validCount > 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Users size={28} />
                        <div>
                            <h2 className="text-2xl font-bold">Bulk User Upload</h2>
                            <p className="text-blue-100 text-sm">Upload multiple users at once via CSV file</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleClose} 
                        className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition"
                        disabled={isProcessing}
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Template Download Section */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                            <FileText size={24} className="text-blue-600 mt-1" />
                            <div>
                                <h3 className="font-semibold text-gray-800 mb-1">Need a template?</h3>
                                <p className="text-sm text-gray-600">
                                    Download our CSV template with sample data and instructions to get started quickly.
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={downloadTemplate}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md whitespace-nowrap"
                        >
                            <Download size={18} className="mr-2" />
                            Download Template
                        </button>
                    </div>

                    {/* File Upload Section */}
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-400 transition">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                            id="csvFileInput"
                            disabled={isProcessing}
                        />
                        <label 
                            htmlFor="csvFileInput" 
                            className={`cursor-pointer ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                            <p className="text-lg font-semibold text-gray-700 mb-2">
                                {file ? file.name : 'Click to upload or drag and drop'}
                            </p>
                            <p className="text-sm text-gray-500">
                                CSV files only • Max 1000 users per upload
                            </p>
                        </label>
                    </div>

                    {/* Validation Summary */}
                    {validationResults && (
                        <div className={`border-l-4 rounded-lg p-4 ${
                            getSummaryColor() === 'green' ? 'bg-green-50 border-green-500' :
                            getSummaryColor() === 'yellow' ? 'bg-yellow-50 border-yellow-500' :
                            getSummaryColor() === 'red' ? 'bg-red-50 border-red-500' :
                            'bg-gray-50 border-gray-500'
                        }`}>
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <h3 className="font-bold text-lg text-gray-800 mb-3">Validation Summary</h3>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                            <p className="text-2xl font-bold text-gray-800">{validationResults.totalRows}</p>
                                            <p className="text-xs text-gray-600">Total Rows</p>
                                        </div>
                                        <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                            <p className="text-2xl font-bold text-green-600">{validationResults.validCount}</p>
                                            <p className="text-xs text-gray-600">Will Upload</p>
                                        </div>
                                        <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                            <p className="text-2xl font-bold text-blue-600">{validationResults.skippedCount || 0}</p>
                                            <p className="text-xs text-gray-600">Will Skip</p>
                                        </div>
                                        <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                            <p className="text-2xl font-bold text-red-600">{validationResults.errorCount}</p>
                                            <p className="text-xs text-gray-600">Errors</p>
                                        </div>
                                        <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                                            <p className="text-2xl font-bold text-yellow-600">{validationResults.warningCount}</p>
                                            <p className="text-xs text-gray-600">Warnings</p>
                                        </div>
                                    </div>                                    {/* Duplicate Alerts */}
                                    {validationResults.duplicateEmails.length > 0 && (
                                        <div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
                                            <p className="text-sm font-semibold text-red-800 flex items-center">
                                                <AlertTriangle size={16} className="mr-2" />
                                                Duplicate Emails Detected: {validationResults.duplicateEmails.join(', ')}
                                            </p>
                                        </div>
                                    )}
                                    {validationResults.duplicateStudentIds.length > 0 && (
                                        <div className="mt-2 p-3 bg-red-100 border border-red-300 rounded-lg">
                                            <p className="text-sm font-semibold text-red-800 flex items-center">
                                                <AlertTriangle size={16} className="mr-2" />
                                                Duplicate Student IDs: {validationResults.duplicateStudentIds.join(', ')}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preview Toggle */}
                    {validationResults && (
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="flex items-center text-blue-600 hover:text-blue-700 font-semibold"
                        >
                            <Eye size={20} className="mr-2" />
                            {showPreview ? 'Hide' : 'Show'} Data Preview & Issues
                        </button>
                    )}

                    {/* Data Preview */}
                    {showPreview && validationResults && (
                        <div className="space-y-4">
                            {/* Valid Rows Preview */}
                            {validationResults.valid.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                                        <CheckCircle size={20} className="text-green-600 mr-2" />
                                        Valid Rows ({validationResults.valid.length})
                                    </h4>
                                    <div className="overflow-x-auto border rounded-lg max-h-60">
                                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                                            <thead className="bg-green-50 sticky top-0">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Row</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Role</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Name</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Email</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Phone</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Student ID</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Department</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {validationResults.valid.slice(0, 10).map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 text-gray-500">{row._rowNumber}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`px-2 py-1 text-xs rounded-full ${
                                                                row.role === 'student' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                                                            }`}>
                                                                {row.role}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 font-medium">{row.first_name} {row.last_name}</td>
                                                        <td className="px-3 py-2 text-gray-600">{row.email}</td>
                                                        <td className="px-3 py-2 text-gray-600">{row.phone_number || '-'}</td>
                                                        <td className="px-3 py-2 text-gray-600">{row.student_id || '-'}</td>
                                                        <td className="px-3 py-2 text-gray-600">{row.department || '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {validationResults.valid.length > 10 && (
                                            <div className="text-center py-2 text-sm text-gray-500 bg-gray-50">
                                                ... and {validationResults.valid.length - 10} more valid rows
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Skipped Rows (Existing Users) */}
                            {validationResults.skippedRows && validationResults.skippedRows.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                                        <AlertCircle size={20} className="text-blue-600 mr-2" />
                                        Skipped Rows - Already Exist ({validationResults.skippedRows.length})
                                    </h4>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {validationResults.skippedRows.slice(0, 5).map((row, idx) => (
                                            <div key={idx} className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="font-semibold text-blue-800">Row {row._rowNumber}</p>
                                                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">SKIPPED</span>
                                                </div>
                                                <p className="text-sm text-gray-700">
                                                    {row.first_name} {row.last_name} ({row.email})
                                                    {row.phone_number && ` • ${row.phone_number}`}
                                                </p>
                                                <p className="text-xs text-blue-700 mt-1">
                                                    ℹ️ This user already exists in the system and will be skipped
                                                </p>
                                            </div>
                                        ))}
                                        {validationResults.skippedRows.length > 5 && (
                                            <div className="text-center py-2 text-sm text-gray-500 bg-blue-50 rounded">
                                                ... and {validationResults.skippedRows.length - 5} more skipped rows
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {validationResults.errors.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                                        <AlertCircle size={20} className="text-red-600 mr-2" />
                                        Errors ({validationResults.errors.length})
                                    </h4>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {validationResults.errors.map((error, idx) => (
                                            <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="font-semibold text-red-800">Row {error.row}</p>
                                                    <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">ERROR</span>
                                                </div>
                                                <p className="text-sm text-gray-700 mb-1">
                                                    {error.data.first_name} {error.data.last_name} ({error.data.email})
                                                    {error.data.phone_number && ` • ${error.data.phone_number}`}
                                                </p>
                                                <ul className="list-disc list-inside text-sm text-red-700">
                                                    {error.issues.map((issue, i) => (
                                                        <li key={i}>{issue}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Warnings */}
                            {validationResults.warnings.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
                                        <AlertCircle size={20} className="text-yellow-600 mr-2" />
                                        Warnings ({validationResults.warnings.length})
                                    </h4>
                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {validationResults.warnings.map((warning, idx) => (
                                            <div key={idx} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className="font-semibold text-yellow-800">Row {warning.row}</p>
                                                    <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded">WARNING</span>
                                                </div>
                                                <p className="text-sm text-gray-700 mb-1">
                                                    {warning.data.first_name} {warning.data.last_name} ({warning.data.email})
                                                    {warning.data.phone_number && ` • ${warning.data.phone_number}`}
                                                </p>
                                                <ul className="list-disc list-inside text-sm text-yellow-700">
                                                    {warning.issues.map((issue, i) => (
                                                        <li key={i}>{issue}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Progress Bar */}
                    {isProcessing && uploadProgress > 0 && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Uploading...</span>
                                <span className="text-gray-600">{uploadProgress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${uploadProgress}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t p-6 bg-gray-50 flex justify-between items-center">
                    <div className="text-sm space-y-1">
                        {canUpload && validationResults && (
                            <>
                                <p className="flex items-center text-green-600 font-semibold">
                                    <CheckCircle size={16} className="mr-1" />
                                    Ready to upload {validationResults.validCount} new user{validationResults.validCount !== 1 ? 's' : ''}
                                </p>
                                {validationResults.skippedCount > 0 && (
                                    <p className="flex items-center text-blue-600 text-xs">
                                        ℹ️ {validationResults.skippedCount} existing user{validationResults.skippedCount !== 1 ? 's' : ''} will be skipped
                                    </p>
                                )}
                            </>
                        )}
                        {validationResults && validationResults.errorCount > 0 && (
                            <p className="flex items-center text-red-600 font-semibold">
                                <AlertCircle size={16} className="mr-1" />
                                Please fix {validationResults.errorCount} error{validationResults.errorCount !== 1 ? 's' : ''} before uploading
                            </p>
                        )}
                    </div>
                    <div className="flex space-x-3">
                        <button
                            onClick={handleClose}
                            disabled={isProcessing}
                            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpload}
                            disabled={!canUpload || isProcessing}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Upload size={20} className="mr-2" />
                                    Upload Users
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BulkUploadModal;
