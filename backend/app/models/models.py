from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Float, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base
import enum

class RoleEnum(enum.Enum):
    ADMIN = "ADMIN"
    TEACHER = "TEACHER"
    STUDENT = "STUDENT"

class QuizStatusEnum(enum.Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    ARCHIVED = "ARCHIVED"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(SQLEnum(RoleEnum), nullable=False)
    phone_number = Column(String(20), nullable=True)
    student_id = Column(String(50), unique=True, nullable=True, index=True)
    department = Column(String(100), nullable=True, index=True)
    class_year = Column(String(20), nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_active = Column(DateTime, default=datetime.utcnow)

    # Relationships
    quizzes_created = relationship("Quiz", back_populates="creator", foreign_keys="Quiz.creator_id")
    quiz_attempts = relationship("QuizAttempt", back_populates="student")
    subjects_created = relationship("Subject", back_populates="creator")
    questions_created = relationship("QuestionBank", back_populates="creator")


class Subject(Base):
    __tablename__ = "subjects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False, index=True)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    department = Column(String(100), nullable=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="subjects_created")
    quizzes = relationship("Quiz", back_populates="subject")
    question_banks = relationship("QuestionBank", back_populates="subject")


class Quiz(Base):
    __tablename__ = "quizzes"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=True)
    status = Column(SQLEnum(QuizStatusEnum), default=QuizStatusEnum.DRAFT, nullable=False)
    department = Column(String(100), nullable=True, index=True)
    class_year = Column(String(20), nullable=True, index=True)

    # Timing fields
    scheduled_start_time = Column(DateTime, nullable=True, index=True)
    duration_minutes = Column(Integer, nullable=False, default=30)
    grace_period_minutes = Column(Integer, nullable=False, default=5)

    # Marking scheme
    marks_per_correct = Column(Float, default=1.0)
    marks_per_incorrect = Column(Float, default=0.0)

    # Quiz behavior settings
    max_attempts = Column(Integer, default=1)
    allow_review = Column(Boolean, default=True)
    shuffle_questions = Column(Boolean, default=False)
    shuffle_options = Column(Boolean, default=False)

    total_marks = Column(Float, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="quizzes_created", foreign_keys=[creator_id])
    subject = relationship("Subject", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan")
    attempts = relationship("QuizAttempt", back_populates="quiz")


class QuestionBank(Base):
    __tablename__ = "question_bank"
    
    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)
    option_a = Column(String(500), nullable=True)
    option_b = Column(String(500), nullable=True)
    option_c = Column(String(500), nullable=True)
    option_d = Column(String(500), nullable=True)
    correct_answer = Column(String(500), nullable=False)
    explanation = Column(Text, nullable=True)

    topic = Column(String(200), nullable=True, index=True)
    difficulty = Column(String(20), default='medium')
    tags = Column(String(500), nullable=True)
    marks = Column(Float, default=1)

    times_used = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    times_incorrect = Column(Integer, default=0)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    subject = relationship("Subject", back_populates="question_banks")
    creator = relationship("User", back_populates="questions_created")
    quiz_questions = relationship("Question", back_populates="question_bank")


class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question_bank_id = Column(Integer, ForeignKey("question_bank.id"), nullable=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)
    option_a = Column(String(500), nullable=True)
    option_b = Column(String(500), nullable=True)
    option_c = Column(String(500), nullable=True)
    option_d = Column(String(500), nullable=True)
    correct_answer = Column(String(500), nullable=False)
    marks = Column(Float, default=1)
    order = Column(Integer, default=0)

    # Relationships
    quiz = relationship("Quiz", back_populates="questions")
    question_bank = relationship("QuestionBank", back_populates="quiz_questions")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    score = Column(Float, nullable=True)
    total_marks = Column(Float, nullable=False)
    percentage = Column(Float, nullable=True)

    started_at = Column(DateTime, default=datetime.utcnow)
    submitted_at = Column(DateTime, nullable=True)
    is_completed = Column(Boolean, default=False)
    time_taken_minutes = Column(Integer, nullable=True)

    # Additional tracking
    questions_answered = Column(Integer, default=0)
    questions_correct = Column(Integer, default=0)
    is_late = Column(Boolean, default=False)
    late_by_minutes = Column(Integer, nullable=True)
    ip_address = Column(String(45), nullable=True)

    # Anti-cheating
    tab_switches = Column(Integer, default=0)
    suspicious_activity = Column(Boolean, default=False)

    # Relationships
    quiz = relationship("Quiz", back_populates="attempts")
    student = relationship("User", back_populates="quiz_attempts")
    answers = relationship("Answer", back_populates="attempt", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"
    
    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("quiz_attempts.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    answer_text = Column(Text, nullable=True)
    is_correct = Column(Boolean, nullable=True)
    marks_awarded = Column(Float, default=0)
    answered_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    attempt = relationship("QuizAttempt", back_populates="answers")
    question = relationship("Question")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    user = relationship("User")
