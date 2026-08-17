# R4 — FreeCAD as a headless, agent-driven geometry + technical-drawing backend

**Lane:** repo archaeology (read-only; no build)
**Target:** `~/YeeBois/research/CAD_STUFF/FreeCAD` (`github.com/FreeCAD/FreeCAD`)
**HEAD:** `ab440173c628abe9e212d5a96f7fbc39a3985a16` on `main`
**Tree version:** `26.3.0-dev` (`version.json`)
**Question:** Is FreeCAD viable as a **headless, agent-driven** geometry and technical-drawing backend for a patent practice?

Citations are `path:LINE` relative to the FreeCAD checkout.

---

## Executive answer

**Yes for geometry, parametric history, Sketcher constraints, and 2D projection data. Conditional for USPTO-style figure sheets.**

FreeCAD already is a headless Python CAD kernel. `FreeCADCmd` (and `import FreeCAD`) runs the full App document graph — Part, PartDesign, Sketcher, TechDraw App objects — with no X11 and no `FreeCADGui`. Hidden-line removal, section/detail cuts, balloons, leaders, and first/third-angle projection groups all execute synchronously when no `QApplication` is present.

The trap is **page-level figure export**. The thing a patent practice actually ships — a titled sheet with orthographic views, hidden lines, section hatching, reference-numeral balloons, and ISO/ASME line weights as SVG/PDF — is rendered by `TechDrawGui` through a Qt `QGraphicsScene`. That API is registered only from `InitGui.py` and walks `Gui::Application` view providers. `FreeCADCmd` cannot call `TechDrawGui.exportPageAsSvg/Pdf`.

Two shipping shapes exist:

| Shape | What you get | What you lose |
|---|---|---|
| **A. `FreeCADCmd` + TechDraw App** | Parametric solid, HLR, balloons as objects, `writeDXFPage`, `projectToSVG`/`viewPartAsSvg` edge dumps | No composed sheet PDF/SVG; no balloon/leader/template in the DXF writer |
| **B. `FreeCAD` + `QT_QPA_PLATFORM=offscreen`** | Full `TechDrawGui.exportPageAsSvg/Pdf` including balloons, templates, line groups | Must ship Qt Widgets + Coin3D + TechDrawGui; not a true no-GUI binary |

For a patent-figure engine, **B is the real product**. A is enough if you compose your own SVG around TechDraw's HLR edges and place numerals yourself.

CadQuery / build123d sit on the same OCCT kernel and win on packaging. They have **no TechDraw equivalent**. That is the only decisive reason to drag FreeCAD into a desktop app.

---

## 1. Headless mode — `FreeCADCmd` / console

### 1.1 Three entry points

| Binary / module | Source | GUI linked? | Default `RunMode` |
|---|---|---|---|
| `FreeCADCmd` | `src/Main/MainCmd.cpp` | No. Links `FreeCADApp` + QtCore + QtXml only (`src/Main/CMakeLists.txt:69-73`) | `"Exit"` — process files, then quit (`MainCmd.cpp:81`) |
| `FreeCAD` | `src/Main/MainGui.cpp` | Yes, `FreeCADGui` | `"Gui"` unless `--console` |
| `import FreeCAD` | `src/Main/MainPy.cpp` | No. Shared lib `FreeCADMainPy` links `FreeCADApp` (`CMakeLists.txt:114-116`) | App init only; no event loop |

`BUILD_GUI` is ON by default, but is documented as optional: *"Build FreeCAD Gui. Otherwise you have only the command line and the Python import module."* (`cMake/FreeCAD_Helpers/InitializeFreeCADBuildOptions.cmake:7`). `FreeCADCmd` is **always** built, even when GUI is on (`src/Main/CMakeLists.txt:57-90`).

### 1.2 How an agent invokes it

CLI options live in `src/App/Application.cpp:2410-2442`:

```
FreeCADCmd script.py                  # load as module, else runFile (__main__)
FreeCADCmd model.FCStd
FreeCADCmd -c                         # --console: RunMode=Cmd, stay in REPL
FreeCAD --console                     # same, from the GUI binary
FreeCADCmd -t TestTechDrawApp         # internal test runner
FreeCADCmd --disable-addon NAME
FreeCADCmd --pass -- anything after is for the script
```

File dispatch (`Application.cpp:3054-3105`):

- `.fcstd` / `.fcbak` / `.std` → `openDocument`
- `.py` → `loadModule` of the basename, fallback `runFile(..., true)` in `__main__`
- `.fcmacro` / `.fcscript` → `runFile`
- anything else → first registered import module for that extension
- optional `SaveFile` config key then calls `mod.export(App.ActiveDocument.Objects, path)` (`Application.cpp:3147-3160`)

`FreeCADCmd` default `RunMode="Exit"` means **script in, process exits**. That is the batch-agent shape. `--console` / `-c` flips `RunMode` to `"Cmd"` and starts `Interpreter().runCommandLine` (`Application.cpp:2783-2786`, `3180-3182`). Passing a non-file argument in console mode treats it as a Python one-liner and then exits (`3137-3144`).

The GUI binary honours the same `--console` flag: `inGuiMode()` is false when `Config["Console"]=="1"` (`src/Main/MainGui.cpp:99-106`).

### 1.3 What is available without the GUI

Init order is explicit (`src/App/FreeCADInit.py:31-38`):

```
CMakeVariables     always
FreeCADInit        always          ← App.GuiUp = 0  (line 426)
FreeCADTest        tests, no Gui
FreeCADGuiInit     only if Gui is up
```

Every workbench's `Init.py` runs. `InitGui.py` does not. Modules that put real work in `Init.py` (Part, Import, Mesh, Draft, TechDraw App, Sketcher, PartDesign) are live. Workbench commands, viewproviders, and `addExportType(..., "TechDrawGui")` are not.

`App.GuiUp` starts at 0 and is only overwritten by Gui init (`FreeCADInit.py:425-426`).

### 1.4 What silently requires the GUI

The gate is not a single `#ifdef`. It is a set of name-based and type-based traps:

1. **Export-type registration.** TechDraw sheet export is registered only in `InitGui.py`:
   `FreeCAD.addExportType("Technical Drawing (*.svg *.dxf *.pdf)", "TechDrawGui")` (`src/Mod/TechDraw/InitGui.py:63`).
   `FreeCADCmd` will warn `"File format not supported"` for those extensions (`Application.cpp:3162-3163`) because no App-side exporter is registered.

2. **Handler name is `ImportGui` even from `Init.py`.** glTF import/export is registered as `"ImportGui"` from the App init script (`src/Mod/Import/Init.py:39-43`). Headless `import` of a `.glb` looks for a module that was never loaded. STEP/IGES are later *rewritten* to `ImportGui` only if the GUI starts (`InitGui.py:36-40`); under `FreeCADCmd` they stay on App `Part`/`Import`.

3. **`ViewProvider*` strings on App objects.** Almost every TechDraw/Part/PartDesign feature returns a `TechDrawGui::...` / `PartDesignGui::...` view-provider name (`DrawViewPart.h:139`, `FeaturePad.h:57`, `FeaturePartBox.h:55`). Headless this is inert: viewproviders are never constructed. It is not a crash. It *is* why page PDF/SVG cannot run — those functions `dynamic_cast` the view provider and throw `"Page not available! Is it Hidden?"` if it is missing (`src/Mod/TechDraw/Gui/AppTechDrawGuiPy.cpp:185-194`).

4. **Qt event-loop vs console HLR.** TechDraw's own gate is `DrawUtil::isGuiUp()` = `QCoreApplication::instance()` exists **and** `inherits("QApplication")` (`src/Mod/TechDraw/App/DrawUtil.cpp:1870-1875`). A `FreeCADCmd` process has at most `QCoreApplication`. When `!isGuiUp()`, HLR, section cut, detail cut, and face extraction all run **synchronously on the calling thread** (`DrawViewPart.cpp:302-306, 364-368, 418-421`; `DrawViewSection.cpp:468-473`; `DrawViewDetail.cpp:188`). When a `QApplication` *is* up, the same work is `QtConcurrent::run` + `QFutureWatcher`, and without pumping the event loop the feature stays `waitingForHlr` forever. That is why `TestTechDrawGui` uses `QtCore.QEventLoop` (`TDTest/DrawViewPartTest.py:36-44`) and `TestTechDrawApp` does not.

5. **`page.ViewObject.show()`** is commented out in the App tests with the note *"unit tests run in console mode"* (`DrawViewBalloonTest.py:21`). Calling `ViewObject` from `FreeCADCmd` is the classic silent-None.

6. **Coin / offscreen GL.** `SoQtOffscreenRenderer` is registered on the Gui module (`src/Gui/Application.cpp:681-684`). Photorealistic 3D snapshots need Gui.

### 1.5 Qt is not fully gone in `FreeCADCmd`

`FreeCADCmd` still links QtCore/QtXml (`src/Main/CMakeLists.txt:71-72`). TechDraw App uses `QFuture`, `QPointF`, `QCoreApplication`, `Q_DECLARE_TR_FUNCTIONS`. Headless TechDraw is "no widgets / no OpenGL / no Coin", not "no Qt".

---

## 2. Python API — the surface an agent drives

### 2.1 Document model and recompute graph

Canonical objects:

- `App.newDocument(name, label=..., hidden=..., temp=...)` (`src/App/ApplicationPy.cpp:162-195`)
- `doc.addObject("TypeId", "Name")` — TypeId is a C++ class name, e.g. `"Part::Box"`, `"Sketcher::SketchObject"`, `"PartDesign::Pad"`, `"TechDraw::DrawViewBalloon"`
- `doc.recompute()` — topological sort of the dependency graph, then `_recomputeFeature` per object (`src/App/Document.cpp:2843-2917, 3251-3260`)
- `obj.setExpression("Property", "expr")` — every `DocumentObject` has a hidden `ExpressionEngine` (`src/App/DocumentObject.cpp:68-74`; Python `src/App/DocumentObjectPyImp.cpp:410-433`)

Recompute holds the GIL for the whole pass so Python-backed features stay serial (`Document.cpp:2850-2856`). Cyclic deps are detected; `SkipRecompute` can be set to batch edits.

There is also an async recompute worker (`Application.cpp:3198+`) but TechDraw views explicitly refuse worker recomputes: `DrawView::canRecomputeOnWorker() const { return false; }` (`DrawView.h:70`).

### 2.2 Part — primitives and OCCT shapes

`Part::Box` is a parametric primitive with `Length`, `Height`, `Width` (`src/Mod/Part/App/FeaturePartBox.h:44`). Execute calls `BRepPrimAPI_MakeBox` (`FeaturePartBox.cpp:25`).

The shape wrapper is `Part.Shape` (`TopoShape.pyi`). Direct file methods, no GUI:

```
shape.exportStep(path)    # TopoShape.pyi:109
shape.exportIges(path)    # :101
shape.exportBrep(path)    # :117
shape.exportStl(path)     # :153
shape.exportBrepToString()
```

Boolean / modeling ops are first-class document objects (`Part::Cut`, `Part::Fuse`, `Part::MultiFuse`, `Part::Extrusion`, `Part::Fillet`, …) *and* on the `Shape` object (`fuse`, `cut`, `common`). The App test for projection groups builds a `Part::MultiFuse` of Box+Sphere and recomputes it headless (`TDTest/DrawProjectionGroupTest.py:17-26`).

Part also exposes the raw OCCT HLR stack as `Part.HLRBRep.Algo` / `HLRToShape` (`src/Mod/Part/App/HLRBRep/HLRBRep_Algo.pyi`) — the same kernel TechDraw wraps.

### 2.3 Sketcher — constraints, headless

The solver is PlaneGCS (`src/Mod/Sketcher/App/planegcs/`). Constraint types (`src/Mod/Sketcher/App/Constraint.h:52-77`):

`None, Coincident, Horizontal, Vertical, Parallel, Tangent, Distance, DistanceX, DistanceY, Angle, Perpendicular, Radius, Equal, PointOnObject, Symmetric, InternalAlignment, SnellsLaw, Block, Diameter, Weight, Group, Text`

Python surface (`SketchObject.pyi:68-118`):

- `addGeometry(geo, isConstruction=False) -> int`
- `addConstraint(Constraint(...))`
- `setDatum(index, value)`
- `solve() -> 0` or negative error codes (`-4` over-constrained, `-3` conflicting, `-2` redundant, `-1` solver error)
- `DoF`, `ConflictingConstraints`, `RedundantConstraints`

The in-tree "how to script a sketch" file is `src/Mod/Sketcher/SketcherExample.py:14-38`:

```python
f = App.activeDocument().addObject("Sketcher::SketchObject", "Sketch")
f.Geometry = [LineSegment(...), LineSegment(...)]
f.Constraints = [Constraint("Vertical", 0), Constraint("Horizontal", 1)]
App.activeDocument().recompute()
```

The test helper that PartDesign uses is the production pattern (`SketcherTests/TestSketcherSolver.py:87-122`): `addGeometry(Part.LineSegment(...))` then `addConstraint(Sketcher.Constraint("Coincident"|"Horizontal"|"Vertical"|"DistanceX"|"DistanceY"|"Equal", ...))`. Datum edits go through `setDatum` (`CreateSlotPlateSet`, lines 205-210).

All of this is App. `TestSketcherApp` is registered from `Sketcher/Init.py:29`. Sketch *editing* (Coin overlay, auto-constrain-as-you-draw) is Gui.

### 2.4 PartDesign — Body / Pad history

Headless App test (`PartDesignTests/TestPad.py:36-57`):

```python
Doc = FreeCAD.newDocument("PartDesignTestPad")
Body = Doc.addObject("PartDesign::Body", "Body")
Sketch = Doc.addObject("Sketcher::SketchObject", "SketchPad")
Sketch.AttachmentSupport = (Doc.XY_Plane, [""])
Sketch.MapMode = "FlatFace"
Body.addObject(Sketch)
# ... add geometry + constraints ...
Doc.recompute()
Pad = Doc.addObject("PartDesign::Pad", "Pad")
Pad.Profile = Sketch
Pad.Length = 10
Body.addObject(Pad)
Doc.recompute()
assert len(Pad.Shape.Faces) == 6
```

`PartDesign::Pad` is a `FeatureExtrude`: Type (Length / UpToLast / UpToFirst / UpToFace), Midplane, Reversed (`FeaturePad.h:42-52`). Pocket, Hole, Revolution, Loft, Pipe, Helix, Fillet, Chamfer, Linear/Polar pattern, Boolean, Thickness all have matching App features and App unit tests under `PartDesignTests/`.

### 2.5 Canonical agent script — create, mutate, recompute, export

This is the pattern the in-tree tests compose. It runs under `FreeCADCmd`.

```python
import FreeCAD as App
import Part, Sketcher, TechDraw, Import, Mesh

doc = App.newDocument("Fig")

body = doc.addObject("PartDesign::Body", "Body")
sk = doc.addObject("Sketcher::SketchObject", "Sketch")
sk.AttachmentSupport = (doc.XY_Plane, [""])
sk.MapMode = "FlatFace"
body.addObject(sk)
sk.addGeometry(Part.LineSegment(App.Vector(0, 0, 0), App.Vector(20, 0, 0)))
# ... more geometry + Sketcher.Constraint(...) ...
doc.recompute()

pad = doc.addObject("PartDesign::Pad", "Pad")
pad.Profile = sk
pad.Length = 8.0
body.addObject(pad)
doc.recompute()

# mutate a parameter (or: pad.setExpression("Length", "12 mm"))
pad.Length = 12.0
doc.recompute()

# 3D interchange
pad.Shape.exportStep("/tmp/part.step")
pad.Shape.exportStl("/tmp/part.stl")

# 2D projection string (App, no Gui)
svg = TechDraw.projectToSVG(pad.Shape, App.Vector(0, 0, 1), "ShowHiddenLines", 0.10)
dxf = TechDraw.projectToDXF(pad.Shape, App.Vector(0, 0, 1))

# document-level STEP-with-colors
Import.export([pad], "/tmp/part-color.step")

doc.saveAs("/tmp/fig.FCStd")
```

For a **sheet with balloons**, add the TechDraw objects from §3 and either `TechDraw.writeDXFPage(page, path)` (App) or, if a `QApplication` is alive, `TechDrawGui.exportPageAsSvg(page, path)`.

---

## 3. TechDraw — the patent-figure workbench

This is the unique asset. The App module is a full C++ feature set registered at `PyMOD_INIT_FUNC(TechDraw)` (`src/Mod/TechDraw/App/AppTechDraw.cpp:72-153`). `Init.py` only adds `TestTechDrawApp` (`Init.py:27`). Gui is a separate subdirectory, compiled only if `BUILD_GUI` (`src/Mod/TechDraw/CMakeLists.txt:4-6`).

### 3.1 How 3D becomes 2D — OCCT HLR

Two algorithms, same OCCT types:

| Mode | OCCT class | When | Code |
|---|---|---|---|
| Exact (default) | `HLRBRep_Algo` + `HLRBRep_HLRToShape` | `CoarseView=False` | `GeometryObject.cpp:139-244` |
| Tessellated | `HLRBRep_PolyAlgo` + `HLRBRep_PolyHLRToShape` | `CoarseView=True` (`DrawViewPart.h:122`) | `GeometryObject.cpp:287-325` |

Exact path (`GeometryObject::projectShape`):

```
brep_hlr = new HLRBRep_Algo()
brep_hlr->Add(inShape, isoCount)
brep_hlr->Projector(HLRAlgo_Projector(viewAxis [, focus]))   # perspective optional
brep_hlr->Update()
brep_hlr->Hide()
HLRBRep_HLRToShape hlrToShape(brep_hlr)
```

Extracted compounds (`GeometryObject.cpp:172-232` and the older `ProjectionAlgos.cpp:89-98`):

| Handle | Meaning |
|---|---|
| `VCompound` | hard edges, visible |
| `Rg1LineVCompound` | smooth (G1) edges, visible |
| `RgNLineVCompound` | seam / contour, visible |
| `OutLineVCompound` | outline / apparent contour, visible |
| `IsoLineVCompound` | isoparametrics, visible |
| `HCompound` / `Rg1LineH` / `RgNLineH` / `OutLineH` / `IsoLineH` | the hidden counterparts |

`ProjectionAlgos` is the older one-shot wrapper still used by the module-level `TechDraw.project*` Python functions. `GeometryObject` is what `DrawViewPart` uses; it then `invertGeometry`s (Y-down Qt vs Y-up CAD) and classifies into `BaseGeom` edges/vertices/faces.

Per-view visibility toggles (`DrawViewPart.h:123-133`): `SeamVisible`, `SmoothVisible`, `IsoVisible`, `HardHidden`, `SmoothHidden`, `SeamHidden`, `IsoHidden`, `IsoCount`. `Direction` + `XDirection` + `Rotation` + `Perspective`/`Focus` define the camera (`DrawViewPart.h:117-120`).

Headless: `!isGuiUp()` → `projectShape` is called inline, then `onHlrFinished` is invoked immediately (`DrawViewPart.cpp:302-306, 364-368`). Faces are also extracted inline (`418-421`). **HLR works in `FreeCADCmd`.** The Gui-test event-loop wait is only needed when a `QApplication` exists.

### 3.2 View types

Registered in `AppTechDraw.cpp:87-119` and exercised by App tests unless noted.

| TypeId | Role | Headless? |
|---|---|---|
| `TechDraw::DrawPage` | Sheet. `Views`, `Template`, `Scale`, `ProjectionType` (First/Third), **`NextBalloonIndex`** (`DrawPage.h:45-52`) | Yes. `createPageWithSVGTemplate` (`TDTest/TechDrawTestUtilities.py:5-17`) |
| `TechDraw::DrawSVGTemplate` / `DrawParametricTemplate` | Title block. ISO and ASME SVG libraries under `Templates/` | Yes |
| `TechDraw::DrawViewPart` | Single 3D→2D projection | Yes (sync HLR) |
| `TechDraw::DrawProjGroup` + `DrawProjGroupItem` | Orthographic group. `addProjection("Front"\|"Left"\|"Top"\|"Right"\|"Rear"\|"Bottom")`. First/Third angle (`DrawProjGroup.h:77-81, 99`). Auto-distribute + `spacingX/Y` | Yes (`DrawProjectionGroupTest.py`) |
| `TechDraw::DrawViewSection` | Section. `BaseView`, `SectionNormal`, `SectionOrigin`. Cut is OCCT boolean vs a cutting tool | Yes, sync (`DrawViewSection.cpp:468-473`). Gui-test only because of QEventLoop |
| `TechDraw::DrawComplexSection` | Polyline / aligned section (`DrawComplexSection.h`) | App object exists |
| `TechDraw::DrawViewDetail` | Detail. `BaseView`, `AnchorPoint`, `Radius`, `Reference`. Shape ∩ cylinder/prism (`DrawViewDetail.h:58-64`; `DrawViewDetail.cpp:211-213`) | Yes, sync when `!isGuiUp()` |
| `TechDraw::DrawBrokenView` | Broken / interrupted view (`DrawBrokenView.h:25-26`) | App object exists |
| `TechDraw::DrawViewClip` | Clip box | App |
| `TechDraw::DrawViewImage` / `DrawViewSymbol` / `DrawViewSpreadsheet` / `DrawViewArch` / `DrawViewDraft` | Raster, SVG symbol, spreadsheet, BIM/Draft views | App tests for Image/Symbol |
| `TechDraw::DrawHatch` / `DrawGeomHatch` | Fill / PAT hatch. `PAT/FCPAT.pat` + `Patterns/*.svg` | App (`DrawHatchTest`) |
| `TechDraw::FeatureProjection` | Standalone projection feature | App |

**Exploded views are not a first-class TypeId.** `ShapeExtractor` looks for a Python `Proxy.getExplodedShape` on the source object and, if present, uses that compound as the projection input (`ShapeExtractor.cpp:96-118`). That is an addon hook (typically Assembly / ExplodedAssembly), not a TechDraw feature. There is no `DrawViewExploded`.

Axonometric corners exist as `ProjDirection::{FrontTopLeft, FrontTopRight, FrontBottomLeft, FrontBottomRight}` (`DrawViewPart.h:82-93`).

### 3.3 Annotation / balloons / leaders = reference numerals

This is the patent-figure payload.

**Balloons** (`TechDraw::DrawViewBalloon`, `DrawViewBalloon.h:43-61`):

- `SourceView` — the `DrawViewPart` it points at
- `Text` — the numeral string
- `OriginX` / `OriginY` — attachment on the view
- `X` / `Y` — bubble position (inherits `DrawView`)
- `EndType`, `BubbleShape`, `ShapeScale`, `KinkLength`, `TextWrapLen`

Bubble shapes (`BalloonPropEnum.h:35-44`): `Circular, None, Triangle, Inspection, Hexagon, Square, Rectangle, Line`.

App test creates two balloons with `Text = "1"` / `"2"` and asserts `Up-to-date` after `recompute` (`TDTest/DrawViewBalloonTest.py:41-76`). No Gui.

`DrawPage.NextBalloonIndex` (`DrawPage.h:52`) is a page-level counter for sequential numerals.

**Leaders** (`TechDraw::DrawLeaderLine`, `DrawLeaderLine.h:37-78`):

- `LeaderParent`, `WayPoints` (`PropertyVectorList`), `StartSymbol`, `EndSymbol`
- Factory: `TechDraw.makeLeader(parent, points, startSymbol, endSymbol)` (`AppTechDrawPy.cpp:192-193`; `DrawLeaderLine::makeLeader`)

**Rich text / callouts:** `DrawRichAnno`. **Plain notes:** `DrawViewAnnotation` with `Text` (string list), `Font`, `TextColor`, `TextSize`, `TextStyle` (`DrawViewAnnotation.h:47-52`). **Dimensions:** `DrawViewDimension` types `Distance, DistanceX, DistanceY, DistanceZ, Radius, Diameter, Angle, Angle3Pt` (`DrawViewDimension.h:60-70`), 2D or 3D references, `MeasureType` True/Projected. Helpers `TechDraw.makeExtentDim` / `makeDistanceDim` / `makeDistanceDim3d` (`AppTechDrawPy.cpp:150-157`). **Weld / GD&T tiles:** `DrawWeldSymbol`, `DrawTileWeld`; SVG symbol library includes ASME Y14.5 frames under `Symbols/gd-and-t/`.

Cosmetic vertices/edges/centerlines live on `DrawViewPart` via `CosmeticExtension` (`makeCosmeticVertex`, `makeCosmeticLine`, … — `DrawViewPart.pyi:52-78`).

### 3.4 Line weight / style

`LineGroup/` ships ISO 128-20, ASME Y14.2-2008, and ANSI Y14.2M-1992 CSVs plus a FreeCAD default (`LineGroup/LineGroup.csv:1-38`). Classes:

- thin = hidden, dimensions, centerlines
- graphic = symbols, text
- thick = visible, section
- extra = unused

Named groups `FC 0.25mm` … `FC 2.00mm` with explicit mm weights. `LineGroup::getWeight("Thin"|"Graphic"|"Thick"|"Extra")` (`LineGroup.cpp:66-76`). `viewPartAsSvg` writes visible edges at `"Thick"` and hidden at `"Thin"` (`AppTechDrawPy.cpp:513-537`). Hidden-line dash style is a preference (`Preferences::HiddenLineStyle`).

This is the closest in-tree match to 37 CFR 1.84 line-quality rules. It is ISO/ASME mechanical drawing, not USPTO-tuned, but the knobs exist.

### 3.5 Export — what is App vs Gui

**App (`import TechDraw`), works in `FreeCADCmd`:**

| Function | Output | Includes |
|---|---|---|
| `project(shape, dir)` | 4 TopoShapes | vis/hid hard+smooth (`AppTechDrawPy.cpp:162-165`) |
| `projectEx(shape, dir)` | 10 TopoShapes | full HLR set (`166-168`) |
| `projectToSVG(shape, dir, type, tol, styles…)` | SVG **string** | edge groups; optional hidden/smooth; per-class CSS dicts (`170-173`, `ProjectionAlgos.cpp:101-213`) |
| `projectToDXF(shape, dir)` | DXF **string** | same edges (`174-177`, `ProjectionAlgos.cpp:217-254`) |
| `viewPartAsSvg(dvp)` / `viewPartAsDxf(dvp)` | string of that view's edges | Thick/Thin groups; no balloons (`486-566`, `425-483`) |
| `writeDXFView(dvp, path)` | `.dxf` file | one view + cosmetics (`661-698`) |
| `writeDXFPage(page, path)` | `.dxf` file | every `DrawViewPart` + `DrawViewAnnotation` + `DrawViewDimension` (`700-841`) |
| `exportSVGEdges(shape)` | SVG string | raw edges (`182-184`) |
| `removeSvgTags(svg)` | fragment | for embedding (`178-180`) |

`writeDXFPage` is the only App-side **page** exporter. It iterates `page.getAllViews()` and handles three TypeIds (`721-832`). **It does not emit `DrawViewBalloon`, `DrawLeaderLine`, `DrawRichAnno`, `DrawViewSymbol`, or the SVG template.** For patent numerals that is a hole: the balloon objects exist and recompute headlessly, but they vanish at DXF time.

**Gui (`import TechDrawGui`), requires `QApplication` + view providers:**

| Function | Output | How |
|---|---|---|
| `exportPageAsSvg(page, path)` | composed sheet SVG | `PagePrinter::saveSVG` → `QGSPage::saveSvg` (`AppTechDrawGuiPy.cpp:206-241`, `PagePrinter.cpp:413-432`) |
| `exportPageAsPdf(page, path)` | composed sheet PDF | `QPdfWriter` + `QPainter` over the scene (`PagePrinter.cpp:24-34, 454-457`) |
| `export([page], "x.svg"\|"x.pdf"\|"x.dxf")` | same, extension-dispatched | `AppTechDrawGuiPy.cpp:117-166`; DXF just shells out to `TechDraw.writeDXFPage` (`PagePrinter.cpp:437-450`) |

`DrawPage.requestPaint()` is explicitly "Ask the Gui to redraw this page" (`DrawPage.pyi:46-48`).

**Draft `importSVG` is a different pipeline.** Its module docstring says it *"doesn't handle the SVG output from the TechDraw module"* (`src/Mod/Draft/importSVG.py:23-27`). Do not use Draft SVG as a TechDraw sheet writer.

### 3.6 Is TechDraw fully scriptable headlessly?

**The document model: yes.** Proof: `TestTechDrawApp.py:23-30` lists Hatch, Annotation, Balloon, Image, Symbol, ProjectionGroup, ScaleType — *"tests that do not require Gui"*. Those tests `addObject` + `page.addView` + `recompute` and assert `State` contains `"Up-to-date"`.

**Projection / section / detail geometry: yes**, via the `!isGuiUp()` sync path.

**Composed sheet SVG/PDF with balloons and title block: no, not from `FreeCADCmd`.** Proof: export symbols live in `TechDrawGui` and dereference `Gui::Application::Instance->getViewProvider` (`AppTechDrawGuiPy.cpp:185-228`). `InitGui.py:63` is the only `addExportType` for `*.svg *.dxf *.pdf` of a page.

**Practical headless figure path for a patent agent:**

1. Build the page, views, balloons, leaders under `FreeCADCmd` (proven).
2. Either
   - **compose SVG yourself** from `viewPartAsSvg` / `getVisibleEdges` + balloon `Origin*`/`Text`/`X`/`Y` (all App properties), or
   - **run a second process** that is the GUI binary with `QT_QPA_PLATFORM=offscreen` (the project's own rendering tests already auto-set this — `tools/rendering/manage_coin_node_baselines.py:77-132`) and call `TechDrawGui.exportPageAsSvg/Pdf`.

Option 2 is what I would ship. Option 1 is what I would use if I refused to link Qt Widgets.

---

## 4. File-format I/O

Registration is per-module `Init.py` via `FreeCAD.addImportType` / `addExportType`. The CLI then dispatches on extension (`Application.cpp:3096-3105`).

| Format | App handler | Quality notes | GUI rewrite? |
|---|---|---|---|
| **STEP** (colors, assemblies) | `Import.open/insert/export` — OCAF (`Import.module.pyi:39-70`; `ReaderStep.cpp` / `WriterStep.cpp`) | Full XCAF: colors, names, placements. This is the production path | Yes — `InitGui.py:38-39` switches the registered module to `ImportGui` when Gui is up. App `Import` still works if you `import Import` yourself |
| **STEP** (shape only) | `Part.Shape.exportStep` / `FeaturePartImportStep` | OCCT `STEPControl_Writer/Reader`. No colors | — |
| **IGES** | `Part` Init (`Part/Init.py:36-37`); also `Import` OCAF `ReaderIges`/`WriterIges` | Classic OCCT IGES. Lossy vs STEP | Gui rewrites to `ImportGui` (`InitGui.py:36-37`) |
| **BREP** | `Part` (`Init.py:34-35`); `Shape.exportBrep` / `dumps()` | Native OCCT. Lossless for topology | — |
| **STL / OBJ / PLY / OFF / 3MF / AMF / SMF** | `Mesh` (`Mesh/Init.py:11-33`) | Tessellation. `Shape.exportStl` also exists | — |
| **DXF 2D** | Draft `importDXF` (`Draft/Init.py:30-34`) **and** `Import.readDXF` / `writeDXFShape` / `writeDXFObject` (`AppImportPy.cpp:99-116`) | Two stacks. Draft's importer still mentions a legacy "DXF Library addon" (`importDXF.py:166-174`). Import's C++ writer is what TechDraw `writeDXFPage` uses (`ImpExpDxf.h`) | — |
| **DWG** | Draft `importDWG` (`Draft/Init.py:37-38`) | External converter (LibreDWG / ODA), not in-tree | — |
| **SVG as geometry** | Draft `importSVG` | Paths/lines/arcs/rects only; **not** TechDraw sheets (`importSVG.py:23-33`) | — |
| **glTF** | Registered as `ImportGui` even from App `Init.py:39-43` | **Broken under FreeCADCmd** unless you import the Gui module | — |
| **IFC** | BIM `nativeifc.ifc_import` / `importers.exportIFC` (`BIM/Init.py:26-28`) | Architecture, not mechanical figures | — |
| **FCStd** | zip of `Document.xml` + breps (`Application.cpp:3074-3078`) | Native. Fine as an agent checkpoint format | — |

`Part/Init.py:38-43` registers `"STEP with colors"` against module `"Import"` at App startup — so `FreeCADCmd part.step` works. When the GUI later starts, `changeImportModule(..., "ImportGui")` swaps the handler so the same File→Open goes through the dialog-capable Gui wrapper. An agent should call `Import.insert(path, doc.Name)` / `Import.export(objs, path)` explicitly and not rely on the extension table.

OCCT controllers are initialized with the Part module (`AppPart.cpp:586-587`: `IGESControl_Controller::Init(); STEPControl_Controller::Init();`).

---

## 5. Addon / extension model and process driving

### 5.1 How third parties extend it

Two module kinds (`FreeCADInit.py:1022-1106`):

1. **DirMod** — a directory under `Mod/` with `Init.py` (and optional `InitGui.py`, `package.xml`). Legacy workbench layout. This is Part, TechDraw, etc.
2. **ExtMod** — a Python package `freecad.<name>` with optional `init.py` and `package.xml`. Newer addon layout.

`package.xml` is read as `App.Metadata`; it can declare nested workbenches and version constraints (`FreeCADInit.py:989-1004, 1133-1160`).

Disable switches (`FreeCADInit.py:980-986, 1178-1188`):

- CLI `--disable-addon NAME`
- stopfile `ADDON_DISABLED` in the addon dir
- stopfile `ALL_ADDONS_DISABLED`

Search path order is user Mod → system Mod → extra `--module-path` / `-M`.

### 5.2 Addon Manager

It is a **git submodule**, not in this tree:

```
[submodule "src/Mod/AddonManager"]
    path = src/Mod/AddonManager
    url = https://github.com/FreeCAD/AddonManager.git
```

(`.gitmodules:7-9`). The checkout's `src/Mod/AddonManager/` is empty (submodule not initialized). `BUILD_ADDONMGR` is ON by default (`InitializeFreeCADBuildOptions.cmake:149`) and the CMake will FATAL if the submodule is missing (`src/Mod/CMakeLists.txt:1-7`). For a shipped headless engine you set `-DBUILD_ADDONMGR=OFF` and do not fetch it. Addons are untrusted remote code (`PRIVACY_POLICY.md:15`).

### 5.3 Can an external process drive FreeCAD?

**There is no first-party RPC / XML-RPC / gRPC server in this tree.** Grep for a server loop in `src/App` and `src/Mod` finds nothing of the kind. Driving options that *do* exist:

| Mechanism | Where | Notes |
|---|---|---|
| **Subprocess `FreeCADCmd script.py`** | `MainCmd.cpp` + `processFiles` | The intended batch API. One process per job, or `--console` + stdin |
| **`import FreeCAD` in the agent's Python** | `MainPy.cpp` | In-process. Must use the FreeCAD-built Python (3.11 in `package/rattler-build/recipe.yaml:31`) or a carefully matched embed |
| **`--pass -- …`** | `Application.cpp:2442` | Forwards leftover argv to the script |
| **Qt plugin embed** | `src/Tools/embedded/Qt/cxx/plugin.cpp` | Sets `RunMode=Gui`, constructs `Gui::Application` + `MainWindow`. Demo, not a server |
| **Python-in-Qt embed** | `src/Tools/embedded/PySide/` | Same idea from Python |
| **Offscreen GUI binary** | `QT_QPA_PLATFORM=offscreen` | Needed for `TechDrawGui` export. Tests already know this (`src/Mod/Test/TestViewProviderLink.py:58-62`) |

An agent-facing "CAD server" would be **your** thin wrapper around `FreeCADCmd` or around `import FreeCAD`. Nothing in-tree does job queueing, sandboxing, or multi-tenant isolation.

Macros (`.FCMacro`) are just Python run via `runFile` (`Application.cpp:3080-3082`). They are a contribution channel, not an IPC channel.

---

## 6. `AI_POLICY.md`

Read in full. It is a **contribution policy**, not a product-feature spec. There is no in-tree AI workbench, no LLM bindings, no "chat-to-CAD" module.

Stance:

- Humans in the driver seat. PRs must be understood, reviewed, and tested by the submitter (`AI_POLICY.md:5-9, 31-35`).
- Disclose assistance with a git trailer: `Assisted-by: [Model-Family] ([Version/ID])` (`39-51`).
- PR template checkbox: *"This PR is not unverified AI output, I take responsibility…"* (`53-55`).
- *"we will not accept pull requests with clearly AI-generated code, commit messages, PR descriptions, and responses to reviewer feedback"* (`35`).
- Outside-Developers-group PRs get an `"Unverified"` label (`57-59`).
- Concerns listed: privilege, environment, copyright of training data and of raw generative output, vibe-coded PR volume, reviewer burden (`19-25`).
- The project "raises awareness" of frugal / fully-open models (Apertus is named) but does not require them (`27-29`).
- Machine translation of PR text is discouraged; if used, include the original (`55`).

`CONTRIBUTING.md:13` (item 14) incorporates this: contributions must comply with the AI Policy.

**Implication for this product:** shipping an agent that *calls* FreeCAD is unconstrained by this file. Contributing patches *back* to FreeCAD with agent-written code is constrained. Do not plan on carrying a long-lived fork full of unverified generated patches.

---

## 7. License — LGPL-2.1-or-later + OCCT

### 7.1 What FreeCAD itself is

Root `LICENSE` is the GNU LGPL **2.1** text. SPDX on sources is `LGPL-2.1-or-later`. `CONTRIBUTING.md:40` says *"Lesser General Public License, version 2, or superior (LGPL2+)"*. Fedora maps it `LGPL-2.0-or-later` (`package/fedora/freecad.spec:24`) — same family, SPDX naming drift. `MainCmd.cpp:51` banners *"LGPL2+ license."*

No CLA, no copyright assignment required (`CONTRIBUTING.md:43-45`). Authors keep copyright.

### 7.2 What a proprietary desktop app may do

LGPL 2.1 §§5–6 (`LICENSE:240-331`) is the operative text.

| Integration | Allowed? | Conditions |
|---|---|---|
| **Call `FreeCADCmd` as a subprocess** | **Yes, cleanly.** Running the program is unrestricted (`LICENSE:142-148`, §0). Your app is not a derivative. Distribute the FreeCAD binary with its notices + this LICENSE + corresponding source (or a §6c/d offer). Output (STEP, SVG, PDF) is your data, not a work based on the Library | Easiest path. Matches "figure-generation engine inside a desktop app" |
| **Bundle the official / your-built binaries** | **Yes** | Same: notices, LICENSE, source or written offer for the LGPL parts. You may charge |
| **`import FreeCAD` / `dlopen` `libFreeCADApp.so` from proprietary Python/C++** | **Yes, as a "work that uses the Library"** (`LICENSE:240-250`) | §6: prominent notice; copy of LGPL; and **one of** 6a (object files so user can relink), **6b (shared-library link against a user-replaceable `.so`/`.dll`)**, 6c written offer, 6d equivalent network access. **6b is the intended mechanism.** Do **not** statically link |
| **Statically link `libFreeCADApp` into a closed binary** | Only if you also ship enough to relink (`LICENSE:286-296`, §6a) | Painful. Don't |
| **Copy TechDraw/Sketcher sources into a closed tree** | That is a "work based on the Library" (`LICENSE:129-134`) and the modified work must be LGPL (`LICENSE:164-173`, §2) | Fine for an open plugin; not fine for a closed fork |
| **Ship your own Python scripts that `addObject` / `recompute`** | Scripts that *use* the API are not derivatives of the Library | Your agent code stays proprietary |

§6 also requires that the user be able to reverse-engineer *for debugging those modifications* (`LICENSE:275-276`). A EULA that bans all reverse engineering conflicts with this and, under §11, can make distribution of the Library illegal (`LICENSE:374-385`).

### 7.3 OCCT (Open CASCADE Technology)

OCCT is **not vendored**. CMake `find_package(OpenCASCADE)` / `FindOCC.cmake`. Version is substituted into `src/Doc/ThirdPartyLibraries.html.cmake:60-61` at build time.

OCCT 7.x is itself **LGPL-2.1 with the Open CASCADE exception**. The exception (upstream, not in this tree) explicitly permits linking OCCT into proprietary applications without forcing the application's source open — the same shape as LGPL §6b, spelled out. FreeCAD's use of OCCT does not tighten that.

You will also pull, depending on `BUILD_*` flags:

- **Qt** (LGPL) — QtCore even for `FreeCADCmd`; Qt Widgets + OpenGL for option B
- **Coin3D** (BSD-style; FreeCAD carries a fork at `src/3rdParty/coin`, submodule) — Gui only
- **Python** (PSF)
- **Boost, Eigen, Xerces-C, FreeType, yaml-cpp, fmt** — various permissive / LGPL
- **SMESH** (LGPL, bundled `src/3rdParty/salomesmesh`) — only if FEM is on; turn `BUILD_FEM=OFF`

A patent-figure engine does not need FEM, CAM, BIM, Robot, Start, Web, Tux, Plot, Inspection, ReverseEngineering, Assembly. CMake lets you turn them off individually (`InitializeFreeCADBuildOptions.cmake:147-180`).

### 7.4 License bottom line for this product

- **Preferred:** proprietary app + bundled `FreeCAD`/`FreeCADCmd` as a **replaceable shared-library / subprocess** + offer of FreeCAD+OCCT+Qt source. Your agent, UI, and patent-document code stay closed.
- **Do not** statically link. **Do not** paste TechDraw C++ into a closed module.
- USPTO drawings produced by the tool are **your (or your client's) output**, not LGPL derivatives (`LICENSE:142-148`).

This is not legal advice; it is a reading of the files in this tree plus the well-known OCCT exception. Have counsel confirm the OCCT exception version your LibPack actually ships.

---

## 8. Verdict — ship FreeCAD headless vs CadQuery / build123d

### 8.1 What you would actually ship

**Option B (recommended if TechDraw sheets are the product):**

```
FreeCAD GUI binary
  + QT_QPA_PLATFORM=offscreen (or a hidden QApplication)
  + TechDraw + Part + PartDesign + Sketcher + Import + Mesh
  + -DBUILD_FEM=OFF -DBUILD_CAM=OFF -DBUILD_BIM=OFF -DBUILD_ASSEMBLY=OFF
    -DBUILD_ADDONMGR=OFF -DBUILD_ROBOT=OFF -DBUILD_START=OFF ...
  + a 200-line agent adapter: tempfile in, SVG/PDF/FCStd out
```

Effort: **weeks, not months**, if you treat FreeCAD as an opaque engine and do not fork it. The Python shown in §2.5 + §3 is already the adapter. The hard work is (1) packaging a stripped build for Win/macOS/Linux, (2) balloon layout that looks like patent practice rather than mechanical BOM balloons, (3) a USPTO title-block SVG template (TechDraw's stock ones are ISO/ASME), (4) process isolation so a bad HLR cannot kill the desktop app.

**Option A (`FreeCADCmd` only):** same minus Qt Widgets / Coin / TechDrawGui. You must write the sheet compositor. Effort shifts from packaging to drawing code.

**Do not compile this 3.1 GB tree as part of the product CI for every commit.** Consume official LibPack / conda-forge / your own cached artifact.

### 8.2 Cost axes

| Axis | FreeCAD option B | FreeCAD option A | CadQuery / build123d |
|---|---|---|---|
| **Kernel** | OCCT via Part | same | OCCT via OCP / pythonocc — **same kernel** |
| **Parametric 3D** | Document + expressions + PartDesign history | same | Python replay (no native history tree) |
| **Constraints** | PlaneGCS Sketcher, 20 constraint types, headless | same | None (you build 2D in Python or skip) |
| **HLR** | `HLRBRep_Algo` + PolyAlgo, battle-tested on real parts | same | You call OCCT HLR yourself; no sheet object model |
| **Sheets, balloons, sections, first/third angle, line groups** | **TechDraw. This is the whole reason** | objects exist; PDF/SVG sheet does not | **Absent.** Reimplement or don't |
| **Agent API** | Python, but TypeId strings + recompute graph + occasional OCC exceptions | same, simpler because no Qt | Idiomatic Python. Much nicer to generate |
| **Binary size (order of magnitude, not measured here)** | Full official builds are high-hundreds of MB to ~1 GB. A stripped B still carries OCCT + Qt6 + Coin + Python. Expect **several hundred MB** | OCCT + QtCore + Python. Still **low hundreds of MB** | `pip install` + OCCT libs. Smaller, still dominated by OCCT |
| **Packaging pain** | High. CMake + LibPack + Qt + Coin + PySide. Three OS. `pixi.toml` / `package/rattler-build` exist but are a full app recipe | Medium. `BUILD_GUI=OFF` is first-class | Low. Already the Python CAD ecosystem default |
| **License to embed** | LGPL-2.1-or-later, subprocess/shared-lib is clean | same | CadQuery MIT; OCP/OCCT still LGPL-exception. Similar constraint on the kernel |
| **Headless honesty** | B is "offscreen GUI". A is truly headless | Truly headless | Truly headless |
| **HLR / TechDraw maturity** | Years of mechanical-drawing bugs fixed. Section/detail/broken-view/complex-section already exist | same geometry | You own every edge case |
| **Patent-specific** | Balloons + `NextBalloonIndex` + leaders + ISO/ASME line groups. No 37 CFR 1.84 template, no numeral↔spec audit | same | Nothing |

### 8.3 Decisive tradeoffs

1. **TechDraw is the only reason to take FreeCAD.** If the product is "parametric solid in, USPTO-ish 2D figures with reference numerals out", FreeCAD already has 80% of the drawing object model and the exact OCCT HLR you would wrap anyway. CadQuery gives you the solid and then you write TechDraw. That is a multi-month project, not a wrapper.

2. **The 20% that is missing is exactly the patent-practice 20%.** No exploded-view TypeId (only a `getExplodedShape` hook). `writeDXFPage` drops balloons. Sheet SVG/PDF is Gui-only. Line groups are ISO/ASME, not 37 CFR 1.84. Title blocks are mechanical, not USPTO. Numeral consistency with the spec is your problem — FreeCAD will happily number balloons `1, 2, 3` (`NextBalloonIndex`) and knows nothing about claim language.

3. **Do not in-process-link the GUI stack into the desktop app if you can help it.** Subprocess + offscreen `FreeCAD` is the LGPL-clean, crash-isolated, version-pinable shape. `import FreeCAD` in-process saves a few dozen ms and costs you the FreeCAD Python, the GIL during recompute, and a much louder LGPL story.

4. **CadQuery/build123d remain the right choice if** you only need solids + STEP/STL + your own 2D (e.g. you already have a figure compositor, or figures are isometric renders, or a human still inks the sheets). They are a worse choice if you need section views, hidden-line orthographics, and leadered numerals as structured objects an agent can edit.

### 8.4 Recommendation

For a patent-practice figure engine:

- **Use FreeCAD as an external, LGPL-bundled engine (option B), not as a library you compile against.**
- Drive it with Python that matches the App tests in this tree: `addObject` → set properties → `recompute` → `TechDrawGui.exportPageAsSvg`.
- Keep CadQuery/build123d in mind as the *geometry* alternative if TechDraw's sheet export proves too entangled with Qt. You can still call OCCT HLR (`Part.HLRBRep` or pythonocc) from that stack; you cannot buy balloons, projection groups, or ISO line groups from it.
- Budget packaging (three OS, stripped `BUILD_*`, offscreen smoke test) as the main engineering cost. The CAD API is already scriptable. The figure-style gap (USPTO templates, numeral policy, balloon placement that doesn't look like a BOM) is product work, not FreeCAD work.

**Viability: yes, with the sheet-export caveat named above.** It is the only in-tree stack in this study that is already a headless-capable 3D kernel *plus* a structured 2D drawing graph with reference-numeral objects.

---

## Appendix A — GUI-gate cheat sheet

| Want | Call this | Process |
|---|---|---|
| Solid + params + sketch solve | `Part` / `PartDesign` / `Sketcher` | `FreeCADCmd` |
| HLR compounds / SVG/DXF **strings of edges** | `TechDraw.project*` / `viewPartAs*` | `FreeCADCmd` |
| Page + views + balloons + leaders as objects | `doc.addObject("TechDraw::…")` | `FreeCADCmd` |
| Page as DXF (no balloons) | `TechDraw.writeDXFPage` | `FreeCADCmd` |
| Page as SVG/PDF (full sheet) | `TechDrawGui.exportPageAsSvg/Pdf` | `FreeCAD` + `QApplication` (offscreen OK) |
| STEP with colors | `Import.export` / `Import.insert` | `FreeCADCmd` |
| STL | `Mesh` or `Shape.exportStl` | `FreeCADCmd` |
| glTF | `ImportGui` | GUI process |
| 3D shaded PNG | `FreeCADGui.SoQtOffscreenRenderer` | GUI process |

## Appendix B — Key files

| Path | Why |
|---|---|
| `src/Main/MainCmd.cpp` | `FreeCADCmd` entry |
| `src/App/Application.cpp` | CLI, RunMode, file dispatch |
| `src/App/FreeCADInit.py` | `GuiUp=0`, addon loader |
| `src/App/Document.cpp` | recompute graph |
| `src/Mod/Sketcher/SketcherExample.py` | canonical sketch script |
| `src/Mod/PartDesign/PartDesignTests/TestPad.py` | canonical solid script |
| `src/Mod/TechDraw/App/GeometryObject.cpp` | HLR |
| `src/Mod/TechDraw/App/DrawViewPart.cpp` | sync-vs-thread gate |
| `src/Mod/TechDraw/App/AppTechDrawPy.cpp` | App Python export surface |
| `src/Mod/TechDraw/Gui/AppTechDrawGuiPy.cpp` | sheet SVG/PDF |
| `src/Mod/TechDraw/TDTest/*` | headless vs Gui test split |
| `AI_POLICY.md` | contribution policy |
| `LICENSE` | LGPL 2.1 |
| `.gitmodules` | AddonManager not in tree |
