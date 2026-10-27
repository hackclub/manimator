"""
manimator's Manim-compatible core.

A small, pure-Python + numpy implementation of the parts of the Manim CE API
that matter most for authoring. Nothing here rasterizes: Scene bakes every
frame into a flat float32 buffer that the browser draws with the GPU/Canvas.

Frame buffer layout (float32), repeated per drawable item:
  [kind, src_line, n_points,
   stroke r, g, b, a, stroke_width,
   fill r, g, b, a,
   string_index, reveal, font,
   x0, y0, x1, y1, ...]
kind 0 = cubic bezier path (points come in groups of 4), kind 1 = text box
(4 corners: UL, UR, DR, DL).
"""

import copy as _copy
import inspect
import json
import math
import sys

import numpy as np

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

ORIGIN = np.array([0.0, 0.0, 0.0])
UP = np.array([0.0, 1.0, 0.0])
DOWN = np.array([0.0, -1.0, 0.0])
RIGHT = np.array([1.0, 0.0, 0.0])
LEFT = np.array([-1.0, 0.0, 0.0])
IN = np.array([0.0, 0.0, -1.0])
OUT = np.array([0.0, 0.0, 1.0])
UL, UR, DL, DR = UP + LEFT, UP + RIGHT, DOWN + LEFT, DOWN + RIGHT
X_AXIS, Y_AXIS, Z_AXIS = RIGHT, UP, OUT

PI = math.pi
TAU = 2 * math.pi
DEGREES = TAU / 360

SMALL_BUFF = 0.1
MED_SMALL_BUFF = 0.25
MED_LARGE_BUFF = 0.5
LARGE_BUFF = 1.0
DEFAULT_MOBJECT_TO_EDGE_BUFFER = MED_LARGE_BUFF
DEFAULT_MOBJECT_TO_MOBJECT_BUFFER = MED_SMALL_BUFF
DEFAULT_STROKE_WIDTH = 4
DEFAULT_FONT_SIZE = 48

FRAME_HEIGHT = 8.0
FRAME_WIDTH = FRAME_HEIGHT * 16 / 9
FRAME_X_RADIUS = FRAME_WIDTH / 2
FRAME_Y_RADIUS = FRAME_HEIGHT / 2

WHITE = "#FFFFFF"
BLACK = "#000000"
GRAY = GREY = "#888888"
LIGHT_GRAY = LIGHT_GREY = "#BBBBBB"
DARK_GRAY = DARK_GREY = "#444444"
BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E = "#C7E9F1", "#9CDCEB", "#58C4DD", "#29ABCA", "#236B8E"
TEAL_A, TEAL_B, TEAL_C, TEAL_D, TEAL_E = "#ACEAD7", "#76DDC0", "#5CD0B3", "#55C1A7", "#49A88F"
GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E = "#C9E2AE", "#A6CF8C", "#83C167", "#77B05D", "#699C52"
YELLOW_A, YELLOW_B, YELLOW_C, YELLOW_D, YELLOW_E = "#FFF1B6", "#FFEA94", "#FFFF00", "#F4D345", "#E8C11C"
GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E = "#F7C797", "#F9B775", "#F0AC5F", "#E1A158", "#C78D46"
RED_A, RED_B, RED_C, RED_D, RED_E = "#F7A1A3", "#FF8080", "#FC6255", "#E65A4C", "#CF5044"
MAROON_A, MAROON_B, MAROON_C, MAROON_D, MAROON_E = "#ECABC1", "#EC92AB", "#C55F73", "#A24D61", "#94424F"
PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E = "#CAA3E8", "#B189C6", "#9A72AC", "#715582", "#644172"
BLUE, TEAL, GREEN, YELLOW, GOLD, RED, MAROON, PURPLE = BLUE_C, TEAL_C, GREEN_C, YELLOW_C, GOLD_C, RED_C, MAROON_C, PURPLE_C
PINK = "#D147BD"
LIGHT_PINK = "#DC75CD"
ORANGE = "#FF862F"
LIGHT_BROWN = "#CD853F"
DARK_BROWN = "#8B4513"
DARK_BLUE = "#236B8E"


class _Config:
    def __init__(self):
        self.frame_rate = 30
        self.background_color = BLACK
        self.frame_width = FRAME_WIDTH
        self.frame_height = FRAME_HEIGHT


config = _Config()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def color_to_rgb(c):
    if c is None:
        return np.array([1.0, 1.0, 1.0])
    if isinstance(c, ManimColor):
        return c.rgb.copy()
    if isinstance(c, str):
        h = c.lstrip("#")
        if len(h) == 3:
            h = "".join(ch * 2 for ch in h)
        return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])
    arr = np.array(c, dtype=float)
    if arr.max() > 1:
        arr = arr / 255
    return arr[:3]


class ManimColor:
    def __init__(self, value):
        self.rgb = color_to_rgb(value)

    def to_hex(self):
        return "#" + "".join(f"{int(round(v * 255)):02X}" for v in self.rgb)

    def interpolate(self, other, alpha):
        return ManimColor((1 - alpha) * self.rgb + alpha * color_to_rgb(other))


def rgb_to_hex(rgb):
    return ManimColor(rgb).to_hex()


def interpolate_color(c1, c2, alpha):
    return rgb_to_hex((1 - alpha) * color_to_rgb(c1) + alpha * color_to_rgb(c2))


def color_gradient(colors, n):
    if n <= 1:
        return [colors[0]]
    rgbs = [color_to_rgb(c) for c in colors]
    out = []
    for i in range(n):
        t = i / (n - 1) * (len(rgbs) - 1)
        j = min(int(t), len(rgbs) - 2)
        out.append(rgb_to_hex(rgbs[j] * (1 - (t - j)) + rgbs[j + 1] * (t - j)))
    return out


def interpolate(a, b, alpha):
    return (1 - alpha) * a + alpha * b


def _vec(p):
    p = np.array(p, dtype=float).ravel()
    if p.size == 2:
        p = np.append(p, 0.0)
    return p


def rotation_matrix(angle, axis=OUT):
    axis = _vec(axis)
    axis = axis / (np.linalg.norm(axis) or 1)
    x, y, z = axis
    c, s = math.cos(angle), math.sin(angle)
    C = 1 - c
    return np.array([
        [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
        [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
        [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
    ])


def partial_bezier(curve, a, b):
    """Sub-curve of a cubic bezier (4x3) between params a and b."""
    if a == 0 and b == 1:
        return curve.copy()
    if b <= a:
        p = _bezier_point(curve, a)
        return np.array([p, p, p, p])

    def split_right(c, t):  # portion [t, 1]
        p0, p1, p2, p3 = c
        p01, p12, p23 = p0 + t * (p1 - p0), p1 + t * (p2 - p1), p2 + t * (p3 - p2)
        p012, p123 = p01 + t * (p12 - p01), p12 + t * (p23 - p12)
        p0123 = p012 + t * (p123 - p012)
        return np.array([p0123, p123, p23, p3])

    def split_left(c, t):  # portion [0, t]
        p0, p1, p2, p3 = c
        p01, p12, p23 = p0 + t * (p1 - p0), p1 + t * (p2 - p1), p2 + t * (p3 - p2)
        p012, p123 = p01 + t * (p12 - p01), p12 + t * (p23 - p12)
        p0123 = p012 + t * (p123 - p012)
        return np.array([p0, p01, p012, p0123])

    c = split_right(curve, a) if a > 0 else curve
    if b < 1:
        c = split_left(c, (b - a) / (1 - a))
    return c


def _bezier_point(c, t):
    s = 1 - t
    return s ** 3 * c[0] + 3 * s * s * t * c[1] + 3 * s * t * t * c[2] + t ** 3 * c[3]


def _line_curve(a, b):
    return np.array([a, a + (b - a) / 3, a + 2 * (b - a) / 3, b])


def _arc_points(radius, start_angle, angle, n_components=None):
    if n_components is None:
        n_components = max(2, int(math.ceil(abs(angle) / (TAU / 8))))
    pts = []
    d = angle / n_components
    k = 4 / 3 * math.tan(d / 4)
    for i in range(n_components):
        a0 = start_angle + i * d
        a1 = a0 + d
        p0 = np.array([math.cos(a0), math.sin(a0), 0]) * radius
        p3 = np.array([math.cos(a1), math.sin(a1), 0]) * radius
        t0 = np.array([-math.sin(a0), math.cos(a0), 0]) * radius * k
        t1 = np.array([-math.sin(a1), math.cos(a1), 0]) * radius * k
        pts.extend([p0, p0 + t0, p3 - t1, p3])
    return np.array(pts)


def _smooth_curves(anchors):
    """Catmull-Rom spline through anchors, as cubic beziers."""
    anchors = np.array(anchors, dtype=float)
    n = len(anchors)
    if n < 2:
        return np.zeros((0, 3))
    out = []
    for i in range(n - 1):
        p0 = anchors[max(i - 1, 0)]
        p1, p2 = anchors[i], anchors[i + 1]
        p3 = anchors[min(i + 2, n - 1)]
        out.extend([p1, p1 + (p2 - p0) / 6, p2 - (p3 - p1) / 6, p2])
    return np.array(out)


# --- rate functions --------------------------------------------------------

def linear(t):
    return t


def _sigmoid(x):
    return 1 / (1 + math.exp(-x))


def smooth(t, inflection=10.0):
    err = _sigmoid(-inflection / 2)
    return min(max((_sigmoid(inflection * (t - 0.5)) - err) / (1 - 2 * err), 0), 1)


def rush_into(t):
    return 2 * smooth(t / 2.0)


def rush_from(t):
    return 2 * smooth(t / 2.0 + 0.5) - 1


def there_and_back(t):
    return smooth(2 * t if t < 0.5 else 2 * (1 - t))


def double_smooth(t):
    return 0.5 * smooth(2 * t) if t < 0.5 else 0.5 * (1 + smooth(2 * t - 1))


def ease_in_out_sine(t):
    return -(math.cos(PI * t) - 1) / 2


def ease_out_cubic(t):
    return 1 - (1 - t) ** 3


def ease_in_cubic(t):
    return t ** 3


def ease_out_bounce(t):
    n1, d1 = 7.5625, 2.75
    if t < 1 / d1:
        return n1 * t * t
    if t < 2 / d1:
        t -= 1.5 / d1
        return n1 * t * t + 0.75
    if t < 2.5 / d1:
        t -= 2.25 / d1
        return n1 * t * t + 0.9375
    t -= 2.625 / d1
    return n1 * t * t + 0.984375


class rate_functions:
    linear = staticmethod(linear)
    smooth = staticmethod(smooth)
    rush_into = staticmethod(rush_into)
    rush_from = staticmethod(rush_from)
    there_and_back = staticmethod(there_and_back)
    double_smooth = staticmethod(double_smooth)
    ease_in_out_sine = staticmethod(ease_in_out_sine)
    ease_out_cubic = staticmethod(ease_out_cubic)
    ease_in_cubic = staticmethod(ease_in_cubic)
    ease_out_bounce = staticmethod(ease_out_bounce)


# ---------------------------------------------------------------------------
# Source tracking: which line of the user's scene created a mobject
# ---------------------------------------------------------------------------

USER_FILENAME = "<scene>"


def _user_line():
    f = sys._getframe(1)
    while f is not None:
        if f.f_code.co_filename == USER_FILENAME:
            return f.f_lineno
        f = f.f_back
    return 0


# ---------------------------------------------------------------------------
# Mobjects
# ---------------------------------------------------------------------------

class Mobject:
    drawable = False

    def __init__(self, color=None, **kwargs):
        self.points = np.zeros((0, 3))
        self.submobjects = []
        self.updaters = []
        self.text = None
        self.reveal = 1.0
        self.font = 0
        self.stroke_rgba = np.array([1.0, 1.0, 1.0, 1.0])
        self.fill_rgba = np.array([1.0, 1.0, 1.0, 0.0])
        self.stroke_width = 0.0
        self._src = _user_line()
        self.name = type(self).__name__

    # --- family ---------------------------------------------------------
    def add(self, *mobs):
        for m in mobs:
            if m is self:
                raise ValueError("Mobject cannot contain itself")
            if m not in self.submobjects:
                self.submobjects.append(m)
        return self

    def remove(self, *mobs):
        for m in mobs:
            if m in self.submobjects:
                self.submobjects.remove(m)
        return self

    def get_family(self):
        out = [self]
        for s in self.submobjects:
            out.extend(s.get_family())
        return out

    def family_members_with_points(self):
        return [m for m in self.get_family() if len(m.points) > 0]

    def __getitem__(self, i):
        if isinstance(i, slice):
            return VGroup(*self.submobjects[i])
        return self.submobjects[i]

    def __iter__(self):
        return iter(self.submobjects)

    def __len__(self):
        return len(self.submobjects)

    def copy(self):
        return _copy.deepcopy(self)

    def __deepcopy__(self, memo):
        cls = self.__class__
        new = cls.__new__(cls)
        memo[id(self)] = new
        for k, v in self.__dict__.items():
            if k == "updaters":
                new.updaters = list(v)
            elif isinstance(v, np.ndarray):
                setattr(new, k, v.copy())
            else:
                setattr(new, k, _copy.deepcopy(v, memo))
        return new

    # --- geometry -------------------------------------------------------
    def get_all_points(self):
        pts = [m.points for m in self.get_family() if m.drawable and len(m.points)]
        if not pts:
            pts = [m.points for m in self.get_family() if len(m.points)]
        return np.vstack(pts) if pts else np.zeros((1, 3))

    def _bbox(self):
        pts = self.get_all_points()
        return pts.min(axis=0), pts.max(axis=0)

    def get_critical_point(self, direction):
        lo, hi = self._bbox()
        mid = (lo + hi) / 2
        d = _vec(direction)
        return np.where(d > 0, hi, np.where(d < 0, lo, mid))

    def get_center(self):
        return self.get_critical_point(ORIGIN)

    def get_top(self):
        return self.get_critical_point(UP)

    def get_bottom(self):
        return self.get_critical_point(DOWN)

    def get_left(self):
        return self.get_critical_point(LEFT)

    def get_right(self):
        return self.get_critical_point(RIGHT)

    def get_corner(self, d):
        return self.get_critical_point(d)

    def get_edge_center(self, d):
        return self.get_critical_point(d)

    def get_start(self):
        return self.points[0].copy()

    def get_end(self):
        return self.points[-1].copy()

    def get_x(self):
        return float(self.get_center()[0])

    def get_y(self):
        return float(self.get_center()[1])

    def get_width(self):
        lo, hi = self._bbox()
        return float(hi[0] - lo[0])

    def get_height(self):
        lo, hi = self._bbox()
        return float(hi[1] - lo[1])

    @property
    def width(self):
        return self.get_width()

    @width.setter
    def width(self, w):
        self.scale_to_fit_width(w)

    @property
    def height(self):
        return self.get_height()

    @height.setter
    def height(self, h):
        self.scale_to_fit_height(h)

    def apply_points_function(self, fn, about_point=None, about_edge=ORIGIN):
        if about_point is None:
            about_point = self.get_critical_point(about_edge)
        for m in self.get_family():
            if len(m.points):
                m.points = fn(m.points - about_point) + about_point
        return self

    def shift(self, *vectors):
        v = sum((_vec(x) for x in vectors), np.zeros(3))
        for m in self.get_family():
            if len(m.points):
                m.points = m.points + v
        return self

    def scale(self, factor, about_point=None, about_edge=ORIGIN, **kwargs):
        f = np.array(factor, dtype=float)
        return self.apply_points_function(lambda p: p * f, about_point, about_edge)

    def stretch(self, factor, dim, **kwargs):
        def fn(p):
            p = p.copy()
            p[:, dim] *= factor
            return p
        return self.apply_points_function(fn, kwargs.get("about_point"), kwargs.get("about_edge", ORIGIN))

    def rotate(self, angle, axis=OUT, about_point=None, **kwargs):
        R = rotation_matrix(angle, axis)
        return self.apply_points_function(lambda p: p @ R.T, about_point, kwargs.get("about_edge", ORIGIN))

    def flip(self, axis=UP, **kwargs):
        return self.rotate(PI, axis, **kwargs)

    def move_to(self, point_or_mobject, aligned_edge=ORIGIN, coor_mask=np.array([1, 1, 1])):
        if isinstance(point_or_mobject, Mobject):
            target = point_or_mobject.get_critical_point(aligned_edge)
        else:
            target = _vec(point_or_mobject)
        here = self.get_critical_point(aligned_edge)
        return self.shift((target - here) * coor_mask)

    def center(self):
        return self.move_to(ORIGIN)

    def next_to(self, mobject_or_point, direction=RIGHT, buff=DEFAULT_MOBJECT_TO_MOBJECT_BUFFER,
                aligned_edge=ORIGIN, **kwargs):
        direction = _vec(direction)
        aligned_edge = _vec(aligned_edge)
        if isinstance(mobject_or_point, Mobject):
            target = mobject_or_point.get_critical_point(aligned_edge + direction)
        else:
            target = _vec(mobject_or_point)
        here = self.get_critical_point(aligned_edge - direction)
        return self.shift(target - here + buff * direction)

    def to_edge(self, edge=LEFT, buff=DEFAULT_MOBJECT_TO_EDGE_BUFFER):
        return self.align_on_border(edge, buff)

    def to_corner(self, corner=DL, buff=DEFAULT_MOBJECT_TO_EDGE_BUFFER):
        return self.align_on_border(corner, buff)

    def align_on_border(self, direction, buff=DEFAULT_MOBJECT_TO_EDGE_BUFFER):
        direction = _vec(direction)
        target = np.sign(direction) * np.array([FRAME_X_RADIUS, FRAME_Y_RADIUS, 0])
        here = self.get_critical_point(direction)
        shift = target - here - direction * buff
        return self.shift(shift * np.abs(np.sign(direction)))

    def align_to(self, mobject_or_point, direction=ORIGIN):
        direction = _vec(direction)
        if isinstance(mobject_or_point, Mobject):
            point = mobject_or_point.get_critical_point(direction)
        else:
            point = _vec(mobject_or_point)
        here = self.get_critical_point(direction)
        mask = np.abs(np.sign(direction))
        return self.shift((point - here) * mask)

    def set_x(self, x):
        return self.shift(RIGHT * (x - self.get_x()))

    def set_y(self, y):
        return self.shift(UP * (y - self.get_y()))

    def scale_to_fit_width(self, w, **kwargs):
        cur = self.get_width()
        return self.scale(w / cur, **kwargs) if cur else self

    def scale_to_fit_height(self, h, **kwargs):
        cur = self.get_height()
        return self.scale(h / cur, **kwargs) if cur else self

    def set_width(self, w, **kwargs):
        return self.scale_to_fit_width(w, **kwargs)

    def set_height(self, h, **kwargs):
        return self.scale_to_fit_height(h, **kwargs)

    def arrange(self, direction=RIGHT, buff=DEFAULT_MOBJECT_TO_MOBJECT_BUFFER, center=True, **kwargs):
        for a, b in zip(self.submobjects, self.submobjects[1:]):
            b.next_to(a, direction, buff, **kwargs)
        if center:
            self.center()
        return self

    def arrange_in_grid(self, rows=None, cols=None, buff=MED_SMALL_BUFF, **kwargs):
        n = len(self.submobjects)
        if rows is None and cols is None:
            cols = int(math.ceil(math.sqrt(n)))
        if cols is None:
            cols = int(math.ceil(n / rows))
        rows = int(math.ceil(n / cols))
        cw = max((m.get_width() for m in self.submobjects), default=0)
        ch = max((m.get_height() for m in self.submobjects), default=0)
        for i, m in enumerate(self.submobjects):
            r, c = divmod(i, cols)
            m.move_to(np.array([c * (cw + buff), -r * (ch + buff), 0]))
        return self.center()

    # --- style ------------------------------------------------------------
    def set_color(self, color=None, family=True):
        rgb = color_to_rgb(color)
        for m in self.get_family() if family else [self]:
            m.stroke_rgba[:3] = rgb
            m.fill_rgba[:3] = rgb
        return self

    def set_fill(self, color=None, opacity=None, family=True):
        for m in self.get_family() if family else [self]:
            if color is not None:
                m.fill_rgba[:3] = color_to_rgb(color)
            if opacity is not None:
                m.fill_rgba[3] = opacity
        return self

    def set_stroke(self, color=None, width=None, opacity=None, family=True):
        for m in self.get_family() if family else [self]:
            if color is not None:
                m.stroke_rgba[:3] = color_to_rgb(color)
            if width is not None:
                m.stroke_width = width
            if opacity is not None:
                m.stroke_rgba[3] = opacity
        return self

    def set_style(self, fill_color=None, fill_opacity=None, stroke_color=None, stroke_width=None,
                  stroke_opacity=None, **kwargs):
        self.set_fill(fill_color, fill_opacity)
        return self.set_stroke(stroke_color, stroke_width, stroke_opacity)

    def set_opacity(self, opacity):
        for m in self.get_family():
            m.stroke_rgba[3] = opacity
            m.fill_rgba[3] = opacity
        return self

    def fade(self, darkness=0.5):
        for m in self.get_family():
            m.stroke_rgba[3] *= 1 - darkness
            m.fill_rgba[3] *= 1 - darkness
        return self

    def set_color_by_gradient(self, *colors):
        members = self.family_members_with_points()
        for m, c in zip(members, color_gradient(colors, len(members))):
            m.set_color(c, family=False)
        return self

    def get_color(self):
        src = self.stroke_rgba if self.stroke_width > 0 else self.fill_rgba
        return rgb_to_hex(src[:3])

    def get_fill_opacity(self):
        return float(self.fill_rgba[3])

    def set_z_index(self, z):
        return self

    # --- updaters ---------------------------------------------------------
    def add_updater(self, fn, call_updater=False):
        try:
            nargs = len(inspect.signature(fn).parameters)
        except (TypeError, ValueError):
            nargs = 1
        self.updaters.append((fn, nargs >= 2))
        if call_updater:
            self._run_updater(fn, nargs >= 2, 0)
        return self

    def remove_updater(self, fn):
        self.updaters = [(f, d) for f, d in self.updaters if f is not fn]
        return self

    def clear_updaters(self):
        for m in self.get_family():
            m.updaters = []
        return self

    def _run_updater(self, fn, wants_dt, dt):
        fn(self, dt) if wants_dt else fn(self)

    def update(self, dt=0):
        for m in self.get_family():
            for fn, wants_dt in list(m.updaters):
                m._run_updater(fn, wants_dt, dt)
        return self

    # --- transforms / interpolation ---------------------------------------
    def become(self, other):
        other = other.copy()
        self.points = other.points
        self.submobjects = other.submobjects
        self.text = other.text
        self.reveal = other.reveal
        self.font = other.font
        self.stroke_rgba = other.stroke_rgba
        self.fill_rgba = other.fill_rgba
        self.stroke_width = other.stroke_width
        self.drawable = other.drawable
        return self

    def interpolate_self(self, m1, m2, alpha):
        if m1.points.shape == m2.points.shape:
            self.points = interpolate(m1.points, m2.points, alpha)
        else:
            self.points = (m1 if alpha < 0.5 else m2).points.copy()
        self.stroke_rgba = interpolate(m1.stroke_rgba, m2.stroke_rgba, alpha)
        self.fill_rgba = interpolate(m1.fill_rgba, m2.fill_rgba, alpha)
        self.stroke_width = interpolate(m1.stroke_width, m2.stroke_width, alpha)
        self.reveal = interpolate(m1.reveal, m2.reveal, alpha)
        src = m1 if alpha < 0.5 else m2
        self.text, self.font, self.drawable = src.text, src.font, src.drawable
        return self

    def get_point_mobject(self, center=None):
        p = VectorizedPoint(self.get_center() if center is None else center)
        p.stroke_rgba = self.stroke_rgba.copy()
        p.fill_rgba = self.fill_rgba.copy()
        p.stroke_rgba[3] = 0
        p.fill_rgba[3] = 0
        p._src = self._src
        return p

    def pointwise_become_partial(self, mob, a, b):
        if self.text is not None:
            self.points = mob.points.copy()
            self.reveal = mob.reveal * b
            return self
        n = len(mob.points) // 4
        if n == 0:
            return self
        curves = mob.points.reshape(n, 4, 3)
        lo, hi = a * n, b * n
        i0, i1 = int(min(lo, n - 1)), int(min(hi, n - 1e-9))
        out = []
        for i in range(i0, i1 + 1):
            ta, tb = max(lo - i, 0), min(hi - i, 1)
            if tb <= ta and i != i0:
                continue
            out.append(partial_bezier(curves[i], ta, tb))
        self.points = np.vstack(out) if out else curves[0].copy()
        return self

    @property
    def animate(self):
        return _AnimationBuilder(self)

    def __repr__(self):
        return f"{self.name}"


def _align_points(m1, m2):
    if m1.text is not None or m2.text is not None:
        return
    n1, n2 = len(m1.points), len(m2.points)
    if n1 == n2:
        return
    # Empty mobjects and single points (VectorizedPoint) collapse onto one spot
    if n1 < 4:
        p = m1.points[0] if n1 else (m1.get_center() if m1.submobjects else m2.get_center())
        m1.points = np.repeat([p], n2, axis=0)
        return
    if n2 < 4:
        p = m2.points[0] if n2 else (m2.get_center() if m2.submobjects else m1.get_center())
        m2.points = np.repeat([p], n1, axis=0)
        return
    target = max(n1, n2) // 4
    for m in (m1, m2):
        cur = len(m.points) // 4
        if cur < target:
            m.points = _insert_curves(m.points, target - cur)


def _insert_curves(points, n):
    m = len(points) // 4
    curves = points.reshape(m, 4, 3)
    target = m + n
    split = np.zeros(m, dtype=int)
    for j in range(target):
        split[j * m // target] += 1
    out = []
    for c, k in zip(curves, split):
        for i in range(k):
            out.append(partial_bezier(c, i / k, (i + 1) / k))
    return np.vstack(out)


def _align_submobjects(m1, m2):
    n1, n2 = len(m1.submobjects), len(m2.submobjects)
    if n1 < n2:
        _add_n_more_submobjects(m1, n2 - n1)
    elif n2 < n1:
        _add_n_more_submobjects(m2, n1 - n2)


def _add_n_more_submobjects(m, n):
    if n == 0:
        return
    cur = len(m.submobjects)
    if cur == 0:
        m.submobjects = [m.get_point_mobject() for _ in range(n)]
        return
    target = cur + n
    repeat = (np.arange(target) * cur) // target
    split = [int((repeat == i).sum()) for i in range(cur)]
    new = []
    for sub, k in zip(m.submobjects, split):
        new.append(sub)
        for _ in range(1, k):
            new.append(sub.copy().fade(1))
    m.submobjects = new


def align_data(m1, m2):
    _align_submobjects(m1, m2)
    _align_points(m1, m2)
    for a, b in zip(m1.submobjects, m2.submobjects):
        align_data(a, b)


class VMobject(Mobject):
    drawable = True

    def __init__(self, color=None, stroke_color=None, stroke_width=DEFAULT_STROKE_WIDTH,
                 stroke_opacity=1.0, fill_color=None, fill_opacity=0.0, **kwargs):
        super().__init__()
        base = color_to_rgb(color if color is not None else WHITE)
        self.stroke_rgba = np.append(color_to_rgb(stroke_color) if stroke_color is not None else base,
                                     stroke_opacity)
        self.fill_rgba = np.append(color_to_rgb(fill_color) if fill_color is not None else base, fill_opacity)
        self.stroke_width = float(stroke_width)

    def set_points(self, points):
        self.points = np.array(points, dtype=float).reshape(-1, 3)
        return self

    def set_points_as_corners(self, corners):
        corners = [_vec(c) for c in corners]
        self.points = np.vstack([_line_curve(a, b) for a, b in zip(corners, corners[1:])]) \
            if len(corners) > 1 else np.zeros((0, 3))
        return self

    def set_points_smoothly(self, anchors):
        self.points = _smooth_curves([_vec(a) for a in anchors])
        return self

    def append_points(self, pts):
        self.points = np.vstack([self.points, pts])
        return self

    def point_from_proportion(self, alpha):
        n = len(self.points) // 4
        if n == 0:
            return self.get_center()
        x = min(max(alpha, 0), 1) * n
        i = min(int(x), n - 1)
        return _bezier_point(self.points[4 * i:4 * i + 4], x - i)


class VGroup(VMobject):
    def __init__(self, *mobjects, **kwargs):
        super().__init__(**kwargs)
        self.add(*mobjects)


Group = VGroup


class VectorizedPoint(VMobject):
    def __init__(self, location=ORIGIN, **kwargs):
        super().__init__(stroke_width=0, **kwargs)
        self.points = np.array([_vec(location)])
        self.drawable = False


class Dot(VMobject):
    def __init__(self, point=ORIGIN, radius=0.08, color=WHITE, fill_opacity=1.0, **kwargs):
        super().__init__(color=color, fill_opacity=fill_opacity, stroke_width=0, **kwargs)
        self.points = _arc_points(radius, 0, TAU, 8)
        self.shift(point)


class Arc(VMobject):
    def __init__(self, radius=1.0, start_angle=0, angle=TAU / 4, arc_center=ORIGIN, color=WHITE, **kwargs):
        super().__init__(color=color, **kwargs)
        self.points = _arc_points(radius, start_angle, angle)
        self.shift(arc_center)


class Circle(VMobject):
    def __init__(self, radius=1.0, color=RED, **kwargs):
        super().__init__(color=color, **kwargs)
        self.points = _arc_points(radius, 0, TAU, 8)

    def surround(self, mob, buffer_factor=1.2):
        self.scale_to_fit_width(max(mob.get_width(), mob.get_height()) * buffer_factor)
        return self.move_to(mob)

    def point_at_angle(self, angle):
        r = self.get_width() / 2
        return self.get_center() + r * np.array([math.cos(angle), math.sin(angle), 0])


class Ellipse(Circle):
    def __init__(self, width=2, height=1, color=WHITE, **kwargs):
        super().__init__(radius=1, color=color, **kwargs)
        self.stretch(width / 2, 0).stretch(height / 2, 1)


class Annulus(VMobject):
    def __init__(self, inner_radius=1, outer_radius=2, color=WHITE, fill_opacity=1, **kwargs):
        super().__init__(color=color, fill_opacity=fill_opacity, stroke_width=0, **kwargs)
        self.points = np.vstack([_arc_points(outer_radius, 0, TAU, 8), _arc_points(inner_radius, 0, -TAU, 8)])


class Polygon(VMobject):
    def __init__(self, *vertices, color=BLUE, **kwargs):
        super().__init__(color=color, **kwargs)
        v = [_vec(p) for p in vertices]
        self.set_points_as_corners(v + [v[0]])

    def get_vertices(self):
        return self.points[::4]


class RegularPolygon(Polygon):
    def __init__(self, n=6, radius=1, start_angle=None, color=WHITE, **kwargs):
        if start_angle is None:
            start_angle = PI / 2 if n % 2 else PI / 2 - PI / n
        verts = [radius * np.array([math.cos(start_angle + TAU * i / n), math.sin(start_angle + TAU * i / n), 0])
                 for i in range(n)]
        super().__init__(*verts, color=color, **kwargs)


class Triangle(RegularPolygon):
    def __init__(self, **kwargs):
        super().__init__(n=3, **kwargs)


class Star(Polygon):
    def __init__(self, n=5, outer_radius=1, inner_radius=None, color=WHITE, **kwargs):
        if inner_radius is None:
            inner_radius = outer_radius * 0.382
        verts = []
        for i in range(2 * n):
            r = outer_radius if i % 2 == 0 else inner_radius
            a = PI / 2 + PI * i / n
            verts.append(r * np.array([math.cos(a), math.sin(a), 0]))
        super().__init__(*verts, color=color, **kwargs)


class Rectangle(Polygon):
    def __init__(self, width=4.0, height=2.0, color=WHITE, **kwargs):
        w, h = width / 2, height / 2
        super().__init__([w, h, 0], [-w, h, 0], [-w, -h, 0], [w, -h, 0], color=color, **kwargs)


class Square(Rectangle):
    def __init__(self, side_length=2.0, **kwargs):
        super().__init__(width=side_length, height=side_length, **kwargs)


class RoundedRectangle(VMobject):
    def __init__(self, width=4.0, height=2.0, corner_radius=0.5, color=WHITE, **kwargs):
        super().__init__(color=color, **kwargs)
        w, h, r = width / 2, height / 2, min(corner_radius, width / 2, height / 2)
        pts = []
        corners = [(w - r, h - r, 0), (-w + r, h - r, PI / 2), (-w + r, -h + r, PI), (w - r, -h + r, 3 * PI / 2)]
        for i, (cx, cy, a) in enumerate(corners):
            arc = _arc_points(r, a, PI / 2, 1) + np.array([cx, cy, 0])
            pts.append(arc)
            nx, ny, _ = corners[(i + 1) % 4]
            na = corners[(i + 1) % 4][2]
            nxt = np.array([nx + r * math.cos(na), ny + r * math.sin(na), 0])
            pts.append(_line_curve(arc[-1], nxt))
        self.points = np.vstack(pts)


class Line(VMobject):
    def __init__(self, start=LEFT, end=RIGHT, buff=0, color=WHITE, **kwargs):
        super().__init__(color=color, **kwargs)
        self._set_ends(start, end, buff)

    def _set_ends(self, start, end, buff=0):
        s = start.get_center() if isinstance(start, Mobject) else _vec(start)
        e = end.get_center() if isinstance(end, Mobject) else _vec(end)
        d = e - s
        L = np.linalg.norm(d)
        if buff and L > 2 * buff:
            u = d / L
            s, e = s + u * buff, e - u * buff
        self.points = _line_curve(s, e)

    def put_start_and_end_on(self, start, end):
        self._set_ends(start, end)
        return self

    def get_length(self):
        return float(np.linalg.norm(self.points[-1] - self.points[0]))

    def get_angle(self):
        d = self.points[-1] - self.points[0]
        return math.atan2(d[1], d[0])

    def get_unit_vector(self):
        d = self.points[-1] - self.points[0]
        return d / (np.linalg.norm(d) or 1)


class DashedLine(Line):
    def __init__(self, *args, dash_length=0.1, **kwargs):
        super().__init__(*args, **kwargs)
        s, e = self.points[0], self.points[-1]
        L = np.linalg.norm(e - s)
        n = max(1, int(L / (2 * dash_length)))
        pts = []
        for i in range(n):
            a, b = i / n, (i + 0.5) / n
            pts.append(_line_curve(s + (e - s) * a, s + (e - s) * b))
        self.points = np.vstack(pts)


class ArrowTip(VMobject):
    def __init__(self, length=0.35, color=WHITE, **kwargs):
        super().__init__(color=color, fill_opacity=1, stroke_width=0, **kwargs)
        self.set_points_as_corners([[0, 0, 0], [-length, length / 2, 0], [-length, -length / 2, 0], [0, 0, 0]])


class Arrow(Line):
    def __init__(self, start=LEFT, end=RIGHT, buff=MED_SMALL_BUFF, stroke_width=6, tip_length=0.3,
                 color=WHITE, **kwargs):
        super().__init__(start, end, buff=buff, color=color, stroke_width=stroke_width, **kwargs)
        s, e = self.points[0].copy(), self.points[-1].copy()
        L = np.linalg.norm(e - s)
        tl = min(tip_length, L / 2)
        u = (e - s) / (L or 1)
        self.points = _line_curve(s, e - u * tl * 0.9)
        tip = ArrowTip(length=tl, color=color)
        tip.rotate(math.atan2(u[1], u[0]), about_point=ORIGIN).shift(e)
        tip._src = self._src
        self.add(tip)
        self.tip = tip


class Vector(Arrow):
    def __init__(self, direction=RIGHT, buff=0, **kwargs):
        super().__init__(ORIGIN, direction, buff=buff, **kwargs)


class DoubleArrow(Arrow):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        s, e = self.get_start(), self.tip.points[0]
        u = (e - s) / (np.linalg.norm(e - s) or 1)
        tip2 = self.tip.copy().rotate(PI, about_point=self.tip.points[0]).shift(s - e)
        self.points = _line_curve(s + u * 0.27, self.points[-1])
        self.add(tip2)


class SurroundingRectangle(Rectangle):
    def __init__(self, mobject, color=YELLOW, buff=SMALL_BUFF, **kwargs):
        super().__init__(width=mobject.get_width() + 2 * buff, height=mobject.get_height() + 2 * buff,
                         color=color, **kwargs)
        self.move_to(mobject)


class BackgroundRectangle(SurroundingRectangle):
    def __init__(self, mobject, color=BLACK, fill_opacity=0.75, buff=0, **kwargs):
        super().__init__(mobject, color=color, buff=buff, fill_opacity=fill_opacity, stroke_width=0, **kwargs)


class Brace(VMobject):
    def __init__(self, mobject, direction=DOWN, buff=0.2, color=WHITE, **kwargs):
        super().__init__(color=color, fill_opacity=0, **kwargs)
        d = _vec(direction)
        horizontal = abs(d[1]) >= abs(d[0])
        lo, hi = mobject._bbox()
        if horizontal:
            w = hi[0] - lo[0]
            y = (hi[1] if d[1] > 0 else lo[1]) + np.sign(d[1] or -1) * buff
            s = np.sign(d[1] or -1)
            x0, x1, xm = lo[0], hi[0], (lo[0] + hi[0]) / 2
            q = 0.15
            anchors = [[x0, y, 0], [x0 + q, y + s * q, 0], [xm - q, y + s * q, 0], [xm, y + s * 2 * q, 0],
                       [xm + q, y + s * q, 0], [x1 - q, y + s * q, 0], [x1, y, 0]]
        else:
            x = (hi[0] if d[0] > 0 else lo[0]) + np.sign(d[0] or 1) * buff
            s = np.sign(d[0] or 1)
            y0, y1, ym = lo[1], hi[1], (lo[1] + hi[1]) / 2
            q = 0.15
            anchors = [[x, y0, 0], [x + s * q, y0 + q, 0], [x + s * q, ym - q, 0], [x + s * 2 * q, ym, 0],
                       [x + s * q, ym + q, 0], [x + s * q, y1 - q, 0], [x, y1, 0]]
        self.set_points_smoothly(anchors)
        self.direction = d

    def get_tip(self):
        return self.points[len(self.points) // 2 - 1].copy() if len(self.points) else ORIGIN

    def put_at_tip(self, mob, buff=SMALL_BUFF):
        mob.next_to(self.get_tip(), self.direction, buff=buff)
        return self


class ParametricFunction(VMobject):
    def __init__(self, function, t_range=(0, 1), color=YELLOW, **kwargs):
        super().__init__(color=color, **kwargs)
        t0, t1 = t_range[0], t_range[1]
        step = t_range[2] if len(t_range) > 2 else (t1 - t0) / 80
        n = max(2, int(round((t1 - t0) / step)) + 1)
        anchors = [_vec(function(t)) for t in np.linspace(t0, t1, n)]
        self.set_points_smoothly(anchors)


class FunctionGraph(ParametricFunction):
    def __init__(self, function, x_range=(-FRAME_X_RADIUS, FRAME_X_RADIUS), color=YELLOW, **kwargs):
        super().__init__(lambda t: [t, function(t), 0], t_range=x_range, color=color, **kwargs)


# --- text ------------------------------------------------------------------

_NARROW = set("iljtfI.,:;'!|() ")
_WIDE = set("mwMW@%")


def _text_width(s, em, font):
    if font == 2:
        return 0.6 * em * len(s)
    w = 0.0
    for ch in s:
        w += 0.3 if ch in _NARROW else 0.85 if ch in _WIDE else 0.56 if ch.islower() else 0.66
    return w * em


class Text(Mobject):
    drawable = True

    def __init__(self, text, font_size=DEFAULT_FONT_SIZE, color=WHITE, font="", weight=None, **kwargs):
        super().__init__()
        self.text = str(text)
        self.font = self._font_kind()
        self.fill_rgba = np.append(color_to_rgb(color), 1.0)
        self.stroke_rgba = np.append(color_to_rgb(color), 0.0)
        self.stroke_width = 0.0
        self.font_size = font_size
        self._set_box(font_size)

    def _font_kind(self):
        return 0

    def _set_box(self, font_size):
        em = font_size / DEFAULT_FONT_SIZE * 0.72
        lines = self.text.split("\n") or [""]
        w = max(_text_width(l, em, self.font) for l in lines) or em * 0.3
        h = em * (1 + 1.25 * (len(lines) - 1))
        self.points = np.array([[-w / 2, h / 2, 0], [w / 2, h / 2, 0], [w / 2, -h / 2, 0], [-w / 2, -h / 2, 0]])

    def set_text(self, text):
        c = self.get_center()
        h = self.get_height()
        self.text = str(text)
        self._set_box(self.font_size)
        if self.get_height():
            self.scale(h / self.get_height())
        return self.move_to(c)

    def set_color(self, color=None, family=True):
        super().set_color(color, family)
        return self


Paragraph = Text
MarkupText = Text


class Code(Text):
    def __init__(self, code_string="", **kwargs):
        kwargs.setdefault("font_size", 28)
        super().__init__(code_string, **kwargs)

    def _font_kind(self):
        return 2


_TEX = {
    r"\alpha": "α", r"\beta": "β", r"\gamma": "γ", r"\delta": "δ", r"\epsilon": "ε", r"\theta": "θ",
    r"\lambda": "λ", r"\mu": "μ", r"\pi": "π", r"\sigma": "σ", r"\phi": "φ", r"\omega": "ω",
    r"\Delta": "Δ", r"\Sigma": "Σ", r"\Omega": "Ω", r"\Pi": "Π", r"\infty": "∞", r"\cdot": "·",
    r"\times": "×", r"\div": "÷", r"\pm": "±", r"\leq": "≤", r"\geq": "≥", r"\neq": "≠",
    r"\approx": "≈", r"\sum": "Σ", r"\int": "∫", r"\partial": "∂", r"\nabla": "∇", r"\to": "→",
    r"\rightarrow": "→", r"\leftarrow": "←", r"\Rightarrow": "⇒", r"\in": "∈", r"\forall": "∀",
    r"\exists": "∃", r"\sqrt": "√", r"\quad": "  ", r"\,": " ", r"\left": "", r"\right": "",
    r"\mathbb{R}": "ℝ", r"\mathbb{N}": "ℕ", r"\mathbb{Z}": "ℤ", r"\ldots": "…", r"\dots": "…",
}
_SUP = str.maketrans("0123456789+-=()nix", "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣ")
_SUB = str.maketrans("0123456789+-=()aeiox", "₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑᵢₒₓ")


def _tex_to_unicode(s):
    import re
    s = re.sub(r"\\frac\{([^{}]*)\}\{([^{}]*)\}", r"(\1)/(\2)", s)
    for k in sorted(_TEX, key=len, reverse=True):
        s = s.replace(k, _TEX[k])
    s = re.sub(r"\^\{([^{}]*)\}", lambda m: m.group(1).translate(_SUP), s)
    s = re.sub(r"\^(.)", lambda m: m.group(1).translate(_SUP), s)
    s = re.sub(r"_\{([^{}]*)\}", lambda m: m.group(1).translate(_SUB), s)
    s = re.sub(r"_(.)", lambda m: m.group(1).translate(_SUB), s)
    s = re.sub(r"\\text\{([^{}]*)\}", r"\1", s)
    s = re.sub(r"\\[a-zA-Z]+", "", s)
    return s.replace("{", "").replace("}", "")


class MathTex(Text):
    def __init__(self, *tex_strings, font_size=DEFAULT_FONT_SIZE, **kwargs):
        self.tex_string = " ".join(tex_strings)
        super().__init__(_tex_to_unicode(self.tex_string), font_size=font_size, **kwargs)

    def _font_kind(self):
        return 1


class Tex(Text):
    def __init__(self, *tex_strings, **kwargs):
        super().__init__(_tex_to_unicode(" ".join(tex_strings)), **kwargs)


class DecimalNumber(Text):
    def __init__(self, number=0, num_decimal_places=2, include_sign=False, unit=None, **kwargs):
        self.num_decimal_places = num_decimal_places
        self.include_sign = include_sign
        self.unit = unit or ""
        self.number = number
        super().__init__(self._fmt(number), **kwargs)

    def _fmt(self, x):
        s = f"{x:+.{self.num_decimal_places}f}" if self.include_sign else f"{x:.{self.num_decimal_places}f}"
        return s + self.unit

    def set_value(self, x):
        self.number = x
        return self.set_text(self._fmt(x))

    def get_value(self):
        return self.number


class Integer(DecimalNumber):
    def __init__(self, number=0, **kwargs):
        super().__init__(number, num_decimal_places=0, **kwargs)


class Variable(VGroup):
    def __init__(self, var, label, num_decimal_places=2, **kwargs):
        super().__init__()
        self.label = label if isinstance(label, Mobject) else MathTex(label)
        self.tracker = ValueTracker(var)
        self.value = DecimalNumber(var, num_decimal_places=num_decimal_places)
        eq = MathTex("=")
        self.add(self.label, eq, self.value)
        self.arrange(RIGHT, buff=0.2)
        self.value.add_updater(lambda v: v.set_value(self.tracker.get_value()))


# --- trackers ----------------------------------------------------------------

class ValueTracker(Mobject):
    def __init__(self, value=0, **kwargs):
        super().__init__()
        self.points = np.array([[float(value), 0.0, 0.0]])

    def get_value(self):
        return float(self.points[0, 0])

    def set_value(self, value):
        self.points = np.array([[float(value), 0.0, 0.0]])
        return self

    def increment_value(self, d):
        return self.set_value(self.get_value() + d)

    def get_center(self):
        return ORIGIN.copy()

    def __iadd__(self, d):
        return self.increment_value(d)

    def __isub__(self, d):
        return self.increment_value(-d)


def always_redraw(func):
    mob = func()
    mob.add_updater(lambda m: m.become(func()))
    return mob


# --- coordinate systems ------------------------------------------------------

class Axes(VGroup):
    def __init__(self, x_range=(-6, 6, 1), y_range=(-4, 4, 1), x_length=11, y_length=6, tips=True,
                 axis_config=None, x_axis_config=None, y_axis_config=None, color=LIGHT_GRAY, **kwargs):
        super().__init__()
        self.x_range = list(x_range) + [1] * (3 - len(x_range))
        self.y_range = list(y_range) + [1] * (3 - len(y_range))
        self.x_length, self.y_length = x_length, y_length
        xmin, xmax, xs = self.x_range
        ymin, ymax, ys = self.y_range
        x0 = min(max(0, xmin), xmax)
        y0 = min(max(0, ymin), ymax)
        Cls = Arrow if tips else Line
        extra = dict(buff=0, stroke_width=2, tip_length=0.2) if tips else dict(stroke_width=2)
        self.x_axis = Cls(self.c2p(xmin, y0), self.c2p(xmax, y0), color=color, **extra)
        self.y_axis = Cls(self.c2p(x0, ymin), self.c2p(x0, ymax), color=color, **extra)
        ticks = VGroup()
        t = 0.08
        for x in np.arange(xmin, xmax + 1e-9, xs):
            if abs(x - x0) > 1e-9 and x < xmax - 1e-9:
                p = self.c2p(x, y0)
                ticks.add(Line(p + DOWN * t, p + UP * t, stroke_width=2, color=color))
        for y in np.arange(ymin, ymax + 1e-9, ys):
            if abs(y - y0) > 1e-9 and y < ymax - 1e-9:
                p = self.c2p(x0, y)
                ticks.add(Line(p + LEFT * t, p + RIGHT * t, stroke_width=2, color=color))
        self.ticks = ticks
        self.add(self.x_axis, self.y_axis, ticks)

    def c2p(self, x, y=0, z=0):
        if hasattr(x, "__len__"):
            x, y = x[0], x[1]
        xmin, xmax, _ = self.x_range
        ymin, ymax, _ = self.y_range
        px = (x - xmin) / (xmax - xmin) * self.x_length - self.x_length / 2
        py = (y - ymin) / (ymax - ymin) * self.y_length - self.y_length / 2
        origin = self.points[0] if False else self._offset()
        return np.array([px, py, 0.0]) + origin

    def _offset(self):
        return getattr(self, "_shift_acc", np.zeros(3))

    def shift(self, *vectors):
        super().shift(*vectors)
        self._shift_acc = self._offset() + sum((_vec(v) for v in vectors), np.zeros(3))
        return self

    coords_to_point = c2p

    def p2c(self, point):
        p = _vec(point) - self._offset()
        xmin, xmax, _ = self.x_range
        ymin, ymax, _ = self.y_range
        x = (p[0] + self.x_length / 2) / self.x_length * (xmax - xmin) + xmin
        y = (p[1] + self.y_length / 2) / self.y_length * (ymax - ymin) + ymin
        return x, y

    point_to_coords = p2c

    def i2gp(self, x, graph):
        return self.c2p(x, graph.underlying_function(x))

    input_to_graph_point = i2gp

    def plot(self, function, x_range=None, color=YELLOW, **kwargs):
        xr = list(x_range or self.x_range[:2])
        if len(xr) < 3:
            xr.append((xr[1] - xr[0]) / 100)
        g = ParametricFunction(lambda t: self.c2p(t, function(t)), t_range=xr, color=color, **kwargs)
        g.underlying_function = function
        return g

    get_graph = plot

    def get_axis_labels(self, x_label="x", y_label="y"):
        xl = (x_label if isinstance(x_label, Mobject) else MathTex(x_label, font_size=32))
        yl = (y_label if isinstance(y_label, Mobject) else MathTex(y_label, font_size=32))
        xl.next_to(self.x_axis.get_end(), DR, buff=0.1)
        yl.next_to(self.y_axis.get_end(), UL, buff=0.1)
        return VGroup(xl, yl)

    def get_area(self, graph, x_range=None, color=BLUE, opacity=0.3, **kwargs):
        x0, x1 = x_range or self.x_range[:2]
        xs = np.linspace(x0, x1, 60)
        pts = [self.c2p(x, 0) for x in [x0]] + [self.c2p(x, graph.underlying_function(x)) for x in xs] + \
              [self.c2p(x1, 0)]
        return Polygon(*pts, color=color, fill_opacity=opacity, stroke_width=0)


class NumberPlane(Axes):
    def __init__(self, x_range=(-8, 8, 1), y_range=(-4.5, 4.5, 1), x_length=None, y_length=None, **kwargs):
        x_length = x_length or (x_range[1] - x_range[0])
        y_length = y_length or (y_range[1] - y_range[0])
        super().__init__(x_range, y_range, x_length, y_length, tips=False, color=WHITE, **kwargs)
        self.remove(self.ticks)
        grid = VGroup()
        xmin, xmax, xs = self.x_range
        ymin, ymax, ys = self.y_range
        for x in np.arange(math.ceil(xmin / xs) * xs, xmax + 1e-9, xs):
            grid.add(Line(self.c2p(x, ymin), self.c2p(x, ymax), color=BLUE_D, stroke_width=2))
        for y in np.arange(math.ceil(ymin / ys) * ys, ymax + 1e-9, ys):
            grid.add(Line(self.c2p(xmin, y), self.c2p(xmax, y), color=BLUE_D, stroke_width=2))
        self.background_lines = grid
        self.submobjects.insert(0, grid)


class NumberLine(Line):
    def __init__(self, x_range=(-8, 8, 1), length=None, include_numbers=False, color=LIGHT_GRAY, **kwargs):
        xmin, xmax = x_range[0], x_range[1]
        step = x_range[2] if len(x_range) > 2 else 1
        length = length or (xmax - xmin)
        self.x_min, self.x_max, self.length = xmin, xmax, length
        super().__init__(LEFT * length / 2, RIGHT * length / 2, color=color, stroke_width=2, **kwargs)
        for x in np.arange(xmin, xmax + 1e-9, step):
            p = self.n2p(x)
            self.add(Line(p + DOWN * 0.1, p + UP * 0.1, stroke_width=2, color=color))
            if include_numbers:
                self.add(MathTex(f"{x:g}", font_size=28).next_to(p, DOWN, buff=0.2))

    def n2p(self, x):
        a, b = self.points[0], self.points[-1]
        return a + (b - a) * (x - self.x_min) / (self.x_max - self.x_min)

    number_to_point = n2p


# ---------------------------------------------------------------------------
# Animations
# ---------------------------------------------------------------------------

class Animation:
    introducer = False
    remover = False

    def __init__(self, mobject=None, run_time=1.0, rate_func=smooth, lag_ratio=0.0, **kwargs):
        self.mobject = mobject
        self.run_time = run_time
        self.rate_func = rate_func
        self.lag_ratio = lag_ratio
        self.suspend_updating = kwargs.get("suspend_mobject_updating", True)

    def begin(self):
        self.starting_mobject = self.mobject.copy()

    def finish(self, scene):
        self.interpolate(1.0)

    def clean_up(self, scene):
        if self.remover:
            scene.remove(self.mobject)

    def get_all_mobjects(self):
        return [self.mobject]

    def interpolate(self, alpha):
        self.interpolate_mobject(self.rate_func(min(max(alpha, 0), 1)))

    def interpolate_mobject(self, alpha):
        fams = [self.mobject.get_family(), self.starting_mobject.get_family()]
        n = len(fams[0])
        for i, (m, s) in enumerate(zip(*fams)):
            self.interpolate_submobject(m, s, self._sub_alpha(alpha, i, n))

    def interpolate_submobject(self, m, s, alpha):
        pass

    def _sub_alpha(self, alpha, i, n):
        if not self.lag_ratio:
            return alpha
        full = (n - 1) * self.lag_ratio + 1
        return min(max(alpha * full - i * self.lag_ratio, 0), 1)

    def label(self):
        return type(self).__name__


class Wait(Animation):
    def __init__(self, run_time=1, **kwargs):
        super().__init__(None, run_time=run_time, rate_func=linear)

    def begin(self):
        pass

    def interpolate(self, alpha):
        pass

    def finish(self, scene):
        pass

    def clean_up(self, scene):
        pass

    def get_all_mobjects(self):
        return []


class ShowPartial(Animation):
    introducer = True

    def interpolate_submobject(self, m, s, alpha):
        m.pointwise_become_partial(s, 0, alpha)


class Create(ShowPartial):
    pass


ShowCreation = Create


class Uncreate(ShowPartial):
    introducer = False
    remover = True

    def __init__(self, mobject, rate_func=lambda t: smooth(1 - t), **kwargs):
        super().__init__(mobject, rate_func=rate_func, **kwargs)


class Write(ShowPartial):
    def __init__(self, mobject, run_time=None, lag_ratio=None, **kwargs):
        n = len(mobject.family_members_with_points())
        if run_time is None:
            text_len = sum(len(m.text) for m in mobject.get_family() if m.text)
            run_time = 1 if text_len < 15 else 2
        if lag_ratio is None:
            lag_ratio = min(4.0 / max(n, 1), 0.2) if n > 1 else 0
        super().__init__(mobject, run_time=run_time, lag_ratio=lag_ratio, **kwargs)


class Unwrite(Write):
    introducer = False
    remover = True

    def __init__(self, mobject, rate_func=lambda t: smooth(1 - t), **kwargs):
        super().__init__(mobject, rate_func=rate_func, **kwargs)


DrawBorderThenFill = Write
AddTextLetterByLetter = Write


class Transform(Animation):
    def __init__(self, mobject, target_mobject=None, path_arc=0, replace_mobject_with_target_in_scene=False,
                 **kwargs):
        super().__init__(mobject, **kwargs)
        self.target_mobject = target_mobject
        self.path_arc = path_arc
        self.replace = replace_mobject_with_target_in_scene

    def create_target(self):
        return self.target_mobject

    def begin(self):
        self.target_copy = self.create_target().copy()
        align_data(self.mobject, self.target_copy)
        self.starting_mobject = self.mobject.copy()

    def interpolate_mobject(self, alpha):
        fams = list(zip(self.mobject.get_family(), self.starting_mobject.get_family(),
                        self.target_copy.get_family()))
        n = len(fams)
        for i, (m, s, t) in enumerate(fams):
            a = self._sub_alpha(alpha, i, n)
            m.interpolate_self(s, t, a)
            if self.path_arc and len(m.points) == len(s.points) == len(t.points):
                m.points = _arc_path(s.points, t.points, a, self.path_arc)

    def clean_up(self, scene):
        if self.replace:
            scene.replace(self.mobject, self.target_mobject)

    def label(self):
        return "Transform"


def _arc_path(p1, p2, alpha, arc):
    vects = p2 - p1
    centers = p1 + 0.5 * vects
    if arc != PI:
        centers += np.cross(OUT, vects / 2.0) / math.tan(arc / 2)
    R = rotation_matrix(alpha * arc)
    return centers + (p1 - centers) @ R.T


class ReplacementTransform(Transform):
    def __init__(self, mobject, target_mobject, **kwargs):
        super().__init__(mobject, target_mobject, replace_mobject_with_target_in_scene=True, **kwargs)


class TransformFromCopy(Transform):
    def __init__(self, mobject, target_mobject, **kwargs):
        super().__init__(mobject.copy(), target_mobject, replace_mobject_with_target_in_scene=True, **kwargs)


class FadeTransform(ReplacementTransform):
    pass


TransformMatchingShapes = ReplacementTransform
TransformMatchingTex = ReplacementTransform


class ClockwiseTransform(Transform):
    def __init__(self, mobject, target, **kwargs):
        super().__init__(mobject, target, path_arc=-PI, **kwargs)


class CounterclockwiseTransform(Transform):
    def __init__(self, mobject, target, **kwargs):
        super().__init__(mobject, target, path_arc=PI, **kwargs)


class MoveToTarget(Transform):
    def __init__(self, mobject, **kwargs):
        super().__init__(mobject, mobject.target, **kwargs)


class ApplyMethod(Transform):
    def __init__(self, method, *args, **kwargs):
        self.method, self.args = method, args
        super().__init__(method.__self__, **kwargs)

    def create_target(self):
        t = self.mobject.copy()
        getattr(t, self.method.__name__)(*self.args)
        return t


class _FadeBase(Transform):
    def __init__(self, mobject, shift=None, scale=1.0, target_position=None, **kwargs):
        self.shift_vec = _vec(shift) if shift is not None else np.zeros(3)
        self.scale_factor = scale
        self.target_position = target_position
        super().__init__(mobject, **kwargs)

    def faded(self):
        m = self.mobject.copy().fade(1)
        if self.target_position is not None:
            tp = self.target_position
            m.move_to(tp.get_center() if isinstance(tp, Mobject) else tp)
        m.shift(self.shift_vec)
        if self.scale_factor != 1:
            m.scale(self.scale_factor)
        return m


class FadeIn(_FadeBase):
    introducer = True

    def begin(self):
        self.target_copy = self.mobject.copy()
        start = self.faded()
        start.shift(-2 * self.shift_vec)
        self.mobject.become(start)
        self.starting_mobject = start

    def label(self):
        return "FadeIn"


class FadeOut(_FadeBase):
    remover = True

    def create_target(self):
        return self.faded()

    def label(self):
        return "FadeOut"


class GrowFromCenter(Transform):
    introducer = True

    def begin(self):
        self.target_copy = self.mobject.copy()
        start = self.mobject.copy().scale(0.001)
        self.mobject.become(start)
        self.starting_mobject = start


class GrowFromPoint(GrowFromCenter):
    def __init__(self, mobject, point, **kwargs):
        self.point = _vec(point)
        super().__init__(mobject, **kwargs)

    def begin(self):
        self.target_copy = self.mobject.copy()
        start = self.mobject.copy().scale(0.001).move_to(self.point)
        self.mobject.become(start)
        self.starting_mobject = start


class GrowFromEdge(GrowFromCenter):
    def __init__(self, mobject, edge, **kwargs):
        self.edge = edge
        super().__init__(mobject, **kwargs)

    def begin(self):
        self.target_copy = self.mobject.copy()
        start = self.mobject.copy().scale(0.001, about_edge=self.edge)
        self.mobject.become(start)
        self.starting_mobject = start


class GrowArrow(GrowFromPoint):
    def __init__(self, arrow, **kwargs):
        super().__init__(arrow, arrow.get_start(), **kwargs)


class SpinInFromNothing(GrowFromCenter):
    def __init__(self, mobject, **kwargs):
        super().__init__(mobject, path_arc=PI, **kwargs)


class Rotate(Animation):
    def __init__(self, mobject, angle=PI, axis=OUT, about_point=None, rate_func=smooth, **kwargs):
        super().__init__(mobject, rate_func=rate_func, **kwargs)
        self.angle, self.axis, self.about_point = angle, axis, about_point

    def interpolate_mobject(self, alpha):
        self.mobject.become(self.starting_mobject)
        self.mobject.rotate(alpha * self.angle, self.axis, about_point=self.about_point
                            if self.about_point is not None else self.starting_mobject.get_center())


Rotating = Rotate


class Indicate(Transform):
    def __init__(self, mobject, scale_factor=1.2, color=YELLOW, rate_func=there_and_back, **kwargs):
        self.scale_factor, self.color = scale_factor, color
        super().__init__(mobject, rate_func=rate_func, **kwargs)

    def create_target(self):
        return self.mobject.copy().scale(self.scale_factor).set_color(self.color)


class Wiggle(Animation):
    def __init__(self, mobject, scale_value=1.1, rotation_angle=0.01 * TAU, n_wiggles=6, run_time=2, **kwargs):
        super().__init__(mobject, run_time=run_time, rate_func=linear, **kwargs)
        self.sv, self.ra, self.nw = scale_value, rotation_angle, n_wiggles

    def interpolate_mobject(self, alpha):
        self.mobject.become(self.starting_mobject)
        c = self.starting_mobject.get_center()
        self.mobject.scale(1 + (self.sv - 1) * there_and_back(alpha), about_point=c)
        self.mobject.rotate(math.sin(self.nw * TAU * alpha) * self.ra * there_and_back(alpha), about_point=c)


class Circumscribe(Animation):
    introducer = True

    def __init__(self, mobject, color=YELLOW, buff=SMALL_BUFF, run_time=1, **kwargs):
        rect = SurroundingRectangle(mobject, color=color, buff=buff)
        rect._src = mobject._src
        super().__init__(rect, run_time=run_time, rate_func=linear, **kwargs)
        self.remover = True

    def interpolate_mobject(self, alpha):
        a, b = max(0, 2 * alpha - 1), min(1, 2 * alpha)
        self.mobject.pointwise_become_partial(self.starting_mobject, smooth(a), smooth(b))


class MoveAlongPath(Animation):
    def __init__(self, mobject, path, rate_func=linear, **kwargs):
        super().__init__(mobject, rate_func=rate_func, **kwargs)
        self.path = path

    def interpolate_mobject(self, alpha):
        self.mobject.move_to(self.path.point_from_proportion(alpha))


class UpdateFromFunc(Animation):
    def __init__(self, mobject, update_function, **kwargs):
        super().__init__(mobject, **kwargs)
        self.fn = update_function

    def interpolate_mobject(self, alpha):
        self.fn(self.mobject)


class UpdateFromAlphaFunc(UpdateFromFunc):
    def interpolate_mobject(self, alpha):
        self.fn(self.mobject, alpha)


class AnimationGroup(Animation):
    def __init__(self, *animations, lag_ratio=0, run_time=None, rate_func=linear, **kwargs):
        self.animations = [_to_animation(a) for a in animations]
        self.group_lag = lag_ratio
        self._compute_timings()
        super().__init__(None, run_time=run_time if run_time is not None else self.max_end,
                         rate_func=rate_func)

    def _compute_timings(self):
        t = 0.0
        self.timings = []
        for a in self.animations:
            self.timings.append((t, t + a.run_time))
            t += a.run_time * self.group_lag
        self.max_end = max((e for _, e in self.timings), default=0.0)

    def begin(self):
        # Succession-style groups start each animation lazily so it sees the state
        # left by the previous one; others start everything up front like Manim.
        self.started = [False] * len(self.animations)
        if self.group_lag < 1:
            for i in range(len(self.animations)):
                self._ensure_started(i)

    def _ensure_started(self, i):
        if not self.started[i]:
            self.started[i] = True
            self.scene._begin(self.animations[i])

    def interpolate(self, alpha):
        t = self.rate_func(alpha) * self.max_end
        for i, (a, (s, e)) in enumerate(zip(self.animations, self.timings)):
            if t >= s or i == 0:
                self._ensure_started(i)
                sub = (t - s) / (e - s) if e > s else 1.0
                a.interpolate(min(max(sub, 0), 1))

    def finish(self, scene):
        for i, a in enumerate(self.animations):
            self._ensure_started(i)
            a.finish(scene)

    def clean_up(self, scene):
        for a in self.animations:
            a.clean_up(scene)

    def get_all_mobjects(self):
        out = []
        for a in self.animations:
            out.extend(a.get_all_mobjects())
        return out

    def label(self):
        return type(self).__name__


class LaggedStart(AnimationGroup):
    def __init__(self, *animations, lag_ratio=0.05, **kwargs):
        super().__init__(*animations, lag_ratio=lag_ratio, **kwargs)


class Succession(AnimationGroup):
    def __init__(self, *animations, lag_ratio=1, **kwargs):
        super().__init__(*animations, lag_ratio=lag_ratio, **kwargs)


def LaggedStartMap(anim_class, group, lag_ratio=0.05, **kwargs):
    return LaggedStart(*(anim_class(m) for m in group), lag_ratio=lag_ratio, **kwargs)


class _AnimationBuilder:
    def __init__(self, mobject):
        self.mobject = mobject
        self.target = mobject.copy()
        self.kwargs = {}
        self.methods = []

    def __call__(self, **kwargs):
        self.kwargs.update(kwargs)
        return self

    def __getattr__(self, name):
        method = getattr(self.target, name)

        def update_target(*args, **kwargs):
            method(*args, **kwargs)
            self.methods.append(name)
            return self
        return update_target

    def build(self):
        anim = Transform(self.mobject, self.target, **self.kwargs)
        anim._label = ".animate." + ".".join(self.methods)
        anim.label = lambda: anim._label
        return anim


def _to_animation(a):
    if isinstance(a, _AnimationBuilder):
        return a.build()
    if isinstance(a, Animation):
        return a
    raise TypeError(f"Expected an Animation, got {type(a).__name__}. "
                    f"Did you forget .animate, or to wrap it in an animation like Create(...)?")


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------

class _Camera:
    def __init__(self):
        self.background_color = config.background_color


class _Interrupted(Exception):
    pass


class Scene:
    def __init__(self, emit=None):
        self.mobjects = []
        self.camera = _Camera()
        self.fps = config.frame_rate
        self.time = 0.0
        self._emit = emit
        self._frames = []
        self._frame_count = 0
        self._strings = {}
        self._new_strings = []
        self._sections = []

    def construct(self):
        pass

    def setup(self):
        pass

    # --- mobject management ------------------------------------------------
    def _all_family_ids(self):
        ids = set()
        for m in self.mobjects:
            ids.update(id(x) for x in m.get_family())
        return ids

    def add(self, *mobs):
        for m in mobs:
            if m in self.mobjects:
                self.mobjects.remove(m)
            self.mobjects.append(m)
        return self

    def remove(self, *mobs):
        for m in mobs:
            if m in self.mobjects:
                self.mobjects.remove(m)
            else:
                for top in self.mobjects:
                    for f in top.get_family():
                        if m in f.submobjects:
                            f.submobjects.remove(m)
        return self

    def replace(self, old, new):
        if old in self.mobjects:
            self.mobjects[self.mobjects.index(old)] = new
        else:
            self.add(new)
        return self

    def clear(self):
        self.mobjects = []
        return self

    def bring_to_front(self, *mobs):
        return self.add(*mobs)

    def bring_to_back(self, *mobs):
        for m in mobs:
            if m in self.mobjects:
                self.mobjects.remove(m)
        self.mobjects = list(mobs) + self.mobjects
        return self

    # --- time ---------------------------------------------------------------
    def play(self, *args, run_time=None, rate_func=None, lag_ratio=None, **kwargs):
        anims = [_to_animation(a) for a in args]
        if not anims:
            return
        for a in anims:
            if run_time is not None:
                a.run_time = run_time
                if isinstance(a, AnimationGroup):
                    a._compute_timings()
            if rate_func is not None:
                a.rate_func = rate_func
        total = max(a.run_time for a in anims)
        line = _user_line()
        start = self._frame_count
        self._run(anims, total)
        self._section(start, line, ", ".join(a.label() for a in anims))

    def wait(self, duration=1.0, stop_condition=None, frozen_frame=None):
        line = _user_line()
        start = self._frame_count
        self._run([], duration)
        self._section(start, line, f"wait({duration:g})")

    pause = wait

    def wait_until(self, stop_condition, max_time=60):
        line = _user_line()
        start = self._frame_count
        dt = 1 / self.fps
        t = 0
        while t < max_time and not stop_condition():
            self._update(dt, set())
            self._capture()
            t += dt
        self._section(start, line, "wait_until")

    def _run(self, anims, total):
        anim_ids = set()
        for a in anims:
            self._begin(a)
            for m in a.get_all_mobjects():
                if getattr(a, "suspend_updating", True):
                    anim_ids.update(id(x) for x in m.get_family())
        n = max(1, int(round(total * self.fps)))
        dt = total / n
        for i in range(1, n + 1):
            t = i * dt
            for a in anims:
                a.interpolate(t / a.run_time if a.run_time > 0 else 1.0)
            self._update(dt, anim_ids)
            self._capture()
        for a in anims:
            a.finish(self)
            a.clean_up(self)
        self._flush()

    def _begin(self, anim):
        if isinstance(anim, AnimationGroup):
            anim.scene = self
            anim.begin()
            anim._ensure_started(0) if anim.animations else None
            return
        anim.begin()
        mob = anim.mobject
        if mob is None or isinstance(anim, Wait):
            return
        if id(mob) not in self._all_family_ids():
            self.add(mob)
        if anim.introducer:
            anim.interpolate(0)

    def _update(self, dt, skip_ids):
        self.time += dt
        for top in list(self.mobjects):
            for m in top.get_family():
                if m.updaters and id(m) not in skip_ids:
                    for fn, wants_dt in list(m.updaters):
                        m._run_updater(fn, wants_dt, dt)

    # --- frame capture ---------------------------------------------------------
    def _str_index(self, s):
        idx = self._strings.get(s)
        if idx is None:
            idx = len(self._strings)
            self._strings[s] = idx
            self._new_strings.append(s)
        return idx

    def _capture(self):
        parts = []
        seen = set()
        for top in self.mobjects:
            for m in top.get_family():
                if id(m) in seen or not m.drawable or len(m.points) == 0:
                    continue
                seen.add(id(m))
                if m.text is not None:
                    if m.fill_rgba[3] <= 0 or m.reveal <= 0:
                        continue
                    kind, sidx = 1, self._str_index(m.text)
                else:
                    if (m.stroke_rgba[3] <= 0 or m.stroke_width <= 0) and m.fill_rgba[3] <= 0:
                        continue
                    kind, sidx = 0, 0
                pts = m.points[:, :2]
                hdr = np.array([kind, m._src, len(pts), *m.stroke_rgba, m.stroke_width, *m.fill_rgba,
                                sidx, m.reveal, m.font], dtype=np.float32)
                parts.append(hdr)
                parts.append(pts.astype(np.float32).ravel())
        self._frames.append(np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32))
        self._frame_count += 1

    def _section(self, start, line, label):
        self._sections.append({"start": start, "end": self._frame_count, "line": line, "label": label})
        self._flush()

    def _flush(self):
        if not self._frames or self._emit is None:
            if self._emit is not None and self._sections:
                self._emit(np.zeros(0, dtype=np.float32), np.zeros(0, dtype=np.int32), self._meta())
            return
        data = np.concatenate(self._frames).astype(np.float32)
        lengths = np.array([len(f) for f in self._frames], dtype=np.int32)
        self._frames = []
        self._emit(data, lengths, self._meta())

    def _meta(self):
        meta = {
            "strings": self._new_strings,
            "sections": self._sections,
            "background": rgb_to_hex(color_to_rgb(self.camera.background_color)),
            "fps": self.fps,
        }
        self._new_strings = []
        self._sections = []
        return json.dumps(meta)

    def render(self):
        self.setup()
        self.construct()
        if self._frame_count == 0:
            self._capture()
        self._flush()


class MovingCameraScene(Scene):
    pass


class ZoomedScene(Scene):
    pass


# ---------------------------------------------------------------------------
# Entry point used by the worker
# ---------------------------------------------------------------------------

def _run_user_scene(source, emit, fps=30, scene_name=None):
    config.frame_rate = fps
    config.background_color = BLACK
    ns = {"__name__": "__scene__"}
    exec(compile(source, USER_FILENAME, "exec"), ns)
    scenes = [v for v in ns.values() if isinstance(v, type) and issubclass(v, Scene) and v.__module__ == "__scene__"
              and v is not Scene]
    if not scenes:
        raise RuntimeError("No Scene subclass found. Define e.g. `class MyScene(Scene):` with a construct() method.")
    cls = next((s for s in scenes if s.__name__ == scene_name), scenes[-1])
    scene = cls(emit=emit)
    scene.render()
    return cls.__name__, [s.__name__ for s in scenes]


__all__ = [k for k in dir() if not k.startswith("_")]
