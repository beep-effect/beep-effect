Initial raw output:

{"layerPresent":true,"labelCount":12,"sampleLabels":["Mozzarella topping","Named pizza","Pizza","Pizza base","Pizza topping","Thin and crispy base"],"positioned":["translate(-9999px, -9999px)","translate(-9999px, -9999px)","translate(-9999px, -9999px)","translate(-9999px, -9999px)","translate(-9999px, -9999px)","translate(-9999px, -9999px)"],"canvases":1}

After zoom raw output:

{"layerPresent":true,"labelCount":12,"sampleLabels":["Mozzarella topping","Named pizza","Pizza","Pizza base","Pizza topping","Thin and crispy base"],"positioned":["translate(-9999px, -9999px)","translate(-9999px, -9999px)","translate(-9999px, -9999px)","translate(-9999px, -9999px)","translate(-9999px, -9999px)","translate(-9999px, -9999px)"],"canvases":1}

(a) Yes, the label layer is present, with 12 labels.

(b) "Mozzarella topping", "Named pizza", "Pizza", "Pizza base", "Pizza topping", "Thin and crispy base". Yes, they are real ontology names.

(c) Are the labels VISIBLE next to their nodes in the screenshot? no

(d) After zooming, did the transforms change (do labels track their points)? no

(e) Anything wrong — labels stacked at one spot, off-canvas, overlapping badly? Yes. Every sampled label is positioned off-canvas at `translate(-9999px, -9999px)` both before and after zoom, so no labels are visible or tracking nodes. The graph nodes themselves are also tightly stacked/overlapping in a short horizontal cluster near the left edge of the canvas.
