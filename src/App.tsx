import { context, trace } from "@opentelemetry/api";
import { CollectorTraceExporter } from "@opentelemetry/exporter-collector";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { Button, InputNumber, Layout, PageHeader, Select, Space } from "antd";
import Modal from "antd/lib/modal/Modal";
import produce from "immer";
import React, { useCallback, useRef, useState } from "react";
import "./App.css";
import SHAPES, { CELL_STATE, PREFABS } from "./shapes";

const { Option, OptGroup } = Select;

// Create a provider for activating and tracking spans
const tracerProvider = new WebTracerProvider();

// Connect to Lightstep by configuring the exporter with your endpoint and access token.
tracerProvider.addSpanProcessor(
  new BatchSpanProcessor(
    new CollectorTraceExporter({
      url: "https://ingest.lightstep.com:443/api/v2/otel/trace",
      headers: {
        "Lightstep-Access-Token":
          "EcBjBBDRmEx/0rSEEjwaDmu17kRjCNYDoErvoqsLSd+/ZpOE0tWr6cv/wVW5+WShxA+cg/f1T6t2gsnhjqFStbuiwhnfFf0LirNMRyr9",
      },
    })
  )
);

// Register the tracer
tracerProvider.register();
trace.setGlobalTracerProvider(tracerProvider);
const name = "game of life";
const version = "0.1.0";
const tracer = trace.getTracer(name, version);

const aliveColor = "#007EA6";
const starvingColor = "#88A990";
const hoverColor = "#D7CD4E";

const numRows = 30;
const numCols = 100;

interface CellState {
  previous: CELL_STATE;
  current: CELL_STATE;
  next: CELL_STATE;
}

type Grid = CellState[][];

const SHAPE_GROUPS = {
  Stables: [PREFABS.BEEHIVE, PREFABS.BEEHIVE_WITH_TAIL, PREFABS.MIRRORED_TABLE],
  Oscillators: [PREFABS.BLINKER, PREFABS.TUMBLER, PREFABS.QUEEN_BEE_SHUTTLE],
  Gliders: [PREFABS.GLIDER],
};

const operations = [
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
  [-1, -1],
  [1, 0],
  [-1, 0],
];

const App: React.FC = () => {
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<[number, number]>();
  const [cursorType, setCursorType] = useState<PREFABS>(PREFABS.POINT);
  const intervalMs = useRef(50);
  const generation = useRef(0);
  const renderSpan = tracer.startSpan("render frame", {
    attributes: {
      generation: generation.current,
      intervalMs: intervalMs.current,
    },
  });

  const generateEmptyGrid = useCallback((): Grid => {
    const ctx = trace.setSpan(context.active(), renderSpan);
    const emptyGridSpan = tracer.startSpan("generate empty grid", {}, ctx);
    const rows = [];
    for (let i = 0; i < numRows; i++) {
      rows.push(
        Array.from(Array(numCols), () => ({
          previous: CELL_STATE.DEAD,
          current: CELL_STATE.DEAD,
          next: CELL_STATE.DEAD,
        }))
      );
    }
    emptyGridSpan.end();
    return rows;
  }, [renderSpan]);

  const mergeGrids = useCallback(
    (grid1: Grid, grid2: Grid): Grid => {
      const ctx = trace.setSpan(context.active(), renderSpan);
      const mergeGridsSpan = tracer.startSpan("merge grids", {}, ctx);
      const mergedGrid: Grid = [];
      for (var i = 0; i < numRows; i++) {
        mergedGrid[i] = [];
        for (var k = 0; k < numCols; k++) {
          mergedGrid[i][k] = grid1[i]?.[k] || grid2[i]?.[k];
        }
      }
      mergeGridsSpan.end();
      return mergedGrid;
    },
    [renderSpan]
  );

  const [grid, setGrid] = useState(() => {
    return generateEmptyGrid();
  });

  const [running, setRunning] = useState(false);

  const runningRef = useRef(running);
  runningRef.current = running;

  const runGeneration = useCallback(() => {
    const ctx = trace.setSpan(context.active(), renderSpan);
    const runGenerationSpan = tracer.startSpan("run generation", {}, ctx);
    if (!runningRef.current) {
      return;
    }

    generation.current++;
    setGrid((g) => {
      return produce(g, (gridCopy) => {
        // set previous and current
        const ctx = trace.setSpan(context.active(), runGenerationSpan);
        const generateCurrentGenerationSpan = tracer.startSpan(
          "generate current generation",
          {},
          ctx
        );
        for (let i = 0; i < numRows; i++) {
          for (let k = 0; k < numCols; k++) {
            gridCopy[i][k].previous = gridCopy[i][k].current;
            let livingNeighbors = 0;
            operations.forEach(([x, y]) => {
              const newI = i + x;
              const newK = k + y;
              if (newI >= 0 && newI < numRows && newK >= 0 && newK < numCols) {
                const neighborIsAlive =
                  g[newI][newK].current === CELL_STATE.ALIVE;
                livingNeighbors += neighborIsAlive ? 1 : 0;
              }
            });

            if (livingNeighbors < 2 || livingNeighbors > 3) {
              gridCopy[i][k].current = CELL_STATE.DEAD;
            } else if (
              g[i][k].current === CELL_STATE.DEAD &&
              livingNeighbors === 3
            ) {
              gridCopy[i][k].current = CELL_STATE.ALIVE;
            }
          }
        }
        generateCurrentGenerationSpan.end();
        const generateNextGenerationSpan = tracer.startSpan(
          "generate next generation",
          {},
          ctx
        );
        // set next
        for (let i = 0; i < numRows; i++) {
          for (let k = 0; k < numCols; k++) {
            let livingNeighbors = 0;
            operations.forEach(([x, y]) => {
              const newI = i + x;
              const newK = k + y;
              if (newI >= 0 && newI < numRows && newK >= 0 && newK < numCols) {
                const neighborIsAlive =
                  g[newI][newK].current === CELL_STATE.ALIVE;
                livingNeighbors += neighborIsAlive ? 1 : 0;
              }
            });
            if (livingNeighbors < 2 || livingNeighbors > 3) {
              gridCopy[i][k].next = CELL_STATE.DEAD;
            } else if (
              g[i][k].current === CELL_STATE.DEAD &&
              livingNeighbors === 3
            ) {
              gridCopy[i][k].next = CELL_STATE.ALIVE;
            } else if (
              g[i][k].current === CELL_STATE.ALIVE &&
              livingNeighbors >= 2 &&
              livingNeighbors <= 3
            ) {
              gridCopy[i][k].next = CELL_STATE.ALIVE;
            }
          }
        }
        generateNextGenerationSpan.end();
      });
    });

    setTimeout(runGeneration, intervalMs.current);
    runGenerationSpan.end();
  }, [generation, intervalMs, renderSpan]);

  const getCellsForCursor = useCallback(
    (i: number, k: number): Grid => {
      const ctx = trace.setSpan(context.active(), renderSpan);
      const getCellsForCursorSpan = tracer.startSpan(
        "get cells for cursor",
        {},
        ctx
      );
      const cursorShape = SHAPES[cursorType];
      const newGrid: Grid = [];
      var startRow = i;
      var startCol = k;
      if (numRows < i + cursorShape.length) {
        // shape would run off bottom of grid
        startRow = numRows - cursorShape.length;
      }
      if (numCols < k + cursorShape[0].length) {
        // shape would run off right of grid
        startCol = numCols - cursorShape[0].length;
      }
      for (var row = 0; row < cursorShape.length; row++) {
        newGrid[startRow + row] = [];
        for (var col = 0; col < cursorShape[row].length; col++) {
          newGrid[startRow + row][startCol + col] = {
            previous: cursorShape[row][col],
            current: cursorShape[row][col],
            next: cursorShape[row][col],
          };
        }
      }
      getCellsForCursorSpan.end();
      return newGrid;
    },
    [cursorType, renderSpan]
  );

  const cellColorStyle = useCallback(
    (i: number, k: number) => {
      const ctx = trace.setSpan(context.active(), renderSpan);
      const cellColorStyleSpan = tracer.startSpan("cell color style", {}, ctx);
      const cellState = grid[i][k];
      const [hoveredRow, hoveredColumn] = hoveredCell || [];
      const hoveredCells =
        hoveredRow !== undefined && hoveredColumn !== undefined
          ? getCellsForCursor(hoveredRow, hoveredColumn)
          : [];
      if (
        hoveredRow !== undefined &&
        hoveredColumn !== undefined &&
        hoveredCells[i] &&
        hoveredCells[i][k]?.current === CELL_STATE.ALIVE
      ) {
        return {
          backgroundColor: hoverColor,
        };
      } else if (cellState.current === CELL_STATE.ALIVE) {
        return {
          backgroundColor: aliveColor,
        };
      } else if (cellState.current === CELL_STATE.DEAD) {
        if (
          cellState.previous !== CELL_STATE.DEAD ||
          cellState.next !== CELL_STATE.DEAD
        ) {
          return {
            backgroundColor: starvingColor,
          };
        }
      }
      cellColorStyleSpan.end();
    },
    [getCellsForCursor, grid, hoveredCell, renderSpan]
  );

  renderSpan.end();

  return (
    <Layout
      style={{
        padding: "32px",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Modal
        title="Da Rules"
        width="1050px"
        visible={rulesModalOpen}
        onCancel={() => setRulesModalOpen(false)}
        footer={null}
      >
        <iframe
          title="Conway's Game of Life"
          src="https://conwaylife.com/wiki/Conway%27s_Game_of_Life#Rules"
          width="1000px"
          height="500px"
        />
      </Modal>
      <PageHeader
        title="John Conway's Game of Life"
        subTitle={
          <Button type="link" onClick={() => setRulesModalOpen(true)}>
            What is this?
          </Button>
        }
      />
      <Space direction="vertical" size="large">
        <Space size="large" style={{ justifyContent: "center", width: "100%" }}>
          <Button
            type="primary"
            onClick={() => {
              setRunning(!running);
              if (!running) {
                runningRef.current = true;
                runGeneration();
              }
            }}
          >
            {running ? "stop" : "start"}
          </Button>
          <Button
            type="default"
            onClick={() => {
              generation.current = 0;
              setRunning(false);
              const rows = [];
              for (let i = 0; i < numRows; i++) {
                rows.push(
                  Array.from(Array(numCols), () =>
                    Math.random() > 0.7
                      ? {
                          current: CELL_STATE.ALIVE,
                          next: CELL_STATE.ALIVE,
                          previous: CELL_STATE.ALIVE,
                        }
                      : {
                          current: CELL_STATE.DEAD,
                          next: CELL_STATE.DEAD,
                          previous: CELL_STATE.DEAD,
                        }
                  )
                );
              }

              setGrid(rows);
            }}
          >
            random
          </Button>
          <Button
            danger
            onClick={() => {
              generation.current = 0;
              setRunning(false);
              setGrid(generateEmptyGrid());
            }}
          >
            clear
          </Button>
        </Space>
        <Space size="large" style={{ justifyContent: "center", width: "100%" }}>
          Prefab
          <Select
            defaultValue={cursorType}
            onChange={setCursorType}
            style={{ width: "200px" }}
          >
            <Option value={PREFABS.POINT}>POINT</Option>
            {Object.entries(SHAPE_GROUPS).map(([key, cursorTypes]) => (
              <OptGroup label={key} key={key}>
                {cursorTypes.map((value, key) => (
                  <Option value={value} key={`${value}-${key}`}>
                    {PREFABS[value]}
                  </Option>
                ))}
              </OptGroup>
            ))}
          </Select>
        </Space>
        <Space size="large" style={{ justifyContent: "center", width: "100%" }}>
          Generation duration (ms)
          <InputNumber
            value={intervalMs.current}
            onChange={(val) => (intervalMs.current = val)}
          />
        </Space>
        <Space size="large" style={{ justifyContent: "center", width: "100%" }}>
          generation {generation.current}
        </Space>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${numCols}, 15px)`,
          }}
        >
          {grid.map((rows, i) =>
            rows.map((col, k) => (
              <div
                key={`${i}-${k}`}
                onClick={() => {
                  const ctx = trace.setSpan(context.active(), renderSpan);
                  const gridCellClickSpan = tracer.startSpan(
                    "grid cell click",
                    {},
                    ctx
                  );
                  const clickedCells = getCellsForCursor(i, k);
                  setGrid(mergeGrids(clickedCells, grid));
                  gridCellClickSpan.end();
                }}
                onMouseEnter={() => setHoveredCell([i, k])}
                onMouseLeave={() => setHoveredCell(undefined)}
                style={{
                  width: 15,
                  height: 15,
                  border: "solid 0.5px black",
                  ...cellColorStyle(i, k),
                }}
              />
            ))
          )}
        </div>
      </Space>
    </Layout>
  );
};

export default App;
