from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True)
class MatchScores:
    match_score: float
    centroid_score: float
    top3_median_score: float
    best_reference_score: float
    best_reference_name: str


def normalize_embedding(
    embedding: Sequence[float] | NDArray[np.floating[Any]],
) -> NDArray[np.float32]:
    vector = np.asarray(embedding, dtype=np.float32).reshape(-1)
    magnitude = float(np.linalg.norm(vector))
    if not math.isfinite(magnitude) or magnitude <= 1e-12:
        raise ValueError("face embedding has zero or non-finite magnitude")
    return vector / magnitude


def normalized_centroid(
    reference_embeddings: NDArray[np.float32],
) -> NDArray[np.float32]:
    if reference_embeddings.ndim != 2 or reference_embeddings.shape[0] == 0:
        raise ValueError("at least one reference embedding is required")
    return normalize_embedding(np.mean(reference_embeddings, axis=0, dtype=np.float32))


def score_embedding(
    embedding: Sequence[float] | NDArray[np.floating[Any]],
    reference_embeddings: NDArray[np.float32],
    reference_centroid: NDArray[np.float32],
    reference_names: Sequence[str],
) -> MatchScores:
    candidate = normalize_embedding(embedding)
    if reference_embeddings.ndim != 2 or reference_embeddings.shape[0] == 0:
        raise ValueError("at least one reference embedding is required")
    if reference_embeddings.shape[0] != len(reference_names):
        raise ValueError("reference names and embeddings must have equal lengths")
    if reference_embeddings.shape[1] != candidate.shape[0]:
        raise ValueError("candidate and reference embedding dimensions differ")

    similarities = reference_embeddings @ candidate
    best_index = int(np.argmax(similarities))
    descending = np.sort(similarities)[::-1]
    top3_median = float(np.median(descending[:3]))
    centroid_score = float(np.dot(reference_centroid, candidate))
    best_reference_score = float(similarities[best_index])
    return MatchScores(
        match_score=max(centroid_score, top3_median),
        centroid_score=centroid_score,
        top3_median_score=top3_median,
        best_reference_score=best_reference_score,
        best_reference_name=reference_names[best_index],
    )


def classify_disposition(
    face_scores: Sequence[float],
    quality_flags_by_face: Sequence[Sequence[str]],
    match_threshold: float,
    review_threshold: float,
) -> str:
    if len(face_scores) != len(quality_flags_by_face):
        raise ValueError("face scores and quality flags must have equal lengths")
    if not face_scores:
        return "no-face"

    matching_indices = [
        index for index, score in enumerate(face_scores) if score >= match_threshold
    ]
    if matching_indices:
        if len(face_scores) > 1:
            return "group-match"
        if set(quality_flags_by_face[matching_indices[0]]):
            return "low-quality-match"
        return "solo-match"
    if max(face_scores) >= review_threshold:
        return "review"
    return "no-match"
