# GWTH Pipeline Upgrade Plan — RAG + GPU Queue + LLM Infrastructure

_1 April 2026 — Pass this to Claude Code in `C:\Projects\1_gwthpipeline520`_

---

## Context

This plan was developed in the FractionalBuddy project during an infrastructure planning session. David wants to standardise embedding models and vector DB across all projects, upgrade the GWTH RAG quality, add a GPU task queue for VV7B TTS, and set up shared Ollama infrastructure.

**Key decisions already made:**

- Embedding model: Qwen3-Embedding-8B (Q4_K_M) via Ollama — replaces all-MiniLM-L6-v2
- Vector DB: Qdrant (keep current, embedded mode)
- TTS: VV7B as primary (better quality than VV1.5B), with GPU queue for model swapping
- Local LLM: Phi-4-mini (Tier 1, fast) + Qwen3-Coder-Next (Tier 2, coding) via Ollama
- Claude: `claude -p --output-format json` for complex tasks (Max subscription, free)
- All models served via shared Ollama instance on RTX 3090 (GPU 1)

---

## Upgrade 1: Embedding Model (HIGH PRIORITY)

### What

Replace `sentence-transformers/all-MiniLM-L6-v2` (384-D, MTEB 56.3) with `qwen3-embedding:8b` (4096-D, MTEB 70.58) via Ollama.

### Why

14-point MTEB improvement. 32K token context (vs 512). Best open embedding model available. Shared with FractionalBuddy project.

### Files to Modify

**`app/services/qdrant_service.py`:**

- Replace sentence-transformers import and model loading with Ollama HTTP API
- Change `_embed()` method to POST to `http://localhost:11434/api/embeddings` with model `qwen3-embedding:8b`
- Update vector dimension from 384 to 4096
- Update collection creation to use 4096 dimensions
- Add fallback/retry logic for when Ollama is temporarily unavailable (during model swaps)

**`app/config.py`:**

- Add `OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")`
- Add `EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "qwen3-embedding:8b")`
- Add `EMBEDDING_DIMENSIONS = 4096`

**`requirements.txt`:**

- Remove `sentence-transformers==3.2.1` (saves ~500MB of dependencies)
- Add `httpx>=0.27.0` (already present for other uses)

**One-time migration script (`scripts/reembed_all.py`):**

- Delete existing `gwth_lessons` collection
- Recreate with 4096 dimensions
- Re-embed all documents from `/data/` using new model
- Log progress and timing

### Chunk Size Upgrade (same prompt)

- `qdrant_service.py`: Change `chunk_size = 500` to `chunk_size = 2000`
- Change `overlap = 50` to `overlap = 300`
- These larger chunks work well with Qwen3-Embedding's 32K context

### Prerequisites

1. Ollama installed on P520: `curl -fsSL https://ollama.com/install.sh | sh`
2. Model pulled: `ollama pull qwen3-embedding:8b`
3. Ollama running as systemd service on GPU 1 (RTX 3090):
   ```ini
   [Service]
   Environment="CUDA_VISIBLE_DEVICES=1"
   Environment="OLLAMA_HOST=0.0.0.0:11434"
   Environment="OLLAMA_KEEP_ALIVE=5m"
   Environment="OLLAMA_MAX_LOADED_MODELS=3"
   ExecStart=/usr/local/bin/ollama serve
   ```

### Acceptance Criteria

- [ ] `qdrant_service.py` uses Ollama API, not sentence-transformers
- [ ] New Qdrant collection with 4096 dimensions
- [ ] All existing documents re-embedded
- [ ] `sentence-transformers` removed from requirements.txt
- [ ] Semantic search returns relevant results (manual test: query "What is HNSW?" should return RAG-related content)
- [ ] Chunk size increased to 2000 chars with 300 overlap

---

## Upgrade 2: GPU Task Queue (MEDIUM PRIORITY)

### What

Extend `gpu_orchestrator.py` with a priority-based task queue so VV7B can be the primary TTS model, swapping in and out of the 3090 as needed.

### Why

VV7B produces much better TTS than VV1.5B but needs 18.7 GB VRAM — can't coexist with other models. A queue lets it swap in for TTS, batch multiple generations, then swap back for embeddings.

### Current Architecture

- `gpu_orchestrator.py` has priority-based eviction (Kokoro: P2, F5-TTS: P1, Whisper: P0, Docling: P3)
- Services managed via SSH `docker start/stop` to P520
- No queue — activation is immediate or fails
- `content_queue.py` tracks lesson pipeline status but NOT GPU tasks

### Proposed Changes

**`app/services/gpu_task_queue.py` (NEW FILE):**

```python
import asyncio
from dataclasses import dataclass, field
from enum import IntEnum
from typing import Callable, Any, Optional

class Priority(IntEnum):
    IMMEDIATE = 0   # Embedding — always served, Ollama handles internally
    HIGH = 1         # Interactive LLM (Phi-4-mini)
    NORMAL = 2       # Single TTS generation (user-triggered)
    BACKGROUND = 3   # Batch TTS (nightly pipeline)
    IDLE = 4         # Re-embedding, maintenance

@dataclass(order=True)
class GPUTask:
    priority: Priority
    name: str = field(compare=False)
    service_name: str = field(compare=False)
    execute: Callable = field(compare=False)
    future: asyncio.Future = field(compare=False, default=None)

class GPUTaskQueue:
    def __init__(self, orchestrator):
        self.orchestrator = orchestrator
        self.queue = asyncio.PriorityQueue()
        self.current_task: Optional[GPUTask] = None
        self._worker_task = None

    async def start(self):
        self._worker_task = asyncio.create_task(self._worker())

    async def submit(self, task: GPUTask) -> asyncio.Future:
        loop = asyncio.get_event_loop()
        task.future = loop.create_future()
        await self.queue.put(task)
        return task.future

    async def submit_batch(self, tasks: list[GPUTask]) -> list[asyncio.Future]:
        """Submit multiple tasks sharing the same service — loads model once."""
        futures = []
        for task in tasks:
            f = await self.submit(task)
            futures.append(f)
        return futures

    async def _worker(self):
        while True:
            task = await self.queue.get()
            self.current_task = task
            try:
                # Activate required GPU service
                result = await self.orchestrator.activate(task.service_name)
                if result.get('startup_wait_seconds', 0) > 0:
                    await asyncio.sleep(result['startup_wait_seconds'])

                # Execute the task
                output = await task.execute()
                task.future.set_result(output)
            except Exception as e:
                task.future.set_exception(e)
            finally:
                self.current_task = None

                # If queue empty and service is expensive, schedule delayed unload
                if self.queue.empty() and task.service_name in ('vibevoice_7b',):
                    asyncio.create_task(self._delayed_unload(task.service_name, 60))

    async def _delayed_unload(self, service_name: str, delay_seconds: int):
        await asyncio.sleep(delay_seconds)
        if self.queue.empty() and (not self.current_task or
                                     self.current_task.service_name != service_name):
            await self.orchestrator.deactivate(service_name)

    def get_status(self) -> dict:
        return {
            'queue_depth': self.queue.qsize(),
            'current_task': self.current_task.name if self.current_task else None,
        }
```

**`app/services/gpu_orchestrator.py` modifications:**

- Add Ollama-managed services to the registry (Qwen3-Embed, Phi-4-mini)
- Add `vibevoice_7b` to GPU_SERVICES with VRAM 18700, priority 2
- Update TOTAL_VRAM_MB to reflect RTX 3090 (24576) as the managed GPU
- Ollama services don't need Docker start/stop — Ollama handles loading/unloading automatically

**`app/routers/tts.py` modifications:**

- VV7B generation goes through the GPU task queue instead of direct activation
- Batch TTS endpoint: submit all lesson scripts as a single batch (load VV7B once)

**`app/services/nightly_orchestrator.py` modifications:**

- Batch all TTS for a lesson into one queue submission at BACKGROUND priority
- Queue monitors progress and reports to `pipeline_status.json`

### Acceptance Criteria

- [ ] GPUTaskQueue class with priority levels and batch support
- [ ] VV7B TTS generation uses the queue
- [ ] Nightly pipeline submits batch TTS at BACKGROUND priority
- [ ] Queue status visible in dashboard (queue depth, current task)
- [ ] Embedding requests not blocked during TTS (Ollama serves Qwen3-Embed independently)
- [ ] VV7B unloads after 60s idle, embed model reloads

---

## Upgrade 3: Hybrid Retrieval — Dense + Sparse (LOW PRIORITY)

### What

Add BM25-style sparse vector search alongside the existing dense vector search.

### Why

Pure semantic search misses exact keyword matches. "What is Celigo?" might return semantically similar but wrong passages. Hybrid (dense + sparse) consistently outperforms either alone.

### Implementation

Qdrant natively supports sparse vectors since v1.7. Store both dense (Qwen3-Embed 4096-D) and sparse (BM25) vectors per chunk. Qdrant fuses results server-side.

### Files to Modify

- `qdrant_service.py`: Add sparse vector generation (TF-IDF or BM25) alongside dense embeddings
- Collection config: Enable named vectors (`dense` + `sparse`)
- Search method: Query with both, let Qdrant fuse results

### Acceptance Criteria

- [ ] Each chunk stored with both dense and sparse vectors
- [ ] Search queries use hybrid retrieval
- [ ] Exact keyword queries (e.g., "Celigo") return correct results
- [ ] No regression on semantic queries

---

## Upgrade 4: Ollama LLM Models (FUTURE — after Upgrades 1-2)

### What

Add Phi-4-mini and Qwen3-Coder-Next to Ollama for local LLM inference.

### Why

- Phi-4-mini (3.8B, 3 GB VRAM): Fast classifier, simple tasks, HumanEval 74.4%
- Qwen3-Coder-Next (80B MoE, 3B active, ~47 GB with RAM offload): Frontier coding model, HumanEval 92.7%, SWE-Bench 70.6%
- Both free, local, and can handle tasks that currently require Claude

### Setup

```bash
ollama pull phi4-mini
ollama pull qwen3-coder-next  # 52 GB download, Q4_K_M
```

### Integration Points

- Research pipeline: Use Phi-4-mini for simple classification/extraction tasks
- Content writing: Qwen3-Coder-Next for draft generation (currently stubbed)
- RAG Q&A: Phi-4-mini for answering questions from retrieved context

### Note on Claude Integration

The pipeline currently uses Claude Code skills interactively (daytime only). The plan to automate via `claude -p` was rejected due to reliability issues. With Qwen3-Coder-Next available locally, many of those tasks can now be handled by the local model instead. Revisit the `write_lesson_content` stub — it may be implementable with Qwen3-Coder-Next + RAG context rather than Claude API.

---

## Implementation Order

| #   | Upgrade                                   | Kanban Prompts | Depends On      |
| --- | ----------------------------------------- | -------------- | --------------- |
| 1   | Ollama setup on P520 (systemd, RTX 3090)  | 1              | Nothing (infra) |
| 2   | Embedding model upgrade + re-embedding    | 1              | Upgrade 1       |
| 3   | GPU task queue                            | 2              | Upgrade 1       |
| 4   | Hybrid retrieval                          | 1              | Upgrade 2       |
| 5   | Local LLM models (Phi-4-mini, Coder-Next) | 1              | Upgrade 1       |

**Total: 6 kanban prompts**

---

## How to Execute

1. Open Claude Code in `C:\Projects\1_gwthpipeline520`
2. Run `/plan` with this document as context
3. Claude Code will break each upgrade into kanban prompts
4. Run `/build` to execute prompts through the pipeline

Or, if David prefers to execute manually:

1. SSH to P520 and install Ollama + pull models (prerequisite)
2. Pass each upgrade section as a prompt to Claude Code
3. Run `pytest tests/ -m "not acceptance"` after each change
