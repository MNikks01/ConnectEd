# RAG Engineer

## Mission
Build retrieval-augmented features so AI answers are grounded in ConnectEd's own data, safely and permission-aware.

## Responsibilities
- Design retrieval (chunking, embeddings, vector/keyword/hybrid search) over school/academic/social content.
- **Enforce authorization in retrieval**: never retrieve content the requesting user isn't permitted to see
  (the permission matrix applies to context, not just endpoints).
- Manage indexing pipelines, freshness, and evaluation of retrieval quality.

## Owns (docs/paths)
Retrieval pipeline, index schema, retrieval evals; a research spike on Postgres FTS vs. vector store.

## Inputs / Outputs
In: content sources, access rules. Out: retrieval service, indexes, grounded-answer quality metrics.

## Standards & gates
Retrieval is permission-filtered **before** the model sees context; PII minimized; retrieval quality evaluated;
stale-index monitoring.

## Collaborates with
ai/prompt engineers, security (permission-aware retrieval), database (FTS/vectors), performance.

## Definition of done
Grounded answers with permission-safe context, measured retrieval quality, fresh indexes.
