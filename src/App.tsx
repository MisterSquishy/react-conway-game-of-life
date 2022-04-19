import { context, trace } from "@opentelemetry/api";
import { CollectorTraceExporter } from "@opentelemetry/exporter-collector";
import { Resource } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { Button, InputNumber, Layout, PageHeader, Select, Space } from "antd";
import Modal from "antd/lib/modal/Modal";
import produce from "immer";
import React, { useCallback, useRef, useState } from "react";
import { Layer, Stage } from "react-konva";
import "./App.css";
import GridCell from "./components/GridCell";
import SHAPES, { CELL_STATE, PREFABS } from "./shapes";

const { Option, OptGroup } = Select;

export type TEAM = "blue" | "red";

const numRows = 11;
const numCols = 22;

const name = "game of life";
const tracerProvider = new WebTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: name,
  }),
});

// tracerProvider.addSpanProcessor(
//   new SimpleSpanProcessor(new ConsoleSpanExporter())
// );

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
const version = "0.1.0";
const tracer = trace.getTracer(name, version);

export interface Cell {
  state: CELL_STATE;
  team?: TEAM;
}

export type Grid = Cell[][];

const SHAPE_GROUPS = {
  Stables: [PREFABS.BEEHIVE, PREFABS.BEEHIVE_WITH_TAIL, PREFABS.MIRRORED_TABLE],
  Methuselahs: [
    PREFABS.R_PENTOMINO,
    PREFABS.QUEEN_BEE,
    PREFABS.ACORN,
    PREFABS.PI_HEPTOMINO,
  ],
  Oscillators: [
    PREFABS.BLINKER,
    PREFABS.TUMBLER,
    PREFABS.TOAD,
    PREFABS.QUEEN_BEE_SHUTTLE,
    PREFABS.FIGURE_EIGHT,
  ],
  Spaceships: [PREFABS.GLIDER, PREFABS.COPPERHEAD, PREFABS.LOAFER],
  Guns: [PREFABS.GOSPER_GLIDER_GUN],
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
  const [team, setTeam] = useState<TEAM>("blue");
  const [done, setDone] = useState(false);
  const priorStatesRef = useRef<string[]>([]);
  const intervalMs = useRef(50);
  const generation = useRef(0);
  const renderSpan = tracer.startSpan("render frame", {
    attributes: {
      generation: generation.current,
      intervalMs: intervalMs.current,
    },
  });
  try {
    const generateEmptyGrid = useCallback((): Grid => {
      const ctx = trace.setSpan(context.active(), renderSpan);
      const emptyGridSpan = tracer.startSpan("generate empty grid", {}, ctx);
      const rows = [];
      for (let i = 0; i < numRows; i++) {
        rows.push(
          Array.from(Array(numCols), () => ({
            state: CELL_STATE.DEAD,
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
              let livingNeighbors = 0;
              let livingBlueNeighbors = 0;
              let livingRedNeighbors = 0;
              operations.forEach(([x, y]) => {
                const newI = i + x;
                const newK = k + y;
                if (
                  newI >= 0 &&
                  newI < numRows &&
                  newK >= 0 &&
                  newK < numCols
                ) {
                  const neighborIsAlive =
                    g[newI][newK].state === CELL_STATE.ALIVE;
                  livingNeighbors += neighborIsAlive ? 1 : 0;
                  livingBlueNeighbors +=
                    neighborIsAlive && g[newI][newK].team === "blue" ? 1 : 0;
                  livingRedNeighbors +=
                    neighborIsAlive && g[newI][newK].team === "red" ? 1 : 0;
                }
              });

              if (livingNeighbors < 2 || livingNeighbors > 3) {
                gridCopy[i][k].state = CELL_STATE.DEAD;
              } else if (
                g[i][k].state === CELL_STATE.DEAD &&
                livingNeighbors === 3
              ) {
                gridCopy[i][k].team =
                  livingBlueNeighbors > livingRedNeighbors
                    ? "blue"
                    : livingRedNeighbors > livingBlueNeighbors
                    ? "red"
                    : Math.random() > 0.5
                    ? "blue"
                    : "red";
                gridCopy[i][k].state = CELL_STATE.ALIVE;
              }
            }
          }
          generateCurrentGenerationSpan.end();
          const gridAsString = JSON.stringify(gridCopy);
          if (
            priorStatesRef.current.find(
              (priorGrid) => priorGrid === gridAsString
            )
          ) {
            setDone(true);
          } else {
            priorStatesRef.current.push(gridAsString);
          }
        });
      });

      runGenerationSpan.end();
    }, [generation, renderSpan]);

    const runLoop = useCallback(() => {
      if (!runningRef.current) {
        return;
      }
      setDone(false);
      runGeneration();
      setTimeout(runLoop, intervalMs.current);
    }, [runGeneration, intervalMs]);

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
              state: cursorShape[row][col],
              team,
            };
          }
        }
        getCellsForCursorSpan.end();
        return newGrid;
      },
      [cursorType, renderSpan, team]
    );

    const [hoveredRow, hoveredColumn] = hoveredCell || [];
    const hoveredCells =
      hoveredRow !== undefined && hoveredColumn !== undefined
        ? getCellsForCursor(hoveredRow, hoveredColumn)
        : [];

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
          <Space
            size="large"
            style={{ justifyContent: "center", width: "100%" }}
          >
            <Button
              type="primary"
              onClick={() => {
                setRunning(!running);
                if (!running) {
                  runningRef.current = true;
                  runLoop();
                }
              }}
            >
              {running ? "stop" : "start"}
            </Button>
            <Button type="primary" disabled={running} onClick={runGeneration}>
              step
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
                            state: CELL_STATE.ALIVE,
                            team:
                              Math.random() > 0.5 ? "blue" : ("red" as TEAM),
                          }
                        : {
                            state: CELL_STATE.DEAD,
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
          <Space
            size="large"
            style={{ justifyContent: "center", width: "100%" }}
          >
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
          <Space
            size="large"
            style={{ justifyContent: "center", width: "100%" }}
          >
            Generation duration (ms)
            <InputNumber
              value={intervalMs.current}
              onChange={(val) => (intervalMs.current = val)}
            />
          </Space>
          <Space
            size="large"
            style={{ justifyContent: "center", width: "100%" }}
          >
            generation {generation.current}
          </Space>
          <Button onClick={() => setTeam(team === "blue" ? "red" : "blue")}>
            Change teams
          </Button>
          {done && (
            <>
              <Space>This game is done</Space>
              <Space>
                Red has{" "}
                {grid.reduce((prev, cur) => {
                  return (
                    prev +
                    cur
                      .map((cell) =>
                        cell.state === CELL_STATE.ALIVE && cell.team === "red"
                          ? 1
                          : (0 as number)
                      )
                      .reduce((prev, cur) => prev + cur, 0)
                  );
                }, 0)}
              </Space>
              <Space>
                Blue has{" "}
                {grid.reduce((prev, cur) => {
                  return (
                    prev +
                    cur
                      .map((cell) =>
                        cell.state === CELL_STATE.ALIVE && cell.team === "blue"
                          ? 1
                          : (0 as number)
                      )
                      .reduce((prev, cur) => prev + cur, 0)
                  );
                }, 0)}
              </Space>
            </>
          )}
          <Stage width={15 * numCols} height={15 * numRows}>
            <Layer>
              {grid.map((rows, i) =>
                rows.map((col, k) => (
                  <GridCell
                    coords={{
                      row: i,
                      col: k,
                    }}
                    cell={
                      hoveredCells[i]?.[k]?.state === CELL_STATE.ALIVE
                        ? {
                            state: CELL_STATE.HOVERED,
                            team: hoveredCells[i]?.[k]?.team,
                          } // todo ew
                        : grid[i]?.[k]
                    }
                    key={`${i}-${k}`}
                    onClick={() => {
                      const ctx = trace.setSpan(context.active(), renderSpan);
                      const gridCellClickSpan = tracer.startSpan(
                        "grid cell click",
                        {},
                        ctx
                      );
                      setGrid(mergeGrids(hoveredCells, grid));
                      gridCellClickSpan.end();
                    }}
                    onMouseEnter={() => setHoveredCell([i, k])}
                    onMouseLeave={() => setHoveredCell(undefined)}
                  />
                ))
              )}
            </Layer>
          </Stage>
        </Space>
      </Layout>
    );
  } finally {
    renderSpan.end();
  }
};

export default App;
