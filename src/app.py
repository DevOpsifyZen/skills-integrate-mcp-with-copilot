"""
High School Management System API

A super simple FastAPI application that allows students to view and sign up
for extracurricular activities at Mergington High School.
"""

import json
from pathlib import Path
from typing import Dict, Optional
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

app = FastAPI(
    title="Mergington High School API",
    description="API for viewing and signing up for extracurricular activities",
)

# Mount the static files directory
current_dir = Path(__file__).parent
app.mount(
    "/static",
    StaticFiles(directory=current_dir / "static"),
    name="static",
)

users_file = current_dir / "users.json"
with users_file.open("r", encoding="utf-8") as f:
    users = json.load(f)

sessions: Dict[str, Dict[str, str]] = {}

# In-memory activity database
activities = {
    "Chess Club": {
        "description": "Learn strategies and compete in chess tournaments",
        "schedule": "Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 12,
        "participants": ["michael@mergington.edu", "daniel@mergington.edu"],
    },
    "Programming Class": {
        "description": "Learn programming fundamentals and build software projects",
        "schedule": "Tuesdays and Thursdays, 3:30 PM - 4:30 PM",
        "max_participants": 20,
        "participants": ["emma@mergington.edu", "sophia@mergington.edu"],
    },
    "Gym Class": {
        "description": "Physical education and sports activities",
        "schedule": "Mondays, Wednesdays, Fridays, 2:00 PM - 3:00 PM",
        "max_participants": 30,
        "participants": ["john@mergington.edu", "olivia@mergington.edu"],
    },
    "Soccer Team": {
        "description": "Join the school soccer team and compete in matches",
        "schedule": "Tuesdays and Thursdays, 4:00 PM - 5:30 PM",
        "max_participants": 22,
        "participants": ["liam@mergington.edu", "noah@mergington.edu"],
    },
    "Basketball Team": {
        "description": "Practice and play basketball with the school team",
        "schedule": "Wednesdays and Fridays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["ava@mergington.edu", "mia@mergington.edu"],
    },
    "Art Club": {
        "description": "Explore your creativity through painting and drawing",
        "schedule": "Thursdays, 3:30 PM - 5:00 PM",
        "max_participants": 15,
        "participants": ["amelia@mergington.edu", "harper@mergington.edu"],
    },
    "Drama Club": {
        "description": "Act, direct, and produce plays and performances",
        "schedule": "Mondays and Wednesdays, 4:00 PM - 5:30 PM",
        "max_participants": 20,
        "participants": ["ella@mergington.edu", "scarlett@mergington.edu"],
    },
    "Math Club": {
        "description": "Solve challenging problems and participate in math competitions",
        "schedule": "Tuesdays, 3:30 PM - 4:30 PM",
        "max_participants": 10,
        "participants": ["james@mergington.edu", "benjamin@mergington.edu"],
    },
    "Debate Team": {
        "description": "Develop public speaking and argumentation skills",
        "schedule": "Fridays, 4:00 PM - 5:30 PM",
        "max_participants": 12,
        "participants": ["charlotte@mergington.edu", "henry@mergington.edu"],
    },
}


def get_user_by_email(email: str) -> Optional[Dict[str, str]]:
    return next((user for user in users if user["email"] == email), None)


def get_current_user(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, str]]:
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "")
    return sessions.get(token)


def require_user(user: Optional[Dict[str, str]] = Depends(get_current_user)) -> Dict[str, str]:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


@app.get("/")
def root():
    return RedirectResponse(url="/static/index.html")


@app.post("/login")
async def login(request: Request):
    payload = await request.json()
    email = payload.get("email")
    password = payload.get("password")

    user = get_user_by_email(email)
    if not user or user["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = str(uuid4())
    sessions[token] = {"email": user["email"], "role": user["role"]}
    return {"token": token, "role": user["role"], "email": user["email"]}


@app.post("/logout")
def logout(authorization: Optional[str] = Header(None)):
    user = get_current_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")

    token = authorization.replace("Bearer ", "")
    sessions.pop(token, None)
    return {"message": "Logged out successfully"}


@app.get("/me")
def me(user: Dict[str, str] = Depends(require_user)):
    return user


@app.get("/activities")
def get_activities():
    return activities


@app.post("/activities/{activity_name}/signup")
def signup_for_activity(activity_name: str, email: str, user: Dict[str, str] = Depends(require_user)):
    if user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can sign up for activities")

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if email in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is already signed up")

    activity["participants"].append(email)
    return {"message": f"Signed up {email} for {activity_name}"}


@app.delete("/activities/{activity_name}/unregister")
def unregister_from_activity(activity_name: str, email: str, user: Dict[str, str] = Depends(require_user)):
    if user["role"] != "parent":
        raise HTTPException(status_code=403, detail="Only parents can unregister students from activities")

    if activity_name not in activities:
        raise HTTPException(status_code=404, detail="Activity not found")

    activity = activities[activity_name]
    if email not in activity["participants"]:
        raise HTTPException(status_code=400, detail="Student is not signed up for this activity")

    activity["participants"].remove(email)
    return {"message": f"Unregistered {email} from {activity_name}"}
