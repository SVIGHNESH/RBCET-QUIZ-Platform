# Bulk User Upload Guide

## Overview
The Bulk User Upload feature allows administrators to import multiple users at once using a CSV file. This is ideal for quickly onboarding entire classes, departments, or groups of users.

## Features

### ✨ Real-time Validation
- **Instant feedback** on file upload
- **Field validation** for all required and optional fields
- **Format checking** for emails, phone numbers, and other fields
- **Duplicate detection** within the file and against existing users

### 🔍 Duplicate Detection
- **Email duplicates**: Checks against existing users in database
- **Student ID duplicates**: Prevents duplicate student IDs
- **In-file duplicates**: Detects duplicates within the uploaded CSV

### 👁️ Preview Before Upload
- **Visual table preview** of valid rows
- **Error display** with specific row numbers and issues
- **Warning display** for non-critical issues
- **Summary statistics**: Total rows, valid, errors, warnings

### 📊 Validation Summary
- **Total Rows**: Number of rows in CSV
- **Valid Rows**: Rows ready to be imported
- **Errors**: Critical issues preventing import
- **Warnings**: Non-critical recommendations

### 📝 Detailed Error Reporting
- **Line numbers** for each error/warning
- **Specific error messages** for each issue
- **User information** displayed for context
- **Multiple issues** per row listed clearly

## CSV File Format

### Required Headers
```csv
role,first_name,last_name,email,password,phone_number,user_id,department,class_year
```

### Field Descriptions

| Field | Required | Description | Example |
|-------|----------|-------------|---------|
| **role** | ✅ Yes | User role: `student`, `teacher`, or `admin` | `student` |
| **first_name** | ✅ Yes | First name | `John` |
| **last_name** | ✅ Yes | Last name | `Doe` |
| **email** | ✅ Yes | Valid email address (must be unique) | `john.doe@example.com` |
| **password** | ✅ Yes | Temporary password (min 6 characters recommended) | `password123` |
| **phone_number** | ❌ No | Phone number (optional, validated format) | `+1234567890` or `(555) 123-4567` |
| **user_id** | ⚠️ Conditional | Required for students only (must be unique) | `CS001` |
| **department** | ❌ No | Department name (recommended) | `Computer Science Engg.` |
| **class_year** | ❌ No | Class/Year for students | `1st Year` |

### Sample CSV File
