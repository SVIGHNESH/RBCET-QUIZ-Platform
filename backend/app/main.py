from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import engine, Base, SessionLocal
from app.models.models import User, RoleEnum
from app.core.security import get_password_hash
from app.api.v1 import auth, users, quizzes, attempts, subjects, question_bank, stats

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize admin user
def init_admin():
    db = SessionLocal()
    try:
        admin_exists = db.query(User).filter(User.email == settings.ADMIN_EMAIL).first()
        if not admin_exists:
            admin_user = User(
                email=settings.ADMIN_EMAIL,
                hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
                first_name="Admin",
                last_name="User",
                role=RoleEnum.ADMIN,
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print(f"✅ Admin user created: {settings.ADMIN_EMAIL}")
        else:
            print("ℹ️  Admin user already exists")
    finally:
        db.close()

# Initialize admin on startup
init_admin()

app = FastAPI(
    title="MacQuiz API",
    description="Comprehensive Backend API for MacQuiz - Advanced Quiz Management System",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(subjects.router, prefix="/api/v1/subjects", tags=["Subjects"])
app.include_router(question_bank.router, prefix="/api/v1/question-bank", tags=["Question Bank"])
app.include_router(subjects.router, prefix="/api/v1/subjects", tags=["Subjects"])
app.include_router(question_bank.router, prefix="/api/v1/question-bank", tags=["Question Bank"])
app.include_router(stats.router, prefix="/api/v1/stats", tags=["Statistics"])

@app.get("/")
async def root():
    return {
        "message": "Welcome to MacQuiz API v2.0",
        "version": "2.0.0",
        "features": [
            "JWT Authentication with Role-Based Access Control",
            "Comprehensive User Management (Admin, Teacher, Student)",
            "Subject Management System",
            "Question Bank with Difficulty Levels",
            "Advanced Quiz Creation with Scheduling",
            "Custom Marking Schemes (Positive & Negative)",
            "Time-Based Quiz Control with Grace Periods",
            "Automatic Grading Engine",
            "Comprehensive Analytics & Reporting",
            "Department & Class-Based Filtering"
        ],
        "docs": "/docs",
        "redoc": "/redoc"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "database": "connected"
    }
