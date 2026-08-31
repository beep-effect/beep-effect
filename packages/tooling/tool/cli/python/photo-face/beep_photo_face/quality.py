from __future__ import annotations

import math
from collections.abc import Callable, Sequence
from typing import Any

import cv2
import numpy as np
from numpy.typing import NDArray

BLUR_VARIANCE_THRESHOLD = 45.0
DARK_MEAN_THRESHOLD = 45.0
BRIGHT_MEAN_THRESHOLD = 220.0


def calculate_face_area_pct(
    box: Sequence[float], image_width: int, image_height: int
) -> float:
    x1, y1, x2, y2 = (float(value) for value in box)
    clipped_x1 = min(max(x1, 0.0), float(image_width))
    clipped_y1 = min(max(y1, 0.0), float(image_height))
    clipped_x2 = min(max(x2, 0.0), float(image_width))
    clipped_y2 = min(max(y2, 0.0), float(image_height))
    face_area = max(0.0, clipped_x2 - clipped_x1) * max(0.0, clipped_y2 - clipped_y1)
    image_area = float(image_width * image_height)
    return 0.0 if image_area <= 0.0 else (face_area / image_area) * 100.0


def clip_box(
    box: Sequence[float], image_width: int, image_height: int
) -> tuple[float, float, float, float]:
    x1, y1, x2, y2 = (float(value) for value in box)
    return (
        min(max(x1, 0.0), float(image_width)),
        min(max(y1, 0.0), float(image_height)),
        min(max(x2, 0.0), float(image_width)),
        min(max(y2, 0.0), float(image_height)),
    )


def is_side_face(
    landmarks: Sequence[Sequence[float]] | NDArray[np.floating[Any]],
) -> bool:
    points = np.asarray(landmarks, dtype=np.float64)
    if points.shape != (5, 2) or not np.all(np.isfinite(points)):
        return False
    left_eye, right_eye = points[:2]
    eye_vector = right_eye - left_eye
    interocular_distance = float(np.linalg.norm(eye_vector))
    if interocular_distance <= 1e-6:
        return False
    angle = -math.atan2(float(eye_vector[1]), float(eye_vector[0]))
    cosine = math.cos(angle)
    sine = math.sin(angle)
    rotation = np.array(((cosine, -sine), (sine, cosine)), dtype=np.float64)
    eye_midpoint = (left_eye + right_eye) / 2.0
    aligned = (points - eye_midpoint) @ rotation.T
    left_eye, right_eye, nose, left_mouth, right_mouth = aligned
    eye_span = abs(float(right_eye[0] - left_eye[0]))
    if eye_span <= 1e-6:
        return False
    eye_midpoint_x = float((left_eye[0] + right_eye[0]) / 2.0)
    mouth_midpoint_x = float((left_mouth[0] + right_mouth[0]) / 2.0)
    facial_axis_x = (eye_midpoint_x + mouth_midpoint_x) / 2.0
    nose_axis_offset = abs(float(nose[0]) - facial_axis_x) / eye_span
    nose_to_left_eye = abs(float(nose[0] - left_eye[0]))
    nose_to_right_eye = abs(float(right_eye[0] - nose[0]))
    larger_eye_distance = max(nose_to_left_eye, nose_to_right_eye)
    eye_symmetry = (
        min(nose_to_left_eye, nose_to_right_eye) / larger_eye_distance
        if larger_eye_distance > 1e-6
        else 1.0
    )
    return nose_axis_offset > 0.18 or eye_symmetry < 0.38


def calculate_quality_flags(
    image: NDArray[np.uint8],
    box: Sequence[float],
    landmarks: NDArray[np.float32],
    min_face_area_pct: float,
    align_face: Callable[..., NDArray[np.uint8]],
) -> tuple[list[str], float]:
    image_height, image_width = image.shape[:2]
    area_pct = calculate_face_area_pct(box, image_width, image_height)
    flags: list[str] = []
    if area_pct < min_face_area_pct:
        flags.append("face-too-small")
    aligned_face = align_face(image, landmark=landmarks, image_size=112)
    grayscale = cv2.cvtColor(aligned_face, cv2.COLOR_BGR2GRAY)
    laplacian_variance = float(cv2.Laplacian(grayscale, cv2.CV_64F).var())
    brightness_mean = float(grayscale.mean())
    if laplacian_variance < BLUR_VARIANCE_THRESHOLD:
        flags.append("blurry")
    if brightness_mean < DARK_MEAN_THRESHOLD:
        flags.append("too-dark")
    if brightness_mean > BRIGHT_MEAN_THRESHOLD:
        flags.append("too-bright")
    if is_side_face(landmarks):
        flags.append("side-face")
    return flags, area_pct
