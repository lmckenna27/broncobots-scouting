/* global cv, pdfjsLib */

/**
 * Main Scanning Function
 * @param {string} mapFileUrl - The path to your JSON map (e.g., "map.json")
 * @param {Array<File>} filesArray - Array of File objects
 * @param {string|null} outputContainerId - (Optional) ID of a div to render visual canvases into
 * @param {number} fillThreshold - The sensitivity threshold for marking a bubble filled
 * @returns {Promise<Array<Object>>} - Returns an array of JSON objects
 */
export async function processOMRScans(
  mapData, // <--- Changed from mapFileUrl
  filesArray,
  outputContainerId = null,
  fillThreshold = 0.011,
) {
  let extractedDataArray = [];

  // NO MORE FETCH REQUIRED! We just use the data directly.
  let configJson = mapData;

  if (!configJson || !configJson.layout) {
    return [{ _Error: "Invalid map data provided." }];
  }

  const hiddenWrapper = document.createElement("div");
  hiddenWrapper.style.display = "none";
  document.body.appendChild(hiddenWrapper);

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];
    const sourceId = `scanner_src_${i}`;

    let outCanvasId = null;
    if (outputContainerId) {
      outCanvasId = `outCanvas_${i}`;
      const outCanvas = document.createElement("canvas");
      outCanvas.id = outCanvasId;
      outCanvas.className = "canvasOutput";
      document.getElementById(outputContainerId).appendChild(outCanvas);
    }

    try {
      if (file.type === "application/pdf") {
        const pdfCanvas = document.createElement("canvas");
        pdfCanvas.id = sourceId;
        hiddenWrapper.appendChild(pdfCanvas);
        await renderPdfToCanvas(file, pdfCanvas);
      } else {
        const imgElem = document.createElement("img");
        imgElem.id = sourceId;
        hiddenWrapper.appendChild(imgElem);
        await new Promise((resolve, reject) => {
          imgElem.onload = resolve;
          imgElem.onerror = reject;
          imgElem.src = URL.createObjectURL(file);
        });
      }

      // The fillThreshold from the UI gets passed into the OpenCV extractor here
      let dataResult = extractDataWithOpenCV(
        sourceId,
        configJson,
        fillThreshold,
        outCanvasId,
      );
      dataResult._Filename = file.name;
      extractedDataArray.push(dataResult);
    } catch (error) {
      console.error(`Error processing ${file.name}:`, error);
      extractedDataArray.push({ _Filename: file.name, _Error: error.message });
    }

    hiddenWrapper.innerHTML = "";
  }

  document.body.removeChild(hiddenWrapper);
  return extractedDataArray;
}

// Helper: PDF to Canvas
async function renderPdfToCanvas(file, targetCanvas) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.0 });
  const context = targetCanvas.getContext("2d");
  targetCanvas.height = viewport.height;
  targetCanvas.width = viewport.width;
  await page.render({ canvasContext: context, viewport: viewport }).promise;
}

// Helper: Core Extraction
function extractDataWithOpenCV(
  sourceId,
  config,
  fillThreshold,
  outCanvasId = null,
) {
  let src = cv.imread(sourceId);
  let gray = new cv.Mat();
  let thresh = new cv.Mat();
  let fillThresh = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
  cv.threshold(gray, fillThresh, 160, 255, cv.THRESH_BINARY_INV);
  let erodeKernel = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.erode(fillThresh, fillThresh, erodeKernel);

  let contours = new cv.MatVector();
  let hierarchy = new cv.Mat();
  cv.adaptiveThreshold(
    gray,
    thresh,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    25,
    10,
  );
  let healKernel = cv.Mat.ones(3, 3, cv.CV_8U);
  cv.morphologyEx(thresh, thresh, cv.MORPH_CLOSE, healKernel);
  cv.findContours(
    thresh,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE,
  );

  let candidateBubbles = [];
  let areas = [];
  let hull = new cv.Mat();
  let headerMargin = src.rows * 0.08;

  for (let i = 0; i < contours.size(); ++i) {
    let cnt = contours.get(i);
    let rect = cv.boundingRect(cnt);
    if (rect.y < headerMargin) continue;
    let area = cv.contourArea(cnt);
    if (area < 100 || area > 8000) continue;

    let boundingBoxArea = rect.width * rect.height;
    let aspectRatio = rect.width / rect.height;
    let extent = area / boundingBoxArea;
    cv.convexHull(cnt, hull, false, true);
    let solidity = area / cv.contourArea(hull);

    if (
      aspectRatio > 0.7 &&
      aspectRatio < 1.3 &&
      extent > 0.65 &&
      solidity > 0.85
    ) {
      candidateBubbles.push(rect);
      areas.push(boundingBoxArea);
    }
  }

  let targetArea = 500;
  if (areas.length > 0) {
    areas.sort((a, b) => a - b);
    targetArea = areas[Math.floor(areas.length / 2)];
  }

  let minArea = targetArea * 0.6;
  let maxArea = targetArea * 1.4;
  let finalBubbles = [];

  for (let rect of candidateBubbles) {
    let boundingBoxArea = rect.width * rect.height;
    if (boundingBoxArea > minArea && boundingBoxArea < maxArea) {
      let isDuplicate = finalBubbles.some(
        (b) => Math.abs(b.x - rect.x) < 10 && Math.abs(b.y - rect.y) < 10,
      );
      if (!isDuplicate) finalBubbles.push(rect);
    }
  }

  contours.delete();
  hierarchy.delete();
  hull.delete();
  healKernel.delete();

  if (finalBubbles.length < 2) {
    src.delete();
    gray.delete();
    thresh.delete();
    fillThresh.delete();
    erodeKernel.delete();
    throw new Error("Alignment failed: Not enough bubbles found.");
  }

  // Alignment logic
  finalBubbles.sort((a, b) => a.x + a.y - (b.x + b.y));
  let currentTL = finalBubbles[0];
  let currentBR = finalBubbles[finalBubbles.length - 1];

  let masterTL = config.anchors.masterTL;
  let masterBR = config.anchors.masterBR;

  let scaleX = (currentBR.x - currentTL.x) / (masterBR.x - masterTL.x);
  let scaleY = (currentBR.y - currentTL.y) / (masterBR.y - masterTL.y);
  let shiftX = currentTL.x - masterTL.x * scaleX;
  let shiftY = currentTL.y - masterTL.y * scaleY;

  let warpedClusters = config.layout.map((cluster) =>
    cluster.map((rect) => ({
      x: Math.round(rect.x * scaleX + shiftX),
      y: Math.round(rect.y * scaleY + shiftY),
      width: Math.round(rect.width * scaleX),
      height: Math.round(rect.height * scaleY),
    })),
  );

  let scoutingData = {
    Student_ID: "",
    Team_Number: "",
    Match_Type: "Unknown",
    Match_Number: "",
    Alliance: "",
    Overall_Ranking: "",
    Starting_Position: "",
    Accuracy: "",
    Efficency: "",
    Throughput: "",
    Agility: "",
    Storage: "",
    Game_Won: "",
    Auton_Won: "",
    Auto_Actions: {},
    Teleop_Actions: {},
    Auto_Balls: "",
    Teleop_Balls: "",
    Alliance_Score: "",
    Features: {},
    Happenings: {},
  };

  // ==========================================
  // BUCKET SORTING (THE BULLETPROOF METHOD)
  // ==========================================

  // 1. Calculate the Top-Left X/Y for every section to make sorting easy
  let clustersWithBounds = warpedClusters.map((cluster) => {
    return {
      originalCluster: cluster,
      minY: Math.min(...cluster.map((rect) => rect.y)),
      minX: Math.min(...cluster.map((rect) => rect.x)),
    };
  });

  // 2. Sort strictly Top-to-Bottom
  clustersWithBounds.sort((a, b) => a.minY - b.minY);

  // 3. Group into physical rows
  let rows = [];
  let currentRow = [];
  let rowTolerance = 60; // Max pixels of vertical wiggle room before starting a new row

  for (let i = 0; i < clustersWithBounds.length; i++) {
    let currentItem = clustersWithBounds[i];

    if (currentRow.length === 0) {
      currentRow.push(currentItem);
    } else {
      // Compare this item to the very first item in the current row
      let rowBaselineY = currentRow[0].minY;

      // If it's within the tolerance, it belongs in this row
      if (Math.abs(currentItem.minY - rowBaselineY) < rowTolerance) {
        currentRow.push(currentItem);
      } else {
        // It's too far down! Save the current row and start a new one
        rows.push(currentRow);
        currentRow = [currentItem];
      }
    }
  }
  // Don't forget to push the very last row!
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  // 4. Sort each individual row Left-to-Right
  rows.forEach((row) => {
    row.sort((a, b) => a.minX - b.minX);
  });

  // 5. Smush them all back together into your original array
  warpedClusters = [];
  rows.forEach((row) => {
    row.forEach((item) => {
      warpedClusters.push(item.originalCluster);
    });
  });

  warpedClusters.forEach((cluster, index) => {
    // ==========================================
    // ORIGINAL BUBBLE SORTING RESTORED (DOUBLE-SORT)
    // ==========================================
    // Pass 1: Sort by rows first
    cluster.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 15) return a.y - b.y;
      return a.x - b.x;
    });

    // Pass 2: Sort by columns
    cluster.sort((a, b) => {
      if (Math.abs(a.x - b.x) < 20) {
        return a.y - b.y;
      }
      return a.x - b.x;
    });
    // ==========================================

    let filledIndices = [];
    cluster.forEach((rect, i) => {
      if (
        rect.x >= 0 &&
        rect.y >= 0 &&
        rect.x + rect.width <= fillThresh.cols &&
        rect.y + rect.height <= fillThresh.rows
      ) {
        let roi = fillThresh.roi(
          new cv.Rect(
            rect.x + 5,
            rect.y + 5,
            rect.width - 10,
            rect.height - 10,
          ),
        );
        let fillRatio = cv.countNonZero(roi) / (roi.rows * roi.cols);
        roi.delete();

        if (fillRatio > fillThreshold) {
          filledIndices.push(i);
          if (outCanvasId)
            cv.rectangle(
              src,
              new cv.Point(rect.x, rect.y),
              new cv.Point(rect.x + rect.width, rect.y + rect.height),
              [0, 255, 0, 255],
              2,
            );
        } else {
          if (outCanvasId)
            cv.rectangle(
              src,
              new cv.Point(rect.x, rect.y),
              new cv.Point(rect.x + rect.width, rect.y + rect.height),
              [255, 0, 0, 255],
              1,
            );
        }
      }
    });

    // DRAW SECTION LABEL OVER BOX
    if (outCanvasId) {
      let minX = Math.min(...cluster.map((b) => b.x)),
        minY = Math.min(...cluster.map((b) => b.y));
      let maxX = Math.max(...cluster.map((b) => b.x + b.width)),
        maxY = Math.max(...cluster.map((b) => b.y + b.height));

      // Draw the Section Boundary
      cv.rectangle(
        src,
        new cv.Point(minX - 5, minY - 5),
        new cv.Point(maxX + 5, maxY + 5),
        [255, 165, 0, 255],
        2,
      );

      // Generate Label Text: Use name from JSON if available, else use Index
      let labelText =
        config.sections && config.sections[index]
          ? config.sections[index]
          : `Sect: ${index}`;

      cv.putText(
        src,
        labelText,
        new cv.Point(minX, minY - 10),
        cv.FONT_HERSHEY_SIMPLEX,
        0.6,
        [255, 165, 0, 255],
        2,
      );
    }

    // --- Logic Mapping Starts Here ---
    if (index < 5) {
      scoutingData.Student_ID += filledIndices[0] % 10 || 0;
    } else if (index < 10) {
      scoutingData.Student_ID = isNaN(parseInt(scoutingData.Student_ID, 10))
        ? 0
        : parseInt(scoutingData.Student_ID, 10);
      scoutingData.Team_Number += filledIndices[0] % 10 || 0;
    } else if (index == 10) {
      scoutingData.Team_Number = isNaN(parseInt(scoutingData.Team_Number, 10))
        ? 0
        : parseInt(scoutingData.Team_Number, 10);
      const types = ["Practice", "Qualifier", "Final"];
      scoutingData.Match_Type = types[filledIndices[0]] || "None";
    } else if (index < 13) {
      scoutingData.Match_Number += filledIndices[0] % 10 || 0;
    } else if (index == 13) {
      scoutingData.Match_Number = isNaN(parseInt(scoutingData.Match_Number, 10))
        ? 0
        : parseInt(scoutingData.Match_Number, 10);

      const alliances = ["Blue", "Red"];
      scoutingData.Alliance = alliances[filledIndices[0] - 1] || "None";
    } else if (index == 14) {
      scoutingData.Overall_Ranking = filledIndices[0] + 1;
    } else if (index == 15) {
      scoutingData.Starting_Position = filledIndices[0] + 1;
    } else if (index == 16) {
      scoutingData.Accuracy = filledIndices[0] + 1;
    } else if (index == 17) {
      scoutingData.Efficency = filledIndices[0] + 1;
    } else if (index == 18) {
      scoutingData.Throughput = filledIndices[0] + 1;
    } else if (index == 19) {
      scoutingData.Agility = filledIndices[0] + 1;
    } else if (index == 20) {
      scoutingData.Storage = filledIndices[0] + 1;
    } else if (index == 21) {
      scoutingData.Game_Won = filledIndices.length > 0 ? "Yes" : "No";
    } else if (index == 22) {
      scoutingData.Auton_Won = filledIndices.length > 0 ? "Yes" : "No";
    } else if (index == 23) {
      scoutingData.Auto_Actions = {
        Ground_Intake: filledIndices.includes(0) ? "Yes" : "No",
        Human_Player_Intake: filledIndices.includes(1) ? "Yes" : "No",
        Bump: filledIndices.includes(2) ? "Yes" : "No",
        Trench: filledIndices.includes(3) ? "Yes" : "No",
        Shoot_To_Area: filledIndices.includes(4) ? "Yes" : "No",
        Dump_In_Area: filledIndices.includes(5) ? "Yes" : "No",
        "Left Hang": filledIndices.includes(6) ? "Yes" : "No",
        "Center Hang": filledIndices.includes(7) ? "Yes" : "No",
        "Right Hang": filledIndices.includes(8) ? "Yes" : "No",
      };
    } else if (index == 24) {
      scoutingData.Teleop_Actions = {
        Ground_Intake: filledIndices.includes(0) ? "Yes" : "No",
        Human_Player_Intake: filledIndices.includes(1) ? "Yes" : "No",
        Bump: filledIndices.includes(2) ? "Yes" : "No",
        Trench: filledIndices.includes(3) ? "Yes" : "No",
        Shoot_To_Area: filledIndices.includes(4) ? "Yes" : "No",
        Dump_In_Area: filledIndices.includes(5) ? "Yes" : "No",
        "Left Hang": filledIndices.includes(6) ? "Yes" : "No",
        "Center Hang": filledIndices.includes(7) ? "Yes" : "No",
        "Right Hang": filledIndices.includes(8) ? "Yes" : "No",
      };
    } else if (index == 25) {
      scoutingData.Auto_Balls =
        filledIndices.length == 0 ? 0 : filledIndices[0] * 10;
    } else if (index == 26) {
      scoutingData.Teleop_Balls =
        filledIndices[0] * 100 + (filledIndices[1] - 5) * 10;
    } else if (index == 27) {
      scoutingData.Alliance_Score =
        filledIndices[0] * 100 +
        (filledIndices[1] - 10) * 10 +
        (filledIndices[2] - 20) * 1;
    } else if (index == 28) {
      scoutingData.Features = {
        Hang: filledIndices[0] < 3 ? filledIndices[0] + 1 : 0,
        Auto_Aim: filledIndices.includes(3) ? "Yes" : "No",
        Turret: filledIndices.includes(4) ? "Yes" : "No",
        "Dual/Drum": filledIndices.includes(5) ? "Yes" : "No",
        Expaning: filledIndices.includes(6) ? "Yes" : "No",
      };
    } else if (index == 29) {
      scoutingData.Happenings = {
        Beached: filledIndices.includes(0) ? "Yes" : "No",
        Electrical: filledIndices.includes(1) ? "Yes" : "No",
        Disabled: filledIndices.includes(2) ? "Yes" : "No",
        Penalty: filledIndices.includes(3) ? "Yes" : "No",
        No_Show: filledIndices.includes(4) ? "Yes" : "No",
      };
    }
  });

  if (outCanvasId) {
    cv.imshow(outCanvasId, src);
  }

  src.delete();
  gray.delete();
  thresh.delete();
  fillThresh.delete();
  erodeKernel.delete();
  return scoutingData;
}