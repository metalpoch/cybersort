from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone
from math import ceil
from urllib.parse import parse_qs

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, create_engine, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    Session,
    mapped_column,
    relationship,
    selectinload,
    sessionmaker,
)


load_dotenv()

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://cybersort:cybersort@localhost:5432/cybersort",
)
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "change-this-password")
MAX_NAME_LENGTH = 80

engine_options: dict[str, object] = {"pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}
engine = create_engine(DATABASE_URL, **engine_options)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(MAX_NAME_LENGTH), nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(MAX_NAME_LENGTH), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    pending: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)


class Draw(Base):
    __tablename__ = "draws"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
    assignments: Mapped[list[TeamAssignment]] = relationship(
        back_populates="draw",
        cascade="all, delete-orphan",
        order_by="(TeamAssignment.team_number, TeamAssignment.id)",
    )


class TeamAssignment(Base):
    __tablename__ = "team_assignments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    draw_id: Mapped[int] = mapped_column(ForeignKey("draws.id", ondelete="CASCADE"), nullable=False)
    team_number: Mapped[int] = mapped_column(Integer, nullable=False)
    participant_name: Mapped[str] = mapped_column(String(MAX_NAME_LENGTH), nullable=False)
    participant_id: Mapped[int | None] = mapped_column(
        ForeignKey("participants.id", ondelete="SET NULL"), nullable=True
    )
    draw: Mapped[Draw] = relationship(back_populates="assignments")


# A person can register again after a previous draw, but cannot enter twice in
# the same pending roster. The partial index also protects against concurrent posts.
Index(
    "uq_pending_participant_name",
    Participant.normalized_name,
    unique=True,
    postgresql_where=text("pending = true"),
    sqlite_where=text("pending = 1"),
)


security = HTTPBasic()
app = FastAPI(title="Cyber Sort", description="Sorteos de equipos guardados en PostgreSQL")
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")


def get_db():
    with SessionLocal() as session:
        yield session


def require_admin(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    valid_username = secrets.compare_digest(
        credentials.username.encode("utf-8"), ADMIN_USERNAME.encode("utf-8")
    )
    valid_password = secrets.compare_digest(
        credentials.password.encode("utf-8"), ADMIN_PASSWORD.encode("utf-8")
    )
    if not (valid_username and valid_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales de administrador incorrectas",
            headers={"WWW-Authenticate": "Basic"},
        )
    return credentials.username


def get_draw(session: Session, draw_id: int) -> Draw | None:
    return session.scalar(
        select(Draw).where(Draw.id == draw_id).options(selectinload(Draw.assignments))
    )


def serialize_draw(draw: Draw) -> dict[str, object]:
    teams: dict[int, list[str]] = {}
    for assignment in draw.assignments:
        teams.setdefault(assignment.team_number, []).append(assignment.participant_name)
    return {
        "draw_id": draw.id,
        "created_at": draw.created_at.isoformat(),
        "total_participants": sum(len(members) for members in teams.values()),
        "teams": [
            {"team": number, "size": len(members), "members": members}
            for number, members in sorted(teams.items())
        ],
    }


def grouped_participants(participants: list[Participant]) -> list[list[Participant]]:
    """Split a roster into balanced teams of 2 or 3, never leaving a singleton."""
    if len(participants) < 2:
        raise ValueError("Se necesitan al menos 2 participantes")
    team_count = ceil(len(participants) / 3)
    base_size, larger_team_count = divmod(len(participants), team_count)
    groups: list[list[Participant]] = []
    offset = 0
    for index in range(team_count):
        size = base_size + (1 if index < larger_team_count else 0)
        groups.append(participants[offset : offset + size])
        offset += size
    return groups


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)


@app.get("/", response_class=HTMLResponse, name="home")
def home(request: Request, session: Session = Depends(get_db)):
    pending = session.scalars(
        select(Participant).where(Participant.pending.is_(True)).order_by(Participant.joined_at)
    ).all()
    latest = session.scalar(select(Draw).order_by(Draw.created_at.desc(), Draw.id.desc()))
    message = request.query_params.get("message")
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={
            "pending_count": len(pending),
            "latest_result": serialize_draw(latest) if latest else None,
            "message": message,
        },
    )


@app.post("/register", name="register")
async def register(request: Request, session: Session = Depends(get_db)):
    form_data = parse_qs((await request.body()).decode("utf-8"), keep_blank_values=True)
    name = form_data.get("name", [""])[0].strip()
    if not name:
        return RedirectResponse("/?message=Ingresa%20tu%20nombre%20para%20registrarte", status_code=303)
    if len(name) > MAX_NAME_LENGTH:
        return RedirectResponse("/?message=El%20nombre%20debe%20tener%2080%20caracteres%20o%20menos", status_code=303)

    normalized_name = " ".join(name.casefold().split())
    existing = session.scalar(
        select(Participant.id).where(
            Participant.pending.is_(True), Participant.normalized_name == normalized_name
        )
    )
    if existing is not None:
        return RedirectResponse("/?message=Ese%20nombre%20ya%20est%C3%A1%20en%20la%20lista", status_code=303)

    session.add(Participant(name=name, normalized_name=normalized_name))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return RedirectResponse("/?message=Ese%20nombre%20ya%20est%C3%A1%20en%20la%20lista", status_code=303)
    return RedirectResponse("/?message=Registro%20completado", status_code=303)


@app.get("/admin", response_class=HTMLResponse, name="admin")
def admin(
    request: Request,
    _: str = Depends(require_admin),
    session: Session = Depends(get_db),
):
    pending = session.scalars(
        select(Participant).where(Participant.pending.is_(True)).order_by(Participant.joined_at)
    ).all()
    return templates.TemplateResponse(
        request=request,
        name="admin.html",
        context={"participants": pending, "message": request.query_params.get("message")},
    )


@app.post("/admin/draw", name="start_draw")
def start_draw(
    _: str = Depends(require_admin),
    session: Session = Depends(get_db),
):
    participants = list(
        session.scalars(
            select(Participant)
            .where(Participant.pending.is_(True))
            .order_by(Participant.joined_at, Participant.id)
            .with_for_update()
        ).all()
    )
    if len(participants) < 2:
        return RedirectResponse(
            "/admin?message=Se%20necesitan%20al%20menos%202%20personas%20para%20sortear",
            status_code=303,
        )

    secrets.SystemRandom().shuffle(participants)
    draw = Draw()
    session.add(draw)
    for team_number, members in enumerate(grouped_participants(participants), start=1):
        for participant in members:
            draw.assignments.append(
                TeamAssignment(
                    team_number=team_number,
                    participant_name=participant.name,
                    participant_id=participant.id,
                )
            )
            participant.pending = False
    try:
        session.commit()
    except Exception:
        session.rollback()
        raise
    return RedirectResponse(f"/results/{draw.id}", status_code=303)


@app.get("/results", response_class=HTMLResponse, name="latest_results_page")
def latest_results_page(request: Request, session: Session = Depends(get_db)):
    draw = session.scalar(select(Draw).order_by(Draw.created_at.desc(), Draw.id.desc()))
    return templates.TemplateResponse(
        request=request,
        name="results.html",
        context={"result": serialize_draw(draw) if draw else None},
    )


@app.get("/results/{draw_id}", response_class=HTMLResponse, name="results_page")
def results_page(draw_id: int, request: Request, session: Session = Depends(get_db)):
    draw = get_draw(session, draw_id)
    if draw is None:
        raise HTTPException(status_code=404, detail="No existe ese sorteo")
    return templates.TemplateResponse(
        request=request,
        name="results.html",
        context={"result": serialize_draw(draw)},
    )


@app.get("/api/results", name="latest_results_api")
def latest_results_api(session: Session = Depends(get_db)):
    draw = session.scalar(select(Draw).order_by(Draw.created_at.desc(), Draw.id.desc()))
    if draw is None:
        return JSONResponse({"draw_id": None, "message": "Aún no se ha realizado ningún sorteo", "teams": []})
    return serialize_draw(draw)


@app.get("/api/results/{draw_id}", name="results_api")
def results_api(draw_id: int, session: Session = Depends(get_db)):
    draw = get_draw(session, draw_id)
    if draw is None:
        raise HTTPException(status_code=404, detail="No existe ese sorteo")
    return serialize_draw(draw)
