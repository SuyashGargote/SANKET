"""
api/jobs.py — In-memory background task queue and job manager.
"""

import time
import uuid
from threading import Lock
from typing import Any, Dict, Optional


class JobManager:
    """Thread-safe background job manager."""

    def __init__(self):
        self.jobs: Dict[str, Dict[str, Any]] = {}
        self.lock = Lock()

    def create_job(self, task_type: str, metadata: Optional[dict] = None) -> str:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        now = time.time()
        with self.lock:
            self.jobs[job_id] = {
                "job_id": job_id,
                "task_type": task_type,
                "status": "processing",  # "processing" | "completed" | "failed"
                "created_at": now,
                "completed_at": None,
                "elapsed_seconds": 0.0,
                "metadata": metadata or {},
                "result": None,
                "error": None,
            }
        return job_id

    def complete_job(self, job_id: str, result: Any):
        now = time.time()
        with self.lock:
            if job_id in self.jobs:
                self.jobs[job_id]["status"] = "completed"
                self.jobs[job_id]["completed_at"] = now
                self.jobs[job_id]["elapsed_seconds"] = round(
                    now - self.jobs[job_id]["created_at"], 3
                )
                self.jobs[job_id]["result"] = result

    def fail_job(self, job_id: str, error: str):
        now = time.time()
        with self.lock:
            if job_id in self.jobs:
                self.jobs[job_id]["status"] = "failed"
                self.jobs[job_id]["completed_at"] = now
                self.jobs[job_id]["elapsed_seconds"] = round(
                    now - self.jobs[job_id]["created_at"], 3
                )
                self.jobs[job_id]["error"] = error

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        with self.lock:
            job = self.jobs.get(job_id)
            if not job:
                return None
            copy = dict(job)
            if copy["status"] == "processing":
                copy["elapsed_seconds"] = round(time.time() - copy["created_at"], 3)
            return copy

    def stats(self) -> Dict[str, int]:
        with self.lock:
            total = len(self.jobs)
            processing = sum(1 for j in self.jobs.values() if j["status"] == "processing")
            completed = sum(1 for j in self.jobs.values() if j["status"] == "completed")
            failed = sum(1 for j in self.jobs.values() if j["status"] == "failed")
            return {
                "total_jobs": total,
                "processing_jobs": processing,
                "completed_jobs": completed,
                "failed_jobs": failed,
            }


# Global job manager
job_manager = JobManager()
