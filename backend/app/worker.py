from __future__ import annotations

import argparse
import time
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.services.notifications import get_outbox_handlers
from app.services.outbox import process_pending_outbox_events


@contextmanager
def session_scope() -> Iterator[Session]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def run_pending_outbox_batch(batch_size: int = 25) -> int:
    with session_scope() as session:
        events = process_pending_outbox_events(
            session,
            handlers=get_outbox_handlers(),
            batch_size=batch_size,
        )
        return len(events)


def run_worker_loop(*, batch_size: int = 25, interval_seconds: int = 300) -> None:
    while True:
        processed = run_pending_outbox_batch(batch_size=batch_size)
        print(f"Processed {processed} outbox event(s).")
        time.sleep(interval_seconds)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Process pending outbox events.")
    parser.add_argument("--batch-size", type=int, default=25, help="Maximum number of events to process each run.")
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Run continuously with a sleep interval between batches.",
    )
    parser.add_argument(
        "--interval-seconds",
        type=int,
        default=300,
        help="Sleep interval for --loop mode (seconds). Defaults to 300 (5 minutes).",
    )
    return parser


if __name__ == "__main__":
    args = _build_parser().parse_args()
    if args.loop:
        run_worker_loop(batch_size=args.batch_size, interval_seconds=args.interval_seconds)
    else:
        processed = run_pending_outbox_batch(batch_size=args.batch_size)
        print(f"Processed {processed} outbox event(s).")
