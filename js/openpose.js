import { app } from "/scripts/app.js";
import "./fabric.min.js";

const connect_keypoints = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [1, 5],
  [5, 6],
  [6, 7],
  [1, 8],
  [8, 9],
  [9, 10],
  [1, 11],
  [11, 12],
  [12, 13],
  [0, 14],
  [14, 16],
  [0, 15],
  [15, 17],
];

const connect_color = [
  [0, 0, 255],
  [255, 0, 0],
  [255, 170, 0],
  [255, 255, 0],
  [255, 85, 0],
  [170, 255, 0],
  [85, 255, 0],
  [0, 255, 0],

  [0, 255, 85],
  [0, 255, 170],
  [0, 255, 255],
  [0, 170, 255],
  [0, 85, 255],
  [85, 0, 255],

  [170, 0, 255],
  [255, 0, 255],
  [255, 0, 170],
  [255, 0, 85],
];

const bodyParts = [
  "face",
  "neck",
  "leftShoulder",
  "leftElbow",
  "leftHand",
  "rightShoulder",
  "rightElbow",
  "rightHand",
  "leftHip",
  "leftKnee",
  "leftFoot",
  "rightHip",
  "rightKnee",
  "rightFoot",
  "leftEye",
  "rightEye",
  "leftEar",
  "rightEar",
];

const defaultKeypoints = [
  { bodyPart: bodyParts[0], x: 241, y: 77, visible: true },
  { bodyPart: bodyParts[1], x: 241, y: 120, visible: true },
  { bodyPart: bodyParts[2], x: 191, y: 118, visible: true },
  { bodyPart: bodyParts[3], x: 177, y: 183, visible: true },
  { bodyPart: bodyParts[4], x: 163, y: 252, visible: true },
  { bodyPart: bodyParts[5], x: 298, y: 118, visible: true },
  { bodyPart: bodyParts[6], x: 317, y: 182, visible: true },
  { bodyPart: bodyParts[7], x: 332, y: 245, visible: true },
  { bodyPart: bodyParts[8], x: 225, y: 241, visible: true },
  { bodyPart: bodyParts[9], x: 213, y: 359, visible: true },
  { bodyPart: bodyParts[10], x: 215, y: 454, visible: true },
  { bodyPart: bodyParts[11], x: 270, y: 240, visible: true },
  { bodyPart: bodyParts[12], x: 282, y: 360, visible: true },
  { bodyPart: bodyParts[13], x: 286, y: 456, visible: true },
  { bodyPart: bodyParts[14], x: 232, y: 59, visible: true },
  { bodyPart: bodyParts[15], x: 253, y: 60, visible: true },
  { bodyPart: bodyParts[16], x: 225, y: 70, visible: true },
  { bodyPart: bodyParts[17], x: 260, y: 72, visible: true },
];

/**
 * Read a JSON file
 * @param file - The .json file to be read
 * @returns A JSON string
 */
async function readFileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => resolve(reader.result);
    reader.onerror = async () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Load the node's preview image from a URL
 * @param imageURL - A string containing the URL
 * @returns A promise resolving to an HTMLImageElement
 */
async function loadImageAsync(imageURL) {
  return new Promise((resolve) => {
    const e = new Image();
    e.setAttribute("crossorigin", "anonymous");
    e.addEventListener("load", () => resolve(e));
    e.src = imageURL;
    return e;
  });
}

/**
 * Retrieve the current canvas's data as a blob
 * @param canvas - The page's canvas element
 * @returns A promise resolving to a data blob
 */
async function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve));
}

/**
 * Create a fabricjs circle (representing a keypoint) and give it lines to connect to
 * @param color - An "rgb(#, #, #)" string
 * @param left - The point's x value on the canvas
 * @param top - The point's y value on the canvas
 * @param lines - An array of fabricjs lines connected to the circles
 * @param visible - whether the circle should be shown or hidden
 * @param bodyPart - the body part the circle represents (i.e. face, leftHand, rightFoot, etc.)
 * @param groupid - a number to identify the circle with other objects in the same pose
 * @returns A fabricjs circle
 */
function makeCircle({ color, left, top, lines, visible, bodyPart, groupid }) {
  return new fabric.Circle({
    left: left,
    top: top,
    strokeWidth: 1,
    radius: 5,
    fill: color,
    stroke: color,
    originX: "center",
    originY: "center",
    type: "circle",
    line1: lines[0],
    line2: lines[1],
    line3: lines[2],
    line4: lines[3],
    line5: lines[4],
    hasControls: false,
    hasBorders: true,
    selectable: true,
    opacity: visible ? 1 : 0,
    bodyPart,
    groupid,
  });
}

/**
 * Create a fabricjs line to connect points
 * @param color - An "rgb(#, #, #)" string
 * @param coords - The starting and ending points of the line
 * @param groupid - a number to identify the line with other objects in the same pose
 * @returns A fabricjs line
 */
function makeLine({ color, coords, groupid }) {
  return new fabric.Line(coords, {
    fill: color,
    stroke: color,
    hasBorders: false,
    strokeWidth: 10,
    strokeLineJoin: "bevel",
    strokeLineCap: "round",
    selectable: false,
    evented: false,
    originX: "center",
    originY: "center",
    type: "line",
    opacity: 1,
    groupid,
  });
}

/**
 * Load a pose from the connected DW Pose Estimator node (if it's calculated it already)
 * @param dwLink - the node id of the connected estimator
 * @returns The json keypoints of the calculated pose
 */
function loadPosesFromDW(dwLink) {
  const openposeNode =
    app.graph._nodes_by_id[app.graph.links[dwLink]["origin_id"]];

  if (
    !(openposeNode.id in app.nodeOutputs) ||
    !("openpose_json" in app.nodeOutputs[openposeNode.id])
  ) {
    return "[]";
  }

  return app.nodeOutputs[openposeNode.id].openpose_json[0] ?? "[]";
}

class OpenPosePanel {
  node = null;
  canvas = null;
  canvasElem = null;
  panel = null;

  undo_history = [];
  redo_history = [];

  visibleEyes = true;
  flipped = false;
  lockMode = false;

  constructor(panel, node) {
    this.panel = panel;
    this.node = node;

    this.panel.style.width = `80vw`;
    this.panel.style.height = `85vh`;
    this.panel.style.left = `0`;
    this.panel.style.right = `0`;
    this.panel.style.bottom = `25px`;
    this.panel.style.margin = `auto auto 0 auto`;

    const rootHtml = `
    <canvas class="openpose-editor-canvas" />
    <div class="canvas-drag-overlay" />
    <input bind:this={fileInput} class="openpose-file-input" type="file" accept=".json" />`;

    const container = this.panel.addHTML(rootHtml, "openpose-container");
    container.style.width = "100%";
    container.style.height = "100%";
    container.style.margin = "auto";
    container.style.display = "flex";

    const dragOverlay = container.querySelector(".canvas-drag-overlay");
    dragOverlay.style.pointerEvents = "none";
    dragOverlay.style.visibility = "hidden";
    dragOverlay.style.display = "flex";
    dragOverlay.style.alignItems = "center";
    dragOverlay.style.justifyContent = "center";
    dragOverlay.style.width = "100%";
    dragOverlay.style.height = "100%";
    dragOverlay.style.color = "white";
    dragOverlay.style.fontSize = "2.5em";
    dragOverlay.style.fontFamily = "inherit";
    dragOverlay.style.fontWeight = "600";
    dragOverlay.style.lineHeight = "100%";
    dragOverlay.style.background = "rgba(0,0,0,0.5)";
    dragOverlay.style.margin = "0.25rem";
    dragOverlay.style.borderRadius = "0.25rem";
    dragOverlay.style.border = "0.5px solid";
    dragOverlay.style.position = "absolute";

    this.canvasWidth = 512;
    this.canvasHeight = 512;

    this.canvasElem = container.querySelector(".openpose-editor-canvas");
    this.canvasElem.width = this.canvasWidth;
    this.canvasElem.height = this.canvasHeight;
    this.canvasElem.style.margin = "0.25rem";
    this.canvasElem.style.borderRadius = "0.25rem";
    this.canvasElem.style.border = "0.5px solid";

    this.canvas = this.initCanvas(this.canvasElem);

    this.fileInput = container.querySelector(".openpose-file-input");
    this.fileInput.style.display = "none";
    this.fileInput.addEventListener("change", this.onLoad.bind(this));

    this.addButton = this.panel.addButton("Add", () => this.addPose());
    this.removeButton = this.panel.addButton("Remove", () =>
      this.removePose(this.canvas.getActiveObject())
    );
    this.selectAllButton = this.panel.addButton("Select", () =>
      this.selectAll(this.canvas.getActiveObject())
    );
    this.toggleButton = this.panel.addButton("Hide", () => this.togglePose());
    this.resetButton = this.panel.addButton("Reset", () => this.resetCanvas());
    this.saveButton = this.panel.addButton("Save", () => this.savePoseToJson());
    this.loadButton = this.panel.addButton("Load JSON", () => this.load());
    this.dwButton = this.panel.addButton("Load DWPose", () =>
      this.loadFromDW()
    );

    this.addButton.style.margin = "0 4px 0 0";
    this.addButton.style.padding = "4px 12px 4px 12px";
    this.addButton.style.height = "100%";

    this.selectAllButton.style.margin = "0 4px 0 0";
    this.selectAllButton.style.padding = "4px 12px 4px 12px";
    this.selectAllButton.style.height = "100%";

    this.toggleButton.style.margin = "0 4px 0 0";
    this.toggleButton.style.padding = "4px 12px 4px 12px";
    this.toggleButton.style.height = "100%";

    this.removeButton.style.margin = "0 4px 0 0";
    this.removeButton.style.padding = "4px 12px 4px 12px";
    this.removeButton.style.height = "100%";

    this.resetButton.style.margin = "0 4px 0 0";
    this.resetButton.style.padding = "4px 12px 4px 12px";
    this.resetButton.style.height = "100%";

    this.saveButton.style.margin = "0 4px 0 0";
    this.saveButton.style.padding = "4px 12px 4px 12px";
    this.saveButton.style.height = "100%";

    this.loadButton.style.margin = "0 4px 0 0";
    this.loadButton.style.padding = "4px 12px 4px 12px";
    this.loadButton.style.height = "100%";
    this.loadButton.style.fontSize = "12px";

    this.dwButton.style.margin = "0 4px 0 0";
    this.dwButton.style.padding = "4px 12px 4px 12px";
    this.dwButton.style.height = "100%";
    this.dwButton.style.fontSize = "12px";

    const widthLabel = document.createElement("label");
    widthLabel.innerHTML = "Width:";
    widthLabel.style.fontFamily = "Arial";
    widthLabel.style.padding = "0 0.5rem";
    widthLabel.style.color = "#ccc";
    this.widthInput = document.createElement("input");
    this.widthInput.style.background = "#1c1c1c";
    this.widthInput.style.color = "#aaa";
    this.widthInput.style.width = "60px";
    this.widthInput.setAttribute("type", "number");
    this.widthInput.setAttribute("min", "64");
    this.widthInput.setAttribute("max", "4096");
    this.widthInput.setAttribute("step", "64");
    this.widthInput.setAttribute("type", "number");
    this.widthInput.addEventListener("change", async () => {
      this.resizeCanvas(+this.widthInput.value, +this.heightInput.value);
      await this.saveToNode();
    });

    const heightLabel = document.createElement("label");
    heightLabel.innerHTML = "Height:";
    heightLabel.style.fontFamily = "Arial";
    heightLabel.style.padding = "0 0.5rem";
    heightLabel.style.color = "#aaa";
    this.heightInput = document.createElement("input");
    this.heightInput.style.background = "#1c1c1c";
    this.heightInput.style.color = "#ccc";
    this.heightInput.style.width = "60px";
    this.heightInput.setAttribute("type", "number");
    this.heightInput.setAttribute("min", "64");
    this.heightInput.setAttribute("max", "4096");
    this.heightInput.setAttribute("step", "64");
    this.heightInput.addEventListener("change", async () => {
      this.resizeCanvas(+this.widthInput.value, +this.heightInput.value);
      await this.saveToNode();
    });

    this.panel.footer.appendChild(widthLabel);
    this.panel.footer.appendChild(this.widthInput);
    this.panel.footer.appendChild(heightLabel);
    this.panel.footer.appendChild(this.heightInput);

    if (this.node.properties.savedPose) {
      this.loadJSON(this.node.properties.savedPose);
      this.resizeCanvas(this.canvasWidth, this.canvasHeight);
      this.undo_history.push(JSON.stringify(this.canvas));
    } else {
      this.resizeCanvas(this.canvasWidth, this.canvasHeight);
    }

    const keyHandler = this.onKeyDown.bind(this);

    document.addEventListener("keydown", keyHandler);
    this.panel.onClose = async () => {
      document.removeEventListener("keydown", keyHandler);
      // Deselecting the active object sets the circles positions relative to the canvas instead of the selection
      this.canvas.discardActiveObject();
      await this.saveToNode();
    };
  }

  /**
   * Draw the editor's canvas when opened
   * @param elem - The page's canvas element
   * @returns A fabricjs canvas
   */
  initCanvas(elem) {
    const canvas = new fabric.Canvas(elem, {
      backgroundColor: "#000",
      selection: true,
      preserveObjectStacking: true,
    });

    this.undo_history = [];
    this.redo_history = [];

    // Update selection positions when angle is 0
    const updateGroupPositionWithoutRotation = ({
      selection,
      flipX,
      flipY,
    }) => {
      const { top: rtop, left: rleft } = selection;
      selection._objects
        .filter((obj) => obj.type === "circle")
        .forEach((circle) => {
          const top =
            rtop +
            circle.top * selection.scaleY * flipY +
            (selection.height * selection.scaleY) / 2;
          const left =
            rleft +
            circle.left * selection.scaleX * flipX +
            (selection.width * selection.scaleX) / 2;

          // If it's the face invert the line
          if (circle.bodyPart === "face") {
            circle.line1 && circle.line1.set({ x1: left, y1: top });
          } else {
            circle.line1 && circle.line1.set({ x2: left, y2: top });
          }
          circle.line2 && circle.line2.set({ x1: left, y1: top });
          circle.line3 && circle.line3.set({ x1: left, y1: top });
          circle.line4 && circle.line4.set({ x1: left, y1: top });
          circle.line5 && circle.line5.set({ x1: left, y1: top });
        });
    };

    // Update selection positions when angle is not 0
    const updateGroupPositionWithRotation = ({ selection, flipX, flipY }) => {
      const { tl, br } = selection.aCoords;
      const center = { x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 };
      const rad = (selection.angle * Math.PI) / 180;
      const sin = Math.sin(rad);
      const cos = Math.cos(rad);
      selection._objects
        .filter((obj) => obj.type === "circle")
        .forEach((circle) => {
          const p_top = circle.top * selection.scaleY * flipY;
          const p_left = circle.left * selection.scaleX * flipX;
          const left = center.x + p_left * cos - p_top * sin;
          const top = center.y + p_left * sin + p_top * cos;

          // If it's the face invert the line
          if (circle.bodyPart === "face") {
            circle.line1 && circle.line1.set({ x1: left, y1: top });
          } else {
            circle.line1 && circle.line1.set({ x2: left, y2: top });
          }
          circle.line2 && circle.line2.set({ x1: left, y1: top });
          circle.line3 && circle.line3.set({ x1: left, y1: top });
          circle.line4 && circle.line4.set({ x1: left, y1: top });
          circle.line5 && circle.line5.set({ x1: left, y1: top });
        });
    };

    // Update line positions for a group of selected points
    const updateGroupPosition = (selection) => {
      const flipX = selection.flipX ? -1 : 1;
      const flipY = selection.flipY ? -1 : 1;
      this.flipped = flipX * flipY === -1;
      const showEyes = this.flipped ? !this.visibleEyes : this.visibleEyes;
      if (selection.angle === 0) {
        updateGroupPositionWithoutRotation({
          selection,
          flipX,
          flipY,
        });
      } else {
        updateGroupPositionWithRotation({ selection, flipX, flipY });
      }
    };

    // Update an individually moved point's line positions
    const updatePointPosition = (circle) => {
      const flipX = circle.flipX ? -1 : 1;
      const flipY = circle.flipY ? -1 : 1;
      this.flipped = flipX * flipY === -1;

      // If it's the face invert the line
      if (circle.bodyPart === "face") {
        circle.line1 && circle.line1.set({ x1: circle.left, y1: circle.top });
      } else {
        circle.line1 && circle.line1.set({ x2: circle.left, y2: circle.top });
      }
      circle.line2 && circle.line2.set({ x1: circle.left, y1: circle.top });
      circle.line3 && circle.line3.set({ x1: circle.left, y1: circle.top });
      circle.line4 && circle.line4.set({ x1: circle.left, y1: circle.top });
      circle.line5 && circle.line5.set({ x1: circle.left, y1: circle.top });

      circle.setCoords();
    };

    // Update line positions
    const updateLines = (selection) => {
      if ("_objects" in selection) {
        updateGroupPosition(selection);
      } else {
        updatePointPosition(selection);
      }
      canvas.renderAll();
    };

    canvas.on("object:moving", (e) => updateLines(e.target));
    canvas.on("object:scaling", (e) => updateLines(e.target));
    canvas.on("object:rotating", (e) => updateLines(e.target));
    canvas.on("object:modified", () => {
      if (this.lockMode) return;
      this.undo_history.push(JSON.stringify(canvas));
      this.redo_history.length = 0;
    });

    return canvas;
  }

  /**
   * Implement ctrl+z & ctrl+y undo/redo functionality
   * @param e - The keypress event
   * @returns void
   */
  onKeyDown(e) {
    if (e.key === "z" && e.ctrlKey) {
      this.undo();
      e.preventDefault();
      e.stopImmediatePropagation();
    } else if (e.key === "y" && e.ctrlKey) {
      this.redo();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  /**
   * Set the viewport's width & height relative to the screen's resolution
   * @param width - The canvas width
   * @param height - The canvas height
   * @returns An object containing the adjusted width & height
   */
  calcResolution(width, height) {
    const viewportWidth = window.innerWidth / 2.25;
    const viewportHeight = window.innerHeight * 0.75;
    const ratio = Math.min(viewportWidth / width, viewportHeight / height);
    return { width: `${width * ratio}px`, height: `${height * ratio}px` };
  }

  /**
   * Set a new width & height for the canvas
   * @param width - The desired canvas width
   * @param height - The desired canvas height
   * @returns void
   */
  resizeCanvas(width, height) {
    this.canvas.setWidth(width);
    this.canvas.setHeight(height);
    this.widthInput.value = `${width}`;
    this.heightInput.value = `${height}`;
    const { width: wpx, height: hpx } = this.calcResolution(width, height);
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.canvasElem.style.width = wpx;
    this.canvasElem.style.height = hpx;
    this.canvasElem.nextElementSibling.style.width = wpx;
    this.canvasElem.nextElementSibling.style.height = hpx;
    this.canvasElem.parentElement.style.width = wpx;
    this.canvasElem.parentElement.style.height = hpx;
    this.canvasElem.parentElement.style.margin = "auto";
  }

  /**
   * Revert a change by restoring a pose from the history
   * @returns void
   */
  undo() {
    if (this.undo_history.length > 0) {
      this.lockMode = true;
      if (this.undo_history.length > 1) {
        this.redo_history.push(this.undo_history.pop());
      }
      const content = this.undo_history[this.undo_history.length - 1];
      this.canvas.loadFromJSON(content, () => {
        this.canvas.renderAll();
        this.lockMode = false;
      });
    }
  }

  /**
   * Restore a pose that was removed by a undo()
   * @returns void
   */
  redo() {
    if (this.redo_history.length > 0) {
      this.lockMode = true;
      const content = this.redo_history.pop();
      this.undo_history.push(content);
      this.canvas.loadFromJSON(content, () => {
        this.canvas.renderAll();
        this.lockMode = false;
      });
    }
  }

  /**
   * Save the keypoints to the node and save the pose in ComfyUI's input folder
   * @returns void
   */
  async saveToNode() {
    const serializedPoints = this.serializeJSON();
    if (this.node.properties.savedPose !== serializedPoints) {
      this.node.updateSavedPose(serializedPoints);
      await this.uploadCanvasAsFile();
    }
  }

  /**
   * Turn the current canvas into a blob of data that can be turned into an image
   * @returns A blob of data
   */
  async captureCanvasClean() {
    this.lockMode = true;
    this.canvas.getObjects("image").forEach((img) => (img.opacity = 0));

    if (this.canvas.backgroundImage) {
      this.canvas.backgroundImage.opacity = 0;
    }
    this.canvas.discardActiveObject();
    this.canvas.renderAll();
    const blob = await canvasToBlob(this.canvasElem);
    this.canvas.getObjects("image").forEach((img) => (img.opacity = 1));

    if (this.canvas.backgroundImage) this.canvas.backgroundImage.opacity = 0.5;
    this.canvas.renderAll();
    this.lockMode = false;

    return blob;
  }

  /**
   * Submit the canvas's poses as a png image to display in the node
   * @returns void
   */
  async uploadCanvasAsFile() {
    try {
      const blob = await this.captureCanvasClean();

      // Alternate between 10 image files to get the preview to update each time the pose is moved
      const filename = `OpenPose_${
        this.node.properties.previewCounter || 0
      }.png`;
      this.node.incrementPreview();

      const body = new FormData();
      body.append("image", blob, filename);
      body.append("overwrite", "true");

      const resp = await fetch("/upload/image", {
        method: "POST",
        body,
      });

      if (resp.status === 200) {
        const data = await resp.json();
        await this.node.setImage(data.name);
      } else {
        console.error(resp.status + " - " + resp.statusText);
        alert(resp.status + " - " + resp.statusText);
      }
    } catch (error) {
      console.error(error);
      alert(error);
    }
  }

  /**
   * Executed when an openpose JSON file is selected. Parses it into poses and saves it to the canvas.
   * @param e - Unused event
   * @returns void
   */
  async onLoad(e) {
    const file = this.fileInput.files[0];
    const text = await readFileToText(file);
    const error = await this.loadJSON(text);
    if (error != null) {
      app.ui.dialog.show(error);
    } else {
      this.saveToNode();
    }
  }

  /**
   * Turn the current pose(s) on the canvas to into an openpose JSON string
   * @returns A stringified JSON containing the canvas width, height, & keypoints
   */
  serializeJSON() {
    const keypoints = this.canvas
      .getObjects()
      .filter((i) => i.type === "circle")
      .map((c) => [c.left, c.top, 1.0]);

    const chunked = this.chunkKeypointsIntoPoses(keypoints);

    const serialized = [
      {
        canvas_height: this.canvas.height,
        canvas_width: this.canvas.width,
        people: [
          ...chunked.map((pose) => ({ pose_keypoints_2d: pose.flat() })),
        ],
      },
    ];

    return JSON.stringify(serialized, null, 4);
  }

  /**
   * The openpose keypoints array forms a pose from 18 pairs of x,y coordinates.
   * Splitting the array into groups of 18 separates the poses.
   * @param keypoints - The array of x,y coordinates
   * @returns An array containing 18 [x, y, flipped] coordinates
   */
  chunkKeypointsIntoPoses(keypoints) {
    return keypoints.reduce((acc, point, i) => {
      const poseIndex = Math.floor(i / 18);
      if (!acc[poseIndex]) acc[poseIndex] = [];
      acc[poseIndex].push(point);
      return acc;
    }, []);
  }

  /**
   * Load an openpose JSON file and apply the poses within to the current canvas
   * executes when the panel opens to load the savedPose
   * @param text - The JSON string
   * @returns null or a string representing an error
   */
  loadJSON(text) {
    if (!text) {
      return;
    }
    const json = JSON.parse(text);
    if (!json.length) {
      return;
    }
    const { canvas_width, canvas_height } = json[0];

    if (canvas_width && canvas_height) {
      this.resizeCanvas(canvas_width, canvas_height);
    } else {
      return "canvas width or height is invalid";
    }
    this.resetCanvas();

    const poses = json[0].people
      .map((pose) => pose.pose_keypoints_2d)
      .map((pose) => {
        const person = [];
        for (let i = 0; i < pose.length; i += 3) {
          person.push([pose[i], pose[i + 1]]);
        }
        return person;
      }, []);

    poses.forEach((pose) => {
      if (pose.length % 18 === 0) {
        this.addPose(
          pose.map((keypoint, i) => ({
            bodyPart: bodyParts[i],
            x: keypoint[0],
            y: keypoint[1],
            visible: true,
          }))
        );
      } else {
        return "keypoints is invalid";
      }
    });

    return null;
  }

  /**
   * Save the pose to an openpose json file
   * @returns void
   */
  savePoseToJson() {
    const json = this.serializeJSON();
    const blob = new Blob([json], {
      type: "application/json",
    });
    const filename = "pose-" + Date.now().toString() + ".json";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /**
   * Open the file browser to select an openpose json file to load
   * @returns void
   */
  load() {
    this.fileInput.value = null;
    this.fileInput.click();
  }

  /**
   * Load a pose from a connected dw_pose estimation node (after it's run to load its own pose)
   * @returns void
   */
  loadFromDW() {
    const dwLink = this.node.inputs.find(
      (input) => input.name === "pose_keypoint"
    )?.link;
    if (dwLink) {
      const dwPose = loadPosesFromDW(dwLink);
      if (!JSON.parse(dwPose)?.length) {
        alert(
          `pose_keypoint not detected in the connected DWPose Estimator node 
(you may have to run a queue once to load it).`
        );
        return;
      }
      this.loadJSON(dwPose);
      this.resizeCanvas(this.canvasWidth, this.canvasHeight);
    } else {
      alert("No DWPose Estimator pose_keypoint connected.");
    }
  }

  /**
   * Add a new pose to the canvas
   * @param keypoints - An optional array of x,y points drawing an openpose figure. If none are provided, the default figure will be drawn.
   * @returns void
   */
  addPose(keypoints = defaultKeypoints) {
    if (!keypoints.length) {
      return;
    }
    const group = new fabric.Group([], {
      subTargetCheck: true,
      interactive: true,
    });

    const lines = [];
    const circles = [];
    const groupid = Math.floor(Math.random() * 1000000);

    for (let i = 0; i < connect_keypoints.length; i++) {
      // 接続されるidxを指定　[0, 1]なら0と1つなぐ / Specify the index to be connected [0, 1], then connect 0 to 1
      const item = connect_keypoints[i];
      const lineStart = [keypoints[item[0]].x, keypoints[item[0]].y];
      const lineEnd = [keypoints[item[1]].x, keypoints[item[1]].y];
      const line = makeLine({
        color: `rgba(${connect_color[i].join(", ")}, 0.7)`,
        coords: lineStart.concat(lineEnd),
        groupid,
      });
      lines.push(line);
      this.canvas.add(line);
    }

    for (let i = 0; i < keypoints.length; i++) {
      const list = [];
      connect_keypoints.filter((item, idx) => {
        if (item.includes(i)) {
          list.push(lines[idx]);
          return idx;
        }
      });

      const circle = makeCircle({
        color: `rgb(${connect_color[i].join(", ")})`,
        left: keypoints[i].x,
        top: keypoints[i].y,
        lines: list,
        bodyPart: keypoints[i].bodyPart,
        visible: keypoints[i].visible,
        groupid,
      });
      circles.push(circle);
      group.addWithUpdate(circle);
    }

    this.canvas.discardActiveObject();
    this.canvas.add(group);
    this.canvas.setActiveObject(group);
    group.toActiveSelection();
    this.canvas.requestRenderAll();
  }

  /**
   * Hide the given circle and it's connected lines
   * @param circle - the fabricjs circle to set opacity to 0
   * @returns void
   */
  toggleLimb(circle, opacity) {
    circle.set({ opacity });
    circle.line1 && circle.line1.set({ opacity });
    circle.line2 && circle.line2.set({ opacity });
    circle.line3 && circle.line3.set({ opacity });
    circle.line4 && circle.line4.set({ opacity });
    circle.line5 && circle.line5.set({ opacity });
    this.canvas.requestRenderAll();
  }

  /**
   * Select all objects provided in the objectsToSelect array
   * @param objectsToSelect - an array of fabricjs circle objects
   * @returns void
   */
  selectAllFromCircle(objectsToSelect) {
    const newSelection = new fabric.ActiveSelection(objectsToSelect, {
      originX: "left",
      originY: "top",
      canvas: this.canvas,
    });
    this.canvas.add(newSelection);

    newSelection.onDeselect = () => {
      newSelection.forEachObject((o) => newSelection.removeWithUpdate(o));
      this.canvas.remove(newSelection);
      return false;
    };

    this.canvas.setActiveObject(newSelection);
  }

  /**
   * Select all objects provided in the objectsToSelect array from an existing selection
   * @param selection - an existing fabricjs ActiveSelection object
   * @param objectsToSelect - an array of fabricjs circle objects
   * @returns void
   */
  selectAllFromSelection(selection, objectsToSelect) {
    selection._objects = [];
    objectsToSelect.forEach((o) => selection.addWithUpdate(o));
    this.canvas.setActiveObject(selection);
  }

  /**
   * Get all remaining objects on the canvas belonging to the groups found on the existing selection
   * @param selection - an existing fabricjs ActiveSelection object or Circle object
   * @returns an array of fabricjs circle objects
   */
  getSelectedGroupsObjects(selection) {
    const selectedGroups =
      selection.type === "circle"
        ? [selection.groupid]
        : selection._objects?.reduce((acc, circle) => {
            !acc.includes(circle.groupid) && acc.push(circle.groupid);
            return acc;
          }, []) ?? [];

    return this.canvas
      .getObjects()
      .filter((i) => i.type === "circle" && selectedGroups.includes(i.groupid));
  }

  /**
   * Select the remaining points connected to the active selection
   * @param selection - The selected active object
   * @returns void
   */
  selectAll(selection) {
    if (!selection) return;
    const objectsToSelect = this.getSelectedGroupsObjects(selection);
    this.canvas.discardActiveObject();
    if (selection.type === "circle") {
      this.selectAllFromCircle(objectsToSelect);
    } else {
      this.selectAllFromSelection(selection, objectsToSelect);
    }
    this.canvas.requestRenderAll();
  }

  /**
   * Remove the selected pose from the canvas
   * @param selection - the pose to remove
   * @returns void
   */
  removePose(selection) {
    if (!selection) return;

    this.getSelectedGroupsObjects(selection).forEach((circle) => {
      circle.line1 && this.canvas.remove(circle.line1);
      circle.line1 && this.canvas.remove(circle.line2);
      circle.line1 && this.canvas.remove(circle.line3);
      circle.line1 && this.canvas.remove(circle.line4);
      circle.line1 && this.canvas.remove(circle.line5);
      this.canvas.remove(circle);
    });

    this.canvas.discardActiveObject();
  }

  /**
   * Hide or show the currently selected keypoints
   * @returns void
   */
  togglePose() {
    const selection = this.canvas.getActiveObject();
    if (!selection) return;

    if (selection.type === "circle") {
      this.toggleLimb(selection, selection.opacity === 1 ? 0 : 1);
    } else {
      const opacities = selection._objects?.reduce(
        (acc, circle) => {
          circle.opacity === 1 ? (acc.on += 1) : (acc.off += 1);
          return acc;
        },
        { on: 0, off: 0 }
      );
      const oppositeOpacity = opacities.on > opacities.off ? 0 : 1;
      selection._objects?.forEach((circle) =>
        this.toggleLimb(circle, oppositeOpacity)
      );
    }
  }

  /**
   * Remove all poses from the canvas
   * @returns void
   */
  resetCanvas() {
    this.canvas.clear();
    this.canvas.backgroundColor = "#000";
  }
}

app.registerExtension({
  name: "Nui.OpenPoseEditor",

  async beforeRegisterNodeDef(nodeType, nodeData, app) {
    if (nodeData.name !== "Nui.OpenPoseEditor") {
      return;
    }

    fabric.Object.prototype.transparentCorners = false;
    fabric.Object.prototype.cornerColor = "#108ce6";
    fabric.Object.prototype.borderColor = "#108ce6";
    fabric.Object.prototype.cornerSize = 10;

    const onNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function () {
      const r = onNodeCreated
        ? onNodeCreated.apply(this, arguments)
        : undefined;

      if (!this.properties) {
        this.properties = {};
        this.properties.savedPose = "";
        this.properties.previewCounter = 0;
      }

      this.serialize_widgets = true;

      // Output & widget
      this.imageWidget = this.widgets.find((w) => w.name === "image");
      this.imageWidget.callback = this.showImage.bind(this);
      this.imageWidget.disabled = true;

      this.makeOpenPosePanel = () => {
        const graphCanvas = LiteGraph.LGraphCanvas.active_canvas;
        if (graphCanvas == null) return;

        const panel = graphCanvas.createPanel("OpenPose Editor", {
          closable: true,
        });
        panel.node = this;
        panel.classList.add("openpose-editor");

        this.openPosePanel = new OpenPosePanel(panel, this);
        document.body.appendChild(this.openPosePanel.panel);
      };

      this.openWidget = this.addWidget("button", "open editor", "image", () =>
        this.makeOpenPosePanel()
      );
      this.openWidget.serialize = false;

      // On load if we have a value then render the image
      // The value isnt set immediately so we need to wait a moment
      // No change callbacks seem to be fired on initial setting of the value
      requestAnimationFrame(async () => {
        if (this.imageWidget.value) {
          await this.setImage(this.imageWidget.value);
        }
      });
    };

    nodeType.prototype.updateSavedPose = function (newPose) {
      this.properties.savedPose = newPose;
    };

    nodeType.prototype.incrementPreview = function () {
      if (this.properties.previewCounter === 9) {
        this.properties.previewCounter = 0;
      } else {
        this.properties.previewCounter++;
      }
    };

    nodeType.prototype.showImage = async function (name) {
      let folder_separator = name.lastIndexOf("/");
      let subfolder = "";
      if (folder_separator > -1) {
        subfolder = name.substring(0, folder_separator);
        name = name.substring(folder_separator + 1);
      }
      const img = await loadImageAsync(
        `/view?filename=${name}&type=input&subfolder=${subfolder}`
      );
      this.imgs = [img];
      this.setSizeForImage();
      app.graph.setDirtyCanvas(true);
    };

    nodeType.prototype.setImage = async function (name) {
      this.imageWidget.value = name;
      await this.showImage(name);
    };

    nodeType.prototype.refreshImage = async function () {
      if (this.imageWidget.value) await this.showImage(this.imageWidget.value);
    };

    const onPropertyChanged = nodeType.prototype.onPropertyChanged;
    nodeType.prototype.onPropertyChanged = function (property, value) {
      if (property === "savedPose") {
        this.refreshImage();
      } else {
        if (onPropertyChanged) onPropertyChanged.apply(this, arguments);
      }
    };
  },
});
