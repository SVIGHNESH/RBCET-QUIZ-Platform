from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from app.core.deps import get_current_user, get_db
from app.models.models import User, Quiz, QuizAttempt, Subject, QuestionBank, RoleEnum, Question
from app.schemas.schemas import TeacherStats, StudentStats, DashboardStats

router = APIRouter()

@router.get("/teachers", response_model=List[TeacherStats])
def get_all_teachers_stats(
    department: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics for all teachers (Admin only)
    """
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view all teacher statistics"
        )
    
    query = db.query(User).filter(User.role == RoleEnum.TEACHER)
    
    if department:
        query = query.filter(User.department == department)
    
    teachers = query.all()
    
    stats_list = []
    for teacher in teachers:
        # Get quiz statistics
        quizzes = db.query(Quiz).filter(Quiz.creator_id == teacher.id).all()
        total_quizzes = len(quizzes)
        
        # Count total questions created
        total_questions = db.query(Question).join(Quiz).filter(
            Quiz.creator_id == teacher.id
        ).count()
        
        # Count unique students who attempted quizzes
        total_students = db.query(QuizAttempt.student_id).join(Quiz).filter(
            Quiz.creator_id == teacher.id
        ).distinct().count()
        
        # Calculate average score across all quizzes
        avg_score_result = db.query(func.avg(QuizAttempt.percentage)).join(Quiz).filter(
            Quiz.creator_id == teacher.id,
            QuizAttempt.is_completed == True
        ).scalar()
        
        # Get last quiz created date
        last_quiz = db.query(Quiz).filter(
            Quiz.creator_id == teacher.id
        ).order_by(Quiz.created_at.desc()).first()
        
        stats_list.append(TeacherStats(
            teacher_id=teacher.id,
            teacher_name=f"{teacher.first_name} {teacher.last_name}",
            email=teacher.email,
            department=teacher.department,
            total_quizzes_created=total_quizzes,
            total_questions_created=total_questions,
            total_students_attempted=total_students,
            average_quiz_score=round(avg_score_result, 2) if avg_score_result else None,
            last_quiz_created=last_quiz.created_at if last_quiz else None
        ))
    
    return stats_list

@router.get("/teachers/{teacher_id}", response_model=TeacherStats)
def get_teacher_stats(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics for a specific teacher
    """
    # Teachers can view their own stats, admins can view any teacher's stats
    if current_user.role not in [RoleEnum.ADMIN, RoleEnum.TEACHER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    if current_user.role == RoleEnum.TEACHER and current_user.id != teacher_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teachers can only view their own statistics"
        )
    
    teacher = db.query(User).filter(
        User.id == teacher_id,
        User.role == RoleEnum.TEACHER
    ).first()
    
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Teacher not found"
        )
    
    # Get quiz statistics
    total_quizzes = db.query(Quiz).filter(Quiz.creator_id == teacher_id).count()
    
    # Count total questions created
    total_questions = db.query(Question).join(Quiz).filter(
        Quiz.creator_id == teacher_id
    ).count()
    
    # Count unique students who attempted quizzes
    total_students = db.query(QuizAttempt.student_id).join(Quiz).filter(
        Quiz.creator_id == teacher_id
    ).distinct().count()
    
    # Calculate average score
    avg_score_result = db.query(func.avg(QuizAttempt.percentage)).join(Quiz).filter(
        Quiz.creator_id == teacher_id,
        QuizAttempt.is_completed == True
    ).scalar()
    
    # Get last quiz created date
    last_quiz = db.query(Quiz).filter(
        Quiz.creator_id == teacher_id
    ).order_by(Quiz.created_at.desc()).first()
    
    return TeacherStats(
        teacher_id=teacher.id,
        teacher_name=f"{teacher.first_name} {teacher.last_name}",
        email=teacher.email,
        department=teacher.department,
        total_quizzes_created=total_quizzes,
        total_questions_created=total_questions,
        total_students_attempted=total_students,
        average_quiz_score=round(avg_score_result, 2) if avg_score_result else None,
        last_quiz_created=last_quiz.created_at if last_quiz else None
    )

@router.get("/students", response_model=List[StudentStats])
def get_all_students_stats(
    department: str = None,
    class_year: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics for all students (Admin or Teacher only)
    """
    if current_user.role not in [RoleEnum.ADMIN, RoleEnum.TEACHER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins and teachers can view student statistics"
        )
    
    query = db.query(User).filter(User.role == RoleEnum.STUDENT)
    
    if department:
        query = query.filter(User.department == department)
    
    if class_year:
        query = query.filter(User.class_year == class_year)
    
    students = query.all()
    
    stats_list = []
    for student in students:
        # Get quiz attempt statistics
        attempts = db.query(QuizAttempt).filter(QuizAttempt.student_id == student.id).all()
        completed_attempts = [a for a in attempts if a.is_completed]
        
        # Calculate statistics
        total_attempted = len(attempts)
        total_completed = len(completed_attempts)
        
        scores = [a.score for a in completed_attempts if a.score is not None]
        percentages = [a.percentage for a in completed_attempts if a.percentage is not None]
        
        avg_score = sum(scores) / len(scores) if scores else None
        avg_percentage = sum(percentages) / len(percentages) if percentages else None
        highest_score = max(scores) if scores else None
        lowest_score = min(scores) if scores else None
        
        # Get last quiz attempted
        last_attempt = db.query(QuizAttempt).filter(
            QuizAttempt.student_id == student.id
        ).order_by(QuizAttempt.started_at.desc()).first()
        
        stats_list.append(StudentStats(
            user_id=student.id,
            student_name=f"{student.first_name} {student.last_name}",
            email=student.email,
            student_code=student.user_id,
            department=student.department,
            class_year=student.class_year,
            total_quizzes_attempted=total_attempted,
            total_quizzes_completed=total_completed,
            average_score=round(avg_score, 2) if avg_score else None,
            average_percentage=round(avg_percentage, 2) if avg_percentage else None,
            highest_score=round(highest_score, 2) if highest_score else None,
            lowest_score=round(lowest_score, 2) if lowest_score else None,
            last_quiz_attempted=last_attempt.started_at if last_attempt else None
        ))
    
    return stats_list

@router.get("/students/{student_id}", response_model=StudentStats)
def get_student_stats(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics for a specific student
    """
    # Students can view their own stats, teachers and admins can view any student's stats
    if current_user.role == RoleEnum.STUDENT and current_user.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only view their own statistics"
        )
    
    student = db.query(User).filter(
        User.id == student_id,
        User.role == RoleEnum.STUDENT
    ).first()
    
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found"
        )
    
    # Get quiz attempt statistics
    attempts = db.query(QuizAttempt).filter(QuizAttempt.student_id == student_id).all()
    completed_attempts = [a for a in attempts if a.is_completed]
    
    # Calculate statistics
    total_attempted = len(attempts)
    total_completed = len(completed_attempts)
    
    scores = [a.score for a in completed_attempts if a.score is not None]
    percentages = [a.percentage for a in completed_attempts if a.percentage is not None]
    
    avg_score = sum(scores) / len(scores) if scores else None
    avg_percentage = sum(percentages) / len(percentages) if percentages else None
    highest_score = max(scores) if scores else None
    lowest_score = min(scores) if scores else None
    
    # Get last quiz attempted
    last_attempt = db.query(QuizAttempt).filter(
        QuizAttempt.student_id == student_id
    ).order_by(QuizAttempt.started_at.desc()).first()
    
    return StudentStats(
        user_id=student.id,
        student_name=f"{student.first_name} {student.last_name}",
        email=student.email,
        student_code=student.user_id,
        department=student.department,
        class_year=student.class_year,
        total_quizzes_attempted=total_attempted,
        total_quizzes_completed=total_completed,
        average_score=round(avg_score, 2) if avg_score else None,
        average_percentage=round(avg_percentage, 2) if avg_percentage else None,
        highest_score=round(highest_score, 2) if highest_score else None,
        lowest_score=round(lowest_score, 2) if lowest_score else None,
        last_quiz_attempted=last_attempt.started_at if last_attempt else None
    )

@router.get("/dashboard", response_model=DashboardStats)
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get overall dashboard statistics (Admin only)
    """
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view dashboard statistics"
        )
    
    total_quizzes = db.query(Quiz).count()
    active_quizzes = db.query(Quiz).filter(Quiz.is_active == True).count()
    total_students = db.query(User).filter(User.role == RoleEnum.STUDENT).count()
    total_teachers = db.query(User).filter(User.role == RoleEnum.TEACHER).count()
    
    # Teachers active today (logged in today)
    today = datetime.utcnow().date()
    active_teachers_today = db.query(User).filter(
        User.role == RoleEnum.TEACHER,
        func.date(User.last_active) == today
    ).count()
    
    # Assessments from yesterday
    from datetime import timedelta
    yesterday = datetime.utcnow().date() - timedelta(days=1)
    yesterday_assessments = db.query(QuizAttempt).filter(
        func.date(QuizAttempt.started_at) == yesterday
    ).count()
    
    total_subjects = db.query(Subject).count()
    total_question_bank_items = db.query(QuestionBank).count()
    
    return DashboardStats(
        total_quizzes=total_quizzes,
        active_quizzes=active_quizzes,
        total_students=total_students,
        total_teachers=total_teachers,
        active_teachers_today=active_teachers_today,
        yesterday_assessments=yesterday_assessments,
        total_subjects=total_subjects,
        total_question_bank_items=total_question_bank_items
    )
