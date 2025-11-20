from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import csv
import io
from app.db.database import get_db
from app.models.models import User, RoleEnum
from app.schemas.schemas import UserCreate, UserResponse, UserUpdate, UserActivityResponse
from app.core.security import get_password_hash
from app.core.deps import get_current_active_user, require_role

router = APIRouter()

@router.post("/", response_model=UserResponse, dependencies=[Depends(require_role([RoleEnum.ADMIN]))])
async def create_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Check if user_id already exists (for students)
    if user_data.role == RoleEnum.STUDENT and user_data.user_id:
        existing_student = db.query(User).filter(User.user_id == user_data.user_id).first()
        if existing_student:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID already registered"
            )
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        phone_number=user_data.phone_number,
        department=user_data.department,
        class_year=user_data.class_year,
        user_id=user_data.user_id if user_data.role == RoleEnum.STUDENT else None
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@router.post("/bulk-upload", dependencies=[Depends(require_role([RoleEnum.ADMIN]))])
async def bulk_upload_users(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Bulk upload users from CSV file.
    Expected CSV format: role,first_name,last_name,email,password,phone_number,user_id,department,class_year
    """
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only CSV and Excel files are supported"
        )
    
    try:
        contents = await file.read()
        
        # Handle CSV files
        if file.filename.endswith('.csv'):
            decoded = contents.decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(decoded))
        else:
            # For Excel files, we'll need openpyxl or pandas
            # For now, return error for Excel
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Excel file support requires openpyxl. Please use CSV format."
            )
        
        created_users = []
        errors = []
        
        for row_num, row in enumerate(csv_reader, start=2):  # start=2 because row 1 is header
            try:
                # Validate required fields
                required_fields = ['role', 'first_name', 'last_name', 'email', 'password']
                missing_fields = [field for field in required_fields if not row.get(field, '').strip()]
                
                if missing_fields:
                    errors.append({
                        "row": row_num,
                        "error": f"Missing required fields: {', '.join(missing_fields)}"
                    })
                    continue
                
                role_str = row['role'].strip().upper()  # Convert to uppercase
                # Validate role
                try:
                    role = RoleEnum(role_str)
                except ValueError:
                    errors.append({
                        "row": row_num,
                        "error": f"Invalid role: {row['role']}. Must be ADMIN, TEACHER, or STUDENT"
                    })
                    continue
                
                email = row['email'].strip()
                
                # Check if email already exists
                if db.query(User).filter(User.email == email).first():
                    errors.append({
                        "row": row_num,
                        "email": email,
                        "error": "Email already registered"
                    })
                    continue
                
                # For students, check user_id
                user_id = row.get('user_id', '').strip() if role == RoleEnum.STUDENT else None
                if role == RoleEnum.STUDENT:
                    if not user_id:
                        errors.append({
                            "row": row_num,
                            "email": email,
                            "error": "User ID is required for students"
                        })
                        continue
                    
                    if db.query(User).filter(User.user_id == user_id).first():
                        errors.append({
                            "row": row_num,
                            "email": email,
                            "user_id": user_id,
                            "error": "User ID already registered"
                        })
                        continue
                
                # Create user
                hashed_password = get_password_hash(row['password'].strip())
                new_user = User(
                    email=email,
                    hashed_password=hashed_password,
                    first_name=row['first_name'].strip(),
                    last_name=row['last_name'].strip(),
                    role=role,
                    phone_number=row.get('phone_number', '').strip() or None,
                    department=row.get('department', '').strip() or None,
                    class_year=row.get('class_year', '').strip() or None,
                    user_id=user_id
                )
                
                db.add(new_user)
                created_users.append({
                    "email": email,
                    "name": f"{new_user.first_name} {new_user.last_name}",
                    "role": role
                })
                
            except Exception as e:
                errors.append({
                    "row": row_num,
                    "error": str(e)
                })
        
        # Commit all users at once
        if created_users:
            db.commit()
        
        return {
            "success": True,
            "created_count": len(created_users),
            "error_count": len(errors),
            "created_users": created_users,
            "errors": errors
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process file: {str(e)}"
        )

@router.get("/", response_model=List[UserResponse], dependencies=[Depends(require_role([RoleEnum.ADMIN]))])
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    role: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(User)
    
    if role:
        # Convert role string to uppercase to match enum
        try:
            role_enum = RoleEnum(role.upper())
            query = query.filter(User.role == role_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role: {role}. Must be ADMIN, TEACHER, or STUDENT"
            )
    
    users = query.offset(skip).limit(limit).all()
    return users

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    return current_user

@router.get("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_role([RoleEnum.ADMIN]))])
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user

@router.put("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_role([RoleEnum.ADMIN]))])
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    update_data = user_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    return user

@router.delete("/{user_id}", dependencies=[Depends(require_role([RoleEnum.ADMIN]))])
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    db.delete(user)
    db.commit()
    
    return {"message": "User deleted successfully"}

@router.get("/activity/teachers", response_model=List[UserActivityResponse], dependencies=[Depends(require_role([RoleEnum.ADMIN]))])
async def get_teacher_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    teachers = db.query(User).filter(User.role == RoleEnum.TEACHER).all()
    return [
        {
            "id": teacher.id,
            "name": f"{teacher.first_name} {teacher.last_name}",
            "email": teacher.email,
            "role": teacher.role,
            "department": teacher.department,
            "class_year": teacher.class_year,
            "user_id": teacher.user_id,
            "last_active": teacher.last_active,
            "is_active": teacher.is_active
        }
        for teacher in teachers
    ]

@router.get("/activity/students", response_model=List[UserActivityResponse], dependencies=[Depends(require_role([RoleEnum.ADMIN]))])
async def get_student_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    students = db.query(User).filter(User.role == RoleEnum.STUDENT).all()
    return [
        {
            "id": student.id,
            "name": f"{student.first_name} {student.last_name}",
            "email": student.email,
            "role": student.role,
            "department": student.department,
            "class_year": student.class_year,
            "user_id": student.user_id,
            "last_active": student.last_active,
            "is_active": student.is_active
        }
        for student in students
    ]
