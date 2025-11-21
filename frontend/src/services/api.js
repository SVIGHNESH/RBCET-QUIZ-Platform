const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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
        const response = await fetch(url, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new APIError(
                errorData.detail || `HTTP ${response.status}`,
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
        throw new APIError(error.message, 0, {});
    }
}

export const authAPI = {
    login: async (email, password) => {
        const formData = new URLSearchParams();
        formData.append('username', email);
        formData.append('password', password);

        const response = await fetchAPI('/api/v1/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData,
            skipAuth: true,
        });

        localStorage.setItem('access_token', response.access_token);
        return response;
    },

    logout: () => {
        localStorage.removeItem('access_token');
    },
};

export const userAPI = {
    getCurrentUser: () => fetchAPI('/api/v1/users/me'),
    getAllUsers: () => fetchAPI('/api/v1/users/'),
    getUser: (id) => fetchAPI(`/api/v1/users/${id}`),
    createUser: (userData) => fetchAPI('/api/v1/users/', {
        method: 'POST',
        body: JSON.stringify(userData),
    }),
    updateUser: (id, userData) => fetchAPI(`/api/v1/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
    }),
    deleteUser: (id) => fetchAPI(`/api/v1/users/${id}`, {
        method: 'DELETE',
    }),
};

export const quizAPI = {
    getAllQuizzes: () => fetchAPI('/api/v1/quizzes/'),
    getQuiz: (id) => fetchAPI(`/api/v1/quizzes/${id}`),
    createQuiz: (quizData) => fetchAPI('/api/v1/quizzes/', {
        method: 'POST',
        body: JSON.stringify(quizData),
    }),
    updateQuiz: (id, quizData) => fetchAPI(`/api/v1/quizzes/${id}`, {
        method: 'PUT',
        body: JSON.stringify(quizData),
    }),
    deleteQuiz: (id) => fetchAPI(`/api/v1/quizzes/${id}`, {
        method: 'DELETE',
    }),
};

export const attemptAPI = {
    getMyAttempts: () => fetchAPI('/api/v1/attempts/my-attempts'),
    getAttempt: (id) => fetchAPI(`/api/v1/attempts/${id}`),
    startAttempt: (quizId) => fetchAPI('/api/v1/attempts/start', {
        method: 'POST',
        body: JSON.stringify({ quiz_id: quizId }),
    }),
    submitAttempt: (attemptId, answers) => fetchAPI('/api/v1/attempts/submit', {
        method: 'POST',
        body: JSON.stringify({ attempt_id: attemptId, answers }),
    }),
};
