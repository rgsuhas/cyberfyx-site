from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import OutboxStatus
from app.models.outbox import OutboxEvent

OutboxHandler = Callable[[Session, OutboxEvent], Any]
MAX_ATTEMPTS = 5


def enqueue_outbox_event(session: Session, *, topic: str, payload: dict[str, Any]) -> OutboxEvent:
    event = OutboxEvent(topic=topic, payload=payload)
    session.add(event)
    return event


def process_pending_outbox_events(
    session: Session,
    *,
    handlers: dict[str, OutboxHandler],
    batch_size: int = 25,
) -> list[OutboxEvent]:
    now = datetime.now(timezone.utc)
    events = list(
        session.scalars(
            select(OutboxEvent)
            .where(
                OutboxEvent.status.in_([OutboxStatus.pending, OutboxStatus.failed]),
                OutboxEvent.available_at <= now,
                OutboxEvent.attempts < MAX_ATTEMPTS,
            )
            .order_by(OutboxEvent.available_at.asc(), OutboxEvent.created_at.asc())
            .limit(batch_size)
        ).all()
    )

    for event in events:
        event.status = OutboxStatus.processing
        event.attempts += 1
        session.add(event)
        session.flush()

        handler = handlers.get(event.topic)
        try:
            if handler is None:
                raise RuntimeError(f"No outbox handler registered for topic '{event.topic}'.")
            handler(session, event)
            event.status = OutboxStatus.completed
            event.processed_at = datetime.now(timezone.utc)
            event.last_error = None
        except Exception as exc:
            event.status = OutboxStatus.failed
            event.last_error = str(exc)
            session.add(event)

            if event.attempts >= MAX_ATTEMPTS:
                event.last_error = f"{event.last_error} (max attempts reached: {MAX_ATTEMPTS})"

    exhausted_events = list(
        session.scalars(
            select(OutboxEvent)
            .where(
                OutboxEvent.status.in_([OutboxStatus.pending, OutboxStatus.failed]),
                OutboxEvent.available_at <= now,
                OutboxEvent.attempts >= MAX_ATTEMPTS,
            )
            .limit(batch_size)
        ).all()
    )
    for event in exhausted_events:
        if event.status != OutboxStatus.failed:
            event.status = OutboxStatus.failed
        if not event.last_error:
            event.last_error = f"Event moved to terminal failure after reaching max attempts ({MAX_ATTEMPTS})."
        session.add(event)

    session.commit()
    return events
