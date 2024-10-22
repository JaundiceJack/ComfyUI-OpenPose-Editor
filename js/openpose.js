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
  [14, 0],
  [14, 16],
  [15, 0],
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

const DEFAULT_KEYPOINTS = [
  [241, 77],
  [241, 120],
  [191, 118],
  [177, 183],
  [163, 252],
  [298, 118],
  [317, 182],
  [332, 245],
  [225, 241],
  [213, 359],
  [215, 454],
  [270, 240],
  [282, 360],
  [286, 456],
  [232, 59],
  [253, 60],
  [225, 70],
  [260, 72],
];

/**
 * Read a JSON file
 * @param file - The .json file to be read
 * @returns A JSON string
 */
async function readFileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      resolve(reader.result);
    };
    reader.onerror = async () => {
      reject(reader.error);
    };
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
    e.addEventListener("load", () => {
      resolve(e);
    });
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
  return new Promise(function (resolve) {
    canvas.toBlob(resolve);
  });
}

/**
 * Create a fabricjs circle (representing a keypoint) and give it lines to connect to
 * @param color - An "rgb(#, #, #)" string
 * @param left - The point's x value on the canvas
 * @param top - The point's y value on the canvas
 * @param lines - An array of fabricjs lines connected to the circles
 * @returns A fabricjs circle
 */
function makeCircle({ color, left, top, lines }) {
  return new fabric.Circle({
    left: left,
    top: top,
    strokeWidth: 1,
    radius: 4,
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
    hasBorders: false,
  });
}

/**
 * Create a fabricjs line to connect points
 * @param color - An "rgb(#, #, #)" string
 * @param coords - The starting and ending points of the line
 * @returns A fabricjs line
 */
function makeLine({ color, coords }) {
  return new fabric.Line(coords, {
    fill: color,
    stroke: color,
    strokeWidth: 10,
    selectable: false,
    evented: false,
    originX: "center",
    originY: "center",
    type: "line",
  });
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
<input bind:this={fileInput} class="openpose-file-input" type="file" accept=".json" />
`;
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

    this.panel.addButton("Add", () => {
      this.addPose();
    });
    this.panel.addButton("Remove", () => {
      this.removePose();
    });
    this.panel.addButton("Reset", () => {
      this.resetCanvas();
    });
    this.panel.addButton("Save", () => this.save());
    this.panel.addButton("Load", () => this.load());

    const widthLabel = document.createElement("label");
    widthLabel.innerHTML = "Width";
    widthLabel.style.fontFamily = "Arial";
    widthLabel.style.padding = "0 0.5rem";
    widthLabel.style.color = "#ccc";
    this.widthInput = document.createElement("input");
    this.widthInput.style.background = "#1c1c1c";
    this.widthInput.style.color = "#aaa";
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
    heightLabel.innerHTML = "Height";
    heightLabel.style.fontFamily = "Arial";
    heightLabel.style.padding = "0 0.5rem";
    heightLabel.style.color = "#aaa";
    this.heightInput = document.createElement("input");
    this.heightInput.style.background = "#1c1c1c";
    this.heightInput.style.color = "#ccc";
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
      const error = this.loadJSON(this.node.properties.savedPose);
      if (error) {
        console.error(
          "[OpenPose Editor] Failed to restore saved pose JSON",
          error
        );
        this.resizeCanvas(this.canvasWidth, this.canvasHeight);
        this.setPose(DEFAULT_KEYPOINTS);
      }
      this.undo_history.push(JSON.stringify(this.canvas));
    } else {
      this.resizeCanvas(this.canvasWidth, this.canvasHeight);
      this.setPose(DEFAULT_KEYPOINTS);
    }

    const keyHandler = this.onKeyDown.bind(this);

    document.addEventListener("keydown", keyHandler);
    this.panel.onClose = async () => {
      document.removeEventListener("keydown", keyHandler);
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
      target,
      flipX,
      flipY,
      showEyes,
    }) => {
      const { top: rtop, left: rleft } = target;
      for (const item of target._objects) {
        let p = item;
        p.scaleX = 1;
        p.scaleY = 1;
        const top =
          rtop +
          p.top * target.scaleY * flipY +
          (target.height * target.scaleY) / 2;
        const left =
          rleft +
          p.left * target.scaleX * flipX +
          (target.width * target.scaleX) / 2;
        p["_top"] = top;
        p["_left"] = left;
        if (p["id"] === 0) {
          p.line1 && p.line1.set({ x1: left, y1: top });
        } else {
          p.line1 && p.line1.set({ x2: left, y2: top });
        }
        if (p["id"] === 14 || p["id"] === 15) {
          p.radius = showEyes ? 5 : 0;
          p.strokeWidth = showEyes ? 10 : 0;
        }
        p.line2 && p.line2.set({ x1: left, y1: top });
        p.line3 && p.line3.set({ x1: left, y1: top });
        p.line4 && p.line4.set({ x1: left, y1: top });
        p.line5 && p.line5.set({ x1: left, y1: top });
      }
    };

    // Update selection positions when angle is not 0
    const updateGroupPositionWithRotation = ({
      target,
      flipX,
      flipY,
      showEyes,
    }) => {
      const { tl, br } = target.aCoords;
      const center = { x: (tl.x + br.x) / 2, y: (tl.y + br.y) / 2 };
      const rad = (target.angle * Math.PI) / 180;
      const sin = Math.sin(rad);
      const cos = Math.cos(rad);
      for (const item of target._objects) {
        let p = item;
        const p_top = p.top * target.scaleY * flipY;
        const p_left = p.left * target.scaleX * flipX;
        const left = center.x + p_left * cos - p_top * sin;
        const top = center.y + p_left * sin + p_top * cos;
        p["_top"] = top;
        p["_left"] = left;
        if (p["id"] === 0) {
          p.line1 && p.line1.set({ x1: left, y1: top });
        } else {
          p.line1 && p.line1.set({ x2: left, y2: top });
        }
        if (p["id"] === 14 || p["id"] === 15) {
          p.radius = showEyes ? 5 : 0.3;
          if (p.line1) p.line1.strokeWidth = showEyes ? 10 : 0;
          if (p.line2) p.line2.strokeWidth = showEyes ? 10 : 0;
        }
        p.line2 && p.line2.set({ x1: left, y1: top });
        p.line3 && p.line3.set({ x1: left, y1: top });
        p.line4 && p.line4.set({ x1: left, y1: top });
        p.line5 && p.line5.set({ x1: left, y1: top });
      }
    };

    // Update line positions for a group of selected points
    const updateGroupPosition = (target) => {
      const flipX = target.flipX ? -1 : 1;
      const flipY = target.flipY ? -1 : 1;
      this.flipped = flipX * flipY === -1;
      const showEyes = this.flipped ? !this.visibleEyes : this.visibleEyes;
      if (target.angle === 0) {
        updateGroupPositionWithoutRotation({ target, flipX, flipY, showEyes });
      } else {
        updateGroupPositionWithRotation({ target, flipX, flipY, showEyes });
      }
      target.setCoords();
    };

    // Update an individually moved point's line positions
    const updatePointPosition = (target) => {
      const flipX = target.flipX ? -1 : 1;
      const flipY = target.flipY ? -1 : 1;
      this.flipped = flipX * flipY === -1;

      if (target["id"] === 0) {
        target.line1 && target.line1.set({ x1: target.left, y1: target.top });
      } else {
        target.line1 && target.line1.set({ x2: target.left, y2: target.top });
      }
      target.line2 && target.line2.set({ x1: target.left, y1: target.top });
      target.line3 && target.line3.set({ x1: target.left, y1: target.top });
      target.line4 && target.line4.set({ x1: target.left, y1: target.top });
      target.line5 && target.line5.set({ x1: target.left, y1: target.top });

      target.setCoords();
    };

    // Update line positions
    const updateLines = (target) => {
      if ("_objects" in target) {
        updateGroupPosition(target);
      } else {
        updatePointPosition(target);
      }
      canvas.renderAll();
    };

    canvas.on("object:moving", (e) => {
      updateLines(e.target);
    });

    canvas.on("object:scaling", (e) => {
      updateLines(e.target);
      canvas.renderAll();
    });

    canvas.on("object:rotating", (e) => {
      updateLines(e.target);
      canvas.renderAll();
    });

    canvas.on("object:modified", () => {
      if (this.lockMode) return;
      this.undo_history.push(JSON.stringify(canvas));
      this.redo_history.length = 0;
      // this.saveToNode();
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
   * Take an array of keypoints, break them into poses, and add them to the canvas
   * @param keypoints - An array of [x,y] points
   * @returns void
   */
  setPose(keypoints) {
    this.canvas.clear();
    this.canvas.backgroundColor = "#000";
    const poses = this.chunkKeypointsIntoPoses(keypoints);
    for (const pose of poses) {
      this.addPose(pose);
      this.canvas.discardActiveObject();
    }
    this.saveToNode();
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
    return { width: width * ratio, height: height * ratio };
  }

  /**
   * Set a new width & height for the canvas
   * @param width - The desired canvas width
   * @param height - The desired canvas height
   * @returns void
   */
  resizeCanvas(width, height) {
    let resolution = this.calcResolution(width, height);

    this.canvasWidth = width;
    this.canvasHeight = height;

    this.widthInput.value = `${width}`;
    this.heightInput.value = `${height}`;

    this.canvas.setWidth(width);
    this.canvas.setHeight(height);
    this.canvasElem.style.width = resolution["width"] + "px";
    this.canvasElem.style.height = resolution["height"] + "px";
    this.canvasElem.nextElementSibling.style.width = resolution["width"] + "px";
    this.canvasElem.nextElementSibling.style.height =
      resolution["height"] + "px";
    this.canvasElem.parentElement.style.width = resolution["width"] + "px";
    this.canvasElem.parentElement.style.height = resolution["height"] + "px";
    this.canvasElem.parentElement.style.margin = "auto";
  }

  /**
   * Revert a change by restoring a pose from the history
   * @returns void
   */
  undo() {
    if (this.undo_history.length > 0) {
      this.lockMode = true;
      if (this.undo_history.length > 1)
        this.redo_history.push(this.undo_history.pop());
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
    this.node.updateSavedPose(serializedPoints);
    await this.uploadCanvasAsFile();
  }

  /**
   * Turn the current canvas into a blob of data that can be turned into an image
   * @returns A blob of data
   */
  async captureCanvasClean() {
    this.lockMode = true;

    this.canvas.getObjects("image").forEach((img) => {
      img.opacity = 0;
    });
    if (this.canvas.backgroundImage) this.canvas.backgroundImage.opacity = 0;
    this.canvas.discardActiveObject();
    this.canvas.renderAll();

    const blob = await canvasToBlob(this.canvasElem);

    this.canvas.getObjects("image").forEach((img) => {
      img.opacity = 1;
    });
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
      const filename = `ComfyUI_OpenPose_${
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
      .map((c) => [c.left, c.top]);

    const json = JSON.stringify(
      {
        width: this.canvas.width,
        height: this.canvas.height,
        keypoints: keypoints,
      },
      null,
      4
    );

    return json;
  }

  /**
   * The openpose keypoints array forms a pose from 18 pairs of x,y coordinates.
   * Splitting the array into groups of 18 separates the poses.
   * @param keypoints - The array of x,y coordinates
   * @returns A 3D array containing arrays of 18 [x,y] coordinates
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
   * @param text - The JSON string
   * @returns null or a string representing an error
   */
  loadJSON(text) {
    const json = JSON.parse(text);
    if (json["width"] && json["height"]) {
      this.resizeCanvas(json["width"], json["height"]);
    } else {
      return "width, height is invalid";
    }
    this.resetCanvas();
    const keypoints = json["keypoints"] || [];
    const poses = this.chunkKeypointsIntoPoses(keypoints);

    for (const pose of poses) {
      if (pose.length % 18 === 0) {
        this.addPose(pose);
      } else {
        return "keypoints is invalid";
      }
    }
    return null;
  }

  /**
   * Save the pose to an openpose json file
   * @returns void
   */
  save() {
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
   * Add a new pose to the canvas
   * @param keypoints - An optional array of x,y points drawing an openpose figure. If none are provided, the default figure will be drawn.
   * @returns void
   */
  addPose(keypoints = DEFAULT_KEYPOINTS) {
    const group = new fabric.Group([], {
      subTargetCheck: true,
      interactive: true,
    });

    const lines = [];
    const circles = [];

    for (let i = 0; i < connect_keypoints.length; i++) {
      // 接続されるidxを指定　[0, 1]なら0と1つなぐ / Specify the index to be connected [0, 1], then connect 0 to 1
      const item = connect_keypoints[i];
      const line = makeLine({
        color: `rgba(${connect_color[i].join(", ")}, 0.7)`,
        coords: keypoints[item[0]].concat(keypoints[item[1]]),
      });
      lines.push(line);
      this.canvas.add(line);
      line["id"] = item[0];
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
        left: keypoints[i][0],
        top: keypoints[i][1],
        lines: list,
      });
      circle["id"] = i;
      circles.push(circle);
      group.add(circle);
    }

    group.lines = lines;
    group.circles = circles;

    this.canvas.discardActiveObject();
    this.canvas.add(group);
    this.canvas.setActiveObject(group);
    group.toActiveSelection();
    this.canvas.requestRenderAll();
  }

  /**
   * Remove the currently selected pose from the canvas
   * @returns void
   */
  removePose() {
    const selection = this.canvas.getActiveObject();
    if (!selection || !("lines" in selection)) return;

    for (const line of selection.lines) {
      this.canvas.remove(line);
    }

    this.canvas.remove(selection);
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

      this.openWidget = this.addWidget("button", "open editor", "image", () => {
        const graphCanvas = LiteGraph.LGraphCanvas.active_canvas;
        if (graphCanvas == null) return;

        const panel = graphCanvas.createPanel("OpenPose Editor", {
          closable: true,
        });
        panel.node = this;
        panel.classList.add("openpose-editor");

        this.openPosePanel = new OpenPosePanel(panel, this);
        document.body.appendChild(this.openPosePanel.panel);
      });
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
